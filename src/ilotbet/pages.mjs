#!/usr/bin/env node
/**
 * Dump the site's client view: every landing page its single-page app serves.
 *
 *   npm run pages:ilotbet            write pages.ilotbet.json and pages.ilotbet.html
 *   npm run pages:ilotbet -- --json  print the page list as JSON
 *
 * The pages are Vue routes, so each one returns the same empty shell server-side and can only be
 * seen by a browser. The HTML dump is therefore a gallery: every page in a live iframe of the real
 * site, plus a full-width view and a direct link. Open it in a browser.
 *
 * Route paths with `:params` are templates; the gallery fills them from ILOTBET_PAGE_PARAMS (a
 * JSON map of param -> value) or from a sample set, so the previews load something real.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { ORIGIN } from "./config.mjs";
import { extractFromSite } from "./extract.mjs";

const ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

/** Sample values for route params, so a preview of a templated route still loads. */
const SAMPLE_PARAMS = {
  id: "1",
  routerName: "home",
  routeName: "home",
  channelName: "ilot",
  linkName: "home",
  pageChannel: "ilot",
  shareCode: "demo",
  shareChannel: "whatsapp",
  orderId: "1",
  type: "1",
  hours: "24",
  time: "0",
  slot: "1",
  category: "1",
  tournament: "1",
  country: "1",
  tab: "1",
};

function paramValues() {
  const env = process.env.ILOTBET_PAGE_PARAMS;
  if (!env) return SAMPLE_PARAMS;
  try {
    return { ...SAMPLE_PARAMS, ...JSON.parse(env) };
  } catch {
    return SAMPLE_PARAMS;
  }
}

