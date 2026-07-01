import { getConfig } from '../core/config.js';
import { processTexts } from './TextLoader.js';
import { SearchTools } from './Search.js';
import {
  BOOK_DATA,
  NT_BOOKS,
  DEFAULT_BIBLE,
  DEFAULT_BIBLE_USFM,
  APOCRYPHAL_BIBLE,
  APOCRYPHAL_BIBLE_USFM
} from '../bible/BibleData.js';
import { toBcp47Lang } from '../lib/bcp47.js';

const providerName = 'biblebrain';
const fullName = 'Bible Brain (Faith Comes By Hearing)';

const MANIFEST_MAX_PAGES = 100;
const MANIFEST_FETCH_CONCURRENCY = 8;

const AUDIO_TYPES = ['audio', 'audio_drama'];

let textData = [];
let textDataIsLoaded = false;
let textDataIsLoading = false;
let textDataCallbacks = [];

const finish = () => {
  textDataIsLoading = false;
  textDataIsLoaded = true;
  while (textDataCallbacks.length > 0) {
    textDataCallbacks.pop()(textData);
  }
};

const usfmToDbsCode = (usfm) => APOCRYPHAL_BIBLE[APOCRYPHAL_BIBLE_USFM.indexOf(usfm)] ??
  DEFAULT_BIBLE[DEFAULT_BIBLE_USFM.indexOf(usfm)];

const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const isEnabled = (config) =>
  config.enableOnlineSources && config.bibleBrainEnabled && !!config.bibleBrainProxyBase;

const filesetType = (fs) => fs.type ?? fs.set_type_code ?? '';
const filesetSize = (fs) => fs.size ?? fs.set_size_code ?? '';

const isNtBook = (bookCode) => NT_BOOKS.includes(bookCode);

export function filesetCoversTestament(size, isNT) {
  const s = String(size ?? '').toUpperCase();
  if (s === '' || s === 'C' || s === 'P' || s === 'S') return true;
  return isNT ? s.includes('NT') : s.includes('OT');
}

export function selectTextFileset(textFilesets, bookCode) {
  if (!Array.isArray(textFilesets) || textFilesets.length === 0) return null;
  const isNT = isNtBook(bookCode);
  return textFilesets.find(fs => filesetCoversTestament(fs.size, isNT)) || null;
}

export function flattenFilesets(filesets) {
  if (!filesets || typeof filesets !== 'object') return [];
  return Object.values(filesets).flat().filter(Boolean);
}

export function selectFilesets(filesetsObj) {
  const all = flattenFilesets(filesetsObj);

  const plain = all.filter(fs => filesetType(fs) === 'text_plain');
  const textSource = plain.length > 0
    ? plain
    : all.filter(fs => filesetType(fs) === 'text_format');

  const toEntry = (fs) => ({ id: fs.id, type: filesetType(fs), size: filesetSize(fs) });

  return {
    textFilesets: textSource.map(toEntry),
    audioFilesets: all.filter(fs => AUDIO_TYPES.includes(filesetType(fs))).map(toEntry)
  };
}

const createAboutHtml = (entry) => `<div class="about-text">
  <h1>${escapeHtml(entry.vname || entry.name)}</h1>
  <p class="about-language">${escapeHtml(entry.language || entry.langName || '')}</p>
  <p class="about-source">Provided through <a href="https://www.faithcomesbyhearing.com/bible-brain" target="_blank" rel="noopener">Bible Brain</a> by Faith Comes By Hearing.</p>
</div>`;

export function entryToTextInfo(entry) {
  const { textFilesets, audioFilesets } = selectFilesets(entry.filesets);
  if (textFilesets.length === 0) return null;

  const name = entry.vname || entry.name;
  if (!name) return null;

  return {
    type: 'bible',
    id: entry.abbr,
    name,
    nameEnglish: entry.name || name,
    abbr: entry.abbr,
    lang: entry.iso || '',
    langName: entry.language || '',
    langNameEnglish: entry.language || '',
    dir: 'ltr',
    hasAudio: audioFilesets.length > 0,
    aboutHtml: createAboutHtml(entry),
    biblebrain: {
      bibleId: entry.abbr,
      textFilesets,
      audioFilesets
    }
  };
}

