# Pocket Option mobile site mirror

Tooling that produced a fully-wired, self-contained offline mirror of
`https://m.pocketoption.com/en` (all languages and cross-linked routes) and
serves it from a local static server.

The mirror itself is ~15 GB / ~116k files and is **not** committed here. This
directory holds the crawler, fetchers, rewiring pass, coverage checker and the
server, so the mirror can be reproduced or extended.

## Result

| Metric | Value |
|---|---|
| HTML pages | 94,828 |
| Review pages (40 langs, 1..max) | 14,911 |
| Blog pages | 31,995 |
| Blog media (`api34`) | 8,577 |
| Other assets | 21,022 |
| Total files | 115,849 |
| Size | ~15 GB |

Internal references on sampled pages resolve 200 (100%). Route coverage against
*referenced* paths is ~91%; the remainder are review numbers above each
language's real maximum, which genuinely 404 on the origin too.

## Pipeline

1. `crawl2.py` — resumable BFS mirror. Rewrites every reference to a
   root-absolute local path, stores pages as `<route>/index.html`, keeps state in
   `/tmp/c2state.json`. Configurable worker count via `WORKERS`.
2. `fill3.py <urls.json>` — robust multi-round filler. Classifies genuine origin
   404s vs transient proxy failures so retries converge.
3. `blog_bfs.py` — BFS closure over `/blog/` routes and the `api34` media they
   reference (media lives on the main domain, not the mobile host).
4. `api34_fill.py` — bulk mirror of `pocketoption.com/api34/...` media.
5. `rewire.py` — offline pass rewriting absolute self-references
   (`m.pocketoption.com`, `pocketoption.com`, `pocket-uploads.com`, ...) to local
   paths. Run after any bulk fetch. Only `content=` meta and JS strings stay absolute.
6. `cov_final.py` — coverage report of referenced internal routes vs what is on disk.
7. `server.py` — static server (port 12000). Serves real paths with no redirects,
   resolves directory indexes and extensionless routes, and falls back to the
   closest ancestor page for dynamic routes (per-user `?uid=`, social login).

## Networking

Sandbox egress to the target is WAF-blocked, so `pf4.py` fetches through a
rotating free-proxy pool (per-proxy sessions, Android Chrome UA). Proxy lists
are short-lived; refresh them when success rates drop.

## Run

```sh
WORKERS=200 python3 crawl2.py                 # crawl
python3 fill3.py missing.json                 # fill gaps
python3 blog_bfs.py                           # blog closure
python3 rewire.py                             # localise references
python3 cov_final.py                          # coverage report
SERVE_ROOT=site/m.pocketoption.com PORT=12000 python3 server.py
```

See `AGENTS.md` for layout and gotchas.
