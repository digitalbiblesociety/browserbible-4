/**
 * Geographic Utilities
 * Coordinate conversion and location importance calculation
 */

import {
  MAP_BOUNDS,
  PADDING,
  CONTENT_WIDTH,
  CONTENT_HEIGHT,
  IMPORTANT_LOCATIONS,
  DEMOTED_LOCATIONS
} from './constants.js';

/**
 * Calculate importance tier based on verse count (4 tiers)
 */
export const getImportanceTier = (location) => {
  const verseCount = location.verses?.length || 0;
  const isImportant = IMPORTANT_LOCATIONS.has(location.name);
  const isDemoted = DEMOTED_LOCATIONS.has(location.name);

  if (isDemoted) return 4;
  if (verseCount >= 10 || isImportant) return 1;
  if (verseCount >= 5) return 2;
  if (verseCount >= 3) return 3;
  return 4;
};

/**
 * Convert geographic coordinates to SVG coordinates
 */
export const geoToSvg = (lon, lat) => {
  const lonRange = MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon;
  const latRange = MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat;
  const x = PADDING + ((lon - MAP_BOUNDS.minLon) / lonRange) * CONTENT_WIDTH;
  const y = PADDING + ((MAP_BOUNDS.maxLat - lat) / latRange) * CONTENT_HEIGHT;
  return { x, y };
};

/**
 * Convert SVG coordinates to geographic coordinates
 */
export const svgToGeo = (x, y) => {
  const lonRange = MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon;
  const latRange = MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat;
  const lon = ((x - PADDING) / CONTENT_WIDTH) * lonRange + MAP_BOUNDS.minLon;
  const lat = MAP_BOUNDS.maxLat - ((y - PADDING) / CONTENT_HEIGHT) * latRange;
  return { lon, lat };
};
