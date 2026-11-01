# iLOTBET route inventory

Generated 2026-11-01T00:28:20.360Z from https://www.ilotbet.com. 247 routes.

Proxy mount: `/ilotbet` — call `/ilotbet{path}` on the server and it forwards to iLOTBET with the signature.

`public` = no token needed. `write` = moves money or places a bet; the proxy refuses it.

## activity (7)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/activity/api/betraward/detail` | queryBtaskDetail |  |  |  |
| POST | `/activity/api/betraward/ready` | btaskReady |  |  |  |
| POST | `/activity/un/betraward/config` | queryBtaskConfig | bettingActivity | yes |  |
| POST | `/activity/un/championship/getChampionshipList` | getChampionshipList |  | yes |  |
| GET | `/activity/un/championship/marquee` | getChampionshipMarquee |  | yes |  |
| POST | `/activity/un/wc2026/matchmap` | getWc2026MatchMap |  | yes |  |
| POST | `/activity/un/wc2026/scoreboard` | getWc2026Scoreboard |  | yes |  |

## cagent (3)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/cagent/api/applyAgent` | applyAgentForm |  |  |  |
| POST | `/cagent/api/queryAgentAuditStatus` | queryAgentAuditStatus |  |  |  |
| POST | `/cagent/un/agentCommissionDetails` | agentCommissionDetails |  | yes |  |

## casino (9)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/casino/api/game/play` | getCasinoGameUrl |  |  |  |
| GET | `/casino/api/tags` | getCasinoTagsCanary |  |  |  |
| GET | `/casino/un/game_search` | searchCasinoGame | casinoGameSearch | yes |  |
| GET | `/casino/un/game/home` | getCasinoGames | casinoHome | yes |  |
| POST | `/casino/un/game/play` | getIlotCasinoGameUrl |  | yes |  |
| GET | `/casino/un/games` | getCasinoGameList | casinoGames | yes |  |
| GET | `/casino/un/games/recommend` | getCasinoHotList | casinoRecommend | yes |  |
| GET | `/casino/un/games/v2` | getVideoVirtualGamesApi | casinoGamesV2 | yes |  |
| GET | `/casino/un/tags` | getCasinoTags | casinoTags | yes |  |

## coupon (25)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/coupon/api/availableCoupon` | availableCoupon |  |  |  |
| POST | `/coupon/api/coupons` | queryCoupons | couponList |  |  |
| POST | `/coupon/api/freebet-detail` | getFreeBetDetail |  |  |  |
| POST | `/coupon/api/getUnpopDiscount` | getUnpopDiscount |  |  |  |
| POST | `/coupon/api/member/me` | getMyVipInfo | memberMe |  |  |
| POST | `/coupon/api/member/v2/draw` | memberDraw |  |  |  |
| POST | `/coupon/api/mtask/getLuckHistory` | getLuckHistory |  |  |  |
| POST | `/coupon/api/mtask/getLuckyTimes` | getLuckyTimes |  |  |  |
| POST | `/coupon/api/mtask/lucky` | mtaskLucky |  |  |  |
| POST | `/coupon/api/mtask/luckyv2` | mtaskLuckyV2 |  |  |  |
| POST | `/coupon/api/redraw` | rechargeDraw |  |  |  |
| POST | `/coupon/api/srdraw` | srdraw |  |  |  |
| POST | `/coupon/api/v2/queryCoupon` | giftList |  |  |  |
| POST | `/coupon/api/v2/sr-dailygift` | getSilentRecallConfig |  |  |  |
| POST | `/coupon/red/activity/getVipUserRechargeActivity` | getVipUserRechargeActivity |  | yes |  |
| POST | `/coupon/signIn/api/signIn` | signIn |  |  |  |
| POST | `/coupon/signIn/un/querySignIn` | querySignIn |  | yes |  |
| POST | `/coupon/un/dailyTaskDetail` | dailyTaskDetail |  | yes |  |
| POST | `/coupon/un/mtask/progress` | mtaskProgress |  | yes |  |
| POST | `/coupon/un/mtask/winHistory` | mtaskWinHistory |  | yes |  |
| POST | `/coupon/un/mtask/winRank` | mtaskWinRank |  | yes |  |
| POST | `/coupon/un/resendHis` | getRechargeHistory |  | yes |  |
| POST | `/coupon/un/winHistory` | winHistory |  | yes |  |
| POST | `/coupon/un/winList?payCode=` | winList |  | yes |  |
| POST | `/coupon/un/winRank` | lotteryWinRank |  | yes |  |

