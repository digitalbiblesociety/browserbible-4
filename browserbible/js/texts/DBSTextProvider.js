/**
 * DBS Text Provider
 * Loads Bible texts from Digital Bible Society API
 */

import { getConfig } from '../core/config.js';
import { processTexts } from './TextLoader.js';
import { SearchTools } from './Search.js';
import { BOOK_DATA, DEFAULT_BIBLE, DEFAULT_BIBLE_USFM, APOCRYPHAL_BIBLE, APOCRYPHAL_BIBLE_USFM } from '../bible/BibleData.js';

const providerName = 'dbs';
const fullName = 'Digital Bible Society';

let text_data = [];
let text_data_is_loaded = false;
let text_data_is_loading = false;
let text_data_callbacks = [];

const finish = () => {
  text_data_is_loading = false;
  text_data_is_loaded = true;

  while (text_data_callbacks.length > 0) {
    const cb = text_data_callbacks.pop();
    cb(text_data);
  }
};

const getProviderid = (textid) => {
  const parts = textid.split(':');
  const fullid = `${providerName}:${parts.length > 1 ? parts[1] : parts[0]}`;
  return fullid;
};

export function getTextManifest(callback) {
  const config = getConfig();

  if (!config.enableOnlineSources || !config.dbsEnabled || config.dbsKey === '') {
    callback(null);
    return;
  }

  if (text_data_is_loaded) {
    callback(text_data);
    return;
  }

  text_data_callbacks.push(callback);

  if (text_data_is_loading) {
    return;
  }

  text_data_is_loading = true;

  fetch(`${config.dbsBase}bibles?v=4&key=${config.dbsKey}`)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      if (data === null || data?.data === null) {
        finish();
        return;
      }

      text_data = [];
      for (const id in data.data) {
        const dbs = data.data[id];

        // skip not in include list
        if (config.dbsIncludeList.length > 0 && !config.dbsIncludeList.includes(dbs.abbr)) {
          continue;
        }

        if (config.dbsExcludeList.length > 0 && config.dbsExcludeList.includes(dbs.abbr)) {
          continue;
        }

        if (dbs.name !== null) {
          const sofiabible = {
            type: 'bible',
            id: dbs.abbr,
            name: dbs.name,
            nameEnglish: dbs.vname,
            abbr: dbs.abbr,
            lang: dbs.iso,
            langName: dbs.language,
            langNameEnglish: dbs.language,
            dbs
          };
          text_data.push(sofiabible);
        }
      }

      processTexts(text_data, providerName);
      finish();
    })
    .catch(_error => {
      text_data = null;
      finish();
    });
}

const getTextInfoSync = (textid) => {
  const providerid = getProviderid(textid);

  const info = text_data.filter(text => text.providerid === providerid)[0];

  return info;
};

export function getTextInfo(textid, callback) {
  const config = getConfig();

  if (!text_data_is_loaded) {
    getTextManifest(() => {
      getTextInfo(textid, callback);
    });
    return;
  }

  const providerid = getProviderid(textid);

  const info = text_data.filter(text => text.providerid === providerid)[0];

  if (typeof info?.divisions === 'undefined' || info.divisions.length === 0) {
    fetch(`${config.dbsBase}bibles/${info.id}?v=4&key=${config.dbsKey}`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        info.divisions = [];
        info.sections = [];
        info.divisionNames = [];

        for (const bookinfo of data.data.books) {
          const usfmCode = bookinfo.book_id;
          const bookIndex = APOCRYPHAL_BIBLE_USFM.indexOf(usfmCode);
          const dbsCode = APOCRYPHAL_BIBLE[bookIndex];

          if (typeof dbsCode === 'undefined') {
            console.warn(bookinfo, usfmCode);
          }

          info.divisions.push(dbsCode);
          info.divisionNames.push(bookinfo.name);

          for (let j = 0, jl = bookinfo.chapters.length; j < jl; j++) {
            info.sections.push(`${dbsCode}${j + 1}`);
          }
        }

        callback(info);
      })
      .catch(_error => {
        callback(null);
      });
  } else {
    callback(info);
  }
}

