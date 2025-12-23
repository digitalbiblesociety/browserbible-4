/**
 * FCBH Text Provider
 * Loads Bible texts from Faith Comes By Hearing Digital Bible Platform
 *
 * Note: The dbt.io API previously required JSONP. Modern implementations
 * should use a server-side proxy for CORS support, or the API may now
 * support CORS directly.
 */

import { getConfig, updateConfig } from '../core/config.js';
import { processTexts } from './TextLoader.js';
import { SearchTools } from './Search.js';
import { BOOK_DATA, DEFAULT_BIBLE, DEFAULT_BIBLE_OSIS, OT_BOOKS } from '../bible/BibleData.js';

updateConfig({
  fcbhKey: '',
  fcbhTextExclusions: [],
  fcbhApiUrl: 'https://dbt.io'
});

const providerName = 'fcbh';
const fullName = 'Faith Comes by Hearing - Digital Bible Platform';

let textData = [];
let textDataIsLoaded = false;
let textDataIsLoading = false;
let textDataCallbacks = [];

const finish = () => {
  textDataIsLoading = false;
  textDataIsLoaded = true;

  while (textDataCallbacks.length > 0) {
    const cb = textDataCallbacks.pop();
    cb(textData);
  }
};

const createAboutHtml = (title, versionCode) => `<h1>${title} (${versionCode})</h1>
<dl>
  <dt>Source</dt>
  <dd>This text comes from the <a href="https://www.digitalbibleplatform.com/">Digital Bible Platform</a> provided by <a href="http://faithcomesbyhearing.com/">Faith Comes By Hearing</a></dd>
  <dt>API EULA</dt>
  <dd><a href="https://www.digitalbibleplatform.com/eula/">End User License Agreement</a> for API</dd>
</dl>`;

const getProviderid = (textid) => {
  const parts = textid.split(':');
  const fullid = `${providerName}:${parts.length > 1 ? parts[1] : parts[0]}`;
  return fullid;
};

export function getTextManifest(callback) {
  const config = getConfig();

  if (!config.enableOnlineSources || typeof config.fcbhKey === 'undefined' || config.fcbhKey === '') {
    callback(null);
    return;
  }

  if (textDataIsLoaded) {
    callback(textData);
  } else {
    textDataCallbacks.push(callback);

    if (textDataIsLoading) {
      return;
    }

    textDataIsLoading = true;

    fetch('content/texts/texts_fcbh.json')
      .then(response => response.json())
      .then(data => {
        textData = data.textInfoData;

        processTexts(textData, providerName);

        for (const text of textData) {
          text.aboutHtml = createAboutHtml(text.name, text.abbr);
        }

        if (config.fcbhTextExclusions?.length > 0) {
          textData = textData.filter(t => !config.fcbhTextExclusions.includes(t.id));
        }

        finish();
      })
      .catch(error => {
        console.error('FCBH manifest error:', error);
        textData = null;
        finish();
      });
  }
}

const loadBooks = (info, damId, callback) => {
  const config = getConfig();
  const apiUrl = config.fcbhApiUrl ?? 'https://dbt.io';
  const url = `${apiUrl}/library/book?v=2&key=${config.fcbhKey}&dam_id=${damId}`;

  fetch(url, { mode: 'cors' })
    .then(response => response.json())
    .then(data => {
      for (const book of data) {
        const osisIndex = DEFAULT_BIBLE_OSIS.indexOf(book.book_id);
        const dbsBookCode = DEFAULT_BIBLE[osisIndex];

        info.divisions.push(dbsBookCode);
        info.divisionNames.push(book.book_name);

        for (let c = 0; c < book.number_of_chapters; c++) {
          info.sections.push(`${dbsBookCode}${(c + 1).toString()}`);
        }
      }

      callback();
    })
    .catch(error => {
      console.error('FCBH loadBooks error:', error);
      callback();
    });
};

const getTextInfoSync = (textid) => {
  const providerid = getProviderid(textid);
  const info = textData.find(text => text.providerid === providerid);
  return info;
};