## engine (10)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/engine/T300100` | heartbeat |  | yes |  |
| POST | `/engine/T300101` | updateTime |  | yes |  |
| POST | `/engine/T300110` | checkSaleGame |  | yes |  |
| POST | `/engine/T300111` | gameIssue |  | yes |  |
| POST | `/engine/T300113` | getLotteryMatchDetail |  | yes |  |
| POST | `/engine/T300140` | getBetHistory |  | yes |  |
| POST | `/engine/T300141` | getBetDetail |  | yes |  |
| POST | `/engine/T300153` | getLotteryResult |  | yes |  |
| POST | `/engine/T300154` | getGameInfo |  | yes |  |
| POST | `/engine/T301200` | gameBet |  | yes | yes |

## funds (39)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/funds/api/accountBank` | bankAccountList | accountBankList |  |  |
| POST | `/funds/api/accountUpdateUserPwd` | updatePayPwd |  |  |  |
| POST | `/funds/api/addAccountBanks` | addAccountBank |  |  | yes |
| POST | `/funds/api/addAccountBanksV2` | addAccountBankV2 |  |  | yes |
| POST | `/funds/api/bankList` | bankList |  |  |  |
| POST | `/funds/api/calculateUserFee` | calculateUserFee |  |  |  |
| POST | `/funds/api/channelCommission` | channelCommission |  |  |  |
| POST | `/funds/api/checkAccountUserPwd` | checkAccountUserPwd |  |  |  |
| POST | `/funds/api/checkWithdrawalUserPwd` | checkPwdValid |  |  |  |
| POST | `/funds/api/createVirtualBank` | createIlotBank |  |  |  |
| POST | `/funds/api/delAccountBanks` | delAccountBank |  |  | yes |
| POST | `/funds/api/fundsDetail` | transaction | accountTransactions |  |  |
| POST | `/funds/api/fundsParam` | getWithdrawConfig |  |  |  |
| POST | `/funds/api/getAvailableRedPacketActivityInfoList` | getAvailableRedPacketList |  |  |  |
| POST | `/funds/api/getVirtualBank` | getIlotBank |  |  |  |
| POST | `/funds/api/getWithdrawlRule` | getWithdrawlRule |  |  |  |
| POST | `/funds/api/joinInRedPacketActivity` | joinRedPacketActivity |  |  |  |
| POST | `/funds/api/payment` | payment | deposit |  | yes |
| POST | `/funds/api/payment-tax-config` | getPaymentTaxConfig |  |  |  |
| POST | `/funds/api/payment/status` | checkDeposit |  |  |  |
| POST | `/funds/api/payMode` | payMode |  |  |  |
| POST | `/funds/api/queryAccountInfo` | queryAccountInfo | accountInfo |  |  |
| POST | `/funds/api/queryFundsParams` | queryFundsParams |  |  |  |
| POST | `/funds/api/recharge_param` | queryRechargeParams |  |  |  |
| POST | `/funds/api/reportCommission` | reportCommission |  |  |  |
| POST | `/funds/api/selectAgentGgr` | selectAgentGgr |  |  |  |
| POST | `/funds/api/selectAgentStakeList` | selectAgentStakeList |  |  |  |
| POST | `/funds/api/statkeCommission` | statkeCommission |  |  |  |
| POST | `/funds/api/transferAgent` | transferAgent |  |  |  |
| POST | `/funds/api/userRedPacketAndAccountInfo` | getUserRedPacketList |  |  |  |
| POST | `/funds/api/verfiyBvn` | verfiyBvn |  |  |  |
| POST | `/funds/api/verifyBank` | verifyBank |  |  |  |
| POST | `/funds/api/verifyPalmMember` | verifyPalmMember |  |  |  |
| POST | `/funds/api/verifyPayMember` | verifyPayMember |  |  |  |
| POST | `/funds/api/withdrawal` | withDrawal | withdraw |  | yes |
| POST | `/funds/api/withdrawAuditQuery` | queryWithdrawList |  |  |  |
| POST | `/funds/manager/bankList` | bankListnotoken |  | yes |  |
| POST | `/funds/un/getAvailableVipRechargeActivity` | vipRechargeActivity |  | yes |  |
| POST | `/funds/un/getLatestAvailableRechargeActivity` | getLatestAvailableRechargeActivity |  | yes |  |

## game (4)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/game/api/gameContent` | gameContent |  |  |  |
| GET | `/game/un/gameList` | gameList |  | yes |  |
| POST | `/game/un/gamePlayUrl` | getGamePlayUrl |  | yes |  |
| GET | `/game/un/getBetHistory` | gameBetList |  | yes |  |

