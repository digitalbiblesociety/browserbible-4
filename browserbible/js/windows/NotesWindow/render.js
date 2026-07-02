import { elem } from '../../lib/helpers.esm.js';
import { t } from '../../lib/i18n.js';

/**
 * Format a timestamp for the notes list: time ("2:30 PM") for today,
 * short date ("Jan 5") otherwise.
 */
function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const noteDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (noteDate.getTime() === today.getTime()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const ICONS = {
  sidebar: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M2 3.75A.75.75 0 0 1 2.75 3h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 3.75ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm0 4.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clip-rule="evenodd" /></svg>',
  add: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M8.75 3.75a.75.75 0 0 0-1.5 0v3.5h-3.5a.75.75 0 0 0 0 1.5h3.5v3.5a.75.75 0 0 0 1.5 0v-3.5h3.5a.75.75 0 0 0 0-1.5h-3.5v-3.5Z" /></svg>',
  link: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8.914 6.025a.75.75 0 0 1 1.06 0 3.5 3.5 0 0 1 0 4.95l-2 2a3.5 3.5 0 0 1-5.396-4.402.75.75 0 0 1 1.251.827 2 2 0 0 0 3.085 2.514l2-2a2 2 0 0 0 0-2.828.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" /><path fill-rule="evenodd" d="M7.086 9.975a.75.75 0 0 1-1.06 0 3.5 3.5 0 0 1 0-4.95l2-2a3.5 3.5 0 0 1 5.396 4.402.75.75 0 0 1-1.251-.827 2 2 0 0 0-3.085-2.514l-2 2a2 2 0 0 0 0 2.828.75.75 0 0 1 0 1.06Z" clip-rule="evenodd" /></svg>',
  download: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M2 3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3Z" /><path fill-rule="evenodd" d="M13 6H3v6a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6ZM8.75 7.75a.75.75 0 0 0-1.5 0v2.69L6.03 9.22a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l2.5-2.5a.75.75 0 1 0-1.06-1.06l-1.22 1.22V7.75Z" clip-rule="evenodd" /></svg>',
  upload: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M8.75 6h-1.5V3.56L6.03 4.78a.75.75 0 0 1-1.06-1.06l2.5-2.5a.75.75 0 0 1 1.06 0l2.5 2.5a.75.75 0 1 1-1.06 1.06L8.75 3.56V6H11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.25v5.25a.75.75 0 0 0 1.5 0V6Z" /></svg>',
  print: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M4 5a2 2 0 0 0-2 2v3a2 2 0 0 0 1.51 1.94l-.315 1.896A1 1 0 0 0 4.18 15h7.639a1 1 0 0 0 .986-1.164l-.316-1.897A2 2 0 0 0 14 10V7a2 2 0 0 0-2-2V2a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v3Zm1.5 0V2.5h5V5h-5Zm5.23 5.5H5.27l-.5 3h6.459l-.5-3Z" clip-rule="evenodd" /></svg>',
  pin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2a1 1 0 0 0-1 1v11.25a.5.5 0 0 0 .78.416L8 12.1l4.22 2.566a.5.5 0 0 0 .78-.416V3a1 1 0 0 0-1-1H4Z" /></svg>'
};

/**
 * Build the full NotesWindow DOM structure: header toolbar, sidebar
 * with filter/sort/list, rich-text editor, and empty state.
 * @returns {{ header: HTMLElement, main: HTMLElement }}
 */
export function renderWindowStructure() {
  const header = elem('div', { className: 'window-header notes-header' },
    elem('button', { className: 'notes-sidebar-toggle header-button', title: t('windows.notes.toggleSidebar'), innerHTML: ICONS.sidebar }),
    elem('button', { className: 'notes-new-btn header-button', title: t('windows.notes.newNote'), innerHTML: ICONS.add }),
    elem('button', { className: 'notes-link-btn header-button', title: t('windows.notes.linkToVerse'), innerHTML: ICONS.link }),
    elem('div', { className: 'notes-download-container' },
      elem('button', { className: 'notes-download-btn header-button', title: t('windows.notes.download'), innerHTML: ICONS.download }),
      elem('div', { className: 'notes-download-menu' },
        elem('div', { className: 'notes-download-item', dataset: { format: 'markdown' }, textContent: t('windows.notes.downloadMarkdown') }),
        elem('div', { className: 'notes-download-item', dataset: { format: 'text' }, textContent: t('windows.notes.downloadText') }),
        elem('div', { className: 'notes-download-item', dataset: { format: 'rtf' }, textContent: t('windows.notes.downloadRtf') }),
        elem('div', { className: 'notes-download-item', dataset: { format: 'json' }, textContent: t('windows.notes.downloadJson') })
      )
    ),
    elem('button', { className: 'notes-upload-btn header-button', title: t('windows.notes.import'), innerHTML: ICONS.upload }),
    elem('input', { type: 'file', className: 'notes-upload-input', accept: '.md,.txt,.rtf,.json', style: 'display:none' }),
    elem('div', { className: 'notes-print-container' },
      elem('button', { className: 'notes-print-btn header-button', title: t('windows.notes.print'), innerHTML: ICONS.print }),
      elem('div', { className: 'notes-print-menu' },
        elem('div', { className: 'notes-print-item', dataset: { action: 'current' }, textContent: t('windows.notes.printCurrent') }),
        elem('div', { className: 'notes-print-item', dataset: { action: 'all' }, textContent: t('windows.notes.printAll') }),
        elem('label', { className: 'notes-print-option' },
          elem('input', { type: 'checkbox', className: 'notes-print-verses-checkbox' }),
          ' ' + t('windows.notes.printIncludeVerses')
        )
      )
    ),
    elem('div', { className: 'notes-search-container' },
      elem('input', { type: 'text', className: 'notes-search app-input', placeholder: t('windows.notes.searchPlaceholder'), ariaLabel: t('windows.notes.searchPlaceholder') }),
      elem('div', { className: 'notes-search-suggestions' })
    )
  );

  const sidebar = elem('div', { className: 'notes-sidebar' },
    elem('div', { className: 'notes-sidebar-header' },
      elem('select', { className: 'notes-filter app-select', ariaLabel: t('windows.notes.filterLabel') },
        elem('option', { value: 'all', textContent: t('windows.notes.filterAll') }),
        elem('option', { value: 'linked', textContent: t('windows.notes.filterLinked') }),
        elem('option', { value: 'standalone', textContent: t('windows.notes.filterStandalone') }),
        elem('option', { value: 'reference', textContent: t('windows.notes.filterReference') })
      ),
      elem('select', { className: 'notes-sort app-select', ariaLabel: t('windows.notes.sortLabel') },
        elem('option', { value: 'modified', textContent: t('windows.notes.sortModified') }),
        elem('option', { value: 'created', textContent: t('windows.notes.sortCreated') }),
        elem('option', { value: 'title', textContent: t('windows.notes.sortTitle') })
      )
    ),
    elem('div', { className: 'notes-list' })
  );

  const editorContainer = elem('div', { className: 'notes-editor-container' },
    elem('div', { className: 'notes-editor-header' },
      elem('input', { type: 'text', className: 'notes-title-input app-input', placeholder: t('windows.notes.titlePlaceholder'), ariaLabel: t('windows.notes.titlePlaceholder') }),
      elem('span', { className: 'notes-reference-badge' }),
      elem('button', { className: 'notes-unlink-btn', title: t('windows.notes.removeLink'), innerHTML: '&times;' }),
      elem('button', { className: 'notes-pin-toggle', title: t('windows.notes.pin'), innerHTML: ICONS.pin }),
      elem('button', { className: 'notes-delete-btn', title: t('windows.notes.deleteNote'), textContent: t('windows.notes.delete') })
    ),
    elem('div', { className: 'notes-richtext-toolbar' },
      elem('button', { dataset: { command: 'bold' }, title: t('windows.notes.bold') }, elem('b', 'B')),
      elem('button', { dataset: { command: 'italic' }, title: t('windows.notes.italic') }, elem('i', 'I')),
      elem('button', { dataset: { command: 'underline' }, title: t('windows.notes.underline') }, elem('u', 'U')),
      elem('span', { className: 'toolbar-separator' }),
      elem('button', { dataset: { command: 'formatBlock', value: 'H2' }, title: t('windows.notes.heading'), textContent: 'H' }),
      elem('button', { dataset: { command: 'formatBlock', value: 'P' }, title: t('windows.notes.paragraph'), textContent: 'P' }),
      elem('span', { className: 'toolbar-separator' }),
      elem('button', { dataset: { command: 'insertUnorderedList' }, title: t('windows.notes.bulletList'), innerHTML: '&#8226;' }),
      elem('button', { dataset: { command: 'insertOrderedList' }, title: t('windows.notes.numberedList'), textContent: '1.' })
    ),
    // The placeholder must be a real attribute: CSS reads it via
    // attr(data-placeholder) on :empty
    elem('div', {
      className: 'notes-editor',
      contentEditable: 'true',
      dataset: { placeholder: t('windows.notes.editorPlaceholder') }
    }),
    elem('div', { className: 'notes-detected-refs' }),
    elem('div', { className: 'notes-editor-footer' },
      elem('span', { className: 'notes-status' }),
      elem('span', { className: 'notes-modified' })
    )
  );

  const emptyState = elem('div', { className: 'notes-empty-state' },
    elem('p', t('windows.notes.noNoteSelected')),
    elem('p', t('windows.notes.selectOrCreate')),
    elem('p', { className: 'notes-storage-warning', textContent: t('windows.notes.storageWarning') })
  );

  const main = elem('div', { className: 'window-main notes-main' },
    sidebar,
    editorContainer,
    emptyState
  );

  return { header, main };
}

/**
 * Render one sidebar list item: title, date, verse badge (if linked),
 * pin state, and a content preview.
 */
function renderNoteListItem(note, isSelected, plainText) {
  const title = note.title || t('windows.notes.untitled');
  const preview = (plainText || '').substring(0, 50);
  const date = formatDate(note.modified);

  return elem('div', {
    className: `notes-list-item${isSelected ? ' selected' : ''}${note.pinned ? ' pinned' : ''}`,
    dataset: { noteId: note.id }
  },
    elem('div', { className: 'notes-list-item-title', textContent: title }),
    elem('button', {
      className: 'notes-pin-btn',
      title: t(note.pinned ? 'windows.notes.unpin' : 'windows.notes.pin'),
      ariaPressed: String(!!note.pinned),
      innerHTML: ICONS.pin
    }),
    elem('div', { className: 'notes-list-item-meta' },
      elem('span', date),
      note.reference
        ? elem('span', { className: 'notes-list-item-badge', textContent: note.referenceDisplay || note.reference })
        : null
    ),
    elem('div', { className: 'notes-list-item-preview', textContent: preview })
  );
}

/**
 * Render the sidebar notes list as a document fragment, or an "empty"
 * message element when there is nothing to show.
 * @param {Function} getPlainText - (id) => cached plain text of note content
 */
export function renderNotesList(notes, currentNoteId, getPlainText, emptyMessage) {
  if (notes.length === 0) {
    return elem('div', {
      className: 'notes-empty-list',
      textContent: emptyMessage || t('windows.notes.noNotesFound')
    });
  }

  const plain = getPlainText || (() => '');
  const fragment = document.createDocumentFragment();
  for (const note of notes) {
    fragment.appendChild(renderNoteListItem(note, note.id === currentNoteId, plain(note.id)));
  }
  return fragment;
}

/** Render one search suggestion with title and content preview. */
function renderSuggestionItem(note, index, isSelected, plainText) {
  const title = note.title || t('windows.notes.untitled');
  const preview = (plainText || '').substring(0, 60);

  return elem('div', {
    className: `notes-suggestion-item ${isSelected ? 'selected' : ''}`,
    dataset: { index: String(index) }
  },
    elem('div', { className: 'notes-suggestion-title', textContent: title }),
    elem('div', { className: 'notes-suggestion-preview', textContent: preview })
  );
}

/** Render the search suggestions dropdown as a document fragment. */
export function renderSearchSuggestions(matches, selectedIndex, getPlainText) {
  const plain = getPlainText || (() => '');
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < matches.length; i++) {
    fragment.appendChild(renderSuggestionItem(matches[i], i, i === selectedIndex, plain(matches[i].id)));
  }
  return fragment;
}

/**
 * Render the detected-references chip row under the editor.
 * @returns {DocumentFragment|null} null when there is nothing to show
 */
export function renderDetectedRefs(refs) {
  if (!refs || refs.length === 0) return null;

  const fragment = document.createDocumentFragment();
  fragment.appendChild(elem('span', { className: 'notes-detected-refs-label', textContent: t('windows.notes.detectedRefs') }));
  for (const ref of refs) {
    fragment.appendChild(elem('button', {
      className: 'notes-ref-chip',
      textContent: ref.label,
      title: t('windows.notes.goToReference', { reference: ref.label }),
      dataset: { fragmentid: ref.fragmentid, sectionid: ref.sectionid }
    }));
  }
  return fragment;
}
