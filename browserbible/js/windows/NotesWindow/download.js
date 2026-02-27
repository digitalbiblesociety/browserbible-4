function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

function escapeRtf(text) {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}');
}

export function htmlToMarkdown(html) {
  if (!html) return '';

  let md = html;
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?(ul|ol)[^>]*>/gi, '\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<\/p>/gi, '\n\n');
  md = md.replace(/<p[^>]*>/gi, '');
  md = md.replace(/<\/div>/gi, '\n');
  md = md.replace(/<div[^>]*>/gi, '');
  md = md.replace(/<[^>]+>/g, '');
  const txt = document.createElement('textarea');
  txt.innerHTML = md;
  md = txt.value;
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

export function htmlToRtf(html) {
  if (!html) return '';

  let rtf = html;
  rtf = rtf.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '{\\b $1}');
  rtf = rtf.replace(/<b[^>]*>(.*?)<\/b>/gi, '{\\b $1}');
  rtf = rtf.replace(/<em[^>]*>(.*?)<\/em>/gi, '{\\i $1}');
  rtf = rtf.replace(/<i[^>]*>(.*?)<\/i>/gi, '{\\i $1}');
  rtf = rtf.replace(/<u[^>]*>(.*?)<\/u>/gi, '{\\ul $1}');
  rtf = rtf.replace(/<br\s*\/?>/gi, '\\par ');
  rtf = rtf.replace(/<\/p>/gi, '\\par\\par ');
  rtf = rtf.replace(/<p[^>]*>/gi, '');
  rtf = rtf.replace(/<\/div>/gi, '\\par ');
  rtf = rtf.replace(/<div[^>]*>/gi, '');
  rtf = rtf.replace(/<li[^>]*>(.*?)<\/li>/gi, '\\par - $1');
  rtf = rtf.replace(/<\/?(ul|ol|h1|h2|h3)[^>]*>/gi, '\\par ');
  rtf = rtf.replace(/<[^>]+>/g, '');
  const txt = document.createElement('textarea');
  txt.innerHTML = rtf;
  rtf = txt.value;
  rtf = escapeRtf(rtf);
  return rtf;
}

export function notesToPlainText(notes) {
  const lines = [];
  const divider = '='.repeat(50);

  for (const note of notes) {
    lines.push(divider);
    lines.push(note.title || 'Untitled');
    if (note.referenceDisplay) {
      lines.push(`[${note.referenceDisplay}]`);
    }
    lines.push(`Created: ${new Date(note.created).toLocaleString()}`);
    lines.push(`Modified: ${new Date(note.modified).toLocaleString()}`);
    lines.push('');
    lines.push(stripHtml(note.content || ''));
    lines.push('');
  }

  return lines.join('\n');
}

export function notesToMarkdown(notes) {
  const lines = [];

  for (const note of notes) {
    lines.push(`# ${note.title || 'Untitled'}`);
    if (note.referenceDisplay) {
      lines.push(`**Verse:** ${note.referenceDisplay}`);
    }
    lines.push(`*Created: ${new Date(note.created).toLocaleString()}*`);
    lines.push(`*Modified: ${new Date(note.modified).toLocaleString()}*`);
    lines.push('');
    lines.push(htmlToMarkdown(note.content || ''));
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function notesToRtf(notes) {
  const lines = ['{\\rtf1\\ansi\\deff0'];
  lines.push('{\\fonttbl{\\f0 Times New Roman;}}');

  for (const note of notes) {
    lines.push(`{\\b\\fs28 ${escapeRtf(note.title || 'Untitled')}}`);
    lines.push('\\par');

    if (note.referenceDisplay) {
      lines.push(`{\\i Verse: ${escapeRtf(note.referenceDisplay)}}`);
      lines.push('\\par');
    }

    lines.push(`{\\fs18 Created: ${escapeRtf(new Date(note.created).toLocaleString())}}`);
    lines.push('\\par');
    lines.push(`{\\fs18 Modified: ${escapeRtf(new Date(note.modified).toLocaleString())}}`);
    lines.push('\\par\\par');

    lines.push(htmlToRtf(note.content || ''));
    lines.push('\\par');

    lines.push('\\par{\\fs18 ________________________________________________}\\par\\par');
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Download notes in the specified format
 * @param {Array} notes - Array of note objects
 * @param {string} format - 'markdown', 'text', or 'rtf'
 */
export function downloadNotes(notes, format) {
  if (!notes || notes.length === 0) {
    alert('No notes to download');
    return;
  }

  let content, filename, mimeType;

  switch (format) {
    case 'markdown':
      content = notesToMarkdown(notes);
      filename = 'notes.md';
      mimeType = 'text/markdown';
      break;
    case 'rtf':
      content = notesToRtf(notes);
      filename = 'notes.rtf';
      mimeType = 'application/rtf';
      break;
    case 'text':
    default:
      content = notesToPlainText(notes);
      filename = 'notes.txt';
      mimeType = 'text/plain';
      break;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
