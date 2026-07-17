/**
 * Icon Library for Biblical Map Locations
 * A single teardrop map-pin shape for every location. The pin's fill is
 * `currentColor`, so per-type colors come from CSS (.map-marker[data-type]).
 */

// Classic map pin on a 24x24 viewBox. The tip sits at the bottom-center (12,24)
// so markers can anchor on it (see marker-renderer.js); the head is centered at
// (12,9) where the white hole is punched.
const PIN_PATH = 'M12 0C7.03 0 3 4.03 3 9c0 6.75 9 15 9 15s9-8.25 9-15c0-4.97-4.03-9-9-9z';

/**
 * Create a map-pin SVG icon. The shape is identical for every location;
 * `data-type` lets CSS tint the pin per type, and size comes from the tier rules.
 * @param {string} type - Location type (city, mountain, etc.)
 * @returns {SVGElement} SVG icon element
 */
export function createLocationIcon(type) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'map-marker-icon');
  svg.setAttribute('data-type', type);
  svg.style.overflow = 'visible';

  svg.innerHTML =
    `<path d="${PIN_PATH}" fill="currentColor" stroke="rgba(0,0,0,0.35)" stroke-width="1"/>` +
    `<circle cx="12" cy="9" r="3.2" fill="#fff"/>`;

  return svg;
}

/**
 * Get a descriptive name for a location type
 * @param {string} type - Location type
 * @returns {string} Human-readable type name
 */
export function getLocationTypeName(type) {
  const typeNames = {
    city: 'City',
    building: 'Building',
    mountain: 'Mountain',
    river: 'River',
    sea: 'Sea',
    spring: 'Spring',
    valley: 'Valley',
    desert: 'Desert',
    island: 'Island',
    region: 'Region',
    other: 'Location'
  };

  return typeNames[type] || 'Location';
}
