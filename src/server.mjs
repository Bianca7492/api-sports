#!/usr/bin/env node
/**
 * The proxy server. It serves:
 *
 *   GET /openapi.json, /openapi.yaml, /docs   the generated spec and a Swagger UI page
 *   GET /api/{country}/{path}                 the catalog endpoints, forwarded to SportyBet
 *
 * The `/api/...` paths match the spec's paths exactly, so any OpenAPI client pointed at
 * `http://localhost:PORT/openapi.json` works with no further configuration. The server adds the
 * stored session cookies; clients never see them.
 *
 * Regeneration is live: every request to /openapi.json rebuilds the document from the current
 * catalog and the live site, so the API follows SportyBet without a restart. Set
 * OPENAPI_CACHE_MS to cache that rebuild (default 60000).
 */

import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ENDPOINTS, COUNTRY } from "./catalog.mjs";
import { call, loadSession, sessionLooksSignedIn, buildUrl } from "./client.mjs";
import { buildOpenApi } from "./openapi.mjs";
import { buildOpenApi as buildIlotbetOpenApi, MOUNT as ILOTBET_MOUNT } from "./ilotbet/openapi.mjs";
import { call as callIlotbet } from "./ilotbet/client.mjs";
import { ENDPOINTS as ILOTBET_ENDPOINTS, WRITE_PATHS } from "./ilotbet/catalog.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = Number(process.env.PORT || 3000);
const CACHE_MS = Number(process.env.OPENAPI_CACHE_MS ?? 60000);

/** Match an incoming request path against the catalog. */
function matchEndpoint(pathname) {
  const prefix = `/api/${COUNTRY}`;
  if (!pathname.startsWith(prefix)) return undefined;
  for (const ep of ENDPOINTS) {
    const pattern = new RegExp(`^${prefix}${ep.path.replace(/\{[^}]+\}/g, "([^/]+)")}$`);
    const m = pattern.exec(pathname);
    if (m) {
      const names = [...ep.path.replace(/\{[^}]+\}/g, "\u0000").matchAll(/\u0000/g)].length
        ? [...ep.path.matchAll(/\{([^}]+)\}/g)].map((x) => x[1])
        : [];
      const pathArgs = {};
      names.forEach((n, i) => (pathArgs[n] = decodeURIComponent(m[i + 1])));
      return { ep, pathArgs };
    }
  }
  return undefined;
}

let cache = { at: 0, doc: null };
async function getDoc() {
  if (cache.doc && Date.now() - cache.at < CACHE_MS) return cache.doc;
  cache = { at: Date.now(), doc: await buildOpenApi() };
  return cache.doc;
}

let ilotCache = { at: 0, doc: null };
async function getIlotDoc() {
  if (ilotCache.doc && Date.now() - ilotCache.at < CACHE_MS) return ilotCache.doc;
  ilotCache = { at: Date.now(), doc: await buildIlotbetOpenApi() };
  return ilotCache.doc;
}

/**
 * iLOTBET routes, mounted under /ilotbet so they never collide with SportyBet's /api/{country}.
 * Returns undefined when the request is not ours, so the SportyBet routes still run.
 */
async function handleIlotbet(url) {
  if (url.pathname === "/openapi.ilotbet.json") return { status: 200, body: await getIlotDoc() };
  if (url.pathname === "/openapi.ilotbet.yaml") {
    const file = join(ROOT, "openapi.ilotbet.yaml");
    return existsSync(file)
      ? { status: 200, body: readFileSync(file, "utf8"), type: "text/yaml" }
      : { status: 404, body: "run `npm run generate:ilotbet` first", type: "text/plain" };
  }
  if (url.pathname === ILOTBET_MOUNT || url.pathname === `${ILOTBET_MOUNT}/docs`) {
    return { status: 200, body: ILOTBET_DOCS_HTML, type: "text/html" };
  }
  if (url.pathname === `${ILOTBET_MOUNT}/routes`) {
    const file = join(ROOT, "routes.ilotbet.html");
    return existsSync(file)
      ? { status: 200, body: readFileSync(file, "utf8"), type: "text/html" }
      : { status: 404, body: "run `npm run routes:ilotbet` first", type: "text/plain" };
  }
  if (!url.pathname.startsWith(`${ILOTBET_MOUNT}/`)) return undefined;

  const path = url.pathname.slice(ILOTBET_MOUNT.length);
  const ep = ILOTBET_ENDPOINTS.find((e) => e.path === path);
  if (!ep) {
    return { status: 404, body: { error: "not_found", message: `no iLOTBET endpoint at ${path}. See /openapi.ilotbet.json` } };
  }
  if (WRITE_PATHS.has(ep.path)) {
    return {
      status: 403,
      body: {
        error: "write_not_proxied",
        message: "This endpoint moves money or places a bet, so the proxy does not forward it. Use the SDK directly if you mean to.",
        operationId: ep.operationId,
      },
    };
  }

  const args = Object.fromEntries(url.searchParams.entries());
  const result = await callIlotbet(ep, args);
  if (result.blocked) {
    return {
      status: 403,
      body: {
        error: "prohibited_jurisdiction",
        message:
          "iLOTBET refused this server's network (403: visiting from a prohibited jurisdiction). It geolocates by IP; run the proxy from a region iLOTBET serves.",
        operationId: ep.operationId,
      },
    };
  }
  if (result.status === 401 || result.status === 403) {
    return {
      status: result.status,
      body: {
        error: "unauthorized",
        message: `iLOTBET refused the request (HTTP ${result.status}). This endpoint needs a valid account token; set ILOTBET_TOKEN and retry.`,
        operationId: ep.operationId,
        upstreamUrl: result.url,
      },
    };
  }
  if (result.json === undefined) {
    return {
      status: 502,
      body: { error: "upstream_not_json", message: "iLOTBET did not return JSON.", status: result.status, body: result.text.slice(0, 500) },
    };
  }
  return { status: result.status, body: result.json };
}

