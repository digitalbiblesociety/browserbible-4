/**
 * Print notes, optionally inlining the text of detected verse references.
 *
 * Verse text loads through the app's own text providers (TextLoader), so
 * printing works offline with local content. All note-derived strings are
 * escaped/sanitized before they reach the print document.
 */

import { loadSection } from '../../texts/TextLoader.js';
import { getConfig } from '../../core/config.js';
import { t } from '../../lib/i18n.js';
import { showNotice } from './notice.js';
import { stripHtml, escapeHtml, sanitizeHtml } from './sanitize.js';
import { detectReferences } from './references.js';

// loadSection never calls back when a text's provider is missing; don't let
// one bad reference hang the whole print job.
const SECTION_LOAD_TIMEOUT_MS = 15_000;

function loadSectionAsync(textid, sectionid) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out loading ${textid}/${sectionid}`)),
      SECTION_LOAD_TIMEOUT_MS
    );
    loadSection(
      textid,
      sectionid,
      (node) => { clearTimeout(timer); resolve(node); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/**
 * Pull the verse text for a detected reference out of a loaded section node.
 * loadSection hands each caller a freshly built node, so in-place cleanup
 * of footnotes/verse numbers is safe.
 */
function extractVersesFromNode(sectionEl, { sectionid, startVerse, endVerse }) {
  if (!sectionEl) return '';

  if (!startVerse) {
    // Chapter-only reference: use the whole section
    sectionEl.querySelectorAll('.note, .cf, .v-num, .verse-num').forEach(el => el.remove());
    return sectionEl.textContent?.trim() || '';
  }

  const texts = [];
  const start = startVerse;
  const end = endVerse || start;

  for (let v = start; v <= end; v++) {
    const verseId = `${sectionid}_${v}`;
    const verseEl = sectionEl.querySelector(`[data-id="${verseId}"], .${verseId}`);
    if (verseEl) {
      verseEl.querySelectorAll('.note, .cf').forEach(el => el.remove());
      verseEl.querySelectorAll('.v-num, .verse-num').forEach(el => el.remove());
      const text = verseEl.textContent?.trim();
      if (text) {
        texts.push(start !== end ? `${v} ${text}` : text);
      }
    }
  }

  return texts.join(' ');
}

async function loadVerseText(textid, ref) {
  try {
    const sectionEl = await loadSectionAsync(textid, ref.sectionid);
    return extractVersesFromNode(sectionEl, ref);
  } catch (err) {
    console.warn('[print] Could not load verse text for', ref.label, err);
    return '';
  }
}

/**
 * Sanitize note content and, when requested, append blockquotes with the
 * text of each detected verse reference. Verses that fail to load are
 * skipped so printing still works offline.
 * @param {string} textid - Bible version to load verse text from
 * @returns {Promise<string>}
 */
async function processNoteContentForPrint(htmlContent, includeVerseText, textid) {
  const safeHtml = sanitizeHtml(htmlContent || '');
  if (!includeVerseText || !safeHtml) return safeHtml;

  const refs = detectReferences(stripHtml(safeHtml));
  if (refs.length === 0) return safeHtml;

  const verseTexts = await Promise.all(
    refs.map(async (ref) => ({ ref, text: await loadVerseText(textid, ref) }))
  );

  const blockquotes = verseTexts
    .filter((v) => v.text)
    .map((v) =>
      `<blockquote class="print-verse-text"><strong>${escapeHtml(v.ref.label)}</strong><br>${escapeHtml(v.text)}</blockquote>`
    )
    .join('\n');

  return safeHtml + (blockquotes ? '\n' + blockquotes : '');
}

function buildPrintHtml(title, notesHtml) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #222;
      padding: 0.5in;
      max-width: 8.5in;
      margin: 0 auto;
    }
    h1 {
      font-size: 18pt;
      margin-bottom: 12pt;
      border-bottom: 2px solid #333;
      padding-bottom: 6pt;
    }
    .print-note {
      margin-bottom: 24pt;
      page-break-inside: avoid;
    }
    .print-note + .print-note {
      border-top: 1px solid #ccc;
      padding-top: 18pt;
    }
    .print-note-title {
      font-size: 14pt;
      font-weight: bold;
      margin-bottom: 4pt;
    }
    .print-meta {
      font-size: 9pt;
      color: #666;
      margin-bottom: 8pt;
      font-style: italic;
    }
    .print-content {
      margin-bottom: 8pt;
    }
    .print-content p { margin-bottom: 6pt; }
    .print-content ul, .print-content ol { margin-left: 18pt; margin-bottom: 6pt; }
    .print-content h2 { font-size: 13pt; margin: 8pt 0 4pt; }
    .print-content h3 { font-size: 12pt; margin: 6pt 0 4pt; }
    .print-verse-text {
      margin: 8pt 0 8pt 12pt;
      padding: 6pt 12pt;
      border-left: 3px solid #888;
      background: #f8f8f8;
      font-size: 11pt;
      color: #444;
    }
    .print-verse-text strong {
      display: block;
      font-size: 10pt;
      color: #333;
      margin-bottom: 2pt;
    }
    @media print {
      body { padding: 0; }
      .print-no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="print-no-print" style="text-align:center;margin-bottom:12pt;">
    <button onclick="window.print()" style="font-size:14pt;padding:8px 24px;cursor:pointer;">${escapeHtml(t('windows.notes.printButton'))}</button>
    <button onclick="window.close()" style="font-size:14pt;padding:8px 24px;cursor:pointer;margin-left:8px;">${escapeHtml(t('windows.notes.closeButton'))}</button>
  </div>
  <h1>${escapeHtml(title)}</h1>
  ${notesHtml}
</body>
</html>`;
}

