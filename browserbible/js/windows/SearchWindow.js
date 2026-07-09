import { BaseWindow, AsyncHelpers, registerWindowComponent } from './BaseWindow.js';
import { offset } from '../lib/helpers.esm.js';
import gearSvg from '../../css/images/gear.svg?raw';

// Curved "enter/return" arrow for the go button inside the search input
const enterArrowSvg = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.5 3.5v4a2.5 2.5 0 0 1-2.5 2.5H4"/><path d="M6.5 7.5 4 10l2.5 2.5"/></svg>';

import { getApp } from '../core/registry.js';
import { i18n } from '../lib/i18n.js';
import { BOOK_DATA, OT_BOOKS, NT_BOOKS, AP_BOOKS, APOCRYPHAL_BIBLE, EXTRA_MATTER } from '../bible/BibleData.js';
import { getShowApocrypha, isApocryphalBook } from '../bible/Apocrypha.js';
import { Reference } from '../bible/BibleReference.js';
import { getGlobalTextChooser } from '../ui/TextChooser.js';
import { getText, loadTexts, startSearch, displayAbbr } from '../texts/TextLoader.js';
import { SearchTools } from '../texts/Search.js';

const getTextAsync = (textId) => AsyncHelpers.promisify(getText, textId);
const loadTextsAsync = () => AsyncHelpers.promisify(loadTexts);

/**
 * SearchWindow Web Component
 * Provides full-text search across Bible texts
 */
class SearchWindowComponent extends BaseWindow {
  constructor() {
    super();

    // Extend state
    this.state = {
      ...this.state,
      selectedTextInfo: null,
      textInfo: null,
      currentResults: null,
      searchTermsRegExp: null,
      isLemmaSearch: false
    };

    this.textChooser = getGlobalTextChooser();
    this.divisionChooser = null;
    this.divWidth = 480;
  }

  async render() {
    this.innerHTML = `
      <div class="window-header search-header">
        <span class="search-input-wrap">
          <input type="text" class="search-text app-input i18n" data-i18n="[placeholder]windows.search.placeholder" />
          <button type="button" class="search-button search-go-button i18n" data-i18n="[title]windows.search.button"></button>
        </span>
        <div class="text-list app-list" style="">&nbsp;</div>
        <div class="search-options-button header-icon" style=""></div>
      </div>
      <div class="search-main">
        <div class="search-wrapper">
          <div class="search-top">
            <div class="search-progress-bar">
              <div class="search-progress-bar-inner"></div>
              <span class="search-progress-bar-label"></span>
            </div>
            <h2 class="search-results-count"></h2>
            <div class="search-visual"><span class="search-visual-label"></span></div>
            <div class="search-lemma-info"></div>
            <div class="search-usage"></div>
          </div>
          <div class="search-results reading-text"></div>
        </div>
      </div>
      <div class="search-footer window-footer"></div>
    `;

    this.querySelector('.search-options-button').innerHTML = gearSvg;
    this.querySelector('.search-go-button').innerHTML = enterArrowSvg;

    // Create division chooser popover (appended to body)
    this.divisionChooser = this.createElement(`
      <div class="search-division-chooser" popover>
        <div class="search-division-header">${i18n.t('windows.search.options')}</div>
        <div class="search-division-main"></div>
      </div>
    `);
    this.divisionChooser.style.width = `${this.divWidth}px`;
    document.body.appendChild(this.divisionChooser);
  }

  cacheRefs() {
    super.cacheRefs();

    this.refs.header = this.$('.search-header');
    this.refs.main = this.$('.search-main');
    this.refs.footer = this.$('.search-footer');
    this.refs.input = this.$('.search-text');
    this.refs.button = this.$('.search-button');
    this.refs.textlistui = this.$('.text-list');
    this.refs.searchOptionsButton = this.$('.search-options-button');

    this.refs.topBlock = this.$('.search-top');
    this.refs.resultsCount = this.$('.search-results-count');
    this.refs.topLemmaInfo = this.$('.search-lemma-info');
    this.refs.topVisual = this.$('.search-visual');
    this.refs.topVisualLabel = this.$('.search-visual-label');
    this.refs.topUsage = this.$('.search-usage');
    this.refs.searchProgressBar = this.$('.search-progress-bar');
    this.refs.searchProgressBarInner = this.$('.search-progress-bar-inner');
    this.refs.searchProgressBarLabel = this.$('.search-progress-bar-label');
    this.refs.resultsBlock = this.$('.search-results');

    this.refs.topLemmaInfo.style.display = 'none';
    this.refs.topVisual.style.display = 'none';
    this.refs.searchProgressBar.style.display = 'none';
  }

