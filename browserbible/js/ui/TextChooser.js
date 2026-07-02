/**
 * TextChooser
 * A high-performance dropdown for selecting Bible versions
 * Uses virtual scrolling for 60fps smooth rendering
 */

import { elem, offset } from '../lib/helpers.esm.js';
import { fuzzyIncludes, matchRanges } from '../lib/fuzzy.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import AppSettings from '../common/AppSettings.js';
import { loadTexts, getText, displayAbbr } from '../texts/TextLoader.js';
import { t as i18nT } from '../lib/i18n.js';
import { getConfig } from '../core/config.js';
import audioEarSvg from '../../css/images/audio-ear.svg?raw';
import morphSvg from '../../css/images/morphology-gray-dark.svg?raw';
import bibleApiLogoSvg from '../../public/img/bible-api_logo.svg?raw';
import bibleBrainLogoSvg from '../../public/img/bible-brain_logo.svg?raw';

const hasTouch = 'ontouchend' in document;
const ROW_HEIGHT = 32; // Fixed row height for virtual scrolling
const BUFFER_ROWS = 5; // Extra rows to render above/below viewport

// Pre-parse SVG icons once; cloneNode per row instead of innerHTML parsing.
const lemmaTemplate = (() => {
  const span = document.createElement('span');
  span.className = 'text-chooser-lemma';
  span.innerHTML = morphSvg;
  return span;
})();
const audioTemplate = (() => {
  const span = document.createElement('span');
  span.className = 'text-chooser-audio';
  span.innerHTML = audioEarSvg;
  return span;
})();
// API.Bible attribution badge, shown at the right of each API.Bible row.
const apiBibleTemplate = (() => {
  const span = document.createElement('span');
  span.className = 'text-chooser-provider-apibible';
  span.title = 'Powered by API.Bible';
  span.innerHTML = bibleApiLogoSvg;
  return span;
})();
const bibleBrainTemplate = (() => {
  const span = document.createElement('span');
  span.className = 'text-chooser-provider-biblebrain';
  span.title = 'Powered by Bible Brain';
  span.innerHTML = bibleBrainLogoSvg;
  return span;
})();

/**
 * Create a text chooser with virtual scrolling
 * @returns {Object} TextChooser API object
 */
