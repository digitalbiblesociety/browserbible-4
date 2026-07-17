/**
 * Validates the real journeys.json against the real maps.json: referential
 * integrity of legs, coordinate bounds, verse formats, and that every stop
 * resolves to an actual maps.json location record.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAP_BOUNDS } from '@windows/MapWindow/constants.js';
import { resolveStopLocation } from '@windows/MapWindow/map-data.js';

const read = (rel) => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8'));
const journeys = read('../../../browserbible/public/content/maps/journeys.json');
const locations = read('../../../browserbible/public/content/maps/maps.json');

// Two-char book code, chapter, underscore, verse (e.g. AC13_4, K25_12)
const VERSE_ID = /^[A-Z][A-Z0-9]\d+_\d+$/;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

const inBounds = ([lon, lat]) =>
  lon >= MAP_BOUNDS.minLon && lon <= MAP_BOUNDS.maxLon &&
  lat >= MAP_BOUNDS.minLat && lat <= MAP_BOUNDS.maxLat;

describe('journeys.json', () => {
  it('is a non-empty array of journeys with unique ids', () => {
    expect(Array.isArray(journeys)).toBe(true);
    expect(journeys.length).toBeGreaterThan(0);
    const ids = journeys.map(j => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  for (const journey of journeys) {
    describe(journey.id, () => {
      it('has a name, hex color, stops, and legs', () => {
        expect(journey.name).toBeTruthy();
        expect(journey.color).toMatch(HEX_COLOR);
        expect(journey.stops.length).toBeGreaterThan(1);
        expect(journey.legs.length).toBeGreaterThan(0);
      });

      it('has unique stop ids with in-bounds coordinates and valid verses', () => {
        const ids = journey.stops.map(s => s.id);
        expect(new Set(ids).size).toBe(ids.length);

        for (const stop of journey.stops) {
          expect(stop.name, stop.id).toBeTruthy();
          expect(inBounds(stop.coordinates), `${stop.id} coordinates`).toBe(true);
          for (const verse of stop.verses || []) {
            expect(verse).toMatch(VERSE_ID);
          }
        }
      });

      it('has legs that reference known stops with valid modes and in-bounds waypoints', () => {
        const stopIds = new Set(journey.stops.map(s => s.id));
        for (const leg of journey.legs) {
          expect(stopIds.has(leg.from), `leg from ${leg.from}`).toBe(true);
          expect(stopIds.has(leg.to), `leg to ${leg.to}`).toBe(true);
          expect(['land', 'sea']).toContain(leg.mode);
          for (const via of leg.via || []) {
            expect(inBounds(via), `${leg.from}→${leg.to} via ${via}`).toBe(true);
          }
        }
      });

      it('forms a connected itinerary (each leg starts where the previous ended)', () => {
        for (let i = 1; i < journey.legs.length; i++) {
          expect(journey.legs[i].from).toBe(journey.legs[i - 1].to);
        }
      });

      it('resolves every stop to a real maps.json record containing its verses', () => {
        for (const stop of journey.stops) {
          const resolved = resolveStopLocation(stop, locations);
          expect(locations, `${stop.id} should match a maps.json record`).toContain(resolved);
          for (const verse of stop.verses || []) {
            expect(resolved.verses, `${stop.id} verse ${verse}`).toContain(verse);
          }
        }
      });
    });
  }
});
