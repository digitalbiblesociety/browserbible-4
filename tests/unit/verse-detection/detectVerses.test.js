import { describe, it, expect } from 'vitest';
import { createVerseDetector } from '@verse-detection/VerseDetectionPlugin.ts';

describe('createVerseDetector — English detection', () => {
  const detector = createVerseDetector({ language: 'en' });

  it('detects a single English reference', () => {
    const verses = detector.detectVerses('Read John 3:16 today.');
    expect(verses).toHaveLength(1);
    expect(verses[0].book).toBe('John');
    expect(verses[0].reference).toMatch(/^3.*16/);
  });

  it('detects multiple references in one string', () => {
    const verses = detector.detectVerses('Genesis 1:1 and John 3:16');
    expect(verses).toHaveLength(2);
    const books = verses.map(v => v.book);
    expect(books).toContain('Genesis');
    expect(books).toContain('John');
  });

  it('detects abbreviated forms', () => {
    const verses = detector.detectVerses('Jn 3:16, Gen 1:1');
    expect(verses).toHaveLength(2);
  });

  it('detects numbered books', () => {
    const verses = detector.detectVerses('See 1 John 4:8');
    expect(verses).toHaveLength(1);
    expect(verses[0].book).toBe('1 John');
  });

  it('returns startIndex/endIndex pointing at the original substring', () => {
    const text = 'Read John 3:16 today.';
    const [v] = detector.detectVerses(text);
    expect(text.slice(v.startIndex, v.endIndex)).toBe(v.original);
  });

  it('returns [] for non-string input', () => {
    expect(detector.detectVerses(null)).toEqual([]);
    expect(detector.detectVerses(undefined)).toEqual([]);
    expect(detector.detectVerses('')).toEqual([]);
  });
});

describe('createVerseDetector — other languages', () => {
  it('detects a Spanish reference', () => {
    const detector = createVerseDetector({ language: 'es' });
    const verses = detector.detectVerses('Lee Juan 3:16 hoy.');
    expect(verses.length).toBeGreaterThan(0);
    expect(verses[0].book).toBe('John');
    expect(verses[0].detectedLanguage).toBe('es');
  });

  it('detects a Portuguese reference', () => {
    const detector = createVerseDetector({ language: 'pt' });
    const verses = detector.detectVerses('Leia João 3:16.');
    expect(verses.length).toBeGreaterThan(0);
    expect(verses[0].book).toBe('John');
  });
});

describe('detector API', () => {
  const detector = createVerseDetector({ language: 'en' });

  it('containsVerses returns true/false', () => {
    expect(detector.containsVerses('Read John 3:16')).toBe(true);
    expect(detector.containsVerses('Hello world')).toBe(false);
    expect(detector.containsVerses(null)).toBe(false);
  });

  it('replaceVerses applies a formatter', () => {
    const out = detector.replaceVerses('See John 3:16.', v => `[${v.book} ${v.reference}]`);
    expect(out).toBe('See [John 3:16].');
  });

  it('linkVerses produces an <a> with data-verse-ref', () => {
    const out = detector.linkVerses('See John 3:16.');
    expect(out).toMatch(/<a [^>]*data-verse-ref="John 3:16"[^>]*>John 3:16<\/a>/);
  });

  it('normalizeReference returns canonical form', () => {
    expect(detector.normalizeReference('Jn 3:16')).toBe('John 3:16');
    expect(detector.normalizeReference('not a ref')).toBeNull();
  });

  it('getCanonicalBookName resolves a variation', () => {
    const result = detector.getCanonicalBookName('Jn');
    expect(result.canonical).toBe('John');
  });

  it('getCurrentLanguages and getSupportedLanguages return arrays', () => {
    expect(detector.getCurrentLanguages()).toContain('en');
    expect(detector.getSupportedLanguages()).toContain('en');
    expect(detector.getSupportedLanguages()).toContain('es');
  });

  it('setLanguage swaps the active language set', () => {
    const det = createVerseDetector({ language: 'en' });
    det.setLanguage('es');
    expect(det.getCurrentLanguages()).toContain('es');
  });
});
