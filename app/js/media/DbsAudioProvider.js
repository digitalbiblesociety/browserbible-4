/**
 * DbsAudioProvider
 * Audio provider for DBS audio Bibles at audio.dbs.org
 *
 * Bible index: https://audio.dbs.org/index.json
 * File listing: https://audio.dbs.org/{id}/index.txt
 * Audio files: https://audio.dbs.org/{id}/{bookNum}_{bookName}_{chapter}.mp3
 * Timing files: https://audio.dbs.org/{id}/timingfiles/{bookNum}_{chapter}.txt
 */

import { BaseAudioProvider } from './BaseAudioProvider.js';
import { getConfig } from '../core/config.js';
import { OT_BOOKS, NT_BOOKS, BOOK_DATA } from '../bible/BibleData.js';

/** Map DBS book number (1-66) to BrowserBible 2-char code */
function dbsNumToCode(num) {
  const n = typeof num === 'string' ? parseInt(num, 10) : num;
  if (n >= 1 && n <= 39) return OT_BOOKS[n - 1];
  if (n >= 40 && n <= 66) return NT_BOOKS[n - 40];
  return null;
}

/** Map BrowserBible 2-char code to DBS book number string (zero-padded) */
function codeToDbsNum(code) {
  let idx = OT_BOOKS.indexOf(code);
  if (idx >= 0) return String(idx + 1).padStart(2, '0');
  idx = NT_BOOKS.indexOf(code);
  if (idx >= 0) return String(idx + 40).padStart(2, '0');
  return null;
}

export class DbsAudioProvider extends BaseAudioProvider {
  constructor() {
    super();
    this._indexPromise = null;
    this._bibleCache = new Map();
  }

  get name() { return 'dbs'; }

