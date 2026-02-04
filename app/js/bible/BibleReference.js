/**
 * Bible Reference Parser
 * Parses human-readable references (e.g., "John 3:16") and short codes (e.g., "JN3_16")
 */

import { BOOK_DATA, DEFAULT_BIBLE } from './BibleData.js';

const shortCodeRegex = /^\w{2}\d{1,3}(_\d{1,3})?$/;
const bookNameIndex = Object.entries(BOOK_DATA)
  .flatMap(([bid, data]) => [
    { name: bid.toLowerCase(), bid },
    ...Object.values(data.names).flat().map(n => ({ name: String(n).toLowerCase(), bid }))
  ])
  .sort((a, b) => b.name.length - a.name.length);

/**
 * Parse a Bible reference string or create a reference from components
 * @param {string} input - Reference string ("John 3:16") or short code ("JN3_16")
 * @param {string} [language='eng'] - Language code for book names
 * @returns {Object|null} Reference object with bookid, chapter1, verse1, etc.
 *
 * @example Reference("John 3:16") // => { bookid: "JN", chapter1: 3, verse1: 16, ... }
 * @example Reference("JN3_16") // => { bookid: "JN", chapter1: 3, verse1: 16, ... }
 * @example Reference("JN", 3, 16) // => { bookid: "JN", chapter1: 3, verse1: 16, ... }
 */
export function Reference(...args) {
  if (typeof args[0] === 'string' && typeof args[1] === 'number') {
    const [bookid, chapter1, verse1 = -1, chapter2 = -1, verse2 = -1, language = 'eng'] = args;
    return createRef(bookid, chapter1, verse1, chapter2, verse2, language);
  }

  if (args.length > 2 || typeof args[0] !== 'string' || typeof args[1] === 'number') return null;

  const input = String(args[0]);
  const language = args[1] || 'eng';

  if (shortCodeRegex.test(input)) {
    const { bookid, chapter1, verse1 } = parseShortCode(input);
    return createRef(bookid, chapter1, verse1, -1, -1, language);
  }

  const match = findBook(input.toLowerCase());
  if (!match) return null;

  const remainder = match.remainder.replace(/^_/, '');
  const parsed = parseChapterVerse(remainder);
  const clamped = normalizeAndClamp(match.bookid, parsed.chapter1, parsed.verse1, parsed.chapter2, parsed.verse2);

  return createRef(match.bookid, clamped.chapter1, clamped.verse1, clamped.chapter2, clamped.verse2, language);
}

function parseShortCode(input) {
  const parts = input.split('_');
  return {
    bookid: parts[0].substring(0, 2).toUpperCase(),
    chapter1: parseInt(parts[0].substring(2), 10),
    verse1: parts.length > 1 ? parseInt(parts[1], 10) : -1
  };
}

function findBook(input) {
  for (const { name, bid } of bookNameIndex) {
    if (input.startsWith(name) && /[\d.\s]|$/.test(input[name.length] || '')) {
      return { bookid: bid, remainder: input.substring(name.length) };
    }
  }
  return null;
}

function parseChapterVerse(input) {
  const result = { chapter1: -1, verse1: -1, chapter2: -1, verse2: -1 };
  const slots = ['chapter1', 'verse1', 'chapter2', 'verse2'];
  let slot = 0, inNumber = false, num = '';

  for (const c of input) {
    const isDigit = c >= '0' && c <= '9';
    if (!isDigit) {
      if (inNumber) {
        if (c === '-') slot = 2;
        else if (':,._'.includes(c)) slot |= 1; // 0→1, 2→3
      }
      num = '';
      inNumber = false;
      continue;
    }
    inNumber = true;
    num += c;
    result[slots[slot]] = parseInt(num);
  }
  return result;
}

function normalizeAndClamp(bookid, c1, v1, c2, v2) {
  // "1:1-2" → verse range within same chapter
  if (c1 > 0 && v1 > 0 && c2 > 0 && v2 <= 0) { v2 = c2; c2 = c1; }
  // "1-2:5" → chapter 1 verse 1 through chapter 2 verse 5
  if (c1 > 0 && v1 <= 0 && c2 > 0 && v2 > 0) v1 = 1;

  const chapters = BOOK_DATA[bookid]?.chapters;
  if (c1 === -1) c1 = 1;
  else if (chapters?.length && c1 > chapters.length) { c1 = chapters.length; if (v1 > 0) v1 = 1; }
  if (chapters?.length && v1 > chapters[c1 - 1]) v1 = chapters[c1 - 1];
  if (v2 <= v1) { c2 = -1; v2 = -1; }

  return { chapter1: c1, verse1: v1, chapter2: c2, verse2: v2 };
}

function createRef(bookid, chapter1, verse1, chapter2, verse2, language) {
  return {
    bookid, chapter1, verse1, chapter2, verse2, language,
    bookList: DEFAULT_BIBLE,
    isValid() { return this.bookid != null && this.chapter1 > 0; },
    toSection() {
      if (this.bookid == null) return 'invalid';
      const versePart = this.verse1 > 0 ? '_' + this.verse1 : '';
      return this.bookid + this.chapter1 + versePart;
    },
    toString() {
      if (this.bookid == null) return '';
      const bookData = BOOK_DATA[this.bookid];
      const bookName = bookData?.names?.[this.language]?.[0] ?? bookData?.names?.eng?.[0] ?? this.bookid;
      const crossChapter = this.chapter2 > 0 && this.chapter2 !== this.chapter1;
      let ref = `${this.chapter1}`;
      if (this.verse1 > 0) ref += `:${this.verse1}`;
      if (crossChapter) ref += this.verse2 > 0 ? `-${this.chapter2}:${this.verse2}` : `-${this.chapter2}`;
      else if (this.verse2 > 0 && this.verse2 !== this.verse1) ref += `-${this.verse2}`;
      return `${bookName} ${ref}`;
    }
  };
}

export default Reference;
