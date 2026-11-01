/**
 * Live smoke test: starts the server, calls one public and one account endpoint, and reports
 * whether each answered. Needs a session for the account half. Run the server yourself, or let
 * this script start one on PORT (default 3099).
 *
 *   node test/smoke.mjs            # starts its own server
 *   BASE=http://localhost:3000 node test/smoke.mjs   # tests a running one
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = process.env.PORT || 3099;
let server;
let base = process.env.BASE;

async function waitForServer(url, tries = 30) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`${url}/health`);
      if (r.ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

async function check(name, path, { expectAuth = false } = {}) {
  const res = await fetch(`${base}${path}`);
  const body = await res.json().catch(() => ({}));
  const ok = expectAuth ? res.status === 200 || res.status === 401 : res.status === 200;
  const detail = body.bizCode !== undefined ? `bizCode=${body.bizCode}` : body.error || res.status;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(28)} HTTP ${res.status}  ${detail}`);
  return ok;
}

try {
  if (!base) {
    base = `http://localhost:${PORT}`;
    server = spawn("node", [join(ROOT, "src", "server.mjs")], { env: { ...process.env, PORT }, stdio: "ignore" });
    if (!(await waitForServer(base))) throw new Error("server did not start");
  }

  const health = await (await fetch(`${base}/health`)).json();
  console.log(`session: ${health.session ? "signed in" : "none"} (${health.cookies} cookies), ${health.endpoints} endpoints\n`);

  const results = [];
  results.push(await check("getSports (public)", "/api/ng/factsCenter/sportList?timeline=24&productId=1&option=1"));
  results.push(await check("getUpcomingEvents (public)", "/api/ng/factsCenter/pcUpcomingEvents?sportId=sr%3Asport%3A1&marketId=1&pageSize=3&pageNum=1&option=1"));
  results.push(await check("getEvent (public)", "/api/ng/factsCenter/event?sportId=sr%3Asport%3A1&eventId=sr%3Amatch%3A68931584"));
  results.push(await check("getAccountInfo (account)", "/api/ng/patron/account/info", { expectAuth: true }));
  results.push(await check("getBalance (account)", "/api/ng/pocket/v1/finAccs/finAcc/userBal/NGN", { expectAuth: true }));

  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exitCode = failed ? 1 : 0;
} catch (e) {
  console.error("smoke failed:", e.message);
  process.exitCode = 1;
} finally {
  if (server) server.kill();
}
