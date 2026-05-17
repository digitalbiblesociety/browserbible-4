import { describe, it, expect } from 'vitest';
import { Reference } from '@bible/BibleReference.js';
import BibleReferenceDefault from '@bible/BibleReference.js';

describe('Reference — string parsing', () => {
  it('parses "John 3:16"', () => {
    const r = Reference('John 3:16');
    expect(r).toMatchObject({ bookid: 'JN', chapter1: 3, verse1: 16, chapter2: -1, verse2: -1, language: 'eng' });
  });

  it('parses common abbreviations', () => {
    expect(Reference('Jn 3:16')).toMatchObject({ bookid: 'JN', chapter1: 3, verse1: 16 });
    expect(Reference('Joh 3:16')).toMatchObject({ bookid: 'JN', chapter1: 3, verse1: 16 });
    expect(Reference('Gen 1:1')).toMatchObject({ bookid: 'GN', chapter1: 1, verse1: 1 });
  });

  it('parses without verse: "John 3"', () => {
    const r = Reference('John 3');
    expect(r).toMatchObject({ bookid: 'JN', chapter1: 3, verse1: -1 });
  });

  it('parses single-verse range "John 3:16-18"', () => {
    const r = Reference('John 3:16-18');
    expect(r).toMatchObject({ bookid: 'JN', chapter1: 3, verse1: 16, chapter2: 3, verse2: 18 });
  });

  it('parses cross-chapter range "John 3:16-4:2"', () => {
    const r = Reference('John 3:16-4:2');
    expect(r).toMatchObject({ bookid: 'JN', chapter1: 3, verse1: 16, chapter2: 4, verse2: 2 });
  });

  it('collapses backwards same-chapter ranges (e.g. "John 3:18-3:14")', () => {
    const r = Reference('John 3:18-3:14');
    expect(r).toMatchObject({ chapter1: 3, verse1: 18, chapter2: -1, verse2: -1 });
  });

  it('collapses backwards cross-chapter ranges (e.g. "John 4:1-3:5")', () => {
    const r = Reference('John 4:1-3:5');
    expect(r).toMatchObject({ chapter1: 4, verse1: 1, chapter2: -1, verse2: -1 });
  });

  it('parses cross-chapter range where end verse > start verse "John 3:16-4:20"', () => {
    const r = Reference('John 3:16-4:20');
    expect(r).toMatchObject({ bookid: 'JN', chapter1: 3, verse1: 16, chapter2: 4, verse2: 20 });
  });

  it('parses numbered books: "1 John 1:1"', () => {
    const r = Reference('1 John 1:1');
    expect(r).toMatchObject({ bookid: 'J1', chapter1: 1, verse1: 1 });
  });

  it('is case-insensitive', () => {
    expect(Reference('JOHN 3:16')).toMatchObject({ bookid: 'JN', chapter1: 3, verse1: 16 });
    expect(Reference('john 3:16')).toMatchObject({ bookid: 'JN', chapter1: 3, verse1: 16 });
  });

  it('returns null for unknown book', () => {
    expect(Reference('Zorblax 3:16')).toBeNull();
  });

  it('returns null for non-string / wrong arity', () => {
    expect(Reference(42)).toBeNull();
    expect(Reference('John', 'eng', 'extra')).toBeNull();
  });

  it('default export equals named Reference', () => {
    expect(BibleReferenceDefault).toBe(Reference);
  });
});

describe('Reference — short codes', () => {
  it('parses "JN3_16" → John 3:16', () => {
    const r = Reference('JN3_16');
    expect(r).toMatchObject({ bookid: 'JN', chapter1: 3, verse1: 16 });
  });

  it('parses chapter-only short code "JN3"', () => {
    const r = Reference('JN3');
    expect(r).toMatchObject({ bookid: 'JN', chapter1: 3, verse1: -1 });
  });
});

describe('Reference — component constructor', () => {
  it('accepts (bookid, chapter, verse)', () => {
    const r = Reference('JN', 3, 16);
    expect(r).toMatchObject({ bookid: 'JN', chapter1: 3, verse1: 16, chapter2: -1, verse2: -1 });
  });

  it('accepts full range (bookid, c1, v1, c2, v2)', () => {
    const r = Reference('JN', 3, 16, 4, 2);
    expect(r).toMatchObject({ bookid: 'JN', chapter1: 3, verse1: 16, chapter2: 4, verse2: 2 });
  });

  it('accepts language as last arg', () => {
    const r = Reference('JN', 3, 16, -1, -1, 'spa');
    expect(r.language).toBe('spa');
  });
});

describe('Reference — clamping & normalization', () => {
  it('clamps a chapter past the book max to the last chapter', () => {
    // John has 21 chapters
    const r = Reference('John 99:1');
    expect(r.chapter1).toBe(21);
  });

  it('clamps a verse past the chapter max to the last verse', () => {
    // John 3 has 36 verses
    const r = Reference('John 3:999');
    expect(r.verse1).toBe(36);
  });

  it('drops trailing range when v2 <= v1', () => {
    // "John 3:16-16" should not produce a range
    const r = Reference('John 3:16-16');
    expect(r.chapter2).toBe(-1);
    expect(r.verse2).toBe(-1);
  });

  it('expands "1-2:5" → c1=1 v1=1 c2=2 v2=5', () => {
    const r = Reference('John 1-2:5');
    expect(r).toMatchObject({ chapter1: 1, verse1: 1, chapter2: 2, verse2: 5 });
  });
});

describe('Reference — methods', () => {
  it('isValid() reflects parse success', () => {
    expect(Reference('John 3:16').isValid()).toBe(true);
    expect(Reference('JN', 3).isValid()).toBe(true);
  });

  it('toSection() emits section id', () => {
    expect(Reference('John 3:16').toSection()).toBe('JN3_16');
    expect(Reference('John 3').toSection()).toBe('JN3');
  });

  it('toString() formats human-readable single verse', () => {
    expect(Reference('John 3:16').toString()).toBe('John 3:16');
  });

  it('toString() formats verse range within chapter', () => {
    expect(Reference('John 3:16-18').toString()).toBe('John 3:16-18');
  });

  it('toString() formats cross-chapter range "John 3:16-4:2"', () => {
    expect(Reference('John 3:16-4:2').toString()).toBe('John 3:16-4:2');
  });

  it('toString() formats cross-chapter range "John 3:16-4:20"', () => {
    expect(Reference('John 3:16-4:20').toString()).toBe('John 3:16-4:20');
  });

  it('toString() formats chapter-only', () => {
    expect(Reference('John 3').toString()).toBe('John 3');
  });

  it('toString() falls back to English when language has no name', () => {
    const r = Reference('John 3:16');
    r.language = 'klingon';
    expect(r.toString()).toBe('John 3:16');
  });
});
