#!/usr/bin/env node
/**
 * Enumerate the site's whole API surface without clicking through it.
 *
 * The landing page and every game are separate single-page apps, each with its own bundle, and
 * each bundle names the endpoints its app calls. Reading those bundles yields the API surface
 * directly, including the games - which the main app never calls itself, because it only ever
 * embeds them in an iframe.
 *
 * Usage:
 *   node probe-api.mjs                    # discover, print a summary, write api-surface.json
 *   node probe-api.mjs --out surface.json
 *   node probe-api.mjs --resolve-urls     # sign in, then resolve each game id to its url
 *   node probe-api.mjs --resolve-urls --token TOKEN   # skip the login, use a session token
 *   node probe-api.mjs --login            # prompts for credentials, needed only for account routes
 *
 * The login reads ILOTBET_TOKEN, else ILOTBET_ACCOUNT and ILOTBET_PASSWORD, else prompts.
 * Every request has a 20s deadline; ILOTBET_TIMEOUT raises it.
 *
 * Requires Node 18+ (global fetch).
 */

import { writeFileSync, readFileSync, statSync } from "node:fs";
import { createHash, createSign } from "node:crypto";
import { fileURLToPath } from "node:url";

const API = process.env.ILOTBET_API_ORIGIN || "https://www.ilotbet.com";
const UA =
  "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

const arg = (n, d) => {
  const i = process.argv.indexOf(n);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d;
};
const OUT = arg("--out", "api-surface.json");

/** Printed on every run so a stale copy on disk is obvious rather than silent. */
const VERSION = "22";

/** Write the raw game-list responses, so the listing can be read without this network. */
const DUMP_LIST = process.argv.includes("--dump-list");

/** Resolve each game id to its launch url. One request per game, so opt in. */
const RESOLVE_URLS = process.argv.includes("--resolve-urls");

/** An endpoint literal looks like `/module/api/thing` or `/module/un/thing`. */
const isEndpoint = (s) => /^[a-z][a-z0-9]*\/(api|un)\//.test(s);

/** Paths the app or games link to that are pages, not APIs. */
const PAGEY = /\.(js|css|png|jpg|jpeg|svg|gif|woff2?|ttf|ico|json|html|webp|mp3|mp4)$/i;

/**
 * Every request body is stamped with this block before it is sent. The values and the
 * fallbacks are the ones the site's request interceptor uses, in its own order.
 */
const PLATFORM = {
  platform: Number(process.env.ILOTBET_PLATFORM || 3),
  platformModel: process.env.ILOTBET_PLATFORM_MODEL || "1.0",
  lcc: process.env.ILOTBET_LCC || "",
  loginChannel: process.env.ILOTBET_CHANNEL || "ilot",
  deviceCode: Number(process.env.ILOTBET_DEVICE || Date.now()),
  deviceSoftVersion: process.env.ILOTBET_SOFT_VERSION || "202610301747",
};
const COUNTRY = process.env.ILOTBET_COUNTRY || "ng";
const APP_VERSION = process.env.ILOTBET_VERSION || "202610301747";

/** The signing key, copied from the site's own signParams module. It ships in the public
 * bundle and every visitor signs with it, so it is not a secret to be kept here. */
const SIGN_KEY = `-----BEGIN PRIVATE KEY-----
MIICdwIBADANBgkqhkiG9w0BAQEFAASCAmEwggJdAgEAAoGBAMMRQOevHKZo7dIM
zB0oKEtijePYOOgI1Z7lrdOMJumjJt7CCeByS40AvdjcQe2PskgkIQclfiIempQo
KoYMIW5UsrzNSf9PB61sPEyTvVZzRC8xARIbuPemFiZX6ywtHFUrVwnuRqLsMPZm
s/+yyyXbB+WNc7Y0OUWkmUWc1QDHAgMBAAECgYAhhtWg/HfwIhi+AXUTjdNfIZFB
l+gv+VS9+rvloDEP9vq3TqJj8UEK+xWmMDUkn44E2DDVCZykQJ5Q2JZ2c59LCjjh
VPr2Krek0aFkGD1DsXU4NDkGVQyBxW1R9O2o//4OS1gwjIG57Q0n+VNscObCR5cv
n/zXHtYPkfodDD0gAQJBAPFDALgqebsWBtkJ5+8Of+ClA0+R3QsXYigz1PH73ar9
OoXd+TuVnYA/AtwR/Jze0dVpjVu8kh6tysbO8MgnKCMCQQDO+9XzBoqKLO8Xa1qb
MpElsSI2Ij147if+RLITCM7s3seGDYWuo8i44ATZSG0rThL38uhlEYZdPsn0187e
RB0NAkBHVhp2WgjYarDnp+guZUkmcWRDOMv1JZrebEUAsAphLrMJNhMlrR1++CKu
U5sv/ypoQeeMQnuqGpUkp7fGVt2lAkEAy064j1bse965FoLfY7QeuCwuU4f8Y61i
YTIuy92KC0akKvtbRPghr95zRM4MVU4B+cSCGsxE85A6JSJZUx8KfQJBAJ7mNB+a
nm7+EsajuoIY6L7SyQM3or/2qgl+R/W7l/xA7/3mJAYIYLoz9il5FBdLhhNUPyHc
Ek9DmeRjKOLRUu4=
-----END PRIVATE KEY-----`;

