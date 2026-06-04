#!/usr/bin/env node
/**
 * Downloads and extracts the BrowserBible starter pack of Bible texts into
 * browserbible/public/content/texts/ if not already populated.
 *
 * Source: a public GitHub Release asset (~95MB, 17 Bibles). GitHub's asset CDN
 * serves datacenter IPs (incl. GitHub Actions runners) without bot-blocking,
 * unlike the Cloudflare-fronted bibles.dbs.org which 403s from CI.
 *
 * Override the source with STARTER_PACK_URL (e.g. to use the dbs.org CDN
 * locally). Idempotent: skips if any text directory already exists; FORCE=1
 * re-downloads.
 *
 *   node tests/scripts/fetch-starter-pack.mjs
 *   FORCE=1 node tests/scripts/fetch-starter-pack.mjs
 *   STARTER_PACK_URL=https://… node tests/scripts/fetch-starter-pack.mjs
 *
 * Publishing/updating the asset (one-time, requires repo write access):
 *   gh release create starter-pack-v1 starter-pack.zip \
 *     -R digitalbiblesociety/browserbible-4 -t "Starter pack" \
 *     -n "Bible texts for e2e tests"
 *   # to replace later: gh release upload starter-pack-v1 starter-pack.zip --clobber
 */

import { existsSync, mkdirSync, readdirSync, createWriteStream, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const TEXTS_DIR = resolve(REPO_ROOT, 'browserbible/public/content/texts');
const STARTER_PACK_URL =
  process.env.STARTER_PACK_URL ||
  'https://github.com/digitalbiblesociety/browserbible-4/releases/download/starter-pack-v1/starter-pack.zip';
const ZIP_PATH = resolve(TEXTS_DIR, 'starter-pack.zip');

function hasExistingTexts() {
  if (!existsSync(TEXTS_DIR)) return false;
  return readdirSync(TEXTS_DIR).some(name => {
    if (name === 'README.md') return false;
    if (name === 'starter-pack.zip') return false;
    return true;
  });
}

async function downloadZip() {
  console.log(`→ Downloading ${STARTER_PACK_URL}`);
  const response = await fetch(STARTER_PACK_URL, {
    headers: { 'User-Agent': 'browserbible-ci', Accept: 'application/octet-stream' },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `HTTP ${response.status} ${response.statusText} fetching ${STARTER_PACK_URL}` +
        (detail ? `\n${detail.slice(0, 300)}` : '')
    );
  }
  mkdirSync(TEXTS_DIR, { recursive: true });
  await pipeline(Readable.fromWeb(response.body), createWriteStream(ZIP_PATH));
  console.log(`→ Saved ${ZIP_PATH}`);
}

function extractZip() {
  console.log(`→ Extracting into ${TEXTS_DIR}`);
  execSync(`unzip -q -o "${ZIP_PATH}" -d "${TEXTS_DIR}"`, { stdio: 'inherit' });
  rmSync(ZIP_PATH);
}

export async function ensureStarterPack({ force = false } = {}) {
  if (!force && hasExistingTexts()) {
    return { downloaded: false, reason: 'already populated' };
  }
  await downloadZip();
  extractZip();
  return { downloaded: true };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.env.FORCE === '1';
  const result = await ensureStarterPack({ force });
  if (result.downloaded) {
    console.log('Starter pack ready.');
  } else {
    console.log(`Skipped: ${result.reason}.`);
  }
}
