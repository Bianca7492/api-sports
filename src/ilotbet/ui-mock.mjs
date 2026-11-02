#!/usr/bin/env node
/**
 * Faithful mock payloads for the iLOTBET web app.
 *
 * iLOTBET geolocates by IP: from an unsupported region every API call answers 403 while the
 * homepage still loads. That leaves the single-page app booting against an empty backend, so the
 * UI dump would show a shell with no matches, news or winners.
 *
 * These responses are shaped from the field names the app's own components read - the bundles
 * fetched by `src/ilotbet/extract.mjs` are the source of truth for every key below (match lists,
 * banners, hot news, grand-prize winners, the betslip config, virtual tours). The values are
 * representative sample data, not live odds. Point `ILOTBET_UI_UPSTREAM` at a region iLOTBET
 * serves and set `ILOTBET_UI_API=upstream` to use the real backend instead.
 */

const FOOTBALL = [
  ["Arsenal", "Chelsea", "England Premier League", "sr:tournament:17"],
  ["Manchester City", "Liverpool", "England Premier League", "sr:tournament:17"],
  ["Real Madrid", "Barcelona", "Spain LaLiga", "sr:tournament:8"],
  ["Bayern Munich", "Borussia Dortmund", "Germany Bundesliga", "sr:tournament:35"],
  ["Inter Milan", "AC Milan", "Italy Serie A", "sr:tournament:23"],
  ["Paris SG", "Marseille", "France Ligue 1", "sr:tournament:34"],
  ["Ajax", "PSV", "Netherlands Eredivisie", "sr:tournament:37"],
  ["Porto", "Benfica", "Portugal Primeira Liga", "sr:tournament:238"],
  ["Hearts of Oak", "Asante Kotoko", "Ghana Premier League", "sr:tournament:1001"],
  ["Enyimba", "Kano Pillars", "Nigeria NPFL", "sr:tournament:1002"],
];

function match(i, home, away, league, tourId, { live = true, odds = ["1.85", "3.40", "4.20"] } = {}) {
  const outcomes = [
    { id: "1", outcomeId: "1", name: "1", odds: odds[0], sid: "1" },
    { id: "2", outcomeId: "2", name: "X", odds: odds[1], sid: "2" },
    { id: "3", outcomeId: "3", name: "2", odds: odds[2], sid: "3" },
  ];
  const start = Date.now() + i * 1800000;
  return {
    matchId: `sr:match:${1000 + i}`,
    id: `sr:match:${1000 + i}`,
    sportId: "sr:sport:1",
    sportName: "Football",
    tournamentId: tourId,
    tournamentName: league,
    tourFullNameMap: { [tourId]: league },
    tourInfoId: tourId,
    homeName: home,
    awayName: away,
    homeLogo: "",
    awayLogo: "",
    homeScore: live ? 1 : null,
    awayScore: live ? 0 : null,
    periodScoresList: "[]",
    matchTime: new Date(start).toISOString().replace(/\.\d{3}Z$/, "Z"),
    scheduledTime: start,
    startTime: start,
    eventStatus: live ? "live" : "pre",
    preOrLive: live ? "live" : "pre",
    status: live ? "live" : "pre",
    minute: live ? 35 + i : 0,
    periodDesc: live ? "2H" : "",
    matchCount: 1 + (i % 5),
    roundOfMatches: 12,
    marketId: "1",
    marketName: "1X2",
    marketOddsList: outcomes,
    outcomes,
    hot: i < 3,
    simHot: false,
    sortWeight: 100 - i,
    levelType: 1,
    roundStage: "bet",
    tourNo: i,
    tourNoTrans: i,
    isLike: false,
  };
}

export const liveMatches = (n = 10) => FOOTBALL.slice(0, n).map(([h, a, lg, t], i) => match(i, h, a, lg, t, { live: true }));
export const preMatches = (n = 10) => FOOTBALL.slice(0, n).map(([h, a, lg, t], i) => match(i, h, a, lg, t, { live: false }));

