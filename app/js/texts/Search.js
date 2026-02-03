/**
 * Text Search
 * Handles Bible text searching with index support
 */

import { getConfig } from '../core/config.js';
import { EventEmitterMixin } from '../common/EventEmitter.js';
import { BOOK_DATA } from '../bible/BibleData.js';
import { loadSection, getText } from './TextLoader.js';

export const SearchTools = {
  isAsciiRegExp: /^[\x20-\x7E]*$/gi,
  isLemmaRegExp: /[GgHh]\d{1,6}/g,
  HASHSIZE: 20,

  createSearchTerms(searchText, isLemmaSearch) {
    const searchTermsRegExp = [];

    if (isLemmaSearch) {
      const strongNumbers = searchText.split(' ');

      for (const part of strongNumbers) {
        searchTermsRegExp.push(
          new RegExp(`s=("')(\\w\\d{1,4}[a-z]?\\s)?(G|H)?${part.substr(1)}[a-z]?(\\s\\w\\d{1,4}[a-z]?)?("')`, 'gi')
        );
      }
    } else if (searchText.substring(0, 1) === '"' && searchText.substring(searchText.length - 1) === '"') {
      // Check for quoted search "jesus christ"
      let withoutQuotes = searchText.substring(1, searchText.length - 1);
      withoutQuotes = withoutQuotes.replace(/\s/g, '(\\s?(<(.|\\n)*?>)?\\s?)?');

      // Use native RegExp with word boundary
      searchTermsRegExp.push(new RegExp(`\\b(${withoutQuotes})\\b`, 'gi'));
    } else {
      // ASCII characters have predictable word boundaries
      SearchTools.isAsciiRegExp.lastIndex = 0;

      if (SearchTools.isAsciiRegExp.test(searchText)) {
        // For non-quoted searches, use "AND" search
        let andSearchParts = searchText.split(/\s+AND\s+|\s+/gi);

        // Filter for duplicate words
        andSearchParts = andSearchParts.filter((item, index, arr) => arr.indexOf(item) === index);

        for (const part of andSearchParts) {
          searchTermsRegExp.push(new RegExp(`\\b(${part})\\b`, 'gi'));
        }
      } else {
        const words = SearchTools.splitWords(searchText);

        for (const word of words) {
          searchTermsRegExp.push(new RegExp(word, 'gi'));
        }
      }
    }

    return searchTermsRegExp;
  },

  splitWords(input) {
    const removeRegChars = ['\\', '^', '$', '.', '|', '?', '*', '+', '(', ')', '[', ']', '{', '}'];
    const otherRemoveChars = [
      // Roman
      ',', ';', '!', '-', '–', '―', '—', '~', ':', '"', '/', "'s", "'s", "'", "'", "'", '"', '"', '¿', '<', '>', '&',
      // Chinese
      '。', '：', '，', '"', '"', '）', '（', '~', '「', '」'
    ];
    const punctuation = [...removeRegChars, ...otherRemoveChars];
    const innerWordExceptions = ["'", "'", '-'];
    const words = [];
    let word = '';

    const addWord = () => {
      if (word !== '') {
        words.push(word);
      }
      word = '';
    };

    input = String(input);

    input = input.replace(/('s)/gi, '');

    for (let i = 0, il = input.length; i < il; i++) {
      const letter = input.charAt(i);
      const charCode = input.charCodeAt(i);
      const isFirstChar = (i === 0);
      const isLastChar = (i === il - 1);
      const isPunctuation = punctuation.indexOf(letter) > -1;
      const isWhitespace = letter === ' ';
      const isLetter = !(isWhitespace || isPunctuation);

      if (isLetter) {
        word += letter;

        if (((charCode >= 0x4E00) && (charCode <= 0x9FFF)) ||
            ((charCode >= 0x3400) && (charCode <= 0x4DFF)) ||
            ((charCode >= 0x20000) && (charCode <= 0x2A6DF))) {
          addWord();
        }
      } else if (!isFirstChar && !isLastChar &&
                 innerWordExceptions.indexOf(letter) > -1 &&
                 punctuation.indexOf(input[i - 1]) === -1 &&
                 punctuation.indexOf(input[i + 1]) === -1) {
        word += letter;
      } else {
        addWord();
      }
    }

    addWord();

    return words.filter((item, index, arr) => arr.indexOf(item) === index);
  },

  hashWord(word) {
    let hash = 0;
    for (const char of word) {
      hash += char.charCodeAt(0);
      hash %= SearchTools.HASHSIZE;
    }
    return hash;
  }
};

export class SearchIndexLoader {
  constructor() {
    this._events = {};

    const config = getConfig();
    this.baseContentPath = `${config.baseContentUrl}content/texts/`;
    this.isStemEnabled = true;

    this.textInfo = null;
    this.searchTerms = [];
    this.searchTermsIndex = -1;
    this.isLemmaSearch = false;
    this.stemmingData = {};
    this.stemInfo = [];
    this.searchDivisions = [];
    this.loadedIndexes = [];
    this.loadedResults = [];
    this.searchType = 'AND';
  }

  loadIndexes(newTextInfo, divisions, searchText, isLemma) {
    this.isLemmaSearch = isLemma;
    this.textInfo = newTextInfo;
    this.searchDivisions = divisions;

    this.searchTerms = SearchTools.splitWords(searchText);

    this.searchTermsIndex = -1;
    this.loadedIndexes = [];
    this.loadedResults = [];
    this.stemInfo = [];
    this.stemmingData = isLemma ? null : {};

    this.searchType = /\bOR\b/gi.test(searchText) ? 'OR' : 'AND';

    if (this.isStemEnabled && !isLemma) {
      this.loadStemmingData();
    } else {
      this.loadNextIndex();
    }
  }

  loadStemmingData() {
    const stemUrl = `${this.baseContentPath}${this.textInfo.id}/index/stems.json`;

    fetch(stemUrl)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        this.stemmingData = data;
        this.loadNextIndex();
      })
      .catch(() => {
        this.stemmingData = null;
        this.loadNextIndex();
      });
  }

  loadNextIndex() {
    this.searchTermsIndex++;

    if (this.searchTermsIndex < this.searchTerms.length) {
      this.loadSearchTermIndex(this.searchTerms[this.searchTermsIndex]);
    } else {
      this.processIndexes();
    }
  }

  loadSearchTermIndex(searchTerm) {
    let indexUrl = '';
    let key = '';
    let hash = '';
    let stem = '';

    if (this.isLemmaSearch) {
      key = searchTerm.toUpperCase();
      const letter = key.substring(0, 1);
      const firstNumber = searchTerm.length >= 5 ? searchTerm.substring(1, 2) : '0';
      indexUrl = `${this.baseContentPath}${this.textInfo.id}/indexlemma/_${letter.toUpperCase()}${firstNumber}000.json`;
    } else {
      key = searchTerm.toLowerCase();

      if (this.isStemEnabled && this.stemmingData != null) {
        stem = this.stemmingData[key];
        hash = SearchTools.hashWord(stem);
        indexUrl = `${this.baseContentPath}${this.textInfo.id}/index/_stems_${hash}.json`;
      } else {
        hash = SearchTools.hashWord(key);
        indexUrl = `${this.baseContentPath}${this.textInfo.id}/index/_${hash}.json`;
      }
    }

    if (searchTerm === 'undefined') {
      return;
    }

    fetch(indexUrl)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        let fragments = null;

        if (this.isStemEnabled && this.stemmingData != null) {
          fragments = data[stem].fragmentids;
          this.stemInfo.push({
            word: key,
            stem,
            words: data[stem].words
          });
        } else {
          fragments = data[key];
        }

        this.loadedIndexes.push(fragments);
        this.loadNextIndex();
      })
      .catch(() => {
        this.loadNextIndex();
      });
  }

  processIndexes() {
    let fragmentids = [];
    this.loadedResults = [];

    if (this.loadedIndexes.length > 0) {
      if (this.searchType === 'OR') {
        for (const index of this.loadedIndexes) {
          fragmentids = fragmentids.concat(index);
        }

        const textInfo = this.textInfo;
        const splitFragment = (fragmentid) => {
          const parts = fragmentid.split('_');
          const sectionid = parts[0];
          const sectionIndex = textInfo.sections.indexOf(sectionid);
          const fragmentNum = parseInt(parts[1], 10);
          return { sectionid, sectionIndex, fragmentNum };
        };

        fragmentids.sort((a, b) => {
          const fraga = splitFragment(a);
          const fragb = splitFragment(b);

          if (fraga.sectionIndex < fragb.sectionIndex ||
              (fraga.sectionIndex === fragb.sectionIndex && fraga.fragmentNum < fragb.fragmentNum))
            return -1;
          if (fraga.sectionIndex > fragb.sectionIndex ||
              (fraga.sectionIndex === fragb.sectionIndex && fraga.fragmentNum > fragb.fragmentNum))
            return 1;
          return 0;
        });
      } else if (this.searchType === 'AND') {
        const totalIndexes = this.loadedIndexes.length;
        const loadedIndexes = this.loadedIndexes;

        if (totalIndexes === 1) {
          fragmentids = loadedIndexes[0];
        } else if (totalIndexes > 1) {
          fragmentids = loadedIndexes[0].filter(val => {
            let inOtherArrays = true;
            for (let i = 1; i < totalIndexes; i++) {
              if (loadedIndexes[i].indexOf(val) === -1) {
                inOtherArrays = false;
                break;
              }
            }
            return inOtherArrays;
          });
        }
      }

      if (fragmentids) {
        const searchDivisions = this.searchDivisions;

        for (const fragmentid of fragmentids) {
          if (fragmentid !== '' && fragmentid != null) {
            const sectionid = fragmentid.split('_')[0];
            const dbsBookCode = sectionid.substring(0, 2);

            if (searchDivisions.length === 0 || searchDivisions.indexOf(dbsBookCode) > -1) {
              const sectionidInfo = this.loadedResults.filter(val => val.sectionid === sectionid);

              if (sectionidInfo.length === 0) {
                this.loadedResults.push({ sectionid, fragmentids: [fragmentid] });
              } else {
                sectionidInfo[0].fragmentids.push(fragmentid);
              }
            }
          }
        }
      }
    }

    this.trigger('complete', {
      type: 'complete',
      target: this,
      data: {
        loadedIndexes: this.loadedIndexes,
        loadedResults: this.loadedResults,
        fragmentids,
        stemInfo: this.stemInfo
      }
    });
  }
}