const getProviderid = (textid) => {
  const parts = textid.split(':');
  return `${providerName}:${parts.length > 1 ? parts[1] : parts[0]}`;
};

const getTextInfoSync = (textid) => {
  const providerid = getProviderid(textid);
  return textData.find(text => text.providerid === providerid);
};

const fetchBiblesPage = async (base, page) => {
  const response = await fetch(`${base}/bibles?page=${page}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
};

async function fetchAllBibles(base) {
  const first = await fetchBiblesPage(base, 1);
  const out = [...(first?.data ?? [])];

  const pagination = first?.meta?.pagination ?? {};
  const lastPage = pagination.last_page ?? pagination.total_pages ?? 1;
  const maxPage = Math.min(lastPage, MANIFEST_MAX_PAGES);
  if (lastPage > MANIFEST_MAX_PAGES) {
    console.warn(`BibleBrainTextProvider: catalog has ${lastPage} pages; fetching first ${MANIFEST_MAX_PAGES}. ` +
      'Set config.bibleBrainLanguages to narrow it.');
  }

  for (let start = 2; start <= maxPage; start += MANIFEST_FETCH_CONCURRENCY) {
    const batch = [];
    for (let p = start; p < start + MANIFEST_FETCH_CONCURRENCY && p <= maxPage; p++) {
      batch.push(fetchBiblesPage(base, p).then(j => j?.data ?? []).catch(() => []));
    }
    for (const data of await Promise.all(batch)) out.push(...data);
  }
  return out;
}

function getTextManifest(callback) {
  const config = getConfig();

  if (!isEnabled(config)) {
    callback(null);
    return;
  }

  if (textDataIsLoaded) {
    callback(textData);
    return;
  }

  textDataCallbacks.push(callback);
  if (textDataIsLoading) return;
  textDataIsLoading = true;

  fetchAllBibles(config.bibleBrainProxyBase)
    .then(entries => {
      const languages = config.bibleBrainLanguages ?? [];
      const excludeIds = config.bibleBrainExcludeIds ?? [];

      textData = [];
      for (const entry of entries) {
        if (languages.length > 0 && !languages.includes(entry.iso)) continue;
        if (excludeIds.includes(entry.abbr)) continue;

        const info = entryToTextInfo(entry);
        if (info) textData.push(info);
      }

      processTexts(textData, providerName);
      console.debug(`BibleBrainTextProvider: ${textData.length} text bibles loaded`);
      finish();
    })
    .catch(error => {
      console.error('Bible Brain manifest error:', error);
      // Keep an array so getTextInfoSync's .find() degrades to "not found"
      // instead of throwing on null.
      textData = [];
      finish();
    });
}

function getTextInfo(textid, callback) {
  const config = getConfig();

  if (!isEnabled(config)) {
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

  fetch(`${config.bibleBrainProxyBase}/bibles/${info.biblebrain.bibleId}/book`)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(json => {
      info.divisions = [];
      info.divisionNames = [];
      info.sections = [];

      for (const book of json?.data ?? []) {
        const dbsCode = usfmToDbsCode(book.book_id);
        if (typeof dbsCode === 'undefined') continue;

        if (!selectTextFileset(info.biblebrain.textFilesets, dbsCode)) continue;

        info.divisions.push(dbsCode);
        info.divisionNames.push(book.name || BOOK_DATA[dbsCode]?.name || dbsCode);

        for (const chapter of normalizeChapters(book.chapters)) {
          info.sections.push(`${dbsCode}${chapter}`);
        }
      }

      callback(info);
    })
    .catch(error => {
      console.error('Bible Brain getTextInfo error:', error);
      callback(null);
    });
}

export function normalizeChapters(chapters) {
  if (Array.isArray(chapters)) {
    return chapters.map(Number).filter(n => Number.isFinite(n) && n > 0);
  }
  if (typeof chapters === 'string') {
    return chapters.split(',').map(s => parseInt(s.trim(), 10)).filter(n => Number.isFinite(n) && n > 0);
  }
  return [];
}

export function versesToHtml(verses, ctx) {
  const { textid, sectionid, bookid, chapter, lang, dir, title, previd, nextid } = ctx;
  const html = [];

  html.push(`<div class="section chapter ${textid} ${bookid} ${sectionid} ${lang} "` +
    ` data-textid="${textid}"` +
    ` data-id="${sectionid}"` +
    ` data-nextid="${nextid}"` +
    ` data-previd="${previd}"` +
    ` lang="${toBcp47Lang(lang)}"` +
    ` data-lang3="${lang}"` +
    ` dir="${dir}"` +
    `>`);

  if (String(chapter) === '1' && title) {
    html.push(`<div class="mt">${escapeHtml(title)}</div>`);
  }

  html.push(`<div class="c">${escapeHtml(chapter)}</div>`);
  html.push('<div class="p">');

  for (const verse of verses) {
    const vnum = verse.verse_start;
    const vid = `${sectionid}_${vnum}`;
    html.push(` <span class="v-num v-${vnum}">${escapeHtml(vnum)}</span>` +
      `<span class="v ${vid}" data-id="${vid}">${escapeHtml(verse.verse_text)}</span>`);
  }

  html.push('</div>');
  html.push('</div>');
  return html.join('');
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

    const textFileset = selectTextFileset(textinfo.biblebrain.textFilesets, bookid);
    if (!textFileset) {
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
    const divIndex = textinfo.divisions.indexOf(bookid);
    const title = divIndex > -1 ? textinfo.divisionNames[divIndex] : bookData.name;

    fetch(`${config.bibleBrainProxyBase}/bibles/filesets/${textFileset.id}/${usfm}/${chapter}`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(json => {
        const verses = json?.data;
        if (!Array.isArray(verses) || verses.length === 0) {
          errorCallback?.(textid, sectionid);
          return;
        }
        callback(versesToHtml(verses, { textid, sectionid, bookid, chapter, lang, dir, title, previd, nextid }));
      })
      .catch(error => {
        console.error('Bible Brain loadSection error:', error);
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

export function extractSearchVerses(json) {
  return [
    json?.data?.verses?.data,
    json?.verses?.data,
    json?.data?.verses,
    json?.data
  ].find(Array.isArray) ?? [];
}

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

  if (!info || !isEnabled(config)) {
    onSearchComplete(e);
    return;
  }

  const searchType = /\bOR\b/gi.test(text) ? 'OR' : 'AND';
  const query = encodeURIComponent(text).replace(/%20/g, '+');
  const base = config.bibleBrainProxyBase;

  const requests = info.biblebrain.textFilesets.map(fs =>
    fetch(`${base}/search?query=${query}&fileset_id=${fs.id}&limit=2000`)
      .then(response => (response.ok ? response.json() : null))
      .catch(() => null)
  );

  Promise.all(requests)
    .then(jsons => {
      // AND: every term must match; OR: any one (matches local TextSearch).
      const terms = e.data.searchTermsRegExp;
      const verseMatches = (verseText) => {
        if (terms.length === 0) return false;
        const test = (re) => { re.lastIndex = 0; return re.test(verseText); };
        return searchType === 'OR' ? terms.some(test) : terms.every(test);
      };

      const seen = new Set();
      for (const json of jsons) {
        if (!json) continue;
        for (const verse of extractSearchVerses(json)) {
          const dbsBookCode = usfmToDbsCode(verse.book_id);
          if (!dbsBookCode) continue;

          const fragmentid = `${dbsBookCode}${verse.chapter}_${verse.verse_start}`;
          if (seen.has(fragmentid)) continue;

          if (verseMatches(verse.verse_text) && (divisions.length === 0 || divisions.includes(dbsBookCode))) {
            seen.add(fragmentid);
            e.data.results.push({
              fragmentid,
              html: highlightWords(verse.verse_text, e.data.searchTermsRegExp)
            });
          }
        }
      }
      onSearchComplete(e);
    })
    .catch(error => {
      console.error('Bible Brain search error:', error);
      onSearchComplete(e);
    });
}

export const BibleBrainTextProvider = {
  name: providerName,
  fullName,
  getTextManifest,
  getTextInfo,
  loadSection,
  startSearch
};
