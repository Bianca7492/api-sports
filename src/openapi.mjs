/**
 * Build an OpenAPI 3.1 document from the catalog by probing the live site.
 *
 * For every endpoint with schemaFrom "sample" we call it once with the catalog's sampleArgs and
 * infer the response schema from whatever comes back. Endpoints marked "static" use the schema
 * the catalog gives (their body is a bare scalar, which inference cannot describe well). If a
 * probe fails, we still emit the operation, with a note saying why there is no schema yet, so a
 * temporary outage never hides an endpoint.
 */

import { ENDPOINTS, COUNTRY, ORIGIN } from "./catalog.mjs";
import { call, sessionLooksSignedIn } from "./client.mjs";
import { inferSchema } from "./infer.mjs";

/** Turn the catalog's param description into an OpenAPI parameter object. */
function paramObject(name, spec, where) {
  const schema = { type: spec.type === "integer" ? "integer" : spec.type === "number" ? "number" : spec.type === "boolean" ? "boolean" : "string" };
  if (spec.enum) schema.enum = spec.enum;
  if (spec.default !== undefined) schema.default = spec.default;
  if (spec.example !== undefined) schema.example = spec.example;
  const p = { name, in: where, required: where === "path" ? true : !!spec.required, schema };
  if (spec.description) p.description = spec.description;
  return p;
}

/**
 * Probe one endpoint and return { schema, probed, status, error, ms }.
 * Never throws: a failed probe is data the document reports.
 */
export async function probe(endpoint) {
  if (endpoint.schemaFrom === "static" && endpoint.schema) {
    return { schema: endpoint.schema, probed: false, status: 200, source: "static" };
  }
  try {
    const res = await call(endpoint, endpoint.sampleArgs || {});
    if (res.json === undefined) {
      return { schema: {}, probed: true, status: res.status, source: "sample", error: "response was not JSON" };
    }
    // SportyBet wraps errors as { bizCode, message, data: {} }; only infer from real payloads.
    const body = res.json;
    if (res.status >= 400) {
      return { schema: inferSchema(body), probed: true, status: res.status, source: "sample", error: `HTTP ${res.status}` };
    }
    if (body && typeof body === "object" && !Array.isArray(body) && body.bizCode && body.bizCode !== 10000) {
      return {
        schema: inferSchema(body),
        probed: true,
        status: res.status,
        source: "sample",
        error: `site answered bizCode ${body.bizCode}: ${body.message ?? ""}`.trim(),
      };
    }
    return { schema: inferSchema(body), probed: true, status: res.status, source: "sample", ms: res.ms };
  } catch (e) {
    return { schema: {}, probed: true, status: 0, source: "sample", error: e.message };
  }
}

/** Build the whole document, probing every sample endpoint concurrently (bounded). */
export async function buildOpenApi({ version = new Date().toISOString(), probe: doProbe = true } = {}) {
  const results = new Map();
  if (doProbe) {
    const queue = [...ENDPOINTS];
    const workers = Array.from({ length: 4 }, async () => {
      while (queue.length) {
        const ep = queue.shift();
        results.set(ep.operationId, await probe(ep));
      }
    });
    await Promise.all(workers);
  }

  const paths = {};
  const notes = [];
  for (const ep of ENDPOINTS) {
    const probed = results.get(ep.operationId) || { schema: ep.schema || {}, probed: false, source: ep.schemaFrom || "sample" };
    const parameters = [
      ...Object.entries(ep.pathParams || {}).map(([n, s]) => paramObject(n, s, "path")),
      ...Object.entries(ep.query || {}).map(([n, s]) => paramObject(n, s, "query")),
    ];
    const responses = {
      200: {
        description: "SportyBet's JSON response.",
        content: {
          "application/json": {
            schema: probed.schema && Object.keys(probed.schema).length ? probed.schema : {},
            ...(probed.error ? { "x-probe-error": probed.error } : {}),
          },
        },
      },
    };
    if (ep.auth) {
      responses[401] = { description: "No valid session. Run `npm run login`, then retry." };
    }
    responses.default = {
      description:
        "A SportyBet error body: { bizCode, message, data }. bizCode 10000 is success; 19000 invalid, 19001 not found, 19003 forbidden.",
    };

    const op = {
      operationId: ep.operationId,
      summary: ep.summary,
      description: ep.description,
      tags: ep.tags || ["Default"],
      parameters,
      responses,
      security: ep.auth ? [{ cookieAuth: [] }] : [],
      "x-sportybet-path": `/api/${COUNTRY}${ep.path}`,
      "x-auth-required": !!ep.auth,
      "x-schema-source": probed.source,
      ...(probed.probed ? { "x-probed-status": probed.status } : {}),
      ...(probed.error ? { "x-probe-error": probed.error } : {}),
    };

    paths[`/api/${COUNTRY}${ep.path}`] = { ...(paths[`/api/${COUNTRY}${ep.path}`] || {}), [(ep.method || "GET").toLowerCase()]: op };
    if (probed.error) notes.push(`${ep.operationId}: ${probed.error}`);
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "SportyBet API",
      version: version.slice(0, 10),
      description: [
        "A live, auto-generated OpenAPI for SportyBet (sportybet.com).",
        "",
        "The paths mirror SportyBet's own frontend API (`/api/" + COUNTRY + "` on " + ORIGIN + "), so this document is a proxy surface: call these paths on this server and it forwards them to SportyBet with the stored session, then returns the site's JSON unchanged.",
        "",
        "Schemas are inferred from live responses at generation time, so they follow the site. Regenerate with `npm run generate` to pick up new fields.",
        "",
        sessionLooksSignedIn()
          ? "A signed-in session is loaded: Account endpoints will return data."
          : "No signed-in session is loaded: Account endpoints will return 401 until `npm run login` runs.",
        ...(notes.length ? ["", "Probe notes:", ...notes.map((n) => `- ${n}`)] : []),
      ].join("\n"),
    },
    servers: [{ url: "http://localhost:" + (process.env.PORT || 3000), description: "This proxy server" }],
    tags: [...new Set(ENDPOINTS.flatMap((e) => e.tags || []))].map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "accessToken",
          description:
            "SportyBet session cookies. This proxy adds them from the stored session file, so clients never handle them directly.",
        },
      },
    },
    "x-generated-at": new Date().toISOString(),
    "x-upstream": ORIGIN,
    "x-country": COUNTRY,
  };
}