/**
 * The games the app lists, in the shape its own list component reads: `id` is the game's own
 * number, `ilotGameId` is the separate number used to match it to a jackpot pool, and
 * `developerId` decides which launch call the app makes (10 is iLOTBET's own, anything else is
 * a third-party provider). The values are taken from the real list so the grid, the provider
 * names and the jackpot flags all render as the site's do.
 */
const GAME_ROWS = [
  ["BEST AVIATOR", 2382, 60012, 10, "ilotbet", true, false, "Crash game, Win Millions"],
  ["Bottle Spin", 5264, 60024, 10, "ilotbet", false, false, ""],
  ["Greek Gods", 5823, 60035, 10, "ilotbet", false, true, ""],
  ["Cash Bandits", 2641, 60016, 10, "ilotbet", false, true, "Crash game, Million Jackpot"],
  ["Cash Goal", 6922, 60302, 10, "ilotbet", false, true, ""],
  ["IRON FRONT CRX", 7038, 60304, 10, "ilotbet", false, false, ""],
  ["Roulette Euro", 2, 60011, 10, "ilotbet", true, false, "Classic with high RTP"],
  ["AVIATOR", 403, 70000, 11, "Spribe", false, false, ""],
  ["Hot to Burn", 363, 70184, 11, "Pragmatic Play", false, false, ""],
  ["Navigator", 6752, 70362, 11, "Solidicon", false, false, ""],
  ["American Roulette", 638, 70014, 11, "Red Rake Gaming", false, false, ""],
  ["Spaceman", 901, 70031, 11, "Pragmatic Play", false, false, ""],
  ["Mines", 902, 70032, 11, "Spribe", false, false, ""],
  ["Plinko", 903, 70033, 11, "Spribe", false, false, ""],
  ["Sweet Bonanza", 904, 70101, 11, "Pragmatic Play", false, false, ""],
  ["Gates of Olympus", 905, 70102, 11, "Pragmatic Play", false, false, ""],
  ["Big Bass Bonanza", 906, 70103, 11, "Pragmatic Play", false, false, ""],
  ["Wild West Gold", 907, 70104, 11, "Pragmatic Play", false, false, ""],
  ["Book of Dead", 908, 70105, 11, "Play'n GO", false, false, ""],
  ["Reactoonz", 909, 70106, 11, "Play'n GO", false, false, ""],
  ["Wolf Gold", 910, 70107, 11, "Pragmatic Play", false, false, ""],
  ["Blackjack Classic", 911, 70041, 11, "Evolution", false, false, ""],
  ["Lightning Roulette", 912, 70042, 11, "Evolution", false, false, ""],
  ["Crazy Time", 913, 70043, 11, "Evolution", false, false, ""],
];

const thumb = (id) => `https://file.ilotbet.com/server-prod/2026/01/game-${id}.png`;

const GAME_LIST = GAME_ROWS.map(
  ([gameName, id, ilotGameId, developerId, provider, freebet, jackpotEnabled, subTitle]) => {
    const g = {
      aliasName: gameName,
      showName: false,
      imgThumb: thumb(id),
      freebet,
      jackpotEnabled,
      ilotGameId,
      developerId,
      gameName,
      provider,
      id,
      live: false,
    };
    if (subTitle) g.subTitle = subTitle;
    if (jackpotEnabled) g.jackpotPool = 997866.12 + id;
    return g;
  },
);

/** Casino lobby tags (`/casino/un/tags`), read by the category rail. */
const CASINO_TAGS = [
  { id: 1, tag: "home", tagName: "Home" },
  { id: 2, tag: "hot", tagName: "Hot" },
  { id: 3, tag: "slots", tagName: "Slots" },
  { id: 4, tag: "live", tagName: "Live Casino" },
  { id: 5, tag: "crash", tagName: "Crash" },
  { id: 6, tag: "jackpot", tagName: "Jackpot" },
  { id: 7, tag: "new", tagName: "New" },
  { id: 8, tag: "roulette", tagName: "Roulette" },
  { id: 9, tag: "cards", tagName: "Cards" },
  { id: 10, tag: "dice", tagName: "Dice" },
];