  attachEventListeners() {
    // Search input Enter key
    this.addListener(this.refs.input, 'keypress', (e) => {
      if (e.which === 13) {
        this.doSearch();
      }
    });

    // Search button click
    this.addListener(this.refs.button, 'click', () => this.doSearch());

    // Text chooser button
    this.addListener(this.refs.textlistui, 'click', () => this.handleTextListClick());

    // Search options button
    this.addListener(this.refs.searchOptionsButton, 'click', () => {
      this.divisionChooser.togglePopover();
    });

    // Division chooser popover positioning
    this.addListener(this.divisionChooser, 'beforetoggle', (e) => {
      if (e.newState === 'open') {
        this.positionDivisionChooser();
      }
    });

    // Division chooser delegated events
    this.divisionChooser.addEventListener('click', (e) => {
      const checkbox = e.target.closest('.division-header input');
      if (checkbox) {
        const setChildrenTo = checkbox.checked;
        const divisionList = checkbox.closest('.division-list');
        if (divisionList) {
          divisionList.querySelectorAll('.division-list-items input').forEach((inp) => {
            inp.checked = setChildrenTo;
          });
        }
      }
    });

    this.divisionChooser.addEventListener('click', (e) => {
      const checkbox = e.target.closest('.division-list-items input');
      if (checkbox) {
        this.checkDivisionHeader(checkbox.closest('.division-list'));
      }
    });

    // Results click handler - navigate all Bible windows to clicked reference
    this.addListener(this.refs.resultsBlock, 'click', (e) => {
      const row = e.target.closest('.search-result-row');
      if (row) this.handleResultClick(row);
    });

    // Visual bar events
    this.addListener(this.refs.topVisual, 'mouseover', (e) => {
      const target = e.target.closest('.search-result-book-bar');
      if (target) this.handleVisualBarMouseover(target);
    });

    this.addListener(this.refs.topVisual, 'mouseout', (e) => {
      const target = e.target.closest('.search-result-book-bar');
      if (target) this.refs.topVisualLabel.style.display = 'none';
    });

    this.addListener(this.refs.topVisual, 'click', (e) => {
      const target = e.target.closest('.search-result-book-bar');
      if (target) this.handleVisualBarClick(target);
    });

    // Text chooser change - use bound handler for global singleton
    this._textChooserHandler = this.bindHandler('textChooserChange', (e) => this.handleTextChooserChange(e));
    this.textChooser.on('change', this._textChooserHandler);

    // Message handling
    this.on('message', (e) => this.handleMessage(e));
  }

  async init() {
    i18n.translatePage(this.refs.header);
    await this.loadInitialText();
  }

  cleanup() {
    this.removeHighlights();

    if (this.divisionChooser?.parentNode) {
      this.divisionChooser.parentNode.removeChild(this.divisionChooser);
    }

    if (this._textChooserHandler) {
      this.textChooser.off('change', this._textChooserHandler);
    }

    super.cleanup();
    this.textChooser.hide();
  }

  handleTextListClick() {
    if (this.textChooser.getTarget() === this.refs.textlistui) {
      this.textChooser.toggle();
    } else {
      this.textChooser.setTarget(this, this.refs.textlistui, 'bible');
      this.textChooser.setTextInfo(this.state.selectedTextInfo);
      this.textChooser.show();
    }
  }

  handleTextChooserChange(e) {
    if (e.data.target !== this.refs.textlistui) return;
    this.setTextInfo(e.data.textInfo, false);
    if (this.refs.input.value.trim()) {
      this.doSearch();
    } else {
      this.clearResults();
    }
  }