Object.assign(SearchIndexLoader.prototype, EventEmitterMixin);

export class TextSearch {
  constructor() {
    this._events = {};

    const config = getConfig();
    this.baseContentPath = `${config.baseContentUrl}content/texts/`;
    this.isLemmaRegExp = /[GgHh]\d{1,6}/g;

    this.isSearching = false;
    this.canceled = false;
    this.searchText = '';
    this.searchTextid = '';
    this.searchDivisions = [];
    this.textInfo = null;
    this.isLemmaSearch = false;
    this.startTime = null;
    this.searchTermsRegExp = [];
    this.searchIndexesData = [];
    this.searchIndexesCurrentIndex = 0;
    this.searchType = 'AND';
    this.searchFinalResults = [];

    this.searchIndexLoader = new SearchIndexLoader();
    this.searchIndexLoader.on('complete', (e) => this.indexesLoaded(e));
  }

  start(textid, divisions, text) {
    if (this.isSearching) {
      return false;
    }
    this.isSearching = true;

    this.searchText = text.trim();
    this.searchTextid = textid;
    this.searchDivisions = divisions;
    this.textInfo = getText(this.searchTextid);

    this.canceled = false;
    this.startTime = new Date();
    this.searchFinalResults = [];
    this.searchTermsRegExp = [];
    this.searchIndexesData = [];
    this.searchIndexesCurrentIndex = 0;
    this.searchType = /\bOR\b/gi.test(text) ? 'OR' : 'AND';

    this.isLemmaRegExp.lastIndex = 0;
    this.isLemmaSearch = this.isLemmaRegExp.test(this.searchText);
    this.searchTermsRegExp = SearchTools.createSearchTerms(text, this.isLemmaSearch);

    const config = getConfig();
    if (config.serverSearchPath !== '' &&
        (window.location.protocol !== 'file:' || config.baseContentUrl !== '')) {
      this.startServerSearch(this.textInfo, this.searchDivisions, this.searchText, this.isLemmaSearch);
    } else {
      this.searchIndexLoader.loadIndexes(this.textInfo, this.searchDivisions, this.searchText, this.isLemmaSearch);
    }

    return true;
  }

