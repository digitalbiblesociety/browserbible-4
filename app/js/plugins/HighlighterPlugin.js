/**
 * HighlighterPlugin
 * Allows users to highlight text selections in Bible verses.
 * Highlights are persisted in localStorage, keyed by Bible version (textid).
 */

import { getConfig } from '../core/config.js';
import { elem } from '../lib/helpers.esm.js';
import { getWindowIcon } from '../core/windowIcons.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';

const STORAGE_KEY = 'browserbible_highlights';
const SKIP_SELECTORS = '.verse-num, .v-num, .note, .cf, .chapter-num, .c, .c-num';
const CONTROLLER_SELECTORS = 'bible-window, commentary-window';

const COLORS = [
  { name: 'yellow', value: '#ff7' },
  { name: 'green', value: '#ada' },
  { name: 'blue', value: '#9cf' },
  { name: 'pink', value: '#f8b' },
  { name: 'orange', value: '#fc8' }
];

// ─── LocalStorage ──────────────────────────────────────────────────────────────

function loadHighlights() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveHighlights(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // storage full or unavailable
  }
}

function addHighlight(textid, highlight) {
  const data = loadHighlights();
  if (!data[textid]) data[textid] = [];
  data[textid].push(highlight);
  saveHighlights(data);
}

function removeHighlight(textid, highlightId) {
  const data = loadHighlights();
  if (!data[textid]) return;
  data[textid] = data[textid].filter(h => h.id !== highlightId);
  if (data[textid].length === 0) delete data[textid];
  saveHighlights(data);
}

function updateHighlightColor(textid, highlightId, newColor) {
  const data = loadHighlights();
  if (!data[textid]) return;
  const hl = data[textid].find(h => h.id === highlightId);
  if (hl) {
    hl.color = newColor;
    saveHighlights(data);
  }
}

function getHighlightsForVerse(textid, verseId) {
  const data = loadHighlights();
  if (!data[textid]) return [];
  return data[textid].filter(h => h.verseId === verseId);
}

// ─── Controller / TextId Utilities ──────────────────────────────────────────────

/**
 * Get the textid for a Bible window by finding its web component controller
 */
function getTextIdFromElement(el) {
  const controller = el.closest(CONTROLLER_SELECTORS)
    || el.querySelector(CONTROLLER_SELECTORS);
  return controller?.state?.currentTextInfo?.id || null;
}

// ─── Text Offset Utilities ─────────────────────────────────────────────────────

/**
 * Get all text nodes within an element, skipping verse numbers/notes/etc
 */
function getTextNodes(el) {
  const nodes = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      let parent = node.parentElement;
      while (parent && parent !== el) {
        if (parent.matches(SKIP_SELECTORS)) return NodeFilter.FILTER_REJECT;
        // Skip existing highlight marks for offset calculation during restore
        if (parent.classList.contains('user-highlight')) {
          // Don't skip content inside highlights - we need to count those chars
        }
        parent = parent.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }
  return nodes;
}

/**
 * Compute the character offset within the verse's visible text
 * from a DOM selection anchor/focus
 */
function getVerseOffset(verseEl, node, offset) {
  const textNodes = getTextNodes(verseEl);
  let charCount = 0;
  for (const tn of textNodes) {
    if (tn === node) {
      return charCount + offset;
    }
    charCount += tn.textContent.length;
  }
  // If the node is an element, try to find the position
  if (node.nodeType === Node.ELEMENT_NODE) {
    const childNodes = Array.from(node.childNodes);
    const targetNode = childNodes[offset] || childNodes[childNodes.length - 1];
    if (targetNode) {
      charCount = 0;
      for (const tn of textNodes) {
        if (targetNode === tn || targetNode.contains?.(tn)) {
          return charCount;
        }
        charCount += tn.textContent.length;
      }
    }
  }
  return charCount;
}

/**
 * Find the text node and offset for a given character position
 */
function findNodeAtOffset(verseEl, targetOffset) {
  const textNodes = getTextNodes(verseEl);
  let charCount = 0;
  for (const tn of textNodes) {
    const len = tn.textContent.length;
    if (charCount + len > targetOffset) {
      return { node: tn, offset: targetOffset - charCount };
    }
    charCount += len;
  }
  const lastNode = textNodes[textNodes.length - 1];
  if (lastNode) {
    return { node: lastNode, offset: lastNode.textContent.length };
  }
  return null;
}

/**
 * Wrap a range within a verse element with a highlight mark
 */
function applyHighlightMark(verseEl, startOffset, endOffset, color, hlId) {
  const start = findNodeAtOffset(verseEl, startOffset);
  const end = findNodeAtOffset(verseEl, endOffset);
  if (!start || !end) return;

  try {
    const range = document.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);

    const mark = document.createElement('mark');
    mark.className = 'user-highlight';
    mark.dataset.hlId = hlId;
    mark.style.backgroundColor = color;
    range.surroundContents(mark);
  } catch {
    // surroundContents can fail if range crosses element boundaries
    applyHighlightFallback(verseEl, startOffset, endOffset, color, hlId);
  }
}

