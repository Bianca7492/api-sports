#!/usr/bin/env node
/**
 * Serve the iLOTBET web app for local viewing.
 *
 *   npm run ui:ilotbet              http://localhost:12000
 *   PORT=8080 npm run ui:ilotbet
 *
 * The app is a Vue single-page bundle, so this is a reverse proxy rather than a dump: assets,
 * fonts and images are streamed from the live site unmodified, which keeps the UI, the CSS, the
 * animations and the responsive breakpoints byte-for-byte the site's own. The only edit is
 * rewriting the API base inside the JS bundles to same-origin, so the app's API calls come back
 * here instead of hitting the geo-restricted backend.
 *
 * The API is answered from `ui-mock.mjs` by default (see the note there). Set
 * `ILOTBET_UI_API=upstream` to forward those calls to the real backend instead - useful from a
 * region iLOTBET serves, where the real odds fill in.
 *
 * Fetched assets are cached under .dump/ilotbet-ui-cache/ so restarts do not re-download the
 * bundles. Delete that directory to refresh.
 */

import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { mkdirSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { responseFor } from "./ui-mock.mjs";
import { responseFromCapture, captureInfo } from "./capture-store.mjs";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const CACHE = join(ROOT, ".dump", "ilotbet-ui-cache");

const PORT = Number(process.env.PORT || 12000);
const ORIGIN = process.env.ILOTBET_UI_UPSTREAM || "https://sw.ilotbet.com";
const API = process.env.ILOTBET_UI_API || "mock"; // "mock" | "upstream"

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36";

/**
 * Rewrites applied to JS bundles. The site calls its API on one of these hosts; pointing them at
 * the empty string makes the app call its own origin, which lands on this server. socket.io
 * treats an empty URL as same-origin too, so it follows the page across both the local port and
 * the https tunnel.
 */
const REWRITES = [
  ["https://canary.ilotbet.com/api", "/api"],
  ["https://www.ilotbet.com/api", "/api"],
  ["//canary.ilotbet.com/api", "/api"],
  ["//www.ilotbet.com/api", "/api"],
  ["wss://api.ilotbet.com", ""],
  ["https://api.ilotbet.com", ""],
];

mkdirSync(CACHE, { recursive: true });

const cachePaths = (key) => {
  const h = createHash("sha1").update(key).digest("hex");
  return { body: join(CACHE, h), type: join(CACHE, h + ".ct") };
};

async function upstream(path) {
  const res = await fetch(ORIGIN + path, { headers: { "user-agent": UA, accept: "*/*", "accept-language": "en" } });
  return { status: res.status, type: res.headers.get("content-type") || "application/octet-stream", body: Buffer.from(await res.arrayBuffer()) };
}

function send(res, status, body, type) {
  res.writeHead(status, {
    "content-type": type,
    "content-length": body.length,
    "cache-control": "no-store",
    "access-control-allow-origin": "*",
  });
  res.end(body);
}

/** Fetch an asset, caching it on disk, then apply the JS rewrites. */
async function asset(path) {
  const { body: cp, type: ct } = cachePaths(path);
  let data;
  let type;
  if (existsSync(cp) && existsSync(ct)) {
    data = readFileSync(cp);
    type = readFileSync(ct, "utf8").trim();
  } else {
    const r = await upstream(path);
    if (r.status >= 400) return r;
    data = r.body;
    type = r.type;
    writeFileSync(cp, data);
    writeFileSync(ct, type);
  }

  if (path.endsWith(".js") || type.includes("javascript")) {
    let text = data.toString("utf8");
    for (const [from, to] of REWRITES) text = text.split(from).join(to);
    data = Buffer.from(text, "utf8");
  }
  return { status: 200, type, body: data };
}

const server = createServer(async (req, res) => {
  const path = req.url;
  try {
    // The app's API calls. Real answers come first when a capture is present, so the UI shows
    // what the site actually returned; the mock fills in the rest. The query string is
    // significant to a capture (it is part of the key) and irrelevant to the mock.
    if (path.startsWith("/api/") || path.startsWith("/api?")) {
      if (API === "upstream") {
        const r = await upstream(path);
        return send(res, r.status, r.body, r.type);
      }
      const captured = responseFromCapture(path);
      if (captured) {
        return send(res, 200, Buffer.from(JSON.stringify(captured)), "application/json;charset=UTF-8");
      }
      return send(res, 200, Buffer.from(JSON.stringify(responseFor(path))), "application/json;charset=UTF-8");
    }

    if (path.startsWith("/socket.io")) {
      // The realtime channel is not reproduced; answer so the client does not retry forever.
      return send(res, 200, Buffer.from("0"), "text/plain");
    }

    // SPA routes: anything without a file extension is served the shell.
    const looksLikeFile = /\.[a-z0-9]+(\?|$)/i.test(path);
    const target = looksLikeFile ? path : "/";
    const r = await asset(target);
    if (r.status >= 400 && !looksLikeFile) {
      const shell = await asset("/");
      return send(res, 200, shell.body, shell.type);
    }
    return send(res, r.status, r.body, r.type);
  } catch (e) {
    return send(res, 502, Buffer.from(String(e && e.message ? e.message : e)), "text/plain");
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const cap = captureInfo();
  process.stderr.write(
    `ilotbet-ui listening on http://localhost:${PORT}\n` +
      `  upstream: ${ORIGIN}\n` +
      `  api:      ${API}${API === "mock" ? " (sample data; iLOTBET blocks this region)" : ""}\n` +
      `  capture:  ${cap ? `${cap.routes} routes from ${cap.path}` : "none - serving the mock"}\n`,
  );
});
