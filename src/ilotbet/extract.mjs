/**
 * Extract iLOTBET's API surface from its live frontend bundles.
 *
 * The site's endpoints are not documented anywhere; they exist only as calls inside the two JS
 * bundles the page loads. This module reads the page, fetches those bundles, and pulls out
 *
 *   - every endpoint (the frontend method name, HTTP method and path), and
 *   - the RSA signing key (a public constant in the bundle).
 *
 * Nothing is hard-coded, so when the site adds or moves an endpoint, the next generation finds it.
 * Only public assets are read: no account and no browser are needed.
 */

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";

async function get(url) {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" } });
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.text();
}

/** The JS bundle URLs the page references. */
export function bundleUrls(html, origin) {
  const urls = [...html.matchAll(/src="(\/static\/js\/[^"]+\.js)"/g)].map((m) => origin + m[1]);
  if (!urls.length) throw new Error("no JS bundles found in the page");
  return urls;
}

// An API path: absolute, under one of the site's known service prefixes, and not a static asset.
const API_PREFIX =
  /^\/(sbu|sbt|sbc|ssim|user|funds|notice|casino|game|activity|virtualgame|coupon|market|share|spo|worldcup|cagent|opact|group|engine|lottgame|sqb-quickbets|sport)\//;

export function isApiPath(p) {
  if (!p.startsWith("/") || p.length < 3) return false;
  if (/\.(js|css|png|svg|jpe?g|webp|woff2?|json)$/.test(p)) return false;
  if (/^\/(static|img|fonts|files)\//.test(p)) return false;
  return API_PREFIX.test(p);
}

// A frontend method name: starts with a letter, so a webpack module id ("107:function") is never
// mistaken for one.
const NAME = String.raw`([A-Za-z][A-Za-z0-9_]{1,39})`;

export function extractEndpoints(js) {
  const found = new Map();
  const primary = new RegExp(
    String.raw`${NAME}:function\([^)]{0,80}\)\{[^{}]{0,200}?return\s+[\w.$\[\]"']+\.(get|post|put|delete)\("(\/[^"]+)"`,
    "g",
  );
  for (const m of js.matchAll(primary)) {
    const [, name, method, p] = m;
    if (isApiPath(p)) found.set(`${method} ${p}`, { operationId: name, method: method.toUpperCase(), path: p.trim() });
  }
  // fallback: pair each call with the nearest preceding `name:function` or `name=function`
  const anyCall = /\.(get|post|put|delete)\("(\/[^"]+)"/g;
  const nameRe = new RegExp(`${NAME}[:=]function\\(`, "g");
  for (const m of js.matchAll(anyCall)) {
    const [, method, p] = m;
    if (!isApiPath(p) || found.has(`${method} ${p}`)) continue;
    const before = js.slice(Math.max(0, m.index - 600), m.index);
    const names = [...before.matchAll(nameRe)];
    if (!names.length) continue; // no usable name here; the caller falls back to a path-derived id
    found.set(`${method} ${p}`, { operationId: names[names.length - 1][1], method: method.toUpperCase(), path: p.trim() });
  }
  // De-duplicate: the same path found twice keeps its first name. Minified code sometimes pairs a
  // path with a local variable (`t=function`), so names are only kept when they read like a real
  // method (not a single letter), and a path-derived id fills any gap.
  const used = new Map();
  for (const e of found.values()) {
    const name = /^[A-Za-z][A-Za-z0-9]{1,}$/.test(e.operationId) && e.operationId.length > 2 ? e.operationId : null;
    used.set(e.path, { ...e, operationId: name || null });
  }
  return [...used.values()];
}

/** A stable, readable id from a path, used when the bundle gives no usable method name. */
export function deriveName(path) {
  const segs = path.split("/").filter(Boolean).filter((s) => !/^v\d+$/.test(s));
  const camel = segs
    .slice(-3)
    .map((s, i) => {
      const joined = s
        .replace(/[^A-Za-z0-9]+/g, " ")
        .trim()
        .split(/\s+/)
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join("");
      return i === 0 ? joined[0].toLowerCase() + joined.slice(1) : joined;
    })
    .join("");
  return camel.replace(/[^A-Za-z0-9]/g, "") || "endpoint";
}

export function extractSignKey(js) {
  const start = js.indexOf("BEGIN PRIVATE KEY");
  if (start === -1) throw new Error("no signing key found in the bundle");
  const end = js.indexOf("END PRIVATE KEY", start);
  const raw = js.slice(start + "BEGIN PRIVATE KEY".length, end);
  const b64 = raw
    .replace(/\\n/g, "")
    .replace(/[^A-Za-z0-9+/=]/g, "")
    .replace(/=+$/, "");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const lines = padded.match(/.{1,64}/g) || [];
  return `-----BEGIN PRIVATE KEY-----\n${lines.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

/** Fetch the page and its bundles, and return { bundles, js, endpoints, keyPem }. */
export async function extractFromSite(origin) {
  const html = await get(origin + "/");
  const bundles = bundleUrls(html, origin);
  let js = "";
  for (const url of bundles) {
    try {
      js += await get(url);
    } catch (err) {
      console.warn(`skip ${url}: ${err.message}`);
    }
  }
  return { bundles, js, endpoints: extractEndpoints(js), keyPem: extractSignKey(js) };
}