  startServerSearch(textInfo, searchDivisions, searchText, isLemmaSearch) {
    const config = getConfig();

    const params = new URLSearchParams({
      textid: textInfo.id,
      search: searchText.toLowerCase(),
      divisions: searchDivisions.join(','),
      date: (new Date()).toString()
    });

    const searchUrl = config.serverSearchPath.startsWith('http')
      ? config.serverSearchPath
      : `${config.baseContentUrl}${config.serverSearchPath}`;

    fetch(`${searchUrl}?${params.toString()}`)
      .then(response => response.json())
      .then(data => {
        if (data?.results) {
          if (data.stem_words?.length > 0) {
            this.searchType = 'OR';
            this.searchTermsRegExp = [];

            for (const word of data.stem_words) {
              this.searchTermsRegExp.push(new RegExp(`\\b(${word})\\b`, 'gi'));
            }
          }

          for (const result of data.results) {
            const fragmentid = Object.keys(result)[0];
            const html = result[fragmentid];

            const matchResult = this.findMatchesInVerse(html);

            if (matchResult.foundMatch) {
              this.searchFinalResults.push({ fragmentid, html: matchResult.html });
            }
          }

          this.trigger('complete', {
            type: 'complete',
            target: this,
            data: {
              results: this.searchFinalResults,
              searchIndexesData: this.searchIndexesData,
              searchTermsRegExp: this.searchTermsRegExp,
              isLemmaSearch: this.isLemmaSearch
            }
          });
        } else {
          this.trigger('complete', {
            type: 'complete',
            target: this,
            data: {
              results: null,
              searchIndexesData: this.searchIndexesData,
              searchTermsRegExp: this.searchTermsRegExp,
              isLemmaSearch: this.isLemmaSearch
            }
          });
        }

        this.isSearching = false;
      })
      .catch(error => {
        console.log('error:serverSearch', error);
        this.isSearching = false;
      });
  }