/**
 * The site's sortParams: keys sorted as strings, then "key=value" joined with "&". A value
 * that is null, undefined, the string "{}", or empty is dropped; anything else is kept, and
 * an object is stringified first.
 */
function sortParams(input) {
  if (typeof input === "string") return input.split("&").sort().join("&");
  if (input && typeof input === "object") {
    const parts = [];
    for (const k of Object.keys(input).sort()) {
      let v = input[k];
      if (v === null || v === undefined || JSON.stringify(v) === "{}") continue;
      if (v.length === 0) continue;
      if (typeof v === "object") v = JSON.stringify(v);
      parts.push(`${k}=${v}`);
    }
    return parts.join("&");
  }
  return "";
}

/** The query string form the site's stringify produces for a flat object. */
function qs(data) {
  return Object.keys(data)
    .sort()
    .filter((k) => data[k] !== null && data[k] !== undefined && String(data[k]).length)
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`)
    .join("&");
}

/** Sign is RSA-MD5 over the md5 of the sorted parameters, returned as base64. */
function signParams(data) {
  if (!data || JSON.stringify(data) === "{}") return "";
  const joined = sortParams(JSON.parse(JSON.stringify(data)));
  if (!joined) return "";
  const digest = createHash("md5").update(joined).digest("hex");
  return createSign("RSA-MD5").update(digest).sign(SIGN_KEY, "base64");
}

const headers = () => {
  const h = {
    "user-agent": UA,
    accept: "*/*",
    origin: API,
    referer: API + "/pc/home",
    "content-type": "application/json;charset=UTF-8",
    "accept-language": "en",
    lang: "en",
    version: APP_VERSION,
    "country-code": COUNTRY,
  };
  if (TOKEN) {
    h["user-token"] = TOKEN;
    h["access-token"] = TOKEN;
  }
  return h;
};

let TOKEN = "";
let SESSION_OK = false;
let SESSION_CHECKED = false;
let SESSION_REFUSED = false;

/**
 * The login form hashes the password twice with md5, lowercasing between the two and after
 * the second. It does not lowercase the password itself first, so a capital letter changes
 * the result and has to be left alone.
 */
const hashPassword = (pw) =>
  createHash("md5")
    .update(createHash("md5").update(pw).digest("hex").toLowerCase())
    .digest("hex")
    .toLowerCase();

/**
 * Read one line. Not readline: on some terminals - Termux among them - readline's second
 * question returns an empty line at once instead of waiting, so the password came back blank
 * and the login silently failed. This handles raw mode, CR or LF, backspace and Ctrl-C itself.
 */
function readLine(prompt, mute = false) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(prompt);
    const raw = Boolean(stdin.isTTY);
    if (raw) stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let buf = "";
    const done = (value) => {
      if (raw) stdin.setRawMode(false);
      stdin.removeListener("data", onData);
      stdin.pause();
      process.stdout.write("\n");
      resolve(value);
    };
    const onData = (chunk) => {
      for (const c of chunk) {
        if (c === "\u0003" || c === "\u0004") {
          if (raw) stdin.setRawMode(false);
          process.exit(130);
        }
        if (c === "\r" || c === "\n") return done(buf);
        if (c === "\u007f" || c === "\b") {
          buf = buf.slice(0, -1);
          if (!mute) process.stdout.write("\b \b");
          continue;
        }
        buf += c;
        if (!mute) process.stdout.write(c);
      }
    };
    stdin.on("data", onData);
  });
}

async function readCredentials() {
  // Without a terminal, read two lines. Lets `printf 'acct\npw\n' | node probe-api.mjs` work,
  // which is the only way to drive the login when no tty can be had.
  if (!process.stdin.isTTY) {
    const lines = [];
    process.stdin.setEncoding("utf8");
    let buf = "";
    for await (const chunk of process.stdin) {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n")) > -1) {
        lines.push(buf.slice(0, i).replace(/\r$/, ""));
        buf = buf.slice(i + 1);
      }
      if (lines.length >= 2) break;
    }
    return { account: (lines[0] || "").trim(), password: (lines[1] || "").trim() };
  }
  const account = (await readLine("Phone number or email: ")).trim();
  const password = (await readLine("Password (not shown): ", true)).trim();
  return { account, password };
}

/**
 * Ask an authenticated route whether the session is real. A token that is expired or wrong
 * otherwise shows up only as "resolved 0 of N", after N wasted requests, with no clue why.
 */
async function checkSession() {
  if (!TOKEN) return "none";
  SESSION_CHECKED = true;
  // "live", "refused", or "unknown". Only a definite refusal stops the run: a route that 404s
  // or answers HTML proves nothing about the token, and must not block a good one.
  let sawReply = false;
  for (const path of ["/api/user/api/queryPlayer", "/api/funds/api/queryAccountInfo"]) {
    const j = await post(API + path, { data: {} });
    if (!j || typeof j.code !== "number") continue;
    sawReply = true;
    if (j.code === 0) {
      console.error("the session is live");
      SESSION_OK = true;
      return "live";
    }
    if (j.code === 401 || j.code === 403) {
      console.error(
        "\nthe session was rejected, so every game-url request would come back empty.\n" +
          "Sign in on the site in a browser and copy localStorage.getItem('token') again;\n" +
          "tokens expire, and one from a different account or region will not do.\n"
      );
      return "refused";
    }
  }
  if (!sawReply) {
    console.error(
      "could not confirm the session: the check route did not answer as expected.\n" +
        "Carrying on - the game-url replies will show whether the token works.\n"
    );
  }
  return "unknown";
}

async function login() {
  // A token taken straight from the browser's localStorage under "token" skips the login
  // entirely, which is the reliable path on a phone: no prompt, no tty, no password on disk.
  const given = process.env.ILOTBET_TOKEN || arg("--token", "");
  if (given) {
    // The docs say to paste a token, so a pasted placeholder is a common way to get here.
    if (/^(paste|your|the|<|xxx)/i.test(given.trim())) {
      console.error(
        `--token was given the text "${given.trim()}", which is the placeholder from the\n` +
          "instructions rather than a token. Read the real one from the browser console with\n" +
          "  localStorage.getItem('token')\n" +
          "and pass that.\n"
      );
      process.exit(2);
    }
    TOKEN = given;
    console.error("using the token from --token");
    return;
  }
  // Credentials from the environment let this run unattended, which a phone terminal needs:
  // the interactive prompt needs a tty and hangs without one.
  let account = process.env.ILOTBET_ACCOUNT || "";
  let password = process.env.ILOTBET_PASSWORD || "";
  if (!account || !password) ({ account, password } = await readCredentials());
  if (!account || !password) {
    console.error("no account and no password given, so nothing was signed in\n");
    return;
  }
  // A number typed with a country code is not always the number the account is held under,
  // so try the forms the site itself might hold before giving up.
  const forms = accountVariants(account);
  let last = null;
  for (const [i, form] of forms.entries()) {
    // Through post(), so the body carries the platform block and the signature the API wants.
    const j = await post(API + "/api/user/un/v2/login", {
      data: { playerAccount: form, loginType: 0, password: hashPassword(password) },
    });
    last = j;
    if (j && j.code === 0 && j.data && j.data.token) {
      TOKEN = j.data.token;
      console.error(
        `logged in as ${form}` + (form === account ? "" : ` (from ${account})`)
      );
      return;
    }
    // A rejected password will not come good with another spelling of the number, and
    // repeating it risks locking the account, so stop at the first password complaint.
    const msg = (j && j.msg) || "";
    if (/password/i.test(msg)) break;
    if (i < forms.length - 1) {
      console.error(`  ${form}: ${msg || "no token"} - trying another form`);
    }
  }
  console.error(`login failed: ${(last && last.msg) || "no token"}`);
}

/**
 * The account as typed, then the forms a registration might have stored. A number entered with
 * a country code and spacing is often held as the bare national number, and sometimes with a
 * leading zero, so each of those is tried.
 */
function accountVariants(input) {
  const raw = String(input).trim();
  const digits = raw.replace(/\D/g, "");
  const bare = digits.replace(/^0+/, "");
  const out = [];
  const add = (v) => {
    if (v && !out.includes(v)) out.push(v);
  };
  if (!/^[0-9]+$/.test(raw)) return [raw]; // an email or a username is sent as it is
  // The country code is the first thing to drop, then the leading zero is the next.
  if (bare.length > 10 && bare.startsWith("234")) {
    add(bare.slice(3));
    add("0" + bare.slice(3));
  }
  add(bare);
  if (bare.length === 10) add("0" + bare);
  add(digits);
  return out.slice(0, 4);
}

/**
 * Every request gets a deadline. Without one a single unresponsive host stalls the whole run
 * with no output, which is indistinguishable from a hang.
 */
const TIMEOUT = Number(process.env.ILOTBET_TIMEOUT || 20000);
const withTimeout = (url, opts = {}) =>
  fetch(url, { ...opts, signal: AbortSignal.timeout(TIMEOUT) });

/**
 * A GET is stamped and signed the same way a POST is. The site merges the platform block into
 * the params, signs the merged object, and sends the block as the query string too, so a GET
 * without them is answered with a complaint rather than data.
 */
const get = async (url, asJson = false, params = null) => {
  const h = headers();
  let target = url;
  if (params) {
    const inner = {
      ...(params && params.data ? params.data : params),
      ...PLATFORM,
      timestamp: Date.now(),
    };
    target = `${url}?${qs(inner)}`;
    h.sign = signParams(inner);
  }
  const r = await withTimeout(target, { headers: h });
  return asJson ? r.json().catch(() => null) : r.text();
};

/**
 * The game-url routes are POSTs that take a JSON body, not query parameters. Every body also
 * carries the platform block and a signature, without which the API answers
 * "Platform model cannot be empty!" and no token comes back.
 */
/**
 * The interceptor builds every body the same way:
 *
 *   buildCommonParams(t) { t.data || (t.data = {}); t.data.deviceCode = ...;
 *                          t.data.platform = ...; t.data.timestamp = ...; return t }
 *   headers.sign = signParams(e.data)          // signed over the inner object
 *   axios.post(t, e.data)                      // sent as { data: {...} }
 *
 * So the platform fields go *inside* "data", the signature covers that inner object, and the
 * body is the envelope. Putting the platform fields at the top level, beside "data", is what
 * the account routes accepted and the game routes refused.
 */
const post = async (url, body) => {
  // buildCommonParams puts the platform fields into the same object the caller passed, and
  // axios.post sends that object as the body. The caller's "data" is therefore not a wrapper
  // in the request: it is the body. It has to be flattened, or the route is handed
  // {data:{gameId}} where it expects {gameId}, and answers that the game is unknown.
  const inner = body && body.data ? body.data : body;
  const flat = { ...inner, ...PLATFORM, timestamp: Date.now() };
  const r = await withTimeout(url, {
    method: "POST",
    headers: { ...headers(), sign: signParams(flat) },
    body: JSON.stringify(flat),
  });
  return r.json().catch(() => null);
};

/**
 * Game SPAs confirmed by following the iframe. The game list is the better source when it
 * answers with games, but it also yields client-side routes that serve the main app, and it
 * can be unreachable. These are known to be games, so scanning them always yields something.
 */
const KNOWN_GAMES = [
  "/apoker/",
  "/bestshooter/",
  "/bottle-spin/",
  "/casino/",
  "/dice/",
  "/football14/",
  "/games/cash-goal/",
  "/lucky14/",
  "/luckywinner/",
  "/rps/",
  "/scratch/",
  "/scratch/lucky-jersey",
  "/virtualcup/",
  "/virtualcup/league-bet",
  "/whot/",
];

/** Every game the site lists, as absolute URLs. */
async function gameUrls() {
  const urls = new Set();
  const raw = {};
  const collect = (o) => {
    if (!o) return;
    if (typeof o === "string") {
      for (const m of o.matchAll(/https:\/\/[a-z.]*ilotbet\.com(\/[^"'\s?]*\/)/g)) {
        const p = m[1];
        if (p.startsWith(("/pc/", "/api/", "/static/", "/assets/", "/file/"))) continue;
        // A game's thumbnail is a CDN url, and its folder looks like a path. Taking those
        // gave a dozen "/server-prod/2026/01/" entries that are not games at all.
        if (/^\/server-prod\//.test(p) || /\/\d{4}\/\d{2}\/$/.test(p)) continue;
        urls.add(p);
      }
      return;
    }
    if (Array.isArray(o)) return o.forEach(collect);
    if (typeof o === "object") return Object.values(o).forEach(collect);
  };

  const gameSources = [];
  // The arcade list is paginated. It is asked for by pageNum, with the type the site sends;
  // an unknown parameter name is answered with a complaint rather than a list.
  for (let page = 1; page <= 40; page++) {
    const params = {
      terType: 4,
      gameType: -1,
      type: "gameList",
      pageNum: page,
      pageSize: 100,
    };
    const j = await get(`${API}/api/game/un/gameList`, true, params);
    if (DUMP_LIST) raw[`${API}/api/game/un/gameList ${qs(params)}`] = j;
    if (j && j.code && j.code !== 0 && page === 1) {
      console.error(
        `the game list answered code=${j.code}${j.msg ? ` (${j.msg})` : ""}, so it names no games`
      );
    }
    const list = j && j.data && j.data.list;
    if (!list || !list.length) break;
    collect(list);
    gameSources.push({ label: "gameList", raw: list });
    if (list.length < params.pageSize) break;
  }
  // The casino list names its games as paths too.
  const home = await get(`${API}/api/casino/un/game/home`, true, {});
  if (DUMP_LIST) raw[`${API}/api/casino/un/game/home`] = home;
  collect(home);
  gameSources.push({ label: "casino/home", raw: home });
  for (const p of ["/api/casino/un/games", "/api/casino/un/games/v2"]) {
    const u = API + p;
    const j = await get(u, true);
    if (DUMP_LIST) raw[u] = j;
    collect(j);
    gameSources.push({ label: p, raw: j });
  }

  // The games in that list carry an id and a provider, not a url. The url is produced on
  // demand, by one of three POST routes, and each requires a signed-in account. The casino
  // games use the casino route, everything else the arcade one.
  if (RESOLVE_URLS) {
    if (!TOKEN) {
      console.error(
        "--resolve-urls needs an account: the game-url routes answer an anonymous caller with\n" +
          "no url. Re-run with --login.\n"
      );
    } else if (SESSION_REFUSED) {
      // Already refused. Resolving would be 84 more refusals.
      console.error("skipping url resolution: the session was refused.\n");
    } else {
      // Anything carrying an id is a candidate game. The tags and categories that sit beside
      // the games carry ids too, so the shapes are reported as well, to tell them apart.
      const games = new Map();
      const shapes = new Map();
      const walk = (o, label) => {
        if (!o) return;
        if (Array.isArray(o)) return o.forEach((x) => walk(x, label));
        if (typeof o !== "object") return;
        if (o.id != null || o.gameId != null) {
          const ks = Object.keys(o).sort().join(",");
          if (!shapes.has(ks)) shapes.set(ks, { count: 0, labels: new Set(), sample: o });
          const sh = shapes.get(ks);
          sh.count++;
          sh.labels.add(label);
          if (o.gameName || o.name) {
            const key = String(o.id != null ? o.id : o.gameId);
            if (!games.has(key)) games.set(key, { label, o });
          }
        }
        Object.values(o).forEach((x) => walk(x, label));
      };
      for (const src of gameSources) walk(src.raw, src.label);
      console.error(`resolving ${games.size} game ids to urls...`);

      // Once the caller is signed in the site reaches the casino route for every game:
      //   d = isLogin || t.developerId !== 10 ? "getCasinoGameUrl" : "getIlotCasinoGameUrl"
      // and sends the game's own id as gameId:
      //   s = {free}, s.gameId = t.id, s.ilotGameId = t.gameId
      // The list's "gameId" field is not the game's id, so ilotGameId is only sent when the
      // game really carries that number under its own name. The body also has a few shapes the
      // site uses in different places (a free play, a bare id), so those are tried too.
      const urlOf = (j) => j && j.data && j.data.url;
      const ilot = (g) => (g.o.ilotGameId != null ? { ilotGameId: Number(g.o.ilotGameId) } : {});
      const routes = [
        { path: "/api/casino/api/game/play", body: (v) => ({ gameId: Number(v), free: false }), pick: urlOf },
        { path: "/api/casino/api/game/play", body: (v, g) => ({ gameId: Number(v), free: false, ...ilot(g) }), pick: urlOf },
        { path: "/api/casino/api/game/play", body: (v) => ({ gameId: Number(v), free: true }), pick: urlOf },
        { path: "/api/casino/api/game/play", body: (v) => ({ gameId: Number(v) }), pick: urlOf },
        { path: "/api/casino/un/game/play", body: (v) => ({ gameId: Number(v), free: false }), pick: urlOf },
        { path: "/api/casino/un/game/play", body: (v, g) => ({ gameId: Number(v), ...ilot(g) }), pick: urlOf },
        { path: "/api/game/un/gamePlayUrl", body: (v) => ({ gameId: Number(v) }), pick: (j) => j && j.data },
      ];
      const idFields = ["id", "gameId", "ilotGameId"];
      const replies = [];
      const attempt = async (g, field, route) => {
        const v = g.o[field];
        if (v == null) return null;
        const inner = route.body(v, g);
        const j = await post(API + route.path, { data: inner });
        if (DUMP_LIST) raw[`POST ${API}${route.path} ${JSON.stringify(inner)}`] = j;
        const u = route.pick(j);
        if (typeof u === "string" && /^https?:/.test(u)) return u;
        if (replies.length < 4) {
          replies.push(`${route.path} ${field}=${v} -> ${JSON.stringify(j)?.slice(0, 130)}`);
        }
        return null;
      };

      const list = [...games.values()];
      let learned = null;
      let learnedAt = -1;
      let ok = 0;
      for (let i = 0; i < Math.min(4, list.length) && !learned; i++) {
        for (const field of idFields) {
          for (const route of routes) {
            const u = await attempt(list[i], field, route);
            if (u) {
              learned = { field, route };
              learnedAt = i;
              ok = 1;
              collect(u);
              console.error(`  the id is in "${field}", served by ${route.path}`);
              break;
            }
          }
          if (learned) break;
        }
      }

      const failed = [];
      if (learned) {
        const rest = await mapLimit(list.slice(learnedAt + 1), 6, async (g) => {
          let u = await attempt(g, learned.field, learned.route);
          if (u) return u;
          // A game the learned call refuses is tried against every other shape, so one odd
          // provider does not cost the whole list.
          for (const field of idFields) {
            for (const route of routes) {
              if (field === learned.field && route === learned.route) continue;
              u = await attempt(g, field, route);
              if (u) return u;
            }
          }
          failed.push(g);
          return null;
        });
        ok += rest.filter(Boolean).length;
      }
      console.error(`resolved ${ok} of ${games.size} games to a url`);

      // What is left is a short list, and the fields below are the ones the site branches on,
      // so printing them says why each one was refused rather than only that it was.
      if (failed.length) {
        console.error(`\nthe ${failed.length} games that did not resolve:`);
        for (const g of failed.slice(0, 15)) {
          const o = g.o;
          console.error(
            `  id=${o.id} ilotGameId=${o.ilotGameId} provider=${o.provider} ` +
              `developerId=${o.developerId} gameTypeCode=${o.gameTypeCode} ` +
              `freebet=${o.freebet} live=${o.live} name=${o.gameName}`
          );
        }
      }

      // The shape of the objects is what says which field holds the id the routes want, so it
      // is worth having on a run that partly worked too, not only one that failed outright.
      if (DUMP_LIST) {
        const shapesOut = [...shapes].map(([ks, sh]) => ({
          keys: ks.split(","),
          count: sh.count,
          from: [...sh.labels],
          sample: sh.sample,
        }));
        writeFileSync("game-shapes.json", JSON.stringify(shapesOut, null, 1));
        console.error("wrote game-shapes.json - the fields each listed object has");
      }

      if (!ok) {
        console.error("\nnothing resolved. the replies were:");
        for (const r of replies) console.error(`  ${r}`);
        console.error("\nthe objects in the lists, by the shape of each:");
        for (const [ks, sh] of shapes) {
          console.error(`  [${sh.count}] from ${[...sh.labels].join(", ")}`);
          console.error(`      keys: ${ks}`);
          console.error(`      e.g.  ${JSON.stringify(sh.sample).slice(0, 420)}`);
        }
        console.error(
          "\nThe id these routes want is not one of the fields above, or the body needs a\n" +
            "field that is missing. The shapes above name every field each object has.\n"
        );
      }
    }
  }
  if (DUMP_LIST) {
    writeFileSync(
      "game-list-raw.json",
      JSON.stringify({ _kind: "game-list-raw", responses: raw }, null, 1)
    );
    console.error("wrote game-list-raw.json - upload it so the listing can be read directly");
  }
  const fromList = [...urls];
  for (const g of KNOWN_GAMES) urls.add(g);
  if (fromList.length && !fromList.some((u) => KNOWN_GAMES.includes(u))) {
    console.error(
      `the game list named ${fromList.length} paths, none of them a known game - scanning the known games too`
    );
  }
  return [...urls];
}

/**
 * Pull the chunk list out of a webpack build.
 *
 * A webpack build names its lazy bundles as `"static/js/" + (nameMap[id] || id) + "." +
 * hashMap[id] + ".js"`. Both maps are object literals, so read them and pair the entries up.
 */
function webpackChunks(js) {
  const chunks = new Set();
  const nameAt = js.indexOf('"static/js/"+({');
  if (nameAt === -1) return chunks;
  const hashAt = js.indexOf('"."+{', nameAt);
  if (hashAt === -1) return chunks;
  const readMap = (from) => {
    const open = js.indexOf("{", from);
    let depth = 0;
    for (let i = open; i < js.length; i++) {
      if (js[i] === "{") depth++;
      else if (js[i] === "}" && --depth === 0) return js.slice(open + 1, i);
    }
    return "";
  };
  const pairs = (body) => {
    const m = new Map();
    for (const e of body.matchAll(/"([^"]+)":"([^"]*)"/g)) m.set(e[1], e[2]);
    return m;
  };
  const names = pairs(readMap(nameAt));
  const hashes = pairs(readMap(hashAt));
  for (const [id, hash] of hashes) {
    const name = names.get(id) || id;
    if (name && hash) chunks.add(`/static/js/${name}.${hash}.js`);
  }
  return chunks;
}

/**
 * Read a bundle and return the endpoints it names, plus the other bundles it loads.
 *
 * The endpoints do not all live in the first script tag. The main page loads a vendor chunk
 * first and the app bundle second, and the app bundle is the one that names the API; a vendor
 * chunk is mostly libraries and names almost none. Reading only the first tag reported four
 * endpoints out of more than two hundred.
 */
function scanBundle(js, found, hosts, next) {
  for (const e of js.matchAll(/["'`](\/[A-Za-z0-9_\-/]{3,70})["'`]/g)) {
    const v = e[1].replace(/^\//, "");
    if (PAGEY.test(v)) continue;
    if (v.startsWith(("static/", "assets/", "src/"))) continue;
    if (isEndpoint(v)) found.add(v);
  }
  for (const h of js.matchAll(/https?:\/\/([A-Za-z0-9._\-]+)/g)) {
    const host = h[1];
    if (!host.includes(".") || host.length < 6) continue;
    if (/ilotbet|w3\.org|github|vuejs|vuetifyjs|google|schema|npmjs|fontawesome|jsdelivr|unpkg/.test(host)) continue;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) continue;
    // Documentation links that library sources carry, not integrations.
    if (/example\.com|apache\.org|wikisource|wikipedia|momentjs|axios-http|clipboardjs|mths\.be|bit\.ly|feross|stanford\.edu|gordejev|praleska/.test(host)) continue;
    hosts.add(host);
  }
  for (const c of webpackChunks(js)) next.add(c);
  for (const c of js.matchAll(/static\/js\/([A-Za-z0-9_\-~]+)\.([a-f0-9]{8})\.js/g)) {
    next.add(`/static/js/${c[1]}.${c[2]}.js`);
  }
}

