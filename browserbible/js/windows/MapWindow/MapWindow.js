/**
 * MapWindow - standalone Bible map window.
 * Thin shell around MapPanel that adds the window chrome:
 * search input, passage/explore mode toggle, and message handling.
 */

import { BaseWindow, registerWindowComponent } from '../BaseWindow.js';
import { i18n } from '../../lib/i18n.js';
import { searchLocations, parseReferenceQuery } from './fuzzy-search.js';
import { getLocationsForReference } from './map-data.js';
import { buildDetailHTML, hydrateVerseTexts } from './detail-panel.js';
import { MapPanel } from './map-panel.js';
import { DEFAULT_CENTER } from './constants.js';

class MapWindowComponent extends BaseWindow {
  constructor() {
    super();

    this.state = {
      ...this.state,
      selectedSuggestionIndex: -1,
      currentSuggestions: [], // Array<{location, altName}>
      referenceSuggestion: null // {sectionid, count, label} when the query parses as a reference
    };

    this.mapPanel = null;
  }

  async render() {
    this.innerHTML = `
      <div class="window-header map-header">
        <div class="map-header-inner">
          <input type="text" placeholder="Search locations…" class="app-input map-nav" aria-label="Search locations" />
          <div class="map-search-suggestions" role="listbox" aria-label="Location suggestions"></div>
        </div>
        <div class="map-mode-toggle" role="group" aria-label="Map mode">
          <button class="map-mode-btn active" data-mode="passage" aria-pressed="true">Passage</button>
          <button class="map-mode-btn" data-mode="explore" aria-pressed="false">Explore</button>
        </div>
        <div class="map-era-filter hidden" role="group" aria-label="Era filter">
          <button class="map-era-btn active" data-era="all" aria-pressed="true">All</button>
          <button class="map-era-btn" data-era="ot" aria-pressed="false">OT</button>
          <button class="map-era-btn" data-era="nt" aria-pressed="false">NT</button>
        </div>
        <span class="map-location-count" aria-live="polite"></span>
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
            <button class="map-detail-back" aria-label="Back to map">&#8592; Back</button>
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
      this.refs.eraFilter.querySelectorAll('.map-era-btn').forEach(b => {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      this.mapPanel?.setExploreEra(btn.dataset.era);
    });

    // Empty state explore button
    this.addListener(this.refs.emptyExploreBtn, 'click', () => this.setMode('explore'));

    // Detail panel
    this.addListener(this.refs.detailBack, 'click', () => this.hideDetail());

    // Escape anywhere in the window body closes the open detail panel
    this.addListener(this.refs.main, 'keydown', (e) => {
      if (e.key === 'Escape' && !this.refs.detail.classList.contains('hidden')) {
        e.preventDefault();
        this.hideDetail();
      }
    });

    // Click on the map background (not a drag, not a marker/cluster/control) closes it too
    this.addListener(this.refs.mapContainer, 'mousedown', (e) => {
      this._pointerDown = { x: e.clientX, y: e.clientY };
    });
    this.addListener(this.refs.mapContainer, 'click', (e) => {
      if (this.refs.detail.classList.contains('hidden')) return;
      if (e.target.closest('.map-marker, .map-cluster, .map-zoom-controls, .map-empty-state')) return;
      const moved = this._pointerDown
        ? Math.hypot(e.clientX - this._pointerDown.x, e.clientY - this._pointerDown.y)
        : 0;
      if (moved < 5) this.hideDetail();
    });
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

    // Keep focus in the input while clicking inside the dropdown (blur would close it)
    this.addListener(this.refs.searchSuggestions, 'mousedown', (e) => e.preventDefault());

    // Search suggestion clicks
    this.addListener(this.refs.searchSuggestions, 'click', (e) => {
      if (e.target.closest('.map-suggestion-reference')) {
        this.applyReferenceSuggestion();
        return;
      }
      if (e.target.closest('.map-suggestion-more')) {
        // show 50 more per click; the dropdown scrolls
        this.handleSearchInput(this.state.currentSuggestions.length + 50);
        return;
      }
      const item = e.target.closest('.map-suggestion-item');
      if (!item) return;
      const index = parseInt(item.getAttribute('data-index'), 10);
      const entry = this.state.currentSuggestions[index];
      if (entry) {
        this.mapPanel?.openLocation(entry.location);
        this.refs.mapSearchInput.value = entry.location.name;
        this.hideSuggestions();
      }
    });

    this.addListener(this.refs.searchSuggestions, 'mouseenter', (e) => {
      const item = e.target.closest('.map-suggestion-item');
      if (!item) return;
      this.selectSuggestion(parseInt(item.getAttribute('data-index'), 10));
    }, true);

    // Clicking a highlighted place name in any Bible window opens it on the map.
    // The .linked-location spans only exist while this window is alive (created
    // by MapPanel.highlight()), so this window owns the listener.
    const windowsMain = document.querySelector('.windows-main');
    if (windowsMain) {
      this.addListener(windowsMain, 'click', (e) => this.handleLinkedLocationClick(e));
    }

    this.on('message', (e) => this.handleMessage(e));
    this.on('globalmessage', (e) => this.handleGlobalMessage(e));
  }

  handleLinkedLocationClick(e) {
    const span = e.target.closest('.linked-location');
    if (!span || !this.mapPanel?.locationData) return;

    const name = span.getAttribute('data-location-name') || span.textContent;
    const verseid = span.closest('.verse, .v')?.getAttribute('data-id');

    // Resolve via the verse context first — location names are not unique (e.g. Antioch)
    const location =
      (verseid && this.mapPanel.locationDataByVerse?.[verseid]?.find(l => l.name === name)) ||
      this.mapPanel.locationData.find(l => l.name === name);

    if (location) this.mapPanel.openLocation(location);
  }

  async init() {
    const initData = this.initData || {};

    this.mapPanel = new MapPanel(this.refs.mapContainer);

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
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    this.refs.eraFilter.classList.toggle('hidden', mode !== 'explore');
    this.mapPanel?.setMode(mode);
    this.updateEmptyState();
  }

  updateEmptyState() {
    if (!this.mapPanel?.locationData) return;
    const isPassage = this.mapPanel.state.mode === 'passage';
    // Count locations in the current passage/era set. Clustered markers still count —
    // they're shown inside a cluster badge, not hidden (only `.filtered-out` is hidden).
    const visibleCount = this.refs.mapContainer
      .querySelectorAll('.map-marker:not(.filtered-out)').length;

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
    // Only move focus when the user is already working inside this window —
    // a passive textload must not steal focus from elsewhere in the app.
    const hadFocusInside = this.contains(document.activeElement);

    this.refs.detail._colocatedLocations = colocated;
    this.refs.detailContent.innerHTML = buildDetailHTML(location, verseTextLookup, colocated);
    hydrateVerseTexts(this.refs.detailContent, this.state.currentTextid);
    this.refs.detail.classList.remove('hidden');

    if (hadFocusInside) {
      const heading = this.refs.detailContent.querySelector('.map-detail-header h2');
      if (heading) {
        heading.setAttribute('tabindex', '-1');
        heading.focus();
      }
    }
  }

  hideDetail() {
    const hadFocusInside = this.contains(document.activeElement);
    this.refs.detail.classList.add('hidden');
    // stop lazy verse hydration while hidden
    this.refs.detailContent._hydrateObserver?.disconnect();
    this.refs.detailContent._hydrateObserver = null;
    this.mapPanel?.resetMarkerOpacity();
    if (hadFocusInside) this.refs.mapContainer.focus();
  }

  // --- Search ---

  handleSearchInput(limit = 8) {
    const value = this.refs.mapSearchInput.value.trim();
    if (value.length < 2 || !this.mapPanel?.locationData) {
      this.hideSuggestions();
      return;
    }

    const { results, total } = searchLocations(value, this.mapPanel.locationData, limit);

    // A query like "John 3" also offers "Places in John 3" (map-only filter)
    let reference = null;
    const sectionid = parseReferenceQuery(value);
    if (sectionid) {
      const count = getLocationsForReference(this.mapPanel.locationData, sectionid).length;
      if (count > 0) {
        reference = { sectionid, count, label: i18n.t('windows.map.placesin', { reference: value }) };
      }
    }

    this.showSuggestions({ results, total, reference });
  }

  applyReferenceSuggestion() {
    const ref = this.state.referenceSuggestion;
    if (!ref) return;
    this.setMode('passage');
    this.mapPanel?.filterBySection(ref.sectionid);
    this.updateEmptyState();
    this.hideSuggestions();
  }

  handleSearchKeydown(e) {
    if (!this.state.currentSuggestions.length && !this.state.referenceSuggestion) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.selectSuggestion(Math.min(this.state.selectedSuggestionIndex + 1, this.state.currentSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.selectSuggestion(Math.max(this.state.selectedSuggestionIndex - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // No explicit selection: a reference suggestion wins, then the top hit
      if (this.state.selectedSuggestionIndex < 0 && this.state.referenceSuggestion) {
        this.applyReferenceSuggestion();
        return;
      }
      const entry = this.state.currentSuggestions[this.state.selectedSuggestionIndex] ||
                    this.state.currentSuggestions[0];
      if (entry) {
        this.mapPanel?.openLocation(entry.location);
        this.refs.mapSearchInput.value = entry.location.name;
      }
      this.hideSuggestions();
    } else if (e.key === 'Escape') {
      this.hideSuggestions();
    }
  }

  showSuggestions({ results, total, reference }) {
    this.state.currentSuggestions = results;
    this.state.referenceSuggestion = reference || null;
    this.state.selectedSuggestionIndex = -1;

    if (!results.length && !reference) {
      this.refs.searchSuggestions.style.display = 'none';
      return;
    }

    const rows = [];

    if (reference) {
      rows.push(`<div class="map-suggestion-reference" role="option" aria-selected="false">
        <span>${this.escapeHtml(reference.label)}</span>
        <span class="verse-count">${reference.count} locations</span>
      </div>`);
    }

    rows.push(...results.map(({ location, altName }, i) => {
      const display = altName ? `${altName} → ${location.name}` : location.name;
      return `<div class="map-suggestion-item" role="option" aria-selected="false" data-index="${i}">
        <span>${this.escapeHtml(display)}</span>
        <span class="verse-count">${location.verses?.length || 0} verses</span>
      </div>`;
    }));

    const remaining = total - results.length;
    if (remaining > 0) {
      rows.push(`<div class="map-suggestion-more" role="button">
        ${this.escapeHtml(i18n.t('windows.map.moreresults', { count: remaining }))}
      </div>`);
    }

    this.refs.searchSuggestions.innerHTML = rows.join('');
    this.refs.searchSuggestions.style.display = 'block';
  }

  hideSuggestions() {
    this.refs.searchSuggestions.style.display = 'none';
    this.state.currentSuggestions = [];
    this.state.referenceSuggestion = null;
    this.state.selectedSuggestionIndex = -1;
  }

  selectSuggestion(index) {
    this.refs.searchSuggestions.querySelectorAll('.map-suggestion-item').forEach((item, i) => {
      item.classList.toggle('selected', i === index);
      item.setAttribute('aria-selected', String(i === index));
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

    if (e.data.textid) {
      this.state.currentTextid = e.data.textid;
      if (this.mapPanel) this.mapPanel._detailTextid = e.data.textid;
    }

    // Scope the text walk to the newly loaded section; wrapping is idempotent,
    // so sections walked earlier keep their spans. A text's first message
    // walks everything: content rendered before this window opened, or
    // replaced by a version change. Filtering reads marker highlight state,
    // so highlight comes first.
    if (!this._seenTextids) this._seenTextids = new Set();
    const scoped = e.data.textid && this._seenTextids.has(e.data.textid);
    if (e.data.textid) this._seenTextids.add(e.data.textid);
    this.mapPanel?.highlight(scoped ? e.data.sectionid : null);

    if (e.data.sectionid) {
      this.mapPanel?.filterBySection(e.data.sectionid);
      this.updateEmptyState();
    }
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
    if (this.mapPanel) this.mapPanel.onResize();
  }

  getData() {
    const lat = this.mapPanel?.state.currentCenter?.lat ?? DEFAULT_CENTER.lat;
    const lon = this.mapPanel?.state.currentCenter?.lon ?? DEFAULT_CENTER.lon;
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
