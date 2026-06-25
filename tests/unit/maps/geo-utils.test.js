import { describe, it, expect } from 'vitest';
import { getImportanceTier, geoToSvg, svgToGeo } from '@windows/MapWindow/geo-utils.js';
import { MAP_BOUNDS, PADDING, CONTENT_WIDTH, CONTENT_HEIGHT, PROJ_COS_PHI0 } from '@windows/MapWindow/constants.js';

describe('getImportanceTier', () => {
  it('returns 1 for an important named location regardless of verse count', () => {
    expect(getImportanceTier({ name: 'Rome', verses: [] })).toBe(1);
  });

  it('returns 1 for any location with 10+ verses', () => {
    expect(getImportanceTier({ name: 'Some Town', verses: new Array(10) })).toBe(1);
  });

  it('returns 2 for 5-9 verses', () => {
    expect(getImportanceTier({ name: 'X', verses: new Array(5) })).toBe(2);
    expect(getImportanceTier({ name: 'X', verses: new Array(9) })).toBe(2);
  });

  it('returns 3 for 3-4 verses', () => {
    expect(getImportanceTier({ name: 'X', verses: new Array(3) })).toBe(3);
    expect(getImportanceTier({ name: 'X', verses: new Array(4) })).toBe(3);
  });

  it('returns 4 for fewer than 3 verses', () => {
    expect(getImportanceTier({ name: 'X', verses: [] })).toBe(4);
    expect(getImportanceTier({ name: 'X', verses: [1, 2] })).toBe(4);
  });

  it('returns 4 for a demoted location even when it has many verses', () => {
    expect(getImportanceTier({ name: 'Hazor', verses: new Array(20) })).toBe(4);
  });

  it('handles missing verses array', () => {
    expect(getImportanceTier({ name: 'X' })).toBe(4);
  });
});

describe('geoToSvg / svgToGeo', () => {
  it('round-trips a coordinate', () => {
    const lon = 35;
    const lat = 31.5;
    const svg = geoToSvg(lon, lat);
    const geo = svgToGeo(svg.x, svg.y);
    expect(geo.lon).toBeCloseTo(lon, 6);
    expect(geo.lat).toBeCloseTo(lat, 6);
  });

  it('top-left of bounds maps to the padding origin', () => {
    const { x, y } = geoToSvg(MAP_BOUNDS.minLon, MAP_BOUNDS.maxLat);
    expect(x).toBeCloseTo(PADDING, 6);
    expect(y).toBeCloseTo(PADDING, 6);
  });

  it('bottom-right of bounds maps to the content extent', () => {
    const { x, y } = geoToSvg(MAP_BOUNDS.maxLon, MAP_BOUNDS.minLat);
    expect(x).toBeCloseTo(PADDING + CONTENT_WIDTH, 6);
    expect(y).toBeCloseTo(PADDING + CONTENT_HEIGHT, 6);
  });

  it('uses square pixels: a 1° lon span is cos(φ0)× a 1° lat span', () => {
    // Corrected equirectangular: longitude is compressed by cos(standard parallel).
    const lonSpan = geoToSvg(36, 31.5).x - geoToSvg(35, 31.5).x;
    const latSpan = geoToSvg(35, 32).y - geoToSvg(35, 31).y; // 1° of latitude (y grows southward)
    expect(lonSpan / Math.abs(latSpan)).toBeCloseTo(PROJ_COS_PHI0, 6);
  });
});
