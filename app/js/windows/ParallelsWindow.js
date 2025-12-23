/**
 * ParallelsWindow - Web Component for showing parallel passages
 */

import { BaseWindow, AsyncHelpers, registerWindowComponent } from './BaseWindow.js';
import { on, closest, toElement } from '../lib/helpers.esm.js';
import { BOOK_DATA } from '../bible/BibleData.js';
import { i18n } from '../lib/i18n.js';
import { getGlobalTextChooser } from '../ui/TextChooser.js';
import { loadSection, getText, loadTexts } from '../texts/TextLoader.js';

const getTextAsync = (textId) => AsyncHelpers.promisify(getText, textId);
const loadTextsAsync = () => AsyncHelpers.promisify(loadTexts);
const loadSectionAsync = (textInfo, sectionId) => AsyncHelpers.promisifyWithError(
  (ti, sid, success, error) => loadSection(ti, sid, success, error),
  textInfo, sectionId
);
const iso2iana = {
  afr: 'af', arz: 'ar', bul: 'bg', cat: 'ca', cym: 'cy', dan: 'da',
  dut: 'nl', eng: 'en', epo: 'eo', est: 'et', fin: 'fi', fra: 'fr',
  fre: 'fr', glg: 'gl', grc: 'el', grk: 'el', heb: 'he', hun: 'hu',
  ice: 'is', ina: 'ia', isl: 'is', ita: 'it', lat: 'la', lit: 'lt',
  mon: 'mn', nld: 'nl', nno: 'nn', nob: 'nb', por: 'pt', rus: 'ru',
  slv: 'sl', spa: 'es', swe: 'sv', tur: 'tr', ukr: 'uk', wel: 'cy'
};
const convertLang = (iso) => iso2iana[iso] ?? iso;

/**
 * ParallelsWindow Web Component
 * Shows parallel passages (e.g., Gospel parallels)
 */
export class ParallelsWindowComponent extends BaseWindow {
  constructor() {
    super();

    // Extend state
    this.state = {
      ...this.state,
      currentTextInfo: null,
      textsInitialized: false,
      parallelsData: null,
      currentParallelData: null,
      currentCells: null,
      currentCellIndex: -1
    };

    this.textChooser = getGlobalTextChooser();
    this.columnFormat = 'inlinetitle';
  }

  async render() {
    this.innerHTML = `
      <div class="parallels-container">
        <div class="window-header parallels-header">
          <div class="scroller-header-inner">
            <div class="parallel-list">
              <select class="header-list app-list"></select>
            </div>
            <div class="header-list app-list text-list"></div>
          </div>
        </div>
        <div class="parallels-main"></div>
      </div>
    `;
  }

  cacheRefs() {
    super.cacheRefs();

    this.refs.container = this.$('.parallels-container');
    this.refs.header = this.$('.parallels-header');
    this.refs.main = this.$('.parallels-main');
    this.refs.textlistui = this.$('.text-list');
    this.refs.parallelsList = this.$('.parallel-list select');
  }

  attachEventListeners() {
    // Parallels list change
    this.addListener(this.refs.parallelsList, 'change', () => this.loadParallelData());

    // Text chooser button
    this.addListener(this.refs.textlistui, 'click', () => this.handleTextListClick());

    // Text chooser change - use bound handler for global singleton
    this._textChooserHandler = this.bindHandler('textChooserChange', (e) => this.handleTextChooserChange(e));
    this.textChooser.on('change', this._textChooserHandler);

    // Delegated click handlers for parallels
    on(this.refs.main, 'click', '.parallel-entry-header', (e) => {
      const headerRow = e.target.closest('.parallel-entry-header');
      this.handleHeaderRowClick(headerRow);
    });

    on(this.refs.main, 'click', '.parallel-show-all', () => this.handleShowAll());
    on(this.refs.main, 'click', '.parallel-hide-all', () => this.handleHideAll());
  }

  async init() {
    this.refs.textlistui.innerHTML = 'Version';

    const initData = this.initData || {};
    if (!initData || Object.keys(initData).length === 0) {
      return;
    }

    if (!initData.textid) {
      initData.textid = this.config.newBibleWindowVersion;
    }

    await Promise.all([
      this.loadParallelsIndex(initData.parallelid),
      this.loadInitialText(initData.textid)
    ]);

    this.startup();
  }

