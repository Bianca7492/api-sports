# SportyBet API

SportyBet has no public API. Its own website talks to a JSON API under
`https://www.sportybet.com/api/{country}/`, and this project exposes that as a proper
**OpenAPI 3.1** service.

Two pieces:

- **A generator** that calls the live site once per endpoint and infers a JSON Schema from
  the real response. Nothing about the response shape is hard-coded, so when SportyBet adds
  a field or changes a type, the next run of the generator picks it up.
- **A proxy server** that serves the generated spec at `/openapi.json` and forwards the same
  paths to SportyBet, adding the session cookies. Any OpenAPI client works against it
  unchanged.

Because the spec is derived from live traffic, the API stays current without code changes.
Regenerate on a schedule and the document follows the site.

## Quick start

```sh
npm install

# 1. Log in (writes .sportybet-cookies.json, git-ignored)
SPORTYBET_PHONE=8012345678 SPORTYBET_PASSWORD='your-password' npm run login

# 2. Generate the OpenAPI document by probing the live site
npm run generate            # writes openapi.json + openapi.yaml

# 3. Serve the spec and the API
npm run serve               # http://localhost:3000
```

Open <http://localhost:3000/docs> for Swagger UI, or read
<http://localhost:3000/openapi.json>.

```sh
curl "http://localhost:3000/api/ng/factsCenter/sportList?timeline=24&productId=1&option=1"
curl "http://localhost:3000/api/ng/patron/account/info"        # needs the session
```

## How the pieces fit

```
src/catalog.mjs   the endpoint list: path, params, auth, sample args   <- the only place with site knowledge
src/client.mjs    builds the URL, attaches cookies, calls SportyBet
src/infer.mjs     live JSON  ->  JSON Schema
src/openapi.mjs   catalog + live probes  ->  OpenAPI 3.1 document
src/generate.mjs  writes openapi.json / openapi.yaml
src/server.mjs    serves /openapi.json and proxies /api/{country}/...
src/login.mjs     signs in and saves the session cookies
```

Adding an endpoint is one entry in `src/catalog.mjs`. The OpenAPI document, the schemas and
the proxy routes all follow from it automatically.

## Operations

| operation | path | auth | returns |
|---|---|---|---|
| `getSports` | `/factsCenter/sportList` | no | sports, event counts, categories |
| `getOrderedSports` | `/factsCenter/orderedSportList` | no | sports in menu order |
| `getUpcomingEvents` | `/factsCenter/pcUpcomingEvents` | no | pre-match events grouped by tournament, with odds |
| `getLiveEvents` | `/factsCenter/liveOrPrematchEvents` | yes | in-play events with live scores |
| `getEvent` | `/factsCenter/event` | no | every market and outcome for one event |
| `getOutrightEvents` | `/factsCenter/outrightEvents` | no | outright (winner) markets |
| `getImportantEvents` | `/factsCenter/importantEvents` | no | featured events |
| `isLoggedIn` | `/patron/isLoggedIn` | yes | whether the session is signed in |
| `getAccountInfo` | `/patron/account/info` | yes | profile: name, email, loyalty tier |
| `getBalance` | `/pocket/v1/finAccs/finAcc/userBal/{currency}` | yes | available balance and coins |
| `getWalletAssets` | `/pocket/v1/wallet/assetsInfo` | yes | balance, gifts, audit status |
| `getBetHistory` | `/orders/order/v2/realbetlist` | yes | settled / unsettled bets, paginated |
| `hasUnreadMessages` | `/inbox/v1/hasAnyUnreadMessages` | yes | unread inbox flag |

Public endpoints (sports and odds) work with no login. Account endpoints need the session
and answer `401` without one.

## Staying current

The generator re-probes the site on every run, so the schemas track the real responses.
To keep it current automatically, add a scheduled regeneration:

```sh
# crontab: refresh the spec every 6 hours
0 */6 * * * cd /path/to/sportybet-api && /usr/bin/node src/generate.mjs >> generate.log 2>&1
```

