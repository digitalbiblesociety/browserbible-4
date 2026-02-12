/**
 * TextChooser
 * A high-performance dropdown for selecting Bible versions
 * Uses virtual scrolling for 60fps smooth rendering
 */

import { elem, offset } from '../lib/helpers.esm.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import AppSettings from '../common/AppSettings.js';
import { loadTexts, getText } from '../texts/TextLoader.js';

const hasTouch = 'ontouchend' in document;
const ROW_HEIGHT = 32; // Fixed row height for virtual scrolling
const BUFFER_ROWS = 5; // Extra rows to render above/below viewport

/**
 * Create a text chooser with virtual scrolling
 * @returns {Object} TextChooser API object
 */
export function TextChooser() {
  let textType = null;
  let target = null;
  let selectedTextInfo = null;
  let listData = null;

  // Virtual scrolling state
  let processedData = []; // Flat array of {type: 'header'|'text', data, searchText, langHeader}
  let filteredIndices = []; // Indices into processedData that match filter
  let scrollTop = 0;
  let viewportHeight = 0;
  let filterText = '';
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

  filter.addEventListener('input', handleFilterInput, false);
  filter.addEventListener('keydown', handleFilterKeydown, false);
  main.addEventListener('scroll', handleScroll, { passive: true });

  function handleFilterKeydown(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
      const visibleTextRows = filteredIndices.filter(i => processedData[i].type === 'text');
      if (visibleTextRows.length === 1) {
        const item = processedData[visibleTextRows[0]];
        selectText(item.data.id);
        filter.value = '';
        filterText = '';
        applyFilter();
      }
    }
  }

  function handleFilterInput() {
    const newFilter = filter.value.toLowerCase().trim();
    if (newFilter === filterText) return;

    filterText = newFilter;
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

    // First pass: find matching texts and their headers
    for (let i = 0; i < processedData.length; i++) {
      const item = processedData[i];
      if (item.type === 'text' && item.searchText.includes(filterText)) {
        matchingTextIndices.add(i);
        matchingHeaders.add(item.langHeader);
      }
    }

    // Second pass: collect headers and texts in order
    const result = [];
    for (let i = 0; i < processedData.length; i++) {
      const item = processedData[i];
      const isMatchingHeader = item.type === 'header' && matchingHeaders.has(item.data);
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

      const row = createRowElement(item, top);
      fragment.appendChild(row);
    }

    // Clear and append in one operation
    scrollContent.textContent = '';
    scrollContent.appendChild(fragment);
  }

  function createRowElement(item, top) {
    const row = elem('div', {
      style: { position: 'absolute', top: `${top}px`, left: '0', right: '0', height: `${ROW_HEIGHT}px` }
    });

    if (item.type === 'header') {
      row.className = 'text-chooser-row-header';
      row.dataset.langName = item.data;
      row.appendChild(elem('span', { className: 'name' }, item.data));
    } else {
      const text = item.data;
      const isSelected = selectedTextInfo && selectedTextInfo.id === text.id;

      row.className = 'text-chooser-row' + (isSelected ? ' selected' : '');
      row.dataset.id = text.id;

      row.appendChild(elem('span', { className: 'text-chooser-abbr' }, text.abbr));
      row.appendChild(elem('span', { className: 'text-chooser-name' }, text.name));

      if (text.hasLemma) {
        row.appendChild(elem('span', { className: 'text-chooser-lemma' }, elem('span')));
      }
      if (text.hasAudio || text.audioDirectory || text.fcbh_audio_ot || text.fcbh_audio_nt) {
        row.appendChild(elem('span', { className: 'text-chooser-audio' }, elem('span')));
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

    getText(textid, function(data) {
      selectedTextInfo = data;
      ext.trigger('change', { type: 'change', target: this, data: { textInfo: selectedTextInfo, target: target } });
    });
  }

  function storeRecentlyUsed(textInfo) {
    if (textType !== 'bible') return;

    const textid = (typeof textInfo === 'string') ? textInfo : textInfo.id;
    const existingVersions = recentlyUsed.recent.filter(t => t === textid);

    if (existingVersions.length === 0) {
      recentlyUsed.recent.unshift(textid);
      while (recentlyUsed.recent.length > 5) {
        recentlyUsed.recent.pop();
      }
    }

    AppSettings.setValue(recentlyUsedKey, recentlyUsed);
  }

  function processTexts(data) {
    if (!data) return;

    processedData = [];

    let arrayOfTexts = data.filter(t => {
      if (textType === 'audio') {
        return t.hasAudio || t.audioDirectory || t.fcbh_audio_ot || t.fcbh_audio_nt;
      }
      if (t.hasText === false) return false;
      const thisTextType = t.type === undefined ? 'bible' : t.type;
      return thisTextType === textType;
    });

    // Group by language
    const langMap = new Map();
    for (const text of arrayOfTexts) {
      const langKey = text.langNameEnglish || text.langName || '';
      if (!langMap.has(langKey)) {
        langMap.set(langKey, []);
      }
      langMap.get(langKey).push(text);
    }

    // Sort languages and build flat structure
    const languages = Array.from(langMap.keys()).sort();

    for (const langName of languages) {
      const textsInLang = langMap.get(langName);
      textsInLang.sort((a, b) => a.name.localeCompare(b.name));

      const displayName = textsInLang[0].langNameEnglish || textsInLang[0].langName;

      processedData.push({
        type: 'header',
        data: displayName
      });

      for (const text of textsInLang) {
        processedData.push({
          type: 'text',
          data: text,
          searchText: [text.name, text.abbr, text.langName || '', text.langNameEnglish || '']
            .join(' ').toLowerCase(),
          langHeader: displayName
        });
      }
    }

    filteredIndices = processedData.map((_, i) => i);
    updateScrollHeight();
    scheduleRender();
  }

  function setTarget(_container, _target, _textType) {
    const needsRerender = _textType !== textType;
    target = _target;
    textType = _textType;

    if (needsRerender && listData) {
      processTexts(listData);
    }
  }

  function setTextInfo(text) {
    selectedTextInfo = text;
    storeRecentlyUsed(selectedTextInfo);
    scheduleRender();
  }

  function position() {
    if (target == null) return;

    const targetOffset = offset(target);
    const targetOuterHeight = target.offsetHeight;
    const selectorWidth = textChooser.offsetWidth;
    const winWidth = window.innerWidth;

    let top = targetOffset.top + targetOuterHeight + 10;
    let left = targetOffset.left;

    if (winWidth < left + selectorWidth) {
      left = winWidth - selectorWidth;
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

      if (filter.value !== '') {
        filter.value = '';
        filterText = '';
        applyFilter();
      }

      if (!hasTouch) {
        filter.focus();
      }

      requestAnimationFrame(() => {
        viewportHeight = main.clientHeight;
        scheduleRender();
      });
    } else {
      ext.trigger('offclick', { type: 'offclick' });
    }
  });

  let ext = {
    setTarget,
    getTarget: () => target,
    getTextInfo: () => selectedTextInfo,
    setTextInfo,
    // Expose native popover methods directly
    show: () => textChooser.showPopover(),
    hide: () => textChooser.hidePopover(),
    toggle: () => textChooser.togglePopover(),
    isVisible: () => textChooser.matches(':popover-open'),
    node: () => textChooser,
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

export default TextChooser;
