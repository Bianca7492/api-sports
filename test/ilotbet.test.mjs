/**
 * Offline tests for the iLOTBET provider: no network. They check the parts that must hold
 * whatever the site does - the signature, the catalog, the OpenAPI shape and the route inventory.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { signParams, sortParams, md5 } from "../src/ilotbet/sign.mjs";
import { ENDPOINTS, ALIASES, WRITE_PATHS, findEndpoint, danglingAliases, loadSignKey } from "../src/ilotbet/catalog.mjs";
import { buildOpenApi } from "../src/ilotbet/openapi.mjs";
import { inventory } from "../src/ilotbet/routes.mjs";
import { isApiPath, extractEndpoints, extractSignKey } from "../src/ilotbet/extract.mjs";

// A real request captured from the site's own browser session.
const CAPTURED = {
  platform: 4,
  platformModel: "1.0",
  lcc: "",
  loginChannel: "ilot",
  deviceCode: "2750bc42-702e-4cbe-bae5-798f171389e1",
  deviceSoftVersion: "202610301747",
  timestamp: 1793490875301,
  marketId: 1,
};
const CAPTURED_SIGN =
  "tEf07P6eFdaeAA/7UkaGjt6YY8XTutuv9+OMTS0UK+t5F7iiVGBz5xqKShu5jHJznkzIXB4WCC7aRmb6fDPBbDCKVLCFunb8S+WTFz702Nt73zzJK0KwBZI7d060+PaT/B22pyOcZ5V9z7OMp2Kz0H+eBJZWOGGG9uowsD1FJ64=";

test("sortParams drops empty/null, sorts keys and joins with &", () => {
  assert.equal(sortParams({ b: 2, a: 1, c: null, d: "", e: { x: 1 } }), 'a=1&b=2&e={"x":1}');
});

test("md5 is the hex digest", () => {
  assert.equal(md5("abc"), "900150983cd24fb0d6963f7d28e17f72");
});

test("signParams reproduces the signature the site sent", () => {
  assert.equal(signParams(CAPTURED, loadSignKey()), CAPTURED_SIGN);
});

test("signParams returns empty for an empty body", () => {
  assert.equal(signParams({}, loadSignKey()), "");
  assert.equal(signParams(null, loadSignKey()), "");
});

test("the shipped signing key parses as a private key", () => {
  assert.match(loadSignKey(), /^-----BEGIN PRIVATE KEY-----/);
});

test("the generated catalog is well formed", () => {
  assert.ok(ENDPOINTS.length > 100, "found a substantial number of endpoints");
  const ids = new Set();
  for (const ep of ENDPOINTS) {
    assert.match(ep.operationId, /^[A-Za-z][A-Za-z0-9_]*$/, `${ep.operationId} is an identifier`);
    assert.ok(!ids.has(ep.operationId), `${ep.operationId} is unique`);
    ids.add(ep.operationId);
    assert.ok(ep.path.startsWith("/"), `${ep.operationId} path is absolute`);
    assert.ok(["GET", "POST", "PUT", "DELETE"].includes(ep.method), `${ep.operationId} has a method`);
  }
});

test("every alias resolves to a generated endpoint", () => {
  assert.deepEqual(danglingAliases(), [], "no alias points at a path the catalog lacks");
});

test("findEndpoint resolves by operationId and by alias", () => {
  const byAlias = findEndpoint("featured");
  assert.equal(byAlias.path, "/sbu/un/m/featured/v2");
  assert.equal(findEndpoint(byAlias.operationId).path, "/sbu/un/m/featured/v2");
  assert.equal(findEndpoint("no-such-thing"), undefined);
});

test("write paths are never public reads", () => {
  for (const p of WRITE_PATHS) {
    assert.ok(!p.includes("/un/"), `${p} is not advertised as a public read`);
  }
});

test("extractEndpoints ignores module ids and finds named calls", () => {
  const js = `
    getFeatured:function(){var e=arguments.length>0?arguments[0]:{};return i["a"].get("/sbu/un/m/featured/v2",e)},
    postNews:function(){var e=arguments.length>0?arguments[0]:{};return i["a"].post("/notice/un/hotNews",e)},
    107:function(t,n){}
    n.r(t);var s=r("x");
  `;
  const found = extractEndpoints(js).map((e) => e.operationId).sort();
  assert.deepEqual(found, ["getFeatured", "postNews"]);
});

test("isApiPath accepts service paths and rejects assets", () => {
  assert.ok(isApiPath("/sbu/un/m/featured/v2"));
  assert.ok(!isApiPath("/static/js/main.js"));
  assert.ok(!isApiPath("/img/logo.png"));
});

test("extractSignKey rebuilds a PEM", () => {
  const pem = extractSignKey('privatekeyPem="-----BEGIN PRIVATE KEY-----\\n    MIICdwIBADANBgkq\\n    -----END PRIVATE KEY-----"');
  assert.match(pem, /^-----BEGIN PRIVATE KEY-----\n/);
  assert.match(pem, /-----END PRIVATE KEY-----\n$/);
});

test("the OpenAPI document is valid in shape", async () => {
  const doc = await buildOpenApi({ probe: false });
  assert.equal(doc.openapi, "3.1.0");
  assert.ok(doc.info.title);
  const ops = Object.entries(doc.paths).flatMap(([p, byMethod]) => Object.entries(byMethod).map(([m, op]) => [p, m, op]));
  assert.ok(ops.length > 100);
  for (const [path, method, op] of ops) {
    assert.ok(path.startsWith("/ilotbet/"), `${path} is mounted under /ilotbet`);
    assert.ok(["get", "post", "put", "delete"].includes(method));
    assert.ok(op.operationId, `${path} has an operationId`);
    assert.equal(op["x-ilotbet-signature"], "rsa-md5-over-sorted-body");
    assert.ok(op.responses["200"], `${op.operationId} documents 200`);
    assert.ok(op.responses["403"], `${op.operationId} documents the jurisdiction block`);
  }
  assert.ok(doc.components.securitySchemes.userToken);
  assert.ok(doc.components.schemas.CommonBody);
});

test("the OpenAPI marks writes and keeps aliases", async () => {
  const doc = await buildOpenApi({ probe: false });
  assert.equal(doc.paths["/ilotbet/funds/api/payment"].post["x-write"], true);
  assert.equal(doc.paths["/ilotbet/sbu/un/m/featured/v2"].get["x-alias"], "featured");
});

test("the route inventory covers every endpoint and flags access", () => {
  const rows = inventory();
  assert.equal(rows.length, ENDPOINTS.length);
  const featured = rows.find((r) => r.path === "/sbu/un/m/featured/v2");
  assert.equal(featured.public, true);
  assert.equal(featured.proxyPath, "/ilotbet/sbu/un/m/featured/v2");
  assert.equal(featured.alias, "featured");
  const pay = rows.find((r) => r.path === "/funds/api/payment");
  assert.equal(pay.write, true);
  assert.ok(rows.every((r) => r.service));
});
