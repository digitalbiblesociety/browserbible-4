import { elem } from '../../lib/helpers.esm.js';

/**
 * Format a timestamp for display in the notes list.
 * Shows time (e.g. "2:30 PM") for today, short date (e.g. "Jan 5") otherwise.
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} Formatted date string
 */
export function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const noteDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (noteDate.getTime() === today.getTime()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/**
 * Strip HTML tags and return plain text content.
 * @param {string} html - HTML string to strip
 * @returns {string} Plain text content
 */
export function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

/**
 * Escape a string for safe insertion into HTML.
 * @param {string} text - Raw text to escape
 * @returns {string} HTML-escaped string
 */
export function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

const ICONS = {
  sidebar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M2 3.75A.75.75 0 0 1 2.75 3h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm0 4.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd" /></svg>',
  add: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" /></svg>',
  link: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8.914 6.025a.75.75 0 0 1 1.06 0 3.5 3.5 0 0 1 0 4.95l-2 2a3.5 3.5 0 0 1-5.396-4.402.75.75 0 0 1 1.251.827 2 2 0 0 0 3.085 2.514l2-2a2 2 0 0 0 0-2.828.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /><path fill-rule="evenodd" d="M7.086 9.975a.75.75 0 0 1-1.06 0 3.5 3.5 0 0 1 0-4.95l2-2a3.5 3.5 0 0 1 5.396 4.402.75.75 0 0 1-1.251-.827 2 2 0 0 0-3.085-2.514l-2 2a2 2 0 0 0 0 2.828.75.75 0 0 1 0 1.06Z" clip-rule="evenodd" /></svg>',
  download: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3Z" /><path fill-rule="evenodd" d="M13 6H3v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6ZM8.75 7.75a.75.75 0 0 0-1.5 0v2.69L6.03 9.22a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l2.5-2.5a.75.75 0 1 0-1.06-1.06l-1.22 1.22V7.75Z" clip-rule="evenodd" /></svg>',
  upload: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M8.75 6h-1.5V3.56L6.03 4.78a.75.75 0 0 1-1.06-1.06l2.5-2.5a.75.75 0 0 1 1.06 0l2.5 2.5a.75.75 0 1 1-1.06 1.06L8.75 3.56V6H11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.25v5.25a.75.75 0 0 0 1.5 0V6Z" /></svg>',
  print: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M4 5a2 2 0 0 0-2 2v3a2 2 0 0 0 1.51 1.94l-.315 1.896A1 1 0 0 0 4.18 15h7.639a1 1 0 0 0 .986-1.164l-.316-1.897A2 2 0 0 0 14 10V7a2 2 0 0 0-2-2V2a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v3Zm1.5 0V2.5h5V5h-5Zm5.23 5.5H5.27l-.5 3h6.459l-.5-3Z" clip-rule="evenodd" /></svg>'
};

/**
 * Build the full NotesWindow DOM structure: header toolbar, sidebar
 * with filter/list, rich-text editor, and empty state.
 * @returns {{ header: HTMLElement, main: HTMLElement }}
 */
export function renderWindowStructure() {
  const header = elem('div', { className: 'window-header notes-header' },
    elem('button', { className: 'notes-sidebar-toggle header-button', title: 'Toggle Sidebar', innerHTML: ICONS.sidebar }),
    elem('button', { className: 'notes-new-btn header-button', title: 'New Note', innerHTML: ICONS.add }),
    elem('button', { className: 'notes-link-btn header-button', title: 'Link to Current Verse', innerHTML: ICONS.link }),
    elem('div', { className: 'notes-download-container' },
      elem('button', { className: 'notes-download-btn header-button', title: 'Download Notes', innerHTML: ICONS.download }),
      elem('div', { className: 'notes-download-menu' },
        elem('div', { className: 'notes-download-item', dataset: { format: 'markdown' }, textContent: 'Download as Markdown' }),
        elem('div', { className: 'notes-download-item', dataset: { format: 'text' }, textContent: 'Download as Plain Text' }),
        elem('div', { className: 'notes-download-item', dataset: { format: 'rtf' }, textContent: 'Download as RTF' })
      )
    ),
    elem('button', { className: 'notes-upload-btn header-button', title: 'Import Notes', innerHTML: ICONS.upload }),
    elem('input', { type: 'file', className: 'notes-upload-input', accept: '.md,.txt,.rtf', style: 'display:none' }),
    elem('div', { className: 'notes-print-container' },
      elem('button', { className: 'notes-print-btn header-button', title: 'Print Notes', innerHTML: ICONS.print }),
      elem('div', { className: 'notes-print-menu' },
        elem('div', { className: 'notes-print-item', dataset: { action: 'current' }, textContent: 'Print Current Note' }),
        elem('div', { className: 'notes-print-item', dataset: { action: 'all' }, textContent: 'Print All Notes' }),
        elem('label', { className: 'notes-print-option' },
          elem('input', { type: 'checkbox', className: 'notes-print-verses-checkbox' }),
          ' Include verse text'
        )
      )
    ),
    elem('div', { className: 'notes-search-container' },
      elem('input', { type: 'text', className: 'notes-search app-input', placeholder: 'Search notes...' }),
      elem('div', { className: 'notes-search-suggestions' })
    )
  );

  const sidebar = elem('div', { className: 'notes-sidebar' },
    elem('div', { className: 'notes-sidebar-header' },
      elem('select', { className: 'notes-filter app-select' },
        elem('option', { value: 'all', textContent: 'All Notes' }),
        elem('option', { value: 'linked', textContent: 'Linked to Verse' }),
        elem('option', { value: 'standalone', textContent: 'Standalone' }),
        elem('option', { value: 'reference', textContent: 'Current Verse' })
      )
    ),
    elem('div', { className: 'notes-list' })
  );

  const editorContainer = elem('div', { className: 'notes-editor-container' },
    elem('div', { className: 'notes-editor-header' },
      elem('input', { type: 'text', className: 'notes-title-input app-input', placeholder: 'Note title...' }),
      elem('span', { className: 'notes-reference-badge' }),
      elem('button', { className: 'notes-unlink-btn', title: 'Remove verse link', innerHTML: '&times;' }),
      elem('button', { className: 'notes-delete-btn', title: 'Delete note', textContent: 'Delete' })
    ),
    elem('div', { className: 'notes-richtext-toolbar' },
      elem('button', { dataset: { command: 'bold' }, title: 'Bold (Ctrl+B)' }, elem('b', 'B')),
      elem('button', { dataset: { command: 'italic' }, title: 'Italic (Ctrl+I)' }, elem('i', 'I')),
      elem('button', { dataset: { command: 'underline' }, title: 'Underline (Ctrl+U)' }, elem('u', 'U')),
      elem('span', { className: 'toolbar-separator' }),
      elem('button', { dataset: { command: 'formatBlock', value: 'H2' }, title: 'Heading', textContent: 'H' }),
      elem('button', { dataset: { command: 'formatBlock', value: 'P' }, title: 'Paragraph', textContent: 'P' }),
      elem('span', { className: 'toolbar-separator' }),
      elem('button', { dataset: { command: 'insertUnorderedList' }, title: 'Bullet List', innerHTML: '&#8226;' }),
      elem('button', { dataset: { command: 'insertOrderedList' }, title: 'Numbered List', textContent: '1.' })
    ),
    elem('div', {
      className: 'notes-editor',
      contentEditable: 'true',
      placeholder: 'Start writing... (Notes are stored locally in your browser and may be lost if you clear browser data)'
    }),
    elem('div', { className: 'notes-editor-footer' },
      elem('span', { className: 'notes-status' }),
      elem('span', { className: 'notes-modified' })
    )
  );

  const emptyState = elem('div', { className: 'notes-empty-state' },
    elem('p', 'No note selected'),
    elem('p', 'Select a note from the list or create a new one'),
    elem('p', { className: 'notes-storage-warning', textContent: "Notes are stored in your browser's local storage and may be lost if you clear browser data." })
  );

  // Main area
  const main = elem('div', { className: 'window-main notes-main' },
    sidebar,
    editorContainer,
    emptyState
  );

  return { header, main };
}

/**
 * Render a single note as a sidebar list item showing title, date,
 * verse badge (if linked), and a content preview.
 * @param {{ id: string, title: string, content: string, modified: number, reference: string?, referenceDisplay: string? }} note
 * @param {boolean} isSelected - Whether this note is currently active
 * @returns {HTMLElement}
 */
export function renderNoteListItem(note, isSelected) {
  const title = note.title || 'Untitled';
  const preview = stripHtml(note.content || '').substring(0, 50);
  const date = formatDate(note.modified);

  const item = elem('div', {
    className: `notes-list-item ${isSelected ? 'selected' : ''}`,
    dataset: { noteId: note.id }
  },
    elem('div', { className: 'notes-list-item-title', textContent: title }),
    elem('div', { className: 'notes-list-item-meta' },
      elem('span', date),
      note.reference
        ? elem('span', { className: 'notes-list-item-badge', textContent: note.referenceDisplay || note.reference })
        : null
    ),
    elem('div', { className: 'notes-list-item-preview', textContent: preview })
  );

  return item;
}

/**
 * Render the full sidebar notes list as a document fragment.
 * Shows an "empty" message when there are no notes to display.
 * @param {Array} notes - Filtered/sorted array of note objects
 * @param {string|null} currentNoteId - ID of the currently selected note
 * @returns {DocumentFragment|HTMLElement}
 */
export function renderNotesList(notes, currentNoteId) {
  if (notes.length === 0) {
    return elem('div', { className: 'notes-empty-list', textContent: 'No notes found' });
  }

  const fragment = document.createDocumentFragment();
  for (const note of notes) {
    fragment.appendChild(renderNoteListItem(note, note.id === currentNoteId));
  }
  return fragment;
}

/**
 * Render a single search suggestion dropdown item with title and content preview.
 * @param {{ title: string, content: string }} note - Matching note
 * @param {number} index - Position in the suggestions list (stored as data-index)
 * @param {boolean} isSelected - Whether this suggestion is keyboard/hover highlighted
 * @returns {HTMLElement}
 */
export function renderSuggestionItem(note, index, isSelected) {
  const title = note.title || 'Untitled';
  const preview = stripHtml(note.content || '').substring(0, 60);

  return elem('div', {
    className: `notes-suggestion-item ${isSelected ? 'selected' : ''}`,
    dataset: { index: String(index) }
  },
    elem('div', { className: 'notes-suggestion-title', textContent: title }),
    elem('div', { className: 'notes-suggestion-preview', textContent: preview })
  );
}

/**
 * Render the search suggestions dropdown as a document fragment.
 * @param {Array} matches - Notes matching the current search query (max 5)
 * @param {number} selectedIndex - Index of the currently highlighted suggestion
 * @returns {DocumentFragment}
 */
export function renderSearchSuggestions(matches, selectedIndex) {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < matches.length; i++) {
    fragment.appendChild(renderSuggestionItem(matches[i], i, i === selectedIndex));
  }
  return fragment;
}
