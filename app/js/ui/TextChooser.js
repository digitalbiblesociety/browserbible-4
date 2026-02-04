/**
 * TextChooser
 * A high-performance dropdown for selecting Bible versions
 * Uses virtual scrolling for 60fps smooth rendering
 */

import { createElements, deepMerge, offset } from '../lib/helpers.esm.js';
import { EventEmitterMixin } from '../common/EventEmitter.js';
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
  let container = null;
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

  const textChooser = createElements(
    '<div class="text-chooser nav-drop-list" popover>' +
      '<span class="up-arrow"></span>' +
      '<span class="up-arrow-border"></span>' +
      '<div class="text-chooser-header">' +
        '<div class="text-chooser-selector">' +
          '<span class="text-chooser-default selected i18n" data-mode="default" data-i18n="[html]windows.bible.default"></span>' +
          '<span class="text-chooser-languages i18n" data-mode="languages" data-i18n="[html]windows.bible.languages"></span>' +
          '<span class="text-chooser-countries i18n" data-mode="countries" data-i18n="[html]windows.bible.countries"></span>' +
        '</div>' +
        '<input type="text" class="text-chooser-filter-text i18n" data-i18n="[placeholder]windows.bible.filter" />' +
        '<span class="close-button">Close</span>' +
      '</div>' +
      '<div class="text-chooser-main">' +
        '<div class="text-chooser-scroll-content"></div>' +
      '</div>' +
    '</div>'
  );

  const header = textChooser.querySelector('.text-chooser-header');
  const main = textChooser.querySelector('.text-chooser-main');
  const scrollContent = textChooser.querySelector('.text-chooser-scroll-content');
  const listselector = textChooser.querySelector('.text-chooser-selector');
  const filter = textChooser.querySelector('.text-chooser-filter-text');
  const closeBtn = textChooser.querySelector('.close-button');

  // Add CSS containment for performance
  main.style.contain = 'strict';
  main.style.overflowY = 'auto';
  main.style.willChange = 'scroll-position';

  document.body.appendChild(textChooser);

  if (closeBtn) closeBtn.style.display = 'none';
  if (listselector) listselector.style.display = 'none';

  if (closeBtn) {
    closeBtn.addEventListener('click', hide, false);
  }

  textChooser.addEventListener('toggle', (e) => {
    if (e.newState === 'closed') {
      ext.trigger('offclick', { type: 'offclick' });
    }
  });

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
    const row = document.createElement('div');
    row.style.cssText = `position:absolute;top:${top}px;left:0;right:0;height:${ROW_HEIGHT}px;`;

    if (item.type === 'header') {
      row.className = 'text-chooser-row-header';
      row.setAttribute('data-lang-name', item.data);
      row.innerHTML = `<span class="name">${item.data}</span>`;
    } else {
      const text = item.data;
      const isSelected = selectedTextInfo && selectedTextInfo.id === text.id;

      row.className = 'text-chooser-row' + (isSelected ? ' selected' : '');
      row.setAttribute('data-id', text.id);

      let iconsHtml = '';
      if (text.hasLemma) {
        iconsHtml += '<span class="text-chooser-lemma"><span></span></span>';
      }
      if (text.hasAudio || text.audioDirectory || text.fcbh_audio_ot || text.fcbh_audio_nt) {
        iconsHtml += '<span class="text-chooser-audio"><span></span></span>';
      }

      row.innerHTML =
        `<span class="text-chooser-abbr">${text.abbr}</span>` +
        `<span class="text-chooser-name">${text.name}</span>` +
        iconsHtml;
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
    hide();

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

  function toggle() {
    if (textChooser.matches(':popover-open')) {
      hide();
    } else {
      show();
    }
  }

  function setTarget(_container, _target, _textType) {
    const needsRerender = _textType !== textType;
    container = _container;
    target = _target;
    textType = _textType;

    if (needsRerender && listData) {
      processTexts(listData);
    }
  }

  function getTarget() {
    return target;
  }

  function show() {
    size();
    textChooser.showPopover();

    if (!listData) {
      main.classList.add('loading-indicator');
      loadTexts(function(data) {
        listData = data;
        main.classList.remove('loading-indicator');
        processTexts(listData);
      });
    } else {
      scheduleRender();
    }

    size();

    if (filter.value !== '') {
      filter.value = '';
      filterText = '';
      applyFilter();
    }

    if (!hasTouch) {
      filter.focus();
    }
  }

  function hide() {
    textChooser.hidePopover();
  }

  function setTextInfo(text) {
    selectedTextInfo = text;
    storeRecentlyUsed(selectedTextInfo);
    scheduleRender();
  }

  function getTextInfo() {
    return selectedTextInfo;
  }

  function size(w, h) {
    if (target == null || container == null) return;

    const targetOffset = offset(target);
    const targetOuterHeight = target.offsetHeight;
    const selectorWidth = textChooser.offsetWidth;
    const winHeight = window.innerHeight - 40;
    const winWidth = window.innerWidth;
    const maxHeight = winHeight - (targetOffset.top + targetOuterHeight + 10);

    let top = targetOffset.top + targetOuterHeight + 10;
    let left = targetOffset.left;

    if (winWidth < left + selectorWidth) {
      left = winWidth - selectorWidth;
      if (left < 0) left = 0;
    }

    textChooser.style.height = maxHeight + 'px';
    textChooser.style.top = top + 'px';
    textChooser.style.left = left + 'px';

    const mainHeight = maxHeight - header.offsetHeight;
    main.style.height = mainHeight + 'px';
    viewportHeight = mainHeight;

    // Up arrow
    const upArrowLeft = targetOffset.left - left + 20;
    textChooser.querySelectorAll('.up-arrow, .up-arrow-border').forEach(arrow => {
      arrow.style.left = upArrowLeft + 'px';
    });

    scheduleRender();
  }

  function isVisible() {
    return textChooser.matches(':popover-open');
  }

  function node() {
    return textChooser;
  }

  function close() {
    hide();
  }

  let ext = {
    setTarget,
    getTarget,
    show,
    hide,
    toggle,
    isVisible,
    node,
    getTextInfo,
    setTextInfo,
    size,
    close
  };

  ext = deepMerge(ext, EventEmitterMixin);
  ext._events = {};

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
