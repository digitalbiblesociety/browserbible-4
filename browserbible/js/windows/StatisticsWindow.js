/**
 * StatisticsWindow - Web Component for word frequency statistics
 */

import { BaseWindow, AsyncHelpers, registerWindowComponent } from './BaseWindow.js';
import { Reference } from '../bible/BibleReference.js';
import { i18n } from '../lib/i18n.js';
import { getApp } from '../core/registry.js';
import { getText, loadSection } from '../texts/TextLoader.js';
import { renderWordCloud } from '../lib/SimpleWordCloud.js';
import { escapeRegExp, highlightTextMatches } from '../lib/textHighlighter.js';

// Constants
const INIT_DELAY_MS = 1500;
const FONT_SIZE_MIN = 9;
const FONT_SIZE_MAX = 24;

// Greek stopwords (common articles/prepositions to exclude from statistics)
const GREEK_STOPWORDS = ['G2532', 'G3588', 'G846', 'G1722', 'G1519', 'G1537', 'G1611'];

const getTextAsync = (textId) => AsyncHelpers.promisifyWithError(getText, textId);
const loadSectionAsync = (textInfo, sectionId) => AsyncHelpers.promisifyWithError(loadSection, textInfo, sectionId);

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
class StatisticsWindowComponent extends BaseWindow {
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
      if (!app?.windowManager) return;

      const bibleSettings = app.windowManager.getSettings()
        .find((s) => s?.data?.textid && s?.data?.sectionid);