export function getTextInfo(textid, callback) {
  if (!textDataIsLoaded) {
    getTextManifest(() => {
      getTextInfo(textid, callback);
    });
    return;
  }

  const providerid = getProviderid(textid);

  const info = textData.find(text => text.providerid === providerid);

  if (typeof info.divisions === 'undefined' || info.divisions.length === 0) {
    info.providerName = providerName;
    info.divisions = [];
    info.divisionNames = [];
    info.sections = [];

    if (info.ot_dam_id !== '') {
      loadBooks(info, info.ot_dam_id, () => {
        if (info.nt_dam_id !== '') {
          loadBooks(info, info.nt_dam_id, () => {
            callback(info);
          });
        } else {
          callback(info);
        }
      });
    } else if (info.nt_dam_id !== '') {
      loadBooks(info, info.nt_dam_id, () => {
        callback(info);
      });
    } else {
      console.log('FCBH error', 'No NT or OT id', info);
    }
  } else {
    callback(info);
  }
}

export function loadSection(textid, sectionid, callback) {
  const config = getConfig();
  const apiUrl = config.fcbhApiUrl ?? 'https://dbt.io';

  getTextInfo(textid, (textinfo) => {
    const bookid = sectionid.substring(0, 2);
    const chapter = sectionid.substring(2);
    const lang = textinfo.lang;
    const dir = textinfo.dir ?? 'ltr';
    const usfmbook = BOOK_DATA[bookid].osis;
    const damId = OT_BOOKS.indexOf(bookid) > -1 ? textinfo.ot_dam_id : textinfo.nt_dam_id;
    const sectionIndex = textinfo.sections.indexOf(sectionid);
    const previd = sectionIndex > 0 ? textinfo.sections[sectionIndex - 1] : null;
    const nextid = sectionIndex < textinfo.sections.length ? textinfo.sections[sectionIndex + 1] : null;
    const url = `${apiUrl}/library/verse?v=2&key=${config.fcbhKey}&dam_id=${damId}&book_id=${usfmbook}&chapter_id=${chapter}`;

    fetch(url, { mode: 'cors' })
      .then(response => response.json())
      .then(chapterData => {
        const html = [];

        html.push(`<div class="section chapter ${textid} ${bookid} ${sectionid} ${lang} " data-textid="${textid}" data-id="${sectionid}" data-nextid="${nextid}" data-previd="${previd}" lang="${lang}" dir="${dir}">`);

        if (chapter === '1') {
          html.push(`<div class="mt">${textinfo.divisionNames[textinfo.divisions.indexOf(bookid)]}</div>`);
        }

        html.push(`<div class="c">${chapter}</div>`);
        html.push('<div class="p">');

        for (const verse of chapterData) {
          const text = verse.verse_text;
          const vnum = verse.verse_id;
          const vid = `${sectionid}_${vnum}`;

          html.push(`<span class="v-num v-${vnum}">${vnum}&nbsp;</span><span class="v ${vid}" data-id="${vid}">${text}</span>`);
        }

        html.push('</div>');
        html.push('</div>');

        callback(html.join(''));
      })
      .catch(error => {
        console.error('FCBH loadSection error:', error);
        callback(null);
      });
  });
}

const doSearch = (apiUrl, damId, divisions, text, e, callback) => {
  const config = getConfig();
  const encodedText = encodeURIComponent(text).replace(/%20/g, '+');
  const url = `${apiUrl}/text/search?v=2&key=${config.fcbhKey}&dam_id=${damId}&query=${encodedText}&limit=2000`;

  fetch(url, { mode: 'cors' })
    .then(response => response.json())
    .then(data => {
      for (const verse of data[1]) {
        const dbsBookCode = DEFAULT_BIBLE[DEFAULT_BIBLE_OSIS.indexOf(verse.book_id)];
        const fragmentid = `${dbsBookCode}${verse.chapter_id}_${verse.verse_id}`;
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
    .catch(error => {
      console.error('FCBH search error:', error);
      callback(null);
    });
};

const highlightWords = (text, searchTermsRegExp) => {
  let processedHtml = text;

  for (const regex of searchTermsRegExp) {
    regex.lastIndex = 0;

    processedHtml = processedHtml.replace(regex, match => `<span class="highlight">${match}</span>`);
  }

  return processedHtml;
};

export function startSearch(textid, divisions, text, onSearchLoad, onSearchIndexComplete, onSearchComplete) {
  const config = getConfig();
  const apiUrl = config.fcbhApiUrl ?? 'https://dbt.io';

  const info = getTextInfoSync(textid);

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

  const damId = info.ot_dam_id !== '' ? info.ot_dam_id : info.nt_dam_id;

  doSearch(apiUrl, damId, divisions, text, e, () => {
    onSearchComplete(e);
  });
}

export const FCBHTextProvider = {
  name: providerName,
  fullName,
  getTextManifest,
  getTextInfo,
  loadSection,
  startSearch
};

export default FCBHTextProvider;
