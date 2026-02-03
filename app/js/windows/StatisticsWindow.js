/**
 * StatisticsWindow - Web Component for word frequency statistics
 */

import { BaseWindow, AsyncHelpers, registerWindowComponent } from './BaseWindow.js';
import { Reference } from '../bible/BibleReference.js';
import { i18n } from '../lib/i18n.js';
import { getApp } from '../core/registry.js';
import { getText, loadSection } from '../texts/TextLoader.js';
import { renderWordCloud } from '../lib/SimpleWordCloud.js';

// Constants
const INIT_DELAY_MS = 1500;
const FONT_SIZE_MIN = 9;
const FONT_SIZE_MAX = 24;

// Greek stopwords (common articles/prepositions to exclude from statistics)
const GREEK_STOPWORDS = ['G2532', 'G3588', 'G846', 'G1722', 'G1519', 'G1537', 'G1611'];

const getTextAsync = (textId) => AsyncHelpers.promisify(getText, textId);
const loadSectionAsync = (textInfo, sectionId) => AsyncHelpers.promisifyWithError(
  (ti, sid, success, error) => loadSection(ti, sid, success, error),
  textInfo, sectionId
);

const exclusions = {
  "es": ["de"],
  "chs": ["-", ":", ",", "。", "(", ")", "!", ";", "一", "?"],
  "eng": [
    "a", "abaft", "aboard", "about", "above", "absent", "across", "afore", "after",
    "against", "along", "alongside", "amid", "amidst", "among", "amongst", "an",
    "anenst", "apud", "around", "as", "aside", "astride", "at", "athwart", "atop",
    "barring", "before", "behind", "below", "beneath", "beside", "besides", "between",
    "beyond", "but", "by", "circa", "concerning", "despite", "down", "during", "except",
    "excluding", "failing", "following", "for", "forenenst", "from", "given", "in",
    "including", "inside", "into", "lest", "like", "minus", "modulo", "near", "next",
    "notwithstanding", "of", "off", "on", "onto", "opposite", "out", "outside", "over",
    "pace", "past", "per", "plus", "pro", "qua", "regarding", "round", "sans", "save",
    "since", "than", "through", "throughout", "till", "to", "toward", "towards", "under",
    "underneath", "unlike", "until", "unto", "up", "upon", "versus", "via", "with",
    "within", "without", "worth", "the", "him", "his", "he", "she", "it", "her", "hers",
    "and", "yet", "that", "was", "were", "be", "being", "been", "had", "its", "i"
  ]
};

/**
 * Sort comparator for descending count order
 */
const byCountDescending = (a, b) => b.count - a.count;

/**
 * Linear interpolation between two values
 */
function lerp(start, end, min, max, value) {
  if (max === min) return start;
  return start + (end - start) * (value - min) / (max - min);
}

/**
 * StatisticsWindow Web Component
 * Shows word frequency statistics and word cloud for Bible chapters
 */
export class StatisticsWindowComponent extends BaseWindow {
  constructor() {
    super();

    this.state = {
      ...this.state,
      textid: '',
      sectionid: '',
      textInfo: null,
      wordStats: [],
      lemmaData: [],
      hasLemma: false
    };
  }

  async render() {
    this.innerHTML = `
      <div class="window-header">
        <span class="window-title i18n" data-i18n="[html]windows.stats.label"></span>
      </div>
      <div class="window-main">
        <div class="statistics-content loading-indicator"></div>
      </div>
    `;
  }

  cacheRefs() {
    super.cacheRefs();

    this.refs.header = this.$('.window-header');
    this.refs.main = this.$('.window-main');
    this.refs.statsMainNode = this.$('.statistics-content');
  }

  attachEventListeners() {
    this.on('message', (e) => this.handleMessage(e));
  }