  cleanup() {
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
      this.textChooser.setTarget(this.refs.container, this.refs.textlistui, 'bible');
      this.textChooser.setTextInfo(this.state.currentTextInfo);
      this.textChooser.show();
    }
  }

  handleTextChooserChange(e) {
    if (e.data.target !== this.refs.textlistui) return;

    const newTextInfo = e.data.textInfo;
    this.refs.textlistui.innerHTML = newTextInfo.abbr;

    if (this.state.currentTextInfo === null || newTextInfo.id !== this.state.currentTextInfo.id) {
      this.state.currentTextInfo = newTextInfo;
      this.refs.main.innerHTML = '';
      this.loadParallelData();
    }
  }

  handleHeaderRowClick(headerRow) {
    const textRow = headerRow.nextElementSibling;

    if (textRow?.classList.contains('parallel-entry-text-collapsed')) {
      textRow.classList.remove('parallel-entry-text-collapsed');
      this.state.currentCells = textRow.querySelectorAll('td');
      this.state.currentCellIndex = 0;
      this.loadNextPassage();
    } else if (textRow) {
      textRow.classList.add('parallel-entry-text-collapsed');
    }
  }

  handleShowAll() {
    this.state.currentCells = this.refs.main.querySelectorAll('tr.parallel-entry-text-collapsed td');
    this.state.currentCellIndex = 0;
    this.loadNextPassage();
  }

  handleHideAll() {
    this.refs.main.querySelectorAll('tr.parallel-entry-text').forEach(tr => {
      tr.classList.add('parallel-entry-text-collapsed');
    });
  }

  async loadParallelsIndex(parallelid) {
    try {
      const response = await fetch(`${this.config.baseContentUrl}content/parallels/parallels.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      this.state.parallelsData = data.parallels;

      for (let i = 0, il = this.state.parallelsData.length; i < il; i++) {
        const option = document.createElement('option');
        option.setAttribute('data-id', this.state.parallelsData[i].id);
        option.value = this.state.parallelsData[i].filename;
        option.textContent = this.state.parallelsData[i].title;
        this.refs.parallelsList.appendChild(option);
      }

      if (parallelid) {
        const targetOption = this.refs.parallelsList.querySelector(`option[data-id="${parallelid}"]`);
        if (targetOption) targetOption.selected = true;
      } else {
        const gospelOption = this.refs.parallelsList.querySelector('option[data-id*="gospel"]');
        if (gospelOption) gospelOption.selected = true;
      }
    } catch (err) {
      console.log('Error loading parallels data', err);
    }
  }

  async loadInitialText(textid) {
    try {
      const loadedTextInfo = await getTextAsync(textid);
      this.state.currentTextInfo = loadedTextInfo;
      this.state.textsInitialized = true;

      this.textChooser.setTextInfo(this.state.currentTextInfo);
      this.refs.textlistui.innerHTML = this.state.currentTextInfo.abbr;
    } catch (err) {
      console.log('ERROR loading text', textid);

      try {
        const textInfoData = await loadTextsAsync();
        let newTextInfo = null;
        const lang = textid.toString().split('-')[0].split('_')[0];

        for (let i = 0, il = textInfoData.length; i < il; i++) {
          const textInfo = textInfoData[i];
          if (textInfo.type === 'bible' && (textInfo.lang === lang || textInfo.id.substring(0, lang.length) === lang)) {
            newTextInfo = textInfo;
            break;
          }
        }

        if (newTextInfo === null) {
          newTextInfo = textInfoData[0];
        }

        const loadedTextInfo = await getTextAsync(newTextInfo.id);
        this.state.currentTextInfo = loadedTextInfo;
        this.state.textsInitialized = true;

        this.textChooser.setTextInfo(this.state.currentTextInfo);
        this.refs.textlistui.innerHTML = this.state.currentTextInfo.abbr;
      } catch (fallbackErr) {
        console.error('Error loading fallback text', fallbackErr);
      }
    }
  }

  startup() {
    if (this.state.textsInitialized && this.state.parallelsData !== null) {
      this.loadParallelData();
    }
  }

  async loadParallelData() {
    this.refs.main.innerHTML = '';
    this.state.currentParallelData = null;
    this.state.currentCells = null;
    this.state.currentCellIndex = -1;

    try {
      const response = await fetch(`${this.config.baseContentUrl}content/parallels/${this.refs.parallelsList.value}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      this.state.currentParallelData = data;
      this.createParallel();
    } catch (err) {
      console.log('error loading parallel data', err);
    }
  }

  createParallel() {
    const html = [];

    html.push(`<h1>${this.escapeHtml(this.state.currentParallelData.title)}</h1>`);
    html.push(`<p class="parallel-description">${this.escapeHtml(this.state.currentParallelData.description)}</p>`);

    html.push('<div class="parallels-buttons">');
    html.push(`<span class="parallel-show-all">${i18n.t('windows.parallel.showall')}</span>`);
    html.push(`<span class="parallel-hide-all">${i18n.t('windows.parallel.hideall')}</span>`);
    html.push('</div>');

    const dir = this.state.currentTextInfo?.dir ?? 'ltr';
    html.push(`<table dir="${dir}">`);

    if (this.columnFormat === 'inlinetitle') {
      const style = ` style="width: ${100 / (this.state.currentParallelData.books.length + 1)}%"`;

      html.push('<tbody>');
      for (let i = 0, il = this.state.currentParallelData.parallels.length; i < il; i++) {
        const row = this.state.currentParallelData.parallels[i];

        if (typeof row.sectionTitle !== 'undefined') {
          html.push(`<tr><th class="section-title" colspan="${this.state.currentParallelData.books.length + 1}">${this.escapeHtml(row.sectionTitle)}</th></tr>`);
        } else {
          html.push(`<tr class="parallel-entry-header"><th class="parallel-title" ${style}>${this.escapeHtml(row.title)}</th>`);

          for (let j = 0, jl = row.passages.length; j < jl; j++) {
            const passage = row.passages[j];

            if (passage === null) {
              html.push(`<td class="parallel-passage" ${style}>-</td>`);
            } else {
              const books = row.books ?? this.state.currentParallelData.books;
              const lang = convertLang(this.state.currentTextInfo.lang);
              const bookName = BOOK_DATA[books[j]].names[this.state.currentTextInfo.lang][0];

              html.push(`<td class="parallel-passage" ${style} lang="${lang}">${this.escapeHtml(bookName)} ${this.escapeHtml(passage)}</td>`);
            }
          }

          html.push('</tr>');

          html.push('<tr class="parallel-entry-text parallel-entry-text-collapsed">');
          html.push('<th></th>');

          for (let j = 0, jl = row.passages.length; j < jl; j++) {
            const passage = row.passages[j];

            if (passage === null) {
              html.push('<td></td>');
            } else {
              const books = row.books ?? this.state.currentParallelData.books;
              const lang = convertLang(this.state.currentTextInfo.lang);

              html.push(`<td class="reading-text" data-bookid="${books[j]}" data-passage="${passage}" lang="${lang}"></td>`);
            }
          }

          html.push('</tr>');
        }
      }
      html.push('</tbody>');
    }

    html.push('</table>');

    this.refs.main.innerHTML = html.join('');
  }

  loadNextPassage() {
    if (this.state.currentCellIndex < this.state.currentCells.length) {
      const cell = this.state.currentCells[this.state.currentCellIndex];

      this.processCell(cell, () => {
        this.state.currentCellIndex++;
        this.loadNextPassage();
      });
    }
  }

  async processCell(cell, callback) {
    closest(cell, 'tr')?.classList.remove('parallel-entry-text-collapsed');

    if (cell.classList.contains('parallel-text-loaded')) {
      callback?.();
      return;
    }

    const bookid = cell.getAttribute('data-bookid');
    const passage = cell.getAttribute('data-passage');

    if (bookid && passage) {
      const sectionid = bookid + passage.split(':')[0];
      const verseParts = passage.split(':')[1];
      const verseRanges = verseParts.split(',');
      const fragmentids = [];

      for (let i = 0, il = verseRanges.length; i < il; i++) {
        const verseRange = verseRanges[i].split('-');

        if (verseRange.length === 1) {
          fragmentids.push(`${sectionid}_${verseRange[0].trim()}`);
        } else if (verseRange.length === 2) {
          const start = parseInt(verseRange[0], 10);
          const end = parseInt(verseRange[1], 10);

          for (let verse = start; verse <= end; verse++) {
            fragmentids.push(`${sectionid}_${verse}`);
          }
        }
      }

      try {
        const content = await loadSectionAsync(this.state.currentTextInfo, sectionid);

        let contentEl;
        if (typeof content === 'string') {
          const temp = document.createElement('div');
          temp.innerHTML = content;
          contentEl = temp;
        } else {
          contentEl = toElement(content);
        }

        contentEl.querySelectorAll('.cf,.note').forEach(el => {
          el.parentNode.removeChild(el);
        });

        cell.innerHTML = '';

        for (let i = 0, il = fragmentids.length; i < il; i++) {
          const fragmentid = fragmentids[i];
          const verseNode = contentEl.querySelector(`.v[data-id="${fragmentid}"]`);

          if (verseNode) {
            const prevEl = verseNode.previousElementSibling;
            if (prevEl?.classList.contains('v-num')) {
              cell.appendChild(prevEl.cloneNode(true));
            }
            cell.appendChild(verseNode.cloneNode(true));
          }
        }

        cell.classList.add('parallel-text-loaded');
        callback?.();
      } catch (err) {
        callback?.();
      }
    } else {
      callback?.();
    }
  }

  size(width, height) {
    this.refs.container.style.width = `${width}px`;
    this.refs.container.style.height = `${height}px`;

    const headerHeight = this.refs.header.offsetHeight;
    this.refs.main.style.width = `${width}px`;
    this.refs.main.style.height = `${height - headerHeight}px`;

    this.textChooser.size(width, height);
  }

  getData() {
    const selectedOption = this.refs.parallelsList.querySelector('option:checked');

    return {
      textid: this.state.currentTextInfo?.providerid ?? '',
      parallelid: selectedOption?.getAttribute('data-id') ?? '',
      label: 'Parallel',
      labelLong: 'Parallel',
      params: {
        win: 'parallel',
        textid: this.state.currentTextInfo?.providerid ?? '',
        parallelid: selectedOption?.getAttribute('data-id') ?? ''
      }
    };
  }
}

registerWindowComponent('parallels-window', ParallelsWindowComponent, {
  windowType: 'parallel',
  displayName: 'Parallels',
  paramKeys: { textid: 't', parallelid: 'p' }
});

export { ParallelsWindowComponent as ParallelsWindow };

export default ParallelsWindowComponent;
