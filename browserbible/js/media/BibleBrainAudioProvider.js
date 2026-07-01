import { BaseAudioProvider } from './BaseAudioProvider.js';
import { getConfig } from '../core/config.js';
import { NT_BOOKS, BOOK_DATA } from '../bible/BibleData.js';
import { linkedAudioFor } from '../data/biblebrainDuplicates.js';

const PLAIN_TYPE = 'audio';
const DRAMA_TYPE = 'audio_drama';

const isEnabled = (config) =>
  config.enableOnlineSources && config.bibleBrainEnabled && !!config.bibleBrainProxyBase;

const isNtBook = (bookCode) => NT_BOOKS.includes(bookCode);

export function filesetCoversTestament(size, isNT) {
  const s = String(size ?? '').toUpperCase();
  if (s === '' || s === 'C' || s === 'P' || s === 'S') return true;
  return isNT ? s.includes('NT') : s.includes('OT');
}

export function selectAudioFileset(audioFilesets, bookCode, audioOption) {
  if (!Array.isArray(audioFilesets) || audioFilesets.length === 0) return null;

  const isNT = isNtBook(bookCode);
  const covering = audioFilesets.filter(fs => filesetCoversTestament(fs.size, isNT));

  if (covering.length === 0) return null;

  const drama = covering.filter(fs => fs.type === DRAMA_TYPE);
  const plain = covering.filter(fs => fs.type === PLAIN_TYPE);

  const preferDrama = audioOption === 'drama';
  const primary = preferDrama ? drama : plain;
  const secondary = preferDrama ? plain : drama;

  const base = (list) => list.find(fs => fs.id && !fs.id.includes('-')) || list[0];
  return base(primary) || base(secondary) || covering[0] || null;
}

export function parseTimestamps(data) {
  if (!Array.isArray(data)) return null;
  const timestamps = data
    .map(t => ({ verse: Number(t.verse_start), time: Number(t.timestamp) }))
    .filter(t => Number.isFinite(t.verse) && Number.isFinite(t.time))
    .sort((a, b) => a.time - b.time);
  return timestamps.length > 0 ? timestamps : null;
}

export class BibleBrainAudioProvider extends BaseAudioProvider {
  get name() { return 'biblebrain'; }

  async getAudioInfo(textInfo) {
    const config = getConfig();
    if (!isEnabled(config)) return null;

    const audioFilesets = textInfo?.biblebrain?.audioFilesets;
    if (!Array.isArray(audioFilesets) || audioFilesets.length === 0) return null;

    return {
      type: 'biblebrain',
      title: textInfo.name,
      audioFilesets,
      hasPlainAudio: audioFilesets.some(fs => fs.type === PLAIN_TYPE),
      hasDramaAudio: audioFilesets.some(fs => fs.type === DRAMA_TYPE)
    };
  }

  async getFragmentAudio(textInfo, audioInfo, fragmentid, audioOption) {
    const config = getConfig();
    if (!isEnabled(config)) return null;

    const sectionid = fragmentid.split('_')[0];
    const bookCode = sectionid.substring(0, 2);
    const chapter = parseInt(sectionid.substring(2), 10);

    const bookData = BOOK_DATA[bookCode];
    if (!bookData) return null;

    const fileset = selectAudioFileset(audioInfo.audioFilesets, bookCode, audioOption);
    if (!fileset) return null;

    const base = config.bibleBrainProxyBase;
    const usfm = bookData.usfm;

    let json;
    try {
      const response = await fetch(`${base}/bibles/filesets/${fileset.id}/${usfm}/${chapter}`);
      if (!response.ok) return null;
      json = await response.json();
    } catch {
      return null;
    }

    const entry = Array.isArray(json?.data) ? json.data[0] : null;
    const url = entry?.path;
    if (!url) return null;

    const lastVerse = (bookData.chapters && chapter <= bookData.chapters.length)
      ? bookData.chapters[chapter - 1]
      : 1;

    const timestamps = await this._loadTimestamps(base, fileset.id, usfm, chapter);

    return {
      url,
      id: `biblebrain:${fileset.id}/${usfm}_${chapter}`,
      start: `${bookCode}${chapter}_1`,
      end: `${bookCode}${chapter}_${lastVerse}`,
      timestamps
    };
  }

  async _loadTimestamps(base, filesetId, usfm, chapter) {
    try {
      const response = await fetch(`${base}/timestamps/${filesetId}/${usfm}/${chapter}`);
      if (!response.ok) return null;
      const json = await response.json();
      return parseTimestamps(json?.data);
    } catch {
      return null;
    }
  }

  async _step(textInfo, audioInfo, fragmentid, direction) {
    const sections = textInfo?.sections;
    if (!Array.isArray(sections) || sections.length === 0) return null;

    const sectionid = fragmentid.split('_')[0];
    let index = sections.indexOf(sectionid);
    if (index < 0) return null;

    for (index += direction; index >= 0 && index < sections.length; index += direction) {
      const candidate = sections[index];
      const bookCode = candidate.substring(0, 2);
      const bookData = BOOK_DATA[bookCode];
      if (!bookData) continue;

      const fileset = selectAudioFileset(audioInfo.audioFilesets, bookCode, '');
      if (!fileset) continue;

      // Complete filesets have every chapter; partial ('...P') ones can have gaps,
      // so confirm the chapter has audio before navigating (avoids a dead player).
      const isPartial = String(fileset.size ?? '').toUpperCase().includes('P');
      if (!isPartial) return `${candidate}_1`;

      const chapter = parseInt(candidate.substring(2), 10);
      const base = getConfig().bibleBrainProxyBase;
      if (await this._chapterHasAudio(base, fileset.id, bookData.usfm, chapter)) {
        return `${candidate}_1`;
      }
    }
    return null;
  }

  async _chapterHasAudio(base, filesetId, usfm, chapter) {
    try {
      const response = await fetch(`${base}/bibles/filesets/${filesetId}/${usfm}/${chapter}`);
      if (!response.ok) return false;
      const json = await response.json();
      const entry = Array.isArray(json?.data) ? json.data[0] : null;
      return !!entry?.path;
    } catch {
      return false;
    }
  }

  async getNextFragment(textInfo, audioInfo, fragmentid) {
    return this._step(textInfo, audioInfo, fragmentid, 1);
  }

  async getPrevFragment(textInfo, audioInfo, fragmentid) {
    return this._step(textInfo, audioInfo, fragmentid, -1);
  }
}

/**
 * Bible Brain audio for an existing text whose *text* duplicates a Bible Brain
 * edition. The duplicate BB text is excluded from the picker, but its audio is
 * kept and matched back here by the text's id/abbr (like DbsAudioProvider, so it
 * doesn't rely on a field surviving on the textInfo). Registered last, so it only
 * fills in texts with no local or DBS audio.
 */
export class LinkedBibleBrainAudioProvider extends BibleBrainAudioProvider {
  get name() { return 'biblebrain-linked'; }

  async getAudioInfo(textInfo) {
    if (!isEnabled(getConfig())) return null;

    const audioFilesets = linkedAudioFor(textInfo)?.audioFilesets;
    if (!Array.isArray(audioFilesets) || audioFilesets.length === 0) return null;

    return {
      type: 'biblebrain',
      title: textInfo.name,
      audioFilesets,
      hasPlainAudio: audioFilesets.some(fs => fs.type === PLAIN_TYPE),
      hasDramaAudio: audioFilesets.some(fs => fs.type === DRAMA_TYPE)
    };
  }
}
