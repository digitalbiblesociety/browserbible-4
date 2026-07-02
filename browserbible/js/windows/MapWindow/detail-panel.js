/**
 * Detail Panel
 * Popover-based location detail panel using the native popover API
 */

import { Reference } from '../../bible/BibleReference.js';
import { BOOK_DATA } from '../../bible/BibleData.js';
import { loadSection } from '../../texts/TextLoader.js';
import { getConfig } from '../../core/config.js';
import { i18n } from '../../lib/i18n.js';
import { getLocationTypeName } from './icon-library.js';
import { getImportanceTier } from './geo-utils.js';

const TIER_LABELS = {
  1: 'Major location',
  2: 'Important location',
  3: 'Notable location',
  4: 'Minor location'
};

// Sections fetched immediately when a detail panel opens; the rest hydrate
// as their rows scroll into view (Jerusalem-scale locations have hundreds of verses).
const EAGER_HYDRATE_SECTIONS = 10;

const SNIPPET_LENGTH = 150;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function truncate(text) {
  return text.length > SNIPPET_LENGTH ? text.slice(0, SNIPPET_LENGTH) + '…' : text;
}

/** Verse element → plain snippet text (notes, cross-refs, and verse numbers stripped). */
function cleanVerseText(el) {
  const clone = el.cloneNode(true);
  clone.querySelectorAll('.note, .cf, .vnum, .v-num, .verse-num, sup').forEach(n => n.remove());
  return clone.textContent.trim() || null;
}

/**
 * Verse elements rendered in Bible windows, indexed by verse ID: one DOM
 * query instead of a document-wide querySelector per verse.
 */
function buildDomVerseIndex() {
  const index = new Map();
  document.querySelectorAll('.BibleWindow .verse[data-id], .BibleWindow .v[data-id]').forEach(el => {
    const id = el.getAttribute('data-id');
    if (!index.has(id)) index.set(id, el);
  });
  return index;
}

/**
 * Build a flat list of verse items with full references and text snippets.
 * Text is sourced from the provided lookup first, then falls back to the live DOM.
 * @param {string[]} verses - Array of verse IDs (e.g., "GN12_6", "JS24_1")
 * @param {Function|null} verseTextLookup - Optional (verseId) => string | null
 * @returns {Array} [{sectionid, fragmentid, display, text}]
 */
function buildVerseList(verses, verseTextLookup) {
  let domIndex = null; // built on first use
  const domVerseText = (verseId) => {
    if (!domIndex) domIndex = buildDomVerseIndex();
    const el = domIndex.get(verseId);
    return el ? cleanVerseText(el) : null;
  };

  return verses.map(verseId => {
    const ref = new Reference(verseId);
    const bookName = BOOK_DATA[ref.bookid]?.names?.eng?.[0] ?? ref.bookid;
    const sectionid = ref.bookid + ref.chapter1;
    const fragmentid = `${sectionid}_${ref.verse1}`;
    const text = verseTextLookup?.(verseId) ?? domVerseText(verseId);
    return {
      sectionid,
      fragmentid,
      display: `${bookName} ${ref.chapter1}:${ref.verse1}`,
      text
    };
  });
}

/**
 * Render the verse list using search-result CSS classes (shared with SearchWindow).
 * Each row carries .verse so existing click handlers still work. Rows without
 * synchronously-available text get a pending placeholder that hydrateVerseTexts fills.
 */
function renderVerseList(verseItems) {
  const openTitle = escapeHtml(i18n.t('windows.map.openinbible'));
  return verseItems.map(item => {
    const textHtml = item.text
      ? `<span class="search-result-text">${escapeHtml(truncate(item.text))}</span>`
      : '<span class="search-result-text verse-text-pending">…</span>';
    return `<div class="search-result-row verse" title="${openTitle}" data-sectionid="${item.sectionid}" data-fragmentid="${item.fragmentid}">
      <span class="search-result-ref">${escapeHtml(item.display)}</span>
      ${textHtml}
    </div>`;
  }).join('');
}

/**
 * Fill pending verse rows with text fetched on demand via TextLoader.
 * Rows are grouped by section; the first EAGER_HYDRATE_SECTIONS sections load
 * immediately, the rest when scrolled into view. Failed or absent verses show
 * an i18n'd "not available" message — never a silent blank.
 *
 * @param {HTMLElement} containerEl - Element containing the rendered verse rows
 * @param {string|null} textid - Bible text to fetch from (falls back to the first
 *   rendered Bible section's text, then the configured default version)
 * @param {Function} [loadSectionFn] - Injectable for tests; defaults to TextLoader.loadSection
 */
