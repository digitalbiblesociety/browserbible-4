/**
 * Parse imported files (Markdown, Plain Text, RTF, JSON backup) back into
 * note objects.
 *
 * The "Verse:"/"Created:"/"Modified:" markers are part of the export file
 * format (they must round-trip through the parsers below), so they stay
 * English regardless of UI language.
 */

import { Reference } from '../../bible/BibleReference.js';
import { generateId, normalizeNote } from './NotesStore.js';
import { sanitizeHtml } from './sanitize.js';

/**
 * Resolve a human reference string ("John 3:16") to the fragmentid the app
 * uses internally, so imported linked notes match the current-verse filter.
 * @param {string|null} referenceDisplay
 * @returns {{reference: string|null, referenceDisplay: string|null}}
 */
function normalizeReference(referenceDisplay) {
  if (!referenceDisplay) return { reference: null, referenceDisplay: null };
  const ref = Reference(referenceDisplay);
  if (ref?.isValid()) {
    return { reference: ref.toSection(), referenceDisplay: ref.toString() };
  }
  // Unparseable: keep the display text but don't pretend it's a link.
  return { reference: null, referenceDisplay };
}

/**
 * Convert basic markdown formatting to HTML
 */
function markdownToHtml(md) {
  if (!md || typeof md !== 'string') return '';

  // Escape HTML
  let html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\r\n/g, '\n');

  // Headings
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Lists
  html = html.replace(
    /(?:^|\n)(- .+(?:\n- .+)*)/g,
    block => {
      const items = block
        .trim()
        .split('\n')
        .map(line => `<li>${line.replace(/^- /, '')}</li>`)
        .join('');
      return `\n<ul>${items}</ul>`;
    }
  );

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic
  html = html.replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>');

  // Underline
  html = html.replace(/(^|\W)_(.+?)_(\W|$)/g, '$1<u>$2</u>$3');

  // Paragraphs
  html = html
    .split(/\n{2,}/)
    .map(block => {
      block = block.trim();
      if (!block) return '';
      if (/^<(h\d|ul|p|blockquote)/.test(block)) {
        return block;
      }
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  return html.trim();
}


/**
 * Try to parse a date string back to a timestamp
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr.trim());
  return isNaN(d.getTime()) ? null : d.getTime();
}

/**
 * Parse a markdown export back into note objects
 * Exported format:
 *   # Title
 *   **Verse:** ref
 *   *Created: datestring*
 *   *Modified: datestring*
 *
 *   content...
 *
 *   ---
 */
function parseMarkdownImport(text) {
  const sections = text.split(/\n---\n/);
  const notes = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n');
    let title = '';
    let referenceDisplay = null;
    let created = null;
    let modified = null;
    let contentLines = [];
    let headerDone = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!headerDone) {
        const titleMatch = line.match(/^# (.+)$/);
        if (titleMatch) {
          title = titleMatch[1].trim();
          continue;
        }

        const verseMatch = line.match(/^\*\*Verse:\*\*\s*(.+)$/);
        if (verseMatch) {
          referenceDisplay = verseMatch[1].trim();
          continue;
        }

        const createdMatch = line.match(/^\*Created:\s*(.+)\*$/);
        if (createdMatch) {
          created = parseDate(createdMatch[1]);
          continue;
        }

        const modifiedMatch = line.match(/^\*Modified:\s*(.+)\*$/);
        if (modifiedMatch) {
          modified = parseDate(modifiedMatch[1]);
          headerDone = true;
          continue;
        }

        // Empty line between header and content
        if (line === '' && title) {
          continue;
        }

        // First non-header line: everything from here is content
        if (title) {
          headerDone = true;
          if (line !== '') {
            contentLines.push(line);
          }
          continue;
        }
      }

      contentLines.push(line);
    }

    const now = Date.now();
    const contentMd = contentLines.join('\n').trim();

    notes.push({
      id: generateId(),
      title: title || 'Imported Note',
      content: markdownToHtml(contentMd),
      ...normalizeReference(referenceDisplay),
      created: created || now,
      modified: modified || now
    });
  }

  return notes;
}

/**
 * Parse sections with a title/metadata/content header format.
 * Used by both plain text and RTF importers.
 * @param {string} text - Full text to parse
 * @param {string|RegExp} divider - Section divider pattern
 * @param {RegExp} versePattern - Regex to match verse reference lines (capture group 1 = reference)
 */
