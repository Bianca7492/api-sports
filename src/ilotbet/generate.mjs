#!/usr/bin/env node
/**
 * Regenerate the iLOTBET endpoint catalog, signing key and OpenAPI document from the live site.
 *
 *   npm run generate:ilotbet            write the files
 *   npm run generate:ilotbet -- --json  print the OpenAPI document to stdout only
 *
 * It reads only the site's public HTML and JS bundles, so no account and no browser are needed.
 * Run it on a schedule and the catalog and spec follow the site on their own.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ORIGIN, KEY_PATH } from "./config.mjs";
import { extractFromSite, deriveName } from "./extract.mjs";
import { toYaml } from "../yaml.mjs";

/** Give every endpoint a unique, readable operationId: the bundle's name, else one from the path. */
function nameEndpoints(endpoints) {
  const seen = new Map();
  return endpoints
    .map((e) => ({ ...e, operationId: e.operationId || deriveName(e.path) }))
    .map((e) => {
      const n = (seen.get(e.operationId) || 0) + 1;
      seen.set(e.operationId, n);
      return n === 1 ? e : { ...e, operationId: `${e.operationId}${n}` };
    });
}

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

function catalogModule(endpoints, generatedAt, bundles) {
  const body = endpoints
    .sort((a, b) => a.operationId.localeCompare(b.operationId))
    .map(
      (e) =>
        `  { operationId: ${JSON.stringify(e.operationId)}, method: ${JSON.stringify(e.method)}, path: ${JSON.stringify(e.path)} },`,
    )
    .join("\n");
  return `/**
 * Generated endpoint catalog for iLOTBET. Do not edit by hand.
 *
 * Source: ${bundles.join(", ")}
 * Generated: ${generatedAt}
 * Regenerate with: npm run generate:ilotbet
 *
 * Each entry is the endpoint as the site's own frontend calls it. Friendly names live in
 * aliases.mjs; the signature every call needs is applied by client.mjs.
 */
export const GENERATED_AT = ${JSON.stringify(generatedAt)};
export const SOURCE = ${JSON.stringify(bundles.join(" "))};

export const ENDPOINTS = [
${body}
];
`;
}

export async function main({ json = false } = {}) {
  const { bundles, endpoints: raw, keyPem } = await extractFromSite(ORIGIN);
  const endpoints = nameEndpoints(raw);
  const generatedAt = new Date().toISOString();

  if (!json) {
    writeFileSync(KEY_PATH, keyPem);
    writeFileSync(join(ROOT, "src", "ilotbet", "endpoints.generated.mjs"), catalogModule(endpoints, generatedAt, bundles));
  }

  // Import after the catalog file is written: the catalog module reads it at load time.
  const { buildOpenApi } = await import("./openapi.mjs");
  const doc = await buildOpenApi({ version: generatedAt });
  doc["x-source"] = bundles.join(" ");

  if (json) {
    process.stdout.write(JSON.stringify(doc, null, 2));
    return doc;
  }

  writeFileSync(join(ROOT, "openapi.ilotbet.json"), JSON.stringify(doc, null, 2) + "\n");
  writeFileSync(join(ROOT, "openapi.ilotbet.yaml"), `# Generated ${generatedAt} from ${ORIGIN}\n${toYaml(doc).trimStart()}\n`);

  const blocked = Object.values(doc.paths)
    .flatMap((p) => Object.values(p))
    .some((o) => o["x-probe-error"] === "prohibited jurisdiction");
  process.stderr.write(
    `iLOTBET: ${endpoints.length} endpoints, ${Object.keys(doc.paths).length} paths -> openapi.ilotbet.json, openapi.ilotbet.yaml\n` +
      `Key: ${KEY_PATH}\n` +
      (blocked
        ? "Probes were refused (403 prohibited jurisdiction): schemas are empty. Run from a supported region to fill them.\n"
        : ""),
  );
  return doc;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main({ json: process.argv.includes("--json") }).catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
}
