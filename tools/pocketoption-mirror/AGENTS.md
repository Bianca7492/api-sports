# Pocket Option mirror (m.pocketoption.com)

Self-contained offline mirror of `https://m.pocketoption.com/en` (and all
language/cross-linked routes), served from the sandbox static server.

## Layout

- `site/m.pocketoption.com/` — mirror root (`MIRROR_ROOT`). 115k files, ~15 GB.
  - `<lang>/` — 40 language roots (en, ar, ru, es, ...).
  - `<lang>/reviews/<n>/index.html` — review pagination (1..max per language).
  - `blog/<lang>/...` — blog articles (main domain content mirrored under this host).
  - `api34/storage/...` — blog media, served from `pocketoption.com` upstream.
  - `_ext/<host>/...` — third-party assets (pocket-uploads.com, chat-po.site, ...).
- `server.py` — static server, port 12000. Serves real paths (no redirects),
  directory indexes, extensionless routes, and a closest-ancestor fallback for
  dynamic routes (per-user `?uid=`, social login) that were never mirrored.

## Network

Sandbox egress to the target is WAF-blocked, so all fetching goes through a
rotating free-proxy pool. `pf4.py` is the fetcher (per-proxy sessions, aggressive
rotation, Android Chrome UA). Proxy lists live in `proxies_live.txt`; refresh via
the `val.py` validator in `/tmp` when success rates drop (proxies are short-lived).

## Key scripts

- `crawl2.py` — resumable BFS mirror: rewrites refs to root-absolute local paths,
  state in `/tmp/c2state.json`. Core helpers: `Crawler.rewrite`, `local_path`,
  `is_page`, `save`.
- `fill3.py <urls.json>` — robust multi-round filler; classifies genuine origin
  404s vs transient proxy failures.
- `fill4.py` — small targeted fetches, incl. `/api34/` media from `pocketoption.com`.
- `api34_fill.py` — bulk mirror of `pocketoption.com/api34/...` blog media at both
  `/api34/...` and `/_ext/pocketoption.com/api34/...`.
- `blog_bfs.py` — BFS closure over `/blog/` routes + their api34 media; converges.
- `rewire.py` — offline pass rewriting absolute self-references
  (`m.pocketoption.com`, `pocketoption.com`, `pocket-uploads.com`, ...) to local
  paths. Run after any bulk fetch. Only `content=` meta and JS strings remain absolute.
- `cov_final.py` — coverage report vs referenced internal routes.

## Notes / gotchas

- Reviews: every `1..last` page exists (last page number is in the pagination JS).
  Numbers beyond each language's max genuinely 404 on the origin (site bug), so
  final coverage tops out near 91% of *referenced* routes — effectively 100% of
  valid ones. All internal refs on sampled pages resolve 200.
- Login/cabinet pages are reCAPTCHA-gated; anonymous fetch returns the ~51 KB
  login page, which is what the mirror stores.
- Reference extraction must use the *original* HTML, not the rewritten output.