/** The casino lobby groups games under a tag, which is what the grid renders. */
const CASINO_HOME = CASINO_TAGS.slice(0, 4).map((t) => ({
  id: t.id,
  tag: t.tag,
  tagName: t.tagName,
  games: GAME_LIST.filter((g, i) => i % 4 === t.id - 1),
}));

/** Sport menu with live counts (`/sbu/un/m/live/sports`). */
export const LIVE_SPORTS = [
  { sportId: "sr:sport:1", sportName: "Football", matchCount: 10, liveCount: 10 },
  { sportId: "sr:sport:2", sportName: "Basketball", matchCount: 4, liveCount: 4 },
  { sportId: "sr:sport:5", sportName: "Tennis", matchCount: 3, liveCount: 3 },
];

export const BANNERS = [
  { id: 1, moduleCode: "home", imgUrl: "/static/img/card-bg.542d8a87.png", linkUrl: "", title: "Welcome Bonus", sortWeight: 1 },
  { id: 2, moduleCode: "home", imgUrl: "/static/img/cash-back.08406ae3.png", linkUrl: "", title: "Cash Back", sortWeight: 2 },
];

/** Hot news (`/notice/un/hotNews`); the carousel reads `title` and `titleFileUrl`. */
export const NEWS = [
  { id: 1, title: "iLOTBET Grand Jackpot Draw This Weekend", titleFileUrl: "", itemCdnPath: "", picUrl: "", createTime: Date.now() },
  { id: 2, title: "Premier League Matchday Preview", titleFileUrl: "", itemCdnPath: "", picUrl: "", createTime: Date.now() },
  { id: 3, title: "New Live Betting Markets Added", titleFileUrl: "", itemCdnPath: "", picUrl: "", createTime: Date.now() },
];

/** Grand-prize ticker (`/notice/un/grand/home/list`); the row reads `pn`, `money`, `sg`, `time`. */
export const WINNERS = [
  { id: 1, pn: "Kw***a", money: "12,500.00", sg: "3", gn: "Aviator", time: "2 mins" },
  { id: 2, pn: "Ch***i", money: "8,200.00", sg: "5", gn: "Football", time: "5 mins" },
  { id: 3, pn: "Ab***l", money: "5,000.00", sg: "2", gn: "Virtual", time: "9 mins" },
  { id: 4, pn: "Ko***e", money: "3,750.00", sg: "4", gn: "Crash", time: "12 mins" },
];

/** Betslip config (`/sbt/un/t/cfg/v2`); the slip reads the per-type `maxSelNum`. */
export const BETSLIP_CONFIG = {
  currency: "GHS",
  maxSelNum: 20,
  maxPayout: 500000,
  exciseTax: 0,
  withholdingTax: 0,
  single: { maxSelNum: 1 },
  multiple: { maxSelNum: 20 },
  system: { maxSelNum: 12 },
  types: ["single", "multiple", "system"],
  minStake: 1,
  maxStake: 50000,
  quickStakeList: [10, 20, 50, 100],
  allowSingle: true,
  allowMultiple: true,
  allowSystem: true,
  cashOutEnable: true,
};

/** Virtual tours (`/virtualgame/un/agg_tour_info`), keyed by tour id, each with its rounds. */
export const VIRTUAL = {
  1: {
    tourInfoId: "1",
    tourNo: "001",
    roundStage: "bet",
    roundStageStartTime: Date.now() + 120000,
    duration: 180,
    epoch: Date.now(),
    roundOfMatches: [
      { round: 1, matchId: "vf:1", homeName: "Virtual City", awayName: "Virtual United", tourInfoId: "1", matchCount: 10, sportId: "sr:sport:1" },
      { round: 2, matchId: "vf:2", homeName: "Virtual Rovers", awayName: "Virtual Town", tourInfoId: "1", matchCount: 10, sportId: "sr:sport:1" },
    ],
  },
};

