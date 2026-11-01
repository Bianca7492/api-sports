#!/usr/bin/env node
/**
 * Generate the OpenAPI document by probing the live SportyBet site.
 *
 *   npm run generate            write openapi.json and openapi.yaml
 *   npm run generate -- --json  print the JSON to stdout only
 *
 * Run it on a schedule (cron, CI) and the document keeps up with the site on its own.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildOpenApi } from "./openapi.mjs";
import { sessionLooksSignedIn } from "./client.mjs";
import { toYaml } from "./yaml.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);

const doc = await buildOpenApi();

if (args.includes("--json")) {
  process.stdout.write(JSON.stringify(doc, null, 2));
  process.exit(0);
}

const jsonPath = join(ROOT, "openapi.json");
const yamlPath = join(ROOT, "openapi.yaml");
writeFileSync(jsonPath, JSON.stringify(doc, null, 2));
writeFileSync(yamlPath, `# Generated ${doc["x-generated-at"]} from ${doc["x-upstream"]}\n${toYaml(doc).trimStart()}\n`);

const ops = Object.values(doc.paths).reduce((n, p) => n + Object.keys(p).length, 0);
const withErrors = Object.values(doc.paths)
  .flatMap((p) => Object.values(p))
  .filter((o) => o["x-probe-error"]);
process.stderr.write(
  `Generated ${ops} operations -> openapi.json, openapi.yaml\n` +
    `Session: ${sessionLooksSignedIn() ? "signed in" : "no session (Account endpoints will 401)"}\n` +
    (withErrors.length ? `Probe warnings: ${withErrors.map((o) => `${o.operationId} (${o["x-probe-error"]})`).join("; ")}\n` : ""),
);
