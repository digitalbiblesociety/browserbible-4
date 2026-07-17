/**
 * MapWindow - standalone Bible map window.
 * Thin shell around MapPanel that adds the window chrome:
 * search input, passage/explore mode toggle, and message handling.
 */

import { BaseWindow, registerWindowComponent } from '../BaseWindow.js';
import { i18n } from '../../lib/i18n.js';
import { Reference } from '../../bible/BibleReference.js';
import { BOOK_DATA } from '../../bible/BibleData.js';
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
          <button type="button" class="app-list map-journey-list hidden" aria-haspopup="listbox" aria-expanded="false" aria-label="Journey"></button>
          <div class="map-journey-menu" role="listbox" aria-label="Journeys"></div>
        </div>
      </div>
      <div class="window-main map-main">
        <div class="svg-map-container">
          <div class="map-empty-state">
            <p class="map-empty-message"></p>
            <button class="map-empty-explore-btn">Explore all locations</button>
          </div>
        </div>
        <div class="map-controls-bar">
          <button class="map-detail-back hidden" aria-label="Back to map">&#8592; Back</button>
          <div class="map-mode-toggle" role="group" aria-label="Map mode">
            <button class="map-mode-btn active" data-mode="passage" aria-pressed="true">Passage</button>
            <button class="map-mode-btn" data-mode="explore" aria-pressed="false">Explore</button>
            <button class="map-mode-btn hidden" data-mode="journeys" aria-pressed="false">Journeys</button>
          </div>
          <div class="map-era-filter hidden" role="group" aria-label="Era filter">
            <button class="map-era-btn active" data-era="all" aria-pressed="true">All</button>
            <button class="map-era-btn" data-era="ot" aria-pressed="false">OT</button>
            <button class="map-era-btn" data-era="nt" aria-pressed="false">NT</button>
          </div>
          <span class="map-location-count" aria-live="polite"></span>
        </div>
        <div class="map-detail hidden">
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
    this.refs.journeysModeBtn = this.$('.map-mode-btn[data-mode="journeys"]');
    this.refs.eraFilter = this.$('.map-era-filter');
    this.refs.journeyList = this.$('.map-journey-list');
    this.refs.journeyMenu = this.$('.map-journey-menu');
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
      if (!btn) return;
      this.setMode(btn.dataset.mode);
      if (btn.dataset.mode === 'journeys' && this.mapPanel) {
        // First entry shows the first journey immediately; re-entry restores
        // the stop list of the journey already selected in the dropdown
        const activeIds = this.mapPanel.getActiveJourneyIds();
        if (activeIds.length === 0) {
          const first = this.refs.journeyMenu.querySelector('.map-journey-menu-item');
          if (first) this.selectJourney(first.dataset.journeyId);
        } else {
          this.showJourneyStops(this.mapPanel.getJourney(activeIds[0]));
        }
      }
    });

    // Journey dropdown (replaces the search box while in journeys mode)
    this.addListener(this.refs.journeyList, 'click', () => this.toggleJourneyMenu());
    this.addListener(this.refs.journeyMenu, 'click', (e) => {
      const item = e.target.closest('.map-journey-menu-item');
      if (item) this.selectJourney(item.dataset.journeyId);
    });
    this.addListener(document, 'click', (e) => {
      if (this.refs.journeyMenu.style.display !== 'block') return;
      if (e.target.closest('.map-journey-list, .map-journey-menu')) return;
      this.toggleJourneyMenu(false);
    });
    this.addListener(this.refs.header, 'keydown', (e) => {
      if (e.key === 'Escape' && this.refs.journeyMenu.style.display === 'block') {
        e.preventDefault();
        this.toggleJourneyMenu(false);
        this.refs.journeyList.focus();
      }
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
    this.addListener(this.refs.detailBack, 'click', () => {
      // From a stop's location detail, back returns to the journey stop list
      if (this._detailFromJourney && this._journeyListJourney) {
        this.showJourneyStops(this._journeyListJourney);
        this.mapPanel?.resetMarkerOpacity();
        return;
      }
      this.hideDetail();
    });

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
      if (e.target.closest('.map-marker, .map-cluster, .map-zoom-controls, .map-empty-state, .journey-stop')) return;
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
        return;
      }
      // Journey stop rows (outside the verse links) open the stop's location
      const stopRow = e.target.closest('.map-journey-stop-row');
      if (stopRow && this._journeyListJourney) {
        const stop = this._journeyListJourney.stops[
          parseInt(stopRow.getAttribute('data-stop-index'), 10)];
        if (stop) this.mapPanel?.openStop(stop);
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
    }, { capture: true });

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

    // Journeys are additive: the mode button stays hidden unless journeys.json
    // loads (the file is absent on content servers that predate the feature)
    this.mapPanel.loadJourneys().then((journeys) => {
      if (!journeys?.length || !this.refs.journeysModeBtn) return;
      this.refs.journeysModeBtn.classList.remove('hidden');
      this.renderJourneyMenu(journeys);
      if (initData.journey) this.restoreJourneys(String(initData.journey));
    }).catch(() => { /* stays hidden */ });

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

    // Journeys mode swaps the location search box for the journey dropdown
    const journeysMode = mode === 'journeys';
    this.refs.mapSearchInput.classList.toggle('hidden', journeysMode);
    this.refs.journeyList.classList.toggle('hidden', !journeysMode);
    if (journeysMode) {
      this.hideSuggestions();
    } else {
      this.toggleJourneyMenu(false);
      if (this._journeyListShowing) this.hideDetail();
    }

    this.mapPanel?.setMode(mode);
    this.updateEmptyState();
  }

  // --- Journeys ---

  /** Localized journey display name, falling back to the data file's name. */
  journeyName(journey) {
    const key = `windows.map.journeynames.${journey.id}`;
    const name = i18n.t(key);
    return name === key ? journey.name : name;
  }

  renderJourneyMenu(journeys) {
    this.refs.journeyMenu.innerHTML = journeys.map(j =>
      `<button type="button" class="map-journey-menu-item" role="option" aria-selected="false"
        data-journey-id="${this.escapeHtml(j.id)}" style="--journey-color:${this.escapeHtml(j.color)}">
        <span class="map-journey-dot"></span>${this.escapeHtml(this.journeyName(j))}
      </button>`
    ).join('');
  }

  toggleJourneyMenu(open) {
    const show = open ?? this.refs.journeyMenu.style.display !== 'block';
    this.refs.journeyMenu.style.display = show ? 'block' : 'none';
    this.refs.journeyList.setAttribute('aria-expanded', String(show));
  }

  selectJourney(journeyId) {
    if (!this.mapPanel?.selectJourney(journeyId)) return;
    const journey = this.mapPanel.getJourney(journeyId);

    // The dropdown trigger shows the current journey; the menu marks it selected
    this.refs.journeyList.innerHTML =
      `<span class="map-journey-dot" style="--journey-color:${this.escapeHtml(journey.color)}"></span>
       <span class="map-journey-list-label">${this.escapeHtml(this.journeyName(journey))}</span>`;
    this.refs.journeyMenu.querySelectorAll('.map-journey-menu-item').forEach(item => {
      item.setAttribute('aria-selected', String(item.dataset.journeyId === journeyId));
    });

    this.toggleJourneyMenu(false);
    this.showJourneyStops(journey);
    this.updateEmptyState();
    this.mapPanel.triggerSettingsChange(); // persist journey selection via getData()
  }

  /** Ordered stop list for a journey, rendered into the inline detail area. */
  showJourneyStops(journey) {
    if (!journey) return;

    const rows = journey.stops.map((stop, i) => {
      const verses = (stop.verses || []).map(verseId => {
        const ref = new Reference(verseId);
        const bookName = BOOK_DATA[ref.bookid]?.names?.eng?.[0] ?? ref.bookid;
        const sectionid = ref.bookid + ref.chapter1;
        return `<span class="verse map-journey-stop-verse" data-sectionid="${sectionid}"
          data-fragmentid="${sectionid}_${ref.verse1}">${this.escapeHtml(`${bookName} ${ref.chapter1}:${ref.verse1}`)}</span>`;
      }).join('');
      return `<div class="map-journey-stop-row" data-stop-index="${i}">
        <span class="map-journey-stop-num" style="--journey-color:${this.escapeHtml(journey.color)}">${i + 1}</span>
        <span class="map-journey-stop-name">${this.escapeHtml(stop.label || stop.name)}</span>
        <span class="map-journey-stop-verses">${verses}</span>
      </div>`;
    }).join('');

    // The list replaces any hydrating location detail
    this.refs.detailContent._hydrateObserver?.disconnect();
    this.refs.detailContent._hydrateObserver = null;

    this.refs.detailContent.innerHTML = `
      <div class="map-detail-header map-journey-list-header">
        <h2><span class="map-journey-swatch" style="--journey-color:${this.escapeHtml(journey.color)}"></span>${this.escapeHtml(this.journeyName(journey))}</h2>
        <span class="map-detail-count">${this.escapeHtml(i18n.t('windows.map.journeystops', { count: journey.stops.length }))}</span>
      </div>
      <div class="map-journey-stops">${rows}</div>
    `;
    this.refs.detail.classList.remove('hidden');
    this.refs.detailBack.classList.remove('hidden');
    this._journeyListShowing = true;
    this._detailFromJourney = false;
    this._journeyListJourney = journey;
  }

  /** Restore journeys mode from a persisted/shared journey id. */
  restoreJourneys(param) {
    const ids = String(param).split(',').filter(id => this.mapPanel?.getJourney(id));
    if (!ids.length) return;
    this.setMode('journeys');
    this.selectJourney(ids[0]);
  }

  updateEmptyState() {
    if (!this.mapPanel?.locationData) return;

    if (this.mapPanel.state.mode === 'journeys') {
      // The journey dropdown provides the context; no count in the header
      this.refs.locationCount.textContent = '';
      this.refs.emptyState.classList.remove('visible');
      return;
    }

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

    // A location opened while the journey stop list is up (stop badge or row
    // click) gets a Back that returns to the list rather than closing
    this._detailFromJourney = this._journeyListShowing || this._detailFromJourney;
    this._journeyListShowing = false;

    this.refs.detail._colocatedLocations = colocated;
    this.refs.detailContent.innerHTML = buildDetailHTML(location, verseTextLookup, colocated);
    hydrateVerseTexts(this.refs.detailContent, this.state.currentTextid);
    this.refs.detail.classList.remove('hidden');
    this.refs.detailBack.classList.remove('hidden');

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
    this._journeyListShowing = false;
    this._detailFromJourney = false;
    this._journeyListJourney = null;
    this.refs.detail.classList.add('hidden');
    this.refs.detailBack.classList.add('hidden');
    // stop lazy verse hydration while hidden
    this.refs.detailContent._hydrateObserver?.disconnect();
    this.refs.detailContent._hydrateObserver = null;
    this.mapPanel?.resetMarkerOpacity();
    if (hadFocusInside) this.refs.mapContainer.focus();
  }

  /**
   * Retry verse snippets in an open location detail. Rows that previously failed
   * (marked "not available") are reset to pending so hydrateVerseTexts fetches
   * them again against the now-known Bible text. No-op for the journey stop list
   * (it has no snippet rows) or a closed detail (reopening rebuilds it fresh).
   */
  rehydrateOpenDetail() {
    if (this.refs.detail.classList.contains('hidden')) return;

    const content = this.refs.detailContent;
    content.querySelectorAll('.verse-text-missing').forEach(el => {
      el.classList.remove('verse-text-missing');
      el.classList.add('verse-text-pending');
      el.textContent = '…';
    });

    if (content.querySelector('.verse-text-pending')) {
      hydrateVerseTexts(content, this.state.currentTextid);
    }
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

    const prevTextid = this.state.currentTextid;
    if (e.data.textid) {
      this.state.currentTextid = e.data.textid;
      if (this.mapPanel) this.mapPanel._detailTextid = e.data.textid;
    }

    // The Bible text a detail hydrates from can arrive AFTER a detail is already
    // open — most often when this map is the leftmost window, created before the
    // Bible window replies to its content request. A detail opened in that gap
    // hydrates against a fallback (or absent) text and its verse rows can end up
    // stuck on "not available". When the real text id first becomes known, or it
    // later changes, retry those rows so they resolve against the right text.
    if (e.data.textid && e.data.textid !== prevTextid) {
      this.rehydrateOpenDetail();
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
    const data = {
      latitude: lat,
      longitude: lon,
      params: { win: 'map', latitude: lat, longitude: lon }
    };

    // Persist/share the journey selection only while journeys mode is on
    if (this.mapPanel?.state.mode === 'journeys') {
      const ids = this.mapPanel.getActiveJourneyIds();
      if (ids.length) {
        data.journey = ids.join(',');
        data.params.journey = data.journey;
      }
    }
    return data;
  }
}

registerWindowComponent('map-window', MapWindowComponent, {
  windowType: 'map',
  displayName: 'Map',
  paramKeys: {}
});

export { MapWindowComponent as MapWindow };
