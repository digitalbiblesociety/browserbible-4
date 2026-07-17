// Serves sign-language Deaf Bibles (Deaf Bible Society via DBS) as inline-video passages.

import { getConfig } from '../core/config.js';
import { BOOK_DATA } from '../bible/BibleData.js';
import { toBcp47Lang } from '../lib/bcp47.js';

const providerName = 'deafbible';
const fullName = 'Deaf Bible (Deaf Bible Society)';

// Master catalog of all DBS video products; Deaf Bibles are the entries whose org is "DeafBible".
const DEFAULT_CATALOG_URL = 'https://dbs.org/data/video.json';
// Base for the per-title Deaf Bible metadata JSON files.
const DEFAULT_META_URL = 'https://meta.dbs.org/data/data-video/video/DeafBible';

// id -> { info, sectionPassages: Map<sectionid, passage[]> }
const titleCache = {};

// Title index (derived from the catalog), fetched once and cached.
let indexPromise = null;

const escapeHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const norm = (s) => String(s ?? '').toLowerCase().replace(/[\s.]/g, '');

// Map full English book names in DBS metadata ("Genesis", "1 Samuel") to DBS 2-letter codes.
const BOOK_NAME_TO_CODE = (() => {
  const map = {};
  for (const code of Object.keys(BOOK_DATA)) {
    const book = BOOK_DATA[code];
    map[norm(book.name)] = code;
    for (const alias of book.names?.eng ?? []) map[norm(alias)] = code;
  }
  // Spellings DBS uses that aren't in the alias lists.
  map[norm('Psalms')] = 'PS';
  map[norm('Song of Solomon')] = 'SS';
  return map;
})();

const isEnabled = (config) => config.enableOnlineSources && config.deafBibleEnabled;

const metaBase = (config) => (config.deafBibleMetaUrl || DEFAULT_META_URL).replace(/\/$/, '');

const catalogUrl = (config) => config.deafBibleCatalogUrl || DEFAULT_CATALOG_URL;

const idFor = (entry) => `deaf_${entry.iso.toUpperCase()}`;

const bareId = (textid) => (textid.includes(':') ? textid.split(':')[1] : textid);

// The catalog abbreviates keys; Deaf Bibles are the entries whose org ("o") is "DeafBible".
const isDeafEntry = (e) => !!e && (e.o === 'DeafBible' || e.org === 'DeafBible');

// Normalize a catalog entry to the internal shape the rest of the provider consumes.
// Full country name / text direction aren't in the catalog; they're filled in per-title (buildTitle).
const catalogToEntry = (e) => {
  const file = e.j ?? e.file ?? '';
  return {
    iso: e.i ?? e.iso ?? '',
    language: e.l ?? e.language ?? '',
    direction: e.direction || 'ltr',
    primaryCountry: e.c ?? e.primaryCountry ?? '',
    cover: '',
    file,
    directory: file.replace(/_deaf_bible\.json$/, '')
  };
};

// Fetch the master catalog, keep the Deaf Bible titles, and cache the result;
// resolves to [] on failure so callers degrade gracefully.
export function loadIndex(config) {
  if (indexPromise) return indexPromise;

  indexPromise = fetch(catalogUrl(config))
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      const list = Array.isArray(data) ? data : (data?.videos ?? data?.titles ?? []);
      return list
        .filter(isDeafEntry)
        .map(catalogToEntry)
        .filter((entry) => entry.iso && entry.file)
        .sort((a, b) => a.language.localeCompare(b.language));
    })
    .catch((error) => {
      console.error('Deaf Bible catalog error:', error);
      indexPromise = null; // allow a later retry
      return [];
    });

  return indexPromise;
}

const findEntry = (index, textid) => {
  const id = bareId(textid);
  return index.find((entry) => idFor(entry) === id) ?? null;
};

const createAboutHtml = (entry, raw) => {
  const orig = raw?.source?.original ?? {};
  const description = raw?.description || raw?.description_short
    || raw?.longDescription || raw?.shortDescription
    || orig.longDescription || orig.shortDescription || orig.film_description || '';
  const orgUrl = raw?.org?.url || raw?.org_url || orig.org_url || 'https://deafbiblesociety.com/';
  const country = raw?.country?.name || entry.primaryCountry || '';

  return `<div class="about-text">
  <h1>${escapeHtml(entry.language)}</h1>
  <p class="about-language">Deaf Bible${country ? ` &mdash; ${escapeHtml(country)}` : ''}</p>
  <p>${escapeHtml(description)}</p>
  <p class="about-source">Provided by the <a href="${escapeHtml(orgUrl)}" target="_blank" rel="noopener">Deaf Bible Society</a>.</p>
</div>`;
};

