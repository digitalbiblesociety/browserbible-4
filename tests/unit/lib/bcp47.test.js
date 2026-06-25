import { describe, it, expect } from 'vitest';
import { toBcp47Lang } from '@lib/bcp47.js';

describe('toBcp47Lang', () => {
  it('maps a 3-letter ISO 639-3 code to its 639-1 equivalent', () => {
    expect(toBcp47Lang('eng')).toBe('en');
    expect(toBcp47Lang('spa')).toBe('es');
    expect(toBcp47Lang('kor')).toBe('ko');
    expect(toBcp47Lang('heb')).toBe('he');
    expect(toBcp47Lang('ell')).toBe('el');
  });

  it('preserves a script/region suffix while converting the primary subtag', () => {
    expect(toBcp47Lang('eng-Latn-US')).toBe('en-Latn-US');
    expect(toBcp47Lang('heb-Hebr')).toBe('he-Hebr');
  });

  it('leaves 639-3 codes with no 639-1 equivalent unchanged (valid BCP-47)', () => {
    expect(toBcp47Lang('grc')).toBe('grc');
    expect(toBcp47Lang('agr')).toBe('agr');
    expect(toBcp47Lang('hbo')).toBe('hbo');
  });

  it('normalizes case of the primary subtag to lowercase', () => {
    expect(toBcp47Lang('ENG')).toBe('en');
    expect(toBcp47Lang('Grc')).toBe('grc');
  });

  it('passes through an already-valid 2-letter code', () => {
    expect(toBcp47Lang('en')).toBe('en');
    expect(toBcp47Lang('he')).toBe('he');
  });

  it('resolves common individual-language codes to a macrolanguage', () => {
    expect(toBcp47Lang('cmn')).toBe('zh');
    expect(toBcp47Lang('arb')).toBe('ar');
  });

  it('returns falsy input unchanged', () => {
    expect(toBcp47Lang('')).toBe('');
    expect(toBcp47Lang(undefined)).toBe(undefined);
    expect(toBcp47Lang(null)).toBe(null);
  });
});
