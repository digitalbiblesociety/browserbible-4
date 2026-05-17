import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import bibleDefault, {
  BOOK_DATA,
  EXTRA_MATTER,
  OT_BOOKS, OT_BOOKS_OSIS, OT_BOOKS_USFM,
  NT_BOOKS, NT_BOOKS_OSIS, NT_BOOKS_USFM,
  AP_BOOKS, AP_BOOKS_OSIS, AP_BOOKS_USFM,
  DEFAULT_BIBLE, DEFAULT_BIBLE_OSIS, DEFAULT_BIBLE_USFM,
  APOCRYPHAL_BIBLE, APOCRYPHAL_BIBLE_USFM,
  numbers,
  addNames,
  getBookInfo,
  getBookByIndex,
  getBookIndex,
  getChapterCount,
  getVerseCount
} from '@bible/BibleData.js';

describe('canon list lengths', () => {
  it('OT has 39 books across all naming conventions', () => {
    expect(OT_BOOKS).toHaveLength(39);
    expect(OT_BOOKS_OSIS).toHaveLength(39);
    expect(OT_BOOKS_USFM).toHaveLength(39);
  });

  it('NT has 27 books across all naming conventions', () => {
    expect(NT_BOOKS).toHaveLength(27);
    expect(NT_BOOKS_OSIS).toHaveLength(27);
    expect(NT_BOOKS_USFM).toHaveLength(27);
  });

  it('DEFAULT_BIBLE concatenates OT + NT (66 books)', () => {
    expect(DEFAULT_BIBLE).toHaveLength(66);
    expect(DEFAULT_BIBLE_OSIS).toHaveLength(66);
    expect(DEFAULT_BIBLE_USFM).toHaveLength(66);
  });

  it('APOCRYPHAL_BIBLE adds AP books between OT and NT', () => {
    expect(APOCRYPHAL_BIBLE).toHaveLength(OT_BOOKS.length + AP_BOOKS.length + NT_BOOKS.length);
    expect(APOCRYPHAL_BIBLE.slice(0, OT_BOOKS.length)).toEqual(OT_BOOKS);
    expect(APOCRYPHAL_BIBLE.slice(-NT_BOOKS.length)).toEqual(NT_BOOKS);
  });

  it('all AP arrays are length-aligned at the USFM 3.0 count of 35', () => {
    expect(AP_BOOKS).toHaveLength(35);
    expect(AP_BOOKS_USFM).toHaveLength(35);
    expect(AP_BOOKS_OSIS).toHaveLength(35);
  });
});

describe('canon arrays cross-reference BOOK_DATA', () => {
  it('every short-code in DEFAULT_BIBLE has BOOK_DATA', () => {
    for (const id of DEFAULT_BIBLE) {
      expect(BOOK_DATA[id], `missing BOOK_DATA[${id}]`).toBeDefined();
    }
  });

  it('every USFM in DEFAULT_BIBLE_USFM matches BOOK_DATA[short].usfm', () => {
    for (let i = 0; i < DEFAULT_BIBLE.length; i++) {
      expect(BOOK_DATA[DEFAULT_BIBLE[i]].usfm).toBe(DEFAULT_BIBLE_USFM[i]);
    }
  });

  it('every OSIS in DEFAULT_BIBLE_OSIS matches BOOK_DATA[short].osis', () => {
    for (let i = 0; i < DEFAULT_BIBLE.length; i++) {
      expect(BOOK_DATA[DEFAULT_BIBLE[i]].osis).toBe(DEFAULT_BIBLE_OSIS[i]);
    }
  });

  it('EXTRA_MATTER ids all exist in BOOK_DATA', () => {
    for (const id of EXTRA_MATTER) {
      expect(BOOK_DATA[id]).toBeDefined();
    }
  });
});

describe('apocrypha — USFM 3.0 conformance', () => {
  it('every short code in AP_BOOKS exists in BOOK_DATA', () => {
    for (const id of AP_BOOKS) {
      expect(BOOK_DATA[id], `BOOK_DATA[${id}] missing`).toBeDefined();
    }
  });

  it('every USFM in AP_BOOKS_USFM matches BOOK_DATA[short].usfm', () => {
    for (let i = 0; i < AP_BOOKS.length; i++) {
      expect(BOOK_DATA[AP_BOOKS[i]].usfm).toBe(AP_BOOKS_USFM[i]);
    }
  });

  it('every OSIS in AP_BOOKS_OSIS matches BOOK_DATA[short].osis', () => {
    for (let i = 0; i < AP_BOOKS.length; i++) {
      expect(BOOK_DATA[AP_BOOKS[i]].osis).toBe(AP_BOOKS_OSIS[i]);
    }
  });

  it('USFM codes in AP_BOOKS_USFM are unique', () => {
    expect(new Set(AP_BOOKS_USFM).size).toBe(AP_BOOKS_USFM.length);
  });

  it('short codes in AP_BOOKS are unique', () => {
    expect(new Set(AP_BOOKS).size).toBe(AP_BOOKS.length);
  });

  it('OSIS codes in AP_BOOKS_OSIS are unique', () => {
    expect(new Set(AP_BOOKS_OSIS).size).toBe(AP_BOOKS_OSIS.length);
  });

  it('contains the full set of USFM 3.0 non-canonical book codes', () => {
    const expected = [
      'TOB','JDT','ESG','WIS','SIR','BAR','LJE','S3Y','SUS','BEL',
      '1MA','2MA','3MA','4MA','1ES','2ES','MAN','PS2','ODA','PSS',
      'EZA','5EZ','6EZ','DAG','PS3','2BA','LBA','JUB','ENO',
      '1MQ','2MQ','3MQ','REP','4BA','LAO'
    ];
    expect(AP_BOOKS_USFM).toEqual(expected);
  });

  it('the previously-misaligned positions now resolve correctly', () => {
    // Was AP_BOOKS[2]="ED" (no such book); now "EG" → Esther (Greek)
    expect(AP_BOOKS[2]).toBe('EG');
    expect(BOOK_DATA.EG.usfm).toBe('ESG');

    // Was swapped: AP_BOOKS_USFM[7]="PA" / AP_BOOKS[8]="S3Y"
    // S3Y is the USFM and PA is the short code.
    expect(AP_BOOKS_USFM[7]).toBe('S3Y');
    expect(AP_BOOKS[7]).toBe('PA');
    expect(BOOK_DATA.PA.usfm).toBe('S3Y');
  });
});