// Normalize a per-title passage (new "sections[].items" shape, or the legacy "chapters" shape)
// into the flat record buildSectionHtml/DeafPlaylist consume.
const normalizePassage = (item) => ({
  book: item.book,
  reference: item.reference,
  title: item.title,
  web_url: item.media?.high?.url ?? item.web_url ?? '',
  web_url_low: item.media?.low?.url ?? item.web_url_low ?? '',
  cover: item.cover ?? '',
  length: item.duration_human ?? item.duration_seconds ?? item.length ?? ''
});

/**
 * Resolve a passage's book + starting chapter/verse to a DBS section id.
 * @returns {{code: string, sectionid: string, verse: string}|null}
 */
export function parsePassage(book, reference) {
  const code = BOOK_NAME_TO_CODE[norm(book)];
  if (!code) return null;

  // Strip book name first so a numbered book's leading digit doesn't leak into the chapter match.
  let ref = String(reference ?? '');
  const bookName = String(book ?? '');
  const bookIdx = bookName ? ref.toLowerCase().indexOf(bookName.toLowerCase()) : -1;
  if (bookIdx > -1) ref = ref.slice(bookIdx + bookName.length);

  const match = ref.match(/(\d+)\s*:\s*(\d+)|(\d+)/);
  const chapter = match ? (match[1] ?? match[3]) : '1';
  const verse = match && match[2] ? match[2] : '1';

  return { code, sectionid: `${code}${chapter}`, verse };
}

export function buildTitle(entry, raw) {
  const id = idFor(entry);
  const lang = entry.iso;
  const dir = raw?.language?.direction || entry.direction || 'ltr';

  const divisions = [];
  const divisionNames = [];
  const sections = [];
  const sectionPassages = new Map();

  // New titles group passages under sections[].items; legacy titles used a flat chapters[].
  const rawItems = Array.isArray(raw.sections)
    ? raw.sections.flatMap((section) => section?.items ?? [])
    : (raw.chapters ?? []);

  for (const item of rawItems) {
    const passage = normalizePassage(item);
    const parsed = parsePassage(passage.book, passage.reference || passage.title);
    if (!parsed) continue;

    const { code, sectionid, verse } = parsed;

    if (!divisions.includes(code)) {
      divisions.push(code);
      divisionNames.push(BOOK_DATA[code]?.name || passage.book);
    }
    if (!sectionPassages.has(sectionid)) {
      sectionPassages.set(sectionid, []);
      sections.push(sectionid);
    }
    sectionPassages.get(sectionid).push({ ...passage, verse, sectionid });
  }

  const countryName = raw?.country?.name || entry.primaryCountry || '';

  const info = {
    type: 'deafbible',
    id,
    abbr: entry.iso.toUpperCase(),
    name: entry.language,
    nameEnglish: entry.language,
    title: 'Deaf Bible',
    lang,
    langName: entry.language,
    langNameEnglish: entry.language,
    dir,
    hasText: true,
    hasAudio: false,
    cover: raw?.cover || entry.cover || '',
    countries: countryName ? [countryName] : [],
    divisions,
    divisionNames,
    sections,
    aboutHtml: createAboutHtml(entry, raw),
    _deaf: { file: entry.file, directory: entry.directory }
  };

  // Flat, canonical-order list of passages for the video player (see DeafPlaylist).
  const orderedPassages = sections.flatMap((s) => sectionPassages.get(s));

  return { info, sectionPassages, orderedPassages };
}