function parseHeaderSections(text, divider, versePattern) {
  const sections = text.split(divider);
  const notes = [];

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const lines = trimmed.split('\n');
    let title = '';
    let referenceDisplay = null;
    let created = null;
    let modified = null;
    let contentStartIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // First non-empty line is the title
      if (!title && line) {
        title = line;
        contentStartIndex = i + 1;
        continue;
      }

      if (title && !modified) {
        const verseMatch = line.match(versePattern);
        if (verseMatch) {
          referenceDisplay = verseMatch[1].trim();
          contentStartIndex = i + 1;
          continue;
        }

        const createdMatch = line.match(/^Created:\s*(.+)$/);
        if (createdMatch) {
          created = parseDate(createdMatch[1]);
          contentStartIndex = i + 1;
          continue;
        }

        const modifiedMatch = line.match(/^Modified:\s*(.+)$/);
        if (modifiedMatch) {
          modified = parseDate(modifiedMatch[1]);
          contentStartIndex = i + 1;
          continue;
        }

        // Empty line after metadata
        if (line === '') {
          contentStartIndex = i + 1;
          continue;
        }

        // Non-metadata line means content starts
        break;
      }
    }

    const now = Date.now();
    const contentText = lines.slice(contentStartIndex).join('\n').trim();
    const contentHtml = contentText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');

    notes.push({
      id: generateId(),
      title: title || 'Imported Note',
      content: contentHtml,
      ...normalizeReference(referenceDisplay),
      created: created || now,
      modified: modified || now
    });
  }

  return notes;
}

/**
 * Parse a plain text export back into note objects
 */
function parsePlainTextImport(text) {
  return parseHeaderSections(text, /={50}/, /^\[(.+)\]$/);
}

/**
 * Strip RTF control codes and extract plain text
 */
function stripRtf(rtf) {
  let text = rtf;
  // Header and font/color tables
  text = text.replace(/^\{\\rtf1[^}]*\}?\s*/i, '');
  text = text.replace(/\{\\fonttbl[^}]*\}/g, '');
  text = text.replace(/\{\\colortbl[^}]*\}/g, '');
  // \par becomes a newline
  text = text.replace(/\\par\s*/g, '\n');
  // Drop formatting markers but keep their content
  text = text.replace(/\{\\b\s+(.*?)\}/g, '$1');
  text = text.replace(/\{\\i\s+(.*?)\}/g, '$1');
  text = text.replace(/\{\\ul\s+(.*?)\}/g, '$1');
  text = text.replace(/\{\\fs\d+\s+(.*?)\}/g, '$1');
  // Remaining control words, braces, and escapes
  text = text.replace(/\\[a-z]+\d*\s?/g, '');
  text = text.replace(/[{}]/g, '');
  text = text.replace(/\\\\/g, '\\');
  text = text.replace(/\n{3,}/g, '\n\n');
  return text.trim();
}

/**
 * Parse an RTF export back into note objects
 */
function parseRtfImport(text) {
  const plainText = stripRtf(text);
  return parseHeaderSections(plainText, '________________________________________________', /^Verse:\s*(.+)$/);
}

/**
 * Parse a JSON backup (as produced by the JSON download) back into notes.
 * Original ids are kept so restores merge instead of duplicating.
 * @param {string} text
 * @returns {Array} Notes
 * @throws {Error} 'invalid-backup' when the payload isn't a notes backup
 */
function parseJsonImport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('invalid-backup');
  }

  const rawNotes = Array.isArray(parsed) ? parsed : parsed?.notes;
  if (!Array.isArray(rawNotes)) {
    throw new Error('invalid-backup');
  }

  return rawNotes
    .map((raw) => {
      const note = normalizeNote(raw);
      if (note) note.content = sanitizeHtml(note.content);
      return note;
    })
    .filter(Boolean);
}

/**
 * Parse an imported file into note objects
 * @param {string} text - File content
 * @param {string} filename - Original filename (used for format detection)
 * @returns {{notes: Array, mode: 'add'|'merge'}} Parsed notes and how the
 *   store should ingest them: 'merge' dedupes by id (JSON backups keep their
 *   original ids), 'add' prepends everything (text formats get fresh ids)
 * @throws {Error} 'invalid-backup' for malformed JSON backups
 */
export function parseImportedFile(text, filename) {
  const ext = filename.split('.').pop().toLowerCase();

  switch (ext) {
    case 'json':
      return { notes: parseJsonImport(text), mode: 'merge' };
    case 'md':
      return { notes: parseMarkdownImport(text), mode: 'add' };
    case 'rtf':
      return { notes: parseRtfImport(text), mode: 'add' };
    case 'txt':
    default:
      return { notes: parsePlainTextImport(text), mode: 'add' };
  }
}
