/**
 * MapWindow - Web Component for SVG-based Bible location maps
 */

import { BaseWindow, registerWindowComponent } from '../BaseWindow.js';
import { offset } from '../../lib/helpers.esm.js';
import { Reference } from '../../bible/BibleReference.js';
import gearSvg from '../../../css/images/gear.svg?raw';
import { fuzzySearchLocations } from './fuzzy-search.js';
import { SVG_WIDTH, SVG_HEIGHT, COLLISION_DETECTION_ENABLED } from './constants.js';
import { geoToSvg, svgToGeo } from './geo-utils.js';
import * as MarkerRenderer from './marker-renderer.js';
import { optimizeMarkerPositions, applyCollisionOffsets } from './collision-detection.js';

export class MapWindowComponent extends BaseWindow {
  constructor() {
    super();

    this.state = {
      ...this.state,
      currentCenter: { lat: 31.78, lon: 35.23 }, // Default: Jerusalem
      isPanning: false,
      selectedSuggestionIndex: -1,
      currentSuggestions: [],
      showAllLocations: false,
      currentReference: null,
      enabledTiers: new Set([1, 2, 3, 4]), // All tiers enabled by default
      enabledTypes: new Set(['building', 'city', 'desert', 'island', 'mountain', 'other', 'region', 'river', 'sea', 'spring', 'valley']) // All types enabled by default
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
          <div class="map-options-button header-icon" style="margin-left: auto;"></div>
          <div class="map-search-suggestions"></div>
        </div>
      </div>
      <div class="window-maps svg-map-container"></div>
    `;

    this.querySelector('.map-options-button').innerHTML = gearSvg;

    // Create map options popover (appended to body)
    this.mapOptionsPopover = this.createElement(`
      <div class="map-options-popover" popover>
        <div class="map-options-header">Map Options</div>
        <div class="map-options-main">
          <label style="display: block; margin-bottom: 8px; cursor: pointer;">
            <input type="checkbox" class="map-show-all-checkbox" />
            <span>Show all locations</span>
          </label>

          <div class="division-list">
            <label class="division-header">
              <input type="checkbox" class="map-tier-all-checkbox" checked />
              Location Importance
            </label>
            <div class="division-list-items">
              <label class="division-name">
                <input type="checkbox" class="map-tier-checkbox" data-tier="1" checked />
                <span>Major (10+ verses)</span>
              </label>
              <label class="division-name">
                <input type="checkbox" class="map-tier-checkbox" data-tier="2" checked />
                <span>Important (5-9 verses)</span>
              </label>
              <label class="division-name">
                <input type="checkbox" class="map-tier-checkbox" data-tier="3" checked />
                <span>Notable (3-4 verses)</span>
              </label>
              <label class="division-name">
                <input type="checkbox" class="map-tier-checkbox" data-tier="4" checked />
                <span>Minor (1-2 verses)</span>
              </label>
            </div>
          </div>

          <div class="division-list">
            <label class="division-header">
              <input type="checkbox" class="map-type-all-checkbox" checked />
              Location Types
            </label>
            <div class="division-list-items">
              <label class="division-name">
                <input type="checkbox" class="map-type-checkbox" data-type="building" checked />
                <span>Buildings</span>
              </label>
              <label class="division-name">
                <input type="checkbox" class="map-type-checkbox" data-type="city" checked />
                <span>Cities</span>
              </label>
              <label class="division-name">
                <input type="checkbox" class="map-type-checkbox" data-type="desert" checked />
                <span>Deserts</span>
              </label>
              <label class="division-name">
                <input type="checkbox" class="map-type-checkbox" data-type="island" checked />
                <span>Islands</span>
              </label>
              <label class="division-name">
                <input type="checkbox" class="map-type-checkbox" data-type="mountain" checked />
                <span>Mountains</span>
              </label>
              <label class="division-name">
                <input type="checkbox" class="map-type-checkbox" data-type="other" checked />
                <span>Other</span>
              </label>
              <label class="division-name">
                <input type="checkbox" class="map-type-checkbox" data-type="region" checked />
                <span>Regions</span>
              </label>
              <label class="division-name">
                <input type="checkbox" class="map-type-checkbox" data-type="river" checked />
                <span>Rivers</span>
              </label>
              <label class="division-name">
                <input type="checkbox" class="map-type-checkbox" data-type="sea" checked />
                <span>Seas</span>
              </label>
              <label class="division-name">
                <input type="checkbox" class="map-type-checkbox" data-type="spring" checked />
                <span>Springs</span>
              </label>
              <label class="division-name">
                <input type="checkbox" class="map-type-checkbox" data-type="valley" checked />
                <span>Valleys</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    `);
    this.mapOptionsPopover.style.width = '320px';
    document.body.appendChild(this.mapOptionsPopover);
  }

  cacheRefs() {
    super.cacheRefs();

    this.refs.header = this.$('.scroller-header');
    this.refs.mapSearchInput = this.$('.map-nav');
    this.refs.searchSuggestions = this.$('.map-search-suggestions');
    this.refs.mapOptionsButton = this.$('.map-options-button');
    this.refs.mapContainer = this.$('.svg-map-container');

    // Refs in popover
    this.refs.showAllCheckbox = this.mapOptionsPopover.querySelector('.map-show-all-checkbox');
    this.refs.tierAllCheckbox = this.mapOptionsPopover.querySelector('.map-tier-all-checkbox');
    this.refs.tierCheckboxes = this.mapOptionsPopover.querySelectorAll('.map-tier-checkbox');
    this.refs.typeAllCheckbox = this.mapOptionsPopover.querySelector('.map-type-all-checkbox');
    this.refs.typeCheckboxes = this.mapOptionsPopover.querySelectorAll('.map-type-checkbox');

    this.refs.infoPopup = this.createElement('<div class="map-info-popup"></div>');
    this.refs.mapContainer.appendChild(this.refs.infoPopup);
  }

  attachEventListeners() {
    this.addListener(this.refs.mapSearchInput, 'input', () => this.handleSearchInput());
    this.addListener(this.refs.mapSearchInput, 'keydown', (e) => this.handleSearchKeydown(e));
    this.addListener(this.refs.mapSearchInput, 'blur', () => {
      setTimeout(() => this.hideSuggestions(), 150);
    });

    // Map options button
    this.addListener(this.refs.mapOptionsButton, 'click', () => {
      this.mapOptionsPopover.togglePopover();
    });

    // Map options popover positioning
    this.addListener(this.mapOptionsPopover, 'beforetoggle', (e) => {
      if (e.newState === 'open') {
        this.positionMapOptions();
      }
    });

    // Show all checkbox
    this.addListener(this.refs.showAllCheckbox, 'change', () => {
      this.state.showAllLocations = this.refs.showAllCheckbox.checked;
      this.filterMarkers();
    });

    // Tier "select all" checkbox
    this.addListener(this.refs.tierAllCheckbox, 'change', () => {
      const checked = this.refs.tierAllCheckbox.checked;
      this.refs.tierCheckboxes.forEach(checkbox => {
        checkbox.checked = checked;
        const tier = parseInt(checkbox.getAttribute('data-tier'), 10);
        if (checked) {
          this.state.enabledTiers.add(tier);
        } else {
          this.state.enabledTiers.delete(tier);
        }
      });
      this.filterMarkers();
    });

    // Individual tier checkboxes
    this.refs.tierCheckboxes.forEach(checkbox => {
      this.addListener(checkbox, 'change', () => {
        const tier = parseInt(checkbox.getAttribute('data-tier'), 10);
        if (checkbox.checked) {
          this.state.enabledTiers.add(tier);
        } else {
          this.state.enabledTiers.delete(tier);
        }
        this.updateTierAllCheckbox();
        this.filterMarkers();
      });
    });

    // Type "select all" checkbox
    this.addListener(this.refs.typeAllCheckbox, 'change', () => {
      const checked = this.refs.typeAllCheckbox.checked;
      this.refs.typeCheckboxes.forEach(checkbox => {
        checkbox.checked = checked;
        const type = checkbox.getAttribute('data-type');
        if (checked) {
          this.state.enabledTypes.add(type);
        } else {
          this.state.enabledTypes.delete(type);
        }
      });
      this.filterMarkers();
    });

    // Individual type checkboxes
    this.refs.typeCheckboxes.forEach(checkbox => {
      this.addListener(checkbox, 'change', () => {
        const type = checkbox.getAttribute('data-type');
        if (checkbox.checked) {
          this.state.enabledTypes.add(type);
        } else {
          this.state.enabledTypes.delete(type);
        }
        this.updateTypeAllCheckbox();
        this.filterMarkers();
      });
    });

    this.refs.searchSuggestions.addEventListener('click', (e) => {
      const item = e.target.closest('.map-suggestion-item');
      if (!item) return;
      const index = parseInt(item.getAttribute('data-index'), 10);
      if (this.state.currentSuggestions[index]) {
        this.openLocation(this.state.currentSuggestions[index]);
        this.refs.mapSearchInput.value = this.state.currentSuggestions[index].name;
        this.hideSuggestions();
      }
    });

    this.refs.searchSuggestions.addEventListener('mouseenter', (e) => {
      const item = e.target.closest('.map-suggestion-item');
      if (!item) return;
      const index = parseInt(item.getAttribute('data-index'), 10);
      this.selectSuggestion(index);
    }, true);

    this.refs.mapContainer.addEventListener('click', (e) => {
      const link = e.target.closest('.verse, .v');
      if (!link) return;
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
    this.on('globalmessage', (e) => this.handleGlobalMessage(e));
  }

  async init() {
    const initData = this.initData || {};
    if (initData.latitude !== undefined) {
      this.state.currentCenter.lat = initData.latitude;
    }
    if (initData.longitude !== undefined) {
      this.state.currentCenter.lon = initData.longitude;
    }

    // Add CSS for filtered markers (hidden by relevance, not zoom)
    if (!document.getElementById('map-filter-styles')) {
      const style = document.createElement('style');
      style.id = 'map-filter-styles';
      style.textContent = `
        .map-marker.filtered-out {
          display: none !important;
        }
      `;
      document.head.appendChild(style);
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

    if (this.mapOptionsPopover && this.mapOptionsPopover.parentNode) {
      this.mapOptionsPopover.remove();
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
      const newWidth = Math.min(SVG_WIDTH * 2, Math.max(12, this.viewBox.width * zoomFactor));
      const newHeight = Math.min(SVG_HEIGHT * 2, Math.max(8, this.viewBox.height * zoomFactor));

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
    MarkerRenderer.updateMarkerScales(this.markersGroup, this.viewBox);

    // Apply collision detection to prevent icon overlap
    if (COLLISION_DETECTION_ENABLED) {
      this.applyCollisionDetection();
    }
  }

  applyCollisionDetection() {
    if (!this.markersGroup) return;

    const markers = Array.from(this.markersGroup.querySelectorAll('.map-marker'));
    const visibleMarkers = markers.filter(m => m.style.display !== 'none');

    if (visibleMarkers.length > 0) {
      const offsets = optimizeMarkerPositions(visibleMarkers);
      applyCollisionOffsets(offsets);
    }
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

  positionMapOptions() {
    const buttonPos = offset(this.refs.mapOptionsButton);
    const top = buttonPos.top + this.refs.mapOptionsButton.offsetHeight + 8;
    const winWidth = window.innerWidth;
    let left = buttonPos.left;

    const popoverWidth = 320;
    if (left + popoverWidth > winWidth) {
      left = winWidth - popoverWidth - 20;
    }

    this.mapOptionsPopover.style.top = `${top}px`;
    this.mapOptionsPopover.style.left = `${left}px`;
  }

  loadPins() {
    fetch(`https://dev.inscript.org/content/maps/maps.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((mapData) => {
        this.locationData = mapData;
        this.locationDataByVerse = MarkerRenderer.createPins(
          this.markersGroup,
          this.locationData,
          (location) => this.openLocation(location)
        );

        // Call these after locationDataByVerse is assigned
        this.updateMarkerScales();
        this.highlightStoredLocations();
        this.filterMarkers();
        this.requestCurrentBibleContent();
      })
      .catch((err) => {
        console.error('MAP: error loading pins', err);
      });
  }

  requestCurrentBibleContent() {
    // Request current content from existing BibleWindows to handle
    // case where MapWindow was created after BibleWindow already loaded content
    this.trigger('globalmessage', {
      type: 'globalmessage',
      target: this,
      data: {
        messagetype: 'maprequest',
        requesttype: 'currentcontent'
      }
    });
  }

  fadeOtherMarkers(selectedLocation) {
    MarkerRenderer.fadeMarkers(this.markersGroup, selectedLocation);
  }

  resetMarkerOpacity() {
    MarkerRenderer.resetMarkerOpacity(this.markersGroup);
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
    // Highlight locations in the actual BibleWindow DOM, not a copy
    document.querySelectorAll('.BibleWindow .verse, .BibleWindow .v').forEach((verse) => {
      const verseid = verse.getAttribute('data-id');
      const verseLocations = this.locationDataByVerse?.[verseid];

      if (verseLocations !== undefined) {
        let html = verse.innerHTML;

        for (const location of verseLocations) {
          const regexp = new RegExp(`\\b${location.name}\\b`, 'gi');
          html = html.replace(regexp, `<span class="linked-location">${location.name}</span>`);

          // Highlight corresponding map markers
          if (this.markersGroup) {
            this.markersGroup.querySelectorAll('.map-marker').forEach((marker) => {
              if (marker.locationData?.name === location.name) {
                const icon = marker.querySelector('.map-marker-icon');
                if (icon) {
                  icon.style.color = '#135C13'; // Green for highlighted locations
                  marker.classList.add('highlighted');
                  marker.classList.remove('filtered-out');
                  marker.style.display = ''; // Ensure highlighted markers are visible
                }
              }
            });
          }
        }

        verse.innerHTML = html;
      }
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

    // Reset highlighted marker colors
    if (this.markersGroup) {
      this.markersGroup.querySelectorAll('.map-marker.highlighted').forEach((marker) => {
        const icon = marker.querySelector('.map-marker-icon');
        if (icon) {
          const tier = parseInt(marker.getAttribute('data-tier') || '4', 10);
          const tierColors = { 1: '#c41e3a', 2: '#d45a5a' };
          const originalColor = tierColors[tier] || '#e08080';
          icon.style.color = originalColor;
          marker.classList.remove('highlighted');
        }
      });
    }
  }

  handleMessage(e) {
    if (e.data.messagetype === 'textload') {
      // Clear old highlights when new content loads
      this.removeHighlights();

      // Extract sectionid for filtering markers
      if (e.data.sectionid) {
        this.state.currentReference = e.data.sectionid;
        this.filterMarkers();
      }

      if (this.locationDataByVerse === null) {
        this.contentToHighlight.push(e.data.content);
      } else {
        this.highlightStoredLocations();
        this.highlightLocations(e.data.content);
      }
    }
  }

  handleGlobalMessage(e) {
    if (e.data?.messagetype === 'nav' && e.data?.locationInfo?.sectionid) {
      const sectionid = e.data.locationInfo.sectionid;
      this.state.currentReference = sectionid;
      this.filterMarkers();
    }
  }

  updateTierAllCheckbox() {
    const allChecked = Array.from(this.refs.tierCheckboxes).every(cb => cb.checked);
    if (this.refs.tierAllCheckbox) {
      this.refs.tierAllCheckbox.checked = allChecked;
    }
  }

  updateTypeAllCheckbox() {
    const allChecked = Array.from(this.refs.typeCheckboxes).every(cb => cb.checked);
    if (this.refs.typeAllCheckbox) {
      this.refs.typeAllCheckbox.checked = allChecked;
    }
  }

  filterMarkers() {
    if (!this.markersGroup || !this.locationDataByVerse) return;

    const showAll = this.state.showAllLocations;
    const currentRef = this.state.currentReference;
    const enabledTiers = this.state.enabledTiers;
    const enabledTypes = this.state.enabledTypes;

    this.markersGroup.querySelectorAll('.map-marker').forEach((marker) => {
      // Highlighted markers are always visible, skip filtering
      if (marker.classList.contains('highlighted')) {
        marker.classList.remove('filtered-out');
        return;
      }

      let isRelevant = false;

      // Check relevance (show all or matches current reference)
      if (showAll) {
        isRelevant = true;
      } else if (currentRef && marker.locationData) {
        const relevantVerses = marker.locationData.verses.filter(verseid =>
          verseid.startsWith(currentRef)
        );
        isRelevant = relevantVerses.length > 0;
      }

      // Check tier filter
      const tier = parseInt(marker.getAttribute('data-tier') || '4', 10);
      const tierEnabled = enabledTiers.has(tier);

      // Check type filter
      const locationType = marker.locationData?.type || 'other';
      const typeEnabled = enabledTypes.has(locationType);

      // Use class to mark filtered-out markers (skipped by zoom filtering)
      if (isRelevant && tierEnabled && typeEnabled) {
        marker.classList.remove('filtered-out');
      } else {
        marker.classList.add('filtered-out');
      }
    });

    // Re-apply zoom filtering for visible (not filtered-out) markers
    this.updateMarkerScales();
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