/**
 * Read one SPA: its document, every script it loads, and the chunks those reference.
 *
 * `shell` is the script set the main app serves. A client-side route such as /home or /entry
 * is served the main app again, so it names the main app's endpoints and is not a game. Compare
 * the script sets and skip those, otherwise every route gets counted as another game and the
 * main app's own endpoints are reported as game endpoints.
 */
async function scanApp(path, shell) {
  const found = new Set();
  const hosts = new Set();
  let bundle = null;
  try {
    const html = await get(API + path);
    const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g)].map((m) =>
      m[1].startsWith("http") ? m[1] : new URL(m[1], API + path).pathname
    );
    if (!scripts.length) return { found, hosts, bundle, fingerprint: "", isShell: false };
    bundle = scripts[0];
    const fingerprint = [...scripts].sort().join("|");
    if (shell && fingerprint === shell) {
      return { found, hosts, bundle, fingerprint, isShell: true };
    }

    const queue = [...new Set(scripts)];
    const seen = new Set();
    while (queue.length) {
      const b = queue.shift();
      if (seen.has(b) || seen.size > 40) continue;
      seen.add(b);
      let js;
      try {
        js = await get(API + b);
      } catch {
        continue;
      }
      const next = new Set();
      scanBundle(js, found, hosts, next);
      for (const n of next) if (!seen.has(n)) queue.push(n);
    }
    return { found, hosts, bundle, fingerprint, isShell: false };
  } catch {
    /* a game may be offline; keep going */
  }
  return { found, hosts, bundle, fingerprint: "", isShell: false };
}

