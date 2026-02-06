/**
 * NotesWindow Print Functions
 * Print notes with optional inline verse text via verse-detection
 */

import { createVerseDetector } from '@verse-detection/VerseDetectionPlugin.js';
import { BOOK_CODES } from '@verse-detection/BookCodes.js';

const CONTENT_BASE_URL = 'https://inscript.bible.cloud/content/texts';
const DEFAULT_TEXT_ID = 'ENGWEB';

/**
 * Strip HTML tags to get plain text, preserving whitespace between block elements
 */
function stripHtml(html) {
  // Replace block-level tags (both opening and closing) with newlines
  // so verse references at block boundaries don't run together
  const spaced = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:div|p|li|h[1-6]|blockquote|tr)[^>]*>/gi, '\n');
  const tmp = document.createElement('div');
  tmp.innerHTML = spaced;
  return tmp.textContent || tmp.innerText || '';
}

/**
 * Parse a verse reference string into components for fetching
 * @param {string} book - Canonical book name
 * @param {string} reference - Chapter:verse reference string
 * @returns {{ sectionId: string, startVerse: number|null, endVerse: number|null } | null}
 */
function parseRefForFetch(book, reference) {
  const bookCode = BOOK_CODES[book];
  if (!bookCode) return null;

  const chapterMatch = reference.match(/^(\d+)/);
  if (!chapterMatch) return null;

  const chapter = chapterMatch[1];
  const sectionId = `${bookCode}${chapter}`;

  const verseMatch = reference.match(/:(\d+)/);
  const endVerseMatch = reference.match(/:(\d+)\s*[-\u2013\u2014]\s*(\d+)/);

  let startVerse = verseMatch ? parseInt(verseMatch[1], 10) : null;
  let endVerse = endVerseMatch ? parseInt(endVerseMatch[2], 10) : startVerse;

  return { sectionId, startVerse, endVerse };
}

/**
 * Fetch verse text from remote chapter HTML
 * @param {string} book - Canonical book name
 * @param {string} reference - Reference string like "3:16"
 * @param {string} [textId] - Text/version ID override
 * @returns {Promise<string>} Verse text content
 */
async function fetchVerseText(book, reference, textId) {
  const parsed = parseRefForFetch(book, reference);
  if (!parsed) {
    console.warn('[print] parseRefForFetch returned null for', book, reference);
    return '';
  }

  const tid = textId || DEFAULT_TEXT_ID;
  const url = `${CONTENT_BASE_URL}/${tid}/${parsed.sectionId}.html`;
  console.log('[print] Fetching verse:', url, 'verses:', parsed.startVerse, '-', parsed.endVerse);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('[print] Fetch failed:', response.status, url);
      return '';
    }

    const html = await response.text();
    console.log('[print] Fetched HTML length:', html.length);
    const result = extractVersesFromHtml(html, parsed);
    console.log('[print] Extracted text:', result ? result.substring(0, 80) + '...' : '(empty)');
    return result;
  } catch (err) {
    console.error('[print] Fetch error:', err);
    return '';
  }
}

/**
 * Extract specific verses from chapter HTML
 * Simplified version of VerseExtractor for print use
 */
function extractVersesFromHtml(html, parsed) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  if (!parsed.startVerse) {
    // Chapter only — return all text
    const section = doc.querySelector('.section');
    if (section) {
      // Strip footnote elements for clean print text
      section.querySelectorAll('.note, .cf').forEach(el => el.remove());
      section.querySelectorAll('.v-num, .verse-num').forEach(el => el.remove());
      return section.textContent?.trim() || '';
    }
    return '';
  }

  const texts = [];
  const start = parsed.startVerse;
  const end = parsed.endVerse || start;

  for (let v = start; v <= end; v++) {
    const verseId = `${parsed.sectionId}_${v}`;
    const verseEl = doc.querySelector(`[data-id="${verseId}"], .${verseId}`);
    if (verseEl) {
      // Strip footnotes and verse numbers for clean text
      verseEl.querySelectorAll('.note, .cf').forEach(el => el.remove());
      verseEl.querySelectorAll('.v-num, .verse-num').forEach(el => el.remove());
      const text = verseEl.textContent?.trim();
      if (text) {
        if (start !== end) {
          texts.push(`${v} ${text}`);
        } else {
          texts.push(text);
        }
      }
    }
  }

  return texts.join(' ');
}

