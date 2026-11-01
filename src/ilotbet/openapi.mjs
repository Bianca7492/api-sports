/**
 * Build an OpenAPI 3.1 document for iLOTBET from the generated catalog.
 *
 * Like the SportyBet provider, the schemas come from live probes: every endpoint is called once
 * and whatever JSON comes back is turned into a schema by infer.mjs, so the document follows the
 * site. iLOTBET geolocates by IP, so from an unsupported region every probe answers 403; the
 * operation is still emitted, with `x-probe-error` saying why there is no schema yet, so a block
 * never hides an endpoint.
 */

import { ENDPOINTS, ALIASES, ORIGIN, API_BASE, commonParams, WRITE_PATHS } from "./catalog.mjs";
import { call, hasToken } from "./client.mjs";
import { inferSchema } from "../infer.mjs";

/** The service segment of a path, used as the tag. */
function tagFor(path) {
  const seg = path.split("/").filter(Boolean);
  return seg[0] || "default";
}

function aliasFor(path) {
  return Object.entries(ALIASES).find(([, p]) => p === path)?.[0];
}

const COMMON_QUERY = Object.keys(commonParams());

/** Where the proxy mounts iLOTBET, so its /api paths do not collide with SportyBet's /api/{country}. */
export const MOUNT = "/ilotbet";

function paramObject(name, where = "query") {
  return {
    name,
    in: where,
    required: false,
    schema: { oneOf: [{ type: "string" }, { type: "number" }, { type: "object" }] },
    description: "Added and signed automatically by the client.",
  };
}

/**
 * Probe one endpoint and return { schema, probed, status, error, blocked }.
 * Never throws: a failed probe is data the document reports.
 */
export async function probe(endpoint) {
  try {
    const res = await call(endpoint, {});
    if (res.blocked) return { schema: {}, probed: true, status: res.status, blocked: true, error: "prohibited jurisdiction" };
    if (res.json === undefined) {
      return { schema: {}, probed: true, status: res.status, error: "response was not JSON" };
    }
    if (res.status >= 400) {
      return { schema: inferSchema(res.json), probed: true, status: res.status, error: `HTTP ${res.status}` };
    }
    return { schema: inferSchema(res.json), probed: true, status: res.status };
  } catch (e) {
    return { schema: {}, probed: true, status: 0, error: e.message };
  }
}

export async function buildOpenApi({ version = new Date().toISOString(), probe: doProbe = true } = {}) {
  const results = new Map();
  if (doProbe) {
    const queue = ENDPOINTS.filter((e) => !WRITE_PATHS.has(e.path));
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
  let blockedCount = 0;
  for (const ep of ENDPOINTS) {
    const isWrite = WRITE_PATHS.has(ep.path);
    const probed = results.get(ep.operationId) || { schema: {}, probed: false };
    const method = (ep.method || "POST").toLowerCase();
    const alias = aliasFor(ep.path);
    if (probed.blocked) blockedCount += 1;

    const op = {
      operationId: ep.operationId,
      summary: `${ep.method} ${ep.path}`,
      description:
        "iLOTBET's own web API. The request body is merged with the common params and signed with " +
        'RSA-MD5 over the sorted, "&"-joined key=value string; this proxy does that for you.',
      tags: [tagFor(ep.path)],
      parameters: [],
      responses: {
        200: {
          description: "iLOTBET's JSON response.",
          content: {
            "application/json": {
              schema: probed.schema && Object.keys(probed.schema).length ? probed.schema : {},
              ...(probed.error ? { "x-probe-error": probed.error } : {}),
            },
          },
        },
        401: { description: "This endpoint needs a valid account token (ILOTBET_TOKEN)." },
        403: {
          description:
            'Refused. iLOTBET answers 403 "You are visiting from a prohibited jurisdiction" for networks it does not serve.',
        },
      },
      security: [{ userToken: [] }],
      "x-ilotbet-path": `/api${ep.path}`,
      "x-ilotbet-signature": "rsa-md5-over-sorted-body",
      "x-write": isWrite,
      "x-schema-source": probed.probed ? "sample" : "none",
      ...(alias ? { "x-alias": alias } : {}),
      ...(probed.probed ? { "x-probed-status": probed.status } : {}),
      ...(probed.error ? { "x-probe-error": probed.error } : {}),
    };

    if (ep.method === "GET") {
      op.parameters = COMMON_QUERY.map((n) => paramObject(n, "query"));
    } else {
      op.requestBody = {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/CommonBody" } } },
      };
    }

    paths[`${MOUNT}${ep.path}`] = { ...(paths[`${MOUNT}${ep.path}`] || {}), [method]: op };
    if (probed.error && !probed.blocked) notes.push(`${ep.operationId}: ${probed.error}`);
  }

  const anyBlocked = blockedCount > 0;
  const tagNames = [...new Set(ENDPOINTS.map((e) => tagFor(e.path)))];

  return {
    openapi: "3.1.0",
    info: {
      title: "iLOTBET API",
      version: version.slice(0, 10),
      description: [
        "A live, auto-generated OpenAPI for iLOTBET (ilotbet.com).",
        "",
        "The paths mirror iLOTBET's own frontend API (`/api` on " + ORIGIN + "). Call these paths on " +
          "this server and it forwards them to iLOTBET with the RSA-MD5 signature the site requires, " +
          "then returns the site's JSON unchanged.",
        "",
        "Schemas are inferred from live responses at generation time, so they follow the site. " +
          "Regenerate with `npm run generate:ilotbet` to pick up new endpoints and fields.",
        "",
        hasToken()
          ? "An account token is configured: account endpoints may return data."
          : "No account token is configured (ILOTBET_TOKEN): account endpoints will return 401.",
        anyBlocked
          ? `NOTE: iLOTBET refused this generator's network (${blockedCount}/${ENDPOINTS.length} probes ` +
            "answered 403), so the schemas below are empty. This is the site's IP geolocation, not a " +
            "bug: run the generator from a region iLOTBET serves and the schemas fill in."
          : "",
        ...(notes.length ? ["", `Probe notes (${notes.length}):`, ...notes.map((n) => `- ${n}`)] : []),
      ]
        .filter(Boolean)
        .join("\n"),
    },
    servers: [{ url: "http://localhost:" + (process.env.PORT || 3000), description: "This proxy server" }],
    tags: tagNames.map((name) => ({ name })),
    paths,
    components: {
      securitySchemes: {
        userToken: {
          type: "apiKey",
          in: "header",
          name: "User-Token",
          description:
            "iLOTBET account token. Set ILOTBET_TOKEN on the server; it is attached to upstream " +
            "requests, so clients never handle it directly.",
        },
      },
      schemas: {
        CommonBody: {
          type: "object",
          properties: Object.fromEntries(
            COMMON_QUERY.map((p) => [p, { oneOf: [{ type: "string" }, { type: "number" }] }]),
          ),
          description: "Merged into every request and signed; the proxy adds these automatically.",
        },
      },
    },
    "x-generated-at": new Date().toISOString(),
    "x-upstream": ORIGIN,
    "x-api-base": API_BASE,
    "x-endpoints": ENDPOINTS.length,
  };
}