  handleResultClick(tr) {
    const fragmentid = tr.getAttribute('data-fragmentid');
    const app = getApp();
    const bibleWindows = app?.windowManager
      ? app.windowManager.getWindows().filter((w) => w.className === 'BibleWindow')
      : [];

    if (bibleWindows.length === 0) {
      app?.windowManager?.add('BibleWindow', {
        textid: this.config.newBibleWindowVersion,
        fragmentid,
        sectionid: fragmentid.split('_')[0],
      });
    } else {
      this.trigger('globalmessage', {
        type: 'globalmessage',
        target: this,
        data: {
          messagetype: 'nav',
          type: 'bible',
          locationInfo: {
            fragmentid,
            sectionid: fragmentid.split('_')[0],
            offset: 0
          }
        }
      });
    }
  }

  handleVisualBarMouseover(bookBar) {
    if (!bookBar) return;

    const count = bookBar.getAttribute('data-count');
    const dbsBookCode = bookBar.getAttribute('data-id');
    if (!count || !dbsBookCode) return;

    const bookInfo = BOOK_DATA[dbsBookCode];
    if (!bookInfo) return;

    const bookName = bookInfo.names?.[this.state.textInfo?.lang]?.[0] ??
                     bookInfo.names?.en?.[0] ??
                     dbsBookCode;

    const visualWidth = this.refs.topVisual.offsetWidth;
    let left = bookBar.offsetLeft;

    this.refs.topVisualLabel.textContent = `${bookName}: ${count}`;
    this.refs.topVisualLabel.style.left = `${left}px`;
    this.refs.topVisualLabel.style.display = 'block';

    if (left + this.refs.topVisualLabel.offsetWidth > visualWidth) {
      left = visualWidth - this.refs.topVisualLabel.offsetWidth - 5;
      this.refs.topVisualLabel.style.left = `${left}px`;
    }

    if (left < 5) {
      this.refs.topVisualLabel.style.left = '5px';
    }
  }

  handleVisualBarClick(bookBar) {
    if (!bookBar) return;

    const dbsBookCode = bookBar.getAttribute('data-id');
    const header = this.refs.resultsBlock.querySelector(`.search-result-book-header.divisionid-${dbsBookCode}`);

    if (header) {
      this.refs.main.scrollTop = offset(header).top - header.offsetHeight - 50;
    }
  }

  handleMessage(e) {
    if (e.data.messagetype === 'textload') {
      this.createHighlights();
    }
  }

  positionDivisionChooser() {
    const uiPos = offset(this.refs.searchOptionsButton);
    const top = uiPos.top + this.refs.searchOptionsButton.offsetHeight + 12;
    const winWidth = window.innerWidth;
    let left = uiPos.left;

    if (left + this.divWidth > winWidth) {
      left = winWidth - this.divWidth - 50;
    }

    this.divisionChooser.style.top = `${top}px`;
    this.divisionChooser.style.left = `${left}px`;
  }

