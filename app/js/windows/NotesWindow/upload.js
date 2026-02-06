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
  if (!md) return '';

  let html = md;
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Underline (markdown-style _text_)
  html = html.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<u>$1</u>');
  // List items
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  // Wrap consecutive <li> in <ul>
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  // Paragraphs: double newlines
  html = html.replace(/\n\n/g, '</p><p>');
  // Single newlines to <br>
  html = html.replace(/\n/g, '<br>');
  // Wrap in paragraph tags if content exists
  if (html && !html.startsWith('<h') && !html.startsWith('<ul>')) {
    html = '<p>' + html + '</p>';
  }
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
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

  for (let section of sections) {
    section = section.trim();
    if (!section) continue;

    const lines = section.split('\n');
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
 * Parse a plain text export back into note objects
 * Exported format:
 *   ==================================================
 *   Title
 *   [verse ref]
 *   Created: datestring
 *   Modified: datestring
 *
 *   content...
 */
function parsePlainTextImport(text) {
  const sections = text.split(/={50}/);
  const notes = [];

  for (let section of sections) {
    section = section.trim();
    if (!section) continue;

    const lines = section.split('\n');
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
        const verseMatch = line.match(/^\[(.+)\]$/);
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
    // Plain text content: convert newlines to <br> for HTML
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
 * Exported format uses ________________________________________________ as divider
 */
function parseRtfImport(text) {
  const plainText = stripRtf(text);
  const divider = '________________________________________________';
  const sections = plainText.split(divider);
  const notes = [];

  for (let section of sections) {
    section = section.trim();
    if (!section) continue;

    const lines = section.split('\n');
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
        // Verse reference (RTF exports as "Verse: ref")
        const verseMatch = line.match(/^Verse:\s*(.+)$/);
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