  /**
   * Fetch and cache the master DBS index
   * @returns {Promise<Array>}
   */
  async _getIndex() {
    if (this._indexPromise) return this._indexPromise;

    const config = getConfig();
    if (!config.dbsAudioEnabled) return [];

    const baseUrl = config.dbsAudioUrl || 'https://audio.dbs.org';

    this._indexPromise = fetch(`${baseUrl}/index.json`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .catch(err => {
        console.warn('DbsAudioProvider: failed to load index', err);
        this._indexPromise = null;
        return [];
      });

    return this._indexPromise;
  }

  /**
   * Find a matching DBS entry for the given textInfo
   */
  _findMatch(index, textInfo) {
    const id = textInfo.id;
    const abbr = textInfo.abbr || textInfo.id;

    return index.find(entry =>
      entry.abbr === id ||
      entry.id === id ||
      entry.davar_id === id ||
      entry.abbr === abbr ||
      entry.id === abbr
    ) || null;
  }

  /**
   * Fetch and parse a Bible's index.txt to discover available books/chapters
   * @returns {Promise<Object>} { books: Map, bookOrder: string[] }
   */
  async _loadBibleIndex(dbsId) {
    if (this._bibleCache.has(dbsId)) return this._bibleCache.get(dbsId);

    const config = getConfig();
    const baseUrl = config.dbsAudioUrl || 'https://audio.dbs.org';

    try {
      const response = await fetch(`${baseUrl}/${dbsId}/index.txt`);
      if (!response.ok) return null;

      const text = await response.text();
      const lines = text.trim().split('\n');

      // Parse filenames: {bookNum}_{bookName}_{chapter}.mp3
      const books = new Map();
      const bookOrderSet = [];

      for (const line of lines) {
        const filename = line.trim();
        if (!filename) continue;

        const match = filename.match(/^(\d+)_(.+?)_(\d+)\.mp3$/);
        if (!match) continue;

        const [, dbsNum, dbsName, chapterStr] = match;
        const code = dbsNumToCode(dbsNum);
        if (!code) continue;

        const chapter = parseInt(chapterStr, 10);

        if (!books.has(code)) {
          books.set(code, {
            dbsNum,
            dbsName,
            chapters: []
          });
          bookOrderSet.push(code);
        }

        books.get(code).chapters.push(chapter);
      }

      // Sort chapters within each book
      for (const bookInfo of books.values()) {
        bookInfo.chapters.sort((a, b) => a - b);
      }

      const result = { books, bookOrder: bookOrderSet };
      this._bibleCache.set(dbsId, result);
      return result;
    } catch (err) {
      console.warn(`DbsAudioProvider: failed to load index.txt for ${dbsId}`, err);
      return null;
    }
  }

  async getAudioInfo(textInfo) {
    const config = getConfig();
    if (!config.dbsAudioEnabled) return null;

    const index = await this._getIndex();
    if (!index.length) return null;

    const entry = this._findMatch(index, textInfo);
    if (!entry) {
      console.debug(`DbsAudioProvider: no match for "${textInfo.id}" (abbr: "${textInfo.abbr}")`);
      return null;
    }
    console.debug(`DbsAudioProvider: matched "${textInfo.id}" → DBS entry "${entry.abbr}" (id: ${entry.id})`);

    const bibleIndex = await this._loadBibleIndex(entry.id);
    if (!bibleIndex || bibleIndex.books.size === 0) return null;

    return {
      type: 'dbs',
      title: entry.tt || entry.abbr,
      dbsId: entry.id,
      books: bibleIndex.books,
      bookOrder: bibleIndex.bookOrder
    };
  }

  async getFragmentAudio(textInfo, audioInfo, fragmentid, audioOption) {
    const config = getConfig();
    const baseUrl = config.dbsAudioUrl || 'https://audio.dbs.org';

    const sectionid = fragmentid.split('_')[0];
    const bookCode = sectionid.substring(0, 2);
    const chapter = parseInt(sectionid.substring(2), 10);

    const bookInfo = audioInfo.books.get(bookCode);
    if (!bookInfo) return null;
    if (!bookInfo.chapters.includes(chapter)) return null;

    const chapterStr = String(chapter).padStart(2, '0');
    const url = `${baseUrl}/${audioInfo.dbsId}/${bookInfo.dbsNum}_${bookInfo.dbsName}_${chapterStr}.mp3`;
    const id = `dbs:${audioInfo.dbsId}/${bookInfo.dbsNum}_${chapter}`;

    // Get verse count for end marker
    const bookData = BOOK_DATA[bookCode];
    const lastVerse = (bookData?.chapters && chapter <= bookData.chapters.length)
      ? bookData.chapters[chapter - 1]
      : 1;

    // Try to load verse timing data
    const timestamps = await this._loadTimingFile(baseUrl, audioInfo.dbsId, bookInfo.dbsNum, chapterStr);

    return {
      url,
      id,
      start: `${bookCode}${chapter}_1`,
      end: `${bookCode}${chapter}_${lastVerse}`,
      timestamps
    };
  }

  /**
   * Load and parse a verse timing file
   * @returns {Promise<Array|null>} Array of { verse, time } or null
   */
  async _loadTimingFile(baseUrl, dbsId, bookNum, chapterStr) {
    try {
      const response = await fetch(`${baseUrl}/${dbsId}/timingfiles/${bookNum}_${chapterStr}.txt`);
      if (!response.ok) return null;

      const text = await response.text();
      const timestamps = [];

      for (const line of text.trim().split('\n')) {
        // Format: "Verse {n}\t{HH:MM:SS.ms}"
        const match = line.match(/^Verse\s+(\d+)\t(\d+):(\d+):(\d+)\.(\d+)/);
        if (!match) continue;

        const verse = parseInt(match[1], 10);
        const hours = parseInt(match[2], 10);
        const minutes = parseInt(match[3], 10);
        const seconds = parseInt(match[4], 10);
        const ms = parseInt(match[5], 10);

        const time = hours * 3600 + minutes * 60 + seconds + ms / 1000;
        timestamps.push({ verse, time });
      }

      return timestamps.length > 0 ? timestamps : null;
    } catch {
      return null;
    }
  }

  async getNextFragment(textInfo, audioInfo, fragmentid) {
    const sectionid = fragmentid.split('_')[0];
    const bookCode = sectionid.substring(0, 2);
    const chapter = parseInt(sectionid.substring(2), 10);

    const bookInfo = audioInfo.books.get(bookCode);
    if (!bookInfo) return null;

    const chapterIdx = bookInfo.chapters.indexOf(chapter);
    if (chapterIdx < 0) return null;

    // Next chapter in same book
    if (chapterIdx < bookInfo.chapters.length - 1) {
      const nextChapter = bookInfo.chapters[chapterIdx + 1];
      return `${bookCode}${nextChapter}_1`;
    }

    // First chapter of next book
    const bookIdx = audioInfo.bookOrder.indexOf(bookCode);
    if (bookIdx < 0 || bookIdx >= audioInfo.bookOrder.length - 1) return null;

    const nextBookCode = audioInfo.bookOrder[bookIdx + 1];
    const nextBookInfo = audioInfo.books.get(nextBookCode);
    if (!nextBookInfo || nextBookInfo.chapters.length === 0) return null;

    return `${nextBookCode}${nextBookInfo.chapters[0]}_1`;
  }

  async getPrevFragment(textInfo, audioInfo, fragmentid) {
    const sectionid = fragmentid.split('_')[0];
    const bookCode = sectionid.substring(0, 2);
    const chapter = parseInt(sectionid.substring(2), 10);

    const bookInfo = audioInfo.books.get(bookCode);
    if (!bookInfo) return null;

    const chapterIdx = bookInfo.chapters.indexOf(chapter);
    if (chapterIdx < 0) return null;

    // Previous chapter in same book
    if (chapterIdx > 0) {
      const prevChapter = bookInfo.chapters[chapterIdx - 1];
      return `${bookCode}${prevChapter}_1`;
    }

    // Last chapter of previous book
    const bookIdx = audioInfo.bookOrder.indexOf(bookCode);
    if (bookIdx <= 0) return null;

    const prevBookCode = audioInfo.bookOrder[bookIdx - 1];
    const prevBookInfo = audioInfo.books.get(prevBookCode);
    if (!prevBookInfo || prevBookInfo.chapters.length === 0) return null;

    const lastChapter = prevBookInfo.chapters[prevBookInfo.chapters.length - 1];
    return `${prevBookCode}${lastChapter}_1`;
  }
}