/**
 * Print notes (main entry point). Must be called from a user gesture: the
 * popup opens synchronously (before any await) so popup blockers allow it,
 * then the assembled document loads into it via a Blob URL. Nothing goes
 * through document.write.
 * @param {Array} notes - Note objects to print
 * @param {{ includeVerseText?: boolean, title?: string, textId?: string }} options
 */
export async function printNotes(notes, options = {}) {
  if (!notes || notes.length === 0) {
    showNotice(t('windows.notes.noNotesToPrint'));
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    showNotice(t('windows.notes.popupBlocked'));
    return;
  }
  try {
    printWindow.document.body.textContent = t('windows.notes.preparingPrint');
  } catch {
    // Cross-origin surprises are non-fatal; the blob navigation still lands.
  }

  const includeVerseText = options.includeVerseText || false;
  const textId = options.textId || getConfig().newBibleWindowVersion;
  const title = options.title ||
    (notes.length === 1 ? (notes[0].title || t('windows.notes.untitled')) : t('windows.notes.label'));

  let fullHtml;
  try {
    const noteHtmlParts = [];
    for (const note of notes) {
      const metaParts = [];
      if (note.referenceDisplay) {
        metaParts.push(`${t('windows.notes.verseLabel')}: ${escapeHtml(note.referenceDisplay)}`);
      }
      metaParts.push(`${t('windows.notes.modifiedLabel')}: ${escapeHtml(new Date(note.modified).toLocaleString())}`);

      const content = await processNoteContentForPrint(note.content || '', includeVerseText, textId);

      noteHtmlParts.push(
        `<div class="print-note">
          <div class="print-note-title">${escapeHtml(note.title || t('windows.notes.untitled'))}</div>
          <div class="print-meta">${metaParts.join(' | ')}</div>
          <div class="print-content">${content}</div>
        </div>`
      );
    }
    fullHtml = buildPrintHtml(title, noteHtmlParts.join('\n'));
  } catch (err) {
    printWindow.close();
    throw err;
  }

  const url = URL.createObjectURL(new Blob([fullHtml], { type: 'text/html' }));
  printWindow.location = url;
  // The blob must stay alive until the popup finishes loading it; a
  // load-event revoke is unreliable cross-window, so just wait it out.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
