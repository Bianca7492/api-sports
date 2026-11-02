#!/usr/bin/env node
/**
 * Capture the iLOTBET API from a region iLOTBET serves.
 *
 *   node tools/capture.mjs              # then browse http://localhost:12000
 *   node tools/capture.mjs --port 8080
 *
 * Run this on a device whose network iLOTBET accepts (a phone on mobile data in a served
 * region). It is the same reverse proxy as `src/ilotbet/ui.mjs`, with one addition: every
 * response the app gets from the API is written to `capture.json`, keyed by path.
 *
 * Why it works when the datacenter does not: iLOTBET geolocates by IP. The proxy relays the
 * browser's own request - signature, token and all - so the API sees the device's address and
 * the real answers come back. Nothing here needs the signing key; the app signs its own calls.
 *
 * Then send `capture.json` back so the UI can be served with real data everywhere:
 *   curl -X POST --data-binary @capture.json <upload-url>/upload
 *
 * Public endpoints only by default. Account endpoints return your own name, phone and balance -
 * do not capture those unless you mean to share them. `--include-account` overrides.
 *
 * Requires Node 18+ (uses global fetch).
 */

import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawn, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";

if (typeof fetch !== "function") {
  console.error(`This needs Node 18 or newer for fetch. You have ${process.version}.`);
  console.error("On Termux: pkg install nodejs-latest");
  process.exit(1);
}

const arg = (name, dflt) => {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
};

const PORT = Number(arg("--port", process.env.PORT || 12000));
/**
 * The pages come from www.ilotbet.com, not the sw.* host. sw.* answers every path with the main
 * site shell, including the game paths, so serving from it hands a game iframe the wrong
 * document and the game paints nothing. www.* serves each app at its own path.
 */
const PAGES = process.env.ILOTBET_UI_UPSTREAM || "https://www.ilotbet.com";
const API = process.env.ILOTBET_API_ORIGIN || "https://www.ilotbet.com";
/**
 * Which routes to record. `--scope` picks the breadth:
 *
 *   public   sports, casino listings, news, promos, and the casino games. No personal data.
 *   game     as public, plus the in-game scratch/bet calls (still no account or wallet reads).
 *   account  everything, including wallet, orders and profile. The file then holds the signed-in
 *            user's name, phone, balance and bet history.
 *
 * Account and wallet routes are excluded unless the scope is `account`, because those responses
 * carry personal data and this file is meant to be uploaded.
 */
const SCOPE = arg("--scope", process.argv.includes("--include-account") ? "account" : "game");
const OUT = process.env.ILOTBET_CAPTURE_OUT || "capture.json";
/** Where the captured file is sent back to. Override if the collector moves. */
const UPLOAD =
  process.env.ILOTBET_UPLOAD ||
  "https://work-2-yonqzqblgtdzbhjm.prod-runtime.all-hands.dev/upload";

const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/120.0 Mobile Safari/537.36";

/** Point the app's API base at this proxy so its calls come through here. */
const REWRITES = [
  ["https://canary.ilotbet.com/api", "/api"],
  ["https://www.ilotbet.com/api", "/api"],
  ["//canary.ilotbet.com/api", "/api"],
  ["//www.ilotbet.com/api", "/api"],
  ["wss://api.ilotbet.com", ""],
  ["https://api.ilotbet.com", ""],
];

/**
 * Personal-data routes. Skipped unless `--scope account`, because their responses carry the
 * signed-in user's name, phone, balance and bet history, and this file is meant to be uploaded.
 *
 * Deliberately narrow: `/sbt/` and `/scratch/` stay in, since they also carry the public betslip
 * config and the casino game's own state, and the UI does not render without them.
 */
const ACCOUNT =
  /\/(user|funds|orders|pocket|cagent|inbox|account|agent|wallet|payment|withdraw|deposit|bank|balance|transactions?|login|register)\//i;

const captured = (() => {
  if (!existsSync(OUT)) return {};
  const raw = JSON.parse(readFileSync(OUT, "utf8"));
  // The marker tells the receiver this file is a capture rather than an api-surface dump. It
  // is written on every save, so drop it when reading back or it becomes a route.
  delete raw._kind;
  return raw;
})();
let saved = 0;

