/**
 * Icon Library for Biblical Map Locations
 * SVG path definitions for 11 location types
 */

/**
 * Get SVG path data for a location type
 * All icons designed on 24x24 viewBox with consistent 2px stroke weight
 */
export const LOCATION_ICONS = {
  // City - Cityscape with multiple buildings
  city: `<path d="M4 20h3v-6h2v6h2v-8h2v8h2v-6h2v6h3V9l-8-5-8 5v11z" fill="currentColor"/>
         <path d="M12 4l8 5v11h-3v-6h-2v6h-2v-8h-2v8H9v-6H7v6H4V9l8-5z" stroke="currentColor" stroke-width="1.5" fill="none"/>`,

  // Building - Single temple/structure with columns
  building: `<path d="M6 20h12V8L12 4 6 8v12z" fill="currentColor"/>
             <path d="M12 4L6 8v12h12V8L12 4z" stroke="currentColor" stroke-width="1.5" fill="none"/>
             <line x1="9" y1="12" x2="9" y2="20" stroke="currentColor" stroke-width="1.5"/>
             <line x1="12" y1="12" x2="12" y2="20" stroke="currentColor" stroke-width="1.5"/>
             <line x1="15" y1="12" x2="15" y2="20" stroke="currentColor" stroke-width="1.5"/>`,

  // Mountain - Mountain peak with multiple ridges
  mountain: `<path d="M2 20L8 8l4 6 4-8 6 14H2z" fill="currentColor"/>
             <path d="M2 20L8 8l4 6 4-8 6 14" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round"/>`,

  // River - Flowing wavy water
  river: `<path d="M2 8 Q6 6, 10 8 T18 8 T22 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path d="M2 12 Q6 10, 10 12 T18 12 T22 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
          <path d="M2 16 Q6 14, 10 16 T18 16 T22 16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>`,

  // Sea - Wave pattern
  sea: `<path d="M2 10 Q5 8, 8 10 T14 10 T20 10" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round"/>
        <path d="M2 14 Q5 12, 8 14 T14 14 T20 14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M4 18 Q7 16, 10 18 T16 18 T22 18" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>`,

  // Spring - Water droplet with ripples
  spring: `<path d="M12 4 Q8 8, 12 14 Q16 8, 12 4z" fill="currentColor"/>
           <ellipse cx="12" cy="17" rx="6" ry="2" stroke="currentColor" stroke-width="1.5" fill="none"/>
           <ellipse cx="12" cy="19" rx="8" ry="2.5" stroke="currentColor" stroke-width="1" fill="none" opacity="0.6"/>`,

  // Valley - U-shaped depression between hills
  valley: `<path d="M2 8 L8 14 L12 10 L16 14 L22 8" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linejoin="round" stroke-linecap="round"/>
           <path d="M4 12 L8 16 L12 14 L16 16 L20 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linejoin="round" opacity="0.6"/>`,

  // Desert - Sand dunes
  desert: `<path d="M2 16 Q6 12, 10 16 T18 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
           <path d="M6 18 Q10 14, 14 18 T22 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
           <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
           <circle cx="16" cy="6" r="1" fill="currentColor"/>
           <circle cx="12" cy="10" r="1" fill="currentColor"/>`,

  // Island - Land mass surrounded by water
  island: `<ellipse cx="12" cy="12" rx="6" ry="4" fill="currentColor"/>
           <path d="M6 12 Q8 8, 12 8 T18 12" stroke="currentColor" stroke-width="1.5" fill="none"/>
           <circle cx="20" cy="10" r="1" fill="currentColor" opacity="0.5"/>
           <circle cx="4" cy="14" r="1" fill="currentColor" opacity="0.5"/>
           <circle cx="19" cy="16" r="0.8" fill="currentColor" opacity="0.5"/>`,

  // Region - Outlined boundary with dashed border
  region: `<rect x="4" y="6" width="16" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3,2"/>
           <circle cx="8" cy="10" r="1.5" fill="currentColor"/>
           <circle cx="16" cy="14" r="1.5" fill="currentColor"/>
           <circle cx="12" cy="12" r="1" fill="currentColor"/>`,

  // Other - Generic location pin
  other: `<path d="M12 2 C8.5 2, 5 4.5, 5 8.5 C5 13, 12 22, 12 22 S19 13, 19 8.5 C19 4.5, 15.5 2, 12 2z" fill="currentColor"/>
          <circle cx="12" cy="8.5" r="2.5" fill="white"/>
          <path d="M12 2 C8.5 2, 5 4.5, 5 8.5 C5 13, 12 22, 12 22 S19 13, 19 8.5 C19 4.5, 15.5 2, 12 2z" stroke="currentColor" stroke-width="1.5" fill="none"/>`
};

/**
 * Create an SVG icon element for a location type
 * @param {string} type - Location type (city, mountain, etc.)
 * @param {number} tier - Importance tier (1-4)
 * @param {string} color - Icon color (defaults to tier-based color)
 * @returns {SVGElement} SVG icon element
 */
export function createLocationIcon(type, tier, color = null) {
  // Fallback to 'other' if type not found
  const iconPath = LOCATION_ICONS[type] || LOCATION_ICONS.other;

  // Tier-based colors
  if (!color) {
    const tierColors = { 1: '#c41e3a', 2: '#d45a5a' };
    color = tierColors[tier] || '#e08080';
  }

  // Create SVG element
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'map-marker-icon');
  svg.setAttribute('data-type', type);
  svg.style.color = color;
  svg.style.overflow = 'visible';

  // Parse and append icon paths
  svg.innerHTML = iconPath;

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
