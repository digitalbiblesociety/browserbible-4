/**
 * MapPanel — reusable map logic decoupled from the window chrome.
 *
 * Owns the SVG background, HTML marker overlay, pan/zoom, clustering,
 * and location data. Used by both MapWindow and MediaWindow.
 *
 * Duck-typed to match the interface that pan-zoom.js expects
 * (refs.mapContainer, viewBox, state.isPanning, panStart, addListener,
 * updateMarkerScales, triggerSettingsChange).
 */

import { SVG_WIDTH, SVG_HEIGHT, CLUSTER_RADIUS_PX, DEFAULT_CENTER, ZOOM_STEP, COLOCATED_EPSILON, CLUSTER_BREAK_MARGIN } from './constants.js';
import { svgToGeo, geoToSvg } from './geo-utils.js';
import { getViewTransform } from './view-transform.js';
import { NT_BOOKS } from '../../bible/BibleData.js';
import * as MarkerRenderer from './marker-renderer.js';
import { loadLocationData, getLocationsForReference } from './map-data.js';
import { setupPanZoom, centerOn, centerOnBounds, constrainViewBox, updateViewBox, setViewBoxSize, refit, zoomBy, isAtMinZoom, isAtMaxZoom } from './pan-zoom.js';
import { createDetailPanel, openDetailPanel, destroyDetailPanel } from './detail-panel.js';
import { highlightLocations, removeHighlights } from './highlight.js';
import { computeClusters, renderClusters, applyClusterVisibility } from './clustering.js';

// Trailing delay before clusters/labels recompute after a burst of zoom input
const DECORATION_SETTLE_MS = 150;

// Map assets never change, so panels share one fetch across open/close
// cycles. Failures aren't cached; a later open retries.
let _svgTextPromise = null;
function fetchSvgText() {
  if (!_svgTextPromise) {
    _svgTextPromise = fetch('content/maps/biblical-map.svg').then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    });
    _svgTextPromise.catch(() => { _svgTextPromise = null; });
  }
  return _svgTextPromise;
}

let _pinDataPromise = null;
function fetchPinData() {
  if (!_pinDataPromise) {
    _pinDataPromise = loadLocationData().then((mapData) => {
      // Precompute era for each location (verse IDs use 2-char book prefixes; NT/OT sets don't collide)
      const ntBookSet = new Set(NT_BOOKS);
      for (const loc of mapData) {
        let hasOT = false, hasNT = false;
        for (const v of loc.verses) {
          if (ntBookSet.has(v.slice(0, 2))) { hasNT = true; } else { hasOT = true; }
          if (hasOT && hasNT) break;
        }
        loc._era = (hasOT && hasNT) ? 'both' : (hasNT ? 'nt' : 'ot');
      }
      return mapData;
    });
    _pinDataPromise.catch(() => { _pinDataPromise = null; });
  }
  return _pinDataPromise;
}

// Cached AVIF decode-support probe (1×1 AVIF data URI). Resolves once, reused thereafter.
let _avifSupport = null;
function supportsAvif() {
  if (_avifSupport) return _avifSupport;
  _avifSupport = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAEAAAABAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIABoAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgABogQEDQgMgkQAAAAB8dSLfI=';
  });
  return _avifSupport;
}

export class MapPanel {
  constructor(container) {
    // The DOM element to mount the map into
    this.container = container;

    // Pan-zoom module interface (duck-typed to match MapWindowComponent shape)
    this.refs = { mapContainer: container };
    this.state = {
      isPanning: false,
      mode: 'passage',
      currentReference: null,
      currentCenter: { ...DEFAULT_CENTER },
      exploreEra: 'all' // 'all' | 'ot' | 'nt'
    };
    this.viewBox = { x: 0, y: 0, width: SVG_WIDTH, height: SVG_HEIGHT };
    this.panStart = { x: 0, y: 0 };

    this.svgElement = null;
    this.markersOverlay = null;
    this.locationData = null;
    this.locationDataByVerse = null;
    this.detailPanel = null;

    this._panOffset = { x: 0, y: 0 };
    this._eventListeners = [];
    this._onVerseClick = null; // optional callback(sectionid, fragmentid)
    this._onSettingsChange = null; // optional callback(lat, lon)
    this._verseTextLookup = null; // optional (verseId: string) => string | null
    this._onLocationOpen = null; // optional callback(location, colocated, verseTextLookup) — bypasses popover
    this._detailTextid = null; // optional Bible text id for hydrating detail verse snippets
  }

