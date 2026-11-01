#!/usr/bin/env node
/**
 * Offline tests for the iLOTBET UI mock and proxy.
 *
 *   npm test
 *
 * The mock is what makes the UI dump render, so its shape is worth pinning: the app's components
 * read these exact keys, and a wrong one shows up as an empty section rather than an error.
 * Nothing here touches the network - the live proxy is exercised by `npm run ui:ilotbet`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { responseFor, liveMatches, LIVE_SPORTS, BETSLIP_CONFIG, VIRTUAL } from "../src/ilotbet/ui-mock.mjs";

test("the envelope is what the app checks for", () => {
  const r = responseFor("/api/sbu/un/m/featured/v2?marketId=1");
  assert.equal(r.code, 0);
  assert.equal(typeof r.msg, "string");
  assert.ok("data" in r);
});

test("featured matches carry the fields the match card renders", () => {
  const [m] = responseFor("/api/sbu/un/m/featured/v2").data;
  for (const k of ["matchId", "sportId", "tournamentName", "tourFullNameMap", "homeName", "awayName", "eventStatus", "preOrLive", "periodDesc"]) {
    assert.ok(k in m, `match is missing ${k}`);
  }
  assert.equal(m.homeName, "Arsenal");
  assert.equal(m.awayName, "Chelsea");
  assert.equal(m.tourFullNameMap[m.tourInfoId], m.tournamentName);
  // The card maps over the outcomes to draw the 1X2 prices.
  assert.equal(m.outcomes.length, 3);
  for (const o of m.outcomes) assert.ok(o.odds && o.outcomeId);
});

test("live vs pre matches differ in the fields the filter reads", () => {
  const live = responseFor("/api/sbu/un/m/live/sports_w_upcoming").data.matchList[0];
  const pre = responseFor("/api/sbu/un/m/pre/sports").data.matchList[0];
  assert.equal(live.eventStatus, "live");
  assert.equal(pre.eventStatus, "pre");
  assert.equal(pre.homeScore, null);
});

test("the live sport menu is an array with per-sport counts", () => {
  const d = responseFor("/api/sbu/un/m/live/sports").data;
  assert.ok(Array.isArray(d));
  assert.ok(d.every((s) => typeof s.sportId === "string" && typeof s.matchCount === "number"));
});

test("hot news is an array - the component slices it", () => {
  const d = responseFor("/api/notice/un/hotNews").data;
  assert.ok(Array.isArray(d));
  assert.ok(d.length >= 1);
  assert.ok("title" in d[0]);
});

test("grand-prize winners carry the ticker's field names", () => {
  const d = responseFor("/api/notice/un/grand/home/list").data;
  assert.ok(Array.isArray(d));
  for (const k of ["id", "pn", "money", "time"]) assert.ok(k in d[0], `winner is missing ${k}`);
});

test("the betslip config has the per-type maxSelNum the slip reads", () => {
  const d = responseFor("/api/sbt/un/t/cfg/v2").data.betslip;
  assert.equal(d.maxSelNum, BETSLIP_CONFIG.maxSelNum);
  for (const t of ["single", "multiple", "system"]) assert.equal(typeof d[t].maxSelNum, "number");
});

test("virtual tours are keyed by tour id and carry rounds", () => {
  const d = responseFor("/api/virtualgame/un/agg_tour_info").data;
  assert.equal(Object.keys(d)[0], "1");
  assert.ok(Array.isArray(d["1"].roundOfMatches));
  assert.equal(typeof d["1"].roundStage, "string");
  assert.ok(VIRTUAL["1"].roundOfMatches.length >= 1);
});

test("an unknown path answers success with no data rather than failing", () => {
  const r = responseFor("/api/something/unknown");
  assert.equal(r.code, 0);
  assert.equal(r.data, null);
});

test("the query string never changes the result", () => {
  const a = responseFor("/api/sbu/un/m/featured/v2");
  const b = responseFor("/api/sbu/un/m/featured/v2?platform=4&marketId=1&deviceCode=xyz");
  assert.deepEqual(Object.keys(a.data[0]).sort(), Object.keys(b.data[0]).sort());
});

test("liveMatches honours the requested count", () => {
  assert.equal(liveMatches(8).length, 8);
  assert.equal(liveMatches(3).length, 3);
});