The server also rebuilds `/openapi.json` from the live site on request (cached for
`OPENAPI_CACHE_MS`, default 60s), so a running server reflects the site without a restart.
Lower the cache to `0` to probe on every request, or generate to a file and serve that
instead if you prefer a fixed snapshot.

## The session

SportyBet sessions are cookie-based. `npm run login` either:

- drives a headless Chromium with `SPORTYBET_PHONE` / `SPORTYBET_PASSWORD`, or
- imports an export from a browser you are already signed in to:
  `npm run login -- --cookies cookies.txt` (Netscape or JSON).

The cookies are saved to `.sportybet-cookies.json` with `0600` permissions. That file is
git-ignored and never leaves the machine: the server reads it locally and attaches the
cookies to its own upstream requests. Clients talk to this server, not to SportyBet.

If a session expires the Account endpoints start answering `401`; run `npm run login` again.

## Configuration

| variable | default | purpose |
|---|---|---|
| `PORT` | `3000` | server port |
| `SPORTYBET_COUNTRY` | `ng` | API region prefix (`/api/{country}`) |
| `SPORTYBET_ORIGIN` | `https://www.sportybet.com` | upstream origin |
| `SPORTYBET_SESSION_FILE` | `.sportybet-cookies.json` | where the session is read from |
| `OPENAPI_CACHE_MS` | `60000` | how long `/openapi.json` reuses a rebuilt document |
| `SPORTYBET_PHONE` / `SPORTYBET_PASSWORD` | — | login credentials for `npm run login` |
| `CHROMIUM_PATH` | auto-detect | browser binary for login |

## UI dump

`tools/` captures the site's rendered UI and serves it as a browsable mirror. The capture is
regenerable and lives in `.dump/`, which is git-ignored; only the tooling is committed.

```sh
npm run login       # once; the crawl signs in so the account routes render
npm run crawl       # walk the site from /ng/ and /ng/m/, capture every route
npm run wire        # rewrite each page's links so they navigate inside the dump
npm run serve:dump  # serve it (PORT defaults to 12001)
```

| path | what |
|---|---|
| `/` | the wired home page - the entry point; its links browse the whole dump |
| `/routes` | index of every route, grouped, with status and sizes |
| `/r/<slug>` | wired page (links navigate) |
| `/r/<slug>/raw` | frozen capture, unwired |
| `/r/<slug>/verbatim` | live DOM as captured |
| `/r/<slug>/png` `/text` `/requests` | screenshot, visible text, the API calls the page made |
| `/unmapped?to=...` | a link the crawl did not capture, reported rather than dead-ended |

Notes:

- Discovery and capture are one pass: each page is scanned for links as it is captured, so the
  route list cannot drift from the dumps. Tournament pages are followed (40 max) but individual
  fixtures are skipped - they are thousands of near-identical pages.
- Desktop (`/ng/`) and mobile (`/ng/m/`) are separate sites and are kept separate; a mobile page
  links to mobile routes.
- **The account routes are captured signed in, so their dumps contain the user's real name and
  phone number.** They are git-ignored along with the rest of `.dump/`, and the index carries a
  warning. Do not publish them as-is.

## Tests

```sh
npm test      # offline: schema inference, catalog, OpenAPI shape
npm run smoke # live: starts a server, calls public and account endpoints
```

## Notes and limits

- This is a read API. It exposes the GET endpoints the site's own frontend uses; it does not
  place bets or move money.
- **Personal data is kept out of the spec.** Account responses carry your phone, email, name and
  tokens; the generator redacts any such field to its type and drops the session's literal
  values, so `openapi.json` never contains them. The session file itself is git-ignored.
- The paths mirror SportyBet's internal API. SportyBet may change them; that is exactly what
  regeneration is for - if an endpoint starts failing, its probe status in the generated
  document says so, and the fix is an edit in `src/catalog.mjs`.
- Response bodies are returned unchanged, including SportyBet's `bizCode` envelope
  (`10000` = success, `19000` invalid, `19001` not found, `19003` forbidden).
- Use it within SportyBet's terms and at human volume. The session is your own account's.
