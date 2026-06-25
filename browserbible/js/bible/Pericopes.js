/**
 * Pericopes
 * Section/passage titles ("pericopes") keyed to Bible references.
 *
 * Source data lives in pericopesData.js as `reference: title` pairs, where
 * the reference is the internal 2-char book shortCode followed by
 * `chapter.verse` (e.g. `S116.14` = 1 Samuel 16:14, `GN1.1` = Genesis 1:1).
 */

import { PERICOPE_DATA } from './pericopesData.js';
import { BOOK_DATA } from './BibleData.js';

/**
 * Parse the raw `reference: title` pairs into navigable pericope records.
 * @returns {Array<{bookid:string, sectionid:string, fragmentid:string, chapter:number, verse:number, title:string}>}
 */
function parsePericopes(rows) {
  const out = [];

  for (const [ref, title] of Object.entries(rows)) {
    if (!ref || !title) continue;

    // Book id is always the first two characters (numbered books use a
    // digit in the code, e.g. S1, K2, R1), the remainder is chapter.verse.
    const bookid = ref.slice(0, 2);
    if (!BOOK_DATA[bookid]) continue;

    const rest = ref.slice(2);
    const dot = rest.indexOf('.');
    const chapter = parseInt(dot === -1 ? rest : rest.slice(0, dot), 10);
    const verse = dot === -1 ? 1 : parseInt(rest.slice(dot + 1), 10) || 1;
    if (!chapter) continue;

    const sectionid = bookid + chapter;
    out.push({
      bookid,
      sectionid,
      fragmentid: sectionid + '_' + verse,
      chapter,
      verse,
      title,
    });
  }

  return out;
}

/** All pericopes in source order (canonical book/chapter/verse order). */
const PERICOPES = parsePericopes(PERICOPE_DATA);

/**
 * Group pericopes by book id, preserving canonical book order.
 * @returns {Array<{bookid:string, pericopes:Array}>}
 */
export function getPericopesByBook() {
  const groups = new Map();
  for (const p of PERICOPES) {
    if (!groups.has(p.bookid)) groups.set(p.bookid, []);
    groups.get(p.bookid).push(p);
  }
  return [...groups.entries()]
    .map(([bookid, pericopes]) => ({ bookid, pericopes }))
    .sort((a, b) => (BOOK_DATA[a.bookid]?.sortOrder ?? 999) - (BOOK_DATA[b.bookid]?.sortOrder ?? 999));
}
