#!/usr/bin/env node
/**
 * Downloads and extracts the BrowserBible starter pack of Bible texts into
 * browserbible/public/content/texts/ if not already populated.
 *
 * URL: https://bibles.dbs.org/_assets/starter-pack.zip (~95MB, 17 Bibles)
 *
 * Idempotent: skips if any text directory already exists. Set FORCE=1 to
 * re-download.
 *
 *   node tests/scripts/fetch-starter-pack.mjs
 *   FORCE=1 node tests/scripts/fetch-starter-pack.mjs
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
const STARTER_PACK_URL = 'https://bibles.dbs.org/_assets/starter-pack.zip';
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
  const response = await fetch(STARTER_PACK_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
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