/**
 * Fallback highlight application for cross-element ranges
 */
function applyHighlightFallback(verseEl, startOffset, endOffset, color, hlId) {
  const textNodes = getTextNodes(verseEl);
  let charCount = 0;

  for (const tn of textNodes) {
    const nodeStart = charCount;
    const nodeEnd = charCount + tn.textContent.length;

    const overlapStart = Math.max(startOffset, nodeStart);
    const overlapEnd = Math.min(endOffset, nodeEnd);

    if (overlapStart < overlapEnd) {
      const localStart = overlapStart - nodeStart;
      const localEnd = overlapEnd - nodeStart;

      const range = document.createRange();
      range.setStart(tn, localStart);
      range.setEnd(tn, localEnd);

      const mark = document.createElement('mark');
      mark.className = 'user-highlight';
      mark.dataset.hlId = hlId;
      mark.style.backgroundColor = color;

      try {
        range.surroundContents(mark);
      } catch {
        // skip this node if it still fails
      }
    }

    charCount = nodeEnd;
    if (charCount >= endOffset) break;
  }
}

/**
 * Remove all highlight marks with a given ID from the document
 */
function removeHighlightMarks(hlId) {
  document.querySelectorAll(`.user-highlight[data-hl-id="${hlId}"]`).forEach(mark => {
    const parent = mark.parentNode;
    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);
    parent.normalize();
  });
}

/**
 * Change the color of existing highlight marks in the DOM
 */
function recolorHighlightMarks(hlId, newColor) {
  document.querySelectorAll(`.user-highlight[data-hl-id="${hlId}"]`).forEach(mark => {
    mark.style.backgroundColor = newColor;
  });
}

// ─── Color Palette ──────────────────────────────────────────────────────────────

function createPalette(onColorPick, onErase) {
  const palette = elem('div', { className: 'highlighter-palette' });
  palette.style.display = 'none';

  for (const c of COLORS) {
    const swatch = elem('div', {
      className: 'color-swatch',
      title: c.name
    });
    swatch.dataset.color = c.value;
    swatch.style.backgroundColor = c.value;
    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      onColorPick(c.value);
    });
    palette.appendChild(swatch);
  }

  const eraser = elem('div', { className: 'eraser', title: 'Remove highlight' });
  eraser.textContent = '\u2715';
  eraser.addEventListener('click', (e) => {
    e.stopPropagation();
    onErase();
  });
  palette.appendChild(eraser);

  document.body.appendChild(palette);
  return palette;
}

function showPalette(palette, x, y, activeColor) {
  palette.style.display = 'flex';
  palette.style.left = `${x}px`;
  palette.style.top = `${y}px`;

  // Mark the currently active color
  palette.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.classList.toggle('selected', swatch.dataset.color === activeColor);
  });

  // Keep palette within viewport
  requestAnimationFrame(() => {
    const rect = palette.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      palette.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
    if (rect.bottom > window.innerHeight) {
      palette.style.top = `${y - rect.height - 8}px`;
    }
  });
}

function hidePalette(palette) {
  palette.style.display = 'none';
}

// ─── Plugin ─────────────────────────────────────────────────────────────────────

/**
 * Create the highlighter plugin
 * @param {Object} app - Application instance
 * @returns {Object} Plugin API
 */
