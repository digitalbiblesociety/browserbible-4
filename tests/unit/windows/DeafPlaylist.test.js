import { describe, it, expect } from 'vitest';
import { DeafPlaylist, durationToSeconds } from '@windows/DeafPlaylist.js';

const P = (over) => ({
  sectionid: 'GN1',
  verse: 1,
  book: 'Genesis',
  reference: 'Genesis 1:1-31',
  title: 'Creation',
  web_url: 'https://video.dbs.org/high/gn1.mp4',
  web_url_low: 'https://video.dbs.org/low/gn1_360.mp4',
  cover: 'https://video.dbs.org/covers/gn1.webp',
  length: '5:21',
  ...over
});

describe('durationToSeconds', () => {
  it('parses MM:SS and HH:MM:SS', () => {
    expect(durationToSeconds('5:21')).toBe(321);
    expect(durationToSeconds('0:45')).toBe(45);
    expect(durationToSeconds('1:02:03')).toBe(3723);
  });
  it('accepts numbers and rejects junk', () => {
    expect(durationToSeconds(90)).toBe(90);
    expect(durationToSeconds('')).toBe(0);
    expect(durationToSeconds('abc')).toBe(0);
    expect(durationToSeconds(undefined)).toBe(0);
  });
});

describe('DeafPlaylist', () => {
  const passages = [
    P({ sectionid: 'GN1', verse: 1, reference: 'Genesis 1:1-31; 2:1-4', length: '5:00' }),
    P({ sectionid: 'GN2', verse: 5, reference: 'Genesis 2:5-25', length: '3:00' }),
    P({ sectionid: 'GN2', verse: 18, reference: 'Genesis 2:18-24', length: '2:00' }),
    P({ sectionid: 'JN1', verse: 1, book: 'John', reference: 'John 1:1-18', length: '4:00' })
  ];
  const pl = DeafPlaylist(passages);

  it('flattens into ordered items with fragment ids and durations', () => {
    expect(pl.length).toBe(4);
    expect(pl.items.map((i) => i.fragmentid)).toEqual(['GN1_1', 'GN2_5', 'GN2_18', 'JN1_1']);
    expect(pl.get(0).durationSec).toBe(300);
    expect(pl.get(0).urlLow).toContain('/low/');
    expect(pl.get(0).bookid).toBe('GN');
    expect(pl.get(3).bookid).toBe('JN');
  });

  it('resolves indexes by fragment and section, with section fallback', () => {
    expect(pl.indexOfFragment('GN2_18')).toBe(2);
    expect(pl.indexOfSection('GN2')).toBe(1); // first item of the section
    // unknown verse in a known section falls back to that section's first item
    expect(pl.indexOfFragment('GN2_99')).toBe(1);
    expect(pl.indexOfFragment('ZZ9_9')).toBe(-1);
  });

  it('navigates next/prev with bounds', () => {
    expect(pl.next(0)).toBe(1);
    expect(pl.next(3)).toBe(-1);
    expect(pl.prev(0)).toBe(-1);
    expect(pl.prev(2)).toBe(1);
  });

  it('lists ordered unique sections and per-book sections', () => {
    expect(pl.sections).toEqual(['GN1', 'GN2', 'JN1']);
    expect(pl.sectionsForBook('GN')).toEqual(['GN1', 'GN2']);
    expect(pl.sectionsForBook('JN')).toEqual(['JN1']);
  });

  it('builds a per-chapter timeline with cumulative fractions', () => {
    const tl = pl.chapterTimeline('GN2'); // two passages: 180s + 120s = 300s
    expect(tl.total).toBe(300);
    expect(tl.markers).toHaveLength(2);
    expect(tl.markers[0]).toMatchObject({ startSec: 0, endSec: 180, startFraction: 0 });
    expect(tl.markers[1].startSec).toBe(180);
    expect(tl.markers[1].startFraction).toBeCloseTo(0.6, 5);
    expect(tl.markers[1].endFraction).toBeCloseTo(1, 5);
  });

  it('is empty for no passages', () => {
    const empty = DeafPlaylist([]);
    expect(empty.isEmpty).toBe(true);
    expect(empty.indexOfFragment('GN1_1')).toBe(-1);
    expect(empty.chapterTimeline('GN1')).toEqual({ total: 0, markers: [] });
  });
});
