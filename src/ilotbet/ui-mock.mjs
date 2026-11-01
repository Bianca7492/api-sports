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

  return { code: 0, msg: "success", data, timestamp: Date.now() };
}
