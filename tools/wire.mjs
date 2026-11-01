#!/usr/bin/env node
/**
 * Wire every captured page so its own links navigate inside the dump.
 *
 * SportyBet's markup uses real `href` anchors, so we do not need scripts: rewriting each internal
 * link to the dump route for the same page makes the whole thing browsable. Links we did not
 * capture are sent to /unmapped, which names the target instead of dead-ending.
 *
 * Reads and writes .dump/dumps/*.wired.html. The frozen captures stay untouched.
 *
 *   npm run wire
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { OUT, ROUTES_FILE, SITE } from './dump-env.mjs';

const ROUTES = JSON.parse(readFileSync(ROUTES_FILE, 'utf8'));

const byPathNav = new Map();
const byPath = new Map();
for (const r of ROUTES) {
  const u = new URL(r.path, SITE);
  const nav = u.searchParams.get('nav');
  if (nav) byPathNav.set(`${u.pathname}?nav=${nav}`, r.slug);
  if (!byPath.has(u.pathname)) byPath.set(u.pathname, r.slug);
}

function slugFor(u) {
  const nav = u.searchParams.get('nav');
  if (nav && byPathNav.has(`${u.pathname}?nav=${nav}`)) return byPathNav.get(`${u.pathname}?nav=${nav}`);
  if (byPath.has(u.pathname)) return byPath.get(u.pathname);
  return byPath.get(u.pathname.replace(/\/$/, '')) || byPath.get(u.pathname + '/') || null;
}

function resolve(href, pagePath) {
  const h = href.trim();
  if (!h || /^(#|mailto:|tel:|javascript:|data:)/i.test(h)) return null;
  let u;
  try {
    u = new URL(h, SITE + pagePath);
  } catch {
    return null;
  }
  if (!/(^|\.)sportybet\.com$/i.test(u.hostname)) return null;
  if (!u.pathname.startsWith('/ng')) return null;
  if (u.pathname.startsWith('/ng/applink')) return null;
  return u;
}

let links = 0;
let mapped = 0;
const unmapped = new Map();

function wireHtml(html, pagePath) {
  return html.replace(/href="([^"]*)"/gi, (whole, href) => {
    const u = resolve(href, pagePath);
    if (!u) return whole;
    links++;
    const slug = slugFor(u);
    if (slug) {
      mapped++;
      return `href="/r/${slug}" data-wired-from="${href.replace(/"/g, '&quot;')}"`;
    }
    const key = u.pathname + u.search;
    unmapped.set(key, (unmapped.get(key) || 0) + 1);
    return `href="/unmapped?to=${encodeURIComponent(key)}" data-unmapped="1"`;
  });
}

function banner(slug, path) {
  return (
    `<div style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;display:flex;gap:14px;` +
    `align-items:center;background:#111;color:#ddd;font:12px ui-monospace,Menlo,monospace;` +
    `padding:6px 12px;border-top:1px solid #333;opacity:.95">` +
    `<a href="/routes" style="color:#58a6ff;text-decoration:none">&larr; all routes</a>` +
    `<span style="color:#7d8590">${slug}</span>` +
    `<code style="color:#3fb950">${path}</code>` +
    `<a href="/r/${slug}/raw" style="color:#58a6ff;text-decoration:none;margin-left:auto">verbatim DOM</a>` +
    `<a href="/r/${slug}/png" style="color:#58a6ff;text-decoration:none">screenshot</a>` +
    `</div>`
  );
}

function insertBanner(html, bar) {
  return html.includes('</body>') ? html.replace('</body>', bar + '</body>') : html + bar;
}

let wired = 0;
for (const route of ROUTES) {
  let html;
  try {
    html = readFileSync(join(OUT, `${route.slug}.frozen.html`), 'utf8');
  } catch {
    continue;
  }
  const pagePath = new URL(route.path, SITE).pathname;
  writeFileSync(join(OUT, `${route.slug}.wired.html`), insertBanner(wireHtml(html, pagePath), banner(route.slug, route.path)));
  wired++;
}

console.log(`wired ${wired} pages`);
console.log(`internal links: ${links}  mapped: ${mapped}  reported-unmapped: ${links - mapped}`);
if (unmapped.size) {
  console.log(`\ndistinct unmapped targets (${unmapped.size}):`);
  for (const [k, v] of [...unmapped].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`  ${String(v).padStart(3)}x  ${k}`);
  }
}