  indexesLoaded(e) {
    if (!e.data?.loadedIndexes) {
      return;
    }

    if (e.data.loadedIndexes.length === 0) {
      // Brute force - create "index" of all verses
      this.searchIndexesData = [];

      for (const sectionid of this.textInfo.sections) {
        const dbsBookCode = sectionid.substr(0, 2);
        const chapterNumber = parseInt(sectionid.substr(2), 10);
        const sectionData = {
          sectionid,
          fragmentids: []
        };

        if (BOOK_DATA[dbsBookCode]?.chapters) {
          for (let v = 1; v <= BOOK_DATA[dbsBookCode].chapters[chapterNumber - 1]; v++) {
            sectionData.fragmentids.push(`${sectionid}_${v}`);
          }
        }

        this.searchIndexesData.push(sectionData);
      }

      this.loadNextSectionid();
    } else {
      this.trigger('indexcomplete', {
        type: 'indexcomplete',
        target: this,
        data: { searchIndexesData: e.data.loadedResults }
      });

      if (e.data.stemInfo?.length > 0) {
        this.searchType = 'OR';
        this.searchTermsRegExp = [];

        for (const stemInfo of e.data.stemInfo) {
          const stemWords = stemInfo.words;

          for (const word of stemWords) {
            this.searchTermsRegExp.push(new RegExp(`\\b(${word})\\b`, 'gi'));
          }
        }
      }

      this.searchIndexesData = e.data.loadedResults;
      this.searchIndexesCurrentIndex = -1;

      this.loadNextSectionid();
    }
  }