function save() {
  try {
    // `_kind` travels with the file so a plain `curl --data-binary @capture.json` lands on the
    // capture, without the uploader needing to say which file it is.
    writeFileSync(OUT, JSON.stringify({ _kind: "capture", ...captured }, null, 2));
  } catch (e) {
    console.error("could not write " + OUT + ": " + e.message);
  }
}

function send(res, status, body, type) {
  res.writeHead(status, {
    "content-type": type,
    "content-length": Buffer.byteLength(body),
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

/* ---- login -------------------------------------------------------------- */

/**
 * The app hashes the password before sending it: md5(md5(password.toLowerCase()))
 * with the outer digest lowercased too. Sending the raw password gets a bad-credential
 * answer, so mirror what the app does.
 */
const hashPassword = (pw) =>
  createHash("md5")
    .update(createHash("md5").update(pw.toLowerCase()).digest("hex").toLowerCase())
    .digest("hex")
    .toLowerCase();

/** A numeric account loses a leading zero in the app before it is sent. */
const filterAccount = (a) => {
  if (!a) return a;
  return /^[0-9]*$/.test(a) ? a.replace(/^0+/, "") : a;
};

/**
 * Read the account and password from the terminal, hiding the password as it is typed.
 *
 * One readline interface serves both questions. A second interface on the same stdin loses
 * whatever was already buffered, which hangs the password prompt when input is piped.
 */
function readCredentials() {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let muted = false;
    rl._writeToOutput = function (s) {
      if (!muted) rl.output.write(s);
    };
    rl.question("Phone number or email: ", (account) => {
      muted = true;
      process.stdout.write("Password (not shown): ");
      rl.question("", (password) => {
        process.stdout.write("\n");
        rl.close();
        resolve({ account: account.trim(), password: password.trim() });
      });
    });
  });
}

let TOKEN = "";

/**
 * Log in against the real API so the recorded routes include the signed-in ones. The token is
 * kept in memory and attached to the requests the browser makes, so the app never needs to hold
 * the credentials itself.
 */
async function login() {
  const { account, password } = await readCredentials();
  if (!account || !password) {
    console.error("No credentials given, continuing without login.\n");
    return;
  }
  const payload = {
    playerAccount: filterAccount(account),
    loginType: 0,
    password: hashPassword(password),
  };
  try {
    const r = await fetch(API + "/api/user/un/v2/login", {
      method: "POST",
      headers: { "content-type": "application/json", origin: API, referer: API + "/pc/home", "user-agent": UA },
      body: JSON.stringify(payload),
    });
    const j = await r.json();
    if (j && j.code === 0 && j.data && j.data.token) {
      TOKEN = j.data.token;
      console.error(`\nLogged in as ${filterAccount(account)}. Signed-in routes will be recorded.\n`);
    } else {
      console.error(`\nLogin failed: ${j && j.msg ? j.msg : "no token returned"} (code ${j && j.code}).`);
      console.error("Continuing without login - the public routes still work.\n");
    }
  } catch (e) {
    console.error(`\nLogin request failed: ${e.message}. Continuing without login.\n`);
  }
}

/** Relay a request to the real API with the browser's own headers, and record the answer. */
async function api(req, res) {
  const body = await readBody(req);
  const skip = SCOPE !== "account" && ACCOUNT.test(req.url);
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (["host", "connection", "content-length", "accept-encoding"].includes(k)) continue;
    headers[k] = v;
  }
  // The API checks these; make them consistent with the page the request came from.
  headers.origin = API;
  headers.referer = API + "/pc/home";
  headers["user-agent"] = UA;
  // Carry the session we obtained at startup, whatever the page thinks it has.
  if (TOKEN) {
    headers["user-token"] = TOKEN;
    headers["access-token"] = TOKEN;
  }

  try {
    const r = await fetch(API + req.url, {
      method: req.method,
      headers,
      body: req.method === "GET" ? undefined : body,
    });
    const text = await r.text();
    if (!skip && r.status === 200) {
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
      if (json !== undefined) {
        captured[req.url] = { status: r.status, at: new Date().toISOString(), json };
        saved++;
        save();
        console.error(`  + [${Object.keys(captured).length}] ${req.url.split("?")[0]}  (${text.length}b)`);
      }
    } else if (skip) {
      console.error(`  - skipped (account) ${req.url.split("?")[0]}`);
    } else {
      console.error(`  ! ${r.status} ${req.url.split("?")[0]}`);
    }
    return send(res, r.status, text, r.headers.get("content-type") || "application/json");
  } catch (e) {
    console.error(`  x ${req.url.split("?")[0]}: ${e.message}`);
    return send(res, 502, JSON.stringify({ error: e.message }), "application/json");
  }
}