export function hydrateVerseTexts(containerEl, textid, loadSectionFn = loadSection) {
  if (!containerEl) return;

  // Re-hydration replaces the content — drop any observer watching stale rows
  containerEl._hydrateObserver?.disconnect();
  containerEl._hydrateObserver = null;

  const pending = containerEl.querySelectorAll('.verse-text-pending');
  if (!pending.length) return;

  const resolvedTextid = textid
    || document.querySelector('.BibleWindow .section[data-textid]')?.getAttribute('data-textid')
    || getConfig().newBibleWindowVersion;
  if (!resolvedTextid) return;

  // Group pending rows by section so each section is fetched once
  const bySection = new Map();
  for (const span of pending) {
    const row = span.closest('.verse');
    const sectionid = row?.getAttribute('data-sectionid');
    if (!sectionid) continue;
    if (!bySection.has(sectionid)) bySection.set(sectionid, []);
    bySection.get(sectionid).push({ span, row });
  }

  const fill = (span, text) => {
    span.classList.remove('verse-text-pending');
    if (text) {
      span.textContent = truncate(text);
    } else {
      span.classList.add('verse-text-missing');
      span.textContent = i18n.t('windows.map.versenotloaded');
    }
  };

  const hydrateSection = (sectionid) => {
    const entries = bySection.get(sectionid);
    if (!entries) return;
    bySection.delete(sectionid);

    loadSectionFn(resolvedTextid, sectionid, (contentEl) => {
      for (const { span, row } of entries) {
        const fragmentid = row.getAttribute('data-fragmentid');
        // A verse can be split across elements (e.g. paragraph breaks) — join them
        const parts = [...contentEl.querySelectorAll(`.${CSS.escape(fragmentid)}`)]
          .map(cleanVerseText).filter(Boolean);
        fill(span, parts.length ? parts.join(' ') : null);
      }
    }, () => {
      for (const { span } of entries) fill(span, null);
    });
  };

  const sectionids = [...bySection.keys()];
  sectionids.slice(0, EAGER_HYDRATE_SECTIONS).forEach(hydrateSection);

  const lazySections = new Set(sectionids.slice(EAGER_HYDRATE_SECTIONS));
  if (!lazySections.size) return;

  if (typeof IntersectionObserver !== 'function') {
    lazySections.forEach(hydrateSection);
    return;
  }

  const observer = new IntersectionObserver((observations) => {
    for (const obs of observations) {
      if (!obs.isIntersecting) continue;
      observer.unobserve(obs.target); // done watching this row
      const sectionid = obs.target.getAttribute('data-sectionid');
      hydrateSection(sectionid); // no-op if already hydrated
    }
    if (!bySection.size) observer.disconnect();
  }, { root: containerEl, rootMargin: '200px 0px' });

  for (const sectionid of lazySections) {
    for (const { row } of bySection.get(sectionid)) observer.observe(row);
  }
  containerEl._hydrateObserver = observer;
}

/**
 * Create the detail panel popover element
 * @returns {HTMLElement} The popover element
 */
export function createDetailPanel() {
  const panel = document.createElement('div');
  panel.className = 'map-detail-panel';
  panel.setAttribute('popover', '');
  document.body.appendChild(panel);
  return panel;
}

/**
 * Build the inner HTML for a location detail panel.
 * Shared by the popover (openDetailPanel) and inline renderers (MediaWindow).
 */
export function buildDetailHTML(location, verseTextLookup = null, colocated = []) {
  const tier = getImportanceTier(location);
  const verseItems = buildVerseList(location.verses, verseTextLookup);
  const typeName = getLocationTypeName(location.type || 'other');

  const colocatedHtml = colocated.length > 0
    ? `<div class="map-detail-colocated">
        <span class="map-detail-colocated-label">Also here:</span>
        ${colocated.map((loc, i) =>
          `<span class="map-detail-colocated-item" data-index="${i}">${escapeHtml(loc.name)}</span>`
        ).join('')}
      </div>`
    : '';

  return `
    <div class="map-detail-header">
      <h2>${escapeHtml(location.name)}</h2>
      <div class="map-detail-meta">
        <span class="map-detail-type">${escapeHtml(typeName)}</span>
        <span class="map-detail-separator">&middot;</span>
        <span class="map-detail-tier">${TIER_LABELS[tier]}</span>
        <span class="map-detail-separator">&middot;</span>
        <span class="map-detail-count">${location.verses.length} verses</span>
      </div>
      ${colocatedHtml}
    </div>
    <div class="map-detail-verses">
      ${renderVerseList(verseItems)}
    </div>
  `;
}

/**
 * Open the detail panel for a location
 * @param {HTMLElement} panel - The popover element
 * @param {Object} location - Location data object
 * @param {DOMRect} anchorRect - Bounding rect of the clicked marker (screen coords)
 * @param {string|null} textid - Bible text used to hydrate verse snippets on demand
 */
export function openDetailPanel(panel, location, anchorRect, verseTextLookup = null, colocated = [], textid = null) {
  panel._colocatedLocations = colocated;
  panel.innerHTML = buildDetailHTML(location, verseTextLookup, colocated);
  hydrateVerseTexts(panel, textid);

  // Position near the anchor
  if (anchorRect) {
    const panelWidth = 300;
    let top = anchorRect.bottom + 8;
    let left = anchorRect.left + anchorRect.width / 2 - panelWidth / 2;

    // Clamp to viewport
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));

    // If too close to bottom, show above
    if (top + 200 > window.innerHeight) {
      top = anchorRect.top - 8;
      panel.style.transform = 'translateY(-100%)';
    } else {
      panel.style.transform = '';
    }

    panel.style.top = `${top}px`;
    panel.style.left = `${left}px`;
  }

  panel.showPopover();
}

/**
 * Close the detail panel
 * @param {HTMLElement} panel - The popover element
 */
function closeDetailPanel(panel) {
  if (panel?.matches(':popover-open')) {
    panel.hidePopover();
  }
}

/**
 * Clean up and remove the detail panel from DOM
 * @param {HTMLElement} panel - The popover element
 */
export function destroyDetailPanel(panel) {
  if (panel) {
    panel._hydrateObserver?.disconnect();
    panel._hydrateObserver = null;
    closeDetailPanel(panel);
    panel.remove();
  }
}