  async init() {
    setTimeout(() => {
      const app = getApp();
      if (app?.windowManager) {
        const firstWindowSettings = app.windowManager.getSettings()[0];

        if (firstWindowSettings?.data) {
          const selectedSectionid = firstWindowSettings.data.sectionid;
          const selectedTextid = firstWindowSettings.data.textid;

          this.startProcess(selectedTextid, selectedSectionid);
        }
      }
    }, INIT_DELAY_MS);
  }

  cleanup() {
    this.removeHighlights();
    super.cleanup();
  }

  handleMessage(e) {
    if (e.data.messagetype === 'nav' && e.data.type === 'bible' && e.data.locationInfo) {
      this.startProcess(e.data.locationInfo.textid, e.data.locationInfo.sectionid);
    }
  }

  startProcess(tid, sid) {
    const tparts = tid.split(':');

    if (tparts.length > 1) {
      tid = tparts[tparts.length - 1];
    }

    if (tid === this.state.textid && sid === this.state.sectionid) {
      return;
    }

    this.removeHighlights();

    this.state.sectionid = sid;
    this.state.textid = tid;
    this.state.textInfo = null;
    this.state.wordStats = [];
    this.state.lemmaData = [];
    this.state.hasLemma = false;

    this.refs.main.scrollTop = 0;
    this.refs.statsMainNode.innerHTML = '';
    this.refs.statsMainNode.classList.add('loading-indicator');

    this.loadIntro();
  }

  async loadIntro() {
    if (this.state.sectionid === '' || this.state.textid === '') {
      return;
    }

    try {
      const data = await getTextAsync(this.state.textid);
      this.refs.statsMainNode.classList.remove('loading-indicator');

      this.state.textInfo = data;

      const bibleReference = new Reference(this.state.sectionid);
      bibleReference.lang = this.state.textInfo.lang;

      if (bibleReference.toSection) {
        const headerSpan = this.refs.header.querySelector('span');
        if (headerSpan) {
          headerSpan.innerHTML = `${bibleReference.toString()} (${this.state.textInfo.abbr})`;
        }
      }

      this.loadChapterInfo();
    } catch (err) {
      console.error('Error loading text info', err);
    }
  }

  /**
   * Process a verse containing lemma markup
   */
  processLemmaVerse(verse) {
    verse.querySelectorAll('l').forEach((lemma) => {
      const strongsArray = lemma.getAttribute('s').split(' ');

      for (const strongs of strongsArray) {
        if (GREEK_STOPWORDS.includes(strongs)) {
          continue;
        }

        const word = lemma.innerHTML;
        const existingEntry = this.state.wordStats.find((wi) => wi.strongs === strongs);

        if (existingEntry) {
          existingEntry.count++;
          if (!existingEntry.words.includes(word)) {
            existingEntry.words.push(word);
          }
        } else {
          this.state.wordStats.push({
            strongs,
            word,
            words: [word],
            count: 1
          });
        }
      }
    });
  }

  /**
   * Process a verse containing plain text (no lemma markup)
   */
  processTextVerse(verse) {
    const verseHtml = verse.innerHTML;
    let verseText = verseHtml.replace(/<.*?>/gi, '');

    if (this.state.textInfo.lang.indexOf('en') === 0) {
      verseText = verseText.replace(/[^A-Za-z\s]/g, '');
    }

    const words = verseText.split(' ');
    const langExclusions = exclusions[this.state.textInfo.lang];

    for (const word of words) {
      if (word === '' || langExclusions?.includes(word.toLowerCase())) {
        continue;
      }

      const existingEntry = this.state.wordStats.find(
        (wi) => wi.word === word || wi.word.toLowerCase() === word.toLowerCase()
      );

      if (existingEntry) {
        existingEntry.count++;
      } else {
        this.state.wordStats.push({
          word,
          count: 1
        });
      }
    }
  }

