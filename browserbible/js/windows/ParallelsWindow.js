/**
 * ParallelsWindow - Web Component for showing parallel passages
 */

import { BaseWindow, AsyncHelpers, registerWindowComponent } from './BaseWindow.js';
import { BOOK_DATA } from '../bible/BibleData.js';
import { i18n } from '../lib/i18n.js';
import { toBcp47Lang } from '../lib/bcp47.js';
import { getGlobalTextChooser } from '../ui/TextChooser.js';
import { loadSection, getText, loadTexts } from '../texts/TextLoader.js';

const getTextAsync = (textId) => AsyncHelpers.promisify(getText, textId);
const loadTextsAsync = () => AsyncHelpers.promisify(loadTexts);
const loadSectionAsync = (textInfo, sectionId) => AsyncHelpers.promisifyWithError(
  (ti, sid, success, error) => loadSection(ti, sid, success, error),
  textInfo, sectionId
);

/**
 * Localized book name for the current text: the text's own division names win,
 * then BOOK_DATA names for the text's language, then English, then the code.
 */
export function getBookName(textInfo, bookid) {
  const divIndex = textInfo?.divisions?.indexOf(bookid) ?? -1;
  const divName = divIndex >= 0 ? textInfo?.divisionNames?.[divIndex] : null;
  if (divName) return Array.isArray(divName) ? divName[0] : divName;

  const names = BOOK_DATA[bookid]?.names ?? {};
  const langNames = names[textInfo?.lang] ?? names.eng ?? [];
  const first = langNames[0];
  const name = Array.isArray(first) ? first[0] : first;
  return name ?? bookid;
}

/**
 * Parse a passage reference into section loads. Handles the formats found in
 * the parallels data: "1:3", "2:2-3", "1:1-12, 14-17", "8:28-34; 9:1",
 * cross-chapter ranges "8:32-9:9" / "15:39- 16:12", and bare chapters "13".
 *
 * @returns {Array<{sectionid: string, fragmentids: string[]}>} one entry per
 *   chapter section, in reading order
 */
export function parsePassageReference(passage, bookid) {
  const chapterCounts = BOOK_DATA[bookid]?.chapters ?? [];
  const versesIn = (ch) => chapterCounts[ch - 1] ?? 200;
  const refs = [];
  let chapter = null;

  const pushRange = (startCh, startV, endCh, endV) => {
    let c = startCh;
    let v = startV;
    while ((c < endCh || (c === endCh && v <= endV)) && refs.length < 2000) {
      refs.push({ chapter: c, verse: v });
      v++;
      if (c < endCh && v > versesIn(c)) {
        c++;
        v = 1;
      }
    }
  };

  for (const rawSegment of String(passage).split(';')) {
    const segment = rawSegment.trim();
    if (!segment) continue;

    let list = segment;
    const chapterMatch = segment.match(/^(\d+)\s*:\s*(.*)$/);
    if (chapterMatch) {
      chapter = parseInt(chapterMatch[1], 10);
      list = chapterMatch[2];
    } else if (/^\d+$/.test(segment)) {
      // bare chapter reference
      chapter = parseInt(segment, 10);
      pushRange(chapter, 1, chapter, versesIn(chapter));
      continue;
    }
    if (chapter === null) continue;

    for (const rawItem of list.split(',')) {
      const item = rawItem.trim();
      if (!item) continue;
      const m = item.match(/^(\d+)(?:\s*-\s*(?:(\d+)\s*:\s*)?(\d+)[ab]?)?$/);
      if (!m) continue;

      const startVerse = parseInt(m[1], 10);
      if (!m[3]) {
        refs.push({ chapter, verse: startVerse });
        continue;
      }
      const endChapter = m[2] ? parseInt(m[2], 10) : chapter;
      pushRange(chapter, startVerse, endChapter, parseInt(m[3], 10));
      chapter = endChapter;
    }
  }

  const groups = [];
  for (const ref of refs) {
    const sectionid = `${bookid}${ref.chapter}`;
    const last = groups[groups.length - 1];
    const fragmentid = `${sectionid}_${ref.verse}`;
    if (last?.sectionid === sectionid) {
      last.fragmentids.push(fragmentid);
    } else {
      groups.push({ sectionid, fragmentids: [fragmentid] });
    }
  }
  return groups;
}

