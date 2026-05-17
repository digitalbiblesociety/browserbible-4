import { describe, it, expect } from 'vitest';
import {
  normalizeLangCode,
  getLanguageName,
  buildTextIdsByLanguage
} from '@verse-detection/LanguageCodeMapper.ts';

describe('normalizeLangCode', () => {
  it('maps ISO 639-3 to ISO 639-1', () => {
    expect(normalizeLangCode('eng')).toBe('en');
    expect(normalizeLangCode('spa')).toBe('es');
    expect(normalizeLangCode('cmn')).toBe('zh'); // Mandarin → zh
  });

  it('is case-insensitive on the input', () => {
    expect(normalizeLangCode('ENG')).toBe('en');
  });

  it('falls back to language name when code is unknown', () => {
    expect(normalizeLangCode('xyz', 'Spanish')).toBe('es');
    expect(normalizeLangCode(undefined, 'English')).toBe('en');
  });

  it('returns lowercased input as fallback when neither maps', () => {
    expect(normalizeLangCode('ZZZ')).toBe('zzz');
  });

  it('returns null when given nothing usable', () => {
    expect(normalizeLangCode(undefined)).toBeNull();
  });
});

describe('getLanguageName', () => {
  it('returns display name for known code', () => {
    expect(getLanguageName('en')).toBe('English');
    expect(getLanguageName('zh')).toBe('Chinese');
  });

  it('returns the input when unknown', () => {
    expect(getLanguageName('xx')).toBe('xx');
  });

  it('returns generic fallback for null/undefined', () => {
    expect(getLanguageName(null)).toBe('this language');
    expect(getLanguageName(undefined)).toBe('this language');
  });
});

describe('buildTextIdsByLanguage', () => {
  const sample = [
    { id: 'ENGKJV', name: 'KJV', lang: 'eng', langName: 'English', type: 'bible' },
    { id: 'ENGWEB', name: 'WEB', lang: 'eng', langName: 'English', type: 'bible' },
    { id: 'SPNRVG', name: 'Reina-Valera', lang: 'spa', langName: 'Spanish', type: 'bible' },
    { id: 'commentary_x', name: 'Comm', lang: 'eng', type: 'commentary' },
    { id: 'eng_empty', name: 'Empty', lang: 'eng', hasText: false, type: 'bible' }
  ];

  it('returns {} for null/non-array input', () => {
    expect(buildTextIdsByLanguage(null)).toEqual({});
    expect(buildTextIdsByLanguage(undefined)).toEqual({});
  });

  it('groups bibles by language code, skipping commentaries and empty texts', () => {
    const result = buildTextIdsByLanguage(sample);
    expect(result.en).toBeDefined();
    expect(result.es).toBe('SPNRVG');
    // Commentary and hasText:false should not appear as fallback choices
    expect(Object.values(result)).not.toContain('commentary_x');
    expect(Object.values(result)).not.toContain('eng_empty');
  });

  it('honors a preferred id', () => {
    const result = buildTextIdsByLanguage(sample, { en: 'ENGWEB' });
    expect(result.en).toBe('ENGWEB');
  });

  it('honors an array of preferred ids in order', () => {
    const result = buildTextIdsByLanguage(sample, { en: ['eng_doesnotexist', 'ENGKJV'] });
    expect(result.en).toBe('ENGKJV');
  });

  it('falls back to first-by-name when no preferred id matches', () => {
    const result = buildTextIdsByLanguage(sample, { en: ['eng_doesnotexist'] });
    // Sort by name → KJV before WEB
    expect(result.en).toBe('ENGKJV');
  });
});
