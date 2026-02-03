import { BOOK_DATA, DEFAULT_BIBLE } from './BibleData.js';

const shortCodeRegex = /^\w{2}\d{1,3}(_\d{1,3})?$/;
const bookNameIndex = Object.entries(BOOK_DATA)
  .flatMap(([bid, data]) => [
    { name: bid.toLowerCase(), bid },
    ...Object.values(data.names).flat().map(n => ({ name: String(n).toLowerCase(), bid }))
  ])
  .sort((a, b) => b.name.length - a.name.length);

export function Reference(...args) {
  let bookid,
    chapter1 = -1,
    verse1 = -1,
    chapter2 = -1,
    verse2 = -1,
    language = 'eng';

  // Direct construction: Reference(bookid, chapter, verse, ...)
  if (typeof args[0] === 'string' && typeof args[1] === 'number') {
    [bookid, chapter1, verse1 = -1, chapter2 = -1, verse2 = -1, language = 'eng'] = args;
    return createRef();
  }

  // Must be string parsing mode
  if (args.length > 2 || typeof args[0] !== 'string' || typeof args[1] === 'number') {
    return null;
  }

  let input = String(args[0]);
  language = args[1] || 'eng';

  // Handle short codes like "GN1" or "GN1_1"
  if (shortCodeRegex.test(input)) {
    const parts = input.split('_');
    bookid = parts[0].substring(0, 2).toUpperCase();
    chapter1 = parseInt(parts[0].substring(2), 10);
    if (parts.length > 1) verse1 = parseInt(parts[1], 10);
    return createRef();
  }

  input = input.toLowerCase();

  // Find book by ID or name (index is sorted longest-first for greedy matching)
  for (const { name, bid } of bookNameIndex) {
    if (input.startsWith(name) && /[\d.\s]|$/.test(input[name.length] || '')) {
      bookid = bid;
      input = input.substring(name.length);
      break;
    }
  }

  if (bookid == null) return null;

  // Strip leading underscore
  if (input[0] === '_') input = input.substring(1);

  // Parse chapter:verse-chapter:verse
  let afterRange = false,
    afterSeparator = false,
    startedNumber = false,
    currentNumber = '';

  for (const c of input) {
    if (c === ' ' || isNaN(c)) {
      if (!startedNumber) continue;
      if (c === '-') {
        afterRange = true;
        afterSeparator = false;
      } else if (':,._'.includes(c)) {
        afterSeparator = true;
      }
      currentNumber = '';
      startedNumber = false;
      continue;
    }

    startedNumber = true;
    currentNumber += c;
    const num = parseInt(currentNumber);

    if (afterSeparator) {
      if (afterRange) verse2 = num;
      else verse1 = num;
    } else {
      if (afterRange) chapter2 = num;
      else chapter1 = num;
    }
  }

  // Normalize "1:1-2" → verse range within same chapter
  if (chapter1 > 0 && verse1 > 0 && chapter2 > 0 && verse2 <= 0) {
    verse2 = chapter2;
    chapter2 = chapter1;
  }

  // Normalize "1-2:5" → chapter 1 verse 1 through chapter 2 verse 5
  if (chapter1 > 0 && verse1 <= 0 && chapter2 > 0 && verse2 > 0) {
    verse1 = 1;
  }

  // Validate/clamp chapter
  const chapters = BOOK_DATA[bookid].chapters;
  if (chapter1 === -1) {
    chapter1 = 1;
  } else if (chapters?.length > 0 && chapter1 > chapters.length) {
    chapter1 = chapters.length;
    if (verse1 > 0) verse1 = 1;
  }

  // Validate/clamp verse
  if (chapters?.length > 0 && verse1 > chapters[chapter1 - 1]) {
    verse1 = chapters[chapter1 - 1];
  }

  // Clear invalid range
  if (verse2 <= verse1) {
    chapter2 = -1;
    verse2 = -1;
  }

  return createRef();

  function createRef() {
    return {
      bookid,
      chapter1,
      verse1,
      chapter2,
      verse2,
      language,
      bookList: DEFAULT_BIBLE,

      isValid() {
        return this.bookid != null && this.chapter1 > 0;
      },

      toSection() {
        if (this.bookid == null) return 'invalid';
        const versePart = this.verse1 > 0 ? `_${this.verse1}` : '';
        return `${this.bookid}${this.chapter1}${versePart}`;
      },

      toString() {
        if (this.bookid == null) return '';
        const bookData = BOOK_DATA[this.bookid];
        const bookName = bookData?.names?.[this.language]?.[0] ?? bookData?.names?.eng?.[0] ?? this.bookid;
        const crossChapter = this.chapter2 > 0 && this.chapter2 !== this.chapter1;
        let ref = `${this.chapter1}`;
        if (this.verse1 > 0) ref += `:${this.verse1}`;
        if (crossChapter) {
          ref += this.verse2 > 0 ? `-${this.chapter2}:${this.verse2}` : `-${this.chapter2}`;
        } else if (this.verse2 > 0 && this.verse2 !== this.verse1) {
          ref += `-${this.verse2}`;
        }
        return `${bookName} ${ref}`;
      }
    };
  }
}

export default Reference;
