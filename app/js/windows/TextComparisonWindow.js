/**
 * TextComparisonWindow - Web Component for comparing Bible translations
 */

import { BaseWindow, AsyncHelpers, registerWindowComponent } from './BaseWindow.js';
import { Reference } from '../bible/BibleReference.js';
import { BOOK_DATA } from '../bible/BibleData.js';
import { loadTexts, getText, loadSection } from '../texts/TextLoader.js';
import { diffWords } from 'diff';
import { TextChooser } from '../ui/TextChooser.js';
import { TextNavigator } from '../ui/TextNavigator.js';
import { toElement } from '../lib/helpers.esm.js';

const hasTouch = 'ontouchend' in document;


const loadTextsAsync = () => AsyncHelpers.promisify(loadTexts);
const getTextAsync = (textId) => AsyncHelpers.promisify(getText, textId);
const loadSectionAsync = (textInfo, sectionId) => AsyncHelpers.promisify(loadSection, textInfo, sectionId);

/**
 * Check if content has verses for the given section
 */
const hasVerses = (content, sectionId) => {
  const tempDiv = document.createElement('div');

  if (typeof content === 'string') {
    tempDiv.innerHTML = content;
  } else {
    const contentEl = toElement(content);
    if (!contentEl) return false;
    tempDiv.appendChild(contentEl.cloneNode(true));
  }

  return !!(
    tempDiv.querySelector(`.${sectionId}_1`) ||
    tempDiv.querySelector(`.v.${sectionId}_1`) ||
    tempDiv.querySelector(`[class*="${sectionId}_"]`)
  );
};

/**
 * Extract plain text from a verse
 */
const extractPlainText = (content, verseId) => {
  let contentEl;
  if (typeof content === 'string') {
    const temp = document.createElement('div');
    temp.innerHTML = content;
    contentEl = temp;
  } else {
    contentEl = toElement(content);
  }

  const verseNodes = contentEl.querySelectorAll(`.${verseId}`);
  let plainText = '';

  for (const verseNode of verseNodes) {
    const clone = verseNode.cloneNode(true);
    clone.querySelectorAll('.note, .cf, .v-num, .verse-num').forEach(el => {
      el.parentNode.removeChild(el);
    });

    let text = clone.innerHTML;
    text = text.replace(/<[^>]+>/gi, '');
    plainText += `${text} `;
  }

  return plainText.trim();
};

/**
 * Generate HTML showing differences between two texts
 */
const generateDiffHtml = (baseText, comparisonText) => {
  const diff = diffWords(baseText, comparisonText);
  let html = '';

  for (const part of diff) {
    if (part.added) {
      html += `<ins>${part.value}</ins>`;
    } else if (part.removed) {
      html += `<del>${part.value}</del>`;
    } else {
      html += part.value;
    }
  }

  return html;
};

export class TextComparisonWindow extends BaseWindow {
  constructor() {
    super();

    // Extend state
    this.state = {
      ...this.state,
      sourceTextId: null,
      targetTextId: null,
      currentSourceLang3: null,
      textInfoData: null,
      currentReference: null,
      currentSectionId: null
    };

    // UI components
    this.sourceChooser = TextChooser();
    this.textNavigator = TextNavigator();
  }

  async render() {
    this.innerHTML = `
      <div class="window-header">
        <input type="text" class="app-input comparison-nav-input" value="" placeholder="John 3:16" />
        <div class="comparison-select-group">
          <span class="text-list-title comparison-source-title"></span>
          <select class="comparison-target-select"></select>
        </div>
      </div>
      <div class="comparison-main"></div>
      <div class="comparison-footer"></div>
    `;
  }

  cacheRefs() {
    super.cacheRefs();
    this.refs.inputFragment = this.$('.comparison-nav-input');
    this.refs.sourceTitle = this.$('.comparison-source-title');
    this.refs.targetSelect = this.$('.comparison-target-select');
    this.refs.main = this.$('.comparison-main');
    this.refs.header = this.$('.window-header');
    this.refs.footer = this.$('.comparison-footer');
  }

  attachEventListeners() {
    // Target select change
    this.refs.targetSelect.addEventListener('change', () => this.handleTargetChange());

    // Target select focus - restore full names
    this.refs.targetSelect.addEventListener('focus', () => this.handleTargetFocus());

    // Target select blur - show only abbreviation
    this.refs.targetSelect.addEventListener('blur', () => this.updateTargetSelectDisplay());

    // Source chooser change
    this.sourceChooser.on('change', (e) => this.handleSourceChange(e));

    // Click on source title
    this.refs.sourceTitle.addEventListener('click', () => this.showSourceChooser());

    // Click on fragment input
    this.refs.inputFragment.addEventListener('click', (e) => this.handleFragmentClick(e));

    // TextNavigator change
    this.textNavigator.on('change', (e) => this.handleNavigatorChange(e));

    // Enter key in fragment input
    this.refs.inputFragment.addEventListener('keypress', (e) => {
      if (e.keyCode === 13) {
        this.doComparison();
      }
    });
  }

