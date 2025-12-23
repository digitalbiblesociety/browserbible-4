/**
 * Bible Reference Parser
 *
 * @author John Dyer (http://j.hn/)
 */

import { BOOK_DATA, DEFAULT_BIBLE } from './BibleData.js';

const shortCodeRegex = /^\w{2}\d{1,3}(_\d{1,3})?$/;

export function parseReference(textReference, language) {
  let bookIndex = -1,
    chapter1 = -1,
    verse1 = -1,
    chapter2 = -1,
    verse2 = -1,
    input = String(textReference),
    matchingbookid = null,
    afterRange = false,
    afterSeparator = false,
    startedNumber = false,
    currentNumber = '';

  // Is short code format (GN2 || GN2_1)
  if (shortCodeRegex.test(input)) {
    const parts = input.split('_');
    const bookChapter = parts[0];

    const bookid = bookChapter.substring(0, 2).toUpperCase();
    chapter1 = parseInt(bookChapter.substring(2), 10);

    if (parts.length > 1) {
      verse1 = parseInt(parts[1], 10);
    }

    return Reference(bookid, chapter1, verse1, chapter2, verse2, language);
  }

  // Go through all books and test all names
  for (const bookid in BOOK_DATA) {
    // Match id?
    const possibleMatch = input.substring(0, Math.floor(bookid.length, input.length)).toLowerCase();
    const nextIsSeparator = input.length > possibleMatch.length ? /(\d|\.|\s)/.test(input.substr(possibleMatch.length, 1)) : false;

    if (possibleMatch === bookid.toLowerCase() && nextIsSeparator) {
      matchingbookid = bookid;
      input = input.substring(bookid.length);
      break;
    }

    // If no direct match on ID, then go through names in each language
    for (const lang in BOOK_DATA[bookid].names) {
      // Test each name
      const names = BOOK_DATA[bookid].names[lang];
      for (const nameItem of names) {
        const name = String(nameItem).toLowerCase();
        const possibleMatch = input.substring(0, Math.floor(name.length, input.length)).toLowerCase();

        if (possibleMatch === name) {
          matchingbookid = bookid;
          input = input.substring(name.length);
          break;
        }
      }

      if (matchingbookid != null) break;
    }
    if (matchingbookid != null) break;
  }

  if (matchingbookid == null) return null;

  // Pull off _10_10 => 10_10
  if (input.substring(0, 1) === '_') {
    input = input.substring(1);
  }

  for (let i = 0; i < input.length; i++) {
    const c = input.charAt(i);

    if (c === ' ' || isNaN(c)) {
      if (!startedNumber) continue;

      if (c === '-') {
        afterRange = true;
        afterSeparator = false;
      } else if (c === ':' || c === ',' || c === '.' || c === '_') {
        afterSeparator = true;
      }

      currentNumber = '';
      startedNumber = false;
    } else {
      startedNumber = true;
      currentNumber += c;

      if (afterSeparator) {
        if (afterRange) {
          verse2 = parseInt(currentNumber);
        } else {
          verse1 = parseInt(currentNumber);
        }
      } else {
        if (afterRange) {
          chapter2 = parseInt(currentNumber);
        } else {
          chapter1 = parseInt(currentNumber);
        }
      }
    }
  }

  // Reassign 1:1-2
  if (chapter1 > 0 && verse1 > 0 && chapter2 > 0 && verse2 <= 0) {
    verse2 = chapter2;
    chapter2 = chapter1;
  }

  // Fix 1-2:5
  if (chapter1 > 0 && verse1 <= 0 && chapter2 > 0 && verse2 > 0) {
    verse1 = 1;
  }

  // Just book
  if (bookIndex > -1 && chapter1 <= 0 && verse1 <= 0 && chapter2 <= 0 && verse2 <= 0) {
    chapter1 = 1;
  }

  // Validate max chapter
  if (chapter1 === -1) {
    chapter1 = 1;
  } else if (BOOK_DATA[matchingbookid].chapters?.length > 0 && chapter1 > BOOK_DATA[matchingbookid].chapters.length) {
    chapter1 = BOOK_DATA[matchingbookid].chapters.length;
    if (verse1 > 0) verse1 = 1;
  }

  // Validate max verse
  if (BOOK_DATA[matchingbookid].chapters?.length > 0 && verse1 > BOOK_DATA[matchingbookid].chapters[chapter1 - 1]) {
    verse1 = BOOK_DATA[matchingbookid].chapters[chapter1 - 1];
  }

  if (verse2 <= verse1) {
    chapter2 = -1;
    verse2 = -1;
  }

  return Reference(matchingbookid, chapter1, verse1, chapter2, verse2, language);
}

