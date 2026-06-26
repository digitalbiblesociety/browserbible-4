/**
 * API.Bible Text Provider
 * Loads Bible texts from API.Bible (api.scripture.api.bible).
 *
 * API.Bible needs a secret `api-key` header, which a browser app can't keep
 * secret. So every request here goes to the proxy worker (config.apiBibleProxyBase),
 * which adds the key. The key lives only in that worker; there's none in this file.
 */

import { getConfig } from '../core/config.js';
import { processTexts, removeProviderTexts } from './TextLoader.js';
import { SearchTools } from './Search.js';
import {
  BOOK_DATA,
  DEFAULT_BIBLE,
  DEFAULT_BIBLE_USFM,
  APOCRYPHAL_BIBLE,
  APOCRYPHAL_BIBLE_USFM
} from '../bible/BibleData.js';
import { toBcp47Lang } from '../lib/bcp47.js';

const providerName = 'apibible';
const fullName = 'API.Bible';

/**
 * Known API.Bible texts. `apiId` is the API.Bible Bible ID; `id` is the short
 * id used inside the app. config.apiBibleIncludeIds picks which ones show.
 */
const CATALOG = [
  { id: 'NIV', apiId: '78a9f6124f344018-01', name: 'New International Version', abbr: 'NIV' },
  { id: 'CSB', apiId: 'a556c5305ee15c3f-01', name: 'Christian Standard Bible', abbr: 'CSB' },
  { id: 'NLT', apiId: 'd6e14a625393b4da-01', name: 'New Living Translation', abbr: 'NLT' }
];

// USFM book id -> in-app 2-letter DBS code (covers protocanon + apocrypha).
const usfmToDbsCode = (usfm) => APOCRYPHAL_BIBLE[APOCRYPHAL_BIBLE_USFM.indexOf(usfm)] ??
  DEFAULT_BIBLE[DEFAULT_BIBLE_USFM.indexOf(usfm)];

// FUMS fair-use reporting is all done server-side by the proxy (from the
// meta.fumsToken on each content response), so there's no FUMS code here.

let textData = [];
let textDataIsLoaded = false;

// Set for the session when the proxy reports the monthly limit is hit (HTTP 429).
// After that, tripQuota() pulls the three texts from the chooser and the
// manifest stops offering them.
let quotaExceeded = false;

const showQuotaNotice = () => {
  if (typeof window === 'undefined' || !window.MovableWindow) return;

  const modal = new window.MovableWindow(420, 190, 'API.Bible');
  const body = modal.body?.nodeType ? modal.body : modal.body?.[0];
  if (body) {
    body.innerHTML = '<div style="padding:16px;line-height:1.5">' +
      'The monthly <strong>API.Bible</strong> call limit has been reached. ' +
      'NIV, CSB, and NLT are temporarily unavailable and will return next month.' +
      '</div>';
  }
  modal.show();
};

// Disable the API.Bible texts for the rest of the session: drop them from the
// manifest, refresh any open chooser, and tell the user once.
const tripQuota = () => {
  if (quotaExceeded) return;
  quotaExceeded = true;
  textData = [];
  textDataIsLoaded = false;

  try {
    removeProviderTexts(providerName);
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('texts:provider-disabled', {
        detail: { providerName }
      }));
    }
  } catch (_e) { /* non-DOM environment */ }

  showQuotaNotice();
};

// Returns true (and trips the quota) when a proxy response signals the monthly
// limit is reached, so callers can bail out of the .then() chain.
const isQuotaResponse = (response) => {
  if (response.status === 429) {
    tripQuota();
    return true;
  }
  return false;
};

const getProviderid = (textid) => {
  const parts = textid.split(':');
  return `${providerName}:${parts.length > 1 ? parts[1] : parts[0]}`;
};

const getTextInfoSync = (textid) => {
  const providerid = getProviderid(textid);
  return textData.find(text => text.providerid === providerid);
};

const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

// Paragraph styles that are section headings rather than verse-bearing prose.
const TITLE_STYLE = /^(s\d*|ms\d*|mr|sr|sp|d|qa|r)$/;

const collectText = (items = []) => {
  let out = '';
  for (const item of items) {
    if (item.type === 'text') out += item.text ?? '';
    else if (item.items) out += collectText(item.items);
  }
  return out;
};

/**
 * Walk API.Bible's USX-JSON `content` array into the app's verse-span HTML.
 * Exported for unit testing; pure (no network, no DOM).
 * @param {Array} content - the `data.content` array from a chapter response
 * @param {string} sectionid - app section id, e.g. "JN3"
 * @returns {string} HTML for the chapter body (paragraphs, titles, verse spans)
 */