  /**
   * Initialise the map: fetch SVG, create overlay, load pins, wire pan/zoom.
   * @param {number} [lat] - Initial center latitude (defaults to Jerusalem)
   * @param {number} [lon] - Initial center longitude
   */
  async init(lat, lon) {
    if (lat !== undefined) this.state.currentCenter.lat = lat;
    if (lon !== undefined) this.state.currentCenter.lon = lon;
    this.detailPanel = createDetailPanel();
    this._wireDetailPanel();
    await this._initMap();
  }

  /**
   * Filter visible markers to those that mention the given Bible section ID.
   * @param {string|null} sectionId
   */
  filterBySection(sectionId) {
    this.state.currentReference = sectionId;

    const locations = (this.state.mode === 'passage' && sectionId && this.locationData)
      ? getLocationsForReference(this.locationData, sectionId)
      : null;
    const willRecenter = !!locations && locations.length > 0;

    // centerOnBounds runs a full decoration pass itself — skip the interim one
    this._filterMarkers({ updateScales: !willRecenter });
    if (willRecenter) centerOnBounds(this, locations);
  }

  /**
   * Switch between 'passage' and 'explore' modes.
   */
  setMode(mode) {
    this.state.mode = mode;
    // resetView always ends in a decoration pass (centerOn/centerOnBounds)
    this._filterMarkers({ updateScales: false });
    this.resetView();
  }

  /**
   * Reset the view to the natural fit for the current mode: the current
   * passage's locations in passage mode, otherwise the full map.
   */
  resetView() {
    if (this.state.mode === 'passage' && this.state.currentReference && this.locationData) {
      const locations = getLocationsForReference(this.locationData, this.state.currentReference);
      if (locations.length > 0) {
        centerOnBounds(this, locations);
        return;
      }
    }
    centerOn(this, DEFAULT_CENTER.lon, DEFAULT_CENTER.lat, 1);
  }

  /**
   * Set the era filter for explore mode ('all' | 'ot' | 'nt').
   * @param {string} era
   */
  setExploreEra(era) {
    this.state.exploreEra = era;
    this._filterMarkers();
  }

  /**
   * Open the detail panel for a location (from search or external call).
   * @param {Object} location - Location data object
   */
  openLocation(location) {
    this._openLocation(location);
  }

  /**
   * Highlight location names in Bible window text and their map markers.
   * @param {string|null} [sectionid] - Scope the text walk to one loaded section
   */
  highlight(sectionid = null) {
    if (this.locationDataByVerse) {
      highlightLocations(this.markersOverlay, this.locationDataByVerse, sectionid);
      // reposition skips hidden markers, so freshly unhidden ones sit stale
      if (this.markersOverlay) {
        MarkerRenderer.repositionAllMarkers(
          this.markersOverlay, this.viewBox, this.container.getBoundingClientRect());
      }
    }
  }

  removeHighlights() {
    removeHighlights(this.markersOverlay);
  }

  resetMarkerOpacity() {
    MarkerRenderer.resetMarkerOpacity(this.markersOverlay);
  }

  /**
   * Clean up event listeners and remove the detail panel.
   */
  destroy() {
    clearTimeout(this._settleTimer);
    clearTimeout(this._decorTimer);
    destroyDetailPanel(this.detailPanel);
    removeHighlights(this.markersOverlay);
    this._eventListeners.forEach(({ el, event, handler }) => {
      el.removeEventListener(event, handler);
    });
    this._eventListeners = [];
  }

  // --- Interface required by pan-zoom.js ---

  /** Register an event listener and track it for cleanup. */
  addListener(el, event, handler, opts) {
    el.addEventListener(event, handler, opts);
    this._eventListeners.push({ el, event, handler });
  }

  /**
   * Called by pan-zoom.js on every pan frame.
   * Translates the entire overlay by the actual screen-pixel delta — one DOM write,
   * no per-marker work, no reflows. Leaflet uses the same technique on its marker pane.
   * @param {number} dx - Screen pixels moved horizontally
   * @param {number} dy - Screen pixels moved vertically
   */
  panMarkersBy(dx, dy) {
    if (!this.markersOverlay) return;
    this._panOffset.x += dx;
    this._panOffset.y += dy;
    this.markersOverlay.style.transform = `translate3d(${this._panOffset.x}px,${this._panOffset.y}px,0)`;
  }

  /** Re-fit the viewBox to the container's new aspect after a resize, then re-render. */
  onResize() {
    refit(this);
  }

