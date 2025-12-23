/**
 * MapWindow - Web Component for SVG-based Bible location maps
 */

import { BaseWindow, registerWindowComponent } from './BaseWindow.js';
import { on, toElement } from '../lib/helpers.esm.js';
import { Reference } from '../bible/BibleReference.js';

/**
 * Jaro-Winkler similarity algorithm for fuzzy string matching
 * Returns a value between 0 (no match) and 1 (exact match)
 */
const jaroWinkler = (s1, s2) => {
  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;

  if (len1 === 0 || len2 === 0) return 0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const matches1 = new Array(len1).fill(false);
  const matches2 = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);

    for (let j = start; j < end; j++) {
      if (matches2[j] || s1[i] !== s2[j]) continue;
      matches1[i] = matches2[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!matches1[i]) continue;
    while (!matches2[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
};

/**
 * Search locations with fuzzy matching
 * Returns sorted results by relevance
 */
const fuzzySearchLocations = (query, locations, limit = 8) => {
  if (!query || !locations) return [];

  const queryLower = query.toLowerCase();
  const results = [];

  for (const location of locations) {
    const nameLower = location.name.toLowerCase();

    // Exact match gets highest score
    if (nameLower === queryLower) {
      results.push({ location, score: 2 });
      continue;
    }

    // Starts with query gets boosted score
    if (nameLower.startsWith(queryLower)) {
      results.push({ location, score: 1.5 + jaroWinkler(queryLower, nameLower) });
      continue;
    }

    // Contains query gets medium boost
    if (nameLower.includes(queryLower)) {
      results.push({ location, score: 1 + jaroWinkler(queryLower, nameLower) });
      continue;
    }

    // Fuzzy match
    const score = jaroWinkler(queryLower, nameLower);
    if (score > 0.7) {
      results.push({ location, score });
    }
  }

  // Sort by score descending, then by verse count for ties
  results.sort((a, b) => {
    if (Math.abs(b.score - a.score) > 0.01) return b.score - a.score;
    return (b.location.verses?.length || 0) - (a.location.verses?.length || 0);
  });

  return results.slice(0, limit).map(r => r.location);
};

const MAP_BOUNDS = {
  minLat: 8,
  maxLat: 47,
  minLon: -8,
  maxLon: 78
};

const SVG_WIDTH = 1200;
const SVG_HEIGHT = 800;
const PADDING = 40;
const CONTENT_WIDTH = SVG_WIDTH - 2 * PADDING;
const CONTENT_HEIGHT = SVG_HEIGHT - 2 * PADDING;

const IMPORTANT_LOCATIONS = new Set([
  'Rome', 'Athens', 'Corinth', 'Ephesus', 'Antioch', 'Alexandria',
  'Thessalonica', 'Philippi', 'Galatia', 'Colossae', 'Patmos',
  'Crete', 'Malta', 'Puteoli', 'Cyprus', 'Iconium', 'Lystra', 'Derbe',
  'Troas', 'Miletus', 'Caesarea Philippi', 'Decapolis', 'Petra'
]);

const DEMOTED_LOCATIONS = new Set([
  'Most Holy Place', 'Most Holy Place 2', 'Holy Place', 'Holy Place 2',
  'Mount Seir 1',
  'Valley of the Son of Hinnom', 'Zorah', 'Valley of the Arnon',
  'Kadesh-barnea', 'Mount Hor', 'Shephelah', 'Succoth',
  'Jazer', 'Jabesh-gilead', 'Tirzah',
  'Hazor', 'Ziklag', 'Gezer', 'Rabbah', 'Ramah',
  'Ashkelon', 'Megiddo', 'Aroer', 'Ekron', 'Lachish',
  'Mahanaim?', 'Kiriath-jearim?'
]);

const ZOOM_THRESHOLDS = {
  1: 0,    // Always visible
  2: 6,    // Medium zoom
  3: 12,   // High zoom
  4: 24    // Maximum zoom
};

/**
 * Calculate importance tier based on verse count
 */
const getImportanceTier = (location) => {
  const verseCount = location.verses?.length || 0;
  const isImportant = IMPORTANT_LOCATIONS.has(location.name);
  const isDemoted = DEMOTED_LOCATIONS.has(location.name);

  if (isDemoted) return 2;
  if (verseCount >= 10 || isImportant) return 1;
  if (verseCount >= 5) return 2;
  if (verseCount >= 3) return 3;
  return 4;
};

/**
 * Convert geographic coordinates to SVG coordinates
 */
const geoToSvg = (lon, lat) => {
  const lonRange = MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon;
  const latRange = MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat;
  const x = PADDING + ((lon - MAP_BOUNDS.minLon) / lonRange) * CONTENT_WIDTH;
  const y = PADDING + ((MAP_BOUNDS.maxLat - lat) / latRange) * CONTENT_HEIGHT;
  return { x, y };
};

/**
 * Convert SVG coordinates to geographic coordinates
 */
const svgToGeo = (x, y) => {
  const lonRange = MAP_BOUNDS.maxLon - MAP_BOUNDS.minLon;
  const latRange = MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat;
  const lon = ((x - PADDING) / CONTENT_WIDTH) * lonRange + MAP_BOUNDS.minLon;
  const lat = MAP_BOUNDS.maxLat - ((y - PADDING) / CONTENT_HEIGHT) * latRange;
  return { lon, lat };
};

/**
 * MapWindow Web Component
 * SVG-based map showing Bible locations with pan/zoom
 */
export class MapWindowComponent extends BaseWindow {
  constructor() {
    super();

    this.state = {
      ...this.state,
      currentCenter: { lat: 31.78, lon: 35.23 }, // Default: Jerusalem
      isPanning: false,
      selectedSuggestionIndex: -1,
      currentSuggestions: []
    };

    this.svgElement = null;
    this.markersGroup = null;
    this.locationData = null;
    this.locationDataByVerse = null;
    this.viewBox = { x: 0, y: 0, width: SVG_WIDTH, height: SVG_HEIGHT };
    this.panStart = { x: 0, y: 0 };
    this.contentToHighlight = [];

    this._documentMouseMoveHandler = null;
    this._documentMouseUpHandler = null;
    this._popupCloseHandler = null;
  }

  async render() {
    this.innerHTML = `
      <div class="window-header scroller-header">
        <div class="scroller-header-inner">
          <input type="text" placeholder="" class="app-input map-nav i18n" data-i18n="[placeholder]windows.map.placeholder" />
          <div class="map-search-suggestions"></div>
        </div>
      </div>
      <div class="window-maps svg-map-container"></div>
    `;
  }

  cacheRefs() {
    super.cacheRefs();

    this.refs.header = this.$('.scroller-header');
    this.refs.mapSearchInput = this.$('.map-nav');
    this.refs.searchSuggestions = this.$('.map-search-suggestions');
    this.refs.mapContainer = this.$('.svg-map-container');

    this.refs.infoPopup = this.createElement('<div class="map-info-popup"></div>');
    this.refs.mapContainer.appendChild(this.refs.infoPopup);
  }

  attachEventListeners() {
    this.addListener(this.refs.mapSearchInput, 'input', () => this.handleSearchInput());
    this.addListener(this.refs.mapSearchInput, 'keydown', (e) => this.handleSearchKeydown(e));
    this.addListener(this.refs.mapSearchInput, 'blur', () => {
      setTimeout(() => this.hideSuggestions(), 150);
    });

    on(this.refs.searchSuggestions, 'click', '.map-suggestion-item', (e) => {
      const item = e.target.closest('.map-suggestion-item');
      const index = parseInt(item.getAttribute('data-index'), 10);
      if (this.state.currentSuggestions[index]) {
        this.openLocation(this.state.currentSuggestions[index]);
        this.refs.mapSearchInput.value = this.state.currentSuggestions[index].name;
        this.hideSuggestions();
      }
    });

    on(this.refs.searchSuggestions, 'mouseenter', '.map-suggestion-item', (e) => {
      const item = e.target.closest('.map-suggestion-item');
      const index = parseInt(item.getAttribute('data-index'), 10);
      this.selectSuggestion(index);
    });

    on(this.refs.mapContainer, 'click', '.verse, .v', (e) => {
      const link = e.target.closest('.verse, .v');
      const sectionid = link.getAttribute('data-sectionid');
      const fragmentid = link.getAttribute('data-fragmentid');

      this.trigger('globalmessage', {
        type: 'globalmessage',
        target: this,
        data: {
          messagetype: 'nav',
          type: 'bible',
          locationInfo: { sectionid, fragmentid }
        }
      });
    });

    this.on('message', (e) => this.handleMessage(e));
  }

  async init() {
    const initData = this.initData || {};
    if (initData.latitude !== undefined) {
      this.state.currentCenter.lat = initData.latitude;
    }
    if (initData.longitude !== undefined) {
      this.state.currentCenter.lon = initData.longitude;
    }

    await this.initMap();
  }

  cleanup() {
    if (this._documentMouseMoveHandler) {
      document.removeEventListener('mousemove', this._documentMouseMoveHandler);
    }
    if (this._documentMouseUpHandler) {
      document.removeEventListener('mouseup', this._documentMouseUpHandler);
    }
    if (this._popupCloseHandler) {
      document.removeEventListener('click', this._popupCloseHandler);
    }

    this.removeHighlights();

    super.cleanup();
  }

  async initMap() {
    try {
      const response = await fetch('content/maps/biblical-map.svg');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const svgText = await response.text();

      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, 'image/svg+xml');
      this.svgElement = svgDoc.documentElement;

      this.svgElement.setAttribute('width', '100%');
      this.svgElement.setAttribute('height', '100%');
      this.svgElement.style.display = 'block';

      this.markersGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      this.markersGroup.setAttribute('id', 'markers');
      this.svgElement.appendChild(this.markersGroup);

      this.refs.mapContainer.insertBefore(this.svgElement, this.refs.infoPopup);

      this.centerOn(this.state.currentCenter.lon, this.state.currentCenter.lat, 4);
      this.setupPanZoom();
      this.loadPins();
    } catch (err) {
      console.error('Failed to load SVG map:', err);
      this.refs.mapContainer.innerHTML = '<div style="padding: 20px; color: var(--text-color);">Failed to load map</div>';
    }
  }

  setupPanZoom() {
    this.addListener(this.refs.mapContainer, 'wheel', (e) => {
      e.preventDefault();
      const rect = this.refs.mapContainer.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const svgX = this.viewBox.x + (mouseX / rect.width) * this.viewBox.width;
      const svgY = this.viewBox.y + (mouseY / rect.height) * this.viewBox.height;

      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
      const newWidth = Math.min(SVG_WIDTH * 2, Math.max(50, this.viewBox.width * zoomFactor));
      const newHeight = Math.min(SVG_HEIGHT * 2, Math.max(33, this.viewBox.height * zoomFactor));

      this.viewBox.x = svgX - (mouseX / rect.width) * newWidth;
      this.viewBox.y = svgY - (mouseY / rect.height) * newHeight;
      this.viewBox.width = newWidth;
      this.viewBox.height = newHeight;

      this.constrainViewBox();
      this.updateViewBox();
      this.updateMarkerScales();
    }, { passive: false });

    this.addListener(this.refs.mapContainer, 'mousedown', (e) => {
      if (e.target.closest('.map-marker')) return;
      this.state.isPanning = true;
      this.panStart = { x: e.clientX, y: e.clientY };
      this.refs.mapContainer.style.cursor = 'grabbing';
    });

    this._documentMouseMoveHandler = (e) => {
      if (!this.state.isPanning) return;
      const rect = this.refs.mapContainer.getBoundingClientRect();
      const dx = (e.clientX - this.panStart.x) * (this.viewBox.width / rect.width);
      const dy = (e.clientY - this.panStart.y) * (this.viewBox.height / rect.height);

      this.viewBox.x -= dx;
      this.viewBox.y -= dy;
      this.panStart = { x: e.clientX, y: e.clientY };

      this.constrainViewBox();
      this.updateViewBox();
    };

    this._documentMouseUpHandler = () => {
      if (this.state.isPanning) {
        this.state.isPanning = false;
        this.refs.mapContainer.style.cursor = 'grab';
        this.triggerSettingsChange();
      }
    };

    document.addEventListener('mousemove', this._documentMouseMoveHandler);
    document.addEventListener('mouseup', this._documentMouseUpHandler);

    let lastTouchDist = 0;

    this.addListener(this.refs.mapContainer, 'touchstart', (e) => {
      if (e.touches.length === 1) {
        this.state.isPanning = true;
        this.panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        this.state.isPanning = false;
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    this.addListener(this.refs.mapContainer, 'touchmove', (e) => {
      e.preventDefault();
      const rect = this.refs.mapContainer.getBoundingClientRect();

      if (e.touches.length === 1 && this.state.isPanning) {
        const dx = (e.touches[0].clientX - this.panStart.x) * (this.viewBox.width / rect.width);
        const dy = (e.touches[0].clientY - this.panStart.y) * (this.viewBox.height / rect.height);

        this.viewBox.x -= dx;
        this.viewBox.y -= dy;
        this.panStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };

        this.constrainViewBox();
        this.updateViewBox();
      } else if (e.touches.length === 2) {
        const newDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const scale = lastTouchDist / newDist;

        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

        const svgX = this.viewBox.x + ((centerX - rect.left) / rect.width) * this.viewBox.width;
        const svgY = this.viewBox.y + ((centerY - rect.top) / rect.height) * this.viewBox.height;

        const newWidth = Math.min(SVG_WIDTH * 2, Math.max(50, this.viewBox.width * scale));
        const newHeight = Math.min(SVG_HEIGHT * 2, Math.max(33, this.viewBox.height * scale));

        this.viewBox.x = svgX - ((centerX - rect.left) / rect.width) * newWidth;
        this.viewBox.y = svgY - ((centerY - rect.top) / rect.height) * newHeight;
        this.viewBox.width = newWidth;
        this.viewBox.height = newHeight;

        lastTouchDist = newDist;

        this.constrainViewBox();
        this.updateViewBox();
        this.updateMarkerScales();
      }
    }, { passive: false });

    this.addListener(this.refs.mapContainer, 'touchend', () => {
      this.state.isPanning = false;
      this.triggerSettingsChange();
    }, { passive: true });

    this.refs.mapContainer.style.cursor = 'grab';
  }

  constrainViewBox() {
    const padding = 100;
    this.viewBox.x = Math.max(-padding, Math.min(SVG_WIDTH - this.viewBox.width + padding, this.viewBox.x));
    this.viewBox.y = Math.max(-padding, Math.min(SVG_HEIGHT - this.viewBox.height + padding, this.viewBox.y));
  }

  updateViewBox() {
    if (this.svgElement) {
      this.svgElement.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`);
    }
  }

  updateMarkerScales() {
    if (!this.markersGroup) return;

    const scale = this.viewBox.width / SVG_WIDTH;
    const zoomLevel = SVG_WIDTH / this.viewBox.width;

    this.markersGroup.querySelectorAll('.map-marker').forEach((marker) => {
      const tier = parseInt(marker.getAttribute('data-tier') || '4', 10);
      const threshold = ZOOM_THRESHOLDS[tier] || 0;

      const isVisible = zoomLevel >= threshold;
      marker.style.display = isVisible ? '' : 'none';

      if (isVisible) {
        const baseSize = tier === 1 ? 14 : tier === 2 ? 10 : 8;
        const baseStroke = tier === 1 ? 2 : 1.5;
        const markerSize = baseSize * scale;
        const strokeWidth = baseStroke * scale;
        const fontSize = 36 * scale;

        const circle = marker.querySelector('circle');
        const text = marker.querySelector('text');

        if (circle) {
          circle.setAttribute('r', markerSize);
          circle.setAttribute('stroke-width', strokeWidth);
        }
        if (text) {
          text.setAttribute('font-size', fontSize);
          const labelOffset = -markerSize - 8 * scale;
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
  }

  centerOn(lon, lat, zoomLevel = 1) {
    const { x, y } = geoToSvg(lon, lat);
    const baseWidth = SVG_WIDTH / zoomLevel;
    const baseHeight = SVG_HEIGHT / zoomLevel;

    this.viewBox.width = baseWidth;
    this.viewBox.height = baseHeight;
    this.viewBox.x = x - baseWidth / 2;
    this.viewBox.y = y - baseHeight / 2;

    this.constrainViewBox();
    this.updateViewBox();
    this.updateMarkerScales();

    const center = svgToGeo(this.viewBox.x + this.viewBox.width / 2, this.viewBox.y + this.viewBox.height / 2);
    this.state.currentCenter = { lat: center.lat, lon: center.lon };
  }

  triggerSettingsChange() {
    const center = svgToGeo(this.viewBox.x + this.viewBox.width / 2, this.viewBox.y + this.viewBox.height / 2);
    this.state.currentCenter = { lat: center.lat, lon: center.lon };

    this.trigger('settingschange', {
      type: 'settingschange',
      target: this,
      data: {
        latitude: center.lat,
        longitude: center.lon,
        label: `Map: ${center.lat.toFixed(3)}, ${center.lon.toFixed(3)}`
      }
    });
  }

  handleSearchInput() {
    const value = this.refs.mapSearchInput.value.trim();
    if (value.length < 2) {
      this.hideSuggestions();
      return;
    }
    const suggestions = fuzzySearchLocations(value, this.locationData);
    this.showSuggestions(suggestions);
  }

  handleSearchKeydown(e) {
    if (this.state.currentSuggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = Math.min(this.state.selectedSuggestionIndex + 1, this.state.currentSuggestions.length - 1);
      this.selectSuggestion(newIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = Math.max(this.state.selectedSuggestionIndex - 1, 0);
      this.selectSuggestion(newIndex);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this.state.selectedSuggestionIndex >= 0 && this.state.currentSuggestions[this.state.selectedSuggestionIndex]) {
        this.openLocation(this.state.currentSuggestions[this.state.selectedSuggestionIndex]);
        this.refs.mapSearchInput.value = this.state.currentSuggestions[this.state.selectedSuggestionIndex].name;
      } else if (this.state.currentSuggestions.length > 0) {
        this.openLocation(this.state.currentSuggestions[0]);
        this.refs.mapSearchInput.value = this.state.currentSuggestions[0].name;
      }
      this.hideSuggestions();
    } else if (e.key === 'Escape') {
      this.hideSuggestions();
    }
  }

  showSuggestions(suggestions) {
    this.state.currentSuggestions = suggestions;
    this.state.selectedSuggestionIndex = -1;

    if (suggestions.length === 0) {
      this.refs.searchSuggestions.style.display = 'none';
      return;
    }

    this.refs.searchSuggestions.innerHTML = suggestions.map((loc, i) => {
      const verseCount = loc.verses?.length || 0;
      return `<div class="map-suggestion-item" data-index="${i}">
        <span>${this.escapeHtml(loc.name)}</span>
        <span class="verse-count">${verseCount} verses</span>
      </div>`;
    }).join('');

    this.refs.searchSuggestions.style.display = 'block';
  }

  hideSuggestions() {
    this.refs.searchSuggestions.style.display = 'none';
    this.state.currentSuggestions = [];
    this.state.selectedSuggestionIndex = -1;
  }

  selectSuggestion(index) {
    const items = this.refs.searchSuggestions.querySelectorAll('.map-suggestion-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === index);
    });
    this.state.selectedSuggestionIndex = index;
  }

  loadPins() {
    fetch(`${this.config.baseContentUrl}content/maps/maps.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((mapData) => {
        this.locationData = mapData.names;
        this.createPins();
      })
      .catch(() => {
        console.log('MAP: error loading pins');
      });
  }

  createPins() {
    if (!this.markersGroup || !this.locationData) return;

    this.locationDataByVerse = {};

    for (const location of this.locationData) {
      const lon = location.coordinates[0];
      const lat = location.coordinates[1];

      if (lon < MAP_BOUNDS.minLon || lon > MAP_BOUNDS.maxLon ||
          lat < MAP_BOUNDS.minLat || lat > MAP_BOUNDS.maxLat) {
        continue;
      }

      const { x, y } = geoToSvg(lon, lat);
      const tier = getImportanceTier(location);

      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      marker.setAttribute('class', 'map-marker');
      marker.setAttribute('data-tier', tier);
      marker.setAttribute('transform', `translate(${x}, ${y})`);
      marker.style.cursor = 'pointer';

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', 0);
      circle.setAttribute('cy', 0);
      circle.setAttribute('r', tier === 1 ? 14 : tier === 2 ? 10 : 8);
      circle.setAttribute('fill', tier === 1 ? '#c41e3a' : tier === 2 ? '#d45a5a' : '#e08080');
      circle.setAttribute('stroke', '#fff');
      circle.setAttribute('stroke-width', tier === 1 ? 2 : 1.5);
      marker.appendChild(circle);

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
      text.textContent = location.name;
      labelGroup.appendChild(text);

      marker.appendChild(labelGroup);

      marker.locationData = location;

      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openLocation(location);
      });

      marker.addEventListener('mouseenter', () => {
        this.markersGroup.appendChild(marker);
      });

      this.markersGroup.appendChild(marker);

      for (const verseid of location.verses) {
        if (!this.locationDataByVerse[verseid]) {
          this.locationDataByVerse[verseid] = [];
        }
        this.locationDataByVerse[verseid].push(location);
      }
    }

    this.updateMarkerScales();
    this.highlightStoredLocations();
  }

  fadeOtherMarkers(selectedLocation) {
    if (!this.markersGroup) return;
    this.markersGroup.querySelectorAll('.map-marker').forEach((marker) => {
      const isSelected = marker.locationData === selectedLocation;
      marker.style.opacity = isSelected ? '1' : '0.1';
    });
  }

  resetMarkerOpacity() {
    if (!this.markersGroup) return;
    this.markersGroup.querySelectorAll('.map-marker').forEach((marker) => {
      marker.style.opacity = '1';
    });
  }

  openLocation(location) {
    const versesHtml = location.verses.map((a) => {
      const bibleRef = new Reference(a);
      const sectionid = bibleRef.bookid + bibleRef.chapter;
      const fragmentid = `${sectionid}_${bibleRef.verse1}`;

      return `<span class="verse" style="text-decoration:underline; cursor: pointer" data-sectionid="${sectionid}" data-fragmentid="${fragmentid}">${bibleRef.toString()}</span>`;
    });

    this.refs.infoPopup.innerHTML =
      `<div class="map-popup-content">` +
      `<h2>${this.escapeHtml(location.name)}</h2>` +
      `<p>${versesHtml.join('; ')}</p>` +
      `</div>`;
    this.refs.infoPopup.classList.add('visible');

    this.fadeOtherMarkers(location);
    this.centerOn(location.coordinates[0], location.coordinates[1], 6);

    if (this._popupCloseHandler) {
      document.removeEventListener('click', this._popupCloseHandler);
    }

    this._popupCloseHandler = (e) => {
      if (!this.refs.infoPopup?.contains(e.target)) {
        this.refs.infoPopup?.classList.remove('visible');
        this.resetMarkerOpacity();
        document.removeEventListener('click', this._popupCloseHandler);
        this._popupCloseHandler = null;
      }
    };
    setTimeout(() => document.addEventListener('click', this._popupCloseHandler), 10);
  }

  findMarkerByText(value) {
    if (!this.locationData) return;
    const results = fuzzySearchLocations(value, this.locationData, 1);
    if (results.length > 0) {
      this.openLocation(results[0]);
    }
  }

  highlightStoredLocations() {
    if (this.contentToHighlight.length > 0) {
      for (const content of this.contentToHighlight) {
        this.highlightLocations(content);
      }
      this.contentToHighlight = [];
    }
  }

  highlightLocations(content) {
    let contentEl;
    if (typeof content === 'string') {
      const temp = document.createElement('div');
      temp.innerHTML = content;
      contentEl = temp;
    } else {
      contentEl = toElement(content);
    }

    contentEl.querySelectorAll('.verse, .v').forEach((verse) => {
      const verseid = verse.getAttribute('data-id');
      const verseLocations = this.locationDataByVerse[verseid];
      let html = verse.innerHTML;

      if (verseLocations !== undefined) {
        for (const location of verseLocations) {
          const regexp = new RegExp(`\\b${location.name}\\b`, 'gi');
          html = html.replace(regexp, `<span class="linked-location">${location.name}</span>`);

          if (this.markersGroup) {
            this.markersGroup.querySelectorAll('.map-marker').forEach((marker) => {
              if (marker.locationData?.name === location.name) {
                marker.querySelector('circle')?.setAttribute('fill', '#135C13');
              }
            });
          }
        }
      }

      verse.innerHTML = html;
    });

    on(contentEl, 'click', '.location', (e) => {
      this.findMarkerByText(e.target.innerHTML);
    });
  }

  removeHighlights() {
    document.querySelectorAll('.BibleWindow .linked-location').forEach((el) => {
      if (el.tagName.toLowerCase() === 'l') {
        el.className = el.className.replace(/linked-location/gi, '');
      } else {
        const textFragment = document.createTextNode(el.textContent);
        if (el.parentNode) {
          el.parentNode.insertBefore(textFragment, el);
          el.parentNode.removeChild(el);
        }
      }
    });
  }

  handleMessage(e) {
    if (e.data.messagetype === 'textload') {
      if (this.locationDataByVerse === null) {
        this.contentToHighlight.push(e.data.content);
      } else {
        this.highlightStoredLocations();
        this.highlightLocations(e.data.content);
      }
    }
  }

  size(width, height) {
    const headerHeight = 40;
    this.refs.mapContainer.style.width = `${width}px`;
    this.refs.mapContainer.style.height = `${height - headerHeight}px`;
  }

  getData() {
    return {
      latitude: this.state.currentCenter.lat,
      longitude: this.state.currentCenter.lon,
      params: {
        win: 'map',
        latitude: this.state.currentCenter.lat,
        longitude: this.state.currentCenter.lon
      }
    };
  }
}

registerWindowComponent('map-window', MapWindowComponent, {
  windowType: 'map',
  displayName: 'Map',
  paramKeys: { latitude: 'la', longitude: 'ln' }
});

export { MapWindowComponent as MapWindow };

export default MapWindowComponent;