export const GAMES = GAME_LIST;
export const CASINO = CASINO_HOME;

export const PROMOTIONS = [
  { id: 1, name: "Register Gift", moduleName: "Register Gift", imgUrl: "" },
  { id: 2, name: "Check In", moduleName: "Check In", imgUrl: "" },
  { id: 3, name: "FREE Rewards", moduleName: "FREE Rewards", imgUrl: "" },
];

/**
 * The envelope the app expects: `{ code, msg, data }` with `code === 0` meaning success.
 * Only the pathname matters; the query string is ignored.
 */
export function responseFor(pathname) {
  const p = pathname.split("?")[0];
  let data = null;

  if (p.includes("/sbu/un/m/featured/v2")) data = liveMatches(8);
  else if (p.includes("/sbu/un/m/live/sports_w_upcoming")) data = { matchList: liveMatches(10), tournamentList: [], count: 10, liveCount: 10, total: 10 };
  else if (p.includes("/sbu/un/m/live/sports")) data = LIVE_SPORTS;
  else if (p.includes("/sbu/un/m/pre/sports")) data = { matchList: preMatches(10), tournamentList: [], count: 10, liveCount: 0, total: 10 };
  else if (p.includes("/sbu/un/m/live/search") || p.includes("/sbu/un/m/pre/search")) data = { matchList: liveMatches(10), tournamentList: [], count: 10, total: 10 };
  else if (p.includes("/notice/un/hotNews")) data = NEWS;
  else if (p.includes("/notice/un/bananerPage")) data = BANNERS;
  else if (p.includes("/notice/un/grand/home/list")) data = WINNERS;
  else if (p.includes("/notice/un/winnerList")) data = { list: WINNERS, total: WINNERS.length };
  else if (p.includes("/notice/un/promotionPage")) data = PROMOTIONS;
  else if (p.includes("/notice/un/businessMsgPage")) data = { list: [], total: 0 };
  else if (p.includes("/sbt/un/t/cfg/v2")) data = { betslip: BETSLIP_CONFIG, sportsBook: { cashOutEnable: true } };
  else if (p.includes("/sbt/un/api/rec")) data = [];
  else if (p.includes("/virtualgame/un/agg_tour_info")) data = VIRTUAL;
  else if (p.includes("/virtualgame/")) data = [];
  // The games section. The lobby groups by tag; the flat list and the search answer a list.
  else if (p.includes("/casino/un/game/home")) data = CASINO_HOME;
  else if (p.includes("/casino/un/tags") || p.includes("/casino/api/tags")) data = CASINO_TAGS;
  else if (p.includes("/casino/un/game_search")) data = { list: GAME_LIST, total: GAME_LIST.length };
  else if (p.includes("/casino/un/games/recommend")) data = GAME_LIST.slice(0, 12);
  else if (p.includes("/casino/un/games")) data = { list: GAME_LIST, total: GAME_LIST.length, pages: 1 };
  else if (p.includes("/game/un/gameList"))
    data = { list: GAME_LIST, total: GAME_LIST.length, pages: 1, pageNum: 1 };
  // Launching a game returns its url. A real one is a signed link to the provider; this is a
  // stand-in so the app follows its own flow, and it is what `--resolve-urls` collects live.
  else if (p.includes("/casino/api/game/play") || p.includes("/casino/un/game/play") || p.includes("/game/un/gamePlayUrl"))
    data = { url: "https://www.ilotbet.com/game/launch", gameId: 2382 };

  return { code: 0, msg: "success", data, timestamp: Date.now() };
}
