/**
 * Marker Rendering Utilities
 * HTML overlay markers — Leaflet-inspired approach.
 * Markers are HTML div elements absolutely positioned over the SVG map.
 * Position is computed from geographic SVG coordinates and the current viewBox,
 * so markers stay visually constant in size regardless of zoom level.
 */

import { elem } from '../../lib/helpers.esm.js';
import { MAP_BOUNDS, ICON_SIZES } from './constants.js';
import { geoToSvg, getImportanceTier } from './geo-utils.js';
import { getViewTransform } from './view-transform.js';
import { createLocationIcon, getLocationTypeName } from './icon-library.js';

/**
 * Reposition all markers AND cluster indicators in the overlay.
 * Call this after any viewBox change (pan or zoom).
 * Leaflet pattern: compute scale once, loop with pure pixel math.
 */
export const repositionAllMarkers = (overlay, viewBox, containerRect) => {
  if (!overlay || !containerRect || !containerRect.width) return;
  const t = getViewTransform(viewBox, containerRect);
  // Skips hidden markers — nearly all of them in passage mode. Safe because
  // every unhide path (filter, decluster, highlight) repositions again after.
  overlay.querySelectorAll('.map-marker:not(.filtered-out):not(.clustered), .map-cluster, .journey-stop').forEach(el => {
    if (el._svgX === undefined) return;
    const x = t.offsetX + (el._svgX - viewBox.x) * t.scale - el._anchorX;
    const y = t.offsetY + (el._svgY - viewBox.y) * t.scale - el._anchorY;
    el.style.transform = `translate3d(${x}px,${y}px,0)`;
  });
};

/**
 * Check if location coordinates are within the map bounds
 */
const isLocationInBounds = (lon, lat) => {
  return lon >= MAP_BOUNDS.minLon && lon <= MAP_BOUNDS.maxLon &&
         lat >= MAP_BOUNDS.minLat && lat <= MAP_BOUNDS.maxLat;
};

/**
 * Create a complete HTML marker div for a map location.
 * Anchor offsets (_anchorX/_anchorY) are precomputed from ICON_SIZES so that
 * repositionAllMarkers can use pure translate3d math with no calc() calls.
 */
const createMarker = (location, x, y, tier, onLocationClick) => {
  const marker = document.createElement('div');
  marker.className = 'map-marker';
  marker.setAttribute('data-tier', tier);
  marker.setAttribute('data-type', location.type || 'other');
  marker.setAttribute('tabindex', '0');
  marker.setAttribute('role', 'button');
  marker.setAttribute('aria-label',
    `${location.name}, ${getLocationTypeName(location.type || 'other')}, ${location.verses.length} verses`);
  marker._svgX = x;
  marker._svgY = y;
  marker.locationData = location;

  const iconSize = ICON_SIZES[tier] || 14;
  // Pins anchor on their tip (bottom-center of the 24x24 pin), so the point of
  // the pin sits on the location rather than the pin's middle.
  marker._anchorX = iconSize / 2;
  marker._anchorY = iconSize;

  marker.appendChild(createLocationIcon(location.type || 'other'));
  marker.appendChild(elem('div', { className: 'map-marker-label', textContent: location.name }));

  marker.addEventListener('click', (e) => {
    e.stopPropagation();
    onLocationClick(location);
  });

  marker.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onLocationClick(location);
    }
  });

  return marker;
};

/**
 * Fade all markers except the one for the selected location
 */
export const fadeMarkers = (overlay, selectedLocation) => {
  if (!overlay) return;
  overlay.querySelectorAll('.map-marker').forEach(marker => {
    marker.classList.toggle('faded', marker.locationData !== selectedLocation);
  });
};

/**
 * Reset all markers to full opacity
 */
export const resetMarkerOpacity = (overlay) => {
  if (!overlay) return;
  overlay.querySelectorAll('.map-marker').forEach(marker => {
    marker.classList.remove('faded');
  });
};

/**
 * Label deconfliction using getBoundingClientRect for accurate screen-space bounds.
 * Higher-tier (lower number) markers get label priority. Overlapping labels stay
 * hidden until hover.
 *
 * Performance: uses a read-then-write pattern to avoid layout thrashing.
 *   1. WRITE — strip all label-shown classes in one pass
 *   2. READ  — batch all getBoundingClientRect calls (one forced layout total)
 *   3. WRITE — add label-shown to non-overlapping labels in one pass
 */
export const deconflictLabels = (overlay) => {
  if (!overlay) return;

  // Pass 1: WRITE — collect labels and clear shown state
  const items = [];
  overlay.querySelectorAll('.map-marker').forEach(marker => {
    if (marker.classList.contains('filtered-out') ||
        marker.classList.contains('clustered')) return;

    const tier = parseInt(marker.getAttribute('data-tier') || '4', 10);
    const label = marker.querySelector('.map-marker-label');
    if (!label) return;

    label.classList.remove('label-shown');
    items.push({ label, tier });
  });

  if (items.length <= 1) {
    if (items.length === 1) items[0].label.classList.add('label-shown');
    return;
  }

  // Lower tier number = more important = gets label priority
  items.sort((a, b) => a.tier - b.tier);

  // Pass 2: READ — batch all rect reads (single forced layout)
  const rects = items.map(item => {
    const r = item.label.getBoundingClientRect();
    return r.width ? { left: r.left, right: r.right, top: r.top, bottom: r.bottom } : null;
  });

  // Pass 3: WRITE — greedy placement, show non-overlapping labels
  const placed = [];
  for (let i = 0; i < items.length; i++) {
    const r = rects[i];
    if (!r) continue;

    const overlaps = placed.some(p =>
      r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top
    );

    if (!overlaps) {
      items[i].label.classList.add('label-shown');
      placed.push(r);
    }
  }
};

/**
 * Create all map pins from location data.
 * Returns a verse-ID → location[] index for highlighting.
 */
export const createPins = (overlay, locationData, onLocationClick) => {
  if (!overlay || !locationData) return {};

  const locationDataByVerse = {};

  for (const location of locationData) {
    const [lon, lat] = location.coordinates;
    if (!isLocationInBounds(lon, lat)) continue;

    const { x, y } = geoToSvg(lon, lat);
    const tier = getImportanceTier(location);
    const marker = createMarker(location, x, y, tier, onLocationClick);

    overlay.appendChild(marker);

    for (const verseid of location.verses) {
      if (!locationDataByVerse[verseid]) locationDataByVerse[verseid] = [];
      locationDataByVerse[verseid].push(location);
    }
  }

  return locationDataByVerse;
};
