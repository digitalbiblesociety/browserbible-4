/**
 * StatisticsWindow - Web Component for word frequency statistics
 */

import { BaseWindow, AsyncHelpers, registerWindowComponent } from './BaseWindow.js';
import { toElement } from '../lib/helpers.esm.js';
import { Reference } from '../bible/BibleReference.js';
import { i18n } from '../lib/i18n.js';
import { getApp } from '../core/registry.js';
import { getText, loadSection } from '../texts/TextLoader.js';
import WordCloud from 'wordcloud';

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
 * StatisticsWindow Web Component
 * Shows word frequency statistics and word cloud for Bible chapters
 */
export class StatisticsWindowComponent extends BaseWindow {
  constructor() {
    super();

    // Extend state
    this.state = {
      ...this.state,
      textid: '',
      sectionid: '',
      textInfo: null,
      wordStats: [],
      lemmaData: [],
      hasLemma: false,
      currentLemmaIndex: 0
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
    // Message handling
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
    }, 1500);
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
        contentEl = toElement(content);
      }

      const verses = contentEl.querySelectorAll('.verse, .v');
      verses.forEach((verse) => {
        verse.querySelectorAll('.note').forEach((n) => { n.parentNode.removeChild(n); });

        if (verse.querySelectorAll('l').length > 0) {
          this.state.hasLemma = true;

          verse.querySelectorAll('l').forEach((lemma) => {
            const strongs_array = lemma.getAttribute('s').split(' ');

            strongs_array.forEach((strongs) => {
              if (strongs === 'G2532' || strongs === 'G3588' || strongs === 'G846' ||
                  strongs === 'G1722' || strongs === 'G1519' || strongs === 'G1537' ||
                  strongs === 'G1611') {
                return;
              }

              const word_infos = this.state.wordStats.filter((wi) => wi.strongs === strongs);
              const word = lemma.innerHTML;

              if (word_infos.length > 0) {
                const word_info = word_infos[0];
                word_info.count++;
                if (word_info.words.indexOf(word) === -1) {
                  word_info.words.push(word);
                }
              } else {
                this.state.wordStats.push({
                  strongs,
                  word: lemma.innerHTML,
                  words: [word],
                  count: 1
                });
              }
            });
          });
        } else {
          const verse_html = verse.innerHTML;
          let verse_text = verse_html.replace(/<.*?>/gi, '');

          if (this.state.textInfo.lang.indexOf('en') === 0) {
            verse_text = verse_text.replace(/[^(A-Za-z\s)]/gi, '');
          }

          const words = verse_text.split(' ');

          for (let i = 0, il = words.length; i < il; i++) {
            const word = words[i];

            if (word === '' || (exclusions[this.state.textInfo.lang]?.indexOf(word.toLowerCase()) > -1)) {
              continue;
            }

            const word_infos = this.state.wordStats.filter((wi) => wi.word === word || wi.word.toLowerCase() === word.toLowerCase());

            if (word_infos.length > 0) {
              word_infos[0].count++;
            } else {
              this.state.wordStats.push({
                word,
                count: 1
              });
            }
          }
        }
      });

      this.state.wordStats.sort((a, b) => {
        if (a.count > b.count) return -1;
        else if (a.count < b.count) return 1;
        else return 0;
      });

      const max = Math.max(...this.state.wordStats.map((o) => o.count));
      const min = Math.min(...this.state.wordStats.map((o) => o.count));
      const smallestSize = 9;
      const biggestSize = 24;

      const display_words = this.state.wordStats;
      let html = '';
      const wordcloud_data = [];

      for (const i in display_words) {
        const word_info = display_words[i];

        const size = smallestSize + ((biggestSize - smallestSize) * word_info.count / (max - min));
        let displayWord = word_info.words ? word_info.words.join(', ') : word_info.word;
        const wordleWord = word_info.word;

        if (word_info.strongs) {
          displayWord = `<l s="${word_info.strongs}">${displayWord}</l>`;
        }

        html += `<span class="word" style="font-size:${size}px" data-wordindex="${i}"><span dir="${this.state.textInfo.dir}">${displayWord}</span> <span dir="ltr">(${word_info.count})</span></span>`;
        wordcloud_data.push([wordleWord, word_info.count]);
      }

      wordFrequenciesNode.setAttribute('dir', this.state.textInfo.dir);
      wordFrequenciesNode.innerHTML = html;
      wordFrequenciesNode.classList.remove('loading-indicator');

      wordFrequenciesNode.querySelectorAll('.word').forEach((wordEl) => {
        wordEl.addEventListener('mouseout', () => { this.removeHighlights(); }, false);
        wordEl.addEventListener('mouseover', () => {
          const index = parseInt(wordEl.getAttribute('data-wordindex'), 10);
          const word_info = this.state.wordStats[index];
          this.createHighlights(word_info);
        }, false);
      });

      const computedStyle = window.getComputedStyle(this.refs.statsMainNode);
      const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
      const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
      const availableWidth = this.refs.statsMainNode.offsetWidth - paddingLeft - paddingRight;

      const cloudWidth = Math.max(300, availableWidth);
      const cloudHeight = Math.floor(cloudWidth * 3 / 4);

      wordCloudNode.style.width = `${cloudWidth}px`;
      wordCloudNode.style.height = `${cloudHeight}px`;

      if (WordCloud) {
        WordCloud(wordCloudNode, {
          minSize: 5,
          weightFactor: (size) => {
            const sizeMax = Math.min(wordCloudNode.offsetWidth / 7, 80);
            const sizeMin = sizeMax * 0.1;
            const newSize = sizeMin + (Math.abs(sizeMax - sizeMin) * (size - min) / (max - min));
            return newSize;
          },
          list: wordcloud_data,
          hover: (hover_word_info) => {
            this.removeHighlights();

            if (hover_word_info) {
              const word = hover_word_info[0];
              const word_info = this.state.wordStats.filter((a) => a.word === word)[0];
              this.createHighlights(word_info);
            }
          },
          color: (word, size) => {
            const rValue = Math.round(this.getRangeValue(42, 22, min, max, size));
            const gValue = Math.round(this.getRangeValue(133, 71, min, max, size));
            const bValue = Math.round(this.getRangeValue(232, 123, min, max, size));
            return `rgb(${rValue},${gValue},${bValue})`;
          }
        });
      }

      if (this.state.hasLemma) {
        this.loadLemmaInfo();
      }
    } catch (err) {
      console.error('Error loading chapter info', err);
    }
  }

  getRangeValue(value1, value2, minValue, maxValue, value) {
    if (value2 > value1) {
      return value1 + (Math.abs(value1 - value2) * (value - minValue) / (maxValue - minValue));
    } else if (value1 > value2) {
      return value2 + (Math.abs(value1 - value2) * (value - minValue) / (maxValue - minValue));
    } else {
      return value1;
    }
  }

  async loadLemmaInfo() {
    const lemmaNodeWrapper = this.createElement(`<div class="statistics-section statistics-rare-words">
      <h3>Rare Words</h3>
      <div class="statistics-results loading-indicator"></div>
    </div>`);
    this.refs.statsMainNode.appendChild(lemmaNodeWrapper);
    const lemmaNode = lemmaNodeWrapper.querySelector('.statistics-results');

    this.state.currentLemmaIndex = 0;

    await this.getNextLemma();

    this.state.lemmaData.sort((a, b) => {
      if (a.word_info.count > b.word_info.count) return -1;
      else if (a.word_info.count < b.word_info.count) return 1;
      else return 0;
    });

    const rare_words = this.state.lemmaData.filter((lemma) => lemma.frequency <= 5);

    let html = '';
    for (let i = 0, il = rare_words.length; i < il; i++) {
      const lemma = rare_words[i];
      const lemmaLang = lemma.word_info.strongs.substr(0, 1).toUpperCase() === 'G' ? 'gr' : 'he';
      const dir = lemmaLang === 'gr' ? 'ltr' : 'rtl';

      html += `<tr class="rare"><td><l s="${lemma.word_info.strongs}" lang="${lemmaLang}" dir="${dir}">${this.escapeHtml(lemma.lemma)}</td><td>${this.escapeHtml(lemma.word_info.words.join(', '))}</td><td>${lemma.word_info.count} of ${lemma.frequency} in ${lemmaLang === 'gr' ? 'NT' : 'OT'}</td></tr>`;
    }

    lemmaNode.innerHTML = `<table>${html}</table>`;
    lemmaNode.classList.remove('loading-indicator');
  }

  async getNextLemma() {
    if (this.state.currentLemmaIndex >= this.state.wordStats.length) {
      return;
    }

    const word_info = this.state.wordStats[this.state.currentLemmaIndex];

    try {
      const response = await fetch(`${this.config.baseContentUrl}content/lexicons/strongs/entries/${word_info.strongs}.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      data.word_info = word_info;
      this.state.lemmaData.push(data);
    } catch (err) {}

    this.state.currentLemmaIndex++;
    await this.getNextLemma();
  }

  removeHighlights() {
    document.querySelectorAll('.BibleWindow .highlight-stats').forEach((el) => {
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

  createHighlights(word_info) {
    this.removeHighlights();

    document.querySelectorAll(`.${this.state.sectionid}`).forEach((el) => {
      if (typeof word_info.strongs !== 'undefined') {
        el.querySelectorAll(`l[s*="${word_info.strongs.substr(1)}"],l[s*="${word_info.strongs}"]`).forEach((lEl) => {
          lEl.classList.add('highlight', 'highlight-stats', 'lemma-highlight');
        });
      } else {
        const XRegExp = window.XRegExp;
        if (XRegExp) {
          const r = new XRegExp(`\\b${word_info.word}\\b`, 'gi');
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
