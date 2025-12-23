/**
 * TextChooser
 * A dropdown for selecting Bible versions
 * Uses native popover API for click-off detection
 */

import { createElements, on, siblings, deepMerge, toElement, offset } from '../lib/helpers.esm.js';
import { EventEmitterMixin } from '../common/EventEmitter.js';
import AppSettings from '../common/AppSettings.js';
const hasTouch = 'ontouchend' in document;
import { loadTexts, getText } from '../texts/TextLoader.js';

/**
 * Create a text chooser
 * @returns {Object} TextChooser API object
 */
export function TextChooser() {
  let container = null;
  let text_type = null;
  let target = null;
  let selectedTextInfo = null;
  let list_data = null;
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
      '<div class="text-chooser-main"></div>' +
    '</div>'
  );

  const header = textChooser.querySelector('.text-chooser-header');
  const main = textChooser.querySelector('.text-chooser-main');
  const listselector = textChooser.querySelector('.text-chooser-selector');
  const filter = textChooser.querySelector('.text-chooser-filter-text');
  const closeBtn = textChooser.querySelector('.close-button');

  document.body.appendChild(textChooser);

  if (closeBtn) closeBtn.style.display = 'none';
  if (listselector) listselector.style.display = 'none';

  if (closeBtn) {
    closeBtn.addEventListener('click', hide, false);
  }

  // Handle popover toggle events (fires on light dismiss - click outside or Escape)
  textChooser.addEventListener('toggle', (e) => {
    if (e.newState === 'closed') {
      ext.trigger('offclick', { type: 'offclick' });
    }
  });

  // Use single 'input' event - faster and more modern than keyup/keypress
  filter.addEventListener('input', filterVersions, false);
  filter.addEventListener('keydown', handleFilterKeydown, false);

  function handleFilterKeydown(e) {
    if (e.key === 'Enter' || e.keyCode === 13) {
      const visibleRows = main.querySelectorAll('.text-chooser-row:not(.filtered-hidden)');
      if (visibleRows.length === 1) {
        visibleRows[0].click();
        filter.value = '';
        
      }
    }
  }

  function filterVersions() {
    const text = filter.value.toLowerCase().trim();

    if (text === '') {
      const allRows = main.querySelectorAll('.text-chooser-row');
      for (let i = 0; i < allRows.length; i++) {
        allRows[i].classList.remove('filtered-hidden');
      }
      const allHeaders = main.querySelectorAll('.text-chooser-row-header');
      for (let i = 0; i < allHeaders.length; i++) {
        allHeaders[i].classList.remove('filtered-hidden');
      }
      return;
    }

    const allRows = main.querySelectorAll('.text-chooser-row');
    const headerVisibility = new Map();

    for (let i = 0; i < allRows.length; i++) {
      const row = allRows[i];
      const searchText = row.getAttribute('data-search-text') || '';

      const hasMatch = searchText.indexOf(text) > -1;

      if (hasMatch) {
        row.classList.remove('filtered-hidden');
        const langHeader = row.getAttribute('data-lang-header');
        if (langHeader) {
          headerVisibility.set(langHeader, true);
        }
      } else {
        row.classList.add('filtered-hidden');
      }
    }

    const allHeaders = main.querySelectorAll('.text-chooser-row-header');
    for (let i = 0; i < allHeaders.length; i++) {
      const header = allHeaders[i];
      const langName = header.getAttribute('data-lang-name');
      if (headerVisibility.get(langName)) {
        header.classList.remove('filtered-hidden');
      } else {
        header.classList.add('filtered-hidden');
      }
    }
  }

  on(textChooser, 'click', '.text-chooser-row', function() {
    const row = this;
    const textid = row.getAttribute('data-id');

    row.classList.add('selected');
    siblings(row).forEach(function(sib) {
      sib.classList.remove('selected');
    });

    storeRecentlyUsed(textid);
    hide();

    getText(textid, function(data) {
      selectedTextInfo = data;
      ext.trigger('change', { type: 'change', target: this, data: { textInfo: selectedTextInfo, target: target } });
    });
  });

  function storeRecentlyUsed(textInfo) {
    if (text_type !== 'bible') return;

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

  function renderTexts(data) {
    if (data == null || typeof data === 'undefined') return;

    const html = [];
    let arrayOfTexts = data;

    arrayOfTexts = arrayOfTexts.filter(function(t) {
      if (text_type === 'audio') {
        const hasAudio = t.hasAudio ||
          typeof t.audioDirectory !== 'undefined' ||
          (typeof t.fcbh_audio_ot !== 'undefined' || typeof t.fcbh_audio_nt !== 'undefined');
        return hasAudio === true;
      }
      if (t.hasText === false) return false;
      const thisTextType = typeof t.type === 'undefined' ? 'bible' : t.type;
      return thisTextType === text_type;
    });

    const languagesSet = new Set();
    for (let i = 0; i < arrayOfTexts.length; i++) {
      const text = arrayOfTexts[i];
      const langKey = text.langNameEnglish || text.langName || '';
      if (langKey) {
        languagesSet.add(langKey);
      }
    }

    const languages = Array.from(languagesSet).sort();

    for (let i = 0; i < languages.length; i++) {
      const langName = languages[i];
      let textsInLang = arrayOfTexts.filter(t => (t.langName === langName || t.langNameEnglish === langName));

      textsInLang.sort((a, b) => {
        if (a.name === b.name) return 0;
        return a.name > b.name ? 1 : -1;
      });

      const langDisplayName = textsInLang[0].langNameEnglish || textsInLang[0].langName;
      html.push(createHeaderRow('', langDisplayName, '', '', ''));

      for (let j = 0; j < textsInLang.length; j++) {
        const text = textsInLang[j];
        html.push(createTextRow(text, langDisplayName, ''));
      }
    }

    main.innerHTML = '<table cellspacing="0">' + html.join('') + '</table>';
    updateSelectedText();
  }

  function updateSelectedText() {
    if (selectedTextInfo != null) {
      const currentSelected = main.querySelector('.text-chooser-row.selected');
      if (currentSelected) {
        currentSelected.classList.remove('selected');
      }

      const selectedEl = main.querySelector('.text-chooser-row[data-id="' + selectedTextInfo.id + '"]');
      if (selectedEl) {
        selectedEl.classList.add('selected');
      }
    }
  }

  function createTextRow(text, langDisplayName, className) {
    const hasAudio = text.hasAudio ||
      typeof text.audioDirectory !== 'undefined' ||
      (typeof text.fcbh_audio_ot !== 'undefined' || typeof text.fcbh_audio_nt !== 'undefined');
    const hasLemma = text.hasLemma;

    const searchText = [
      text.name,
      text.abbr,
      text.langName || '',
      text.langNameEnglish || ''
    ].join(' ').toLowerCase();

    return '<tr class="text-chooser-row' + (className !== '' ? ' ' + className : '') + '" ' +
      'data-id="' + text.id + '" ' +
      'data-search-text="' + searchText + '" ' +
      'data-lang-header="' + (langDisplayName || '') + '">' +
      '<td class="text-chooser-abbr">' + text.abbr + '</td>' +
      '<td class="text-chooser-name"><span>' + text.name + '</span></td>' +
      (hasLemma === true ? '<td class="text-chooser-lemma"><span></span></td>' : '') +
      (hasAudio === true ? '<td class="text-chooser-audio"><span></span></td>' : '') +
    '</tr>';
  }

  function createHeaderRow(id, name, englishName, additionalHtml, className) {
    return '<tr class="text-chooser-row-header' + (className !== '' ? ' ' + className : '') + '" ' +
      'data-id="' + id + '" ' +
      'data-lang-name="' + name + '"><td colspan="5">' +
      '<span class="name">' + name + '</span>' +
      additionalHtml +
    '</td></tr>';
  }

  function toggle() {
    if (textChooser.matches(':popover-open')) {
      hide();
    } else {
      show();
    }
  }

  function setTarget(_container, _target, _text_type) {
    const needsToRerender = _text_type !== text_type;
    container = _container;
    target = _target;
    text_type = _text_type;

    if (needsToRerender) {
      renderTexts(list_data);
    }
  }

  function getTarget() {
    return target;
  }

  function show() {
    size();
    textChooser.showPopover();

    if (!list_data) {
      main.classList.add('loading-indicator');
      loadTexts(function(data) {
        list_data = data;
        main.classList.remove('loading-indicator');
        renderTexts(list_data);
      });
    } else {
      main.classList.remove('loading-indicator');
    }

    size();

    if (filter.value !== '') {
      filter.value = '';
      filterVersions();
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
    updateSelectedText();
  }

  function getTextInfo() {
    return selectedTextInfo;
  }

  function size(w, h) {
    if (target == null || container == null) return;

    const targetEl = toElement(target);
    const targetOffset = offset(targetEl);
    const targetOuterHeight = targetEl.offsetHeight;
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

    main.style.height = (maxHeight - header.offsetHeight) + 'px';

    // Up arrow
    const upArrowLeft = targetOffset.left - left + 20;
    textChooser.querySelectorAll('.up-arrow, .up-arrow-border').forEach(arrow => {
      arrow.style.left = upArrowLeft + 'px';
    });
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
    renderTexts,
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
