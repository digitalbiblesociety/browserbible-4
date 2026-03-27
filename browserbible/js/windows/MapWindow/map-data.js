/**
 * Map Data Loading & Indexing
 * Loads location data from local JSON and builds verse-based indexes
 */

/**
 * Load location data from local maps.json
 * @returns {Promise<Array>} Array of location objects
 */
export async function loadLocationData() {
  const response = await fetch('content/maps/maps.json');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
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
 * @param {string} sectionid - Section ID prefix (e.g., "AC13")
 * @returns {Array} Matching locations
 */
export function getLocationsForReference(locationData, sectionid) {
  if (!sectionid || !locationData) return [];
  return locationData.filter(loc =>
    loc.verses.some(v => v.startsWith(sectionid))
  );
}
