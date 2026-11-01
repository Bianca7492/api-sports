#!/usr/bin/env node
/**
 * Dump the complete iLOTBET route inventory.
 *
 *   npm run routes:ilotbet              write routes.ilotbet.md and routes.ilotbet.html
 *   npm run routes:ilotbet -- --json    print the inventory as JSON
 *
 * The HTML file is a self-contained UI: every route grouped by service, with its method, path,
 * friendly alias, whether it needs a token, and whether it is a write the proxy refuses to
 * forward. Open it in a browser, or serve it from anywhere static.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ENDPOINTS, ALIASES, WRITE_PATHS, ORIGIN } from "./catalog.mjs";
import { MOUNT } from "./openapi.mjs";
import { GENERATED_AT } from "./endpoints.generated.mjs";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const aliasOf = new Map(Object.entries(ALIASES).map(([a, p]) => [p, a]));
const isPublicRead = (p) => p.includes("/un/") || !/(\/api\/)/.test(p);

function service(p) {
  return p.split("/").filter(Boolean)[0];
}

/** The full inventory, one row per route. */
export function inventory() {
  return ENDPOINTS.map((e) => {
    const alias = aliasOf.get(e.path);
    return {
      operationId: e.operationId,
      alias,
      method: e.method,
      path: e.path,
      proxyPath: `${MOUNT}${e.path}`,
      service: service(e.path),
      public: isPublicRead(e.path),
      write: WRITE_PATHS.has(e.path),
    };
  }).sort((a, b) => a.service.localeCompare(b.service) || a.path.localeCompare(b.path));
}

function markdown(rows) {
  const lines = [
    "# iLOTBET route inventory",
    "",
    `Generated ${GENERATED_AT} from ${ORIGIN}. ${rows.length} routes.`,
    "",
    `Proxy mount: \`${MOUNT}\` — call \`${MOUNT}{path}\` on the server and it forwards to iLOTBET with the signature.`,
    "",
    "`public` = no token needed. `write` = moves money or places a bet; the proxy refuses it.",
    "",
  ];
  const services = [...new Set(rows.map((r) => r.service))];
  for (const s of services) {
    const group = rows.filter((r) => r.service === s);
    lines.push(`## ${s} (${group.length})`, "");
    lines.push("| method | path | operationId | alias | public | write |", "|---|---|---|---|---|---|");
    for (const r of group) {
      lines.push(
        `| ${r.method} | \`${r.path}\` | ${r.operationId} | ${r.alias || ""} | ${r.public ? "yes" : ""} | ${
          r.write ? "yes" : ""
        } |`,
      );
    }
    lines.push("");
  }
  return lines.join("\n");
}

function html(rows) {
  const services = [...new Set(rows.map((r) => r.service))];
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const section = (s) => {
    const group = rows.filter((r) => r.service === s);
    const body = group
      .map(
        (r) => `      <tr class="${r.write ? "write" : r.public ? "public" : "auth"}">
        <td class="m ${r.method.toLowerCase()}">${esc(r.method)}</td>
        <td class="p"><code>${esc(r.path)}</code>${r.alias ? `<span class="alias">${esc(r.alias)}</span>` : ""}</td>
        <td class="op">${esc(r.operationId)}</td>
        <td class="flags">${r.public ? '<span class="t public">public</span>' : '<span class="t auth">token</span>'}${r.write ? '<span class="t write">write</span>' : ""}</td>
      </tr>`,
      )
      .join("\n");
    return `  <section>
    <h2 id="${esc(s)}">${esc(s)} <span class="count">${group.length}</span></h2>
    <table>
      <thead><tr><th>Method</th><th>Path</th><th>operationId</th><th>Access</th></tr></thead>
      <tbody>
${body}
      </tbody>
    </table>
  </section>`;
  };

  const nav = services
    .map((s) => `<a href="#${esc(s)}">${esc(s)} <span class="count">${rows.filter((r) => r.service === s).length}</span></a>`)
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>iLOTBET routes (${rows.length})</title>
<style>
  :root { color-scheme: dark; --bg:#0b0e14; --panel:#131824; --line:#232b3d; --ink:#e6e9f0; --dim:#8b93a7;
          --get:#3fb950; --post:#58a6ff; --put:#d29922; --del:#f85149; --public:#3fb950; --auth:#d29922; --write:#f85149; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  header { padding:28px 24px 12px; border-bottom:1px solid var(--line); }
  h1 { margin:0 0 6px; font-size:20px; }
  .meta { color:var(--dim); font-size:13px; }
  nav { display:flex; flex-wrap:wrap; gap:8px; padding:14px 24px; border-bottom:1px solid var(--line); position:sticky; top:0; background:rgba(11,14,20,.94); backdrop-filter:blur(6px); }
  nav a { color:var(--ink); text-decoration:none; background:var(--panel); border:1px solid var(--line); border-radius:999px; padding:4px 10px; font-size:12px; }
  nav a:hover { border-color:var(--dim); }
  main { padding:8px 24px 60px; }
  section { margin-top:26px; }
  h2 { font-size:15px; text-transform:uppercase; letter-spacing:.06em; color:var(--dim); margin:0 0 10px; }
  .count { color:var(--dim); font-weight:400; font-size:11px; }
  table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  th { text-align:left; font-weight:600; font-size:12px; color:var(--dim); padding:9px 12px; border-bottom:1px solid var(--line); }
  td { padding:9px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
  tr:last-child td { border-bottom:0; }
  td.m { font-weight:700; font-size:12px; width:64px; }
  td.m.get { color:var(--get); } td.m.post { color:var(--post); } td.m.put { color:var(--put); } td.m.delete { color:var(--del); }
  td.p code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12.5px; }
  .alias { margin-left:8px; color:var(--dim); font-size:11.5px; font-style:italic; }
  td.op { color:var(--dim); font-size:12.5px; }
  .t { display:inline-block; font-size:11px; border-radius:999px; padding:1px 8px; margin-right:4px; border:1px solid; }
  .t.public { color:var(--public); border-color:var(--public); }
  .t.auth { color:var(--auth); border-color:var(--auth); }
  .t.write { color:var(--write); border-color:var(--write); }
</style>
</head>
<body>
<header>
  <h1>iLOTBET routes</h1>
  <div class="meta">${rows.length} routes &middot; ${services.length} services &middot; generated ${esc(GENERATED_AT)} &middot; source ${esc(ORIGIN)}</div>
  <div class="meta">Proxy mount <code>${esc(MOUNT)}</code> &middot; <span class="t public">public</span> no token &middot; <span class="t auth">token</span> needs ILOTBET_TOKEN &middot; <span class="t write">write</span> not proxied</div>
</header>
<nav>${nav}</nav>
<main>
${services.map(section).join("\n")}
</main>
</body>
</html>
`;
}

export function main({ json = false } = {}) {
  const rows = inventory();
  if (json) {
    process.stdout.write(JSON.stringify(rows, null, 2));
    return rows;
  }
  writeFileSync(join(ROOT, "routes.ilotbet.md"), markdown(rows) + "\n");
  writeFileSync(join(ROOT, "routes.ilotbet.html"), html(rows));
  process.stderr.write(
    `iLOTBET routes: ${rows.length} -> routes.ilotbet.md, routes.ilotbet.html\n` +
      `  public: ${rows.filter((r) => r.public && !r.write).length}, ` +
      `token: ${rows.filter((r) => !r.public && !r.write).length}, ` +
      `write: ${rows.filter((r) => r.write).length}\n`,
  );
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main({ json: process.argv.includes("--json") });
}
