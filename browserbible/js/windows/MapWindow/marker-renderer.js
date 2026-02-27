/**
 * Marker Rendering Utilities
 * SVG marker creation and manipulation for map locations
 */

import { MAP_BOUNDS, SVG_WIDTH, ZOOM_THRESHOLDS, ICON_SIZES } from './constants.js';
import { geoToSvg, getImportanceTier } from './geo-utils.js';
import { createLocationIcon } from './icon-library.js';

/**
 * Create SVG icon element for marker
 */
export const createMarkerIcon = (type, tier) => {
  const iconSize = ICON_SIZES[tier] || ICON_SIZES[4];
  const icon = createLocationIcon(type, tier);

  // Set initial size
  icon.setAttribute('width', iconSize);
  icon.setAttribute('height', iconSize);
  icon.setAttribute('x', -iconSize / 2);
  icon.setAttribute('y', -iconSize / 2);

  return icon;
};

/**
 * Create SVG label group for marker
 */
export const createMarkerLabel = (locationName) => {
  const labelGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  labelGroup.setAttribute('class', 'marker-label');

  const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  labelBg.setAttribute('class', 'marker-label-bg');
  labelBg.setAttribute('fill', 'var(--window-background, #fff)');
  labelBg.setAttribute('rx', 4);
  labelBg.setAttribute('ry', 4);
  labelGroup.appendChild(labelBg);

  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('x', 0);
  text.setAttribute('y', 0);
  text.setAttribute('dy', -20);
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('font-size', 36);
  text.setAttribute('fill', 'var(--text-color, #333)');
  text.setAttribute('class', 'marker-label-text');
  text.textContent = locationName;
  labelGroup.appendChild(text);

  return labelGroup;
};

/**
 * Create complete SVG marker element
 */
export const createMarker = (location, x, y, tier, onLocationClick, markersGroup) => {
  const marker = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  marker.setAttribute('class', 'map-marker');
  marker.setAttribute('data-tier', tier);
  marker.setAttribute('data-type', location.type || 'other');
  marker.setAttribute('transform', `translate(${x}, ${y})`);
  marker.style.cursor = 'pointer';

  marker.appendChild(createMarkerIcon(location.type || 'other', tier));
  marker.appendChild(createMarkerLabel(location.name));
  marker.locationData = location;

  marker.addEventListener('click', (e) => {
    e.stopPropagation();
    onLocationClick(location);
  });

  marker.addEventListener('mouseenter', () => {
    markersGroup.appendChild(marker);
  });

  return marker;
};

/**
 * Index locations by verse IDs for quick lookup
 */
export const indexLocationByVerses = (location, locationDataByVerse) => {
  for (const verseid of location.verses) {
    if (!locationDataByVerse[verseid]) {
      locationDataByVerse[verseid] = [];
    }
    locationDataByVerse[verseid].push(location);
  }
};

/**
 * Check if location coordinates are within map bounds
 */
export const isLocationInBounds = (lon, lat) => {
  return lon >= MAP_BOUNDS.minLon && lon <= MAP_BOUNDS.maxLon &&
         lat >= MAP_BOUNDS.minLat && lat <= MAP_BOUNDS.maxLat;
};

/**
 * Update marker scales based on current zoom level
 */
export const updateMarkerScales = (markersGroup, viewBox) => {
  if (!markersGroup) return;

  const scale = viewBox.width / SVG_WIDTH;
  const zoomLevel = SVG_WIDTH / viewBox.width;

  markersGroup.querySelectorAll('.map-marker').forEach((marker) => {
    // Hide markers that are filtered out by relevance filter
    if (marker.classList.contains('filtered-out')) {
      marker.style.display = 'none';
      return;
    }

    // Highlighted markers are always visible
    const isHighlighted = marker.classList.contains('highlighted');

    const tier = parseInt(marker.getAttribute('data-tier') || '4', 10);
    const threshold = ZOOM_THRESHOLDS[tier] || 0;

    const isVisible = isHighlighted || zoomLevel >= threshold;
    marker.style.display = isVisible ? '' : 'none';

    if (isVisible) {
      const baseIconSize = ICON_SIZES[tier] || ICON_SIZES[4];
      const iconSize = baseIconSize * scale;
      const fontSize = 36 * scale;

      const icon = marker.querySelector('.map-marker-icon');
      const text = marker.querySelector('text');

      if (icon) {
        icon.setAttribute('width', iconSize);
        icon.setAttribute('height', iconSize);
        icon.setAttribute('x', -iconSize / 2);
        icon.setAttribute('y', -iconSize / 2);
      }
      if (text) {
        text.setAttribute('font-size', fontSize);
        const labelOffset = -iconSize / 2 - 8 * scale;
        text.setAttribute('dy', labelOffset);

        const labelBg = marker.querySelector('.marker-label-bg');
        if (labelBg && text.textContent) {
          const padding = 6 * scale;
          const textWidth = text.textContent.length * fontSize * 0.6;
          const textHeight = fontSize;
          labelBg.setAttribute('x', -textWidth / 2 - padding);
          labelBg.setAttribute('y', labelOffset - textHeight + 2 * scale);
          labelBg.setAttribute('width', textWidth + padding * 2);
          labelBg.setAttribute('height', textHeight + padding);
        }
      }
    }
  });
};

/**
 * Fade all markers except selected one
 */
export const fadeMarkers = (markersGroup, selectedLocation) => {
  if (!markersGroup) return;
  markersGroup.querySelectorAll('.map-marker').forEach((marker) => {
    const isSelected = marker.locationData === selectedLocation;
    marker.style.opacity = isSelected ? '1' : '0.1';
  });
};

/**
 * Reset all markers to full opacity
 */
export const resetMarkerOpacity = (markersGroup) => {
  if (!markersGroup) return;
  markersGroup.querySelectorAll('.map-marker').forEach((marker) => {
    marker.style.opacity = '1';
  });
};

/**
 * Create all map pins from location data
 * Returns the populated locationDataByVerse object
 */
export const createPins = (markersGroup, locationData, onLocationClick) => {
  if (!markersGroup || !locationData) return {};

  const locationDataByVerse = {};

  for (const location of locationData) {
    const [lon, lat] = location.coordinates;

    if (!isLocationInBounds(lon, lat)) {
      continue;
    }

    const { x, y } = geoToSvg(lon, lat);
    const tier = getImportanceTier(location);
    const marker = createMarker(location, x, y, tier, onLocationClick, markersGroup);

    markersGroup.appendChild(marker);
    indexLocationByVerses(location, locationDataByVerse);
  }

  return locationDataByVerse;
};
