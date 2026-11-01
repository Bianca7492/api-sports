/**
 * The iLOTBET provider's configuration and generated endpoint catalog.
 *
 * The endpoint list is generated (endpoints.generated.mjs) from the site's own JS bundles by
 * `npm run generate:ilotbet`. The hand-written parts are here (origin, headers) and in
 * aliases.mjs (friendly names).
 *
 * iLOTBET needs a signed body on every call; see sign.mjs. This file deliberately keeps no
 * secret: the signing key is public (it ships in the site's bundle) and lives in keys/.
 */

import { ENDPOINTS } from "./endpoints.generated.mjs";
import { ALIASES } from "./aliases.mjs";
import { ORIGIN, API_BASE, KEY_PATH, loadSignKey, commonParams, DEFAULT_HEADERS } from "./config.mjs";

/**
 * Endpoints the proxy will not forward, even when a caller has a token: they move money or place
 * bets. Kept here (not in the generated catalog) so regeneration cannot re-enable them.
 */
export const WRITE_PATHS = new Set([
  "/funds/api/payment",
  "/funds/api/withdrawal",
  "/funds/api/addAccountBanks",
  "/funds/api/addAccountBanksV2",
  "/funds/api/delAccountBanks",
  "/sbt/api/t/create",
  "/sbt/api/t/delete",
  "/sbt/api/t/cashout",
  "/spo/api/create",
  "/spo/api/cancel",
  "/virtualgame/api/bet",
  "/ssim/api/create/v2",
  "/engine/T301200",
]);

export { ENDPOINTS, ALIASES, ORIGIN, API_BASE, KEY_PATH, loadSignKey, commonParams, DEFAULT_HEADERS };

/** Resolve an alias or generated operationId to a catalog entry, or undefined. */
export function findEndpoint(name) {
  return ENDPOINTS.find((e) => e.operationId === name) || ENDPOINTS.find((e) => ALIASES[name] === e.path);
}

/** How many aliases currently point at a path with no matching generated operation. */
export function danglingAliases() {
  const paths = new Set(ENDPOINTS.map((e) => e.path));
  return Object.entries(ALIASES).filter(([, p]) => !paths.has(p));
}