  /**
   * Called by pan-zoom.js after zoom or pan end — resets the overlay and
   * recalculates all positions. With `defer: true` (used during wheel/pinch
   * bursts), markers reposition immediately but the expensive decoration pass
   * (re-clustering + label deconfliction) waits for a short settle timer —
   * the same technique Leaflet uses during continuous zoom.
   */
  updateMarkerScales({ defer = false } = {}) {
    if (!this.markersOverlay) return;

    // Reset the pan-translate so individual marker positions are authoritative again
    this._panOffset.x = 0;
    this._panOffset.y = 0;
    this.markersOverlay.style.transform = '';

    clearTimeout(this._decorTimer);
    if (defer) {
      // Existing markers and cluster badges track the new viewBox right away
      const containerRect = this.container.getBoundingClientRect();
      MarkerRenderer.repositionAllMarkers(this.markersOverlay, this.viewBox, containerRect);
      this._updateZoomControlState();
      this._decorTimer = setTimeout(() => this._decorateMarkers(), DECORATION_SETTLE_MS);
    } else {
      this._decorateMarkers();
    }
  }

  /** Decoration pass: recompute clusters, then position everything and deconflict labels. */
  _decorateMarkers() {
    if (!this.markersOverlay) return;

    // Clear any pan translate accumulated while the settle timer was pending;
    // the positions below are absolute, and translate on top double-shifts.
    this._panOffset.x = 0;
    this._panOffset.y = 0;
    this.markersOverlay.style.transform = '';

    this.markersOverlay.querySelectorAll('.map-marker.clustered').forEach(m => {
      m.classList.remove('clustered');
    });

    const containerWidth = this.container.offsetWidth || 800;
    const { clusters, singles, hidden } = computeClusters(this.markersOverlay, this.viewBox, containerWidth);
    applyClusterVisibility(clusters, singles, hidden);
    renderClusters(this.markersOverlay, clusters);

    const containerRect = this.container.getBoundingClientRect();
    MarkerRenderer.repositionAllMarkers(this.markersOverlay, this.viewBox, containerRect);
    MarkerRenderer.deconflictLabels(this.markersOverlay);
    this._updateZoomControlState();
  }

  /** Called by pan-zoom.js when panning ends. */
  triggerSettingsChange() {
    const center = svgToGeo(
      this.viewBox.x + this.viewBox.width / 2,
      this.viewBox.y + this.viewBox.height / 2
    );
    this.state.currentCenter = { lat: center.lat, lon: center.lon };
    if (this._onSettingsChange) {
      this._onSettingsChange(center.lat, center.lon);
    }
  }

  // --- Private ---

  async _initMap() {
    try {
      const pinDataPromise = fetchPinData(); // starts alongside the SVG fetch
      const svgText = await fetchSvgText();

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      this.svgElement = svgDoc.documentElement;
      this.svgElement.setAttribute('width', '100%');
      this.svgElement.setAttribute('height', '100%');
      // Cover: fill the container (crop overflow) so there are never letterbox bars.
      // Markers/pointer math use the matching transform in view-transform.js.
      this.svgElement.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      this.svgElement.style.display = 'block';

      this.markersOverlay = document.createElement('div');
      this.markersOverlay.className = 'map-markers-overlay';

      // Keyboard-operable map surface (arrow keys pan, +/− zoom — see pan-zoom.js)
      this.container.tabIndex = 0;
      this.container.setAttribute('role', 'application');
      this.container.setAttribute('aria-label',
        'Interactive Bible map. Use arrow keys to pan, plus and minus to zoom, Home to reset the view.');

      this.container.appendChild(this.svgElement);
      this.container.appendChild(this.markersOverlay);
      this._createZoomControls();

      centerOn(this, this.state.currentCenter.lon, this.state.currentCenter.lat, 4);
      setupPanZoom(this);
      await this._loadPins(pinDataPromise);
      this._lazyLoadRelief();
    } catch (err) {
      console.error('MapPanel: failed to load SVG map:', err);
      this.container.innerHTML = '<div style="padding:20px;color:var(--text-color)">Failed to load map</div>';
    }
  }

  /** On-screen zoom controls: + / − / reset view. */
  _createZoomControls() {
    const controls = document.createElement('div');
    controls.className = 'map-zoom-controls';
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-label', 'Map zoom');

    const makeButton = (className, label, html) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `map-zoom-btn ${className}`;
      button.setAttribute('aria-label', label);
      button.title = label;
      button.innerHTML = html;
      controls.appendChild(button);
      return button;
    };

    this._zoomInBtn = makeButton('map-zoom-in', 'Zoom in', '+');
    this._zoomOutBtn = makeButton('map-zoom-out', 'Zoom out', '−');
    const fitBtn = makeButton('map-zoom-fit', 'Reset view',
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      '<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/></svg>');

