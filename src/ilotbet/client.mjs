/**
 * The client that talks to iLOTBET.
 *
 * Builds the signed request the site's own frontend would send: common params merged in, the
 * body sorted and signed with RSA-MD5, and the site's headers attached. The generator and the
 * proxy server both go through here.
 *
 * A token (ILOTBET_TOKEN) is attached as User-Token/Access-Token when present. Public endpoints
 * work without one; account endpoints answer 401/403 without a valid token.
 *
 * iLOTBET geolocates by IP: from an unsupported region every call answers 403 "prohibited
 * jurisdiction". The client reports that distinctly so a caller can tell a block from a bug.
 */

import { loadSignKey, commonParams, DEFAULT_HEADERS, API_BASE } from "./catalog.mjs";
import { signParams } from "./sign.mjs";

let cachedKey;
function signKey() {
  if (cachedKey === undefined) cachedKey = loadSignKey();
  return cachedKey;
}

/** The account token, if one is configured. */
export function loadToken() {
  return process.env.ILOTBET_TOKEN || "";
}

/** Whether a token is configured (account endpoints may work). */
export function hasToken() {
  return Boolean(loadToken());
}

function buildPayload(endpoint, args = {}) {
  const payload = commonParams({ timestamp: Date.now(), ...args });
  // path params are in the URL, not the body
  for (const name of Object.keys(endpoint.pathParams || {})) delete payload[name];
  return payload;
}

/**
 * Call one endpoint. Returns { status, ok, json, text, url, ms, blocked }.
 * `blocked` is true when the site refused the network's region, so callers can say so plainly.
 */
export async function call(endpoint, args = {}, opts = {}) {
  const method = (endpoint.method || "POST").toUpperCase();
  const payload = buildPayload(endpoint, args);
  const url = new URL(API_BASE + endpoint.path);
  if (method === "GET") {
    for (const [k, v] of Object.entries(payload)) {
      if (v === null || v === undefined || v === "") continue;
      url.searchParams.set(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    }
  }
  const headers = { ...DEFAULT_HEADERS, ...(endpoint.headers || {}) };
  headers.timestamp = String(payload.timestamp);
  headers.deviceCode = payload.deviceCode;
  headers.sign = signParams(payload, signKey());
  const token = opts.token ?? loadToken();
  if (token) {
    headers["User-Token"] = token;
    headers["Access-Token"] = token;
  }

  const started = Date.now();
  const res = await fetch(url, {
    method,
    headers,
    body: method === "GET" ? undefined : JSON.stringify(payload),
    redirect: "follow",
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  // iLOTBET answers 403 to unsupported regions. It sometimes says "prohibited jurisdiction" and
  // sometimes a bare HTML 403 from the edge; both mean the same thing, and neither is JSON.
  const blocked = res.status === 403 && (json === undefined || /prohibited jurisdiction/i.test(text));
  return {
    status: res.status,
    ok: res.ok,
    json,
    text,
    url: url.toString(),
    ms: Date.now() - started,
    blocked,
  };
}