const loadSectionText = (textid, sectionid, callback) => {
  const config = getConfig();

  const textinfo = getTextInfoSync(textid);
  const lang = textinfo.lang;
  const dir = textinfo.dir ?? 'ltr';
  const bookid = sectionid.substring(0, 2);
  const usfm = BOOK_DATA[bookid].usfm;
  const chapterNum = sectionid.substring(2);
  const sectionIndex = textinfo.sections.indexOf(sectionid);
  const previd = sectionIndex > 0 ? textinfo.sections[sectionIndex - 1] : null;
  const nextid = sectionIndex < textinfo.sections.length ? textinfo.sections[sectionIndex + 1] : null;

  fetch(`${config.dbsBase}bibles/filesets/${textinfo.id}/${usfm}/${chapterNum}?v=4&key=${config.dbsKey}`)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      const html = [];

      html.push(`<div class="section chapter ${textid} ${bookid} ${sectionid} ${lang} " ` +
        ` data-textid="${textid}"` +
        ` data-id="${sectionid}"` +
        ` data-nextid="${nextid}"` +
        ` data-previd="${previd}"` +
        ` lang="${lang}"` +
        ` data-lang3="${lang}"` +
        ` dir="${dir}"` +
        `>`);

      if (chapterNum === '1') {
        html.push(`<div class="mt">${textinfo.divisionNames[textinfo.divisions.indexOf(bookid)]}</div>`);
      }

      html.push(`<div class="c">${chapterNum}</div>`);
      html.push('<div class="p">');

      for (const verse of data.data) {
        const text = verse.verse_text;
        const vnum = verse.verse_start;
        const vid = `${sectionid}_${vnum}`;

        html.push(` <span class="v-num v-${vnum}">${vnum}</span><span class="v ${vid}" data-id="${vid}">${text}</span>`);
      }

      html.push('</div>');
      html.push('</div>');

      callback(html.join(''));
    })
    .catch(_error => {
      callback(null);
    });
};

export function loadSection(textid, sectionid, callback) {
  loadSectionText(textid, sectionid, callback);
}

const highlightWords = (text, searchTermsRegExp) => {
  let processedHtml = text;

  for (const regex of searchTermsRegExp) {
    regex.lastIndex = 0;
    processedHtml = processedHtml.replace(regex, match => `<span class="highlight">${match}</span>`);
  }

  return processedHtml;
};

const doSearch = (textid, divisions, text, e, callback) => {
  const config = getConfig();

  fetch(`${config.dbsBase}text/search?v=4&key=${config.dbsKey}&fileset_id=${textid}&query=${text.replace(/\s/gi, '+')}&limit=2000`)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      for (const verse of data.data) {
        const dbsBookCode = DEFAULT_BIBLE[DEFAULT_BIBLE_USFM.indexOf(verse.book_id)];
        const fragmentid = `${dbsBookCode}${verse.chapter}_${verse.verse_start}`;
        const hasMatch = e.data.searchTermsRegExp[0].test(verse.verse_text);

        if (hasMatch && (divisions.length === 0 || divisions.includes(dbsBookCode))) {
          e.data.results.push({
            fragmentid,
            html: highlightWords(verse.verse_text, e.data.searchTermsRegExp)
          });
        }
      }

      callback(data);
    })
    .catch(_error => {
      callback(null);
    });
};

export function startSearch(textid, divisions, text, onSearchLoad, onSearchIndexComplete, onSearchComplete) {
  const e = {
    type: 'complete',
    target: this,
    data: {
      results: [],
      searchIndexesData: [],
      searchTermsRegExp: SearchTools.createSearchTerms(text, false),
      isLemmaSearch: false
    }
  };

  doSearch(textid, divisions, text, e, () => {
    onSearchComplete(e);
  });
}

export const DBSTextProvider = {
  name: providerName,
  fullName,
  getTextManifest,
  getTextInfo,
  loadSection,
  startSearch
};

export default DBSTextProvider;
