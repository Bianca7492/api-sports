/**
 * The catalog of SportyBet endpoints.
 *
 * This is the only place that knows the site's shapes. Everything else - the OpenAPI
 * document, the JSON Schemas, the proxy routes - is derived from it at runtime, so adding
 * an endpoint is one entry here and nothing else.
 *
 * Each entry declares:
 *   path        the SportyBet API path, relative to /api/{country}. `{name}` marks a path param.
 *   method      usually GET.
 *   auth        true when the endpoint needs a signed-in session.
 *   query       query params: name -> { type, required, default, description, enum, example }.
 *   pathParams  same shape, for `{name}` placeholders in `path`.
 *   schemaFrom  how to infer the response schema:
 *                 "sample"  probe the endpoint once and infer a schema from the live response
 *                           (default; keeps up with the site)
 *                 "static"  use the `schema` field instead (for shapes that vary per call)
 *   sampleArgs  args used only by the generator to probe the endpoint.
 */

export const COUNTRY = process.env.SPORTYBET_COUNTRY || "ng";
export const ORIGIN = process.env.SPORTYBET_ORIGIN || "https://www.sportybet.com";

export const ENDPOINTS = [
  // ---------------------------------------------------------------- sports & events (public)
  {
    operationId: "getSports",
    path: "/factsCenter/sportList",
    tags: ["Sports"],
    summary: "List sports",
    description:
      "Every sport SportyBet offers with its event count and the categories/tournaments under it. Use the returned sport id (e.g. sr:sport:1) as sportId elsewhere.",
    auth: false,
    query: {
      timeline: { type: "integer", required: false, description: "Look-ahead window in hours (24 shows the next day)." },
      productId: { type: "integer", required: false, default: 1, description: "1 = pre-match, 3 = live." },
      option: { type: "integer", required: false, default: 1 },
    },
    sampleArgs: { timeline: 24, productId: 1, option: 1 },
  },
  {
    operationId: "getOrderedSports",
    path: "/factsCenter/orderedSportList",
    tags: ["Sports"],
    summary: "List sports in display order",
    description: "The sports list in the order the site's own menu shows them.",
    auth: false,
    query: {},
    sampleArgs: {},
  },
  {
    operationId: "getUpcomingEvents",
    path: "/factsCenter/pcUpcomingEvents",
    tags: ["Events"],
    summary: "Pre-match events with odds",
    description:
      "Upcoming (pre-match) events grouped by tournament, each with its main markets and odds. Paginated by pageNum/pageSize.",
    auth: false,
    query: {
      sportId: { type: "string", required: true, example: "sr:sport:1", description: "Sport id from getSports." },
      marketId: { type: "string", required: false, description: "Comma-separated market ids to include, e.g. 1,18,10." },
      pageSize: { type: "integer", required: false, default: 100, description: "Events per page." },
      pageNum: { type: "integer", required: false, default: 1, description: "1-based page number." },
      option: { type: "integer", required: false, default: 1 },
    },
    sampleArgs: { sportId: "sr:sport:1", marketId: "1,18,10,29", pageSize: 5, pageNum: 1, option: 1 },
  },
  {
    operationId: "getLiveEvents",
    path: "/factsCenter/liveOrPrematchEvents",
    tags: ["Events"],
    summary: "Live (in-play) events",
    description:
      "Events currently in play, grouped by tournament, with live scores and the requested markets. Needs a session on some regions.",
    auth: true,
    query: {
      sportId: { type: "string", required: true, example: "sr:sport:1" },
      productId: { type: "integer", required: false, default: 3, description: "3 = live." },
      marketId: { type: "string", required: false, description: "Comma-separated market ids." },
      pageSize: { type: "integer", required: false, default: 100 },
      pageNum: { type: "integer", required: false, default: 1 },
    },
    sampleArgs: { sportId: "sr:sport:1", productId: 3, marketId: "1,18", pageSize: 5, pageNum: 1 },
  },
  {
    operationId: "getEvent",
    path: "/factsCenter/event",
    tags: ["Events"],
    summary: "One event's full market list",
    description:
      "Every market and outcome for a single event, including odds. eventId comes from getUpcomingEvents or getLiveEvents.",
    auth: false,
    query: {
      sportId: { type: "string", required: true, example: "sr:sport:1" },
      eventId: { type: "string", required: false, example: "sr:match:68931584", description: "Event id; omit for the site's default." },
      productId: { type: "integer", required: false, default: 3 },
    },
    sampleArgs: { sportId: "sr:sport:1", eventId: "sr:match:68931584" },
  },
  {
    operationId: "getOutrightEvents",
    path: "/factsCenter/outrightEvents",
    tags: ["Events"],
    summary: "Outright (winner) markets",
    description: "Outright markets for a sport (league winners, top scorer, and so on).",
    auth: false,
    query: {
      sportId: { type: "string", required: true, example: "sr:sport:1" },
    },
    sampleArgs: { sportId: "sr:sport:1" },
  },
  {
    operationId: "getImportantEvents",
    path: "/factsCenter/importantEvents",
    tags: ["Events"],
    summary: "Featured events",
    description: "The featured/important events the site pins for a sport.",
    auth: false,
    query: {
      sportId: { type: "string", required: true, example: "sr:sport:1" },
    },
    sampleArgs: { sportId: "sr:sport:1" },
  },

  // ---------------------------------------------------------------- account (needs a session)
  {
    operationId: "isLoggedIn",
    path: "/patron/isLoggedIn",
    tags: ["Account"],
    summary: "Whether the session is signed in",
    description: "Returns true when the stored session is a live signed-in session.",
    auth: true,
    query: {},
    sampleArgs: {},
    schemaFrom: "static",
    schema: { type: "boolean" },
  },
  {
    operationId: "getAccountInfo",
    path: "/patron/account/info",
    tags: ["Account"],
    summary: "Account profile",
    description: "The signed-in user's profile: name, email, loyalty tier and account settings.",
    auth: true,
    query: {},
    sampleArgs: {},
  },
  {
    operationId: "getBalance",
    path: "/pocket/v1/finAccs/finAcc/userBal/{currency}",
    tags: ["Account"],
    summary: "Wallet balance",
    description: "Available balance and coins for a currency (NGN, USD, ...).",
    auth: true,
    pathParams: {
      currency: { type: "string", required: true, default: "NGN", description: "ISO currency code." },
    },
    query: {},
    sampleArgs: { currency: "NGN" },
  },
  {
    operationId: "getWalletAssets",
    path: "/pocket/v1/wallet/assetsInfo",
    tags: ["Account"],
    summary: "Wallet assets summary",
    description: "Balance, gift counts and audit status for the wallet.",
    auth: true,
    query: {},
    sampleArgs: {},
  },
  {
    operationId: "getBetHistory",
    path: "/orders/order/v2/realbetlist",
    tags: ["Account"],
    summary: "Bet history",
    description:
      "Settled or unsettled bets for the signed-in user. Paginated by pageNo/pageSize; the response's totalNum says how many there are.",
    auth: true,
    query: {
      isSettled: { type: "integer", required: false, default: 10, description: "10 = settled, other values = unsettled." },
      pageSize: { type: "integer", required: false, default: 10 },
      pageNo: { type: "integer", required: false, default: 1 },
    },
    sampleArgs: { isSettled: 10, pageSize: 3, pageNo: 1 },
  },
  {
    operationId: "hasUnreadMessages",
    path: "/inbox/v1/hasAnyUnreadMessages",
    tags: ["Account"],
    summary: "Unread inbox messages",
    description: "Whether the signed-in user has unread inbox messages.",
    auth: true,
    query: {},
    sampleArgs: {},
    schemaFrom: "static",
    schema: { type: "boolean" },
  },
];

/** Headers the site's own frontend sends, minus the per-session ones (those come from the session). */
export const DEFAULT_HEADERS = {
  accept: "application/json, text/plain, */*",
  "accept-language": "en-US,en;q=0.9",
  origin: ORIGIN,
  referer: `${ORIGIN}/${COUNTRY}/`,
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

/** Cookies that carry the SportyBet session; the generator reports these as the session's evidence. */
export const SESSION_COOKIES = ["accessToken", "refreshToken", "userId", "userCert", "usrId", "deviceId", "phone"];
