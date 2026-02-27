/**
 * DBS Audio Text Provider
 * Registers DBS audio Bibles as selectable entries in the AudioWindow version list.
 * Entries have hasText:false (excluded from Bible text windows) and hasAudio:true
 * (included in AudioWindow). Also annotates existing text entries that have DBS audio.
 */

import { getConfig } from '../core/config.js';
import { getTextInfoData } from './TextLoader.js';
import { OT_BOOKS, NT_BOOKS, BOOK_DATA } from '../bible/BibleData.js';

const providerName = 'dbs-audio';

let indexCache = null;

function dbsNumToCode(num) {
  const n = parseInt(num, 10);
  if (n >= 1 && n <= 39) return OT_BOOKS[n - 1];
  if (n >= 40 && n <= 66) return NT_BOOKS[n - 40];
  return null;
}

async function loadIndex() {
  if (indexCache) return indexCache;

  const config = getConfig();
  const baseUrl = config.dbsAudioUrl || 'https://audio.dbs.org';

  try {
    const r = await fetch(`${baseUrl}/index.json`);
    if (!r.ok) return [];
    indexCache = await r.json();
    return indexCache;
  } catch {
    return [];
  }
}

export function getTextManifest(callback) {
  const config = getConfig();
  if (!config.dbsAudioEnabled) {
    callback(null);
    return;
  }

  loadIndex().then(index => {
    if (!index || !index.length) {
      callback(null);
      return;
    }

    // Annotate existing text entries that have matching DBS audio
    const existingEntries = getTextInfoData() || [];
    const existingIds = new Set(existingEntries.map(t => t.id));

    const abbrSet = new Set(index.map(e => e.abbr));
    for (const entry of existingEntries) {
      if (abbrSet.has(entry.id) || abbrSet.has(entry.abbr)) {
        entry.hasAudio = true;
      }
    }

    // Create entries for audio Bibles that don't already have text entries
    const existingAbbrs = new Set(existingEntries.map(t => t.abbr).filter(Boolean));
    const newEntries = index
      .filter(e => e.abbr && !existingIds.has(e.abbr) && !existingAbbrs.has(e.abbr))
      .map(e => ({
        type: 'bible',
        id: e.abbr,
        name: e.tt || e.abbr,
        nameEnglish: e.tt || e.abbr,
        title: e.tt || e.abbr,
        abbr: e.abbr,
        lang: e.iso || '',
        langName: e.ln || '',
        langNameEnglish: e.ln || '',
        hasText: false,
        hasAudio: true,
        _dbsAudioId: e.id
      }));

    callback(newEntries);
  });
}

export function getTextInfo(textid, callback) {
  const config = getConfig();
  const baseUrl = config.dbsAudioUrl || 'https://audio.dbs.org';

  loadIndex().then(async (index) => {
    const entry = index.find(e => e.abbr === textid);
    if (!entry) {
      callback(null);
      return;
    }

    try {
      const r = await fetch(`${baseUrl}/${entry.id}/index.txt`);
      if (!r.ok) {
        callback(null);
        return;
      }

      const text = await r.text();
      const lines = text.trim().split('\n');

      const divisions = [];
      const sections = [];
      const divisionNames = [];
      const seenBooks = new Set();

      for (const line of lines) {
        const match = line.trim().match(/^(\d+)_(.+?)_(\d+)\.mp3$/);
        if (!match) continue;

        const [, dbsNum, , chapterStr] = match;
        const code = dbsNumToCode(dbsNum);
        if (!code) continue;

        const chapter = parseInt(chapterStr, 10);

        if (!seenBooks.has(code)) {
          seenBooks.add(code);
          divisions.push(code);
          divisionNames.push(BOOK_DATA[code]?.name || code);
        }

        sections.push(`${code}${chapter}`);
      }

      callback({
        type: 'bible',
        id: textid,
        name: entry.tt || textid,
        nameEnglish: entry.tt || textid,
        title: entry.tt || textid,
        abbr: entry.abbr,
        lang: entry.iso || '',
        langName: entry.ln || '',
        langNameEnglish: entry.ln || '',
        hasText: false,
        hasAudio: true,
        divisions,
        divisionNames,
        sections,
        _dbsAudioId: entry.id
      });
    } catch {
      callback(null);
    }
  });
}

export function loadSection(textid, sectionid, callback) {
  callback(null);
}

export const DbsAudioTextProvider = {
  name: providerName,
  getTextManifest,
  getTextInfo,
  loadSection
};

export default DbsAudioTextProvider;