describe('BOOK_DATA sortOrder', () => {
  it('every sortOrder is unique', () => {
    const orders = Object.values(BOOK_DATA).map(b => b.sortOrder);
    const dupes = orders.filter((o, i) => orders.indexOf(o) !== i);
    expect(dupes, `duplicate sortOrders: ${[...new Set(dupes)].join(', ')}`).toEqual([]);
  });

  it('Prayer of Manasseh precedes Psalm 151 (USFM 3.0 order)', () => {
    expect(BOOK_DATA.PN.sortOrder).toBeLessThan(BOOK_DATA.PX.sortOrder);
  });
});

describe('getBookInfo', () => {
  it('returns book data for a known id', () => {
    const info = getBookInfo('JN');
    expect(info.usfm).toBe('JHN');
    expect(info.osis).toBe('John');
  });

  it('returns null for an unknown id', () => {
    expect(getBookInfo('ZZ')).toBeNull();
  });
});

describe('getBookIndex / getBookByIndex', () => {
  it('round-trips a book through index lookups', () => {
    const idx = getBookIndex('JN');
    expect(idx).toBeGreaterThan(0);
    const book = getBookByIndex(idx);
    expect(book.usfm).toBe('JHN');
  });

  it('getBookIndex returns -1 for unknown id', () => {
    expect(getBookIndex('ZZ')).toBe(-1);
  });

  it('getBookByIndex returns null for unknown index', () => {
    expect(getBookByIndex(99999)).toBeNull();
  });
});

describe('getChapterCount', () => {
  it('returns canonical chapter counts', () => {
    expect(getChapterCount('GN')).toBe(50);
    expect(getChapterCount('PS')).toBe(150);
    expect(getChapterCount('JN')).toBe(21);
    expect(getChapterCount('JD')).toBe(1);
  });

  it('returns 0 for an unknown book', () => {
    expect(getChapterCount('ZZ')).toBe(0);
  });
});

describe('getVerseCount', () => {
  it('returns the right verse count for known chapters', () => {
    expect(getVerseCount('GN', 1)).toBe(31);
    expect(getVerseCount('JN', 3)).toBe(36);
    expect(getVerseCount('PS', 117)).toBe(2); // shortest chapter
    expect(getVerseCount('PS', 119)).toBe(176); // longest
  });

  it('returns 0 for chapter out of range', () => {
    expect(getVerseCount('JN', 0)).toBe(0);
    expect(getVerseCount('JN', 22)).toBe(0);
  });

  it('returns 0 for unknown book', () => {
    expect(getVerseCount('ZZ', 1)).toBe(0);
  });
});

describe('numbers', () => {
  it('default contains 0..150 as strings', () => {
    expect(numbers.default).toHaveLength(151);
    expect(numbers.default[0]).toBe('0');
    expect(numbers.default[150]).toBe('150');
  });
});

describe('addNames', () => {
  let originalNames;

  beforeEach(() => {
    // Snapshot a few entries we'll mutate so we can restore.
    originalNames = {
      JN: structuredClone(BOOK_DATA.JN.names),
      GN: structuredClone(BOOK_DATA.GN.names)
    };
  });

  afterEach(() => {
    BOOK_DATA.JN.names = originalNames.JN;
    BOOK_DATA.GN.names = originalNames.GN;
  });

  it('adds localized names under the language key', () => {
    addNames('spa', ['JN'], ['Juan']);
    expect(BOOK_DATA.JN.names.spa).toBeDefined();
    expect(BOOK_DATA.JN.names.spa.flat()).toContain('Juan');
  });

  it('coerces a string into an array', () => {
    addNames('fra', ['JN'], ['Jean']);
    expect(BOOK_DATA.JN.names.fra.flat()).toContain('Jean');
  });

  it('skips entries for unknown book ids', () => {
    expect(() => addNames('spa', ['ZZ'], ['No tal libro'])).not.toThrow();
  });

  it('does not modify books not in the supplied list', () => {
    addNames('spa', ['JN'], ['Juan']);
    expect(BOOK_DATA.GN.names.spa).toBeUndefined();
  });
});

describe('default export', () => {
  it('exposes the documented properties and helpers', () => {
    expect(bibleDefault.BOOK_DATA).toBe(BOOK_DATA);
    expect(bibleDefault.getBookInfo).toBe(getBookInfo);
    expect(bibleDefault.DEFAULT_BIBLE).toBe(DEFAULT_BIBLE);
  });
});