    this.addListener(this._zoomInBtn, 'click', () => {
      zoomBy(this, 1 / ZOOM_STEP);
      this.triggerSettingsChange();
    });
    this.addListener(this._zoomOutBtn, 'click', () => {
      zoomBy(this, ZOOM_STEP);
      this.triggerSettingsChange();
    });
    this.addListener(fitBtn, 'click', () => {
      this.resetView();
      this.triggerSettingsChange();
    });

    this.container.appendChild(controls);
  }

  /** Disable +/− at the zoom bounds; doubles as the zoom-level indicator. */
  _updateZoomControlState() {
    if (!this._zoomInBtn) return;
    this._zoomInBtn.disabled = isAtMaxZoom(this);
    this._zoomOutBtn.disabled = isAtMinZoom(this);
  }

  /**
   * Lazy-load the (large) shaded-relief raster: the basemap ships the <image> with
   * no href, so the vector coastline + pins paint immediately; we set the href once
   * the browser is idle. If the format can't be decoded, the flat land fill remains.
   */
  _lazyLoadRelief() {
    const img = this.svgElement?.querySelector('#relief-layer');
    if (!img) return;
    const avif = img.getAttribute('data-src');
    const webp = img.getAttribute('data-src-fallback');
    const apply = async () => {
      const src = (avif && await supportsAvif()) ? avif : (webp || avif);
      if (src) img.setAttribute('href', src);
    };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(apply, { timeout: 1500 });
    else setTimeout(apply, 200);
  }

  async _loadPins(pinDataPromise = fetchPinData()) {
    try {
      this.locationData = await pinDataPromise;
      this.locationDataByVerse = MarkerRenderer.createPins(
        this.markersOverlay,
        this.locationData,
        (location) => this._openLocation(location)
      );
      this._filterMarkers(); // ends in a full decoration pass
    } catch (err) {
      console.error('MapPanel: error loading pins', err);
    }
  }

  _filterMarkers({ updateScales = true } = {}) {
    if (!this.markersOverlay || !this.locationDataByVerse) return;

    const isPassageMode = this.state.mode === 'passage';
    this.markersOverlay.querySelectorAll('.map-marker').forEach((marker) => {
      if (marker.classList.contains('highlighted')) {
        marker.classList.remove('filtered-out');
        return;
      }

      let show = !isPassageMode;
      if (isPassageMode && this.state.currentReference && marker.locationData) {
        // Verse IDs are always BOOKCH_V — require the separator so "PS1" can't match "PS119_5"
        show = marker.locationData.verses.some(v => v.startsWith(this.state.currentReference + '_'));
      } else if (!isPassageMode && this.state.exploreEra !== 'all' && marker.locationData) {
        const era = marker.locationData._era;
        show = era === 'both' || era === this.state.exploreEra;
      }

      marker.classList.toggle('filtered-out', !show);
    });

    if (updateScales) this.updateMarkerScales();
  }

  _openLocation(location) {
    MarkerRenderer.fadeMarkers(this.markersOverlay, location);

    // Never zoom OUT when opening a pin — if already zoomed in past level 6, just pan.
    const level6Width = SVG_WIDTH / 6;
    if (this.viewBox.width > level6Width) {
      centerOn(this, location.coordinates[0], location.coordinates[1], 6);
    } else {
      const { x, y } = geoToSvg(location.coordinates[0], location.coordinates[1]);
      this.viewBox.x = x - this.viewBox.width / 2;
      this.viewBox.y = y - this.viewBox.height / 2;
      constrainViewBox(this.viewBox);
      updateViewBox(this.svgElement, this.viewBox);
      this.updateMarkerScales();
      this.triggerSettingsChange();
    }

    // Compute anchor from screen position of the geographic coordinate.
    // We can't rely on getBoundingClientRect() from the marker element because
    // it may still be display:none (clustered) after zoom, returning {0,0}.
    const containerRect = this.container.getBoundingClientRect();
    const { x: svgX, y: svgY } = geoToSvg(location.coordinates[0], location.coordinates[1]);
    const t = getViewTransform(this.viewBox, containerRect);
    const screenX = containerRect.left + t.offsetX + (svgX - this.viewBox.x) * t.scale;
    const screenY = containerRect.top + t.offsetY + (svgY - this.viewBox.y) * t.scale;
    const anchorRect = { left: screenX - 12, right: screenX + 12, top: screenY - 12, bottom: screenY + 12, width: 24, height: 24 };

    // Find co-located locations sharing this pin's position
    const colocated = [];
    if (this.markersOverlay) {
      this.markersOverlay.querySelectorAll('.map-marker').forEach(marker => {
        if (!marker.locationData || marker.locationData === location || marker._svgX === undefined) return;
        const dx = marker._svgX - svgX;
        const dy = marker._svgY - svgY;
        if (dx * dx + dy * dy < COLOCATED_EPSILON * COLOCATED_EPSILON) colocated.push(marker.locationData);
      });
    }

    if (this._onLocationOpen) {
      this._onLocationOpen(location, colocated, this._verseTextLookup);
    } else {
      openDetailPanel(this.detailPanel, location, anchorRect, this._verseTextLookup, colocated, this._detailTextid);
    }
  }

  _wireDetailPanel() {
    // Verse links in detail panel navigate the Bible window
    this.addListener(this.detailPanel, 'click', (e) => {
      const coloc = e.target.closest('.map-detail-colocated-item');
      if (coloc) {
        const idx = parseInt(coloc.getAttribute('data-index'), 10);
        const loc = this.detailPanel._colocatedLocations?.[idx];
        if (loc) this._openLocation(loc);
        return;
      }

      const link = e.target.closest('.verse');
      if (!link || !this._onVerseClick) return;
      this._onVerseClick(
        link.getAttribute('data-sectionid'),
        link.getAttribute('data-fragmentid')
      );
    });

    // Reset marker fading when detail panel closes
    this.addListener(this.detailPanel, 'toggle', (e) => {
      if (e.newState === 'closed') {
        MarkerRenderer.resetMarkerOpacity(this.markersOverlay);
      }
    });

    // Cluster click — zoom to expand
    this.addListener(this.container, 'click', (e) => {
      const cluster = e.target.closest('.map-cluster');
      if (cluster && cluster._clusterData) {
        e.stopPropagation();
        this._handleClusterClick(cluster._clusterData);
      }
    });

    // Cluster keyboard activation (clusters are focusable buttons)
    this.addListener(this.container, 'keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const cluster = e.target.closest?.('.map-cluster');
      if (cluster && cluster._clusterData) {
        e.preventDefault();
        e.stopPropagation();
        this._handleClusterClick(cluster._clusterData);
      }
    });
  }

  _handleClusterClick(clusterData) {
    const locations = clusterData.members.map(m => m.locationData).filter(Boolean);
    if (!locations.length) return;

    // Find the max pairwise SVG distance between cluster members
    const members = clusterData.members;
    let maxDist = 0;
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const dx = (members[i]._svgX || 0) - (members[j]._svgX || 0);
        const dy = (members[i]._svgY || 0) - (members[j]._svgY || 0);
        maxDist = Math.max(maxDist, Math.hypot(dx, dy));
      }
    }

    // Truly co-located pins — no amount of zooming will separate them
    if (maxDist < COLOCATED_EPSILON) {
      this._openLocation(locations[0]);
      return;
    }

    // Use centerOnBounds to center on the pins, then check whether the resulting
    // zoom is tight enough to actually break the cluster radius.
    centerOnBounds(this, locations);

    const containerWidth = this.container.offsetWidth || 800;
    const zoomRatio = this.viewBox.width / SVG_WIDTH;
    const zoomScale = Math.min(1, zoomRatio * 6);
    const clusterRadiusSvg = CLUSTER_RADIUS_PX * zoomScale * this.viewBox.width / containerWidth;

    if (maxDist <= clusterRadiusSvg) {
      // centerOnBounds wasn't tight enough — compute the viewBox width that guarantees
      // separation and zoom there directly (one click, no second click needed).
      // Formula (for viewBox.width < SVG_WIDTH/6): W < sqrt(d * SVG_WIDTH * cW / (6 * R))
      const separationWidth = Math.max(
        Math.sqrt(maxDist * SVG_WIDTH * containerWidth / (6 * CLUSTER_RADIUS_PX)) * CLUSTER_BREAK_MARGIN,
        30
      );
      const cx = this.viewBox.x + this.viewBox.width / 2;
      const cy = this.viewBox.y + this.viewBox.height / 2;
      setViewBoxSize(this, separationWidth);
      this.viewBox.x = cx - this.viewBox.width / 2;
      this.viewBox.y = cy - this.viewBox.height / 2;
      constrainViewBox(this.viewBox);
      updateViewBox(this.svgElement, this.viewBox);
      this.updateMarkerScales();
      this.triggerSettingsChange();
    }
  }
}