  async loadChapterInfo() {
    const resultsNode = this.createElement(`<div class="statistics-section statistics-frequent-words">
      <h3>${i18n.t('windows.stats.frequentwords')}</h3>
      <div class="statistics-wordcloud"></div>
      <div class="statistics-results loading-indicator"></div>
    </div>`);
    this.refs.statsMainNode.appendChild(resultsNode);

    const wordFrequenciesNode = resultsNode.querySelector('.statistics-results');
    const wordCloudNode = resultsNode.querySelector('.statistics-wordcloud');

    try {
      const content = await loadSectionAsync(this.state.textInfo, this.state.sectionid);

      let contentEl;
      if (typeof content === 'string') {
        const temp = document.createElement('div');
        temp.innerHTML = content;
        contentEl = temp;
      } else {
        contentEl = content?.nodeType ? content : content?.[0];
      }

      const verses = contentEl.querySelectorAll('.verse, .v');
      verses.forEach((verse) => {
        verse.querySelectorAll('.note').forEach((n) => n.remove());

        if (verse.querySelectorAll('l').length > 0) {
          this.state.hasLemma = true;
          this.processLemmaVerse(verse);
        } else {
          this.processTextVerse(verse);
        }
      });

      this.state.wordStats.sort(byCountDescending);

      const counts = this.state.wordStats.map((o) => o.count);
      const max = Math.max(...counts);
      const min = Math.min(...counts);

      const displayWords = this.state.wordStats;
      let html = '';
      const wordcloudData = [];

      for (let i = 0; i < displayWords.length; i++) {
        const wordInfo = displayWords[i];

        const size = lerp(FONT_SIZE_MIN, FONT_SIZE_MAX, min, max, wordInfo.count);
        let displayWord = wordInfo.words ? wordInfo.words.join(', ') : wordInfo.word;
        const wordleWord = wordInfo.word;

        if (wordInfo.strongs) {
          displayWord = `<l s="${wordInfo.strongs}">${displayWord}</l>`;
        }

        html += `<span class="word" style="font-size:${size}px" data-wordindex="${i}"><span dir="${this.state.textInfo.dir}">${displayWord}</span> <span dir="ltr">(${wordInfo.count})</span></span>`;
        wordcloudData.push([wordleWord, wordInfo.count]);
      }

      wordFrequenciesNode.setAttribute('dir', this.state.textInfo.dir);
      wordFrequenciesNode.innerHTML = html;
      wordFrequenciesNode.classList.remove('loading-indicator');

      wordFrequenciesNode.querySelectorAll('.word').forEach((wordEl) => {
        wordEl.addEventListener('mouseout', () => this.removeHighlights(), false);
        wordEl.addEventListener('mouseover', () => {
          const index = parseInt(wordEl.getAttribute('data-wordindex'), 10);
          const wordInfo = this.state.wordStats[index];
          this.createHighlights(wordInfo);
        }, false);
      });

      this.renderWordCloud(wordCloudNode, wordcloudData, min, max);

      if (this.state.hasLemma) {
        this.loadLemmaInfo();
      }
    } catch (err) {
      console.error('Error loading chapter info', err);
    }
  }

  renderWordCloud(wordCloudNode, wordcloudData, min, max) {
    const computedStyle = window.getComputedStyle(this.refs.statsMainNode);
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
    const availableWidth = this.refs.statsMainNode.offsetWidth - paddingLeft - paddingRight;

    const cloudWidth = Math.max(300, availableWidth);
    const cloudHeight = Math.floor(cloudWidth * 3 / 4);

    wordCloudNode.style.width = `${cloudWidth}px`;
    wordCloudNode.style.minHeight = `${cloudHeight}px`;

    const sizeMax = Math.min(cloudWidth / 7, 80);
    const sizeMin = sizeMax * 0.1;

    renderWordCloud(wordCloudNode, {
      minSize: 5,
      weightFactor: (weight) => lerp(sizeMin, sizeMax, min, max, weight),
      list: wordcloudData,
      hover: (hoverWordInfo) => {
        this.removeHighlights();

        if (hoverWordInfo) {
          const word = hoverWordInfo[0];
          const wordInfo = this.state.wordStats.find((a) => a.word === word);
          if (wordInfo) {
            this.createHighlights(wordInfo);
          }
        }
      },
      color: (word, weight) => {
        const rValue = Math.round(lerp(42, 22, min, max, weight));
        const gValue = Math.round(lerp(133, 71, min, max, weight));
        const bValue = Math.round(lerp(232, 123, min, max, weight));
        return `rgb(${rValue},${gValue},${bValue})`;
      }
    });
  }

