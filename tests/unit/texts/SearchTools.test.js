import { describe, it, expect } from 'vitest';
import { SearchTools } from '@texts/Search.js';

describe('SearchTools.splitWords', () => {
  it('splits simple ASCII words', () => {
    expect(SearchTools.splitWords('Hello world')).toEqual(['Hello', 'world']);
  });

  it('strips trailing punctuation but preserves intra-word apostrophes/hyphens', () => {
    expect(SearchTools.splitWords("don't, can't!")).toEqual(["don't", "can't"]);
    expect(SearchTools.splitWords('three-fold cord')).toEqual(['three-fold', 'cord']);
  });

  it("strips possessive 's", () => {
    expect(SearchTools.splitWords("God's word")).toEqual(['God', 'word']);
  });

  it('treats CJK characters as their own words', () => {
    const result = SearchTools.splitWords('你好 world');
    expect(result).toContain('你');
    expect(result).toContain('好');
    expect(result).toContain('world');
  });

  it('drops duplicates', () => {
    expect(SearchTools.splitWords('the the and and')).toEqual(['the', 'and']);
  });

  it('strips regex meta chars and Chinese punctuation', () => {
    expect(SearchTools.splitWords('hello (world).')).toEqual(['hello', 'world']);
    expect(SearchTools.splitWords('你好。世界')).toEqual(['你', '好', '世', '界']);
  });

  it('coerces non-string input', () => {
    expect(SearchTools.splitWords(42)).toEqual(['42']);
  });
});

describe('SearchTools.createSearchTerms', () => {
  it('builds AND terms for plain unquoted ASCII input', () => {
    const terms = SearchTools.createSearchTerms('jesus christ');
    expect(terms).toHaveLength(2);
    expect(terms[0].source).toContain('jesus');
    expect(terms[1].source).toContain('christ');
    expect(terms.every(r => r.flags.includes('g') && r.flags.includes('i'))).toBe(true);
  });

  it('treats explicit AND as a separator', () => {
    const terms = SearchTools.createSearchTerms('jesus AND christ');
    expect(terms).toHaveLength(2);
  });

  it('deduplicates AND terms', () => {
    const terms = SearchTools.createSearchTerms('love love love');
    expect(terms).toHaveLength(1);
  });

  it('builds a single phrase regex for quoted input', () => {
    const terms = SearchTools.createSearchTerms('"jesus christ"');
    expect(terms).toHaveLength(1);
    expect(terms[0].test('Jesus Christ')).toBe(true);
    expect(terms[0].test('Jesus the Christ')).toBe(false);
  });

  it('falls back to splitWords for non-ASCII (CJK) text', () => {
    const terms = SearchTools.createSearchTerms('你好');
    expect(terms.length).toBeGreaterThan(0);
    expect(terms.every(r => r instanceof RegExp)).toBe(true);
  });

  it('builds Strong-number regexes when isLemmaSearch=true', () => {
    const terms = SearchTools.createSearchTerms('G2424 G5547', true);
    expect(terms).toHaveLength(2);
    expect(terms[0].source).toContain('2424');
    expect(terms[1].source).toContain('5547');
  });

  it('AND-term regex matches word as a standalone token', () => {
    const [re] = SearchTools.createSearchTerms('love');
    expect('I love you'.match(re)).not.toBeNull();
    expect('beloved'.match(re)).toBeNull();
  });
});

describe('SearchTools.hashWord', () => {
  it('produces a value in [0, HASHSIZE)', () => {
    for (const w of ['', 'a', 'jesus', 'Christ', 'verylongword']) {
      const h = SearchTools.hashWord(w);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(SearchTools.HASHSIZE);
    }
  });

  it('is stable for the same input', () => {
    expect(SearchTools.hashWord('Jesus')).toBe(SearchTools.hashWord('Jesus'));
  });

  it('differs (typically) for different inputs', () => {
    // Not guaranteed by hashing, but with HASHSIZE=20 these spread.
    const set = new Set(['the', 'lord', 'is', 'my', 'shepherd'].map(w => SearchTools.hashWord(w)));
    expect(set.size).toBeGreaterThan(1);
  });
});