## group (1)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/group/reportForm` | mcAllList |  | yes |  |

## lottgame (2)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/lottgame/api/bet-detail` | jackpotBetDetail |  |  |  |
| POST | `/lottgame/api/bet-history` | jackpotBetHistory |  |  |  |

## market (6)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/market/api/chat/booking-code/send` | sendBookingCode |  |  |  |
| POST | `/market/api/gg/discuss/ban?id=` | discussBan |  |  |  |
| POST | `/market/api/gg/discuss/comment` | sendComment |  |  |  |
| POST | `/market/api/gg/discuss/del?id=` | delComment |  |  |  |
| POST | `/market/api/gg/discuss/like_toggle?id=` | likeToggle |  |  |  |
| GET | `/market/un/gg/discuss/comments` | comments |  | yes |  |

## notice (24)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/notice/api/bulletWin` | bulletWin |  |  |  |
| POST | `/notice/api/businessMsgRead` | businessMsgRead |  |  |  |
| POST | `/notice/api/count` | msgNum | messageCount |  |  |
| POST | `/notice/api/feedback/send` | feedbackSend |  |  |  |
| POST | `/notice/api/list` | msgList | messageList |  |  |
| POST | `/notice/api/readAlready` | markAllMessageAsRead |  |  |  |
| POST | `/notice/api/toolbar` | queryToolbar |  |  |  |
| POST | `/notice/api/updateStatus` | unpdateState |  |  |  |
| POST | `/notice/api/writeExctionMessage` | increaseWithdrawalLimit |  |  |  |
| POST | `/notice/un/bananerPage/v2` | getBannerPage | banners | yes |  |
| POST | `/notice/un/businessMsgPage` | getBusinessMsgPage |  | yes |  |
| POST | `/notice/un/feedback` | feedback |  | yes |  |
| POST | `/notice/un/gameWinRank` | gameWinRank |  | yes |  |
| POST | `/notice/un/gameWinRank/v2` | gameTotalWinRank | gameWinRank | yes |  |
| GET | `/notice/un/grand/home/list` | getGrandPrizeHomeList | grandPrizeHome | yes |  |
| POST | `/notice/un/hotNews` | getHomeHotNews | hotNews | yes |  |
| POST | `/notice/un/hotNewsPage` | getHotNewsListV2 | hotNewsPage | yes |  |
| POST | `/notice/un/msg/floating` | getFloatingMsg |  | yes |  |
| POST | `/notice/un/packageComp` | getPackageComp |  | yes |  |
| POST | `/notice/un/page` | winMessage |  | yes |  |
| POST | `/notice/un/postback` | adPostBackAPI |  | yes |  |
| POST | `/notice/un/promotionPage` | queryPromotion | promotionPage | yes |  |
| POST | `/notice/un/routeComp` | routeComp |  | yes |  |
| POST | `/notice/un/winnerList` | getWinnerList | winnerList | yes |  |

## opact (2)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| GET | `/opact/un/tmp/v` | getActivityPV |  | yes |  |
| POST | `/opact/un/tmp/v?an=` | setActivityPV |  | yes |  |

## sbc (1)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/sbc/un/pre_create` | multipleCreate |  | yes |  |

## sbt (21)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| GET | `/sbt/api/rec/act/cashback` | getCashbackActAmount |  |  |  |
| GET | `/sbt/api/rec/act/status` | getCashbackActStatus |  |  |  |
| POST | `/sbt/api/rec/create` | betBuilderCreate |  |  |  |
| POST | `/sbt/api/sub/list` | getSbtSubList |  |  |  |
| GET | `/sbt/api/sub/status` | getSbtSubStatus |  |  |  |
| POST | `/sbt/api/sub/subscribe` | sbtSubscribe |  |  |  |
| POST | `/sbt/api/t/cashout` | confirmCashout |  |  | yes |
| POST | `/sbt/api/t/cashout?id=` | cashout |  |  |  |
| GET | `/sbt/api/t/cashout/tickets` | getCashoutList |  |  |  |
| GET | `/sbt/api/t/cashout/tickets_count` | getCashoutCount |  |  |  |
| POST | `/sbt/api/t/create` | ticketCreate | createBetTicket |  | yes |
| POST | `/sbt/api/t/delete` | deleteTickets |  |  | yes |
| GET | `/sbt/api/t/list` | sportBetList | betHistory |  |  |
| GET | `/sbt/api/t/view` | getTicketsInfo | betHistoryDetail |  |  |
| GET | `/sbt/un/api/rec` | getSportsRecommendList |  | yes |  |
| GET | `/sbt/un/api/rec/list` | querySportsRecommendList |  | yes |  |
| GET | `/sbt/un/api/rec/selection` | getBetBuilderSelections |  | yes |  |
| GET | `/sbt/un/api/rec/v2/booking-code` | getBetBuilderList |  | yes |  |
| GET | `/sbt/un/t/booking_code` | bookingCodeInfo |  | yes |  |
| GET | `/sbt/un/t/cfg` | getCfg |  | yes |  |
| GET | `/sbt/un/t/cfg/v2` | queryBetslipConfig |  | yes |  |