  loadNextSectionid() {
    this.searchIndexesCurrentIndex++;

    if (this.searchIndexesCurrentIndex > this.searchIndexesData.length) {
      this.isSearching = false;
    } else if (this.searchIndexesCurrentIndex === this.searchIndexesData.length) {
      this.trigger('complete', {
        type: 'complete',
        target: this,
        data: {
          results: this.searchFinalResults,
          searchIndexesData: this.searchIndexesData,
          searchTermsRegExp: this.searchTermsRegExp,
          isLemmaSearch: this.isLemmaSearch
        }
      });

      this.isSearching = false;
    } else {
      const sectionData = this.searchIndexesData[this.searchIndexesCurrentIndex];
      const sectionid = sectionData?.sectionid ?? null;
      const fragmentids = sectionData?.fragmentids ?? null;

      if (!sectionData) {
        this.loadNextSectionid();
        return;
      }

      this.trigger('load', {
        type: 'load',
        target: this,
        data: {
          sectionid,
          index: this.searchIndexesCurrentIndex,
          total: this.searchIndexesData.length
        }
      });

      loadSection(this.textInfo, sectionid, (content) => {
        const temp = document.createElement('div');
        temp.innerHTML = content;
        const contentEl = temp;

        for (const fragmentid of fragmentids) {
          const fragmentNodes = contentEl.querySelectorAll(`.${fragmentid}`);

          let html = '';

          fragmentNodes.forEach(el => {
            const clone = el.cloneNode(true);
            clone.querySelectorAll('.note, .cf, .v-num, .verse-num').forEach(note => {
              note.parentNode.removeChild(note);
            });
            html += `${clone.innerHTML} `;
          });

          if (fragmentNodes.length > 0) {
            const result = this.findMatchesInVerse(html);

            if (result.foundMatch) {
              this.searchFinalResults.push({ fragmentid, html: result.html });
            }
          }
        }

        this.loadNextSectionid();
      }, () => {
        this.loadNextSectionid();
      });
    }
  }

  findMatchesInVerse(html) {
    let processedHtml = html;
    let foundMatch = false;
    const regMatches = new Array(this.searchTermsRegExp.length);

    for (let j = 0, jl = this.searchTermsRegExp.length; j < jl; j++) {
      this.searchTermsRegExp[j].lastIndex = 0;

      if (this.isLemmaSearch) {
        processedHtml = processedHtml.replace(this.searchTermsRegExp[j], (match) => {
          regMatches[j] = true;
          foundMatch = true;
          return `${match} class="highlight" `;
        });
      } else {
        processedHtml = processedHtml.replace(this.searchTermsRegExp[j], (match) => {
          regMatches[j] = true;
          foundMatch = true;
          return `<span class="highlight">${match}</span>`;
        });
      }
    }

    if (this.searchType === 'AND') {
      let foundAll = true;
      for (const match of regMatches) {
        if (match !== true) {
          foundAll = false;
          break;
        }
      }
      foundMatch = foundAll;
    }

    return { html: processedHtml, foundMatch };
  }
}

Object.assign(TextSearch.prototype, EventEmitterMixin);

export default { TextSearch, SearchIndexLoader, SearchTools };
