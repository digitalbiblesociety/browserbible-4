#!/usr/bin/env node
/**
 * Repairs the BrowserBible starter pack on disk so it matches what the current
 * LocalTextProvider expects, then re-zips the result for redistribution.
 *
 * The historical pack ships:
 *   content/texts/<TEXT>/html_chapterized/<SECTION>.html
 *   content/texts/<TEXT>/html_chapterized/_/{book,font}.css
 * No info.json per text. No top-level texts.json manifest.
 *
 * The current code expects:
 *   content/texts/<TEXT>/<SECTION>.html
 *   content/texts/<TEXT>/_/{book,font}.css
 *   content/texts/<TEXT>/info.json
 *   content/texts/texts.json
 *
 * Repair steps (idempotent):
 *   1. For each text dir: move html_chapterized/* up one level, remove the
 *      now-empty html_chapterized.
 *   2. Fetch info.json from inscript.bible.cloud for each text.
 *   3. Fetch the global texts.json, filter to the present text ids, save at
 *      the texts dir root.
 *   4. Zip the texts dir into a fresh starter-pack.zip suitable for upload.
 *
 *   node tests/scripts/repair-starter-pack.mjs
 *   SKIP_REZIP=1 node tests/scripts/repair-starter-pack.mjs    (repair only)
 */

import {
  existsSync, readdirSync, statSync, renameSync, rmdirSync, rmSync, writeFileSync, mkdirSync
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const TEXTS_DIR = resolve(REPO_ROOT, 'browserbible/public/content/texts');
const REMOTE_BASE = 'https://inscript.bible.cloud/content/texts';
const OUTPUT_ZIP = resolve(REPO_ROOT, 'starter-pack.zip');

function listTextDirs() {
  if (!existsSync(TEXTS_DIR)) return [];
  return readdirSync(TEXTS_DIR).filter(name => {
    if (name.startsWith('.')) return false;
    if (name === 'README.md') return false;
    if (name === 'texts.json') return false;
    if (name === 'starter-pack.zip') return false;
    const stat = statSync(join(TEXTS_DIR, name));
    return stat.isDirectory();
  });
}

function flattenHtmlChapterized(textDir) {
  const subDir = join(textDir, 'html_chapterized');
  if (!existsSync(subDir)) return { moved: 0, skipped: true };

  const entries = readdirSync(subDir);
  let moved = 0;
  for (const name of entries) {
    const from = join(subDir, name);
    const to = join(textDir, name);
    if (existsSync(to)) {
      // Don't clobber — leaves the conflict in place for manual review.
      console.warn(`  skip (target exists): ${to}`);
      continue;
    }
    renameSync(from, to);
    moved++;
  }
  // Only remove the subdir if it's empty
  if (readdirSync(subDir).length === 0) {
    rmdirSync(subDir);
  }
  return { moved, skipped: false };
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function ensureInfoJson(textId) {
  const target = join(TEXTS_DIR, textId, 'info.json');
  if (existsSync(target)) return { fetched: false };
  const data = await fetchJSON(`${REMOTE_BASE}/${textId}/info.json`);
  writeFileSync(target, JSON.stringify(data, null, 2) + '\n');
  return { fetched: true };
}

async function ensureTextsJson(textIds) {
  const target = join(TEXTS_DIR, 'texts.json');
  const remote = await fetchJSON(`${REMOTE_BASE}/texts.json`);
  const filtered = {
    textIds: [...textIds],
    textInfoData: remote.textInfoData.filter(t => textIds.includes(t.id))
  };
  writeFileSync(target, JSON.stringify(filtered, null, 2) + '\n');
  return { count: filtered.textInfoData.length };
}

function rezip() {
  if (existsSync(OUTPUT_ZIP)) rmSync(OUTPUT_ZIP);
  // -r recursive, -q quiet, -X strip extra macOS metadata, -x exclude system files.
  // Run from inside TEXTS_DIR so the zip's internal paths start at the text id.
  execSync(
    `zip -rqX "${OUTPUT_ZIP}" . -x "*.DS_Store" -x "__MACOSX/*" -x "starter-pack.zip"`,
    { cwd: TEXTS_DIR, stdio: 'inherit' }
  );
}

async function main() {
  if (!existsSync(TEXTS_DIR)) {
    throw new Error(`Texts dir not found: ${TEXTS_DIR}\nRun pnpm fetch-starter-pack first.`);
  }

  const textDirs = listTextDirs();
  if (textDirs.length === 0) {
    throw new Error(`No text directories under ${TEXTS_DIR}.`);
  }
  console.log(`→ Found ${textDirs.length} texts: ${textDirs.join(', ')}`);

  console.log('\n[1/3] Flattening html_chapterized/ subdirs');
  for (const id of textDirs) {
    const result = flattenHtmlChapterized(join(TEXTS_DIR, id));
    console.log(`  ${id}: ${result.skipped ? 'already flat' : `moved ${result.moved} entries`}`);
  }

  console.log('\n[2/3] Fetching info.json per text');
  for (const id of textDirs) {
    try {
      const result = await ensureInfoJson(id);
      console.log(`  ${id}: ${result.fetched ? 'fetched' : 'already present'}`);
    } catch (err) {
      console.warn(`  ${id}: ${err.message}`);
    }
  }

  console.log('\n[3/3] Fetching and filtering texts.json manifest');
  const result = await ensureTextsJson(textDirs);
  console.log(`  wrote ${result.count} entries to texts.json`);

  if (process.env.SKIP_REZIP === '1') {
    console.log('\nSKIP_REZIP=1 — skipping zip step.');
    return;
  }

  console.log('\n[4/4] Re-zipping starter pack');
  rezip();
  const sizeBytes = statSync(OUTPUT_ZIP).size;
  console.log(`  wrote ${OUTPUT_ZIP}`);
  console.log(`  size: ${(sizeBytes / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
