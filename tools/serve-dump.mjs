#!/usr/bin/env node
/**
 * Serve the wired dump.
 *
 *   /                     the wired home page - the entry point
 *   /routes               index of every route, grouped
 *   /r/<slug>             wired page (browses)
 *   /r/<slug>/raw         frozen capture, unwired
 *   /r/<slug>/verbatim    live DOM as captured
 *   /r/<slug>/png|text|requests
 *   /unmapped?to=...      a link we did not capture
 *
 *   npm run serve:dump            (PORT defaults to 12001)
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { OUT, ROUTES_FILE } from './dump-env.mjs';

const PORT = Number(process.env.PORT || 12001);
const routes = JSON.parse(readFileSync(ROUTES_FILE, 'utf8'));

const file = (slug, ext) => {
  const p = join(OUT, `${slug}.${ext}`);
  return existsSync(p) ? p : null;
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const kb = (n) => (n ? `${Math.round(n / 1024)}K` : '-');

function indexPage() {
  const meta = routes.map((r) => {
    const f = file(r.slug, 'meta.json');
    const m = f ? JSON.parse(readFileSync(f, 'utf8')) : {};
    return { ...m, slug: r.slug, path: r.path, group: r.group, mobile: r.mobile };
  });
  const groups = [...new Set(meta.map((m) => m.group))].sort();
  const ok = meta.filter((m) => m.ok).length;
  const totalText = meta.reduce((a, m) => a + (m.textChars || 0), 0);

  const table = (rows) =>
    `<table><thead><tr><th>route</th><th>path</th><th>status</th><th>text</th><th>calls</th><th>size</th><th>views</th></tr></thead><tbody>` +
    rows
      .map(
        (m) => `<tr>
          <td><code>${esc(m.slug)}</code>${m.auth ? ' <span class="auth">account</span>' : ''}${m.mobile ? ' <span class="auth">mobile</span>' : ''}</td>
          <td class="p">${esc(m.path)}</td>
          <td class="${m.ok ? 'ok' : 'warn'}">${m.status}</td>
          <td class="num">${(m.textChars || 0).toLocaleString()}</td>
          <td class="num">${m.networkCalls ?? '-'}</td>
          <td class="num">${kb(m.htmlBytes)}</td>
          <td>
            <a href="/r/${m.slug}">wired</a>
            <a href="/r/${m.slug}/raw">raw</a>
            <a href="/r/${m.slug}/png">png</a>
            <a href="/r/${m.slug}/text">text</a>
            <a href="/r/${m.slug}/requests">calls</a>
          </td></tr>`,
      )
      .join('') +
    `</tbody></table>`;

  const sections = groups
    .map(
      (g) =>
        `<h2>${esc(g)} <span class="dim">${meta.filter((m) => m.group === g).length}</span></h2>${table(meta.filter((m) => m.group === g))}`,
    )
    .join('');

  return `<!doctype html><meta charset="utf-8"><title>SportyBet UI dump</title>
<style>
 body{font:14px/1.5 -apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif;background:#0d1117;color:#c9d1d9;margin:0;padding:24px}
 h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:26px 0 8px;color:#e6edf3}
 a{color:#58a6ff;text-decoration:none;margin-right:8px}a:hover{text-decoration:underline}
 code{background:#161b22;padding:2px 6px;border-radius:4px;font-size:12px}
 table{border-collapse:collapse;width:100%;font-size:13px}
 th,td{text-align:left;padding:5px 10px;border-bottom:1px solid #21262d;white-space:nowrap}
 th{color:#7d8590;font-weight:500;position:sticky;top:0;background:#0d1117}
 td.p{color:#7d8590;font-family:ui-monospace,Menlo,monospace;font-size:12px;white-space:normal;max-width:420px}
 td.num{text-align:right;font-variant-numeric:tabular-nums}
 .ok{color:#3fb950}.warn{color:#d29922}.dim{color:#7d8590;font-weight:400}.auth{color:#a371f7;border:1px solid #30363d;border-radius:4px;padding:0 4px;font-size:11px}
 .cards{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px}
 .card{border:1px solid #21262d;border-radius:8px;padding:10px 16px;background:#161b22;min-width:130px}
 .card .k{color:#7d8590;font-size:12px}.card .v{font-size:20px;margin-top:2px}
 .warnbox{margin-top:14px;border:1px solid #9e6a03;background:#2d2205;color:#e3b341;border-radius:8px;padding:10px 14px;max-width:900px}
</style>
<h1>SportyBet &mdash; UI dump</h1>
<div class="dim">source <code>https://www.sportybet.com</code> &middot; every page's links browse the dump</div>
<div class="cards">
  <div class="card"><div class="k">routes</div><div class="v">${ok}/${routes.length}</div></div>
  <div class="card"><div class="k">groups</div><div class="v">${groups.length}</div></div>
  <div class="card"><div class="k">visible text</div><div class="v">${totalText.toLocaleString()}</div></div>
</div>
<div class="warnbox">
  <strong>Personal data.</strong> The <em>Account</em> routes were captured signed in, so their dumps
  contain the signed-in user's real name, phone number and account details. Everything else is
  anonymous. Do not publish the Account dumps as-is.
</div>
${sections}`;
}

function send(res, status, body, type) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(status, { 'content-type': type, 'content-length': buf.length, 'cache-control': 'no-store' });
  res.end(buf);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;
  try {
    if (p === '/') {
      // the home page is the entry point: wired, so its links browse the whole dump
      const f = file('home', 'wired.html');
      if (f) return send(res, 200, readFileSync(f), 'text/html; charset=utf-8');
    }
    if (p === '/routes' || p === '/index.html') return send(res, 200, indexPage(), 'text/html; charset=utf-8');
    if (p === '/health') return send(res, 200, JSON.stringify({ ok: true, routes: routes.length }), 'application/json');

    if (p === '/unmapped') {
      const to = url.searchParams.get('to') || '';
      return send(
        res,
        200,
        `<!doctype html><meta charset="utf-8"><title>not captured</title>
<style>body{font:14px/1.6 ui-monospace,Menlo,monospace;background:#0d1117;color:#c9d1d9;padding:40px;max-width:760px}
a{color:#58a6ff}code{background:#161b22;padding:2px 6px;border-radius:4px}</style>
<h2>This link was not captured</h2>
<p>The page links to <code>${esc(to)}</code>, which is not one of the ${routes.length} routes in this dump.</p>
<p>It is a deep flow that needs interaction, or a route that did not exist when the crawl ran.
Nothing is broken &mdash; the link is reported rather than followed.</p>
<p><a href="/">&larr; back to all routes</a></p>`,
        'text/html; charset=utf-8',
      );
    }

    const m = /^\/r\/([^/]+)(?:\/(wired|raw|verbatim|text|png|requests))?$/.exec(p);
    if (m) {
      const slug = m[1];
      if (!routes.some((r) => r.slug === slug)) return send(res, 404, `unknown route: ${slug}\n`, 'text/plain');
      const kind = m[2];
      if (kind === 'png') {
        const f = file(slug, 'png');
        return f ? send(res, 200, readFileSync(f), 'image/png') : send(res, 404, 'no screenshot\n', 'text/plain');
      }
      if (kind === 'text') {
        const f = file(slug, 'txt');
        return f ? send(res, 200, readFileSync(f), 'text/plain; charset=utf-8') : send(res, 404, 'no text\n', 'text/plain');
      }
      if (kind === 'requests') {
        const f = file(slug, 'requests.txt');
        return f ? send(res, 200, readFileSync(f), 'text/plain; charset=utf-8') : send(res, 404, 'no requests\n', 'text/plain');
      }
      const ext = kind === 'verbatim' ? 'html' : kind === 'raw' ? 'frozen.html' : 'wired.html';
      let f = file(slug, ext);
      if (!f && ext === 'wired.html') f = file(slug, 'frozen.html');
      return f
        ? send(res, 200, readFileSync(f), 'text/html; charset=utf-8')
        : send(res, 404, `not captured yet: ${slug}\n`, 'text/plain');
    }
    send(res, 404, 'not found. see /\n', 'text/plain');
  } catch (e) {
    send(res, 500, e.message, 'text/plain');
  }
});

server.listen(PORT, () => process.stderr.write(`SportyBet dump on http://localhost:${PORT}\n`));
