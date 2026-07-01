/**
 * Pan & Zoom Controls
 * Mouse wheel zoom, drag panning, and touch gesture handling for the SVG map
 */

import { SVG_WIDTH, SVG_HEIGHT, MIN_VIEW_WIDTH, ZOOM_STEP, WHEEL_ZOOM_FACTOR, KEY_PAN_FRACTION } from './constants.js';
import { geoToSvg, svgToGeo } from './geo-utils.js';
import { getViewTransform, screenToSvg } from './view-transform.js';

/**
 * Trailing debounce after a burst of zoom/pan inputs: persist the map center,
 * and (for inputs that only translated the overlay) recalculate marker positions.
 */
const SETTLE_MS = 400;
function scheduleSettle(component, refreshMarkers = false) {
  clearTimeout(component._settleTimer);
  component._settleTimer = setTimeout(() => {
    if (refreshMarkers) component.updateMarkerScales();
    component.triggerSettingsChange();
  }, SETTLE_MS);
}

/** Current container aspect (w/h), falling back to the map aspect before layout. */
function containerAspect(component) {
  const r = component.refs.mapContainer.getBoundingClientRect();
  return (r.width > 0 && r.height > 0) ? r.width / r.height : SVG_WIDTH / SVG_HEIGHT;
}

/**
 * Size the viewBox to the *container's* aspect ratio so the map always fills the
 * panel with no letterbox, then clamp to the full map extent. Width drives; height
 * follows the container. The zoom-out limit is therefore "the full map height fills
 * the viewport" (or full width, whichever the map runs out of first) — never smaller.
 */
export function setViewBoxSize(component, width) {
  const ca = containerAspect(component);
  let w = Math.max(MIN_VIEW_WIDTH, width);
  let h = w / ca;
  if (w > SVG_WIDTH) { w = SVG_WIDTH; h = w / ca; }
  if (h > SVG_HEIGHT) { h = SVG_HEIGHT; w = h * ca; }
  component.viewBox.width = w;
  component.viewBox.height = h;
}

/**
 * Re-fit the viewBox to the current container aspect (after a resize) and re-render.
 */
export function refit(component) {
  if (!component.svgElement) return;
  setViewBoxSize(component, component.viewBox.width);
  constrainViewBox(component.viewBox);
  updateViewBox(component.svgElement, component.viewBox);
  component.updateMarkerScales();
}

/**
 * Constrain the viewBox to stay within map bounds.
 * Padding scales with zoom: full overshoot at max zoom-in, zero at full extent
 * so the map can never be panned to show negative space when fully zoomed out.
 */
export function constrainViewBox(viewBox) {
  // Strict clamp to the map extent — panning/zooming can never reveal empty space
  // (bars) beyond the map content.
  viewBox.x = Math.max(0, Math.min(SVG_WIDTH - viewBox.width, viewBox.x));
  viewBox.y = Math.max(0, Math.min(SVG_HEIGHT - viewBox.height, viewBox.y));
}

/**
 * Apply the current viewBox to the SVG element
 */
export function updateViewBox(svgElement, viewBox) {
  if (svgElement) {
    svgElement.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
  }
}

/**
 * Zoom by a viewBox-width factor (>1 zooms out, <1 zooms in), keeping the SVG
 * point under the given container-relative pixel fixed on screen.
 * `defer` postpones the marker decoration pass during rapid input bursts.
 */
export function zoomAtPoint(component, px, py, factor, { defer = false } = {}) {
  const rect = component.refs.mapContainer.getBoundingClientRect();

  // SVG point under the anchor before zooming
  const before = screenToSvg(px, py, component.viewBox, getViewTransform(component.viewBox, rect));

  setViewBoxSize(component, component.viewBox.width * factor);

  // Keep that same SVG point under the anchor after zooming
  const t = getViewTransform(component.viewBox, rect);
  component.viewBox.x = before.x - (px - t.offsetX) / t.scale;
  component.viewBox.y = before.y - (py - t.offsetY) / t.scale;

  constrainViewBox(component.viewBox);
  updateViewBox(component.svgElement, component.viewBox);
  component.updateMarkerScales({ defer });
}

/**
 * Zoom by a factor anchored at the container center.
 */
export function zoomBy(component, factor) {
  const rect = component.refs.mapContainer.getBoundingClientRect();
  zoomAtPoint(component, rect.width / 2, rect.height / 2, factor);
}

/** Fully zoomed out — the viewBox already spans the map in one dimension. */
export function isAtMinZoom(component) {
  return component.viewBox.width >= SVG_WIDTH || component.viewBox.height >= SVG_HEIGHT;
}

/** Fully zoomed in — the viewBox width is at its lower clamp. */
export function isAtMaxZoom(component) {
  return component.viewBox.width <= MIN_VIEW_WIDTH;
}

