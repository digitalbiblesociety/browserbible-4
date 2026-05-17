import { describe, it, expect } from 'vitest';
import {
  getTextIdForLanguage,
  getTextId,
  buildVerseUrl
} from '@verse-detection/VerseUrlBuilder.ts';

describe('getTextIdForLanguage', () => {
  it('returns the matching language id when present', () => {
    expect(getTextIdForLanguage('es', { es: 'SPNRVG', en: 'ENGKJV' })).toBe('SPNRVG');
  });

  it('falls back to defaultTextId', () => {
    expect(getTextIdForLanguage('fr', { en: 'ENGKJV' }, 'ENGDEFAULT')).toBe('ENGDEFAULT');
  });

  it('falls back to en when no default and no match', () => {
    expect(getTextIdForLanguage('fr', { en: 'ENGKJV' })).toBe('ENGKJV');
  });

  it('returns empty string when nothing matches', () => {
    expect(getTextIdForLanguage('fr', {})).toBe('');
  });
});

describe('getTextId', () => {
  it('returns explicit textId when no detected language', () => {
    expect(getTextId(null, { contentSource: { textId: 'ENGKJV' } })).toBe('ENGKJV');
  });

  it('uses textIdsByLanguage for detected language', () => {
    expect(getTextId('es', {
      contentSource: { textIdsByLanguage: { es: 'SPNRVG', en: 'ENGKJV' } }
    })).toBe('SPNRVG');
  });

  it('returns null when detected language has no available text (no fallback)', () => {
    expect(getTextId('fr', {
      contentSource: { textIdsByLanguage: { en: 'ENGKJV' } }
    })).toBeNull();
  });

  it('falls back to defaultTextId when no detected language', () => {
    expect(getTextId(null, { defaultTextId: 'ENGDEFAULT' })).toBe('ENGDEFAULT');
  });

  it('auto-selects from primary language when configured', () => {
    expect(getTextId(null, {
      contentSource: { autoSelectByLanguage: true, textIdsByLanguage: { es: 'SPNRVG' } },
      language: { primary: 'es' }
    })).toBe('SPNRVG');
  });
});

describe('buildVerseUrl', () => {
  const baseConfig = {
    appBaseUrl: 'https://example.com',
    contentSource: { textIdsByLanguage: { en: 'ENGKJV' } },
    link: { useHashNavigation: true, refParam: 'ref' },
    versionLinking: { includeVersion: false }
  };

  it('builds a hash URL with sectionId+verse fragment', () => {
    const url = buildVerseUrl(
      { book: 'John', reference: '3:16', detectedLanguage: 'en' },
      baseConfig
    );
    expect(url).toBe('https://example.com#JN3_16');
  });

  it('falls back to chapter-only fragment when no verse', () => {
    const url = buildVerseUrl(
      { book: 'John', reference: '3', detectedLanguage: 'en' },
      baseConfig
    );
    expect(url).toBe('https://example.com#JN3');
  });

  it('uses query param when hash navigation disabled', () => {
    const url = buildVerseUrl(
      { book: 'John', reference: '3:16', detectedLanguage: 'en' },
      { ...baseConfig, link: { useHashNavigation: false, refParam: 'ref' } }
    );
    expect(url).toContain('ref=John%203%3A16');
  });

  it('appends version param when versionLinking.includeVersion=true', () => {
    const url = buildVerseUrl(
      { book: 'John', reference: '3:16', detectedLanguage: 'en' },
      { ...baseConfig, versionLinking: { includeVersion: true, versionParam: 'v' } }
    );
    expect(url).toContain('v=ENGKJV');
  });

  it('expands urlTemplate placeholders', () => {
    const url = buildVerseUrl(
      { book: 'John', reference: '3:16', detectedLanguage: 'en' },
      { ...baseConfig, link: { urlTemplate: '/bible/{bookCode}/{chapter}/{verse}' } }
    );
    expect(url).toBe('/bible/JN/3/16');
  });

  it('uses explicit version over detected language', () => {
    const url = buildVerseUrl(
      { book: 'John', reference: '3:16', detectedLanguage: 'en', version: 'NIV' },
      { ...baseConfig, versionLinking: { includeVersion: true, versionParam: 'v' } }
    );
    expect(url).toContain('v=NIV');
  });
});