/**
 * Stream a page asset from the site, rewriting the API base inside JS bundles.
 *
 * Paths are served exactly as upstream has them. An earlier version sent every extensionless
 * path to "/", which broke the games: each game is its own single-page app served at its own
 * path, so the game iframe was handed the main site shell, found no mount point, and painted
 * nothing. Only fall back to "/" when upstream genuinely has nothing at the path, which is what
 * a client-side route needs.
 */
async function asset(req, res) {
  const tryFetch = async (target) => {
    const r = await fetch(PAGES + target, {
      headers: { "user-agent": UA, accept: "*/*" },
      redirect: "follow",
    });
    return r;
  };
  try {
    let r = await tryFetch(req.url);
    let target = req.url;
    if (r.status === 404 && !/\.[a-z0-9]+(\?|$)/i.test(req.url)) {
      r = await tryFetch("/");
      target = "/";
    }
    let buf = Buffer.from(await r.arrayBuffer());
    const type = r.headers.get("content-type") || "application/octet-stream";
    if (target.endsWith(".js") || type.includes("javascript")) {
      let text = buf.toString("utf8");
      for (const [from, to] of REWRITES) text = text.split(from).join(to);
      buf = Buffer.from(text, "utf8");
    }
    return send(res, r.status, buf, type);
  } catch (e) {
    return send(res, 502, String(e.message), "text/plain");
  }
}

/** Open the page in the device's browser, if we can find a way to. */
function openBrowser(url) {
  // Termux: the app to launch is `am`; `xdg-open` is not present on Android.
  const cmd =
    process.platform === "darwin"
      ? ["open", [url]]
      : process.platform === "win32"
        ? ["cmd", ["/c", "start", "", url]]
        : process.env.PREFIX && process.env.PREFIX.includes("com.termux")
          ? ["am", ["start", "-a", "android.intent.action.VIEW", "-d", url]]
          : ["xdg-open", [url]];
  try {
    const child = spawn(cmd[0], cmd[1], { detached: true, stdio: "ignore" });
    child.on("error", () => {});
    child.unref();
    return true;
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  if (req.url.startsWith("/api/") || req.url.startsWith("/api?")) return api(req, res);
  if (req.url.startsWith("/socket.io")) return send(res, 200, "0", "text/plain");
  return asset(req, res);
});

server.listen(PORT, "0.0.0.0", async () => {
  const url = `http://localhost:${PORT}/pc/home`;
  console.log(`\ncapture proxy on http://localhost:${PORT}`);
  console.log(`  pages: ${PAGES}`);
  console.log(`  api:   ${API}`);
  console.log(`  out:   ${OUT}\n`);
  if (SCOPE === "account") {
    console.log("Scope: account - wallet, orders and profile are recorded too.\n");
  } else {
    console.log("Scope: " + SCOPE + " - account and wallet routes are skipped.\n");
  }
  if (process.env.ILOTBET_NO_LOGIN !== "1") {
    await login();
  }
  console.log(`Open this in the device's browser and click around:`);
  console.log(`  ${url}\n`);
  console.log(`Matches, odds and news are recorded as they load. Then upload ${OUT}:\n`);
  console.log(`  curl -X POST --data-binary @${OUT} ${UPLOAD}\n`);
  if (!openBrowser(url)) {
    console.log(`(Could not open a browser automatically - open ${url} yourself.)\n`);
  }
});

process.on("SIGINT", () => {
  save();
  console.log(`\nsaved ${Object.keys(captured).length} responses to ${OUT}`);
  process.exit(0);
});