export const HighlighterPlugin = (app) => {
  const config = getConfig();
  if (!config.enableHighlighterPlugin) return {};

  let active = false;

  // Pending state for new highlights (text selection)
  let pendingSelection = null;
  let pendingVerse = null;
  let pendingTextId = null;

  // Pending state for editing existing highlights (click on mark)
  let pendingEditHlId = null;
  let pendingEditTextId = null;

  // ─── Menu Toggle Button ──────────────────────────────────────────────────

  const toggleButton = elem('div', {
    className: 'main-menu-item highlighter-toggle',
  });
  const highlighterIconSpan = elem('span', { className: 'main-menu-icon' });
  highlighterIconSpan.innerHTML = getWindowIcon('highlighter') || '';
  toggleButton.appendChild(highlighterIconSpan);
  toggleButton.appendChild(document.createTextNode('Highlight'));

  document.querySelector('#main-menu-features')?.appendChild(toggleButton);

  const setActive = (state) => {
    active = state;
    toggleButton.classList.toggle('active', active);
    document.body.classList.toggle('highlighter-active', active);
    if (!active) {
      hidePalette(palette);
      window.getSelection()?.removeAllRanges();
    }
  };

  toggleButton.addEventListener('click', (e) => {
    e.preventDefault();
    setActive(!active);

    const mainMenuDropdown = document.querySelector('#main-menu-dropdown');
    if (mainMenuDropdown?.matches(':popover-open')) {
      mainMenuDropdown.hidePopover();
    }
  });

  // ─── Color Palette ────────────────────────────────────────────────────────

  const handleColorPick = (color) => {
    // Case 1: Editing an existing highlight's color
    if (pendingEditHlId && pendingEditTextId) {
      recolorHighlightMarks(pendingEditHlId, color);
      updateHighlightColor(pendingEditTextId, pendingEditHlId, color);
      hidePalette(palette);
      clearPending();
      return;
    }

    // Case 2: Creating a new highlight from text selection
    if (!pendingVerse || !pendingSelection || !pendingTextId) {
      hidePalette(palette);
      return;
    }

    const { startOffset, endOffset } = pendingSelection;

    const highlight = {
      id: 'hl_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9),
      verseId: pendingVerse.getAttribute('data-id'),
      startOffset,
      endOffset,
      color,
      created: Date.now()
    };

    window.getSelection()?.removeAllRanges();
    applyHighlightMark(pendingVerse, startOffset, endOffset, color, highlight.id);
    addHighlight(pendingTextId, highlight);

    hidePalette(palette);
    clearPending();
  };

  const handleErase = () => {
    // If editing an existing highlight, remove it
    if (pendingEditHlId && pendingEditTextId) {
      removeHighlightMarks(pendingEditHlId);
      removeHighlight(pendingEditTextId, pendingEditHlId);
    }
    hidePalette(palette);
    clearPending();
  };

  const clearPending = () => {
    pendingSelection = null;
    pendingVerse = null;
    pendingTextId = null;
    pendingEditHlId = null;
    pendingEditTextId = null;
  };

  const palette = createPalette(handleColorPick, handleErase);

  // ─── Text Selection Handling ──────────────────────────────────────────────

  const windowsMain = document.querySelector('.windows-main');

  if (windowsMain) {
    windowsMain.addEventListener('mouseup', (e) => {
      if (!active) return;

      setTimeout(() => {
        const selection = window.getSelection();

        // No selection — check if clicking an existing highlight to edit
        if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
          const existingMark = e.target.closest('.user-highlight');
          if (existingMark) {
            const hlId = existingMark.dataset.hlId;
            const textid = getTextIdFromElement(existingMark);
            if (hlId && textid) {
              pendingEditHlId = hlId;
              pendingEditTextId = textid;
              const rect = existingMark.getBoundingClientRect();
              showPalette(palette,
                rect.left + rect.width / 2 - 75,
                rect.top - 40,
                existingMark.style.backgroundColor
              );
            }
          }
          return;
        }

        // Text selection — show palette for new highlight
        const range = selection.getRangeAt(0);
        const ancestor = range.commonAncestorContainer;
        const verse = ancestor.nodeType === Node.TEXT_NODE
          ? ancestor.parentElement?.closest('.verse, .v')
          : ancestor.closest?.('.verse, .v');

        if (!verse) {
          hidePalette(palette);
          return;
        }

        const textid = getTextIdFromElement(verse);
        if (!textid) {
          hidePalette(palette);
          return;
        }

        const startOffset = getVerseOffset(verse, range.startContainer, range.startOffset);
        const endOffset = getVerseOffset(verse, range.endContainer, range.endOffset);

        if (startOffset === endOffset) {
          hidePalette(palette);
          return;
        }

        pendingSelection = {
          startOffset: Math.min(startOffset, endOffset),
          endOffset: Math.max(startOffset, endOffset)
        };
        pendingVerse = verse;
        pendingTextId = textid;

        const rect = range.getBoundingClientRect();
        showPalette(palette, rect.left + rect.width / 2 - 75, rect.top - 40, null);
      }, 10);
    });

    document.addEventListener('mousedown', (e) => {
      if (!palette.contains(e.target) && palette.style.display !== 'none') {
        hidePalette(palette);
        clearPending();
      }
    });
  }

  // ─── Apply Highlights on Text Load ────────────────────────────────────────

  function applyHighlightsToSection(textid, sectionEl) {
    if (!sectionEl || !textid) return;

    const verses = sectionEl.querySelectorAll('.verse, .v');
    for (const verse of verses) {
      const verseId = verse.getAttribute('data-id');
      if (!verseId) continue;

      const highlights = getHighlightsForVerse(textid, verseId);
      // Sort by startOffset descending so earlier marks don't shift later offsets
      highlights.sort((a, b) => b.startOffset - a.startOffset);

      for (const hl of highlights) {
        applyHighlightMark(verse, hl.startOffset, hl.endOffset, hl.color, hl.id);
      }
    }
  }

  // ─── Global Message Handling ──────────────────────────────────────────────

  let ext = {};
  mixinEventEmitter(ext);
  ext._events = {};

  ext.on('message', (e) => {
    const { data } = e;

    if (data.messagetype === 'textload' && data.textid && data.sectionid) {
      // Apply highlights to the newly loaded section.
      // Use a short delay to ensure the DOM has been updated.
      setTimeout(() => {
        document.querySelectorAll(CONTROLLER_SELECTORS).forEach(controller => {
          const ctrlTextId = controller.state?.currentTextInfo?.id;
          if (ctrlTextId !== data.textid) return;

          const section = controller.querySelector(`.section.${data.sectionid}`);
          if (!section) return;
          // Don't re-apply if already processed
          if (section.dataset.hlApplied) return;

          section.dataset.hlApplied = 'true';
          applyHighlightsToSection(data.textid, section);
        });
      }, 50);
    }
  });

  return ext;
};

export default HighlighterPlugin;