  drawDivisions() {
    if (!this.state.selectedTextInfo?.divisions) return;

    const showApocrypha = getShowApocrypha();

    let otListHtml = '';
    let apListHtml = '';
    let ntListHtml = '';

    for (let i = 0, il = this.state.selectedTextInfo.divisions.length; i < il; i++) {
      const dbsBookCode = this.state.selectedTextInfo.divisions[i];
      const bookName = this.state.selectedTextInfo.divisionNames[i];
      const checkedStatus = ' checked';
      const html = `<label class="division-name"><input type="checkbox" value="${dbsBookCode}"${checkedStatus} />${this.escapeHtml(bookName)}</label>`;

      if (EXTRA_MATTER.indexOf(dbsBookCode) > -1) continue;
      if (!showApocrypha && isApocryphalBook(dbsBookCode)) continue;

      if (NT_BOOKS.indexOf(dbsBookCode) > -1) {
        ntListHtml += html;
      } else if (AP_BOOKS.indexOf(dbsBookCode) > -1) {
        apListHtml += html;
      } else {
        otListHtml += html;
      }
    }

    const completeHtml =
      `<div class="division-list division-list-ot">
        <label class="division-header">
          <input type="checkbox" value="list-ot" checked />${i18n.t('windows.bible.ot')}</label>
        </label>
        <div class="division-list-items">${otListHtml}</div>
      </div>
      <div class="division-list division-list-ap">
        <label class="division-header">
          <input type="checkbox" value="list-ap" checked />${i18n.t('windows.bible.dc')}</label>
        </label>
        <div class="division-list-items">${apListHtml}</div>
      </div>
      <div class="division-list division-list-nt">
        <label class="division-header">
          <input type="checkbox" value="list-nt" checked />${i18n.t('windows.bible.nt')}</label>
        </label>
        <div class="division-list-items">${ntListHtml}</div>
      </div>`;

    this.divisionChooser.setAttribute('dir', this.state.selectedTextInfo.dir);
    this.divisionChooser.querySelector('.search-division-main').innerHTML = completeHtml;

    const hasOtBooks = this.divisionChooser.querySelectorAll('.division-list-ot .division-list-items input').length > 0;
    const hasApBooks = this.divisionChooser.querySelectorAll('.division-list-ap .division-list-items input').length > 0;
    const hasNtBooks = this.divisionChooser.querySelectorAll('.division-list-nt .division-list-items input').length > 0;

    if (!hasOtBooks) {
      this.divisionChooser.querySelector('.division-list-ot').style.display = 'none';
    }
    if (!hasApBooks) {
      this.divisionChooser.querySelector('.division-list-ap').style.display = 'none';
    }
    if (!hasNtBooks) {
      this.divisionChooser.querySelector('.division-list-nt').style.display = 'none';
    }
  }

  setDivisions(divisions) {
    if (typeof divisions === 'string') {
      divisions = divisions.split(',');
    }

    if (divisions?.length > 0) {
      this.divisionChooser.querySelectorAll('.division-list input').forEach((inp) => {
        inp.checked = false;
      });

      for (let i = 0, il = divisions.length; i < il; i++) {
        const inp = this.divisionChooser.querySelector(`.division-list input[value="${divisions[i]}"]`);
        if (inp) inp.checked = true;
      }
    }

    this.checkDivisionHeader(this.divisionChooser.querySelector('.division-list-ot'));
    this.checkDivisionHeader(this.divisionChooser.querySelector('.division-list-ap'));
    this.checkDivisionHeader(this.divisionChooser.querySelector('.division-list-nt'));
  }

  checkDivisionHeader(divisionList) {
    if (!divisionList) return;

    const items = divisionList.querySelectorAll('.division-list-items input');
    let allChecked = true;

    items.forEach((el) => {
      if (!el.checked) allChecked = false;
    });

    const headerInput = divisionList.querySelector('.division-header input');
    if (headerInput) headerInput.checked = allChecked;
  }

  getSelectedDivisions() {
    const divisions = [];
    const selectedBooks = this.divisionChooser.querySelectorAll('.division-list-items input:checked');

    selectedBooks.forEach((el) => {
      divisions.push(el.value);
    });

    return divisions;
  }

  doSearch() {
    this.state.textInfo = this.textChooser.getTextInfo();

    const text = this.refs.input.value.trim();
    const textid = this.state.textInfo.id;
    const allDivisions = this.divisionChooser.querySelectorAll('.division-list-items input');

    let divisions = this.getSelectedDivisions();

    this.updateTabLabel(text);

    if (allDivisions.length === divisions.length) {
      divisions = [];
    }

    this.clearResults();

    const topBlockTitle = this.refs.topBlock.querySelector('h2');
    if (topBlockTitle) {
      topBlockTitle.innerHTML = `[${this.escapeHtml(text)}] in [${this.escapeHtml(this.state.textInfo.name)}]`;
    }

    this.removeHighlights();

    this.refs.resultsBlock.classList.add('loading-indicator');

    // Tag each search so only the latest one touches the UI (searches can't be cancelled).
    const searchId = this._searchId = (this._searchId || 0) + 1;

    startSearch(
      textid,
      divisions,
      text,
      (e) => { if (searchId === this._searchId) this.searchLoadHandler(e); },
      (e) => { if (searchId === this._searchId) this.searchIndexCompleteHandler(e); },
      (e) => { if (searchId === this._searchId) this.searchCompleteHandler(e); }
    );
  }