/**
 * Detect verse references in note content and optionally fetch their text
 * @param {string} htmlContent - Note HTML content
 * @param {boolean} includeVerseText - Whether to fetch and inline verse text
 * @returns {Promise<string>} Processed HTML with verse blockquotes appended
 */
async function processNoteContentForPrint(htmlContent, includeVerseText) {
  if (!htmlContent) return '';

  console.log('[print] processNoteContentForPrint called, includeVerseText:', includeVerseText);
  console.log('[print] htmlContent:', htmlContent.substring(0, 200));

  let detector, plainText, verses;
  try {
    detector = createVerseDetector();
    console.log('[print] detector created, methods:', Object.keys(detector));
  } catch (err) {
    console.error('[print] createVerseDetector() threw:', err);
    return htmlContent;
  }

  try {
    plainText = stripHtml(htmlContent);
    console.log('[print] plainText:', JSON.stringify(plainText.substring(0, 200)));
  } catch (err) {
    console.error('[print] stripHtml threw:', err);
    return htmlContent;
  }

  try {
    verses = detector.detectVerses(plainText);
    console.log('[print] detected verses:', verses.length, JSON.stringify(verses));
  } catch (err) {
    console.error('[print] detectVerses threw:', err);
    return htmlContent;
  }

  if (!includeVerseText || verses.length === 0) {
    console.log('[print] skipping verse fetch: includeVerseText=', includeVerseText, 'verses.length=', verses.length);
    return htmlContent;
  }

  // Fetch all verse texts in parallel
  const verseTexts = await Promise.all(
    verses.map(async (verse) => {
      const textId = verse.version || DEFAULT_TEXT_ID;
      const text = await fetchVerseText(verse.book, verse.reference, textId);
      return {
        ref: `${verse.book} ${verse.reference}`,
        version: verse.version,
        text
      };
    })
  );

  // Build blockquotes for each verse
  const blockquotes = verseTexts
    .filter(v => v.text)
    .map(v => {
      const versionLabel = v.version ? ` (${v.version})` : '';
      return `<blockquote class="print-verse-text"><strong>${v.ref}${versionLabel}</strong><br>${v.text}</blockquote>`;
    })
    .join('\n');

  console.log('[print] blockquotes built:', blockquotes.length > 0 ? blockquotes.substring(0, 200) : '(none)');
  return htmlContent + (blockquotes ? '\n' + blockquotes : '');
}

/**
 * Build print-friendly HTML document
 */
function buildPrintHtml(title, notesHtml) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
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
    <button onclick="window.print()" style="font-size:14pt;padding:8px 24px;cursor:pointer;">Print</button>
    <button onclick="window.close()" style="font-size:14pt;padding:8px 24px;cursor:pointer;margin-left:8px;">Close</button>
  </div>
  <h1>${title}</h1>
  ${notesHtml}
</body>
</html>`;
}

/**
 * Print notes — main entry point
 * @param {Array} notes - Array of note objects to print
 * @param {{ includeVerseText?: boolean, title?: string }} options
 */
export async function printNotes(notes, options = {}) {
  console.log('[print] printNotes called, options:', JSON.stringify(options), 'notes:', notes.length);

  if (!notes || notes.length === 0) {
    alert('No notes to print');
    return;
  }

  const includeVerseText = options.includeVerseText || false;
  console.log('[print] includeVerseText resolved to:', includeVerseText);
  const title = options.title || (notes.length === 1 ? (notes[0].title || 'Note') : 'Notes');

  // Process all notes
  const noteHtmlParts = [];
  for (const note of notes) {
    const noteTitle = note.title || 'Untitled';
    const metaParts = [];

    if (note.referenceDisplay) {
      metaParts.push(`Verse: ${note.referenceDisplay}`);
    }
    metaParts.push(`Modified: ${new Date(note.modified).toLocaleString()}`);

    const content = await processNoteContentForPrint(note.content || '', includeVerseText);

    noteHtmlParts.push(
      `<div class="print-note">
        <div class="print-note-title">${noteTitle}</div>
        <div class="print-meta">${metaParts.join(' | ')}</div>
        <div class="print-content">${content}</div>
      </div>`
    );
  }

  const fullHtml = buildPrintHtml(title, noteHtmlParts.join('\n'));

  // Open print window
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(fullHtml);
    printWindow.document.close();
  }
}
