/**
 * iLOTBET configuration that does not depend on the generated catalog.
 *
 * Kept separate so the generator can write endpoints.generated.mjs before anything imports it.
 * The signing key is public (it ships in the site's bundle) and lives in keys/.
 */

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, existsSync } from "node:fs";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export const ORIGIN = process.env.ILOTBET_ORIGIN || "https://www.ilotbet.com";
export const API_BASE = process.env.ILOTBET_BASE || `${ORIGIN}/api`;
export const KEY_PATH = process.env.ILOTBET_KEY_FILE || join(ROOT, "keys", "ilot-sign.pem");

/** The public signing key the site ships in its bundle. */
export function loadSignKey() {
  if (!existsSync(KEY_PATH)) {
    throw new Error(`no signing key at ${KEY_PATH}; run \`npm run generate:ilotbet\` first`);
  }
  return readFileSync(KEY_PATH, "utf8");
}

/** Common params the site merges into every body before signing. */
export function commonParams(overrides = {}) {
  return {
    platform: 4, // 4 = PC web
    platformModel: "1.0",
    lcc: "",
    loginChannel: "ilot",
    deviceCode: process.env.ILOTBET_DEVICE || "00000000-0000-4000-8000-000000000000",
    deviceSoftVersion: process.env.ILOTBET_VERSION || "202610301747",
    ...overrides,
  };
}

/** Headers the site's own frontend sends, minus the per-request sign/timestamp (the client adds those). */
export const DEFAULT_HEADERS = {
  accept: "application/json, text/plain, */*",
  "content-type": "application/json",
  lang: process.env.ILOTBET_LANG || "en",
  "accept-language": process.env.ILOTBET_LANG || "en",
  "country-code": process.env.ILOTBET_COUNTRY || "gh",
  version: commonParams().deviceSoftVersion,
  origin: ORIGIN,
  referer: `${ORIGIN}/pc/home`,
  "user-agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36",
};
