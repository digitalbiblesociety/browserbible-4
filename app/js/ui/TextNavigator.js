/**
 * TextNavigator
 * A dropdown for navigating Bible books and chapters
 * Uses native popover API for click-off detection
 */

import { elem, offset } from '../lib/helpers.esm.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import { i18n } from '../lib/i18n.js';
import { BOOK_DATA, OT_BOOKS, NT_BOOKS, AP_BOOKS, addNames, numbers as bibleNumbers } from '../bible/BibleData.js';
import { Reference } from '../bible/BibleReference.js';

/**
 * Create a text navigator
 * @returns {Object} TextNavigator API object
 */
export function TextNavigator() {
  let container = null;
  let target = null;
  let isFull = false;
  let textInfo = null;
  let fullBookMode = false;

  const title = elem('span', { className: 'text-navigator-title', innerHTML: '&nbsp;' });
  const header = elem('div', { className: 'text-navigator-header' }, title);
  const divisions = elem('div', { className: 'text-navigator-divisions' });
  const changer = elem('div', { className: 'text-navigator nav-drop-list', popover: '' }, header, divisions);

  document.body.appendChild(changer);

  function hide() {
    changer.hidePopover();
  }

  function toggle() {
    if (changer.matches(':popover-open')) {
      hide();
    } else {
      show();
    }
  }

  function applyDivisionAttrs(divsEl) {
    if (!divsEl) return;
    divsEl.style.display = '';
    if (textInfo.dir) divsEl.setAttribute('dir', textInfo.dir);
    if (textInfo.lang) divsEl.setAttribute('lang', textInfo.lang);
  }

  function selectCurrentReference(fragmentid) {
    if (!fragmentid) return;
    const sectionid = fragmentid.split('_')[0];
    const divisionid = sectionid.substring(0, 2);
    const divisionNode = changer.querySelector('.divisionid-' + divisionid);
    if (!divisionNode) return;

    divisionNode.classList.add('selected');
    const divsContainer = changer.querySelector('.text-navigator-divisions');
    if (divsContainer) divsContainer.scrollTop = divisionNode.offsetTop - 40;

    renderSections(false);
    const sectionNode = divisionNode.querySelector('.section-' + sectionid);
    if (sectionNode) sectionNode.classList.add('selected');
  }

  function showBibleNav() {
    const textInputValue = target?.value ?? '';
    const biblereference = Reference(textInputValue);
    const fragmentid = biblereference ? biblereference.toSection() : null;

    renderDivisions();
    applyDivisionAttrs(changer.querySelector('.text-navigator-divisions'));
    selectCurrentReference(fragmentid);
  }

  function show() {
    if (textInfo == null) {
      console.warn('navigator has no textInfo!');
      return;
    }

    title.innerHTML = textInfo.name;
    size();
    changer.showPopover();
    size();

    changer.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    const divisions = changer.querySelector('.text-navigator-divisions');
    if (divisions) divisions.scrollTop = 0;

    const textType = (textInfo.type || 'bible').toLowerCase();
    const isBibleType = ['bible', 'deafbible', 'videobible', 'commentary'].includes(textType);

    if (isBibleType) {
      showBibleNav();
    } else if (textType === 'book') {
      renderSections();
      const divsEl = changer.querySelector('.text-navigator-divisions');
      if (divsEl) divsEl.style.display = 'none';
    }
  }

  function getBookSectionClass(bookid) {
    return BOOK_DATA[bookid] ? BOOK_DATA[bookid].section : '';
  }

  function getDisplayName(divisionName, divisionAbbr) {
    if (fullBookMode) return divisionName;
    const source = divisionAbbr ?? divisionName ?? '';
    return source.replace(/\s/i, '').substring(0, 3);
  }

  function buildDivisionElement(divisionid, divisionName, displayName) {
    const chapters = textInfo.sections.filter(c => c.substring(0, 2) === divisionid);
    return elem('div', {
      className: `text-navigator-division divisionid-${divisionid} division-section-${getBookSectionClass(divisionid)}`,
      dataset: { id: divisionid, chapters: chapters.join(','), name: divisionName }
    }, elem('span', displayName));
  }

  function renderDivisions() {
    const fragment = document.createDocumentFragment();
    const printed = { ot: false, nt: false, ap: false };
    fullBookMode = true;

    const divsEl = changer.querySelector('.text-navigator-divisions');
    if (divsEl) divsEl.classList.toggle('text-navigator-divisions-full', fullBookMode);

    // Sort divisions into OT, AP, NT order regardless of input order
    const otDivs = [];
    const apDivs = [];
    const ntDivs = [];
    const otherDivs = [];

    for (let i = 0; i < textInfo.divisions.length; i++) {
      const divisionid = textInfo.divisions[i];
      const entry = { divisionid, index: i };
      if (OT_BOOKS.includes(divisionid)) otDivs.push(entry);
      else if (NT_BOOKS.includes(divisionid)) ntDivs.push(entry);
      else if (AP_BOOKS.includes(divisionid)) apDivs.push(entry);
      else otherDivs.push(entry);
    }

    const sortedDivs = [...otDivs, ...apDivs, ...ntDivs, ...otherDivs];

    for (const { divisionid, index: i } of sortedDivs) {
      if (!BOOK_DATA[divisionid]) continue;

      const divisionName = textInfo.divisionNames?.[i] ?? null;
      const divisionAbbr = textInfo.divisionAbbreviations?.[i] ?? null;

      if (OT_BOOKS.includes(divisionid) && !printed.ot) {
        fragment.appendChild(elem('div', { className: 'text-navigator-division-header', textContent: i18n.t('windows.bible.ot') }));
        printed.ot = true;
      }
      if (AP_BOOKS.includes(divisionid) && !printed.ap) {
        fragment.appendChild(elem('div', { className: 'text-navigator-division-header', textContent: i18n.t('windows.bible.dc') }));
        printed.ap = true;
      }
      if (NT_BOOKS.includes(divisionid) && !printed.nt) {
        fragment.appendChild(elem('div', { className: 'text-navigator-division-header', textContent: i18n.t('windows.bible.nt') }));
        printed.nt = true;
      }

      fragment.appendChild(buildDivisionElement(divisionid, divisionName, getDisplayName(divisionName, divisionAbbr)));
    }

    if (divsEl) {
      divsEl.innerHTML = '';
      divsEl.appendChild(fragment);
      divsEl.style.display = '';
    }

    changer.querySelectorAll('.text-navigator-sections').forEach(el => el.remove());
  }

  // Click a division (Bible book)
  changer.addEventListener('click', (e) => {
    const divisionNode = e.target.closest('.text-navigator-division');
    if (!divisionNode) return;

    if (divisionNode.classList.contains('selected')) {
      const sectionsEl = divisionNode.querySelector('.text-navigator-sections');
      if (sectionsEl) {
        sectionsEl.classList.add('collapsed');
        sectionsEl.addEventListener('transitionend', () => {
          divisionNode.classList.remove('selected');
        }, { once: true });
      } else {
        divisionNode.classList.remove('selected');
      }
      return;
    }

    divisionNode.classList.add('selected');
    [...divisionNode.parentElement.children].filter(s => s !== divisionNode).forEach(sib => sib.classList.remove('selected'));

    const divisions = changer.querySelector('.text-navigator-divisions');
    const positionBefore = divisionNode.offsetTop;
    const scrollTopBefore = divisions ? divisions.scrollTop : 0;

    changer.querySelectorAll('.text-navigator-sections').forEach(el => el.parentNode.removeChild(el));

    const positionAfter = divisionNode.offsetTop;

    if (positionBefore > positionAfter && divisions) {
      const newScrollTop = scrollTopBefore - (positionBefore - positionAfter);
      divisions.scrollTop = newScrollTop;
    }

    renderSections(true);
  });

  function buildChapterElements(chapters) {
    const numbers = textInfo.numbers ?? bibleNumbers.default;
    const fragment = document.createDocumentFragment();
    for (const code of chapters) {
      const num = parseInt(code.substring(2));
      const span = elem('span', {
        className: `text-navigator-section section-${code}`,
        textContent: numbers[num],
        dataset: { id: code }
      });
      fragment.appendChild(span);
    }
    return fragment;
  }

  function insertSectionNodes(selectedDiv, sectionNodes, animated) {
    const spanEl = selectedDiv?.querySelector('span');
    if (spanEl) spanEl.parentNode.insertBefore(sectionNodes, spanEl.nextSibling);

    const isLast = selectedDiv && !selectedDiv.nextElementSibling;
    if (animated && !isLast) {
      // Force reflow then remove collapsed class to trigger animation
      sectionNodes.offsetHeight;
      sectionNodes.classList.remove('collapsed');
    } else {
      sectionNodes.classList.remove('collapsed');
      if (isLast) {
        const divisionsEl = changer.querySelector('.text-navigator-divisions');
        if (divisionsEl) divisionsEl.scrollTop += 500;
      }
    }
  }

  function renderBibleSections(animated) {
    const selectedDiv = changer.querySelector('.text-navigator-division.selected');
    const divisionname = selectedDiv?.getAttribute('data-name') ?? null;
    const chapters = selectedDiv?.getAttribute('data-chapters')?.split(',') ?? [];

    title.textContent = divisionname;
    const inner = elem('div', { className: 'text-navigator-sections-inner' });
    inner.appendChild(buildChapterElements(chapters));
    const sectionNodes = elem('div', { className: 'text-navigator-sections collapsed' });
    sectionNodes.appendChild(inner);
    insertSectionNodes(selectedDiv, sectionNodes, animated);
  }

  function renderSections(animated) {
    const textType = (textInfo.type || 'bible').toLowerCase();
    const isBibleType = ['bible', 'deafbible', 'videobible', 'commentary'].includes(textType);

    if (isBibleType) {
      renderBibleSections(animated);
    }
  }

  changer.addEventListener('click', (e) => {
    const el = e.target.closest('.text-navigator-section');
    if (!el) return;

    el.classList.add('selected');
    const sectionid = el.getAttribute('data-id');

    ext.trigger('change', { type: 'change', target: el, data: { sectionid: sectionid, target: target } });
    hide();
  });

  function size(width, height) {
    if (isFull) {
      if (!(width && height)) {
        width = container.offsetWidth;
        height = container.offsetHeight;
      }

      const containerOffset = offset(container);

      changer.style.width = width + 'px';
      changer.style.height = height + 'px';
      changer.style.top = containerOffset.top + 'px';
      changer.style.left = containerOffset.left + 'px';
    } else {
      if (target == null) return;

      const targetOffset = offset(target);
      const targetOuterHeight = target.offsetHeight;
      const top = targetOffset.top + targetOuterHeight + 10;
      const changerWidth = changer.offsetWidth;
      const winHeight = window.innerHeight - 40;
      const winWidth = window.innerWidth;
      const maxHeight = winHeight - top;

      let left = targetOffset.left;

      if (winWidth < left + changerWidth) {
        left = winWidth - changerWidth;
        if (left < 0) left = 0;
      }

      changer.style.height = maxHeight + 'px';
      changer.style.top = top + 'px';
      changer.style.left = left + 'px';

      const upArrowLeft = targetOffset.left - left + 20;
      changer.style.setProperty('--arrow-left', upArrowLeft + 'px');

      const headerHeight = header.offsetHeight;
      changer.querySelectorAll('.text-navigator-divisions, .text-navigator-sections').forEach(el => {
        el.style.height = (maxHeight - headerHeight) + 'px';
      });
    }
  }

  function setTextInfo(value) {
    textInfo = value;

    if (textInfo.title) {
      changer.querySelector('.text-navigator-header').innerHTML = textInfo.title;
    }

    if (textInfo.divisionNames) {
      addNames(textInfo.lang, textInfo.divisions, textInfo.divisionNames);
    }
  }

  function isVisible() {
    return changer.matches(':popover-open');
  }

  function node() {
    return changer;
  }

  function close() {
    hide();
  }

  function setTarget(_container, _target) {
    container = _container;
    target = _target;
  }

  function getTarget() {
    return target;
  }

  let ext = {
    setTarget,
    getTarget,
    show,
    toggle,
    hide,
    isVisible,
    node,
    setTextInfo,
    size,
    close
  };

  mixinEventEmitter(ext);
  ext._events = {};

  return ext;
}

let globalTextNavigator = null;

export function getGlobalTextNavigator() {
  if (!globalTextNavigator) {
    globalTextNavigator = TextNavigator();
  }
  return globalTextNavigator;
}

export default TextNavigator;
