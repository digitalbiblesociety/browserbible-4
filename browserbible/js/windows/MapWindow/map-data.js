/**
 * Map Data Loading & Indexing
 * Loads location data from local JSON and builds verse-based indexes
 */

import { getConfig } from '../../core/config.js';

/**
 * Load location data from local maps.json
 * @returns {Promise<Array>} Array of location objects
 */
export async function loadLocationData() {
  const response = await fetch(`${getConfig().baseContentUrl}content/maps/maps.json`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

/**
 * Load journey route data from local journeys.json
 * @returns {Promise<Array>} Array of journey objects
 */
export async function loadJourneyData() {
  const response = await fetch(`${getConfig().baseContentUrl}content/maps/journeys.json`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// Journey stops duplicate maps.json coordinates, so a resolved match must agree
// to within this many degrees (names alone are ambiguous, e.g. two "Antioch"s)
const STOP_MATCH_EPSILON = 0.01;

/**
 * Resolve a journey stop to its full maps.json location record (name plus
 * coordinate agreement). Falls back to a synthetic location built from the
 * stop itself so the detail panel still works for stops absent from maps.json.
 * @param {Object} stop - Journey stop ({id, name, label?, coordinates, verses?})
 * @param {Array|null} locationData - maps.json records
 * @returns {Object} Location-shaped object ({name, coordinates, verses, type})
 */
export function resolveStopLocation(stop, locationData) {
  const match = locationData?.find(loc =>
    loc.name === stop.name &&
    Math.abs(loc.coordinates[0] - stop.coordinates[0]) < STOP_MATCH_EPSILON &&
    Math.abs(loc.coordinates[1] - stop.coordinates[1]) < STOP_MATCH_EPSILON
  );
  return match || {
    name: stop.label || stop.name,
    coordinates: stop.coordinates,
    verses: stop.verses || [],
    type: 'city'
  };
}

/**
 * Build a verse-to-locations index for fast lookup
 * @param {Array} locationData - Array of location objects
 * @returns {Object} Map of verseId -> [location, ...]
 */
export function indexLocationsByVerse(locationData) {
  const index = {};
  for (const location of locationData) {
    for (const verseid of location.verses) {
      if (!index[verseid]) index[verseid] = [];
      index[verseid].push(location);
    }
  }
  return index;
}

/**
 * Get all locations mentioned in a given Bible section
 * @param {Array} locationData - Array of location objects
 * @param {string} sectionid - Section ID (e.g., "AC13")
 * @returns {Array} Matching locations
 */
export function getLocationsForReference(locationData, sectionid) {
  if (!sectionid || !locationData) return [];
  // Verse IDs are always BOOKCH_V — require the separator so "PS1" can't match "PS119_5"
  return locationData.filter(loc =>
    loc.verses.some(v => v.startsWith(sectionid + '_'))
  );
}