  searchLoadHandler(e) {
    this.refs.searchProgressBar.style.display = 'block';

    const reference = Reference(e.data.sectionid);
    const progress = `${e.data.index + 1} / ${e.data.total}`;
    let label = e.data.sectionid;

    if (reference && this.state.textInfo && BOOK_DATA['GN'].names[this.state.textInfo.lang]) {
      reference.language = this.state.textInfo.lang;
      label = reference.toString();
    }

    this.refs.footer.innerHTML = `Loading: ${progress} :: ${label}`;
    this.refs.searchProgressBarInner.style.width = `${(e.data.index + 1) / e.data.total * 100}%`;
    this.refs.searchProgressBarLabel.innerHTML = label;

    const progressWidth = this.refs.searchProgressBarInner.offsetWidth;
    const labelWidth = this.refs.searchProgressBarLabel.offsetWidth;

    if (labelWidth > progressWidth) {
      this.refs.searchProgressBarLabel.style.left = `${progressWidth}px`;
      this.refs.searchProgressBarLabel.style.margin = '';
      this.refs.searchProgressBarLabel.classList.add('search-progress-bar-label-outside');
    } else {
      this.refs.searchProgressBarLabel.style.left = `${progressWidth - labelWidth}px`;
      this.refs.searchProgressBarLabel.style.margin = '';
      this.refs.searchProgressBarLabel.classList.remove('search-progress-bar-label-outside');
    }
  }

  searchIndexCompleteHandler(e) {
    this.refs.footer.innerHTML = i18n.t('windows.search.results') + e.data.searchIndexesData.length;
  }

  determineBookList(isLemmaSearch) {
    if (isLemmaSearch) {
      const text = this.refs.input.value;
      if (text.substr(0, 1) === 'G') {
        return NT_BOOKS;
      } else if (text.substr(0, 1) === 'H') {
        return OT_BOOKS;
      }
    }
    return this.state.textInfo.divisions;
  }

  initializeDivisionCount(bookList) {
    const divisionCount = {};
    for (let i = 0, il = bookList.length; i < il; i++) {
      divisionCount[bookList[i]] = 0;
    }
    return divisionCount;
  }

  formatResultLabel(fragmentid, short) {
    if (this.state.textInfo.type.toLowerCase() === 'bible') {
      const br = Reference(fragmentid);
      if (br && BOOK_DATA['GN'].names[this.state.textInfo.lang]) {
        br.language = this.state.textInfo.lang;
      }
      if (br?.isValid()) {
        if (short) {
          let ref = `${br.chapter1}`;
          if (br.verse1 > 0) ref += `:${br.verse1}`;
          const crossChapter = br.chapter2 > 0 && br.chapter2 !== br.chapter1;
          if (crossChapter) ref += br.verse2 > 0 ? `-${br.chapter2}:${br.verse2}` : `-${br.chapter2}`;
          else if (br.verse2 > 0 && br.verse2 !== br.verse1) ref += `-${br.verse2}`;
          return ref;
        }
        return br.toString();
      }
      return fragmentid;
    }
    return fragmentid;
  }

  buildResultsHtml(results, divisionCount) {
    let html = '';
    const langCode = this.state.textInfo.lang ?? 'en';

    // Render with group headers (counts already populated)
    const emittedBooks = new Set();
    for (let i = 0, il = results.length; i < il; i++) {
      const result = results[i];
      const fragmentid = result.fragmentid;
      const dbsBookCode = fragmentid.substr(0, 2);

      if (!emittedBooks.has(dbsBookCode)) {
        emittedBooks.add(dbsBookCode);
        const bookInfo = BOOK_DATA[dbsBookCode];
        const bookName = bookInfo?.names?.[langCode]?.[0] ??
                         bookInfo?.names?.en?.[0] ??
                         dbsBookCode;
        const count = divisionCount[dbsBookCode];
        html += `<div class="search-result-book-header divisionid-${dbsBookCode}">${this.escapeHtml(bookName)} <span class="search-result-book-count">${count}</span></div>`;
      }

      const label = this.formatResultLabel(fragmentid, true);
      html += `<div data-fragmentid="${fragmentid}" class="search-result-row divisionid-${dbsBookCode}"><span class="search-result-ref">${label}</span><span class="search-result-text" lang="${langCode}">${result.html}</span></div>`;
    }

    return html;
  }