export function TextChooser() {
  let textType = null;
  let target = null;
  let selectedTextInfo = null;
  let listData = null;
  // When set (a lang/lang3 code), only texts in that language are listed —
  // e.g. the comparison window's second version, which must match the first.
  let langFilter = null;

  // Virtual scrolling state
  let processedData = []; // Flat array of {type: 'header'|'text', data, searchText, langHeader}
  let filteredIndices = []; // Indices into processedData that match filter
  let scrollTop = 0;
  let viewportHeight = 0;
  let filterText = '';
  let filterTokens = []; // filterText split into words; each must match (substring or fuzzy)
  let rafId = null;

  const recentlyUsedKey = 'texts-recently-used';
  let recentlyUsed = AppSettings.getValue(recentlyUsedKey, { recent: [] });

  const filter = elem('input', {
    type: 'text',
    className: 'text-chooser-filter-text i18n',
    dataset: { i18n: '[placeholder]windows.bible.filter' }
  });
  const header = elem('div', { className: 'text-chooser-header' }, filter);
  const scrollContent = elem('div', { className: 'text-chooser-scroll-content' });
  const main = elem('div', { className: 'text-chooser-main' }, scrollContent);
  const textChooser = elem('div', { className: 'text-chooser nav-drop-list', popover: 'auto' }, header, main);

  document.body.appendChild(textChooser);

  filter.addEventListener('input', handleFilterInput);
  filter.addEventListener('keydown', handleFilterKeydown);
  main.addEventListener('scroll', handleScroll, { passive: true });

  // When a provider is disabled at runtime (e.g. API.Bible hits its monthly
  // limit) it removes its texts and fires this event so an open chooser drops them.
  document.addEventListener('texts:provider-disabled', () => refresh());

  function handleFilterKeydown(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
      const visibleTextRows = filteredIndices.filter(i => processedData[i].type === 'text');
      if (visibleTextRows.length === 1) {
        const item = processedData[visibleTextRows[0]];
        selectText(item.data.id);
        filter.value = '';
        filterText = '';
        filterTokens = [];
        applyFilter();
      }
    }
  }

  function handleFilterInput() {
    const newFilter = filter.value.toLowerCase().trim();
    if (newFilter === filterText) return;

    filterText = newFilter;
    filterTokens = filterText.split(/\s+/).filter(Boolean);
    applyFilter();
  }

  function applyFilter() {
    if (filterText === '') {
      filteredIndices = processedData.map((_, i) => i);
    } else {
      filteredIndices = buildFilteredIndices();
    }

    updateScrollHeight();
    scheduleRender();
  }

  function buildFilteredIndices() {
    const matchingHeaders = new Set();
    const matchingTextIndices = new Set();

    // First pass: find matching texts and their headers. Every filter word
    // must match somewhere, as a substring or fuzzily (typo-tolerant).
    for (let i = 0; i < processedData.length; i++) {
      const item = processedData[i];
      if (item.type !== 'text') continue;
      if (filterTokens.every(token => fuzzyIncludes(item.searchText, item.searchWords, token))) {
        matchingTextIndices.add(i);
        matchingHeaders.add(item.langHeader);
      }
    }

    // Second pass: collect headers and texts in order
    const result = [];
    for (let i = 0; i < processedData.length; i++) {
      const item = processedData[i];
      const isMatchingHeader = (item.type === 'header' || item.type === 'section-header') && matchingHeaders.has(item.data);
      const isMatchingText = item.type === 'text' && matchingTextIndices.has(i);

      if (isMatchingHeader || isMatchingText) {
        result.push(i);
      }
    }

    return result;
  }

  function handleScroll() {
    scrollTop = main.scrollTop;
    scheduleRender();
  }

  function scheduleRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = null;
      renderVisible();
    });
  }

  function renderNow() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    renderVisible();
  }

  function updateScrollHeight() {
    const totalHeight = filteredIndices.length * ROW_HEIGHT;
    scrollContent.style.height = `${totalHeight}px`;
  }

  function renderVisible() {
    if (!processedData.length) return;

    viewportHeight = main.clientHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
    const endIndex = Math.min(
      filteredIndices.length,
      Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + BUFFER_ROWS
    );

    const fragment = document.createDocumentFragment();

    for (let i = startIndex; i < endIndex; i++) {
      const dataIndex = filteredIndices[i];
      const item = processedData[dataIndex];
      const top = i * ROW_HEIGHT;

      fragment.appendChild(createRowElement(item, top));
    }

    // Clear and append in one operation
    scrollContent.replaceChildren(fragment);
  }

  // Wrap the parts of `str` the current filter matched in <mark> elements.
  // Returns the plain string when there is no filter or no match.
  function highlighted(str) {
    if (!filterTokens.length || !str) return str;
    const ranges = matchRanges(str, filterTokens);
    if (!ranges.length) return str;

    const parts = [];
    let pos = 0;
    for (const [start, end] of ranges) {
      if (start > pos) parts.push(str.slice(pos, start));
      parts.push(elem('mark', { className: 'text-chooser-match' }, str.slice(start, end)));
      pos = end;
    }
    if (pos < str.length) parts.push(str.slice(pos));
    return parts;
  }

  function createRowElement(item, top) {
    const row = elem('div', {
      style: { position: 'absolute', top: `${top}px`, left: '0', right: '0', height: `${ROW_HEIGHT}px` }
    });

    if (item.type === 'section-header') {
      row.className = 'text-chooser-row-header text-chooser-section-header';
      row.appendChild(elem('span', { className: 'name' }, item.data));
      if (item.langCode) {
        row.appendChild(elem('span', { className: 'text-chooser-lang-code' }, item.langCode));
      }
    } else if (item.type === 'header') {
      row.className = 'text-chooser-row-header';
      row.dataset.langName = item.data;
      row.appendChild(elem('span', { className: 'name' }, highlighted(item.data)));
      if (item.langCode) {
        row.appendChild(elem('span', { className: 'text-chooser-lang-code' }, item.langCode));
      }
    } else {
      const text = item.data;
      const isSelected = selectedTextInfo && selectedTextInfo.id === text.id;

      row.className = 'text-chooser-row' + (isSelected ? ' selected' : '');
      row.dataset.id = text.id;

      row.appendChild(elem('span', { className: 'text-chooser-abbr' }, highlighted(displayAbbr(text))));
      row.appendChild(elem('span', { className: 'text-chooser-name' }, highlighted(text.name)));

      if (text.hasLemma) {
        row.appendChild(lemmaTemplate.cloneNode(true));
      }
      if (text.hasAudio || text.audioDirectory || text.fcbh_audio_ot || text.fcbh_audio_nt) {
        row.appendChild(audioTemplate.cloneNode(true));
      }
      if (text.providerName === 'apibible') {
        row.appendChild(apiBibleTemplate.cloneNode(true));
      }
      if (text.providerName === 'biblebrain') {
        row.appendChild(bibleBrainTemplate.cloneNode(true));
      }
    }

    return row;
  }

  // Event delegation for row clicks
  scrollContent.addEventListener('click', (e) => {
    const target = e.target.closest('.text-chooser-row');
    if (target) {
      const textid = target.getAttribute('data-id');
      if (textid) {
        selectText(textid);
      }
    }
  });

  function selectText(textid) {
    storeRecentlyUsed(textid);
    textChooser.hidePopover();

    // `target` is shared chooser state and may point at a different window
    // by the time getText resolves — capture it now.
    const clickTarget = target;
    getText(textid, function(data) {
      selectedTextInfo = data;
      // textInfo is null when the provider fails to load the text's details;
      // textid always identifies what was clicked.
      ext.trigger('change', { type: 'change', target: this, data: { textInfo: selectedTextInfo, textid, target: clickTarget } });
    });
  }

  function storeRecentlyUsed(textInfo) {
    if (textType !== 'bible') return;

    const textid = (typeof textInfo === 'string') ? textInfo : textInfo.id;
    recentlyUsed.recent = recentlyUsed.recent.filter(t => t !== textid);
    recentlyUsed.recent.unshift(textid);
    while (recentlyUsed.recent.length > 5) {
      recentlyUsed.recent.pop();
    }

    AppSettings.setValue(recentlyUsedKey, recentlyUsed);
  }

  // Cache of the heavy language-grouped portion. Keyed on (textType, listData
  // identity). Only invalidated when those change — recentlyUsed / current-lang
  // updates only rebuild the small pinned-top sections.
  let groupedCache = null;
  let groupedCacheKey = null;
  // Cache of the full processedData. Skips even the cheap concat if nothing relevant changed.
  let processedDataKey = null;

  // searchText for substring matches; searchWords for fuzzy (per-word) matches.
  function buildSearchFields(text) {
    const searchText = [text.name, text.abbr, text.langName || '', text.langNameEnglish || '']
      .join(' ').toLowerCase();
    return { searchText, searchWords: searchText.split(/\s+/).filter(Boolean) };
  }

  function buildGroupedData() {
    const key = textType + '|' + (langFilter || '') + '|' + (listData ? listData.length : 0);
    if (groupedCacheKey === key && groupedCache) return groupedCache;

    const arrayOfTexts = listData.filter(t => {
      if (langFilter && t.lang3 !== langFilter && t.lang !== langFilter) return false;
      if (textType === 'audio') {
        return t.hasAudio || t.audioDirectory || t.fcbh_audio_ot || t.fcbh_audio_nt;
      }
      if (t.hasText === false) return false;
      const thisTextType = t.type === undefined ? 'bible' : t.type;
      return thisTextType === textType;
    });

    const langMap = new Map();
    for (const text of arrayOfTexts) {
      const langKey = text.langNameEnglish || text.langName || '';
      if (!langMap.has(langKey)) {
        langMap.set(langKey, []);
      }
      langMap.get(langKey).push(text);
    }

    const languages = Array.from(langMap.keys()).sort();
    const result = [];

    for (const langName of languages) {
      const textsInLang = langMap.get(langName);
      textsInLang.sort((a, b) => a.name.localeCompare(b.name));

      const displayName = textsInLang[0].langNameEnglish || textsInLang[0].langName;

      result.push({ type: 'header', data: displayName, langCode: textsInLang[0].lang || '' });

      for (const text of textsInLang) {
        result.push({
          type: 'text',
          data: text,
          ...buildSearchFields(text),
          langHeader: displayName
        });
      }
    }

    groupedCacheKey = key;
    groupedCache = result;
    // Side data for cheap pinned-top lookups
    groupedCache.filteredArray = arrayOfTexts;
    return result;
  }

  function buildPinnedTop() {
    if (textType !== 'bible') return [];

    const grouped = groupedCache;
    const arrayOfTexts = grouped ? grouped.filteredArray : [];
    const result = [];

    if (recentlyUsed.recent.length > 0) {
      const textMap = new Map(arrayOfTexts.map(t => [t.id, t]));
      const recentTexts = recentlyUsed.recent
        .map(id => textMap.get(id))
        .filter(Boolean);

      if (recentTexts.length > 0) {
        const recentHeader = i18nT('windows.bible.recentlyused') || 'Recently Used';
        result.push({ type: 'section-header', data: recentHeader, sectionType: 'recent' });
        for (const text of recentTexts) {
          result.push({
            type: 'text',
            data: text,
            ...buildSearchFields(text),
            langHeader: recentHeader
          });
        }
      }
    }

    // With a language filter, the whole list is one language already — a
    // pinned current-language section would just duplicate it.
    if (langFilter) return result;

    const currentLang = selectedTextInfo?.langNameEnglish
      || getConfig().pinnedLanguage
      || 'English';
    const currentLangTexts = arrayOfTexts.filter(
      t => (t.langNameEnglish || t.langName || '') === currentLang
    );
    if (currentLangTexts.length > 0) {
      result.push({
        type: 'section-header',
        data: currentLang,
        sectionType: 'current-language',
        langCode: currentLangTexts[0].lang || ''
      });
      currentLangTexts.sort((a, b) => a.name.localeCompare(b.name));
      for (const text of currentLangTexts) {
        result.push({
          type: 'text',
          data: text,
          ...buildSearchFields(text),
          langHeader: currentLang
        });
      }
    }

    return result;
  }

  function processTexts(data) {
    if (!data) return;

    const currentLang = selectedTextInfo?.langNameEnglish
      || getConfig().pinnedLanguage
      || 'English';
    const key = textType + '|' + (langFilter || '') + '|' + listData.length + '|' + recentlyUsed.recent.join(',') + '|' + currentLang;
    if (processedDataKey === key && processedData.length > 0) return;
    processedDataKey = key;

    const grouped = buildGroupedData();
    const pinned = buildPinnedTop();
    processedData = pinned.length ? pinned.concat(grouped) : grouped.slice();

    filteredIndices = processedData.map((_, i) => i);
    updateScrollHeight();
    scheduleRender();
  }

  function setTarget(_container, _target, _textType, _langFilter = null) {
    const needsRerender = _textType !== textType || _langFilter !== langFilter;
    target = _target;
    textType = _textType;
    langFilter = _langFilter;

    if (needsRerender && listData) {
      processTexts(listData);
    }
  }

  function setTextInfo(text) {
    selectedTextInfo = text;
    storeRecentlyUsed(selectedTextInfo);
    scheduleRender();
  }

  // Rebuild from the current manifest (e.g. after a provider is disabled),
  // clearing caches so removed texts don't linger.
  function refresh() {
    listData = null;
    groupedCache = null;
    groupedCacheKey = null;
    processedData = [];
    processedDataKey = null;

    if (textChooser.matches(':popover-open')) {
      loadTexts((data) => {
        listData = data;
        processTexts(listData);
        renderNow();
      });
    }
  }

  // Cached so we can position the popover *before* showPopover() runs;
  // offsetWidth is 0 while the popover is closed (display: none).
  // Default matches the width set in textchooser.css.
  let cachedChooserWidth = 320;

  function position() {
    if (target == null) return;

    if (textChooser.offsetWidth) {
      cachedChooserWidth = textChooser.offsetWidth;
    }

    const targetOffset = offset(target);
    const targetOuterHeight = target.offsetHeight;
    const winWidth = window.innerWidth;

    let top = targetOffset.top + targetOuterHeight + 10;
    let left = targetOffset.left;

    if (winWidth < left + cachedChooserWidth) {
      left = winWidth - cachedChooserWidth;
      if (left < 0) left = 0;
    }

    textChooser.style.top = top + 'px';
    textChooser.style.left = left + 'px';
  }

  // Handle popover open
  textChooser.addEventListener('toggle', (e) => {
    if (e.newState === 'open') {
      position();

      if (!listData) {
        main.classList.add('loading-indicator');
        loadTexts(function(data) {
          listData = data;
          main.classList.remove('loading-indicator');
          processTexts(listData);
        });
      }

      if (listData) {
        recentlyUsed = AppSettings.getValue(recentlyUsedKey, { recent: [] });
        processTexts(listData);
      }

      if (filter.value !== '') {
        filter.value = '';
        filterText = '';
        filterTokens = [];
        applyFilter();
      }

      // Reset scroll on reopen so the new column's content isn't shown
      // mid-scroll from the previous open.
      main.scrollTop = 0;
      scrollTop = 0;

      // Render synchronously before the browser paints the popover; otherwise
      // the popover briefly shows stale rows from the previous open.
      if (listData) renderNow();

      if (!hasTouch) {
        filter.focus();
      }
    } else {
      ext.trigger('offclick', { type: 'offclick' });
    }
  });

  let ext = {
    setTarget,
    getTarget: () => target,
    getTextInfo: () => selectedTextInfo,
    setTextInfo,
    // Position before showing so the popover paints at the right spot on the
    // first frame; otherwise the toggle event (which fires post-paint) leaves
    // a flicker at the prior open's position.
    show: () => {
      position();
      textChooser.showPopover();
    },
    hide: () => textChooser.hidePopover(),
    toggle: () => {
      if (!textChooser.matches(':popover-open')) {
        position();
      }
      textChooser.togglePopover();
    },
    isVisible: () => textChooser.matches(':popover-open'),
    node: () => textChooser,
    refresh,
    size: () => {} // No-op, CSS handles sizing
  };

  mixinEventEmitter(ext);

  return ext;
}

let globalTextChooser = null;

export function getGlobalTextChooser() {
  if (!globalTextChooser) {
    globalTextChooser = TextChooser();
  }
  return globalTextChooser;
}
