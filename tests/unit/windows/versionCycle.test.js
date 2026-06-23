import { describe, it, expect } from 'vitest';
import { versionHasSection, probeOrder } from '@windows/versionCycle.js';

describe('versionHasSection', () => {
  const text = { sections: ['GN1', 'GN2', 'MT1', 'MT2', 'JN1'] };

  it('returns true for an exact section match', () => {
    expect(versionHasSection(text, 'JN1')).toBe(true);
    expect(versionHasSection(text, 'GN2')).toBe(true);
  });

  it('returns false when the book/chapter is absent', () => {
    expect(versionHasSection(text, 'JN3')).toBe(false); // book present, chapter not
    expect(versionHasSection(text, 'RV1')).toBe(false); // book absent
  });

  it('matches on book+chapter despite zero-padding differences', () => {
    expect(versionHasSection({ sections: ['GN01', 'GN02'] }, 'GN1')).toBe(true);
    expect(versionHasSection({ sections: ['GN1', 'GN2'] }, 'GN02')).toBe(true);
  });

  it('assumes capable when there is no reference or no section list', () => {
    expect(versionHasSection(text, undefined)).toBe(true);
    expect(versionHasSection(text, '')).toBe(true);
    expect(versionHasSection({}, 'JN1')).toBe(true);
    expect(versionHasSection({ sections: [] }, 'JN1')).toBe(true);
    expect(versionHasSection(null, 'JN1')).toBe(true);
  });
});

describe('probeOrder', () => {
  it('steps forward and wraps around, excluding the start', () => {
    expect(probeOrder(4, 0, 1)).toEqual([1, 2, 3]);
    expect(probeOrder(4, 2, 1)).toEqual([3, 0, 1]);
  });

  it('steps backward and wraps around, excluding the start', () => {
    expect(probeOrder(4, 0, -1)).toEqual([3, 2, 1]);
    expect(probeOrder(4, 2, -1)).toEqual([1, 0, 3]);
  });

  it('produces len-1 entries covering every other index exactly once', () => {
    const order = probeOrder(5, 3, 1);
    expect(order).toHaveLength(4);
    expect(new Set(order)).toEqual(new Set([0, 1, 2, 4]));
    expect(order).not.toContain(3);
  });

  it('returns an empty list for a single version', () => {
    expect(probeOrder(1, 0, 1)).toEqual([]);
  });
});
