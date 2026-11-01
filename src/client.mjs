/**
 * The client that talks to SportyBet.
 *
 * Reads the session from .sportybet-cookies.json (produced by `npm run login`, or exported by
 * hand from a signed-in browser), attaches the cookies and the site's own headers, and returns
 * decoded JSON. The generator and the proxy server both go through here, so both see the same
 * session and the same error handling.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { COUNTRY, ORIGIN, DEFAULT_HEADERS, SESSION_COOKIES } from "./catalog.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const SESSION_FILE = process.env.SPORTYBET_SESSION_FILE || join(ROOT, ".sportybet-cookies.json");

/** The stored session cookies, as { name, value } pairs. Empty when there is no session file. */
export function loadSession() {
  if (!existsSync(SESSION_FILE)) return [];
  try {
    const parsed = JSON.parse(readFileSync(SESSION_FILE, "utf8"));
    const arr = Array.isArray(parsed) ? parsed : parsed.cookies || [];
    return arr
      .filter((c) => c && c.name && c.value !== undefined)
      .map((c) => ({ name: c.name, value: String(c.value) }));
  } catch {
    return [];
  }
}

/** Whether the stored session looks signed in (has the cookies SportyBet sets on login). */
export function sessionLooksSignedIn() {
  const names = new Set(loadSession().map((c) => c.name));
  return SESSION_COOKIES.some((n) => names.has(n));
}

function cookieHeader(cookies) {
  return cookies.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** Build the full upstream URL for an endpoint and its args. */
export function buildUrl(endpoint, args = {}) {
  let path = endpoint.path;
  for (const [name, spec] of Object.entries(endpoint.pathParams || {})) {
    const v = args[name] ?? spec.default ?? "";
    path = path.replace(`{${name}}`, encodeURIComponent(String(v)));
  }
  const url = new URL(`/api/${COUNTRY}${path}`, ORIGIN);
  for (const [name, spec] of Object.entries(endpoint.query || {})) {
    let v = args[name];
    if (v === undefined || v === "") v = spec.default;
    if (v === undefined || v === "") continue;
    if (Array.isArray(v)) v = v.join(",");
    url.searchParams.set(name, String(v));
  }
  return url.toString();
}

/**
 * Call one endpoint. Returns { status, ok, json, text, url, ms }.
 * `auth: true` endpoints are still attempted without a session; SportyBet answers 401 and the
 * caller reports it, which keeps the spec honest about which endpoints need a login.
 */
export async function call(endpoint, args = {}, opts = {}) {
  const url = buildUrl(endpoint, args);
  const cookies = opts.cookies || loadSession();
  const headers = { ...DEFAULT_HEADERS, ...(endpoint.headers || {}) };
  if (cookies.length) headers.cookie = cookieHeader(cookies);
  const started = Date.now();
  const res = await fetch(url, { method: endpoint.method || "GET", headers, redirect: "follow" });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, ok: res.ok, json, text, url, ms: Date.now() - started };
}