/**
 * Center the map on geographic coordinates at a given zoom level
 */
export function centerOn(component, lon, lat, zoomLevel = 1) {
  const { x, y } = geoToSvg(lon, lat);
  setViewBoxSize(component, SVG_WIDTH / zoomLevel);
  component.viewBox.x = x - component.viewBox.width / 2;
  component.viewBox.y = y - component.viewBox.height / 2;

  constrainViewBox(component.viewBox);
  updateViewBox(component.svgElement, component.viewBox);
  component.updateMarkerScales();

  const center = svgToGeo(
    component.viewBox.x + component.viewBox.width / 2,
    component.viewBox.y + component.viewBox.height / 2
  );
  component.state.currentCenter = { lat: center.lat, lon: center.lon };
}

/**
 * Fit the map viewport to encompass a set of locations with padding
 * @param {Object} component - MapWindow component
 * @param {Array} locations - Array of location objects with coordinates [lon, lat]
 */
export function centerOnBounds(component, locations) {
  if (!locations || locations.length === 0) return;

  if (locations.length === 1) {
    centerOn(component, locations[0].coordinates[0], locations[0].coordinates[1], 6);
    return;
  }

  // Calculate bounding box in geographic coordinates
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;

  for (const loc of locations) {
    const [lon, lat] = loc.coordinates;
    if (lon < minLon) minLon = lon;
    if (lon > maxLon) maxLon = lon;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  // Convert bounds to SVG coordinates
  const topLeft = geoToSvg(minLon, maxLat);
  const bottomRight = geoToSvg(maxLon, minLat);

  const svgWidth = bottomRight.x - topLeft.x;
  const svgHeight = bottomRight.y - topLeft.y;

  // Add padding (20% on each side)
  const paddingFactor = 0.2;
  const padX = Math.max(svgWidth * paddingFactor, 40);
  const padY = Math.max(svgHeight * paddingFactor, 30);

  let vw = svgWidth + padX * 2;
  let vh = svgHeight + padY * 2;

  // Match the container's aspect so the map fills the panel without letterbox.
  // Expand the shorter dimension to fit — locations always remain fully visible.
  const ca = containerAspect(component);
  if (vw / vh > ca) {
    vh = vw / ca;
  } else {
    vw = vh * ca;
  }

  // Clamp to the full map extent (can't show more than the whole map either way).
  if (vw > SVG_WIDTH) { vw = SVG_WIDTH; vh = vw / ca; }
  if (vh > SVG_HEIGHT) { vh = SVG_HEIGHT; vw = vh * ca; }

  // Center the viewBox on the bounding box centre
  const bboxCx = topLeft.x + svgWidth / 2;
  const bboxCy = topLeft.y + svgHeight / 2;
  component.viewBox.x = bboxCx - vw / 2;
  component.viewBox.y = bboxCy - vh / 2;
  component.viewBox.width = vw;
  component.viewBox.height = vh;

  constrainViewBox(component.viewBox);
  updateViewBox(component.svgElement, component.viewBox);
  component.updateMarkerScales();

  const center = svgToGeo(
    component.viewBox.x + component.viewBox.width / 2,
    component.viewBox.y + component.viewBox.height / 2
  );
  component.state.currentCenter = { lat: center.lat, lon: center.lon };
}

/**
 * Set up all pan and zoom event handlers
 */
export function setupPanZoom(component) {
  const mapContainer = component.refs.mapContainer;

  // Mouse wheel zoom, centered on the cursor
  component.addListener(mapContainer, 'wheel', (e) => {
    e.preventDefault();
    const rect = mapContainer.getBoundingClientRect();
    const factor = e.deltaY > 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR;
    zoomAtPoint(component, e.clientX - rect.left, e.clientY - rect.top, factor, { defer: true });
    scheduleSettle(component);
  }, { passive: false });

  // Double-click zoom (markers, clusters, and controls handle their own clicks)
  component.addListener(mapContainer, 'dblclick', (e) => {
    if (e.target.closest('.map-marker, .map-cluster, .map-zoom-controls')) return;
    e.preventDefault();
    const rect = mapContainer.getBoundingClientRect();
    zoomAtPoint(component, e.clientX - rect.left, e.clientY - rect.top, 1 / ZOOM_STEP);
    scheduleSettle(component);
  });

  // Mouse drag panning
  component.addListener(mapContainer, 'mousedown', (e) => {
    if (e.target.closest('.map-marker, .map-cluster, .map-zoom-controls')) return;
    component.state.isPanning = true;
    component.panStart = { x: e.clientX, y: e.clientY };
    mapContainer.classList.add('panning');
  });

  component.addListener(document, 'mousemove', (e) => {
    if (!component.state.isPanning) return;
    const rect = mapContainer.getBoundingClientRect();
    const t = getViewTransform(component.viewBox, rect);
    const dx = (e.clientX - component.panStart.x) / t.scale;
    const dy = (e.clientY - component.panStart.y) / t.scale;

    const prevX = component.viewBox.x;
    const prevY = component.viewBox.y;
    component.viewBox.x -= dx;
    component.viewBox.y -= dy;
    component.panStart = { x: e.clientX, y: e.clientY };

    constrainViewBox(component.viewBox);
    updateViewBox(component.svgElement, component.viewBox);

    // Translate the marker overlay by the actual screen pixels the SVG moved.
    // Using the constrained delta means we stop at map edges just like the SVG does.
    const screenDx = (prevX - component.viewBox.x) * t.scale;
    const screenDy = (prevY - component.viewBox.y) * t.scale;
    component.panMarkersBy(screenDx, screenDy);
  });

  component.addListener(document, 'mouseup', () => {
    if (component.state.isPanning) {
      component.state.isPanning = false;
      mapContainer.classList.remove('panning');
      component.updateMarkerScales();
      component.triggerSettingsChange();
    }
  });

  // Touch support
  let lastTouchDist = 0;

  component.addListener(mapContainer, 'touchstart', (e) => {
    if (e.touches.length === 1) {
      component.state.isPanning = true;
      component.panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      component.state.isPanning = false;
      lastTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  }, { passive: true });

  component.addListener(mapContainer, 'touchmove', (e) => {
    e.preventDefault();
    const rect = mapContainer.getBoundingClientRect();

    if (e.touches.length === 1 && component.state.isPanning) {
      const t = getViewTransform(component.viewBox, rect);
      const dx = (e.touches[0].clientX - component.panStart.x) / t.scale;
      const dy = (e.touches[0].clientY - component.panStart.y) / t.scale;

      const prevX = component.viewBox.x;
      const prevY = component.viewBox.y;
      component.viewBox.x -= dx;
      component.viewBox.y -= dy;
      component.panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      constrainViewBox(component.viewBox);
      updateViewBox(component.svgElement, component.viewBox);

      const screenDx = (prevX - component.viewBox.x) * t.scale;
      const screenDy = (prevY - component.viewBox.y) * t.scale;
      component.panMarkersBy(screenDx, screenDy);
    } else if (e.touches.length === 2) {
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

      // Zoom anchored at the pinch midpoint
      zoomAtPoint(component, centerX, centerY, lastTouchDist / newDist, { defer: true });
      lastTouchDist = newDist;
    }
  }, { passive: false });

  component.addListener(mapContainer, 'touchend', () => {
    component.state.isPanning = false;
    component.updateMarkerScales();
    component.triggerSettingsChange();
  }, { passive: true });

  setupKeyboard(component);
}

/**
 * Keyboard controls on the (focusable) map container:
 * arrows pan, +/− zoom, Home/0 resets the view.
 */
function setupKeyboard(component) {
  const mapContainer = component.refs.mapContainer;

  const panByFraction = (fx, fy) => {
    const rect = mapContainer.getBoundingClientRect();
    const t = getViewTransform(component.viewBox, rect);
    const prevX = component.viewBox.x;
    const prevY = component.viewBox.y;
    component.viewBox.x += component.viewBox.width * fx;
    component.viewBox.y += component.viewBox.height * fy;
    constrainViewBox(component.viewBox);
    updateViewBox(component.svgElement, component.viewBox);
    // Same overlay-translate technique as drag panning; decorations refresh on settle
    component.panMarkersBy((prevX - component.viewBox.x) * t.scale, (prevY - component.viewBox.y) * t.scale);
    scheduleSettle(component, true);
  };

  component.addListener(mapContainer, 'keydown', (e) => {
    if (e.target !== mapContainer) return;

    switch (e.key) {
      case 'ArrowLeft': panByFraction(-KEY_PAN_FRACTION, 0); break;
      case 'ArrowRight': panByFraction(KEY_PAN_FRACTION, 0); break;
      case 'ArrowUp': panByFraction(0, -KEY_PAN_FRACTION); break;
      case 'ArrowDown': panByFraction(0, KEY_PAN_FRACTION); break;
      case '+': case '=':
        zoomBy(component, 1 / ZOOM_STEP);
        scheduleSettle(component);
        break;
      case '-': case '_':
        zoomBy(component, ZOOM_STEP);
        scheduleSettle(component);
        break;
      case 'Home': case '0':
        if (typeof component.resetView === 'function') {
          component.resetView();
          component.triggerSettingsChange();
        }
        break;
      default:
        return; // unhandled key — don't preventDefault
    }
    e.preventDefault();
  });
}
