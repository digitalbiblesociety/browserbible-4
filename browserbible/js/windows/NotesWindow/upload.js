/**
 * NotesWindow Upload/Import Functions
 * Parse imported files (Markdown, Plain Text, RTF) back into note objects
 */

/**
 * Generate a UUID for note IDs
 */
function generateId() {
  return 'note_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
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
    let reference = null;
    let referenceDisplay = null;
    let created = null;
    let modified = null;
    let contentLines = [];
    let headerDone = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!headerDone) {
        // Title line
        const titleMatch = line.match(/^# (.+)$/);
        if (titleMatch) {
          title = titleMatch[1].trim();
          continue;
        }

        // Verse reference
        const verseMatch = line.match(/^\*\*Verse:\*\*\s*(.+)$/);
        if (verseMatch) {
          referenceDisplay = verseMatch[1].trim();
          reference = referenceDisplay;
          continue;
        }

        // Created date
        const createdMatch = line.match(/^\*Created:\s*(.+)\*$/);
        if (createdMatch) {
          created = parseDate(createdMatch[1]);
          continue;
        }

        // Modified date
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

        // If we hit non-header content, everything from here is content
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
      reference,
      referenceDisplay,
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
    let reference = null;
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
        // Verse reference
        const verseMatch = line.match(versePattern);
        if (verseMatch) {
          referenceDisplay = verseMatch[1].trim();
          reference = referenceDisplay;
          contentStartIndex = i + 1;
          continue;
        }

        // Created date
        const createdMatch = line.match(/^Created:\s*(.+)$/);
        if (createdMatch) {
          created = parseDate(createdMatch[1]);
          contentStartIndex = i + 1;
          continue;
        }

        // Modified date
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
      reference,
      referenceDisplay,
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
  // Remove RTF header/footer braces
  let text = rtf;
  // Remove {\rtf1...} header
  text = text.replace(/^\{\\rtf1[^}]*\}?\s*/i, '');
  // Remove font tables etc
  text = text.replace(/\{\\fonttbl[^}]*\}/g, '');
  text = text.replace(/\{\\colortbl[^}]*\}/g, '');
  // Convert \par to newlines
  text = text.replace(/\\par\s*/g, '\n');
  // Remove bold/italic/underline markers but keep content
  text = text.replace(/\{\\b\s+(.*?)\}/g, '$1');
  text = text.replace(/\{\\i\s+(.*?)\}/g, '$1');
  text = text.replace(/\{\\ul\s+(.*?)\}/g, '$1');
  // Remove font size markers but keep content
  text = text.replace(/\{\\fs\d+\s+(.*?)\}/g, '$1');
  // Remove remaining control words
  text = text.replace(/\\[a-z]+\d*\s?/g, '');
  // Remove braces
  text = text.replace(/[{}]/g, '');
  // Unescape RTF special chars
  text = text.replace(/\\\\/g, '\\');
  // Clean up whitespace
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
 * Parse an imported file into note objects
 * @param {string} text - File content
 * @param {string} filename - Original filename (used for format detection)
 * @returns {Array} Array of note objects
 */
export function parseImportedFile(text, filename) {
  const ext = filename.split('.').pop().toLowerCase();

  switch (ext) {
    case 'md':
      return parseMarkdownImport(text);
    case 'rtf':
      return parseRtfImport(text);
    case 'txt':
    default:
      return parsePlainTextImport(text);
  }
}