  async loadLemmaInfo() {
    const lemmaNodeWrapper = this.createElement(`<div class="statistics-section statistics-rare-words">
      <h3>Rare Words</h3>
      <div class="statistics-results loading-indicator"></div>
    </div>`);
    this.refs.statsMainNode.appendChild(lemmaNodeWrapper);
    const lemmaNode = lemmaNodeWrapper.querySelector('.statistics-results');

    await this.loadAllLemmas();

    this.state.lemmaData.sort(byCountDescending);

    const rareWords = this.state.lemmaData.filter((lemma) => lemma.frequency <= 5);

    let html = '';
    for (const lemma of rareWords) {
      const lemmaLang = lemma.word_info.strongs[0].toUpperCase() === 'G' ? 'gr' : 'he';
      const dir = lemmaLang === 'gr' ? 'ltr' : 'rtl';
      const testament = lemmaLang === 'gr' ? 'NT' : 'OT';

      html += `<tr class="rare"><td><l s="${lemma.word_info.strongs}" lang="${lemmaLang}" dir="${dir}">${this.escapeHtml(lemma.lemma)}</td><td>${this.escapeHtml(lemma.word_info.words.join(', '))}</td><td>${lemma.word_info.count} of ${lemma.frequency} in ${testament}</td></tr>`;
    }

    lemmaNode.innerHTML = `<table>${html}</table>`;
    lemmaNode.classList.remove('loading-indicator');
  }

  async loadAllLemmas() {
    for (const wordInfo of this.state.wordStats) {
      try {
        const response = await fetch(`${this.config.baseContentUrl}content/lexicons/strongs/entries/${wordInfo.strongs}.json`);
        if (!response.ok) continue;
        const data = await response.json();
        data.word_info = wordInfo;
        this.state.lemmaData.push(data);
      } catch {
        // Ignore errors loading lexicon entries
      }
    }
  }

  removeHighlights() {
    document.querySelectorAll('.BibleWindow .highlight-stats').forEach((el) => {
      if (el.tagName.toLowerCase() === 'l') {
        el.classList.remove('highlight', 'highlight-stats', 'lemma-highlight');
      } else {
        const textFragment = document.createTextNode(el.textContent);
        el.parentNode?.replaceChild(textFragment, el);
      }
    });
  }

  createHighlights(wordInfo) {
    this.removeHighlights();

    document.querySelectorAll(`.${this.state.sectionid}`).forEach((el) => {
      if (wordInfo.strongs !== undefined) {
        const strongsNum = wordInfo.strongs.substring(1);
        el.querySelectorAll(`l[s*="${strongsNum}"],l[s*="${wordInfo.strongs}"]`).forEach((lEl) => {
          lEl.classList.add('highlight', 'highlight-stats', 'lemma-highlight');
        });
      } else {
        const XRegExp = window.XRegExp;
        if (XRegExp) {
          const r = new XRegExp(`\\b${wordInfo.word}\\b`, 'gi');
          el.innerHTML = el.innerHTML.replace(r, (match) => `<span class="highlight highlight-stats">${match}</span>`);
        }
      }
    });
  }

  size(width, height) {
    this.refs.main.style.height = `${height - this.refs.header.offsetHeight}px`;
    this.refs.main.style.width = `${width}px`;
  }

  getData() {
    return {
      params: {
        'win': 'stats'
      }
    };
  }
}

registerWindowComponent('statistics-window', StatisticsWindowComponent, {
  windowType: 'stats',
  displayName: 'Statistics',
  paramKeys: {}
});

export { StatisticsWindowComponent as StatisticsWindow };

export default StatisticsWindowComponent;
