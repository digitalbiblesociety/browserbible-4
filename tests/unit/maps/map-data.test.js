import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadLocationData,
  indexLocationsByVerse,
  getLocationsForReference
} from '@windows/MapWindow/map-data.js';

const sample = [
  { name: 'Bethlehem', verses: ['MT2_1', 'MT2_5', 'LK2_4'] },
  { name: 'Nazareth', verses: ['LK1_26', 'LK2_4'] },
  { name: 'Jerusalem', verses: ['MT2_1', 'JN3_1'] }
];

describe('indexLocationsByVerse', () => {
  it('builds verse → [locations] map', () => {
    const idx = indexLocationsByVerse(sample);
    expect(idx['MT2_1']).toHaveLength(2);
    expect(idx['MT2_1'].map(l => l.name).sort()).toEqual(['Bethlehem', 'Jerusalem']);
    expect(idx['LK2_4'].map(l => l.name).sort()).toEqual(['Bethlehem', 'Nazareth']);
  });

  it('handles empty input', () => {
    expect(indexLocationsByVerse([])).toEqual({});
  });
});

describe('getLocationsForReference', () => {
  it('returns locations whose verses match the section prefix', () => {
    const locs = getLocationsForReference(sample, 'MT2');
    expect(locs.map(l => l.name).sort()).toEqual(['Bethlehem', 'Jerusalem']);
  });

  it('returns [] for unknown section', () => {
    expect(getLocationsForReference(sample, 'GN1')).toEqual([]);
  });

  it('does not match a longer chapter number sharing the same prefix', () => {
    const psalms = [
      { name: 'Zion', verses: ['PS119_5'] },
      { name: 'Jerusalem', verses: ['PS1_1'] }
    ];
    expect(getLocationsForReference(psalms, 'PS1').map(l => l.name)).toEqual(['Jerusalem']);
    expect(getLocationsForReference(psalms, 'PS11')).toEqual([]);

    const john = [{ name: 'Bethany', verses: ['JN11_1'] }];
    expect(getLocationsForReference(john, 'JN1')).toEqual([]);
    expect(getLocationsForReference(john, 'JN11').map(l => l.name)).toEqual(['Bethany']);
  });

  it('returns [] for null/empty inputs', () => {
    expect(getLocationsForReference(null, 'MT2')).toEqual([]);
    expect(getLocationsForReference(sample, '')).toEqual([]);
    expect(getLocationsForReference(sample, null)).toEqual([]);
  });
});

describe('loadLocationData', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('fetches and returns parsed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => sample
    })));
    const data = await loadLocationData();
    expect(data).toEqual(sample);
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));
    await expect(loadLocationData()).rejects.toThrow(/404/);
  });
});
