/**
 * Pan & Zoom Controls
 * Mouse wheel zoom, drag panning, and touch gesture handling for the SVG map
 */

import { SVG_WIDTH, SVG_HEIGHT } from './constants.js';
import { geoToSvg, svgToGeo } from './geo-utils.js';

/**
 * Constrain the viewBox to stay within map bounds.
 * Padding scales with zoom: full overshoot at max zoom-in, zero at full extent
 * so the map can never be panned to show negative space when fully zoomed out.
 */
export function constrainViewBox(viewBox) {
  const zoomFraction = Math.min(viewBox.width / SVG_WIDTH, 1);
  const padding = Math.round(100 * (1 - zoomFraction));
  viewBox.x = Math.max(-padding, Math.min(SVG_WIDTH - viewBox.width + padding, viewBox.x));
  viewBox.y = Math.max(-padding, Math.min(SVG_HEIGHT - viewBox.height + padding, viewBox.y));
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
 * Center the map on geographic coordinates at a given zoom level
 */
export function centerOn(component, lon, lat, zoomLevel = 1) {
  const { x, y } = geoToSvg(lon, lat);
  const baseWidth = SVG_WIDTH / zoomLevel;
  const baseHeight = SVG_HEIGHT / zoomLevel;

  component.viewBox.width = baseWidth;
  component.viewBox.height = baseHeight;
  component.viewBox.x = x - baseWidth / 2;
  component.viewBox.y = y - baseHeight / 2;

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

  // Enforce the SVG natural aspect ratio (3:2) so the map never looks skewed.
  // Expand the shorter dimension to fit — locations always remain fully visible.
  const naturalAspect = SVG_WIDTH / SVG_HEIGHT;
  if (vw / vh > naturalAspect) {
    vh = vw / naturalAspect;
  } else {
    vw = vh * naturalAspect;
  }

  // Clamp to full map extent while preserving aspect ratio
  if (vw > SVG_WIDTH) {
    vw = SVG_WIDTH;
    vh = SVG_HEIGHT;
  }

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

  // Mouse wheel zoom
  component.addListener(mapContainer, 'wheel', (e) => {
    e.preventDefault();
    const rect = mapContainer.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const svgX = component.viewBox.x + (mouseX / rect.width) * component.viewBox.width;
    const svgY = component.viewBox.y + (mouseY / rect.height) * component.viewBox.height;

    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    const newWidth = Math.min(SVG_WIDTH, Math.max(12, component.viewBox.width * zoomFactor));
    const newHeight = Math.min(SVG_HEIGHT, Math.max(8, component.viewBox.height * zoomFactor));

    component.viewBox.x = svgX - (mouseX / rect.width) * newWidth;
    component.viewBox.y = svgY - (mouseY / rect.height) * newHeight;
    component.viewBox.width = newWidth;
    component.viewBox.height = newHeight;

    constrainViewBox(component.viewBox);
    updateViewBox(component.svgElement, component.viewBox);
    component.updateMarkerScales();
  }, { passive: false });

  // Mouse drag panning
  component.addListener(mapContainer, 'mousedown', (e) => {
    if (e.target.closest('.map-marker') || e.target.closest('.map-cluster')) return;
    component.state.isPanning = true;
    component.panStart = { x: e.clientX, y: e.clientY };
    mapContainer.classList.add('panning');
  });

  component.addListener(document, 'mousemove', (e) => {
    if (!component.state.isPanning) return;
    const rect = mapContainer.getBoundingClientRect();
    const dx = (e.clientX - component.panStart.x) * (component.viewBox.width / rect.width);
    const dy = (e.clientY - component.panStart.y) * (component.viewBox.height / rect.height);

    const prevX = component.viewBox.x;
    const prevY = component.viewBox.y;
    component.viewBox.x -= dx;
    component.viewBox.y -= dy;
    component.panStart = { x: e.clientX, y: e.clientY };

    constrainViewBox(component.viewBox);
    updateViewBox(component.svgElement, component.viewBox);

    // Translate the marker overlay by the actual screen pixels the SVG moved.
    // Using the constrained delta means we stop at map edges just like the SVG does.
    const screenDx = (prevX - component.viewBox.x) * (rect.width / component.viewBox.width);
    const screenDy = (prevY - component.viewBox.y) * (rect.height / component.viewBox.height);
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
      const dx = (e.touches[0].clientX - component.panStart.x) * (component.viewBox.width / rect.width);
      const dy = (e.touches[0].clientY - component.panStart.y) * (component.viewBox.height / rect.height);

      const prevX = component.viewBox.x;
      const prevY = component.viewBox.y;
      component.viewBox.x -= dx;
      component.viewBox.y -= dy;
      component.panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };

      constrainViewBox(component.viewBox);
      updateViewBox(component.svgElement, component.viewBox);

      const screenDx = (prevX - component.viewBox.x) * (rect.width / component.viewBox.width);
      const screenDy = (prevY - component.viewBox.y) * (rect.height / component.viewBox.height);
      component.panMarkersBy(screenDx, screenDy);
    } else if (e.touches.length === 2) {
      const newDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = lastTouchDist / newDist;

      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

      const svgX = component.viewBox.x + ((centerX - rect.left) / rect.width) * component.viewBox.width;
      const svgY = component.viewBox.y + ((centerY - rect.top) / rect.height) * component.viewBox.height;

      const newWidth = Math.min(SVG_WIDTH, Math.max(50, component.viewBox.width * scale));
      const newHeight = Math.min(SVG_HEIGHT, Math.max(33, component.viewBox.height * scale));

      component.viewBox.x = svgX - ((centerX - rect.left) / rect.width) * newWidth;
      component.viewBox.y = svgY - ((centerY - rect.top) / rect.height) * newHeight;
      component.viewBox.width = newWidth;
      component.viewBox.height = newHeight;

      lastTouchDist = newDist;

      constrainViewBox(component.viewBox);
      updateViewBox(component.svgElement, component.viewBox);
      component.updateMarkerScales();
    }
  }, { passive: false });

  component.addListener(mapContainer, 'touchend', () => {
    component.state.isPanning = false;
    component.updateMarkerScales();
    component.triggerSettingsChange();
  }, { passive: true });
}
