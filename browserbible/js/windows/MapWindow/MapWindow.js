/**
 * MapWindow - standalone Bible map window.
 * Thin shell around MapPanel that adds the window chrome:
 * search input, passage/explore mode toggle, and message handling.
 */

import { BaseWindow, registerWindowComponent } from '../BaseWindow.js';
import { fuzzySearchLocations } from './fuzzy-search.js';
import { buildDetailHTML } from './detail-panel.js';
import { MapPanel } from './map-panel.js';

export class MapWindowComponent extends BaseWindow {
  constructor() {
    super();

    this.state = {
      ...this.state,
      selectedSuggestionIndex: -1,
      currentSuggestions: []
    };

    this.mapPanel = null;
  }

  async render() {
    this.innerHTML = `
      <div class="window-header map-header">
        <div class="map-header-inner">
          <input type="text" placeholder="Search locations…" class="app-input map-nav" />
          <div class="map-search-suggestions"></div>
        </div>
        <div class="map-mode-toggle">
          <button class="map-mode-btn active" data-mode="passage">Passage</button>
          <button class="map-mode-btn" data-mode="explore">Explore</button>
        </div>
        <div class="map-era-filter hidden">
          <button class="map-era-btn active" data-era="all">All</button>
          <button class="map-era-btn" data-era="ot">OT</button>
          <button class="map-era-btn" data-era="nt">NT</button>
        </div>
        <span class="map-location-count"></span>
      </div>
      <div class="window-main map-main">
        <div class="svg-map-container">
          <div class="map-empty-state">
            <p class="map-empty-message"></p>
            <button class="map-empty-explore-btn">Explore all locations</button>
          </div>
        </div>
        <div class="map-detail hidden">
          <div class="map-detail-toolbar">
            <button class="map-detail-back">&#8592; Back</button>
          </div>
          <div class="map-detail-content"></div>
        </div>
      </div>
    `;
  }

  cacheRefs() {
    super.cacheRefs();

    this.refs.header = this.$('.map-header');
    this.refs.main = this.$('.map-main');
    this.refs.mapSearchInput = this.$('.map-nav');
    this.refs.searchSuggestions = this.$('.map-search-suggestions');
    this.refs.mapContainer = this.$('.svg-map-container');
    this.refs.modeToggle = this.$('.map-mode-toggle');
    this.refs.eraFilter = this.$('.map-era-filter');
    this.refs.locationCount = this.$('.map-location-count');
    this.refs.emptyState = this.$('.map-empty-state');
    this.refs.emptyMessage = this.$('.map-empty-message');
    this.refs.emptyExploreBtn = this.$('.map-empty-explore-btn');
    this.refs.detail = this.$('.map-detail');
    this.refs.detailContent = this.$('.map-detail-content');
    this.refs.detailBack = this.$('.map-detail-back');
  }

