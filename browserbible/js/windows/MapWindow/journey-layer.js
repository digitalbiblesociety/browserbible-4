/**
 * Journey Layer
 * Renders journey overlays: smoothed route paths as SVG inside the basemap
 * (so they pan/zoom with the viewBox for free) and numbered HTML stop badges
 * in the markers overlay (so they ride the existing pan-translate and
 * reposition machinery and stay constant screen size).
 */

import { geoToSvg } from './geo-utils.js';
import { buildLegPath } from './route-geometry.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Badge diameter in px; must match CSS .journey-stop width/height
export const STOP_BADGE_SIZE = 20;

/**
 * Insert (once) and return the <g class="journey-layer"> hosting route paths.
 * Appended as the last child of the basemap's content clip group so routes
 * draw above the relief/rivers/coastline, below the border rect, and stay
 * clipped to the map content area.
 * @param {SVGSVGElement} svgElement - The parsed basemap SVG
 * @returns {SVGGElement|null}
 */
export function ensureJourneyLayer(svgElement) {
  if (!svgElement) return null;

  let layer = svgElement.querySelector('.journey-layer');
  if (layer) return layer;

  const host = svgElement.querySelector('g[clip-path="url(#content-clip)"]')
    || svgElement.querySelector('g[clip-path]')
    || svgElement;
  layer = document.createElementNS(SVG_NS, 'g');
  layer.setAttribute('class', 'journey-layer');
  host.appendChild(layer);
  return layer;
}

/**
 * Render one journey: an SVG <path> per leg plus a numbered stop badge per
 * stop. Badges are numbered by first-visit order (the stops array); legs that
 * retrace earlier ground simply overdraw the same corridor.
 * @param {SVGGElement} layerG - From ensureJourneyLayer()
 * @param {HTMLElement} markersOverlay - The existing .map-markers-overlay
 * @param {Object} journey - Journey record from journeys.json
 * @param {Function} [onStopClick] - callback(stop, index)
 */
export function renderJourney(layerG, markersOverlay, journey, onStopClick) {
  if (!layerG || !markersOverlay || !journey) return;
  removeJourney(layerG, markersOverlay, journey.id);

  const stopsById = new Map((journey.stops || []).map(s => [s.id, s]));

  for (const leg of journey.legs || []) {
    const from = stopsById.get(leg.from);
    const to = stopsById.get(leg.to);
    if (!from || !to) continue;

    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('class',
      `journey-route journey-route-${leg.mode === 'sea' ? 'sea' : 'land'}`);
    path.setAttribute('data-journey-id', journey.id);
    path.setAttribute('d', buildLegPath(from.coordinates, leg.via, to.coordinates));
    path.setAttribute('stroke', journey.color);
    path.setAttribute('fill', 'none');
    // Puts stroke width AND the sea-leg dash pattern (CSS) in screen space,
    // so routes read identically at every zoom level
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    path.setAttribute('pointer-events', 'none');
    layerG.appendChild(path);
  }

  (journey.stops || []).forEach((stop, index) => {
    const badge = document.createElement('div');
    badge.className = 'journey-stop';
    badge.setAttribute('data-journey-id', journey.id);
    badge.setAttribute('tabindex', '0');
    badge.setAttribute('role', 'button');
    badge.setAttribute('aria-label', `Stop ${index + 1}: ${stop.label || stop.name}`);
    badge.style.setProperty('--journey-color', journey.color);
    badge.textContent = String(index + 1);

    const { x, y } = geoToSvg(stop.coordinates[0], stop.coordinates[1]);
    badge._svgX = x;
    badge._svgY = y;
    badge._anchorX = STOP_BADGE_SIZE / 2;
    badge._anchorY = STOP_BADGE_SIZE / 2;

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      onStopClick?.(stop, index);
    });
    badge.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onStopClick?.(stop, index);
      }
    });

    markersOverlay.appendChild(badge);
  });
}

/**
 * Remove a journey's route paths and stop badges.
 */
export function removeJourney(layerG, markersOverlay, journeyId) {
  const escaped = CSS.escape(journeyId);
  layerG?.querySelectorAll(`.journey-route[data-journey-id="${escaped}"]`)
    .forEach(el => el.remove());
  markersOverlay?.querySelectorAll(`.journey-stop[data-journey-id="${escaped}"]`)
    .forEach(el => el.remove());
}
