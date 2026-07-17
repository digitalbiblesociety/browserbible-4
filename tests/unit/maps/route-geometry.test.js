import { describe, it, expect } from 'vitest';
import {
  legPointsToSvg,
  catmullRomPath,
  buildLegPath,
  journeyBoundsLocations
} from '@windows/MapWindow/route-geometry.js';
import { geoToSvg } from '@windows/MapWindow/geo-utils.js';

const round2 = (n) => Math.round(n * 100) / 100;

describe('legPointsToSvg', () => {
  it('projects from + via + to, in order, through geoToSvg', () => {
    const from = [36.16, 36.2];
    const via = [[35.2, 35.85], [34.5, 35.35]];
    const to = [33.9, 35.18];

    const points = legPointsToSvg(from, via, to);

    expect(points).toHaveLength(4);
    expect(points[0]).toEqual(geoToSvg(36.16, 36.2));
    expect(points[1]).toEqual(geoToSvg(35.2, 35.85));
    expect(points[2]).toEqual(geoToSvg(34.5, 35.35));
    expect(points[3]).toEqual(geoToSvg(33.9, 35.18));
  });

  it('handles a missing via list', () => {
    const points = legPointsToSvg([36, 36], undefined, [35, 35]);
    expect(points).toHaveLength(2);
  });
});

describe('catmullRomPath', () => {
  it('returns empty string for fewer than 2 points', () => {
    expect(catmullRomPath([])).toBe('');
    expect(catmullRomPath([{ x: 1, y: 2 }])).toBe('');
    expect(catmullRomPath(null)).toBe('');
  });

  it('starts with M at the first point and has one C segment per span', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }, { x: 30, y: 5 }];
    const d = catmullRomPath(points);

    expect(d.startsWith('M0,0')).toBe(true);
    expect(d.split('C')).toHaveLength(points.length); // n-1 C segments
  });

  it('ends at the last input point', () => {
    const points = [{ x: 0, y: 0 }, { x: 13.333, y: 7.777 }, { x: 25.5, y: 1.25 }];
    const d = catmullRomPath(points);
    const lastPair = d.trim().split(' ').pop();
    expect(lastPair).toBe(`${round2(25.5)},${round2(1.25)}`);
  });

  it('produces no NaN values', () => {
    const points = [{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 5, y: 5 }, { x: 10, y: 0 }];
    expect(catmullRomPath(points)).not.toMatch(/NaN/);
  });

  it('keeps a two-point path straight (control points on the chord)', () => {
    const d = catmullRomPath([{ x: 0, y: 0 }, { x: 60, y: 30 }]);
    // Both control points lie at 1/6 and 5/6 along the chord
    expect(d).toBe('M0,0 C10,5 50,25 60,30');
  });

  it('keeps collinear points collinear', () => {
    const points = [{ x: 0, y: 10 }, { x: 20, y: 10 }, { x: 50, y: 10 }, { x: 90, y: 10 }];
    const d = catmullRomPath(points);
    // Every y coordinate in the path stays on the line y=10
    const ys = [...d.matchAll(/,(-?[\d.]+)/g)].map(m => parseFloat(m[1]));
    expect(ys.length).toBeGreaterThan(0);
    ys.forEach(y => expect(y).toBe(10));
  });

  it('tension 0 collapses to straight segments between points', () => {
    const points = [{ x: 0, y: 0 }, { x: 10, y: 20 }, { x: 30, y: 0 }];
    const d = catmullRomPath(points, 0);
    expect(d).toBe('M0,0 C0,0 10,20 10,20 C10,20 30,0 30,0');
  });
});

describe('buildLegPath', () => {
  it('is catmullRomPath over the projected leg points', () => {
    const from = [35.9, 36.1];
    const via = [[35.2, 35.85]];
    const to = [33.9, 35.18];
    expect(buildLegPath(from, via, to))
      .toBe(catmullRomPath(legPointsToSvg(from, via, to)));
  });
});

describe('journeyBoundsLocations', () => {
  const journey = {
    stops: [
      { id: 'a', coordinates: [36, 36] },
      { id: 'b', coordinates: [33, 35] }
    ],
    legs: [
      { from: 'a', to: 'b', mode: 'sea', via: [[35, 35.5], [34, 35.2]] },
      { from: 'b', to: 'a', mode: 'land' }
    ]
  };

  it('includes every stop and via coordinate', () => {
    const locations = journeyBoundsLocations(journey);
    expect(locations.map(l => l.coordinates)).toEqual([
      [36, 36], [33, 35], [35, 35.5], [34, 35.2]
    ]);
  });

  it('handles journeys with no legs', () => {
    expect(journeyBoundsLocations({ stops: [{ coordinates: [1, 2] }] }))
      .toEqual([{ coordinates: [1, 2] }]);
  });
});
