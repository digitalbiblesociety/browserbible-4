import { describe, it, expect } from 'vitest';
import { parsePassageReference, getBookName } from '@windows/ParallelsWindow.js';

/** Flatten the section groups into a plain list of fragment ids. */
const frags = (passage, bookid) =>
  parsePassageReference(passage, bookid).flatMap((g) => g.fragmentids);

describe('parsePassageReference', () => {
  it('parses a single verse', () => {
    expect(parsePassageReference('1:3', 'JD')).toEqual([
      { sectionid: 'JD1', fragmentids: ['JD1_3'] }
    ]);
  });

  it('parses a verse range', () => {
    expect(frags('2:2-3', 'P2')).toEqual(['P22_2', 'P22_3']);
  });

  it('parses comma-separated verse lists', () => {
    expect(frags('5:1,2', 'MT')).toEqual(['MT5_1', 'MT5_2']);
  });

  it('parses mixed ranges and lists like "1:1-12, 14-17"', () => {
    const ids = frags('1:1-12, 14-17', 'MK');
    expect(ids).toHaveLength(16);
    expect(ids[0]).toBe('MK1_1');
    expect(ids[11]).toBe('MK1_12');
    expect(ids[12]).toBe('MK1_14');
    expect(ids[15]).toBe('MK1_17');
  });

  it('parses semicolon-separated chapter segments like "8:28-34; 9:1"', () => {
    // Regression: the second segment used to be silently dropped.
    expect(parsePassageReference('8:28-34; 9:1', 'MT')).toEqual([
      { sectionid: 'MT8', fragmentids: ['MT8_28', 'MT8_29', 'MT8_30', 'MT8_31', 'MT8_32', 'MT8_33', 'MT8_34'] },
      { sectionid: 'MT9', fragmentids: ['MT9_1'] }
    ]);
  });

  it('parses cross-chapter ranges like "8:32-9:9"', () => {
    // Regression: these used to produce no verses at all. Mark 8 has 38 verses.
    const groups = parsePassageReference('8:32-9:9', 'MK');
    expect(groups.map((g) => g.sectionid)).toEqual(['MK8', 'MK9']);
    expect(groups[0].fragmentids[0]).toBe('MK8_32');
    expect(groups[0].fragmentids).toHaveLength(7); // 32..38
    expect(groups[1].fragmentids[0]).toBe('MK9_1');
    expect(groups[1].fragmentids[8]).toBe('MK9_9');
  });

  it('tolerates whitespace inside cross-chapter ranges like "15:39- 16:12"', () => {
    const groups = parsePassageReference('15:39- 16:12', 'MT');
    expect(groups.map((g) => g.sectionid)).toEqual(['MT15', 'MT16']);
    expect(groups[0].fragmentids[0]).toBe('MT15_39'); // Matthew 15 has 39 verses
    expect(groups[1].fragmentids).toHaveLength(12);
  });

  it('carries the chapter across comma items in "9:35-38; 10:1,5-42; 11:1"', () => {
    // The Campbell "Twelve Sent Forth" reference
    const groups = parsePassageReference('9:35-38; 10:1,5-42; 11:1', 'MT');
    expect(groups.map((g) => g.sectionid)).toEqual(['MT9', 'MT10', 'MT11']);
    expect(groups[1].fragmentids).toEqual([
      'MT10_1',
      ...Array.from({ length: 38 }, (_, i) => `MT10_${i + 5}`) // 5..42
    ]);
  });

  it('expands a bare chapter reference to the whole chapter', () => {
    const ids = frags('13', 'MT');
    expect(ids[0]).toBe('MT13_1');
    expect(ids).toHaveLength(58); // Matthew 13 has 58 verses
  });

  it('trims stray whitespace like "12:19-22 "', () => {
    expect(frags('12:19-22 ', 'R1')).toEqual(['R112_19', 'R112_20', 'R112_21', 'R112_22']);
  });

  it('returns nothing (without throwing) for malformed input', () => {
    expect(parsePassageReference('1:29:34', 'MK')).toEqual([]);
    expect(parsePassageReference('', 'MT')).toEqual([]);
    expect(parsePassageReference('nonsense', 'MT')).toEqual([]);
  });

  it('produces no verses for an inverted range', () => {
    expect(parsePassageReference('2:9-2', 'MT')).toEqual([]);
  });
});

describe('getBookName', () => {
  it('prefers the text’s own division names', () => {
    const textInfo = {
      lang: 'fra',
      divisions: ['GN', 'EX'],
      divisionNames: ['Genèse', 'Exode']
    };
    expect(getBookName(textInfo, 'EX')).toBe('Exode');
  });

  it('falls back to English book names for languages without registered names', () => {
    // Regression: this used to throw and blank the whole table.
    const textInfo = { lang: 'xyz' };
    expect(getBookName(textInfo, 'MT')).toBe('Matthew');
  });

  it('handles a missing textInfo', () => {
    expect(getBookName(null, 'JN')).toBe('John');
  });

  it('falls back to the book code for unknown books', () => {
    expect(getBookName({ lang: 'eng' }, 'ZZ')).toBe('ZZ');
  });
});
