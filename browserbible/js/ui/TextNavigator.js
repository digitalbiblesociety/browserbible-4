/**
 * TextNavigator
 * A dropdown for navigating Bible books and chapters.
 * For English texts a passages column sits to the right of the books and
 * tracks the active book. Uses the native popover API for click-off detection.
 */

import { elem, offset } from '../lib/helpers.esm.js';
import { toBcp47Lang } from '../lib/bcp47.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import { i18n } from '../lib/i18n.js';
import { BOOK_DATA, OT_BOOKS, NT_BOOKS, AP_BOOKS, addNames, numbers as bibleNumbers } from '../bible/BibleData.js';
import { Reference } from '../bible/BibleReference.js';
import { getPericopesByBook } from '../bible/Pericopes.js';
import { getShowApocrypha } from '../bible/Apocrypha.js';

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
  let activeBookId = null;

  // Single filter (in place of the header title): narrows books, and on English
  // texts searches passage titles across all books.
  const filterInput = elem('input', { className: 'text-navigator-filter', type: 'text', placeholder: 'Filter books or passages…' });
  const header = elem('div', { className: 'text-navigator-header' }, filterInput);

  // Left column: books (with inline chapter grid on selection)
  const divisionsEl = elem('div', { className: 'text-navigator-divisions' });

  // Right column (English texts): passages for the active book
  const periHeaderEl = elem('div', { className: 'text-navigator-peri-header' });
  const periList = elem('div', { className: 'text-navigator-peri-list' });
  const pericopesEl = elem('div', { className: 'text-navigator-pericopes' }, periHeaderEl, periList);

  const bodyEl = elem('div', { className: 'text-navigator-body' }, divisionsEl, pericopesEl);
  const changer = elem('div', { className: 'text-navigator nav-drop-list', popover: '' }, header, bodyEl);

  document.body.appendChild(changer);

  // ── Passages (pericopes) ──────────────────────────────────────

  // Pericope titles are English source data, so the passages column is only
  // offered for English texts (lang "eng"/"en", incl. tagged variants).
  function isEnglishText() {
    const lang = (textInfo?.lang || '').toLowerCase();
    return lang === 'eng' || lang === 'en' || lang.startsWith('eng-') || lang.startsWith('en-');
  }

  let pericopeMap = null;
  function getPericopeMap() {
    if (!pericopeMap) {
      pericopeMap = new Map();
      for (const { bookid, pericopes } of getPericopesByBook()) pericopeMap.set(bookid, pericopes);
    }
    return pericopeMap;
  }

  function sectionFilter() {
    const available = new Set(textInfo?.sections ?? []);
    return available.size ? (sectionid) => available.has(sectionid) : () => true;
  }

  function buildPericopeItem(p) {
    return elem('div', {
      className: 'peri-item',
      dataset: { title: p.title.toLowerCase(), section: p.sectionid, fragment: p.fragmentid }
    },
      elem('span', { className: 'peri-title', textContent: p.title }),
      elem('span', { className: 'peri-ref', textContent: `${p.chapter}:${p.verse}` })
    );
  }

  // Right column shows just the active book's passages.
  function renderActiveBookPassages(bookid) {
    periHeaderEl.textContent = bookid ? (BOOK_DATA[bookid]?.name ?? bookid) : '';
    periList.classList.remove('peri-grouped');

    const has = sectionFilter();
    const frag = document.createDocumentFragment();
    for (const p of getPericopeMap().get(bookid) ?? []) {
      if (has(p.sectionid)) frag.appendChild(buildPericopeItem(p));
    }
    periList.innerHTML = '';
    periList.appendChild(frag);
  }

  // When filtering, the right column shows matches across every book.
  // Returns the set of book ids that have at least one match.
  function renderSearchResults(q) {
    periHeaderEl.textContent = i18n.t('windows.search.results') || 'Results';
    periList.classList.add('peri-grouped');

    const has = sectionFilter();
    const bookIds = new Set();
    const frag = document.createDocumentFragment();
    for (const { bookid, pericopes } of getPericopesByBook()) {
      if (textInfo?.divisions && !textInfo.divisions.includes(bookid)) continue;
      const bookName = BOOK_DATA[bookid]?.name ?? bookid;
      const bookMatch = bookName.toLowerCase().includes(q);
      const matches = pericopes.filter(p => has(p.sectionid) && (bookMatch || p.title.toLowerCase().includes(q)));
      if (!matches.length) continue;

      bookIds.add(bookid);
      const group = elem('div', { className: 'peri-book-group' },
        elem('div', { className: 'peri-book-header', textContent: bookName })
      );
      for (const p of matches) group.appendChild(buildPericopeItem(p));
      frag.appendChild(group);
    }
    periList.innerHTML = '';
    periList.appendChild(frag);
    return bookIds;
  }

  // Show only the given book ids in the left column (used during passage search
  // so the books owning the results stay visible alongside them).
  function showOnlyBooks(bookIds) {
    let headerEl = null;
    let headerHasVisible = false;
    const flush = () => { if (headerEl) headerEl.style.display = headerHasVisible ? '' : 'none'; };

    for (const child of divisionsEl.children) {
      if (child.classList.contains('text-navigator-division-header')) {
        flush();
        headerEl = child;
        headerHasVisible = false;
      } else if (child.classList.contains('text-navigator-division')) {
        const visible = bookIds.has(child.dataset.id);
        child.style.display = visible ? '' : 'none';
        if (visible) headerHasVisible = true;
      }
    }
    flush();
  }

  // Highlight & scroll to the passage containing the current reference.
  function highlightCurrentPassage(fragmentid) {
    if (!fragmentid) return;
    const [sectionid, verseStr] = fragmentid.split('_');
    const bookid = sectionid.substring(0, 2);
    const chapter = parseInt(sectionid.substring(2), 10);
    const verse = parseInt(verseStr || '1', 10) || 1;

    let best = null;
    for (const p of getPericopeMap().get(bookid) ?? []) {
      if (p.chapter < chapter || (p.chapter === chapter && p.verse <= verse)) best = p;
      else break; // passages are in canonical order
    }
    if (!best) return;

    const node = periList.querySelector(`.peri-item[data-fragment="${best.fragmentid}"]`);
    if (!node) return;
    periList.querySelectorAll('.peri-item.current').forEach(n => n.classList.remove('current'));
    node.classList.add('current');
    node.scrollIntoView({ block: 'nearest' });
  }

  // Make `bookid` the active book: position the book list on it and, for English
  // texts, refresh the passages column to match (unless a search is active).
  function setActiveBook(bookid, currentFragmentid) {
    activeBookId = bookid;

    // Scroll the book to the top of the list. offsetTop is relative to the
    // positioned popover (not the scroll container), so measure the delta
    // between the book and the container viewport instead.
    const divNode = changer.querySelector('.divisionid-' + bookid);
    if (divNode) {
      const delta = divNode.getBoundingClientRect().top - divisionsEl.getBoundingClientRect().top;
      divisionsEl.scrollTop = Math.max(0, divisionsEl.scrollTop + delta - 8);
    }

    if (!isEnglishText() || filterInput.value.trim()) return;
    renderActiveBookPassages(bookid);
    periList.scrollTop = 0;
    if (currentFragmentid) highlightCurrentPassage(currentFragmentid);
  }

  // Unified filter: narrow the book list; drive the passages column.
  function applyFilter() {
    const q = filterInput.value.trim().toLowerCase();

    if (isEnglishText() && q) {
      // Passage search — right shows matches, left shows the books they're in.
      showOnlyBooks(renderSearchResults(q));
    } else {
      filterBooks(q);
      if (isEnglishText()) renderActiveBookPassages(activeBookId);
    }
  }

  function filterBooks(q) {
    // Show/hide book rows by name; hide testament headers with no visible books.
    let headerEl = null;
    let headerHasVisible = false;
    const flush = () => { if (headerEl) headerEl.style.display = headerHasVisible ? '' : 'none'; };

    for (const child of divisionsEl.children) {
      if (child.classList.contains('text-navigator-division-header')) {
        flush();
        headerEl = child;
        headerHasVisible = false;
      } else if (child.classList.contains('text-navigator-division')) {
        const name = (child.getAttribute('data-name') || '').toLowerCase();
        const visible = !q || name.includes(q);
        child.style.display = visible ? '' : 'none';
        if (visible) headerHasVisible = true;
      }
    }
    flush();
  }

  function firstVisibleDivision() {
    for (const d of divisionsEl.querySelectorAll('.text-navigator-division')) {
      if (d.style.display !== 'none') return d;
    }
    return null;
  }

  function navigateToPericope(item) {
    if (!item) return;
    ext.trigger('change', {
      type: 'change',
      target: item,
      data: { sectionid: item.dataset.section, fragmentid: item.dataset.fragment, target }
    });
    hide();
  }

  filterInput.addEventListener('input', applyFilter);
  filterInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (filterInput.value.trim() && isEnglishText()) {
      navigateToPericope(periList.querySelector('.peri-item'));
    } else {
      const d = firstVisibleDivision();
      if (d && !d.classList.contains('selected')) d.click();
    }
  });

  periList.addEventListener('click', (e) => {
    const item = e.target.closest('.peri-item');
    if (item) navigateToPericope(item);
  });

  // ── Book / chapter navigation ─────────────────────────────────

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
    if (textInfo.lang) divsEl.setAttribute('lang', toBcp47Lang(textInfo.lang));
  }

  function selectCurrentReference(fragmentid) {
    if (!fragmentid) return;
    const sectionid = fragmentid.split('_')[0];
    const divisionid = sectionid.substring(0, 2);
    const divisionNode = changer.querySelector('.divisionid-' + divisionid);
    if (!divisionNode) return;

    divisionNode.classList.add('selected');
    renderSections(false);
    const sectionNode = divisionNode.querySelector('.section-' + sectionid);
    if (sectionNode) sectionNode.classList.add('selected');

    // Position the book list on the current book and sync the passages column
    setActiveBook(divisionid, fragmentid);
  }

  function showBibleNav() {
    const textInputValue = target?.value ?? '';
    const biblereference = Reference(textInputValue);
    const fragmentid = biblereference ? biblereference.toSection() : null;

    renderDivisions();
    applyDivisionAttrs(divisionsEl);
    selectCurrentReference(fragmentid);
  }

  function show() {
    if (textInfo == null) {
      console.warn('navigator has no textInfo!');
      return;
    }

    filterInput.value = '';
    activeBookId = null;

    // English texts get the passages column to the right of the books
    const english = isEnglishText();
    changer.classList.toggle('text-navigator-2col', english);
    pericopesEl.style.display = english ? '' : 'none';
    filterInput.placeholder = english ? 'Filter books or passages…' : 'Filter books…';
    periHeaderEl.textContent = '';
    periList.innerHTML = '';

    size();
    changer.showPopover();
    size();

    changer.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    divisionsEl.scrollTop = 0;

    const textType = (textInfo.type || 'bible').toLowerCase();
    const isBibleType = ['bible', 'deafbible', 'videobible', 'commentary'].includes(textType);

    if (isBibleType) {
      showBibleNav();
    } else if (textType === 'book') {
      renderSections();
      divisionsEl.style.display = 'none';
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

    divisionsEl.classList.toggle('text-navigator-divisions-full', fullBookMode);

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

    // Apocryphal books are hidden unless the user has enabled them.
    const sortedDivs = getShowApocrypha()
      ? [...otDivs, ...apDivs, ...ntDivs, ...otherDivs]
      : [...otDivs, ...ntDivs, ...otherDivs];

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

    divisionsEl.innerHTML = '';
    divisionsEl.appendChild(fragment);
    divisionsEl.style.display = '';
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

    const positionBefore = divisionNode.offsetTop;
    const scrollTopBefore = divisionsEl.scrollTop;

    changer.querySelectorAll('.text-navigator-sections').forEach(el => el.parentNode.removeChild(el));

    const positionAfter = divisionNode.offsetTop;

    if (positionBefore > positionAfter) {
      divisionsEl.scrollTop = scrollTopBefore - (positionBefore - positionAfter);
    }

    renderSections(true);

    // Selecting a book makes it active → refresh the passages column + position
    setActiveBook(divisionNode.dataset.id);
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
        divisionsEl.scrollTop += 500;
      }
    }
  }

  function renderBibleSections(animated) {
    const selectedDiv = changer.querySelector('.text-navigator-division.selected');
    const chapters = selectedDiv?.getAttribute('data-chapters')?.split(',') ?? [];

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

      // The body (book + passages columns) fills the space below the filter.
      // Each column scrolls internally; the inline chapter grid sizes to its
      // content (forcing a height there spreads its wrapped rows).
      bodyEl.style.height = (maxHeight - header.offsetHeight) + 'px';
    }
  }

  function setTextInfo(value) {
    textInfo = value;
    if (!textInfo) return;

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

  function destroy() {
    changer.remove();
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
    close,
    destroy
  };

  mixinEventEmitter(ext);

  return ext;
}

let globalTextNavigator = null;

export function getGlobalTextNavigator() {
  if (!globalTextNavigator) {
    globalTextNavigator = TextNavigator();
  }
  return globalTextNavigator;
}