  renderSearchResultsContent(results) {
    // Sort book list and results into canonical order (OT → AP → NT)
    const bookOrder = {};
    for (let i = 0; i < APOCRYPHAL_BIBLE.length; i++) {
      bookOrder[APOCRYPHAL_BIBLE[i]] = i;
    }

    const bookList = this.determineBookList(this.state.isLemmaSearch)
      .slice()
      .sort((a, b) => (bookOrder[a] ?? 999) - (bookOrder[b] ?? 999));
    const divisionCount = this.initializeDivisionCount(bookList);
    results = [...results].sort((a, b) => {
      const aBook = a.fragmentid.substr(0, 2);
      const bBook = b.fragmentid.substr(0, 2);
      return (bookOrder[aBook] ?? 999) - (bookOrder[bBook] ?? 999);
    });

    // Pre-count for visual bar
    for (let i = 0, il = results.length; i < il; i++) {
      const dbsBookCode = results[i].fragmentid.substr(0, 2);
      divisionCount[dbsBookCode] = (divisionCount[dbsBookCode] || 0) + 1;
    }

    const html = this.buildResultsHtml(results, divisionCount);

    this.refs.resultsBlock.innerHTML = html;
    this.refs.resultsBlock.querySelectorAll('.v-num').forEach((el) => {
      el.parentNode.removeChild(el);
    });

    this.highlightResultsText();

    this.renderResultsVisual(divisionCount, bookList);

    // Set book header sticky offset below search-top
    const topHeight = this.refs.topBlock.offsetHeight;
    this.refs.resultsBlock.style.setProperty('--search-top-height', `${topHeight}px`);

    if (this.state.isLemmaSearch) {
      this.renderLemmaInfo();
      this.renderUsage();
    }

    this.createHighlights();
  }

  /**
   * Highlight original-language words for a lemma search by adding the
   * `highlight` class to the <l> word elements whose s attribute contains a
   * searched Strong's number. This mirrors how a normal word search visibly
   * highlights the matched word.
   */
  highlightLemmaWords(root) {
    const regexps = SearchTools.createLemmaHighlightRegExps(this.refs.input.value);
    if (!regexps.length) return;

    root.querySelectorAll('l[s]').forEach((el) => {
      const strongs = el.getAttribute('s') || '';
      if (regexps.some((re) => re.test(strongs))) {
        el.classList.add('highlight');
      }
    });
  }

  highlightResultsText() {
    if (this.state.isLemmaSearch) {
      this.refs.resultsBlock.querySelectorAll('.search-result-text').forEach((el) => this.highlightLemmaWords(el));
      return;
    }

    if (!this.state.searchTermsRegExp?.length) return;

    this.refs.resultsBlock.querySelectorAll('.search-result-text').forEach((el) => {
      for (let j = 0, jl = this.state.searchTermsRegExp.length; j < jl; j++) {
        this.state.searchTermsRegExp[j].lastIndex = 0;
        el.innerHTML = el.innerHTML.replace(this.state.searchTermsRegExp[j], (match) => `<span class="highlight">${match}</span>`);
      }
    });
  }

  searchCompleteHandler(e) {
    this.state.currentResults = e.data.results;
    this.state.searchTermsRegExp = e.data.searchTermsRegExp;
    this.state.isLemmaSearch = e.data.isLemmaSearch;

    this.refs.searchProgressBarInner.style.width = '100%';
    this.setFinalResultsCount(e.data.results?.length ?? 0);
    this.refs.resultsBlock.classList.remove('loading-indicator');

    if (e.data.results?.length > 0) {
      this.renderSearchResultsContent(e.data.results);
    } else {
      this.refs.resultsBlock.innerHTML = 'No results';
    }

    this.trigger('settingschange', { type: 'settingschange', target: this, data: null });
  }