const ILOTBET_DOCS_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>iLOTBET API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head>
<body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: "/openapi.ilotbet.json", dom_id: "#swagger-ui" });</script>
</body></html>`;

function send(res, status, body, type = "application/json") {
  const text = typeof body === "string" ? body : JSON.stringify(body, null, 2);
  res.writeHead(status, {
    "content-type": type,
    "access-control-allow-origin": "*",
    "cache-control": "no-store",
  });
  res.end(text);
}

const DOCS_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>SportyBet API</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head>
<body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: "/openapi.json", dom_id: "#swagger-ui" });</script>
</body></html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    // iLOTBET first: its own mount and spec paths, then fall through to SportyBet.
    const ilot = await handleIlotbet(url);
    if (ilot) return send(res, ilot.status, ilot.body, ilot.type);

    if (url.pathname === "/openapi.json") return send(res, 200, await getDoc());
    if (url.pathname === "/openapi.yaml") {
      const yaml = existsSync(join(ROOT, "openapi.yaml")) ? readFileSync(join(ROOT, "openapi.yaml"), "utf8") : "";
      return send(res, yaml ? 200 : 404, yaml || "run `npm run generate` first", "text/yaml");
    }
    if (url.pathname === "/" || url.pathname === "/docs") return send(res, 200, DOCS_HTML, "text/html");
    if (url.pathname === "/health") {
      return send(res, 200, {
        ok: true,
        session: sessionLooksSignedIn(),
        cookies: loadSession().length,
        endpoints: ENDPOINTS.length,
        ilotbet: { endpoints: ILOTBET_ENDPOINTS.length, mount: ILOTBET_MOUNT, spec: "/openapi.ilotbet.json" },
      });
    }

    const match = matchEndpoint(url.pathname);
    if (!match) {
      return send(res, 404, {
        error: "not_found",
        message: `no endpoint at ${url.pathname}. See /openapi.json`,
      });
    }

    const { ep, pathArgs } = match;
    const queryArgs = Object.fromEntries(url.searchParams.entries());
    const result = await call(ep, { ...pathArgs, ...queryArgs });

    if (result.status === 401 || result.status === 403) {
      return send(res, result.status, {
        error: "unauthorized",
        message: `SportyBet refused the request (HTTP ${result.status}). This endpoint needs a signed-in session; run \`npm run login\` and retry.`,
        operationId: ep.operationId,
        upstreamUrl: result.url,
      });
    }
    if (result.json === undefined) {
      return send(res, 502, {
        error: "upstream_not_json",
        message: "SportyBet did not return JSON.",
        status: result.status,
        body: result.text.slice(0, 500),
      });
    }
    return send(res, result.status, result.json);
  } catch (e) {
    return send(res, 500, { error: "proxy_error", message: e.message });
  }
});

server.listen(PORT, () => {
  process.stderr.write(
    `sportybet-api listening on http://localhost:${PORT}\n` +
      `  spec:  http://localhost:${PORT}/openapi.json\n` +
      `  docs:  http://localhost:${PORT}/docs\n` +
      `  session: ${sessionLooksSignedIn() ? "signed in" : "none (Account endpoints will 401)"}\n`,
  );
});