export function parseChapterContent(content, sectionid) {
  const html = [];
  let openVerse = false;
  let currentVerseNum = null;

  const closeVerse = () => {
    if (openVerse) {
      html.push('</span>');
      openVerse = false;
    }
  };

  // Reopen a verse span (no number marker) when a verse continues into a new
  // paragraph or styled run.
  const ensureVerseOpen = () => {
    if (!openVerse && currentVerseNum != null) {
      html.push(`<span class="v ${sectionid}_${currentVerseNum}" data-id="${sectionid}_${currentVerseNum}">`);
      openVerse = true;
    }
  };

  const walkInline = (items = []) => {
    for (const item of items) {
      if (item.type === 'text') {
        if (item.text) {
          ensureVerseOpen();
          html.push(escapeHtml(item.text));
        }
        continue;
      }

      if (item.type !== 'tag') continue;
      const style = item.attrs?.style;

      if (item.name === 'verse' && style === 'v') {
        closeVerse();
        const n = item.attrs.number;
        currentVerseNum = n;
        html.push(`<span class="v-num v-${n}">${escapeHtml(n)}&nbsp;</span>`);
        html.push(`<span class="v ${sectionid}_${n}" data-id="${sectionid}_${n}">`);
        openVerse = true;
        continue;
      }

      if (item.name === 'note') {
        // Footnotes/cross-refs are turned off in the request; skip any that show up.
        continue;
      }

      if (item.name === 'char') {
        ensureVerseOpen();
        if (style === 'wj') {
          html.push('<span class="wj">');
          walkInline(item.items);
          html.push('</span>');
        } else {
          walkInline(item.items);
        }
        continue;
      }

      // Any other inline tag: descend into its content.
      if (item.items) walkInline(item.items);
    }
  };

  for (const block of content) {
    if (block?.type !== 'tag' || block.name !== 'para') continue;
    const style = block.attrs?.style ?? 'p';

    if (TITLE_STYLE.test(style)) {
      closeVerse();
      const title = collectText(block.items).trim();
      if (title) html.push(`<div class="s">${escapeHtml(title)}</div>`);
      continue;
    }

    closeVerse();
    html.push(`<div class="${style}">`);
    walkInline(block.items);
    closeVerse();
    html.push('</div>');
  }

  closeVerse();
  return html.join('');
}

const addBlankTargets = (html) => html.replace(/<a\s/gi, '<a target="_blank" rel="noopener" ');

function buildAboutHtml(textInfo, details) {
  return `<div class="about-text">
  <h1>${escapeHtml(details?.nameLocal || details?.name || textInfo.name)}</h1>
  <p class="about-language">${escapeHtml(details?.language?.name || textInfo.langName || '')}</p>
  <div class="about-publisher">${addBlankTargets(details?.info || '')}</div>
  <p class="about-copyright">${escapeHtml(details?.copyright || '')}</p>
  <p class="about-source">Provided through <a href="https://api.bible" target="_blank" rel="noopener">API.Bible</a>.</p>
</div>`;
}

function buildManifest() {
  const config = getConfig();
  const includeIds = config.apiBibleIncludeIds ?? [];

  return CATALOG
    .filter(b => includeIds.length === 0 || includeIds.includes(b.apiId))
    .map(b => ({
      type: 'bible',
      id: b.id,
      apiId: b.apiId,
      name: b.name,
      nameEnglish: b.name,
      abbr: b.abbr,
      lang: 'eng',
      langName: 'English',
      langNameEnglish: 'English',
      dir: 'ltr'
    }));
}

function getTextManifest(callback) {
  const config = getConfig();

  if (quotaExceeded || !config.enableOnlineSources || !config.apiBibleEnabled || !config.apiBibleProxyBase) {
    callback(null);
    return;
  }

  if (textDataIsLoaded) {
    callback(textData);
    return;
  }

  textData = buildManifest();
  processTexts(textData, providerName);
  textDataIsLoaded = true;

  callback(textData);
}

