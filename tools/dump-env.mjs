/**
 * Shared paths for the dump tooling.
 *
 * Everything is derived from the repo root so the tools work wherever the repo is checked out.
 * The captured dumps are large and fully regenerable, so they live in .dump/ which is git-ignored.
 * Override the location with SPORTYBET_DUMP_DIR.
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
export const DUMP_DIR = process.env.SPORTYBET_DUMP_DIR || join(ROOT, '.dump');
export const OUT = join(DUMP_DIR, 'dumps');
export const ROUTES_FILE = join(DUMP_DIR, 'routes.json');

/** The session written by src/login.mjs; the crawl uses it for the account routes. */
export const SESSION_FILE = join(ROOT, '.sportybet-cookies.json');

export const SITE = 'https://www.sportybet.com';