  attachEventListeners() {
    // Search
    this.addListener(this.refs.mapSearchInput, 'input', () => this.handleSearchInput());
    this.addListener(this.refs.mapSearchInput, 'keydown', (e) => this.handleSearchKeydown(e));
    this.addListener(this.refs.mapSearchInput, 'blur', () => {
      setTimeout(() => this.hideSuggestions(), 150);
    });

    // Mode toggle
    this.addListener(this.refs.modeToggle, 'click', (e) => {
      const btn = e.target.closest('.map-mode-btn');
      if (btn) this.setMode(btn.dataset.mode);
    });

    // Era filter
    this.addListener(this.refs.eraFilter, 'click', (e) => {
      const btn = e.target.closest('.map-era-btn');
      if (!btn) return;
      this.refs.eraFilter.querySelectorAll('.map-era-btn').forEach(b =>
        b.classList.toggle('active', b === btn)
      );
      this.mapPanel?.setExploreEra(btn.dataset.era);
    });

    // Empty state explore button
    this.addListener(this.refs.emptyExploreBtn, 'click', () => this.setMode('explore'));

    // Detail panel
    this.addListener(this.refs.detailBack, 'click', () => this.hideDetail());
    this.addListener(this.refs.detailContent, 'click', (e) => {
      const coloc = e.target.closest('.map-detail-colocated-item');
      if (coloc) {
        const idx = parseInt(coloc.getAttribute('data-index'), 10);
        const loc = this.refs.detail._colocatedLocations?.[idx];
        if (loc) this.mapPanel?.openLocation(loc);
        return;
      }
      const link = e.target.closest('.verse');
      if (link) {
        this.trigger('globalmessage', {
          type: 'globalmessage',
          target: this,
          data: { messagetype: 'nav', type: 'bible', locationInfo: {
            sectionid: link.getAttribute('data-sectionid'),
            fragmentid: link.getAttribute('data-fragmentid')
          }}
        });
      }
    });

    // Search suggestion clicks
    this.addListener(this.refs.searchSuggestions, 'click', (e) => {
      const item = e.target.closest('.map-suggestion-item');
      if (!item) return;
      const index = parseInt(item.getAttribute('data-index'), 10);
      if (this.state.currentSuggestions[index]) {
        this.mapPanel?.openLocation(this.state.currentSuggestions[index]);
        this.refs.mapSearchInput.value = this.state.currentSuggestions[index].name;
        this.hideSuggestions();
      }
    });

    this.addListener(this.refs.searchSuggestions, 'mouseenter', (e) => {
      const item = e.target.closest('.map-suggestion-item');
      if (!item) return;
      this.selectSuggestion(parseInt(item.getAttribute('data-index'), 10));
    }, true);

    this.on('message', (e) => this.handleMessage(e));
    this.on('globalmessage', (e) => this.handleGlobalMessage(e));
  }

  async init() {
    const initData = this.initData || {};

    this.mapPanel = new MapPanel(this.refs.mapContainer, {
      emptyState: this.refs.emptyState,
      emptyMessage: this.refs.emptyMessage,
      locationCount: this.refs.locationCount
    });

    // Show location detail inline instead of popover
    this.mapPanel._onLocationOpen = (location, colocated, verseTextLookup) => {
      this.showDetail(location, colocated, verseTextLookup);
    };

    // Wire verse-click callback → broadcast navigation
    this.mapPanel._onVerseClick = (sectionid, fragmentid) => {
      this.trigger('globalmessage', {
        type: 'globalmessage',
        target: this,
        data: { messagetype: 'nav', type: 'bible', locationInfo: { sectionid, fragmentid } }
      });
    };

    // Wire settings-change callback → persist map position
    this.mapPanel._onSettingsChange = (lat, lon) => {
      this.trigger('settingschange', {
        type: 'settingschange',
        target: this,
        data: { latitude: lat, longitude: lon, label: `Map: ${lat.toFixed(3)}, ${lon.toFixed(3)}` }
      });
    };

    await this.mapPanel.init(initData.latitude, initData.longitude);
    this.requestCurrentBibleContent();
  }

  cleanup() {
    this.mapPanel?.destroy();
    super.cleanup();
  }

