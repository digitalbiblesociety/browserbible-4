/**
 * Verse-reference detection for note content, built on the @verse-detection
 * workspace package (no network involved). Shared by the editor's reference
 * chips and the print module.
 */

import { createVerseDetector } from '@verse-detection/VerseDetectionPlugin.js';
import { BOOK_CODES } from '@verse-detection/BookCodes.js';

let _detector = null;

function getDetector() {
  if (!_detector) _detector = createVerseDetector();
  return _detector;
}

/**
 * Map a detected (book, reference) pair to the app's location ids.
 * @param {string} book - Canonical book name from the verse detector
 * @param {string} reference - Chapter[:verse[-endVerse]] string, e.g. "3:16-18"
 * @returns {{sectionid: string, fragmentid: string, startVerse: number|null, endVerse: number|null}|null}
 */
export function refToLocation(book, reference) {
  const bookCode = BOOK_CODES[book];
  if (!bookCode) return null;

  const ref = String(reference);
  const chapterMatch = ref.match(/^(\d+)/);
  if (!chapterMatch) return null;

  const sectionid = `${bookCode}${chapterMatch[1]}`;
  const verseMatch = ref.match(/:(\d+)/);
  const endVerseMatch = ref.match(/:(\d+)\s*[-–—]\s*(\d+)/);

  const startVerse = verseMatch ? parseInt(verseMatch[1], 10) : null;
  const endVerse = endVerseMatch ? parseInt(endVerseMatch[2], 10) : startVerse;

  return {
    sectionid,
    fragmentid: startVerse ? `${sectionid}_${startVerse}` : sectionid,
    startVerse,
    endVerse
  };
}

/**
 * Detect Bible references in plain text, mapped to app locations and deduped.
 * @returns {Array<{label: string, sectionid: string, fragmentid: string, startVerse: number|null, endVerse: number|null}>}
 */
export function detectReferences(plainText) {
  if (!plainText) return [];

  let verses;
  try {
    verses = getDetector().detectVerses(plainText);
  } catch (err) {
    console.error('[NotesWindow] Verse detection failed:', err);
    return [];
  }

  const results = [];
  const seen = new Set();
  for (const verse of verses) {
    const loc = refToLocation(verse.book, verse.reference);
    if (!loc || seen.has(loc.fragmentid)) continue;
    seen.add(loc.fragmentid);
    results.push({
      label: `${verse.book} ${verse.reference}`,
      ...loc
    });
  }
  return results;
}