  async init() {
    // Get initial values
    const fragmentid = this.getParam('fragmentid', 'John 3:16');
    this.state.sourceTextId = this.getParam('sourceId', this.config.newComparisonWindowSourceVersion);
    this.state.targetTextId = this.getParam('targetId', this.config.newComparisonWindowTargetVersion);

    this.refs.inputFragment.value = fragmentid;

    // Load texts metadata
    this.state.textInfoData = await loadTextsAsync();

    const sourceText = this.state.textInfoData.find(t => t.id === this.state.sourceTextId);

    if (sourceText) {
      this.refs.sourceTitle.textContent = sourceText.abbr;
      const sourceLang = sourceText.lang3 || sourceText.lang;
      if (sourceLang) {
        this.state.currentSourceLang3 = sourceLang;
      }
    }

    // Populate target select
    this.populateTargetSelect();

    if (this.refs.targetSelect.options.length > 0) {
      this.refs.targetSelect.value = this.state.targetTextId;
    }

    // Run initial comparison
    await this.doComparison();
  }

  cleanup() {
    super.cleanup();
    if (this.textNavigator?.close) this.textNavigator.close();
    if (this.sourceChooser?.close) this.sourceChooser.close();
  }

  handleTargetChange() {
    this.state.targetTextId = this.refs.targetSelect.value;
    this.updateTargetSelectDisplay();
    this.doComparison();
  }

  handleTargetFocus() {
    for (let i = 0; i < this.refs.targetSelect.options.length; i++) {
      const option = this.refs.targetSelect.options[i];
      const abbr = option.getAttribute('data-abbr');
      if (abbr && this.state.textInfoData) {
        const textInfo = this.state.textInfoData.find(t => t.id === option.value);
        if (textInfo) {
          option.textContent = `${textInfo.abbr} - ${textInfo.name}`;
        }
      }
    }
  }

  handleSourceChange(e) {
    const textInfo = e.data.textInfo;
    this.state.sourceTextId = textInfo.id;
    this.refs.sourceTitle.textContent = textInfo.abbr;
    this.state.currentSourceLang3 = textInfo.lang3 || textInfo.lang;

    this.populateTargetSelect();
    this.updateTargetForNewLanguage();
    this.doComparison();
  }

  showSourceChooser() {
    if (this.state.textInfoData && this.state.sourceTextId) {
      const currentTextInfo = this.state.textInfoData.find(t => t.id === this.state.sourceTextId);
      this.sourceChooser.setTarget(this, this.refs.sourceTitle, 'bible');
      if (currentTextInfo) {
        this.sourceChooser.setTextInfo(currentTextInfo);
      }
      this.sourceChooser.show();
    }
  }

  async handleFragmentClick(e) {
    if (hasTouch) {
      this.refs.inputFragment.blur();
    }

    if (this.state.sourceTextId) {
      if (this.textNavigator.getTarget() === this.refs.inputFragment) {
        this.textNavigator.toggle();
      } else {
        const textInfo = await getTextAsync(this.state.sourceTextId);
        this.textNavigator.setTarget(this, this.refs.inputFragment);
        this.textNavigator.setTextInfo(textInfo);
        this.textNavigator.show();
      }
    }
  }

  handleNavigatorChange(e) {
    if (e.data.target !== this.refs.inputFragment) return;

    const sectionid = e.data.sectionid;
    const reference = new Reference(sectionid);
    this.refs.inputFragment.value = reference.toString();
    this.doComparison();
  }

  updateTargetSelectDisplay() {
    const selectedOption = this.refs.targetSelect.options[this.refs.targetSelect.selectedIndex];
    if (selectedOption) {
      const abbr = selectedOption.getAttribute('data-abbr');
      if (abbr) {
        selectedOption.textContent = abbr;
      }
    }
  }

  populateTargetSelect() {
    if (!this.state.textInfoData || !this.state.currentSourceLang3) return;

    this.refs.targetSelect.innerHTML = '';

    const sameLangTexts = this.state.textInfoData.filter(t =>
      (t.lang3 === this.state.currentSourceLang3 || t.lang === this.state.currentSourceLang3) &&
      t.hasText !== false &&
      (typeof t.type === 'undefined' || t.type === 'bible')
    );

    for (const textInfo of sameLangTexts) {
      const option = document.createElement('option');
      option.value = textInfo.id;
      option.textContent = `${textInfo.abbr} - ${textInfo.name}`;
      option.setAttribute('data-abbr', textInfo.abbr);
      if (textInfo.id === this.state.targetTextId) {
        option.selected = true;
      }
      this.refs.targetSelect.appendChild(option);
    }

    this.updateTargetSelectDisplay();
  }

