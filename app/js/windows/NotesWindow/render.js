/**
 * NotesWindow Render Functions
 * UI rendering using elem helper
 */

import { elem } from '../../lib/helpers.esm.js';

/**
 * Format a timestamp for display
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
 * Extract plain text from HTML
 */
export function stripHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text) {
  if (text == null) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

// SVG Icons
const ICONS = {
  sidebar: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>',
  add: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>',
  link: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" /></svg>',
  download: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0-3-3m3 3 3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>',
  upload: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>',
  print: '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18.75 7.234H5.25" /></svg>'
};

/**
 * Create the main window structure
 */
export function renderWindowStructure() {
  // Header
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

  // Sidebar
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

  // Editor container
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

  // Empty state
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
 * Render a single note list item
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
 * Render the notes list
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
 * Render a single search suggestion item
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
 * Render search suggestions list
 */
export function renderSearchSuggestions(matches, selectedIndex) {
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < matches.length; i++) {
    fragment.appendChild(renderSuggestionItem(matches[i], i, i === selectedIndex));
  }
  return fragment;
}
