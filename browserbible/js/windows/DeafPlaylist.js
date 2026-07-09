// DeafPlaylist - pure playlist model for a Deaf Bible title: timeline items, navigation, and per-chapter marker math.

import { BOOK_DATA } from '../bible/BibleData.js';

// Parse a DBS duration ("5:21", "1:02:03") or number into seconds; returns 0 on unparseable input so callers can sum safely.
export function durationToSeconds(length) {
  if (typeof length === 'number') return Number.isFinite(length) && length > 0 ? length : 0;
  if (typeof length !== 'string' || length.trim() === '') return 0;

  const parts = length.split(':').map((n) => parseInt(n, 10));
  if (parts.some((n) => !Number.isFinite(n))) return 0;

  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

// Build a playlist model from ordered passage records.
export function DeafPlaylist(passages) {
  const items = (passages ?? []).map((p, index) => {
    const sectionid = p.sectionid;
    const bookid = sectionid.substring(0, 2);
    const chapter = sectionid.substring(2);

    return {
      index,
      fragmentid: `${sectionid}_${p.verse ?? 1}`,
      sectionid,
      bookid,
      chapter,
      book: p.book || BOOK_DATA[bookid]?.name || bookid,
      reference: p.reference || p.title || sectionid,
      title: p.title || p.reference || sectionid,
      urlHigh: p.web_url || p.web_url_low || '',
      urlLow: p.web_url_low || p.web_url || '',
      poster: p.cover || '',
      durationSec: durationToSeconds(p.length)
    };
  });

  const byFragment = new Map();
  const sectionOrder = [];
  const sectionItems = new Map();

  for (const it of items) {
    if (!byFragment.has(it.fragmentid)) byFragment.set(it.fragmentid, it.index);
    if (!sectionItems.has(it.sectionid)) {
      sectionItems.set(it.sectionid, []);
      sectionOrder.push(it.sectionid);
    }
    sectionItems.get(it.sectionid).push(it);
  }

  const get = (index) => items[index] ?? null;

  const itemsForSection = (sectionid) => sectionItems.get(sectionid) ?? [];

  const indexOfSection = (sectionid) => {
    const list = sectionItems.get(sectionid);
    return list && list.length ? list[0].index : -1;
  };

  const indexOfFragment = (fragmentid) => {
    if (fragmentid != null && byFragment.has(fragmentid)) return byFragment.get(fragmentid);
    const sectionid = String(fragmentid ?? '').split('_')[0];
    return indexOfSection(sectionid);
  };

  const next = (index) => (index + 1 < items.length ? index + 1 : -1);
  const prev = (index) => (index - 1 >= 0 ? index - 1 : -1);

  // Cumulative timeline for one chapter: total seconds plus each passage's start/end in seconds and as fractions of the total.
  const chapterTimeline = (sectionid) => {
    const list = itemsForSection(sectionid);
    const total = list.reduce((sum, it) => sum + it.durationSec, 0);

    let acc = 0;
    const markers = list.map((it) => {
      const startSec = acc;
      acc += it.durationSec;
      return {
        item: it,
        startSec,
        endSec: acc,
        startFraction: total > 0 ? startSec / total : 0,
        endFraction: total > 0 ? acc / total : 0
      };
    });

    return { total, markers };
  };

  const sectionsForBook = (bookid) => sectionOrder.filter((s) => s.substring(0, 2) === bookid);

  return {
    items,
    length: items.length,
    isEmpty: items.length === 0,
    sections: sectionOrder,
    get,
    itemsForSection,
    indexOfSection,
    indexOfFragment,
    next,
    prev,
    chapterTimeline,
    sectionsForBook
  };
}
