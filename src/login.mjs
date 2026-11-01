#!/usr/bin/env node
/**
 * Log in to SportyBet and save the session cookies to .sportybet-cookies.json.
 *
 * Two modes:
 *   npm run login                      drive a headless browser with SPORTYBET_PHONE / SPORTYBET_PASSWORD
 *   npm run login -- --cookies <file>  import a cookies.txt / JSON export from a signed-in browser
 *
 * The session file is git-ignored and never sent anywhere. The generator and server read it
 * through src/client.mjs, so logging in once is enough for both.
 *
 * Env: SPORTYBET_PHONE, SPORTYBET_PASSWORD, SPORTYBET_COUNTRY (default ng),
 *      SPORTYBET_LOGIN_URL (default https://www.sportybet.com/{country}/),
 *      CHROMIUM_PATH (default: auto-detect, then /usr/bin/chromium).
 */

import { writeFileSync, chmodSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { COUNTRY } from "./catalog.mjs";
import { SESSION_FILE } from "./client.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);

function argValue(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}

function writeSession(cookies) {
  mkdirSync(dirname(SESSION_FILE), { recursive: true });
  writeFileSync(SESSION_FILE, JSON.stringify(cookies, null, 0), { mode: 0o600 });
  chmodSync(SESSION_FILE, 0o600);
  const names = cookies.map((c) => c.name);
  process.stderr.write(
    `Saved ${cookies.length} cookies to ${SESSION_FILE}\n` +
      `Session cookies present: ${names.filter((n) => /token|userId|userCert|usrId/i.test(n)).join(", ") || "none"}\n`,
  );
}

/** Import a cookies.txt (Netscape) or JSON export. */
function importFromFile(file) {
  const text = readFileSync(file, "utf8").trim();
  let cookies;
  if (text.startsWith("[") || text.startsWith("{")) {
    const parsed = JSON.parse(text);
    cookies = Array.isArray(parsed) ? parsed : parsed.cookies || [];
    cookies = cookies.map((c) => ({
      name: c.name,
      value: String(c.value),
      domain: c.domain || ".sportybet.com",
      path: c.path || "/",
      secure: c.secure ?? true,
      httpOnly: c.httpOnly ?? false,
      expires: c.expirationDate || c.expires || -1,
    }));
  } else {
    cookies = text
      .split("\n")
      .map((l) => l.trimEnd())
      .filter((l) => l && (!l.startsWith("#") || l.startsWith("#HttpOnly_")))
      .map((l) => l.split("\t"))
      .filter((f) => f.length >= 7)
      .map((f) => ({
        name: f[5],
        value: f[6],
        domain: f[0].replace(/^#HttpOnly_/, ""),
        path: f[2] || "/",
        secure: (f[3] || "").toUpperCase() === "TRUE",
        httpOnly: f[0].startsWith("#HttpOnly_"),
        expires: Number(f[4]) || -1,
      }));
  }
  if (!cookies.length) throw new Error(`no cookies found in ${file}`);
  writeSession(cookies);
}

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const candidates = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/opt/google/chrome/chrome",
    "/usr/bin/brave-browser",
    "/usr/bin/microsoft-edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  return candidates.find((p) => existsSync(p));
}

async function browserLogin() {
  const phone = process.env.SPORTYBET_PHONE;
  const password = process.env.SPORTYBET_PASSWORD;
  if (!phone || !password) {
    throw new Error("set SPORTYBET_PHONE and SPORTYBET_PASSWORD, or pass --cookies <file>");
  }
  const bin = findChromium();
  if (!bin) throw new Error("no Chromium browser found; set CHROMIUM_PATH, or pass --cookies <file>");

  const { chromium } = await import("playwright-core");
  const loginUrl = process.env.SPORTYBET_LOGIN_URL || `https://www.sportybet.com/${COUNTRY}/`;
  const browser = await chromium.launch({ executablePath: bin, headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  try {
    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    });
    const page = await ctx.newPage();
    await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(4000);
    await page.fill('input[name="phone"]', phone);
    await page.fill('input[name="psd"]', password);
    await page.click('button[name="logIn"]');
    await page.waitForTimeout(8000);

    const cookies = await ctx.cookies();
    const signedIn = cookies.some((c) => ["accessToken", "userId", "userCert"].includes(c.name));
    if (!signedIn) {
      throw new Error(
        "login did not produce a session. The account may need an OTP or a captcha; sign in in a browser and use --cookies <file>.",
      );
    }
    writeSession(cookies);
  } finally {
    await browser.close();
  }
}

const cookieFile = argValue("--cookies");
try {
  if (cookieFile) importFromFile(cookieFile);
  else await browserLogin();
} catch (e) {
  process.stderr.write(`login failed: ${e.message}\n`);
  process.exit(1);
}
