#!/usr/bin/env node
/**
 * Read the answers the real site gave, so the UI can show them instead of the mock.
 *
 * The capture is written by `tools/capture.mjs` on a device iLOTBET serves, and uploaded to the
 * receiver. It is an object keyed by the request path, each value the response body the API
 * returned. This module looks a request up in it and hands the body back unchanged.
 *
 * Three things make the lookup a little more than a Map.get:
 *
 *   - the file is re-read when its mtime changes, so an upload takes effect without a restart;
 *   - the query string is part of the key, because the same path answers differently for
 *     different parameters (a game list is paged, a search is a search);
 *   - a request the capture does not hold is reported as a miss, so the caller can fall back to
 *     the mock rather than answer with nothing.
 *
 * The location is `ILOTBET_CAPTURE`, else `.dump/ilotbet-capture.json` under the repo root.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const CAPTURE = process.env.ILOTBET_CAPTURE || join(ROOT, ".dump", "ilotbet-capture.json");

let loaded = null;
let loadedMtime = 0;
let loadedPath = null;

/** Load the capture if it is new, or if a different file is now configured. */
function load() {
  if (!existsSync(CAPTURE)) {
    loaded = null;
    loadedMtime = 0;
    loadedPath = CAPTURE;
    return null;
  }
  let mtime;
  try {
    mtime = statSync(CAPTURE).mtimeMs;
  } catch {
    return loaded;
  }
  if (loaded && loadedPath === CAPTURE && mtime === loadedMtime) return loaded;
  try {
    const parsed = JSON.parse(readFileSync(CAPTURE, "utf8"));
    loaded = parsed && typeof parsed === "object" ? parsed : null;
    loadedMtime = mtime;
    loadedPath = CAPTURE;
  } catch (e) {
    process.stderr.write(`capture-store: ${CAPTURE} is not readable JSON (${e.message})\n`);
    loaded = null;
  }
  return loaded;
}

/**
 * The path as the app sent it. The capture keys on the path the browser requested, and the
 * bundles are rewritten to call their own origin, so both sides are "/api/..." already.
 */
function normalise(requestPath) {
  return requestPath.startsWith("/") ? requestPath : `/${requestPath}`;
}

/**
 * The response the site gave for this request, or null when the capture does not hold it.
 *
 * A capture value is either the response body itself, or an envelope the capture tool wrote
 * (`{json: ...}`). Both are understood. A body that is not JSON - an HTML error page the site
 * returned - is reported as a miss, because serving it to the app would be worse than the mock.
 */
export function responseFromCapture(requestPath) {
  const capture = load();
  if (!capture) return null;
  const key = normalise(requestPath);

  let hit = capture[key];
  if (hit === undefined) {
    // The tool may have keyed without the query string, or with the parameters ordered
    // differently. Fall back to the pathname, but only when exactly one entry matches it.
    const pathname = key.split("?")[0];
    const matches = Object.keys(capture).filter((k) => k.split("?")[0] === pathname);
    if (matches.length === 1) hit = capture[matches[0]];
    else if (matches.length > 1) {
      // Several answers for one path. The one whose query the request contains is the best
      // guess; without a better rule this is still a guess, so say so.
      const q = key.includes("?") ? key.slice(key.indexOf("?")) : "";
      const exact = matches.find((k) => k.endsWith(q));
      hit = capture[exact || matches[0]];
    }
  }
  if (hit === undefined || hit === null) return null;

  const body = hit && typeof hit === "object" && "json" in hit ? hit.json : hit;
  if (body === null || body === undefined) return null;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
  if (typeof body !== "object") return null;
  return body;
}

/** How many routes the capture holds, and where it is, for the startup line. */
export function captureInfo() {
  const capture = load();
  if (!capture) return null;
  return { routes: Object.keys(capture).length, path: CAPTURE };
}
