import { describe, it, expect } from 'vitest';
import { jaroWinkler, fuzzyIncludes, matchRanges, FUZZY_THRESHOLD } from '@lib/fuzzy.js';

describe('jaroWinkler', () => {
  it('returns 1 for identical strings', () => {
    expect(jaroWinkler('amharic', 'amharic')).toBe(1);
  });

  it('returns 0 for strings with nothing in common', () => {
    expect(jaroWinkler('cat', 'dog')).toBe(0);
  });

  it('returns 0 when either string is empty', () => {
    expect(jaroWinkler('', 'english')).toBe(0);
    expect(jaroWinkler('english', '')).toBe(0);
  });

  it('scores common typos above the fuzzy threshold', () => {
    expect(jaroWinkler('englsh', 'english')).toBeGreaterThan(FUZZY_THRESHOLD); // dropped letter
    expect(jaroWinkler('grek', 'greek')).toBeGreaterThan(FUZZY_THRESHOLD); // dropped letter
    expect(jaroWinkler('standrd', 'standard')).toBeGreaterThan(FUZZY_THRESHOLD); // dropped letter
    expect(jaroWinkler('martian', 'martin')).toBeGreaterThan(FUZZY_THRESHOLD); // transposition
    expect(jaroWinkler('nwe', 'new')).toBeGreaterThan(FUZZY_THRESHOLD); // short-word transposition
  });

  it('scores different short abbreviations below the fuzzy threshold', () => {
    expect(jaroWinkler('kjv', 'njv')).toBeLessThan(FUZZY_THRESHOLD);
    expect(jaroWinkler('esv', 'niv')).toBeLessThan(FUZZY_THRESHOLD);
  });

  it('boosts shared prefixes (Winkler adjustment)', () => {
    // Same edit distance, but the shared prefix should score higher.
    expect(jaroWinkler('greek', 'grek')).toBeGreaterThan(jaroWinkler('greek', 'reekg'));
  });
});

describe('fuzzyIncludes', () => {
  const text = 'king james version kjv english';
  const words = text.split(' ');

  it('matches exact substrings', () => {
    expect(fuzzyIncludes(text, words, 'james')).toBe(true);
    expect(fuzzyIncludes(text, words, 'kj')).toBe(true);
  });

  it('matches typos against individual words', () => {
    expect(fuzzyIncludes(text, words, 'jams')).toBe(true);
    expect(fuzzyIncludes(text, words, 'versoin')).toBe(true);
  });

  it('rejects non-matches', () => {
    expect(fuzzyIncludes(text, words, 'spanish')).toBe(false);
  });

  it('does not fuzzy-match tokens shorter than 3 characters', () => {
    expect(fuzzyIncludes(text, words, 'xj')).toBe(false);
  });
});

describe('matchRanges', () => {
  it('finds a substring match case-insensitively', () => {
    expect(matchRanges('King James Version', ['jam'])).toEqual([[5, 8]]);
  });

  it('falls back to the best fuzzy-matched word for typos', () => {
    expect(matchRanges('King James Version', ['versoin'])).toEqual([[11, 18]]);
  });

  it('merges overlapping ranges from multiple tokens', () => {
    expect(matchRanges('King James Version', ['king', 'ing'])).toEqual([[0, 4]]);
  });

  it('keeps disjoint ranges separate and ordered', () => {
    expect(matchRanges('King James Version', ['version', 'king'])).toEqual([[0, 4], [11, 18]]);
  });

  it('returns no ranges when nothing matches', () => {
    expect(matchRanges('King James Version', ['zzz'])).toEqual([]);
  });
});
