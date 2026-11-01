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

---

# iLOTBET

The same idea, applied to iLOTBET (ilotbet.com). It is a second provider in this repo, mounted
under `/ilotbet` so it never collides with the SportyBet routes.

The difference: iLOTBET does not use a cookie session. **Every request carries a signature** -
an RSA-MD5 signature over the sorted request body - so a catalog alone is not enough. The
provider reproduces the signature in code (`src/ilotbet/sign.mjs`), verified byte-for-byte
against a real request the site's own browser sent.

## What it does

- **Discovers the API from the live site.** iLOTBET documents nothing; its endpoints exist only
  as calls inside two JS bundles. `src/ilotbet/extract.mjs` reads the page, fetches the bundles,
  and pulls out every endpoint *and* the RSA signing key. Nothing is hard-coded, so a site change
  is picked up by the next run.
- **Signs the calls.** `src/ilotbet/client.mjs` merges the common params, sorts and signs the
  body, and sends the headers the site's own frontend sends.
- **Serves it as OpenAPI.** The server exposes `/openapi.ilotbet.json` and proxies
  `/ilotbet/{path}` to iLOTBET with the signature, so any OpenAPI client works unchanged.
- **Dumps every route.** `npm run routes:ilotbet` writes a browsable inventory of all routes
  (`routes.ilotbet.html`, `routes.ilotbet.md`), and the server serves it at `/ilotbet/routes`.

## Quick start

```sh
npm run generate:ilotbet   # read the live bundles -> catalog, signing key, OpenAPI, schemas
npm run routes:ilotbet     # write the route inventory (HTML + Markdown)
npm run serve              # then open http://localhost:3000/ilotbet/routes
```

```sh
# call a route through the proxy (it adds the signature)
curl "http://localhost:3000/ilotbet/sbu/un/m/featured/v2?marketId=1"

# the spec, and the browsable route list
curl http://localhost:3000/openapi.ilotbet.json
open http://localhost:3000/ilotbet/routes
```

## Layout

```
src/ilotbet/config.mjs             origin, headers, common params, key path (no catalog import)
src/ilotbet/extract.mjs            live bundles -> endpoints + signing key
src/ilotbet/sign.mjs               RSA-MD5 signature over the sorted body
src/ilotbet/endpoints.generated.mjs  the generated catalog (do not edit)
src/ilotbet/aliases.mjs            friendly names -> paths (the only hand-maintained mapping)
src/ilotbet/catalog.mjs            catalog + policy (write paths), alias resolution
src/ilotbet/client.mjs             builds and signs a call
src/ilotbet/openapi.mjs            catalog + live probes -> OpenAPI 3.1
src/ilotbet/generate.mjs           writes the catalog, key and spec
src/ilotbet/routes.mjs             writes the route inventory (HTML + Markdown)
```

## Routes

`npm run routes:ilotbet` lists every route with its method, path, alias, and access:

- **public** (120) - sports, odds, news, casino, virtual games. No token.
- **token** (114) - account, bets, funds. Need `ILOTBET_TOKEN`.
- **write** (13) - money and bets. The proxy refuses these; the SDK can still call them.

Open `routes.ilotbet.html` for the full UI, or read `routes.ilotbet.md`.

## The signature

The site's frontend builds the `sign` header as: sort the body's params, join `key=value` with
`&` (dropping empty and null), MD5 the string to lowercase hex, then RSA-sign that digest with
RSA-MD5 (PKCS#1 v1.5) and base64 the result. `test/ilotbet.test.mjs` pins this to a signature the
site actually sent, so if iLOTBET changes the scheme the test fails loudly.

The key in `keys/ilot-sign.pem` is the key the site ships to every visitor inside its own bundle.
It is the site's shared signing key, not a per-user credential, and it is public.

## Configuration

| variable | default | purpose |
|---|---|---|
| `ILOTBET_ORIGIN` | `https://www.ilotbet.com` | upstream origin |
| `ILOTBET_TOKEN` | — | account token for the account endpoints |
| `ILOTBET_COUNTRY` | `gh` | `country-code` header |
| `ILOTBET_LANG` | `en` | `lang` header |
| `ILOTBET_DEVICE` | a fixed uuid | `deviceCode` sent with every call |
| `ILOTBET_VERSION` | the site's current build | `version` header / `deviceSoftVersion` |
| `ILOTBET_KEY_FILE` | `keys/ilot-sign.pem` | where the signing key is read from |

## Staying current

The generator re-reads the live bundles on every run, so the catalog, the key and the spec all
follow the site. `.github/workflows/refresh-ilotbet.yml` runs it daily and opens a PR when
anything changed. A change in the signature scheme shows up as a failing test in that PR.

## Notes and limits

- **iLOTBET geolocates by IP.** From an unsupported region every API call answers `403` (a bare
  HTML `403 Forbidden`, or a body saying "prohibited jurisdiction"), while the homepage still
  loads. This is the site's block, not a bug: run the generator and the proxy from a region
  iLOTBET serves and the schemas fill in. The client reports this distinctly
  (`error: "prohibited_jurisdiction"`).
- **Writes are not proxied.** The 13 money/bet endpoints are refused by the proxy by design. The
  SDK can call them if you mean to, but the proxy will not.
- Account endpoints need `ILOTBET_TOKEN`. Without it they answer 401.
- Use it within iLOTBET's terms and at human volume, with an account you are entitled to use.
