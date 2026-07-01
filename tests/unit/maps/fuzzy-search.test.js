import { describe, it, expect } from 'vitest';
import {
  searchLocations,
  fuzzySearchLocations,
  parseReferenceQuery
} from '@windows/MapWindow/fuzzy-search.js';

const locations = [
  { name: 'Jerusalem', verses: new Array(500).fill('PS122_2') },
  { name: 'Jericho', verses: new Array(50).fill('JS6_1') },
  { name: 'Jeruel', verses: ['2CH20_16'] },
  { name: 'Bethlehem', verses: ['MT2_1', 'LK2_4'] },
  { name: 'Beth-jeshimoth', verses: ['NM33_49'] },
  { name: 'Salem', verses: ['GN14_18'], altNames: ['Zion City'] }
];

describe('searchLocations', () => {
  it('ranks exact > prefix > contains', () => {
    const { results } = searchLocations('salem', locations);
    const names = results.map(r => r.location.name);
    // 'Salem' is exact; 'Jerusalem' only contains 'salem'
    expect(names[0]).toBe('Salem');
    expect(names).toContain('Jerusalem');
    expect(names.indexOf('Salem')).toBeLessThan(names.indexOf('Jerusalem'));
  });

  it('reports the total match count beyond the returned limit', () => {
    const { results, total } = searchLocations('je', locations, 2);
    expect(results).toHaveLength(2);
    expect(total).toBeGreaterThan(2);
  });

  it('breaks score ties by verse count', () => {
    // Duplicate names exist in the real data (e.g. two Antiochs) — both score
    // as exact matches, so the one mentioned in more verses ranks first.
    const antiochs = [
      { name: 'Antioch', verses: ['AC13_14'] },
      { name: 'Antioch', verses: ['AC11_19', 'AC11_26', 'GL2_11'] }
    ];
    const { results } = searchLocations('antioch', antiochs);
    expect(results[0].location.verses).toHaveLength(3);
    expect(results[1].location.verses).toHaveLength(1);
  });

  it('matches altNames and reports which one hit', () => {
    const { results } = searchLocations('zion city', locations);
    expect(results[0].location.name).toBe('Salem');
    expect(results[0].altName).toBe('Zion City');
  });

  it('does not set altName for primary-name matches', () => {
    const { results } = searchLocations('bethlehem', locations);
    expect(results[0].location.name).toBe('Bethlehem');
    expect(results[0].altName).toBeNull();
  });

  it('handles empty input', () => {
    expect(searchLocations('', locations)).toEqual({ results: [], total: 0 });
    expect(searchLocations('salem', null)).toEqual({ results: [], total: 0 });
  });
});

describe('fuzzySearchLocations (legacy shape)', () => {
  it('returns plain location objects', () => {
    const results = fuzzySearchLocations('salem', locations);
    expect(results[0]).toBe(locations[5]);
  });

  it('respects the limit', () => {
    expect(fuzzySearchLocations('je', locations, 2)).toHaveLength(2);
  });
});

describe('parseReferenceQuery', () => {
  it('parses book + chapter into a section id', () => {
    expect(parseReferenceQuery('John 3')).toBe('JN3');
    expect(parseReferenceQuery('genesis 12')).toBe('GN12');
  });

  it('parses short codes', () => {
    expect(parseReferenceQuery('JN3')).toBe('JN3');
  });

  it('returns null for plain place names', () => {
    expect(parseReferenceQuery('Jerusalem')).toBeNull();
    expect(parseReferenceQuery('Bethlehem')).toBeNull();
  });

  it('does not mistake a place name followed by a number for a book', () => {
    expect(parseReferenceQuery('Jerusalem 12')).toBeNull();
  });

  it('returns null for empty or digit-less input', () => {
    expect(parseReferenceQuery('')).toBeNull();
    expect(parseReferenceQuery(null)).toBeNull();
    expect(parseReferenceQuery('John')).toBeNull();
  });
});
