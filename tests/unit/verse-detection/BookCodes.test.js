import { describe, it, expect } from 'vitest';
import { BOOK_CODES, getBookCode } from '@verse-detection/BookCodes.ts';

describe('BOOK_CODES', () => {
  it('covers all 66 canonical books', () => {
    expect(Object.keys(BOOK_CODES)).toHaveLength(66);
  });

  it('uses 2-character codes', () => {
    for (const [name, code] of Object.entries(BOOK_CODES)) {
      expect(code, `${name} → ${code}`).toMatch(/^[A-Z0-9]{2}$/);
    }
  });

  it('codes are unique', () => {
    const codes = Object.values(BOOK_CODES);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('common books map as expected', () => {
    expect(BOOK_CODES['Genesis']).toBe('GN');
    expect(BOOK_CODES['John']).toBe('JN');
    expect(BOOK_CODES['1 John']).toBe('J1');
    expect(BOOK_CODES['Revelation']).toBe('RV');
  });
});

describe('getBookCode', () => {
  it('returns the code for a canonical name', () => {
    expect(getBookCode('John')).toBe('JN');
  });

  it('returns undefined for an unknown name', () => {
    expect(getBookCode('Nonsense')).toBeUndefined();
  });

  it('is case-sensitive (canonical form only)', () => {
    expect(getBookCode('john')).toBeUndefined();
  });
});
