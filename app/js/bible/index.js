/**
 * Bible Module Index
 * Exports bible data, reference parsing, and morphology
 */

import {
  BOOK_DATA,
  OT_BOOKS,
  NT_BOOKS,
  DEFAULT_BIBLE,
  addNames,
  getBookInfo,
  getBookByIndex,
  getBookIndex,
  getChapterCount,
  getVerseCount
} from './BibleData.js';

import {
  parseReference,
  Reference
} from './BibleReference.js';

import {
  morphology,
  robinson,
  OSHB,
  Greek,
  Hebrew
} from './Morphology.js';

export const bible = {
  BOOK_DATA,
  OT_BOOKS,
  NT_BOOKS,
  DEFAULT_BIBLE,
  addNames,
  getBookInfo,
  getBookByIndex,
  getBookIndex,
  getChapterCount,
  getVerseCount,
  parseReference,
  Reference,
  morphology,
  robinson,
  OSHB,
  Greek,
  Hebrew
};

export {
  BOOK_DATA,
  OT_BOOKS,
  NT_BOOKS,
  DEFAULT_BIBLE,
  addNames,
  getBookInfo,
  getBookByIndex,
  getBookIndex,
  getChapterCount,
  getVerseCount,
  parseReference,
  Reference,
  morphology,
  robinson,
  OSHB,
  Greek,
  Hebrew
};

export default bible;