async function mapLimit(items, limit, fn) {
  const out = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  // Print the file's own size so a stale copy on disk is unmistakable. A run whose banner
  // disagrees with the size in the download is running an old file, not a new bug.
  let bytes = 0;
  try {
    bytes = statSync(fileURLToPath(import.meta.url)).size;
  } catch {}
  console.log(`probe-api v${VERSION} (${bytes} bytes)`);
  // --token implies a login, but it is a plain value, so it never reaches login()'s branch.
  const inline = arg("--token", "");
  if (inline) {
    // The instructions say to paste a token, so the placeholder itself is a common paste.
    const looksFake =
      /^\s*(paste|your|the|xxx|<)/i.test(inline) ||
      inline.includes("...") ||
      inline.trim().length < 8;
    if (looksFake) {
      console.error(
        `--token was given "${inline.trim()}", which is not a token. A token is a long string;\n` +
          "this looks like the placeholder from the instructions. Read the real one from the\n" +
          "browser console with\n" +
          "  localStorage.getItem('token')\n" +
          "and pass that. No requests were sent.\n"
      );
      process.exit(2);
    }
    TOKEN = inline;
  }
  if (process.argv.includes("--login")) await login();
  // The game-url routes only answer a signed-in caller, so asking for the urls implies login.
  if (RESOLVE_URLS && !TOKEN) await login();
  // One check, whichever way the token arrived, so it never runs twice.
  if (TOKEN && !SESSION_CHECKED) SESSION_REFUSED = (await checkSession()) === "refused";

  console.error("reading the main app...");
  const main = await scanApp("/pc/home");

  console.error("listing the games...");
  const candidates = await gameUrls();
  if (!candidates.length) {
    console.error(`
Found no games. The game list came back empty, which usually means the API did not answer.

Check the API directly:
  curl -s "${API}/api/game/un/gameList?page=1&pageSize=10" | head -c 200

If that shows HTML such as "Service Unavailable" or a 502, this network is in a blocked
region and the API will not answer. Run this from a network the site serves, and the
discovery will work.
`);
    process.exit(2);
  }
  console.error(`found ${candidates.length} candidate paths, reading their bundles...`);

  const results = await mapLimit(candidates, 8, async (p) => ({
    path: p,
    ...(await scanApp(p, main.fingerprint)),
  }));

  const games = results.filter((r) => !r.isShell && r.found.size);
  const routes = results.filter((r) => r.isShell);
  if (routes.length) {
    console.error(`skipped ${routes.length} app routes served the main shell, not a game`);
  }
  if (!games.length) {
    console.error(`
Every candidate served the main shell, so no game bundle was read. The game list names
paths, but none of them is a game - they are client-side routes that the server answers with
the main app. Re-run with --dump-list and upload game-list-raw.json so the listing can be
read directly, rather than guessed at from here.
`);
  }

  const gameEndpoints = new Set();
  const offDomain = new Set();
  for (const r of games) {
    r.found.forEach((e) => gameEndpoints.add(e));
    r.hosts.forEach((h) => offDomain.add(h));
  }
  main.hosts.forEach((h) => offDomain.add(h));

  const surface = {
    _kind: "surface",
    note: "API surface of iLOTBET, read from the app and game bundles rather than by clicking.",
    generated: new Date().toISOString(),
    counts: {
      main_bundle: main.found.size,
      games_scanned: games.length,
      routes_skipped: routes.length,
      game_endpoints: gameEndpoints.size,
      union: new Set([...main.found, ...gameEndpoints]).size,
    },
    main_bundle: [...main.found].sort(),
    game_endpoints: [...gameEndpoints].sort(),
    iframe_only: [...gameEndpoints].filter((e) => !main.found.has(e)).sort(),
    games: games.map((r) => ({ path: r.path, bundle: r.bundle, endpoints: [...r.found].sort() })),
    routes_serving_the_shell: routes.map((r) => r.path),
    off_domain_hosts: [...offDomain].sort(),
  };

  writeFileSync(OUT, JSON.stringify(surface, null, 1));

  const c = surface.counts;
  console.log(`\nmain bundle      : ${c.main_bundle} endpoints`);
  console.log(`games scanned    : ${c.games_scanned}`);
  console.log(`routes skipped   : ${c.routes_skipped} (served the main shell)`);
  console.log(`game endpoints   : ${c.game_endpoints}`);
  console.log(`union            : ${c.union}`);
  console.log(`iframe-only      : ${surface.iframe_only.length}`);
  console.log(`off-domain hosts : ${surface.off_domain_hosts.join(", ") || "none"}`);
  console.log(`\nwritten to ${OUT}`);
}

main().catch((e) => {
  const why = e && e.cause && e.cause.message;
  console.error(`\nstopped: ${e.message}${why ? ` (${why})` : ""}`);
  if (/timeout|abort/i.test(`${e.message} ${why || ""}`)) {
    console.error(`a request took longer than ${TIMEOUT}ms. Raise it with ILOTBET_TIMEOUT.`);
  } else if (/fetch failed|ENOTFOUND|ECONNREFUSED/i.test(`${e.message} ${why || ""}`)) {
    console.error(`no answer from ${API} - the network is down, or this region is blocked.`);
  }
  process.exit(1);
});
