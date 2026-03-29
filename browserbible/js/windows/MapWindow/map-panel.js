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

import { SVG_WIDTH, SVG_HEIGHT, CLUSTER_RADIUS_PX } from './constants.js';
import { svgToGeo, geoToSvg } from './geo-utils.js';
import { NT_BOOKS } from '../../bible/BibleData.js';
import * as MarkerRenderer from './marker-renderer.js';
import { loadLocationData, getLocationsForReference } from './map-data.js';
import { setupPanZoom, centerOn, centerOnBounds, constrainViewBox, updateViewBox } from './pan-zoom.js';
import { createDetailPanel, openDetailPanel, destroyDetailPanel } from './detail-panel.js';
import { highlightLocations, removeHighlights } from './highlight.js';
import { computeClusters, renderClusters, applyClusterVisibility } from './clustering.js';

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
      currentCenter: { lat: 31.78, lon: 35.23 },
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
    this._filterMarkers();

    if (this.state.mode === 'passage' && sectionId && this.locationData) {
      const locations = getLocationsForReference(this.locationData, sectionId);
      if (locations.length > 0) centerOnBounds(this, locations);
    }
  }

  /**
   * Switch between 'passage' and 'explore' modes.
   */
  setMode(mode) {
    this.state.mode = mode;
    this._filterMarkers();

    if (mode === 'explore') {
      centerOn(this, 35.23, 31.78, 1);
    } else if (this.state.currentReference && this.locationData) {
      const locations = getLocationsForReference(this.locationData, this.state.currentReference);
      if (locations.length > 0) centerOnBounds(this, locations);
    }
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
   */
  highlight() {
    if (this.locationDataByVerse) {
      highlightLocations(this.markersOverlay, this.locationDataByVerse);
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

  /** Called by pan-zoom.js after zoom or pan end — resets overlay and recalculates all positions. */
  updateMarkerScales() {
    if (!this.markersOverlay) return;

    // Reset the pan-translate so individual marker positions are authoritative again
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
      const response = await fetch('content/maps/biblical-map.svg');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const svgText = await response.text();

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      this.svgElement = svgDoc.documentElement;
      this.svgElement.setAttribute('width', '100%');
      this.svgElement.setAttribute('height', '100%');
      this.svgElement.setAttribute('preserveAspectRatio', 'none');
      this.svgElement.style.display = 'block';

      this.markersOverlay = document.createElement('div');
      this.markersOverlay.className = 'map-markers-overlay';

      this.container.appendChild(this.svgElement);
      this.container.appendChild(this.markersOverlay);

      centerOn(this, this.state.currentCenter.lon, this.state.currentCenter.lat, 4);
      setupPanZoom(this);
      await this._loadPins();
    } catch (err) {
      console.error('MapPanel: failed to load SVG map:', err);
      this.container.innerHTML = '<div style="padding:20px;color:var(--text-color)">Failed to load map</div>';
    }
  }

  async _loadPins() {
    try {
      const mapData = await loadLocationData();
      this.locationData = mapData;

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
      this.locationDataByVerse = MarkerRenderer.createPins(
        this.markersOverlay,
        this.locationData,
        (location) => this._openLocation(location)
      );
      this.updateMarkerScales();
      this._filterMarkers();
    } catch (err) {
      console.error('MapPanel: error loading pins', err);
    }
  }

  _filterMarkers() {
    if (!this.markersOverlay || !this.locationDataByVerse) return;

    const isPassageMode = this.state.mode === 'passage';
    this.markersOverlay.querySelectorAll('.map-marker').forEach((marker) => {
      if (marker.classList.contains('highlighted')) {
        marker.classList.remove('filtered-out');
        return;
      }

      let show = !isPassageMode;
      if (isPassageMode && this.state.currentReference && marker.locationData) {
        show = marker.locationData.verses.some(v => v.startsWith(this.state.currentReference));
      } else if (!isPassageMode && this.state.exploreEra !== 'all' && marker.locationData) {
        const era = marker.locationData._era;
        show = era === 'both' || era === this.state.exploreEra;
      }

      marker.classList.toggle('filtered-out', !show);
    });

    this.updateMarkerScales();
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
    const screenX = containerRect.left + (svgX - this.viewBox.x) / this.viewBox.width * containerRect.width;
    const screenY = containerRect.top + (svgY - this.viewBox.y) / this.viewBox.height * containerRect.height;
    const anchorRect = { left: screenX - 12, right: screenX + 12, top: screenY - 12, bottom: screenY + 12, width: 24, height: 24 };

    // Find co-located locations sharing this pin's position
    const colocated = [];
    if (this.markersOverlay) {
      this.markersOverlay.querySelectorAll('.map-marker').forEach(marker => {
        if (!marker.locationData || marker.locationData === location || marker._svgX === undefined) return;
        const dx = marker._svgX - svgX;
        const dy = marker._svgY - svgY;
        if (dx * dx + dy * dy < 0.25) colocated.push(marker.locationData);
      });
    }

    if (this._onLocationOpen) {
      this._onLocationOpen(location, colocated, this._verseTextLookup);
    } else {
      openDetailPanel(this.detailPanel, location, anchorRect, this._verseTextLookup, colocated);
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
    if (maxDist < 0.5) {
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
        Math.sqrt(maxDist * SVG_WIDTH * containerWidth / (6 * CLUSTER_RADIUS_PX)) * 0.75,
        30
      );
      const cx = this.viewBox.x + this.viewBox.width / 2;
      const cy = this.viewBox.y + this.viewBox.height / 2;
      this.viewBox.width = separationWidth;
      this.viewBox.height = separationWidth * SVG_HEIGHT / SVG_WIDTH;
      this.viewBox.x = cx - this.viewBox.width / 2;
      this.viewBox.y = cy - this.viewBox.height / 2;
      constrainViewBox(this.viewBox);
      updateViewBox(this.svgElement, this.viewBox);
      this.updateMarkerScales();
      this.triggerSettingsChange();
    }
  }
}