  setFinalResultsCount(count) {
    this.refs.resultsCount.innerHTML = `${i18n.t('windows.search.results')}: ${count}`;
    this.refs.footer.innerHTML = '';
    this.refs.searchProgressBar.style.display = 'none';
  }

  clearResults() {
    this.refs.footer.innerHTML = '';
    this.refs.resultsCount.innerHTML = '';
    this.refs.resultsBlock.innerHTML = '';
    this.refs.topVisual.innerHTML = '';
    this.refs.topVisual.appendChild(this.refs.topVisualLabel);
    this.refs.topVisualLabel.style.display = 'none';
    this.refs.topVisual.style.display = 'none';
    this.refs.topLemmaInfo.innerHTML = '';
    this.refs.topLemmaInfo.style.display = 'none';
    this.refs.topUsage.innerHTML = '';
    this.refs.topUsage.style.display = 'none';
    this.refs.searchProgressBar.style.display = 'none';
    this.refs.searchProgressBarLabel.innerHTML = '';
    this.refs.searchProgressBarInner.style.width = '0';
  }

  renderLemmaInfo() {
    const text = this.refs.input.value;
    const strongs = text.split(' ')[0];
    const strongsNumber = strongs.substr(1);
    const strongLang = strongs.substr(0, 1);
    const langCode = (strongLang === 'H' ? 'he' : 'el');
    const dir = langCode === 'he' ? 'ltr' : 'rtl';

    fetch(`${this.config.baseContentUrl}content/lexicons/strongs/entries/${strongs}.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        const html = `<div class="lemma-word">
          <span lang="${langCode}" dir="${dir}">${this.escapeHtml(data.lemma)}</span>
          <span class="lemma-strongs" dir="ltr"> [strongs:${strongsNumber}]</span>
        </div>`;

        this.refs.topLemmaInfo.innerHTML = html;
        this.refs.topLemmaInfo.style.display = 'block';
      })
      .catch(() => {});
  }

  renderUsage() {
    const usages = {};
    const usageArray = [];

    this.refs.resultsBlock.querySelectorAll('.search-result-row').forEach((row) => {
      const highlightEl = row.querySelector('.highlight');
      let highlightedPhrase = highlightEl?.textContent ?? '';

      highlightedPhrase = highlightedPhrase.replace(/\b(with|or|and|if|a|the|in|a|by|of|for)\b/gi, '').trim();

      if (typeof usages[highlightedPhrase] === 'undefined') {
        usages[highlightedPhrase] = 0;
      }
      usages[highlightedPhrase]++;
    });

    for (const usage in usages) {
      usageArray.push({ usage, count: usages[usage] });
    }

    usageArray.sort((a, b) => {
      if (a.count < b.count) return 1;
      else if (a.count > b.count) return -1;
      return 0;
    });

    let html = '';
    for (let i = 0, il = usageArray.length; i < il; i++) {
      html += `${i > 0 ? ', ' : ''}${this.escapeHtml(usageArray[i].usage)} (${usageArray[i].count})`;
    }

    this.refs.topUsage.innerHTML = html;
    this.refs.topUsage.style.display = 'block';
  }

  renderResultsVisual(divisionCount, bookList) {
    const totalBooks = bookList.length;
    const width = 1 / totalBooks * 100;
    const baseHeight = 2;
    const maxHeight = 38;
    let html = '';
    let maxCount = 0;

    for (let i = 0, il = bookList.length; i < il; i++) {
      const count = divisionCount[bookList[i]];
      if (count > maxCount) maxCount = count;
    }

    for (let i = 0, il = bookList.length; i < il; i++) {
      const dbsBookCode = bookList[i];
      const count = divisionCount[dbsBookCode];
      const height = maxHeight * count / maxCount + baseHeight;
      const top = maxHeight + baseHeight - height;

      html += `<span class="search-result-book-bar ${dbsBookCode}" data-count="${count}" data-id="${dbsBookCode}" style="width:${width}%;"><span class="divisionid-${dbsBookCode}" style="height:${height}px; margin-top: ${top}px;"></span></span>`;
    }

    this.refs.topVisual.innerHTML = html;
    this.refs.topVisual.appendChild(this.refs.topVisualLabel);
    this.refs.topVisual.style.display = '';
  }

  removeHighlights() {
    document.querySelectorAll('.BibleWindow .highlight').forEach((el) => {
      if (el.tagName.toLowerCase() === 'l') {
        el.className = el.className.replace(/highlight/gi, '');
      } else {
        const textFragment = document.createTextNode(el.textContent);
        if (el?.parentNode) {
          el.parentNode.insertBefore(textFragment, el);
          el.parentNode.removeChild(el);
        }
      }
    });
  }

  createHighlights() {
    if (this.state.currentResults == null) return;

    this.removeHighlights();

    for (let i = 0, il = this.state.currentResults.length; i < il; i++) {
      const result = this.state.currentResults[i];
      const escapedFragmentid = CSS.escape(result.fragmentid);

      document.querySelectorAll(`.${escapedFragmentid}`).forEach((el) => {
        if (this.state.isLemmaSearch) {
          this.highlightLemmaWords(el);
          return;
        }

        for (let j = 0, jl = this.state.searchTermsRegExp.length; j < jl; j++) {
          this.state.searchTermsRegExp[j].lastIndex = 0;
          el.innerHTML = el.innerHTML.replace(this.state.searchTermsRegExp[j], (match) => `<span class="highlight">${match}</span>`);
        }
      });
    }
  }

  setTextInfo(newTextInfo, sendToChooser) {
    this.state.selectedTextInfo = newTextInfo;
    this.refs.textlistui.innerHTML = displayAbbr(newTextInfo);
    this.drawDivisions();

    if (sendToChooser) {
      this.textChooser.setTextInfo(newTextInfo);
    }
  }

  async loadInitialText() {
    const initData = this.initData || {};

    // Default textid from the leftmost Bible window when not provided
    if (!initData.textid) {
      const app = getApp();
      const firstBible = app?.windowManager?.getWindows()?.find(w => w.className === 'BibleWindow');
      const bibleData = firstBible?.getData();
      if (bibleData?.textid) {
        initData.textid = bibleData.textid;
      }
    }

    if (initData.textid) {
      try {
        const data = await getTextAsync(initData.textid);
        this.setTextInfo(data, true);

        if (initData.divisions) {
          this.setDivisions(initData.divisions);
        }

        if (initData.searchtext && initData.searchtext !== '') {
          this.refs.input.value = initData.searchtext;
          this.doSearch();
        } else {
          this.refs.input.focus();
        }
      } catch (err) {
        console.error('Error loading text:', initData.textid, err);
      }
    } else {
      try {
        const texts = await loadTextsAsync();
        if (texts?.length > 0) {
          this.setTextInfo(texts[0], true);
        }
        this.refs.input.focus();
      } catch (err) {
        console.error('Error loading texts:', err);
      }
    }
  }

  size(width, height) {
    this.refs.header.style.width = `${width}px`;
    this.refs.footer.style.width = `${width}px`;
    this.refs.main.style.width = `${width}px`;
    this.refs.main.style.height = `${height - this.refs.header.offsetHeight - this.refs.footer.offsetHeight}px`;
  }

  getData() {
    const otHeader = this.divisionChooser.querySelector('.division-list-ot .division-header input');
    const apHeader = this.divisionChooser.querySelector('.division-list-ap .division-header input');
    const ntHeader = this.divisionChooser.querySelector('.division-list-nt .division-header input');
    const allChecked = (otHeader?.checked !== false) && (apHeader?.checked !== false) && (ntHeader?.checked !== false);

    const divisions = allChecked ? [] : this.getSelectedDivisions();

    return {
      searchtext: this.refs.input.value.trim(),
      textid: this.state.selectedTextInfo?.providerid ?? null,
      divisions,
      params: {
        'win': 'search',
        'textid': this.state.selectedTextInfo?.providerid ?? null,
        'searchtext': this.refs.input.value,
        divisions
      }
    };
  }
}

registerWindowComponent('search-window', SearchWindowComponent, {
  windowType: 'search',
  displayName: 'Search',
  paramKeys: { textid: 't', searchtext: 's' }
});

export { SearchWindowComponent as SearchWindow };
