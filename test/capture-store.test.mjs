import { test } from "node:test";
import assert from "node:assert";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "cap-"));
const file = join(dir, "capture.json");
writeFileSync(
  file,
  JSON.stringify({
    "/api/a": { json: { code: 0, data: [1, 2] } },
    "/api/b?pageNum=1": { json: { code: 0, data: "one" } },
    "/api/b?pageNum=2": { json: { code: 0, data: "two" } },
    "/api/plain": { code: 0, data: "bare" },
    "/api/html": { json: "<!doctype html><title>403</title>" },
  }),
);
process.env.ILOTBET_CAPTURE = file;

const { responseFromCapture, captureInfo } = await import("../src/ilotbet/capture-store.mjs");

test("returns the captured body for an exact path", () => {
  assert.deepEqual(responseFromCapture("/api/a"), { code: 0, data: [1, 2] });
});

test("a capture value written without the json wrapper is understood", () => {
  assert.deepEqual(responseFromCapture("/api/plain"), { code: 0, data: "bare" });
});

test("the query string picks between answers for one path", () => {
  assert.equal(responseFromCapture("/api/b?pageNum=2").data, "two");
  assert.equal(responseFromCapture("/api/b?pageNum=1").data, "one");
});

test("an uncaptured path is a miss, so the caller can fall back", () => {
  assert.equal(responseFromCapture("/api/nope"), null);
});

test("an HTML body is a miss rather than something to serve", () => {
  assert.equal(responseFromCapture("/api/html"), null);
});

test("the info line reports how many routes the capture holds", () => {
  assert.equal(captureInfo().routes, 5);
});