function getTextInfo(textid, callback) {
  const config = getConfig();

  // Bail when disabled/limit-reached so we never loop retrying the manifest.
  if (quotaExceeded || !config.enableOnlineSources || !config.apiBibleEnabled || !config.apiBibleProxyBase) {
    callback(null);
    return;
  }

  if (!textDataIsLoaded) {
    getTextManifest(() => getTextInfo(textid, callback));
    return;
  }

  const info = getTextInfoSync(textid);

  if (!info) {
    callback(null);
    return;
  }

  if (info.divisions?.length > 0) {
    callback(info);
    return;
  }

  const base = config.apiBibleProxyBase;

  // Bible-level metadata (copyright, publisher blurb) for the about panel. Runs
  // alongside the books call; best-effort, so a failure just means a sparser panel.
  const detailsReq = fetch(`${base}/bibles/${info.apiId}?include-full-details=true`)
    .then(response => (response.ok ? response.json() : null))
    .catch(() => null);

  fetch(`${base}/bibles/${info.apiId}/books?include-chapters=true`)
    .then(response => {
      if (isQuotaResponse(response)) throw new Error('quota_exceeded');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(async data => {
      info.divisions = [];
      info.divisionNames = [];
      info.sections = [];

      for (const book of data.data) {
        const dbsCode = usfmToDbsCode(book.id);
        if (typeof dbsCode === 'undefined') continue;

        info.divisions.push(dbsCode);
        info.divisionNames.push(book.name);

        for (const chapter of book.chapters ?? []) {
          // The API includes a non-numeric "intro" pseudo-chapter; skip it.
          if (!/^\d+$/.test(chapter.number)) continue;
          info.sections.push(`${dbsCode}${chapter.number}`);
        }
      }

      const details = await detailsReq;
      info.aboutHtml = buildAboutHtml(info, details?.data);

      callback(info);
    })
    .catch(() => callback(null));
}

function loadSection(textid, sectionid, callback, errorCallback) {
  const config = getConfig();

  getTextInfo(textid, (textinfo) => {
    if (!textinfo) {
      errorCallback?.(textid, sectionid);
      return;
    }

    const bookid = sectionid.substring(0, 2);
    const chapter = sectionid.substring(2);
    const bookData = BOOK_DATA[bookid];

    if (!bookData) {
      errorCallback?.(textid, sectionid);
      return;
    }

    const usfm = bookData.usfm;
    const lang = textinfo.lang;
    const dir = textinfo.dir ?? 'ltr';
    const sectionIndex = textinfo.sections.indexOf(sectionid);
    const previd = sectionIndex > 0 ? textinfo.sections[sectionIndex - 1] : null;
    const nextid = sectionIndex > -1 && sectionIndex < textinfo.sections.length - 1
      ? textinfo.sections[sectionIndex + 1]
      : null;

    const params = 'content-type=json&include-verse-numbers=true&include-titles=true' +
      '&include-notes=false&include-chapter-numbers=false';
    const url = `${config.apiBibleProxyBase}/bibles/${textinfo.apiId}/chapters/${usfm}.${chapter}?${params}`;

    fetch(url)
      .then(response => {
        if (isQuotaResponse(response)) throw new Error('quota_exceeded');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(json => {
        const content = json?.data?.content;
        if (!Array.isArray(content)) {
          errorCallback?.(textid, sectionid);
          return;
        }

        const html = [];

        html.push(`<div class="section chapter ${textid} ${bookid} ${sectionid} ${lang} " ` +
          ` data-textid="${textid}"` +
          ` data-id="${sectionid}"` +
          ` data-nextid="${nextid}"` +
          ` data-previd="${previd}"` +
          ` lang="${toBcp47Lang(lang)}"` +
          ` data-lang3="${lang}"` +
          ` dir="${dir}"` +
          `>`);

        if (chapter === '1') {
          const divIndex = textinfo.divisions.indexOf(bookid);
          const bookName = divIndex > -1 ? textinfo.divisionNames[divIndex] : bookData.name;
          html.push(`<div class="mt">${bookName}</div>`);
        }

        html.push(`<div class="c">${chapter}</div>`);
        html.push(parseChapterContent(content, sectionid));
        html.push('</div>');

        callback(html.join(''));
      })
      .catch(() => {
        errorCallback?.(textid, sectionid);
      });
  });
}

const highlightWords = (text, searchTermsRegExp) => {
  let processedHtml = text;

  for (const regex of searchTermsRegExp) {
    regex.lastIndex = 0;
    processedHtml = processedHtml.replace(regex, match => `<span class="highlight">${match}</span>`);
  }

  return processedHtml;
};

function startSearch(textid, divisions, text, onSearchLoad, onSearchIndexComplete, onSearchComplete) {
  const config = getConfig();
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

  if (!info) {
    onSearchComplete(e);
    return;
  }

  const query = encodeURIComponent(text).replace(/%20/g, '+');
  const url = `${config.apiBibleProxyBase}/bibles/${info.apiId}/search?query=${query}&limit=2000`;

  fetch(url)
    .then(response => {
      if (isQuotaResponse(response)) throw new Error('quota_exceeded');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(data => {
      const verses = data?.data?.verses ?? [];

      for (const verse of verses) {
        const dbsBookCode = usfmToDbsCode(verse.bookId);
        if (!dbsBookCode) continue;

        // verse.id is like "JHN.3.16"
        const parts = verse.id.split('.');
        const fragmentid = `${dbsBookCode}${parts[1]}_${parts[2]}`;

        e.data.searchTermsRegExp[0].lastIndex = 0;
        const hasMatch = e.data.searchTermsRegExp[0].test(verse.text);

        if (hasMatch && (divisions.length === 0 || divisions.includes(dbsBookCode))) {
          e.data.results.push({
            fragmentid,
            html: highlightWords(verse.text, e.data.searchTermsRegExp)
          });
        }
      }

      onSearchComplete(e);
    })
    .catch(() => {
      onSearchComplete(e);
    });
}

export const ApiBibleTextProvider = {
  name: providerName,
  fullName,
  getTextManifest,
  getTextInfo,
  loadSection,
  startSearch
};
