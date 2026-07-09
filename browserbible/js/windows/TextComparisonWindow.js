/**
 * TextComparisonWindow - Web Component for comparing Bible translations
 */

import { BaseWindow, AsyncHelpers, registerWindowComponent } from './BaseWindow.js';
import { Reference } from '../bible/BibleReference.js';
import { BOOK_DATA } from '../bible/BibleData.js';
import { loadTexts, getText, loadSection, displayAbbr } from '../texts/TextLoader.js';
import { diffWords } from '../lib/SimpleDiff.js';
import { getGlobalTextChooser } from '../ui/TextChooser.js';
import { TextNavigator } from '../ui/TextNavigator.js';

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
    const contentEl = content?.nodeType ? content : content?.[0];
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
    contentEl = content?.nodeType ? content : content?.[0];
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
    // Pilcrows are paragraph formatting, not words; they'd show up as diffs.
    text = text.replace(/¶/g, '');
    plainText += `${text} `;
  }

  // Collapse runs of whitespace left behind by stripped markup; mismatched
  // whitespace tokens would otherwise show up as spurious diffs.
  return plainText.replace(/\s+/g, ' ').trim();
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

    // UI components (the text chooser is a shared global popover, like TextWindow's)
    this.textChooser = getGlobalTextChooser();
    this.textNavigator = TextNavigator();
  }

  async render() {
    this.innerHTML = `
      <div class="window-header">
        <input type="text" class="app-input comparison-nav-input" value="" placeholder="John 3:16" aria-label="Go to passage" />
        <div class="comparison-select-group">
          <div class="app-list comparison-source-title" role="button" aria-label="First version"></div>
          <div class="app-list comparison-target-title" role="button" aria-label="Second version"></div>
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
    this.refs.targetTitle = this.$('.comparison-target-title');
    this.refs.main = this.$('.comparison-main');
    this.refs.header = this.$('.window-header');
    this.refs.footer = this.$('.comparison-footer');
  }

  attachEventListeners() {
    // Text chooser change - bound handler so the global singleton can be unsubscribed
    this._textChooserHandler = this.bindHandler('textChooserChange', (e) => this.handleTextChooserChange(e));
    this.textChooser.on('change', this._textChooserHandler);

    // Clicks on the version buttons open the shared chooser. The popover
    // light-dismisses on the press itself, before click fires, so pointerdown
    // is the last chance to see whether it was open on this anchor.
    for (const anchor of [this.refs.sourceTitle, this.refs.targetTitle]) {
      anchor.addEventListener('pointerdown', () => {
        this._chooserWasOpenHere =
          this.textChooser.isVisible() && this.textChooser.getTarget() === anchor;
      });
      anchor.addEventListener('click', () => this.showChooser(anchor));
    }

    // Click on fragment input
    this.refs.inputFragment.addEventListener('click', () => this.handleFragmentClick());

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
      this.refs.sourceTitle.textContent = displayAbbr(sourceText);
      const sourceLang = sourceText.lang3 || sourceText.lang;
      if (sourceLang) {
        this.state.currentSourceLang3 = sourceLang;
      }
    }

    const targetText = this.state.textInfoData.find(t => t.id === this.state.targetTextId);
    if (targetText) {
      this.refs.targetTitle.textContent = displayAbbr(targetText);
    }
    // Fixes a missing or wrong-language target (e.g. a stale URL param)
    this.updateTargetForNewLanguage();

    // Run initial comparison
    await this.doComparison();
  }

  cleanup() {
    super.cleanup();
    if (this._textChooserHandler) {
      this.textChooser.off('change', this._textChooserHandler);
    }
    const chooserTarget = this.textChooser.getTarget();
    if (chooserTarget === this.refs.sourceTitle || chooserTarget === this.refs.targetTitle) {
      this.textChooser.hide();
    }
    this.textNavigator?.destroy();
  }

  handleTextChooserChange(e) {
    const target = e.data.target?.nodeType ? e.data.target : e.data.target?.[0];
    if (target !== this.refs.sourceTitle && target !== this.refs.targetTitle) return;

    // textInfo is null when a provider can't load the text's details (e.g. an
    // unreachable API); the manifest entry has everything the header needs.
    const textInfo = e.data.textInfo || this.state.textInfoData?.find(t => t.id === e.data.textid);
    if (!textInfo) return;

    if (target === this.refs.sourceTitle) {
      this.handleSourceChange(textInfo);
    } else {
      this.handleTargetChange(textInfo);
    }
  }

  handleTargetChange(textInfo) {
    this.state.targetTextId = textInfo.id;
    this.refs.targetTitle.textContent = displayAbbr(textInfo);
    this.doComparison();
  }

  handleSourceChange(chosenInfo) {
    // The chooser resolves texts via getText(), whose info.json may omit the
    // language fields, so prefer the manifest entry when we have one.
    const textInfo = this.state.textInfoData?.find(t => t.id === chosenInfo.id) || chosenInfo;

    this.state.sourceTextId = textInfo.id;
    this.refs.sourceTitle.textContent = displayAbbr(textInfo);
    this.state.currentSourceLang3 = textInfo.lang3 || textInfo.lang;

    this.updateTargetForNewLanguage();
    this.doComparison();
  }

  showChooser(anchor) {
    if (!this.state.textInfoData) return;

    const isTarget = anchor === this.refs.targetTitle;
    // captured on pointerdown; isVisible() is already false by click time
    const wasOpenHere = this._chooserWasOpenHere;
    this._chooserWasOpenHere = false;

    // Re-set the target every time: the second version is limited to the
    // first version's language, which may have changed since the last open.
    this.textChooser.setTarget(this, anchor, 'bible', isTarget ? this.state.currentSourceLang3 : null);

    const textId = isTarget ? this.state.targetTextId : this.state.sourceTextId;
    const currentTextInfo = this.state.textInfoData.find(t => t.id === textId);
    if (currentTextInfo) {
      this.textChooser.setTextInfo(currentTextInfo);
    }

    if (wasOpenHere) {
      this.textChooser.hide();
    } else {
      this.textChooser.show();
    }
  }

  async handleFragmentClick() {
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

  // Bibles in the same language as the current source
  getComparableTexts() {
    return this.state.textInfoData.filter(t =>
      (t.lang3 === this.state.currentSourceLang3 || t.lang === this.state.currentSourceLang3) &&
      t.hasText !== false &&
      (typeof t.type === 'undefined' || t.type === 'bible')
    );
  }

  // When the source switches language (or the target is unknown), pick a
  // same-language target so the initial comparison is meaningful. The user can
  // still choose any text from the chooser afterwards.
  updateTargetForNewLanguage() {
    if (!this.state.textInfoData || !this.state.currentSourceLang3) return;

    const currentTargetText = this.state.textInfoData.find(t => t.id === this.state.targetTextId);
    const targetLang = currentTargetText ? (currentTargetText.lang3 || currentTargetText.lang) : null;

    if (targetLang === this.state.currentSourceLang3) return;

    const sameLangTexts = this.getComparableTexts();
    const replacement = sameLangTexts.find(t => t.id !== this.state.sourceTextId) || sameLangTexts[0];

    if (replacement) {
      this.state.targetTextId = replacement.id;
      this.refs.targetTitle.textContent = displayAbbr(replacement);
    }
  }

  async loadTextContent(textId, sectionId) {
    try {
      const textInfo = await getTextAsync(textId);
      const content = await loadSectionAsync(textInfo, sectionId);

      // Extract the actual section ID from the loaded content (may differ in padding)
      let contentEl;
      if (typeof content === 'string') {
        const d = document.createElement('div');
        d.innerHTML = content;
        contentEl = d;
      } else {
        contentEl = content?.nodeType ? content : content?.[0];
      }
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
      html += `<th>${displayAbbr(textInfo)}</th>`;
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
    // A comparison is already in flight; re-run when it finishes so a quick
    // second version change isn't silently dropped.
    if (this.state.isLoading) {
      this._rerunComparison = true;
      return;
    }
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
      if (this._rerunComparison) {
        this._rerunComparison = false;
        this.doComparison();
      }
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
