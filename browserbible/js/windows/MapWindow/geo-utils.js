/**
 * Geographic Utilities
 * Coordinate conversion and location importance calculation
 */

import {
  MAP_BOUNDS,
  PADDING,
  PROJ_SCALE,
  PROJ_COS_PHI0,
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
 * Convert geographic coordinates to SVG coordinates.
 * Corrected equirectangular: longitude is scaled by cos(standard parallel) and
 * latitude shares the same scale, so the result has square pixels.
 */
export const geoToSvg = (lon, lat) => {
  const x = PADDING + (lon - MAP_BOUNDS.minLon) * PROJ_COS_PHI0 * PROJ_SCALE;
  const y = PADDING + (MAP_BOUNDS.maxLat - lat) * PROJ_SCALE;
  return { x, y };
};

/**
 * Convert SVG coordinates to geographic coordinates (inverse of geoToSvg).
 */
export const svgToGeo = (x, y) => {
  const lon = MAP_BOUNDS.minLon + (x - PADDING) / (PROJ_COS_PHI0 * PROJ_SCALE);
  const lat = MAP_BOUNDS.maxLat - (y - PADDING) / PROJ_SCALE;
  return { lon, lat };
};
