#!/usr/bin/env node
/**
 * Crawl SportyBet, capture the UI of every route, and record the route list.
 *
 * Discovery and capture happen in one pass: each captured page is scanned for internal links and
 * new targets are queued. Seeds are the desktop home and the mobile home, which are two separate
 * sites under /ng/ and /ng/m/.
 *
 * Per route we save the frozen DOM (stable, for the wired dump), the verbatim DOM, visible text,
 * a full-page screenshot, the network log, and a small meta file. All of it is regenerable and
 * lands in .dump/, which is git-ignored.
 *
 *   npm run crawl             crawl from the seeds
 *   npm run crawl -- --max 200
 *
 * Env: SPORTYBET_DUMP_DIR (default .dump), CHROMIUM_PATH (default /usr/bin/chromium).
 */

import { chromium } from 'playwright-core';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { OUT, ROUTES_FILE, SESSION_FILE, SITE } from './dump-env.mjs';

const CHROME = process.env.CHROMIUM_PATH || '/usr/bin/chromium';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const maxIdx = process.argv.indexOf('--max');
const MAX = maxIdx >= 0 ? Number(process.argv[maxIdx + 1]) : 200;

mkdirSync(OUT, { recursive: true });

const cookies = existsSync(SESSION_FILE) ? JSON.parse(readFileSync(SESSION_FILE, 'utf8')) : [];
if (!cookies.length) {
  process.stderr.write('no session found; run `npm run login` first for the account routes\n');
}

/** Tournament pages already queued, so discovery stays bounded. */
const eventsSeen = new Set();

/**
 * Normalise a link to a crawl key. The query string is dropped except for `nav`, which selects a
 * distinct help page, and the dynamic `sr:` ids are kept because they are real routes.
 */
function normalize(href, basePath, mobile) {
  let u;
  try {
    u = new URL(href, SITE + basePath);
  } catch {
    return null;
  }
  if (!/(^|\.)sportybet\.com$/i.test(u.hostname)) return null;
  let p = u.pathname;
  if (!p.startsWith('/ng')) return null;
  if (p.startsWith('/ng/applink')) return null; // deep links into the native app, not web routes
  // A page belongs to one side of the site; do not mix them.
  const isMobile = p.startsWith('/ng/m/') || p === '/ng/m';
  if (isMobile !== mobile) return null;
  if (/\.(png|jpg|jpeg|gif|svg|css|js|ico|woff2?)$/i.test(p)) return null;
  if (!p.endsWith('/') && !p.includes('sr:')) p += '/';
  // Discovery breadth: follow tournament pages (one per tournament) but not the individual
  // event pages hanging off them. Events are thousands of near-identical fixtures; a handful of
  // representative ones is enough to document the shape.
  if (/sr:match:/.test(p)) return null;
  if (/sr:tournament:/.test(p)) {
    if (eventsSeen.has(p)) return null;
    eventsSeen.add(p);
    if (eventsSeen.size > 40) return null;
  }
  const nav = u.searchParams.get('nav');
  return nav ? `${p}?nav=${nav}` : p;
}

function slugFor(path) {
  const [p, q] = path.split('?');
  const mobile = p.startsWith('/ng/m/') || p === '/ng/m';
  let s = p.replace(/^\/ng\/m(?=\/|$)/, '').replace(/^\/ng(?=\/|$)/, '');
  s = s.replace(/\/$/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  if (!s) s = 'home';
  if (mobile) s = 'm-' + s;
  if (q) {
    const nav = new URLSearchParams(q).get('nav');
    if (nav) s += '-' + nav;
  }
  return s;
}

const isAuthRoute = (p) => /my_accounts|bet_history|deposit|withdraw|loyalty|reset_password|profile/i.test(p);

const queue = [
  { path: '/ng/', mobile: false },
  { path: '/ng/m/', mobile: true },
];
const seen = new Set();
const routes = [];

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
});

while (queue.length && routes.length < MAX) {
  const route = queue.shift();
  const key = `${route.mobile ? 'm' : 'd'}:${route.path}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const slug = slugFor(route.path);
  if (routes.some((r) => r.slug === slug)) continue;
  const started = Date.now();

  const ctx = await browser.newContext(
    route.mobile
      ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, userAgent: MOBILE_UA }
      : { viewport: { width: 1440, height: 900 }, userAgent: UA },
  );
  if (isAuthRoute(route.path) && cookies.length) await ctx.addCookies(cookies);

  const calls = [];
  const page = await ctx.newPage();
  page.on('request', (r) => {
    const t = r.resourceType();
    if (t === 'xhr' || t === 'fetch') calls.push(`${r.method()} ${r.url().replace(SITE, '')}`);
  });

  let status = 0;
  let text = '';
  let err = null;
  try {
    const resp = await page.goto(SITE + route.path, { waitUntil: 'domcontentloaded', timeout: 45000 });
    status = resp ? resp.status() : 0;
    await page.waitForTimeout(route.mobile ? 3500 : 4500);
    text = await page.evaluate(() => document.body.innerText);
    const frozen = await page.evaluate(() => {
      // strip scripts so the frozen page is inert and can be served without re-running the app
      const clone = document.documentElement.cloneNode(true);
      clone.querySelectorAll('script,noscript,iframe').forEach((n) => n.remove());
      return '<!doctype html>\n' + clone.outerHTML;
    });
    const live = await page.content();
    await page.screenshot({ path: join(OUT, `${slug}.png`), fullPage: true }).catch(() => {});

    writeFileSync(join(OUT, `${slug}.frozen.html`), frozen);
    writeFileSync(join(OUT, `${slug}.html`), live);
    writeFileSync(join(OUT, `${slug}.txt`), text);
    writeFileSync(join(OUT, `${slug}.requests.txt`), calls.join('\n'));

    // discover more routes from the live DOM
    const hrefs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')),
    );
    for (const h of hrefs) {
      const n = normalize(h, route.path, route.mobile);
      if (!n) continue;
      const k = `${route.mobile ? 'm' : 'd'}:${n}`;
      if (!seen.has(k)) queue.push({ path: n, mobile: route.mobile });
    }
  } catch (e) {
    err = e.message.split('\n')[0];
  }

  const ok = text.trim().length > 200;
  const meta = {
    slug,
    path: route.path,
    mobile: route.mobile,
    auth: isAuthRoute(route.path),
    status,
    ok,
    textChars: text.length,
    htmlBytes: Buffer.byteLength(text),
    networkCalls: calls.length,
    ms: Date.now() - started,
    ...(err ? { error: err } : {}),
  };
  writeFileSync(join(OUT, `${slug}.meta.json`), JSON.stringify(meta, null, 2));
  routes.push({
    slug,
    path: route.path,
    group: route.mobile ? 'Mobile' : isAuthRoute(route.path) ? 'Account' : 'Site',
    mobile: route.mobile,
  });

  console.log(
    `${ok ? 'OK  ' : 'THIN'} ${String(routes.length).padStart(3)}  ${slug.padEnd(44)} ${status} text=${String(text.length).padStart(6)} calls=${String(calls.length).padStart(3)} queued=${queue.length}`,
  );
  await ctx.close();
}

await browser.close();
writeFileSync(ROUTES_FILE, JSON.stringify(routes, null, 2));
console.log(`\ncaptured ${routes.length} routes (${routes.filter((r) => r.mobile).length} mobile)`);
console.log(`wrote ${ROUTES_FILE}`);
console.log(`queue left: ${queue.length}`);