  setMode(mode) {
    this.refs.modeToggle.querySelectorAll('.map-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    this.refs.eraFilter.classList.toggle('hidden', mode !== 'explore');
    this.mapPanel?.setMode(mode);
    this.updateEmptyState();
  }

  updateEmptyState() {
    if (!this.mapPanel?.locationData) return;
    const isPassage = this.mapPanel.state.mode === 'passage';
    const visibleCount = this.refs.mapContainer
      .querySelectorAll('.map-marker:not(.filtered-out):not(.clustered)').length;

    this.refs.locationCount.textContent = visibleCount > 0 ? `${visibleCount} locations` : '';

    const showEmpty = isPassage && visibleCount === 0;
    this.refs.emptyState.classList.toggle('visible', showEmpty);
    if (showEmpty && this.mapPanel.state.currentReference) {
      this.refs.emptyMessage.textContent =
        `No locations found in ${this.mapPanel.state.currentReference}`;
    }
  }

  // --- Detail panel ---

  showDetail(location, colocated, verseTextLookup) {
    this.refs.detail._colocatedLocations = colocated;
    this.refs.detailContent.innerHTML = buildDetailHTML(location, verseTextLookup, colocated);
    this.refs.detail.classList.remove('hidden');
  }

  hideDetail() {
    this.refs.detail.classList.add('hidden');
    this.mapPanel?.resetMarkerOpacity();
  }

  // --- Search ---

  handleSearchInput() {
    const value = this.refs.mapSearchInput.value.trim();
    if (value.length < 2 || !this.mapPanel?.locationData) {
      this.hideSuggestions();
      return;
    }
    this.showSuggestions(fuzzySearchLocations(value, this.mapPanel.locationData));
  }

  handleSearchKeydown(e) {
    if (!this.state.currentSuggestions.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectSuggestion(Math.min(this.state.selectedSuggestionIndex + 1, this.state.currentSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectSuggestion(Math.max(this.state.selectedSuggestionIndex - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const loc = this.state.currentSuggestions[this.state.selectedSuggestionIndex] ||
                  this.state.currentSuggestions[0];
      if (loc) {
        this.mapPanel?.openLocation(loc);
        this.refs.mapSearchInput.value = loc.name;
      }
      this.hideSuggestions();
    } else if (e.key === 'Escape') {
      this.hideSuggestions();
    }
  }

  showSuggestions(suggestions) {
    this.state.currentSuggestions = suggestions;
    this.state.selectedSuggestionIndex = -1;

    if (!suggestions.length) {
      this.refs.searchSuggestions.style.display = 'none';
      return;
    }

    this.refs.searchSuggestions.innerHTML = suggestions.map((loc, i) =>
      `<div class="map-suggestion-item" data-index="${i}">
        <span>${this.escapeHtml(loc.name)}</span>
        <span class="verse-count">${loc.verses?.length || 0} verses</span>
      </div>`
    ).join('');

    this.refs.searchSuggestions.style.display = 'block';
  }

  hideSuggestions() {
    this.refs.searchSuggestions.style.display = 'none';
    this.state.currentSuggestions = [];
    this.state.selectedSuggestionIndex = -1;
  }

  selectSuggestion(index) {
    this.refs.searchSuggestions.querySelectorAll('.map-suggestion-item').forEach((item, i) => {
      item.classList.toggle('selected', i === index);
    });
    this.state.selectedSuggestionIndex = index;
  }

  // --- Messages ---

  requestCurrentBibleContent() {
    this.trigger('globalmessage', {
      type: 'globalmessage',
      target: this,
      data: { messagetype: 'maprequest', requesttype: 'currentcontent' }
    });
  }

  handleMessage(e) {
    if (e.data.messagetype !== 'textload') return;

    this.mapPanel?.removeHighlights();

    if (e.data.sectionid) {
      this.mapPanel?.filterBySection(e.data.sectionid);
      this.updateEmptyState();
    }

    this.mapPanel?.highlight();
  }

  handleGlobalMessage(e) {
    if (e.data?.messagetype === 'nav' && e.data?.locationInfo?.sectionid) {
      this.mapPanel?.filterBySection(e.data.locationInfo.sectionid);
      this.updateEmptyState();
    }
  }

  // --- Sizing ---

  size(width, height) {
    const headerHeight = this.refs.header?.offsetHeight || 50;
    this.refs.main.style.width = `${width}px`;
    this.refs.main.style.height = `${height - headerHeight}px`;
    if (this.mapPanel) this.mapPanel.updateMarkerScales();
  }

  getData() {
    const lat = this.mapPanel?.state.currentCenter?.lat ?? 31.78;
    const lon = this.mapPanel?.state.currentCenter?.lon ?? 35.23;
    return {
      latitude: lat,
      longitude: lon,
      params: { win: 'map', latitude: lat, longitude: lon }
    };
  }
}

registerWindowComponent('map-window', MapWindowComponent, {
  windowType: 'map',
  displayName: 'Map',
  paramKeys: {}
});

export { MapWindowComponent as MapWindow };

export default MapWindowComponent;
