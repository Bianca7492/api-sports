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