## sbu (29)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/sbu/api/m/like` | like |  |  |  |
| GET | `/sbu/api/m/likes` | likeList |  |  |  |
| POST | `/sbu/api/m/unlike` | unLike |  |  |  |
| GET | `/sbu/un/m/categories` | getCountry | categories | yes |  |
| GET | `/sbu/un/m/featured/v2` | queryH5HotSport | featured | yes |  |
| GET | `/sbu/un/m/live/matches` | queryLiveMatch | liveMatches | yes |  |
| GET | `/sbu/un/m/live/search` | queryLiveSearch | searchLive | yes |  |
| GET | `/sbu/un/m/live/sports` | homeLivesMenu | sportsLive | yes |  |
| GET | `/sbu/un/m/live/sports_w_upcoming` | livesMenu | sportsLiveWithUpcoming | yes |  |
| POST | `/sbu/un/m/markets/odds` | queryMarketOdds | marketOdds | yes |  |
| GET | `/sbu/un/m/match` | getMatchDetail | matchDetail | yes |  |
| GET | `/sbu/un/m/matches` | queryOutrightMatches | matches | yes |  |
| GET | `/sbu/un/m/popular/highlights` | queryHighlights | highlights | yes |  |
| GET | `/sbu/un/m/popular/highlights2` | queryHighlights2 |  | yes |  |
| GET | `/sbu/un/m/popular/live` | queryLive | popularLive | yes |  |
| GET | `/sbu/un/m/popular/live/v2` | queryLiveV2 | popularLiveV2 | yes |  |
| GET | `/sbu/un/m/popular/upcoming` | queryUpcoming | popularUpcoming | yes |  |
| GET | `/sbu/un/m/popular/v2/highlights` | queryHighlightsV2 | highlightsV2 | yes |  |
| GET | `/sbu/un/m/pre/matches` | queryMatch | preMatches | yes |  |
| GET | `/sbu/un/m/pre/sports` | sportMenu | sportsPre | yes |  |
| GET | `/sbu/un/m/search` | queryMatchByTeamName | search | yes |  |
| GET | `/sbu/un/m/sports` | normalMenu | sportsAll | yes |  |
| GET | `/sbu/un/m/top` | getTopGame | topGames | yes |  |
| GET | `/sbu/un/m/tournaments` | getTournamentInfo | tournaments | yes |  |
| GET | `/sbu/un/m/tournaments/recommends/v2` | getTournamentRecommend | tournamentsRecommended | yes |  |
| POST | `/sbu/un/m/tournaments/schedule` | getTournamentSchedule | tournamentSchedule | yes |  |
| GET | `/sbu/un/o/categories` | queryCategories |  | yes |  |
| GET | `/sbu/un/o/outright` | queryOutright | outrights | yes |  |
| GET | `/sbu/un/o/sports` | queryOutrightMenu | outrightMenu | yes |  |

## share (10)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/share/api/help` | shareHelp |  |  |  |
| POST | `/share/api/invite/check` | inviteCheck |  |  |  |
| POST | `/share/api/invite/detail` | inviteDetail |  |  |  |
| POST | `/share/api/invite/fin` | inviteFin |  |  |  |
| POST | `/share/api/invite/url` | queryInviteUrl |  |  |  |
| POST | `/share/api/joinShare` | joinShare |  |  |  |
| POST | `/share/api/queryShareRecordDetail` | queryShareRecordDetail |  |  |  |
| POST | `/share/api/queryWinDetail` | queryWinDetail |  |  |  |
| POST | `/share/un/queryShareRecord` | queryShareRecord |  | yes |  |
| POST | `/share/un/winRank` | winRank |  | yes |  |

## spo (4)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/spo/api/cancel` | cancelPreBetOrder |  |  | yes |
| POST | `/spo/api/create` | createPreBetOrder |  |  | yes |
| GET | `/spo/api/list` | getPreBetOrderList |  |  |  |
| GET | `/spo/api/view` | getPreBetOrderDetail |  |  |  |

