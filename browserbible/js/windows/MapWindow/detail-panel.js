/**
 * Detail Panel
 * Popover-based location detail panel using the native popover API
 */

import { Reference } from '../../bible/BibleReference.js';
import { BOOK_DATA } from '../../bible/BibleData.js';
import { getLocationTypeName } from './icon-library.js';
import { getImportanceTier } from './geo-utils.js';

const TIER_LABELS = {
  1: 'Major location',
  2: 'Important location',
  3: 'Notable location',
  4: 'Minor location'
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Extract verse text from any Bible window currently rendered in the DOM.
 * Bible windows give each verse element a CSS class matching its verse ID (e.g. "GN12_6").
 */
function getVerseTextFromDOM(verseId) {
  const el = document.querySelector(`.${CSS.escape(verseId)}`);
  if (!el) return null;
  const clone = el.cloneNode(true);
  clone.querySelectorAll('.note, .cf, .vnum, .v-num, .verse-num, sup').forEach(n => n.remove());
  return clone.textContent.trim() || null;
}

/**
 * Build a flat list of verse items with full references and text snippets.
 * Text is sourced from the provided lookup first, then falls back to the live DOM.
 * @param {string[]} verses - Array of verse IDs (e.g., "GN12_6", "JS24_1")
 * @param {Function|null} verseTextLookup - Optional (verseId) => string | null
 * @returns {Array} [{sectionid, fragmentid, display, text}]
 */
function buildVerseList(verses, verseTextLookup) {
  return verses.map(verseId => {
    const ref = new Reference(verseId);
    const bookName = BOOK_DATA[ref.bookid]?.names?.eng?.[0] ?? ref.bookid;
    const sectionid = ref.bookid + ref.chapter1;
    const fragmentid = `${sectionid}_${ref.verse1}`;
    const text = verseTextLookup?.(verseId) ?? getVerseTextFromDOM(verseId);
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
 * Each row carries .verse so existing click handlers still work.
 */
function renderVerseList(verseItems) {
  return verseItems.map(item => {
    const textHtml = item.text
      ? `<span class="search-result-text">${escapeHtml(item.text.length > 150 ? item.text.slice(0, 150) + '…' : item.text)}</span>`
      : '';
    return `<div class="search-result-row verse" data-sectionid="${item.sectionid}" data-fragmentid="${item.fragmentid}">
      <span class="search-result-ref">${escapeHtml(item.display)}</span>
      ${textHtml}
    </div>`;
  }).join('');
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
 */
export function openDetailPanel(panel, location, anchorRect, verseTextLookup = null, colocated = []) {
  panel._colocatedLocations = colocated;
  panel.innerHTML = buildDetailHTML(location, verseTextLookup, colocated);

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
export function closeDetailPanel(panel) {
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
    closeDetailPanel(panel);
    panel.remove();
  }
}
