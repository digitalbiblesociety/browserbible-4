import { describe, it, expect } from 'vitest';
import {
  BOOK_NAMES,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  getBookNames,
  getCombinedBookNames
} from '@verse-detection/bookNames.ts';

describe('SUPPORTED_LANGUAGES', () => {
  it('includes the documented 10 languages', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(10);
    for (const lang of ['en', 'es', 'pt', 'fr', 'de', 'ru', 'ar', 'hi', 'zh', 'id']) {
      expect(SUPPORTED_LANGUAGES).toContain(lang);
    }
  });

  it('default language is English', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
  });
});

describe('BOOK_NAMES', () => {
  it('contains an entry for every supported language', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(BOOK_NAMES[lang], lang).toBeDefined();
    }
  });

  it('every language maps all 66 canonical books', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      expect(Object.keys(BOOK_NAMES[lang]), `${lang}`).toHaveLength(66);
    }
  });

  it('every variation list has at least one entry', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const [book, variations] of Object.entries(BOOK_NAMES[lang])) {
        expect(variations.length, `${lang} ${book}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('getBookNames', () => {
  it('returns patterns for a known language', () => {
    expect(getBookNames('es').Genesis).toBeDefined();
  });

  it('strips region tag (en-US → en)', () => {
    expect(getBookNames('en-US')).toBe(BOOK_NAMES.en);
  });

  it('falls back to default for unknown language', () => {
    expect(getBookNames('xx')).toBe(BOOK_NAMES.en);
    expect(getBookNames(null)).toBe(BOOK_NAMES.en);
    expect(getBookNames(undefined)).toBe(BOOK_NAMES.en);
  });
});

describe('getCombinedBookNames', () => {
  it('merges variations from multiple languages without duplicates', () => {
    const combined = getCombinedBookNames(['en', 'es']);
    expect(combined.Genesis).toBeDefined();
    // both 'Genesis' (en) and 'Génesis' (es) should be present
    const enHas = BOOK_NAMES.en.Genesis.every(v => combined.Genesis.includes(v));
    const esHas = BOOK_NAMES.es.Genesis.every(v => combined.Genesis.includes(v));
    expect(enHas).toBe(true);
    expect(esHas).toBe(true);
    expect(new Set(combined.Genesis).size).toBe(combined.Genesis.length);
  });

  it('ignores unknown languages (uses default fallback)', () => {
    const combined = getCombinedBookNames(['xx']);
    expect(combined.Genesis).toEqual(BOOK_NAMES.en.Genesis);
  });
});