class ParallelsWindowComponent extends BaseWindow {
  constructor() {
    super();

    // Extend state
    this.state = {
      ...this.state,
      currentTextInfo: null,
      textsInitialized: false,
      parallelsData: null,
      currentParallelData: null
    };

    this.textChooser = getGlobalTextChooser();
    this.columnFormat = 'inlinetitle';
    // bumped whenever the parallel set or version changes, so in-flight
    // passage loads for the previous table know to stop
    this._loadGeneration = 0;
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
    this.refs.main.addEventListener('click', (e) => {
      const headerRow = e.target.closest('.parallel-entry-header');
      if (headerRow) {
        this.handleHeaderRowClick(headerRow);
      }
    });

    this.refs.main.addEventListener('click', (e) => {
      const target = e.target.closest('.parallel-show-all');
      if (target) this.handleShowAll();
    });

    this.refs.main.addEventListener('click', (e) => {
      const target = e.target.closest('.parallel-hide-all');
      if (target) this.handleHideAll();
    });
  }

  async init() {
    this.refs.textlistui.innerHTML = 'Version';

    // A window added from the menu arrives with empty initData; fall back to
    // defaults so the first open isn't a blank pane.
    const initData = this.initData || {};

    await Promise.all([
      this.loadParallelsIndex(initData.parallelid),
      this.loadInitialText(initData.textid || this.config.newBibleWindowVersion)
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
    if (!newTextInfo) return;

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
      this.loadCells(textRow.querySelectorAll('td'));
    } else if (textRow) {
      textRow.classList.add('parallel-entry-text-collapsed');
    }
  }

  handleShowAll() {
    this.loadCells(this.refs.main.querySelectorAll('tr.parallel-entry-text-collapsed td'));
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
      console.error('Error loading parallels data', err);
      this.showError('Failed to load parallels list', err);
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
      console.error('Error loading text', textid, err);

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
        this.showError('Failed to load Bible text', fallbackErr);
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
    const generation = ++this._loadGeneration;

    if (!this.refs.parallelsList.value) return;

    try {
      const response = await fetch(`${this.config.baseContentUrl}content/parallels/${this.refs.parallelsList.value}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      if (generation !== this._loadGeneration) return;

      this.state.currentParallelData = data;
      this.createParallel();
    } catch (err) {
      if (generation !== this._loadGeneration) return;
      console.error('Error loading parallel data', err);
      this.showError('Failed to load parallel passages', err);
    }
  }

  createParallelHeader(title, description) {
    // description is bundled app content and may contain markup (links)
    return [
      `<h1>${this.escapeHtml(title)}</h1>`,
      `<p class="parallel-description">${description ?? ''}</p>`,
      '<div class="parallels-buttons">',
      `<button type="button" class="parallel-show-all">${i18n.t('windows.parallel.showall')}</button>`,
      `<button type="button" class="parallel-hide-all">${i18n.t('windows.parallel.hideall')}</button>`,
      '</div>'
    ];
  }

  createSectionTitleRow(sectionTitle, colspan) {
    return `<tr><th class="section-title" colspan="${colspan}">${this.escapeHtml(sectionTitle)}</th></tr>`;
  }

  createPassageCells(row, style) {
    const cells = [];
    const books = row.books ?? this.state.currentParallelData.books;
    const lang = toBcp47Lang(this.state.currentTextInfo?.lang) ?? '';

    for (let j = 0, jl = row.passages.length; j < jl; j++) {
      const passage = row.passages[j];

      if (passage === null) {
        cells.push(`<td class="parallel-passage" ${style}>-</td>`);
      } else {
        const bookName = getBookName(this.state.currentTextInfo, books[j]);
        cells.push(`<td class="parallel-passage" ${style} lang="${lang}">${this.escapeHtml(bookName)} ${this.escapeHtml(passage)}</td>`);
      }
    }

    return cells;
  }

  createTextCells(row) {
    const cells = [];
    const books = row.books ?? this.state.currentParallelData.books;
    const lang = toBcp47Lang(this.state.currentTextInfo?.lang) ?? '';

    for (let j = 0, jl = row.passages.length; j < jl; j++) {
      const passage = row.passages[j];

      if (passage === null) {
        cells.push('<td></td>');
      } else {
        cells.push(`<td class="reading-text" data-bookid="${this.escapeHtml(books[j])}" data-passage="${this.escapeHtml(passage)}" lang="${lang}"></td>`);
      }
    }

    return cells;
  }

  createInlineTitleRows(parallels, style) {
    const rows = [];

    for (let i = 0, il = parallels.length; i < il; i++) {
      const row = parallels[i];

      if (typeof row.sectionTitle !== 'undefined') {
        rows.push(this.createSectionTitleRow(row.sectionTitle, this.state.currentParallelData.books.length + 1));
      } else {
        rows.push(`<tr class="parallel-entry-header"><th class="parallel-title" ${style}>${this.escapeHtml(row.title)}</th>`);
        rows.push(...this.createPassageCells(row, style));
        rows.push('</tr>');

        rows.push('<tr class="parallel-entry-text parallel-entry-text-collapsed">');
        rows.push('<th></th>');
        rows.push(...this.createTextCells(row));
        rows.push('</tr>');
      }
    }

    return rows;
  }

  createParallel() {
    const html = [];
    const dir = this.state.currentTextInfo?.dir ?? 'ltr';

    html.push(...this.createParallelHeader(
      this.state.currentParallelData.title,
      this.state.currentParallelData.description
    ));

    html.push(`<table dir="${dir}">`);

    if (this.columnFormat === 'inlinetitle') {
      const style = ` style="width: ${100 / (this.state.currentParallelData.books.length + 1)}%"`;
      html.push('<tbody>');
      html.push(...this.createInlineTitleRows(this.state.currentParallelData.parallels, style));
      html.push('</tbody>');
    }

    html.push('</table>');

    this.refs.main.innerHTML = html.join('');
  }

  async loadCells(cells) {
    const generation = this._loadGeneration;

    for (const cell of cells) {
      if (generation !== this._loadGeneration) return;
      await this.processCell(cell, generation);
    }
  }

  prepareContentElement(content) {
    let contentEl;
    if (typeof content === 'string') {
      const temp = document.createElement('div');
      temp.innerHTML = content;
      contentEl = temp;
    } else {
      contentEl = content;
    }

    contentEl.querySelectorAll('.cf,.note').forEach(el => {
      el.parentNode.removeChild(el);
    });

    return contentEl;
  }

  appendVerseNodes(cell, contentEl, fragmentids) {
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
  }

  async processCell(cell, generation) {
    cell.closest('tr')?.classList.remove('parallel-entry-text-collapsed');

    if (cell.classList.contains('parallel-text-loaded')) return;

    const bookid = cell.getAttribute('data-bookid');
    const passage = cell.getAttribute('data-passage');

    if (!bookid || !passage) return;

    const groups = parsePassageReference(passage, bookid);
    cell.innerHTML = '';

    let hadError = false;
    for (const { sectionid, fragmentids } of groups) {
      try {
        const content = await loadSectionAsync(this.state.currentTextInfo, sectionid);

        // the table may have been rebuilt while this section was in flight
        if (generation !== this._loadGeneration || !cell.isConnected) return;

        this.appendVerseNodes(cell, this.prepareContentElement(content), fragmentids);
      } catch (err) {
        // section not available in this text (e.g. NT-only Bibles); leave the cell empty
        hadError = true;
      }
    }

    if (!hadError || cell.childNodes.length > 0) {
      cell.classList.add('parallel-text-loaded');
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