export function buildSectionHtml(info, sectionid, passages) {
  // DBS book codes are always two characters (e.g. GN, S1, C2); the rest is the chapter.
  const bookid = sectionid.substring(0, 2);
  const chapter = sectionid.substring(2);

  const idx = info.sections.indexOf(sectionid);
  const previd = idx > 0 ? info.sections[idx - 1] : null;
  const nextid = idx > -1 && idx < info.sections.length - 1 ? info.sections[idx + 1] : null;

  const divIndex = info.divisions.indexOf(bookid);
  const bookName = divIndex > -1 ? info.divisionNames[divIndex] : (BOOK_DATA[bookid]?.name || bookid);

  const html = [];
  html.push(`<div class="section chapter ${info.id} ${bookid} ${sectionid} ${info.lang} "` +
    ` data-textid="${info.id}"` +
    ` data-id="${sectionid}"` +
    ` data-nextid="${nextid}"` +
    ` data-previd="${previd}"` +
    ` lang="${toBcp47Lang(info.lang)}"` +
    ` data-lang3="${info.lang}"` +
    ` dir="${info.dir}"` +
    `>`);

  html.push(`<div class="mt">${escapeHtml(bookName)} ${escapeHtml(chapter)}</div>`);

  for (const passage of passages) {
    const vid = `${sectionid}_${passage.verse}`;
    const heading = passage.title || passage.reference || `${bookName} ${chapter}`;
    const src = passage.web_url || passage.web_url_low || '';
    const poster = passage.cover || info.cover || '';

    html.push(`<span class="v ${vid}" data-id="${vid}">`);
    html.push(`<div class="s">${escapeHtml(heading)}</div>`);
    html.push('<div class="deaf-video">');
    html.push(`<video src="${escapeHtml(src)}" preload="none" class="inline-video" controls` +
      (poster ? ` poster="${escapeHtml(poster)}"` : '') + '></video>');
    html.push('</div>');
    html.push('</span>');
  }

  html.push('</div>');
  return html.join('');
}

const entryToManifest = (entry) => ({
  type: 'deafbible',
  id: idFor(entry),
  name: entry.language,
  nameEnglish: entry.language,
  title: 'Deaf Bible',
  abbr: entry.iso.toUpperCase(),
  lang: entry.iso,
  langName: entry.language,
  langNameEnglish: entry.language,
  dir: entry.direction || 'ltr',
  hasText: true,
  hasAudio: false,
  cover: entry.cover || '',
  countries: entry.primaryCountry ? [entry.primaryCountry] : [],
  _deaf: { file: entry.file, directory: entry.directory }
});

function getTextManifest(callback) {
  const config = getConfig();
  if (!isEnabled(config)) {
    callback(null);
    return;
  }

  loadIndex(config).then((index) => {
    callback(index.length > 0 ? index.map(entryToManifest) : null);
  });
}

function getTextInfo(textid, callback, errorCallback) {
  const config = getConfig();
  if (!isEnabled(config)) {
    callback(null);
    return;
  }

  loadIndex(config)
    .then((index) => {
      const entry = findEntry(index, textid);
      if (!entry) {
        if (errorCallback) errorCallback(new Error(`No Deaf Bible for "${textid}"`));
        else callback(null);
        return;
      }

      const id = idFor(entry);
      if (titleCache[id]) {
        callback(titleCache[id].info);
        return;
      }

      return fetch(`${metaBase(config)}/${entry.file}`)
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return response.json();
        })
        .then((raw) => {
          const built = buildTitle(entry, raw);
          titleCache[id] = built;
          callback(built.info);
        });
    })
    .catch((error) => {
      console.error('Deaf Bible getTextInfo error:', error);
      if (errorCallback) errorCallback(error);
      else callback(null);
    });
}

/**
 * Resolve the ordered passage list for a title (loads if needed); resolves to [] on failure.
 * @returns {Promise<Array<Object>>}
 */
export function getPlaylist(textid) {
  return new Promise((resolve) => {
    getTextInfo(textid, (info) => {
      resolve(info ? (titleCache[info.id]?.orderedPassages ?? []) : []);
    }, () => resolve([]));
  });
}

function loadSection(textid, sectionid, callback, errorCallback) {
  getTextInfo(textid, (info) => {
    if (!info) {
      errorCallback?.(textid, sectionid);
      return;
    }

    const cache = titleCache[info.id];
    const passages = cache?.sectionPassages.get(sectionid);
    if (!passages || passages.length === 0) {
      errorCallback?.(textid, sectionid);
      return;
    }

    callback(buildSectionHtml(info, sectionid, passages));
  }, () => errorCallback?.(textid, sectionid));
}

// Deaf Bibles are video-only; return empty results so Search degrades gracefully.
function startSearch(textid, divisions, text, onSearchLoad, onSearchIndexComplete, onSearchComplete) {
  onSearchComplete?.({
    type: 'complete',
    target: null,
    data: { results: [], searchIndexesData: [], searchTermsRegExp: [], isLemmaSearch: false }
  });
}

export const DeafBibleTextProvider = {
  name: providerName,
  fullName,
  getTextManifest,
  getTextInfo,
  loadSection,
  startSearch
};