      if (bibleSettings) {
        this.startProcess(bibleSettings.data.textid, bibleSettings.data.sectionid);
      } else {
        this.refs.statsMainNode.innerHTML =
          '<div class="statistics-empty">Open a Bible window to see statistics for its current chapter.</div>';
      }
    }, INIT_DELAY_MS);
  }

  cleanup() {
    this.removeHighlights();
    super.cleanup();
  }

  handleMessage(e) {
    if (e.data.messagetype === 'nav' && e.data.type === 'bible' && e.data.locationInfo) {
      const { textid, sectionid } = e.data.locationInfo;
      this.startProcess(textid || this.state.textid, sectionid);
    }
  }

  startProcess(tid, sid) {
    if (!tid || !sid) return;

    tid = tid.split(':').pop();

    if (tid === this.state.textid && sid === this.state.sectionid) return;

    this.removeHighlights();
    this._statsEpoch = (this._statsEpoch ?? 0) + 1;

    Object.assign(this.state, {
      textid: tid,
      sectionid: sid,
      textInfo: null,
      wordStats: [],
      lemmaData: [],
      hasLemma: false
    });

    this.refs.main.scrollTop = 0;
    this.refs.statsMainNode.innerHTML = '';
    this.refs.statsMainNode.classList.add('loading-indicator');

    this.loadIntro(this._statsEpoch);
  }

  async loadIntro(epoch) {
    if (!this.state.sectionid || !this.state.textid) return;

    try {
      const data = await getTextAsync(this.state.textid);
      if (epoch !== this._statsEpoch) return;
      this.refs.statsMainNode.classList.remove('loading-indicator');

      if (!data) {
        this.refs.statsMainNode.innerHTML =
          '<div class="statistics-empty">Unable to load this text.</div>';
        return;
      }

      this.state.textInfo = data;

      const bibleReference = Reference(this.state.sectionid);
      if (bibleReference) {
        bibleReference.language = data.lang;
        const headerSpan = this.refs.header.querySelector('span');
        if (headerSpan) {
          headerSpan.innerHTML = `${bibleReference.toString()} (${data.abbr})`;
        }
      }

      this.loadChapterInfo(epoch);
    } catch (err) {
      this.refs.statsMainNode.classList.remove('loading-indicator');
      console.error('Error loading text info', err);
    }
  }

  /**
   * Process a verse containing lemma markup
   */
  processLemmaVerse(verse) {
    verse.querySelectorAll('l[s]').forEach((lemma) => {
      const word = lemma.innerHTML;

      for (const strongs of lemma.getAttribute('s').split(' ')) {
        if (GREEK_STOPWORDS.includes(strongs)) continue;

        const entry = this.state.wordStats.find((wi) => wi.strongs === strongs);
        if (entry) {
          entry.count++;
          if (!entry.words.includes(word)) entry.words.push(word);
        } else {
          this.state.wordStats.push({ strongs, word, words: [word], count: 1 });
        }
      }
    });
  }

  /**
   * Process a verse containing plain text (no lemma markup)
   */
  processTextVerse(verse) {
    const { lang } = this.state.textInfo;
    let verseText = verse.innerHTML.replace(/<.*?>/gi, '');

    if (lang.startsWith('en')) {
      verseText = verseText.replace(/[^A-Za-z\s]/g, '');
    }

    const langExclusions = exclusions[lang];

    for (const word of verseText.split(' ')) {
      if (word === '' || langExclusions?.includes(word.toLowerCase())) continue;

      const entry = this.state.wordStats.find(
        (wi) => wi.word.toLowerCase() === word.toLowerCase()
      );

      if (entry) {
        entry.count++;
      } else {
        this.state.wordStats.push({ word, count: 1 });
      }
    }
  }

  async loadChapterInfo(epoch) {
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
      if (epoch !== this._statsEpoch) {
        resultsNode.remove();
        return;
      }

      let contentEl = content;
      if (typeof content === 'string') {
        contentEl = document.createElement('div');
        contentEl.innerHTML = content;
      } else if (!content?.nodeType) {
        contentEl = content?.[0];
      }

      contentEl.querySelectorAll('.verse, .v').forEach((verse) => {
        verse.querySelectorAll('.note').forEach((n) => n.remove());

        if (verse.querySelector('l[s]')) {
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
      const { dir } = this.state.textInfo;

      const html = this.state.wordStats.map((wordInfo, i) => {
        const size = lerp(FONT_SIZE_MIN, FONT_SIZE_MAX, min, max, wordInfo.count);
        let displayWord = wordInfo.words?.join(', ') ?? wordInfo.word;

        if (wordInfo.strongs) {
          displayWord = `<l s="${wordInfo.strongs}">${displayWord}</l>`;
        }

        return `<span class="word" style="font-size:${size}px" data-wordindex="${i}"><span dir="${dir}">${displayWord}</span> <span dir="ltr">(${wordInfo.count})</span></span>`;
      }).join('');
      const wordcloudData = this.state.wordStats.map((wi) => [wi.word, wi.count]);

      wordFrequenciesNode.setAttribute('dir', dir);
      wordFrequenciesNode.innerHTML = html;
      wordFrequenciesNode.classList.remove('loading-indicator');

      wordFrequenciesNode.querySelectorAll('.word').forEach((wordEl) => {
        wordEl.addEventListener('mouseout', () => this.removeHighlights());
        wordEl.addEventListener('mouseover', () => {
          const index = parseInt(wordEl.getAttribute('data-wordindex'), 10);
          const wordInfo = this.state.wordStats[index];
          this.createHighlights(wordInfo);
        });
      });

      this.renderWordCloud(wordCloudNode, wordcloudData, min, max);

      if (this.state.hasLemma) {
        this.loadLemmaInfo(epoch);
      }
    } catch (err) {
      console.error('Error loading chapter info', err);
      wordFrequenciesNode.classList.remove('loading-indicator');
      wordFrequenciesNode.textContent = 'Unable to load this chapter.';
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
        if (!hoverWordInfo) return;

        const wordInfo = this.state.wordStats.find((wi) => wi.word === hoverWordInfo[0]);
        if (wordInfo) this.createHighlights(wordInfo);
      },
      color: (word, weight) => {
        const rValue = Math.round(lerp(42, 22, min, max, weight));
        const gValue = Math.round(lerp(133, 71, min, max, weight));
        const bValue = Math.round(lerp(232, 123, min, max, weight));
        return `rgb(${rValue},${gValue},${bValue})`;
      }
    });
  }

  async loadLemmaInfo(epoch) {
    const lemmaNodeWrapper = this.createElement(`<div class="statistics-section statistics-rare-words">
      <h3>Rare Words</h3>
      <div class="statistics-results loading-indicator"></div>
    </div>`);
    this.refs.statsMainNode.appendChild(lemmaNodeWrapper);
    const lemmaNode = lemmaNodeWrapper.querySelector('.statistics-results');

    const lemmaData = await this.loadAllLemmas();
    if (epoch !== this._statsEpoch) {
      lemmaNodeWrapper.remove();
      return;
    }

    this.state.lemmaData = lemmaData.sort(byCountDescending);

    const html = this.state.lemmaData
      .filter((lemma) => lemma.frequency <= 5)
      .map((lemma) => {
        const isGreek = lemma.word_info.strongs[0].toUpperCase() === 'G';
        const lang = isGreek ? 'grc' : 'he';
        const dir = isGreek ? 'ltr' : 'rtl';
        const testament = isGreek ? 'NT' : 'OT';

        return `<tr class="rare"><td><l s="${lemma.word_info.strongs}" lang="${lang}" dir="${dir}">${this.escapeHtml(lemma.lemma)}</l></td><td>${this.escapeHtml(lemma.word_info.words.join(', '))}</td><td>${lemma.word_info.count} of ${lemma.frequency} in ${testament}</td></tr>`;
      }).join('');

    lemmaNode.innerHTML = `<table>${html}</table>`;
    lemmaNode.classList.remove('loading-indicator');
  }

  async loadAllLemmas() {
    const results = await Promise.all(this.state.wordStats.map(async (wordInfo) => {
      if (!wordInfo.strongs) return null;
      try {
        const response = await fetch(`${this.config.baseContentUrl}content/lexicons/strongs/entries/${wordInfo.strongs}.json`);
        if (!response.ok) return null;
        const data = await response.json();
        data.word_info = wordInfo;
        return data;
      } catch {
        return null;
      }
    }));

    return results.filter(Boolean);
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
        const target = wordInfo.strongs.toUpperCase();
        const targetNum = target.replace(/^[GH]/, '');
        el.querySelectorAll('l[s]').forEach((lEl) => {
          const matches = lEl.getAttribute('s').toUpperCase().split(/\s+/).some((token) => {
            const bare = token.replace(/[A-Z]$/, '');
            return bare === target || bare.replace(/^[GH]/, '') === targetNum;
          });
          if (matches) {
            lEl.classList.add('highlight', 'highlight-stats', 'lemma-highlight');
          }
        });
      } else {
        const r = new RegExp(`\\b${escapeRegExp(wordInfo.word)}\\b`, 'gi');
        highlightTextMatches(el, [r], 'highlight highlight-stats');
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
