/**
 * Infer a JSON Schema from a live JSON response.
 *
 * This is what makes the API dynamic: the generator probes the site, and this module turns
 * whatever comes back into a schema. If SportyBet adds a field or changes a type, the next
 * generation reflects it - nothing is hard-coded.
 *
 * Arrays are summarized over all their elements (so a list of events yields the union of the
 * fields any event had), and every property keeps a small `example` for readability.
 *
 * Account responses carry the signed-in user's own data - phone, email, name, session tokens.
 * Schemas are published, so those values must never be baked in as examples. `redact` carries
 * the session's literal secret values, and any property whose name looks personal is reduced to
 * its type alone.
 */

const MAX_EXAMPLE = 200;

/** Property names whose values are personal or secret, so their examples are dropped. */
const SENSITIVE_KEY =
  /(phone|mobile|msisdn|email|token|secret|password|passwd|psd|nin|bvn|ssn|card|iban|userid|usrid|usercert|firstname|lastname|surname|nickname|dob|birth|address|balance|avlbal)/i;

function isRedactedValue(value, redact) {
  if (typeof value !== "string" || !redact.length) return false;
  return redact.some((r) => r && r.length > 4 && (value === r || value.includes(r)));
}

/** Recursively drop every `example` from a schema. */
function stripExamples(schema) {
  if (!schema || typeof schema !== "object") return schema;
  delete schema.example;
  if (schema.properties) for (const k of Object.keys(schema.properties)) stripExamples(schema.properties[k]);
  if (schema.items) stripExamples(schema.items);
  return schema;
}

function exampleOf(value, redact) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, 1).map((v) => exampleOf(v, redact));
  const out = {};
  for (const [k, v] of Object.entries(value).slice(0, 8)) {
    if (SENSITIVE_KEY.test(k) || isRedactedValue(v, redact)) continue;
    out[k] = exampleOf(v, redact);
  }
  return out;
}

/** Merge two schemas for the same position into one that accepts both. */
function merge(a, b) {
  if (!a) return b;
  if (!b) return a;
  if (a.type === b.type && a.type === "object") {
    const props = { ...a.properties };
    for (const [k, v] of Object.entries(b.properties || {})) props[k] = merge(props[k], v);
    // required is what every merged object had, so an optional field is not advertised as required
    const required = (a.required || []).filter((k) => (b.required || []).includes(k));
    const out = { type: "object", properties: props };
    if (required.length) out.required = required;
    if (a.example || b.example) out.example = a.example || b.example;
    return out;
  }
  if (a.type === b.type && a.type === "array") {
    return { type: "array", items: merge(a.items, b.items) };
  }
  if (a.type === b.type) {
    const out = { ...a };
    if (a.nullable || b.nullable) out.nullable = true;
    if (a.enum && b.enum) {
      const set = new Set([...a.enum, ...b.enum]);
      out.enum = [...set].slice(0, 50);
      if (set.size > 50) delete out.enum;
    }
    return out;
  }
  const pick = a.type === "null" ? b : b.type === "null" ? a : { anyOf: [a, b] };
  if (a.type === "null" || b.type === "null") pick.nullable = true;
  return pick;
}

/**
 * Infer a JSON Schema (draft 2020-12 subset) for a decoded JSON value.
 * `redact` is a list of literal secret values (session cookies, phone numbers) whose
 * occurrences must not become examples.
 */
export function inferSchema(value, opts = {}) {
  const { depth = 0, redact = [] } = opts;
  if (value === null) return { type: "null", nullable: true };
  const t = typeof value;
  if (t === "boolean") return { type: "boolean", example: value };
  if (t === "number") return Number.isInteger(value) ? { type: "integer", example: value } : { type: "number", example: value };
  if (t === "string") {
    const s = { type: "string" };
    if (!isRedactedValue(value, redact)) {
      s.example = value.length > MAX_EXAMPLE ? `${value.slice(0, MAX_EXAMPLE)}...` : value;
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(value) || /^\d{4}-\d{2}-\d{2} /.test(value)) s.format = "date-time";
    return s;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return { type: "array", items: {}, example: [] };
    let items;
    for (const el of value) items = merge(items, inferSchema(el, { depth: depth + 1, redact }));
    return { type: "array", items, example: exampleOf(value.slice(0, 1), redact) };
  }
  if (t === "object") {
    const properties = {};
    for (const k of Object.keys(value)) {
      let child = inferSchema(value[k], { depth: depth + 1, redact });
      // personal or secret fields keep their type but never their value
      if (SENSITIVE_KEY.test(k) || isRedactedValue(value[k], redact)) child = stripExamples(child);
      properties[k] = child;
    }
    return { type: "object", properties, required: Object.keys(value), example: exampleOf(value, redact) };
  }
  return {};
}