/** Fill a route's `:params` from the value map, or return null when one is missing. */
export function fillParams(routePath, values) {
  let missing = false;
  const url = routePath
    .replace(/\/:([A-Za-z0-9_]+)\??/g, (_m, name) => {
      if (values[name] === undefined) {
        missing = true;
        return "";
      }
      return `/${encodeURIComponent(values[name])}`;
    })
    .replace(/\/$/, "");
  return missing ? null : url;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

/** The group a route belongs to, by its path. */
const GROUPS = [
  [
    "account & bets",
    /^\/(account|bet-history|my-bets|sportBetHistory|jackpotBetHistory|jackpotTicketDetail|message|messageDetail|ticketDetail|feedback)/,
  ],
  [
    "auth & security",
    /^\/(login|loginRegister|register|registerSure|resetPassword|resetPasswordSuccess|retrievePassword|setPassword|realName|accountSecurity|self-exclusion|paymentPassword|recaptcha|accountActivation|silent-recall|ext-auth|palmPayAuth|PalmPayActivity)/,
  ],
  [
    "betting & games",
    /^\/(sports|lives|livescore|casino|sportsBetting|livesBetting|quick-bet|bet-builder|betslip|collection|headtohead|videoVirtual|simulate|search|search-list|hot-match|big-5|worldcup|lmt|az-menu|crash-game|jackpot|lottery)/,
  ],
  [
    "promotions & money",
    /^\/(promotion|recharge|withdraw|deposit|invitedActivity|recharge-activity|signInGift|friendHelp|affiliates|opay|agent|multiple-cashback|sportBetBonus|new-season|betBonus|ilot-bank|creat-virtual|momoRecharge|bankAccount|addBankCard|payment)/,
  ],
];

/** Everything not claimed above is a site page or a support flow. */
function groupOf(path) {
  for (const [name, re] of GROUPS) {
    if (re.test(path)) return name;
  }
  return "site & support";
}

function html(pages) {
  const groups = [...new Set(pages.map((p) => p.group))];
  const cards = (list) =>
    list
      .map(
        (p) => `      <figure class="card" data-path="${esc(p.path)}" data-name="${esc(p.name)}">
        <figcaption>
          <code>${esc(p.url)}</code>
          <span class="nm">${esc(p.name)}</span>
          <a class="open" href="${esc(p.url)}" target="_blank" rel="noopener">open &#8599;</a>
        </figcaption>
        <div class="frame"><iframe loading="lazy" src="${esc(p.url)}" title="${esc(p.name)}"></iframe></div>
      </figure>`,
      )
      .join("\n");

  const nav = groups
    .map((g) => `<a href="#${esc(g.replace(/\W+/g, "-"))}">${esc(g)} <span class="count">${pages.filter((p) => p.group === g).length}</span></a>`)
    .join("");

  const sections = groups
    .map(
      (g) => `  <section id="${esc(g.replace(/\W+/g, "-"))}">
    <h2>${esc(g)} <span class="count">${pages.filter((p) => p.group === g).length}</span></h2>
    <div class="grid">
${cards(pages.filter((p) => p.group === g))}
    </div>
  </section>`,
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>iLOTBET client pages (${pages.length})</title>
<style>
  :root { color-scheme: dark; --bg:#0b0e14; --panel:#131824; --line:#232b3d; --ink:#e6e9f0; --dim:#8b93a7; --accent:#58a6ff; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  header { padding:26px 24px 10px; border-bottom:1px solid var(--line); }
  h1 { margin:0 0 6px; font-size:20px; }
  .meta { color:var(--dim); font-size:13px; }
  .meta code { color:var(--ink); }
  nav { display:flex; flex-wrap:wrap; gap:8px; padding:12px 24px; border-bottom:1px solid var(--line); position:sticky; top:0; background:rgba(11,14,20,.95); backdrop-filter:blur(6px); z-index:5; }
  nav a { color:var(--ink); text-decoration:none; background:var(--panel); border:1px solid var(--line); border-radius:999px; padding:4px 10px; font-size:12px; }
  nav a:hover { border-color:var(--dim); }
  main { padding:8px 24px 60px; }
  section { margin-top:28px; }
  h2 { font-size:14px; text-transform:uppercase; letter-spacing:.06em; color:var(--dim); margin:0 0 12px; }
  .count { color:var(--dim); font-weight:400; font-size:11px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(360px,1fr)); gap:16px; }
  .card { margin:0; background:var(--panel); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  figcaption { display:flex; align-items:center; gap:8px; padding:8px 10px; border-bottom:1px solid var(--line); font-size:12px; }
  figcaption code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .nm { color:var(--dim); font-style:italic; margin-left:auto; }
  .open { color:var(--accent); text-decoration:none; white-space:nowrap; }
  .frame { height:260px; background:#fff; position:relative; overflow:hidden; }
  iframe { width:1100px; height:780px; border:0; transform:scale(.32); transform-origin:0 0; }
  .card:hover .frame { height:520px; }
  .card:hover iframe { transform:scale(.64); }
  .note { color:var(--dim); font-size:12.5px; margin-top:8px; }
</style>
</head>
<body>
<header>
  <h1>iLOTBET client pages</h1>
  <div class="meta">${pages.length} landing pages &middot; ${groups.length} groups &middot; live iframes of <code>${esc(ORIGIN)}</code></div>
  <div class="note">Every route is a Vue page, so the server returns the same shell for all of them; the previews below load the real pages in the browser. Hover a card to enlarge it. Pages needing a signed-in account will show the site's own login or redirect.</div>
</header>
<nav>${nav}</nav>
<main>
${sections}
</main>
</body>
</html>
`;
}

export async function main({ json = false, pages: given } = {}) {
  const pages = given || (await extractFromSite(ORIGIN)).pages;
  const values = paramValues();
  const rows = pages.map((p) => {
    const filled = fillParams(p.path, values);
    return {
      path: p.path,
      name: p.name,
      params: p.params,
      group: groupOf(p.path),
      url: filled ? ORIGIN + filled : null,
      templated: p.params.length > 0,
    };
  });

  if (json) {
    process.stdout.write(JSON.stringify(rows, null, 2));
    return rows;
  }
  writeFileSync(join(ROOT, "pages.ilotbet.json"), JSON.stringify(rows, null, 2) + "\n");
  writeFileSync(join(ROOT, "pages.ilotbet.html"), html(rows));
  const templated = rows.filter((r) => r.templated).length;
  process.stderr.write(
    `iLOTBET pages: ${rows.length} (${templated} templated) -> pages.ilotbet.json, pages.ilotbet.html\n` +
      `  groups: ${[...new Set(rows.map((r) => r.group))].join(", ")}\n`,
  );
  return rows;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main({ json: process.argv.includes("--json") }).catch((err) => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  });
}
