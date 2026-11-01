/**
 * Friendly names for iLOTBET endpoints.
 *
 * The generated catalog (endpoints.generated.mjs) names operations after the site's own internal
 * methods, which change without notice. This file is the only hand-maintained mapping: each alias
 * points at a path, and the alias is resolved to whichever generated operation currently serves
 * that path. Regeneration never touches this file, so your names survive a site update.
 */
export const ALIASES = {
  // sportsbook (public)
  sportsPre: "/sbu/un/m/pre/sports",
  sportsLive: "/sbu/un/m/live/sports",
  sportsLiveWithUpcoming: "/sbu/un/m/live/sports_w_upcoming",
  sportsAll: "/sbu/un/m/sports",
  categories: "/sbu/un/m/categories",
  featured: "/sbu/un/m/featured/v2",
  topGames: "/sbu/un/m/top",
  tournaments: "/sbu/un/m/tournaments",
  tournamentsRecommended: "/sbu/un/m/tournaments/recommends/v2",
  tournamentSchedule: "/sbu/un/m/tournaments/schedule",
  preMatches: "/sbu/un/m/pre/matches",
  liveMatches: "/sbu/un/m/live/matches",
  matches: "/sbu/un/m/matches",
  matchDetail: "/sbu/un/m/match",
  marketOdds: "/sbu/un/m/markets/odds",
  search: "/sbu/un/m/search",
  searchLive: "/sbu/un/m/live/search",
  popularLive: "/sbu/un/m/popular/live",
  popularLiveV2: "/sbu/un/m/popular/live/v2",
  popularUpcoming: "/sbu/un/m/popular/upcoming",
  highlights: "/sbu/un/m/popular/highlights",
  highlightsV2: "/sbu/un/m/popular/v2/highlights",
  outrights: "/sbu/un/o/outright",
  outrightMenu: "/sbu/un/o/sports",

  // notices and promotions (public)
  hotNews: "/notice/un/hotNews",
  hotNewsPage: "/notice/un/hotNewsPage",
  banners: "/notice/un/bananerPage/v2",
  grandPrizeHome: "/notice/un/grand/home/list",
  winnerList: "/notice/un/winnerList",
  gameWinRank: "/notice/un/gameWinRank/v2",
  promotionPage: "/notice/un/promotionPage",
  bettingActivity: "/activity/un/betraward/config",

  // casino and virtual games (public)
  casinoGames: "/casino/un/games",
  casinoGamesV2: "/casino/un/games/v2",
  casinoGameSearch: "/casino/un/game_search",
  casinoTags: "/casino/un/tags",
  casinoHome: "/casino/un/game/home",
  casinoRecommend: "/casino/un/games/recommend",
  virtualTourInfo: "/virtualgame/un/agg_tour_info",
  virtualTours: "/virtualgame/un/tours",

  // account (token)
  memberMe: "/coupon/api/member/me",
  accountTransactions: "/funds/api/fundsDetail",
  accountInfo: "/funds/api/queryAccountInfo",
  accountBankList: "/funds/api/accountBank",
  betHistory: "/sbt/api/t/list",
  betHistoryDetail: "/sbt/api/t/view",
  messageCount: "/notice/api/count",
  messageList: "/notice/api/list",
  couponList: "/coupon/api/coupons",

  // writes (token; deliberately not proxied by default - see README)
  login: "/user/un/v2/login",
  register: "/user/un/register",
  logout: "/user/api/logout",
  createBetTicket: "/sbt/api/t/create",
  deposit: "/funds/api/payment",
  withdraw: "/funds/api/withdrawal",
};