export function Reference(...args) {
  let _bookid = -1,
    _chapter1 = -1,
    _verse1 = -1,
    _chapter2 = -1,
    _verse2 = -1,
    _language = 'eng';

  if (args.length === 1 && typeof args[0] === 'string') {
    return parseReference(args[0]);
  } else if (args.length === 2 && typeof args[0] === 'string' && typeof args[1] === 'string') {
    return parseReference(args[0], args[1]);
  } else if (args.length >= 2 && typeof args[0] === 'string' && typeof args[1] === 'number') {
    _bookid = args[0];
    _chapter1 = args[1];
    if (args.length >= 3) _verse1 = args[2];
    if (args.length >= 4) _chapter2 = args[3];
    if (args.length >= 5) _verse2 = args[4];
    if (args.length >= 6) _language = args[5];
  } else {
    return null;
  }

  const padLeft = (nr, n, str = '0') => Array(n - String(nr).length + 1).join(str) + nr;

  const refObject = {
    bookid: _bookid,
    chapter: _chapter1,
    verse: _verse1,
    chapter1: _chapter1,
    verse1: _verse1,
    chapter2: _chapter2,
    verse2: _verse2,
    language: _language,
    bookList: DEFAULT_BIBLE,

    isValid() {
      return (typeof _bookid !== 'undefined' && _bookid !== null && _chapter1 > 0);
    },

    chapterAndVerse(cvSeparator = ':', vvSeparator = '-', ccSeparator = '-') {
      if (this.chapter1 > 0 && this.verse1 <= 0 && this.chapter2 <= 0 && this.verse2 <= 0)
        return this.chapter1.toString();
      else if (this.chapter1 > 0 && this.verse1 > 0 && this.chapter2 <= 0 && this.verse2 <= 0)
        return `${this.chapter1}${cvSeparator}${this.verse1}`;
      else if (this.chapter1 > 0 && this.verse1 > 0 && this.chapter2 <= 0 && this.verse2 > 0)
        return `${this.chapter1}${cvSeparator}${this.verse1}${vvSeparator}${this.verse2}`;
      else if (this.chapter1 > 0 && this.verse1 <= 0 && this.chapter2 > 0 && this.verse2 <= 0)
        return `${this.chapter1}${ccSeparator}${this.chapter2}`;
      else if (this.chapter1 > 0 && this.verse1 > 0 && this.chapter2 > 0 && this.verse2 > 0)
        return `${this.chapter1}${cvSeparator}${this.verse1}${ccSeparator}${this.chapter1 !== this.chapter2 ? `${this.chapter2}${cvSeparator}` : ''}${this.verse2}`;
      else
        return 'unknown';
    },

    toFormat(format) {
      const t = this;
      const bookInfo = BOOK_DATA[this.bookid];
      let output = format;

      const flags = {
        'I': () => bookInfo.sortOrder.toString(),
        'II': () => padLeft(bookInfo.sortOrder.toString(), 2),
        'III': () => padLeft(bookInfo.sortOrder.toString(), 3),
        'UUU': () => bookInfo.usfm.toUpperCase(),
        'uuu': () => bookInfo.usfm.toLowerCase(),
        'Uuu': () => `${bookInfo.usfm.substring(0, 1).toUpperCase()}${bookInfo.usfm.substring(1).toLowerCase()}`,
        'DD': () => bookInfo.shortCode.toUpperCase(),
        'dd': () => bookInfo.shortCode.toLowerCase(),
        'NNN': () => {
          const bookNames = bookInfo.names[t.language];
          return bookNames?.[0] ?? bookInfo.names['eng'][0];
        },
        'N': () => `${bookInfo.usfm.substring(0, 1).toUpperCase()}${bookInfo.usfm.substring(1).toLowerCase()}`,
        'C': () => t.chapter1.toString(),
        'CC': () => padLeft(t.chapter1.toString(), 2),
        'CCC': () => padLeft(t.chapter1.toString(), 3),
        'V': () => t.verse1.toString(),
        'VV': () => padLeft(t.verse1.toString(), 2),
        'VVV': () => padLeft(t.verse1.toString(), 3),
        '##': () => t.chapterAndVerse()
      };

      // Lowercase aliases
      flags['i'] = flags['I'];
      flags['ii'] = flags['II'];
      flags['iii'] = flags['III'];
      flags['c'] = flags['C'];
      flags['cc'] = flags['CC'];
      flags['ccc'] = flags['CCC'];
      flags['v'] = flags['V'];
      flags['vv'] = flags['VV'];
      flags['vvv'] = flags['VVV'];

      // Sort keys by length (longest first)
      const keys = Object.keys(flags).sort((a, b) => b.length - a.length);

      // Do replacement
      for (const key of keys) {
        output = output.replace(new RegExp(key, 'g'), flags[key]());
      }

      return output;
    },

    toString() {
      if (this.bookid == null) return "invalid";

      const bookNames = BOOK_DATA[this.bookid].names[this.language];
      const bookName = bookNames?.[0] ?? BOOK_DATA[this.bookid].names['eng'][0];

      return `${bookName} ${this.chapterAndVerse()}`;
    },

    toSection() {
      if (this.bookid == null) return "invalid";
      return `${this.bookid}${this.chapter1}${this.verse1 > 0 ? `_${this.verse1}` : ''}`;
    },

    prevChapter() {
      this.verse1 = 1;
      this.chapter2 = -1;
      this.verse2 = -1;

      if (this.chapter1 === 1 && this.bookList.indexOf(this.bookid) === 0) {
        return null;
      } else {
        if (this.chapter1 === 1) {
          this.bookid = this.bookList[this.bookList.indexOf(this.bookid) - 1];
          this.chapter = this.chapter1 = BOOK_DATA[this.bookid].chapters.length;
        } else {
          this.chapter = this.chapter1 = this.chapter1 - 1;
        }
      }
      return this;
    },

    nextChapter() {
      this.verse1 = 1;
      this.chapter2 = -1;
      this.verse2 = -1;

      if (this.bookList[this.bookid] === this.bookList.length - 1 && BOOK_DATA[this.bookid].chapters.length === this.chapter1) {
        return null;
      } else {
        if (this.chapter1 < BOOK_DATA[this.bookid].chapters.length) {
          this.chapter = this.chapter1 = this.chapter1 + 1;
        } else if (this.bookList.indexOf(this.bookid) < this.bookList.length - 1) {
          this.bookid = this.bookList[this.bookList.indexOf(this.bookid) + 1];
          this.chapter = this.chapter1 = 1;
        }
      }
      return this;
    },

    isFirstChapter() {
      return (this.chapter1 === 1 && this.bookList.indexOf(this.bookid) === 0);
    },

    isLastChapter() {
      return (this.bookList[this.bookid] === this.bookList.length - 1 && BOOK_DATA[this.bookid].chapters.length === this.chapter1);
    }
  };

  return refObject;
}

export default { parseReference, Reference };
