/**
 * Reproduce iLOTBET's request signature.
 *
 * Unlike SportyBet (cookie session), every iLOTBET request carries a `sign` header that is an
 * RSA signature over the request body, recomputed on each call. That is why this provider needs
 * code and not just a catalog: the site's own frontend (chunk-vendors-*.js) builds it as
 *
 *   1. sortParams(body)   keys sorted, "k=v" pairs joined with "&", empty/null dropped
 *   2. md5(s)             lowercase hex of that string
 *   3. sign(digest)       RSA-MD5 (PKCS#1 v1.5) over the digest's ASCII hex, base64
 *
 * The 1024-bit key in keys/ilot-sign.pem is the key the site ships to every visitor inside its
 * own frontend bundle - the site's shared signing key, not a per-user credential. It is public.
 */

import { createHash, createSign } from "node:crypto";

export function sortParams(data) {
  if (typeof data === "string") return data.split("&").sort().join("&");
  const out = [];
  for (const key of Object.keys(data).sort()) {
    let value = data[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "object" && JSON.stringify(value) === "{}") continue;
    if (typeof value === "object") value = JSON.stringify(value);
    else if (String(value).length === 0) continue;
    out.push(`${key}=${value}`);
  }
  return out.join("&");
}

export function md5(data) {
  return createHash("md5").update(data, "utf8").digest("hex");
}

/** The `sign` header value for a body, or "" for an empty body. */
export function signParams(data, privateKeyPem) {
  if (!data || JSON.stringify(data) === "{}") return "";
  const digest = md5(sortParams(data));
  return createSign("RSA-MD5").update(digest, "utf8").sign(privateKeyPem).toString("base64");
}