## sqb-quickbets (1)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| GET | `/sqb-quickbets/api/token` | getSessionToken |  |  |  |

## ssim (7)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/ssim/api/create/v2` | createSimuOrder |  |  | yes |
| GET | `/ssim/api/history/list` | getSimuBetHistory |  |  |  |
| POST | `/ssim/api/ticket/delete` | deleteSimuTickets |  |  |  |
| GET | `/ssim/un/cfg/v2` | getSimConfigV2 |  | yes |  |
| GET | `/ssim/un/odds/config` | getSimuMarketConfig |  | yes |  |
| GET | `/ssim/un/ticket/betslip` | getSimuTicketBetslip |  | yes |  |
| GET | `/ssim/un/win/rank` | getSimuWinRank |  | yes |  |

## user (33)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/user/api/agentApproval` | agentApproval |  |  |  |
| POST | `/user/api/agentLogin` | agentLogin |  |  |  |
| POST | `/user/api/applyAgent` | applyAgent |  |  |  |
| POST | `/user/api/bindMobile` | bindMobile |  |  |  |
| POST | `/user/api/cancellation` | apiCancellation |  |  |  |
| POST | `/user/api/id_verify` | identityAuth |  |  |  |
| POST | `/user/api/logout` | logout | logout |  |  |
| POST | `/user/api/playerCount` | playerCount |  |  |  |
| POST | `/user/api/queryAgentAccountCode` | queryAgentAccountCode |  |  |  |
| POST | `/user/api/queryMarketingTools` | queryMarketingTools |  |  |  |
| POST | `/user/api/queryPlayer` | queryPlayer |  |  |  |
| POST | `/user/api/update` | userUpdate |  |  |  |
| POST | `/user/api/updatePwd` | updatePwd |  |  |  |
| POST | `/user/un/authregister` | authregister |  | yes |  |
| POST | `/user/un/cancellation` | cancellation |  | yes |  |
| POST | `/user/un/checkBindMobile` | checkBindMobile |  | yes |  |
| POST | `/user/un/checkPlayerAccount` | checkPlayerAccount |  | yes |  |
| POST | `/user/un/checkVerificationCode` | checkVerificationCode |  | yes |  |
| POST | `/user/un/getVerificationCode` | mobileNumber |  | yes |  |
| POST | `/user/un/preregister` | preregister |  | yes |  |
| POST | `/user/un/queryPasswordReg` | queryPasswordReg |  | yes |  |
| POST | `/user/un/queryRegion` | queryRegion |  | yes |  |
| POST | `/user/un/reactivate` | accountReactivate |  | yes |  |
| POST | `/user/un/rebindAccount` | rebindAccount |  | yes |  |
| POST | `/user/un/register` | register | register | yes |  |
| POST | `/user/un/retrievePwd` | retrievePwd |  | yes |  |
| POST | `/user/un/self-discipline-release` | selfDisciplineRelease |  | yes |  |
| POST | `/user/un/slideshow` | slideshow |  | yes |  |
| POST | `/user/un/tauth/check` | authLoginByAccountNumber |  | yes |  |
| POST | `/user/un/tauth/login` | authLogin |  | yes |  |
| POST | `/user/un/tauth/pre_auth` | getPalmpayLoginUrl |  | yes |  |
| POST | `/user/un/third/login` | loginThrid |  | yes |  |
| POST | `/user/un/v2/login` | getLogin | login | yes |  |

## virtualgame (8)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/virtualgame/api/bet` | virtualgameBet |  |  | yes |
| GET | `/virtualgame/api/bet_detail` | getBetHistoryLeagueDetail |  |  |  |
| POST | `/virtualgame/api/bet_histories` | virtualgameBetHistories |  |  |  |
| POST | `/virtualgame/api/bet_tax_histories` | getKeBetHistoryLeague |  |  |  |
| POST | `/virtualgame/api/mybets` | getMyBetLeague |  |  |  |
| POST | `/virtualgame/un/agg_tour_info` | virtualgameAggTourInfo | virtualTourInfo | yes |  |
| GET | `/virtualgame/un/qucik_tour_info` | quickTourInfo |  | yes |  |
| GET | `/virtualgame/un/tours` | getTourListLeague | virtualTours | yes |  |

## worldcup (1)

| method | path | operationId | alias | public | write |
|---|---|---|---|---|---|
| POST | `/worldcup/api/af/quiz/invite/fin` | afInviteFin |  |  |  |

