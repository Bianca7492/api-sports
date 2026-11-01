/**
 * Offline tests: no network. They check the parts that must hold whatever the site does -
 * schema inference, the catalog, and the OpenAPI document's structure.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { inferSchema } from "../src/infer.mjs";
import { buildOpenApi } from "../src/openapi.mjs";
import { buildUrl } from "../src/client.mjs";
import { ENDPOINTS } from "../src/catalog.mjs";

test("inferSchema describes primitives", () => {
  assert.equal(inferSchema(true).type, "boolean");
  assert.equal(inferSchema(3).type, "integer");
  assert.equal(inferSchema(3.5).type, "number");
  assert.equal(inferSchema("x").type, "string");
  assert.equal(inferSchema(null).type, "null");
});

test("inferSchema merges the fields of every array element", () => {
  const schema = inferSchema([{ a: 1 }, { a: 2, b: "x" }]);
  assert.equal(schema.type, "array");
  assert.ok(schema.items.properties.a);
  assert.ok(schema.items.properties.b, "a field only the second element had is still described");
});

test("inferSchema marks a field optional when only some elements had it", () => {
  const schema = inferSchema([{ a: 1 }, { a: 2, b: "x" }]);
  assert.deepEqual(schema.items.required, ["a"]);
});

test("inferSchema keeps an example for readability", () => {
  const schema = inferSchema({ name: "Football", count: 3 });
  assert.equal(schema.properties.name.example, "Football");
  assert.equal(schema.properties.count.example, 3);
});

test("inferSchema tolerates an empty list", () => {
  assert.deepEqual(inferSchema([]), { type: "array", items: {}, example: [] });
});

test("inferSchema drops the example of a personal field", () => {
  const schema = inferSchema({ phone: "08031234567", email: "a@b.com", firstName: "Ada", loyaltyTier: 3 });
  assert.equal(schema.properties.phone.example, undefined, "phone keeps its type but no value");
  assert.equal(schema.properties.phone.type, "string");
  assert.equal(schema.properties.email.example, undefined);
  assert.equal(schema.properties.firstName.example, undefined);
  assert.equal(schema.properties.loyaltyTier.example, 3, "a non-personal field keeps its example");
});

test("inferSchema never emits a redacted value as an example", () => {
  const secret = "08031234567";
  const schema = inferSchema({ contact: secret, note: `call ${secret} now` }, { redact: [secret] });
  assert.equal(schema.properties.contact.example, undefined);
  assert.equal(schema.properties.note.example, undefined, "a value that merely contains the secret is redacted too");
});

test("buildUrl fills path and query params", () => {
  const ep = ENDPOINTS.find((e) => e.operationId === "getBalance");
  const url = buildUrl(ep, { currency: "NGN" });
  assert.equal(url, "https://www.sportybet.com/api/ng/pocket/v1/finAccs/finAcc/userBal/NGN");
});

test("buildUrl applies defaults and drops empty values", () => {
  const ep = ENDPOINTS.find((e) => e.operationId === "getSports");
  const url = buildUrl(ep, { timeline: 24 });
  assert.match(url, /productId=1/);
  assert.match(url, /timeline=24/);
});

test("buildUrl encodes a sportId with a colon", () => {
  const ep = ENDPOINTS.find((e) => e.operationId === "getUpcomingEvents");
  const url = buildUrl(ep, { sportId: "sr:sport:1" });
  assert.match(url, /sportId=sr%3Asport%3A1/);
});

test("every catalog entry is well formed", () => {
  const ids = new Set();
  for (const ep of ENDPOINTS) {
    assert.match(ep.operationId, /^[a-zA-Z][A-Za-z0-9]*$/, `${ep.operationId} is a camelCase id`);
    assert.ok(!ids.has(ep.operationId), `${ep.operationId} is unique`);
    ids.add(ep.operationId);
    assert.ok(ep.path.startsWith("/"), `${ep.operationId} path is absolute`);
    assert.ok(ep.summary && ep.description, `${ep.operationId} has a summary and description`);
    assert.ok(Array.isArray(ep.tags) && ep.tags.length, `${ep.operationId} has a tag`);
    for (const [name, spec] of Object.entries(ep.query || {})) {
      assert.ok(["string", "integer", "number", "boolean"].includes(spec.type), `${ep.operationId}.${name} has a type`);
    }
    // every {path} placeholder is declared
    for (const m of ep.path.matchAll(/\{([^}]+)\}/g)) {
      assert.ok(ep.pathParams?.[m[1]], `${ep.operationId} declares path param ${m[1]}`);
    }
  }
});

test("the OpenAPI document is valid in shape", async () => {
  const doc = await buildOpenApi({ probe: false });
  assert.equal(doc.openapi, "3.1.0");
  assert.ok(doc.info.title);
  const ops = Object.entries(doc.paths).flatMap(([p, byMethod]) => Object.entries(byMethod).map(([m, op]) => [p, m, op]));
  assert.equal(ops.length, ENDPOINTS.length);
  for (const [path, method, op] of ops) {
    assert.ok(path.startsWith("/api/"), `${path} is under /api`);
    assert.ok(["get", "post", "put", "delete"].includes(method));
    assert.ok(op.operationId, `${path} has an operationId`);
    assert.ok(op.responses["200"], `${op.operationId} documents 200`);
    assert.ok(Array.isArray(op.parameters));
    if (op["x-auth-required"]) {
      assert.ok(op.responses["401"], `${op.operationId} documents 401`);
      assert.deepEqual(op.security, [{ cookieAuth: [] }]);
    }
  }
  assert.ok(doc.components.securitySchemes.cookieAuth);
});