  updateTargetForNewLanguage() {
    if (this.refs.targetSelect.options.length === 0) return;

    const currentTargetText = this.state.textInfoData.find(t => t.id === this.state.targetTextId);
    const targetLang = currentTargetText ? (currentTargetText.lang3 || currentTargetText.lang) : null;

    if (targetLang !== this.state.currentSourceLang3) {
      let foundDifferent = false;
      for (let i = 0; i < this.refs.targetSelect.options.length; i++) {
        if (this.refs.targetSelect.options[i].value !== this.state.sourceTextId) {
          this.state.targetTextId = this.refs.targetSelect.options[i].value;
          this.refs.targetSelect.value = this.state.targetTextId;
          foundDifferent = true;
          break;
        }
      }

      if (!foundDifferent && this.refs.targetSelect.options.length > 0) {
        this.state.targetTextId = this.refs.targetSelect.options[0].value;
        this.refs.targetSelect.value = this.state.targetTextId;
      }
      this.updateTargetSelectDisplay();
    } else {
      this.refs.targetSelect.value = this.state.targetTextId;
      this.updateTargetSelectDisplay();
    }
  }

  async loadTextContent(textId, sectionId) {
    try {
      const textInfo = await getTextAsync(textId);
      const content = await loadSectionAsync(textInfo, sectionId);

      // Extract the actual section ID from the loaded content (may differ in padding)
      const contentEl = typeof content === 'string'
        ? (() => { const d = document.createElement('div'); d.innerHTML = content; return d; })()
        : toElement(content);
      const actualSectionId = contentEl?.querySelector('.section')?.getAttribute('data-id') || sectionId;

      if (!hasVerses(content, actualSectionId)) {
        console.log(`${textInfo.abbr} doesn't contain ${actualSectionId}`);
        return null;
      }

      return { textInfo, content, sectionId: actualSectionId };
    } catch (err) {
      console.error(`Failed to load ${textId}:`, err);
      return null;
    }
  }

  renderComparison(textData) {
    const reference = this.state.currentReference;

    let html = '<table class="comparison-table section"><thead><tr><th></th>';
    for (const { textInfo } of textData) {
      html += `<th>${textInfo.abbr}</th>`;
    }
    html += '</tr></thead><tbody>';

    const startVerse = reference.verse1 > 0 ? reference.verse1 : 1;
    const endVerse = reference.verse2 > 0 ? reference.verse2 : BOOK_DATA[reference.bookid].chapters[reference.chapter1 - 1];

    for (let verse = startVerse; verse <= endVerse; verse++) {
      // Use each text's actual section ID for verse lookup (handles different padding formats)
      const baseVerseId = `${textData[0].sectionId}_${verse}`;
      const baseText = extractPlainText(textData[0].content, baseVerseId);

      html += `<tr><th>${verse}</th>`;
      html += `<td class="reading-text" style="width:${100 / textData.length}%">${baseText}</td>`;

      for (let i = 1; i < textData.length; i++) {
        const compVerseId = `${textData[i].sectionId}_${verse}`;
        const comparisonText = extractPlainText(textData[i].content, compVerseId);
        const diffHtml = generateDiffHtml(baseText, comparisonText);
        html += `<td class="reading-text" style="width:${100 / textData.length}%">${diffHtml}</td>`;
      }

      html += '</tr>';
    }

    html += '</tbody></table>';
    this.refs.main.innerHTML = html;
  }

  async doComparison() {
    if (this.state.isLoading) return;
    if (!this.state.sourceTextId || !this.state.targetTextId) return;

    try {
      this.showLoading();

      const reference = new Reference(this.refs.inputFragment.value);
      if (typeof reference.toSection === 'undefined') {
        this.showError('Invalid Bible reference');
        return;
      }

      this.refs.inputFragment.value = reference.toString();
      this.state.currentReference = reference;
      this.state.currentSectionId = reference.toSection().split('_')[0];

      const results = await Promise.all([
        this.loadTextContent(this.state.sourceTextId, this.state.currentSectionId),
        this.loadTextContent(this.state.targetTextId, this.state.currentSectionId)
      ]);

      const textData = results.filter(r => r !== null);

      if (textData.length === 0) {
        this.showError('No Bibles available for this passage. Please select a different passage or Bible versions.');
        return;
      }

      if (textData.length === 1) {
        this.showError('Only one Bible version available for this passage. Please select another Bible version that contains this book.');
        return;
      }

      this.renderComparison(textData);

      this.trigger('settingschange', {
        type: 'settingschange',
        target: this,
        data: this.getData()
      });
    } catch (err) {
      console.error('Comparison error:', err);
      this.showError('Failed to load passage. Please try again.');
    } finally {
      this.hideLoading();
    }
  }

  size(width, height) {
    this.refs.main.style.width = `${width}px`;
    this.refs.main.style.height = `${height - this.refs.footer.offsetHeight - this.refs.header.offsetHeight}px`;
  }

  getData() {
    return {
      params: {
        win: 'comparison',
        sourceId: this.state.sourceTextId,
        targetId: this.state.targetTextId,
        fragmentid: this.refs.inputFragment.value
      }
    };
  }
}

// Register the web component
registerWindowComponent('text-comparison-window', TextComparisonWindow, {
  windowType: 'comparison',
  displayName: 'Comparison',
  paramKeys: { textids: 't', fragmentid: 'f' }
});

export default TextComparisonWindow;
