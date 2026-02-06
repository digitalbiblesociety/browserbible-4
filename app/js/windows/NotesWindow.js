/**
 * NotesWindow - Web Component for note-taking with verse linking
 */

import { BaseWindow, registerWindowComponent } from './BaseWindow.js';
import { downloadNotes } from './NotesWindow/download.js';
import { parseImportedFile } from './NotesWindow/upload.js';
import {
  renderWindowStructure,
  renderNotesList,
  renderSearchSuggestions,
  stripHtml
} from './NotesWindow/render.js';

const STORAGE_KEY = 'browserbible_notes';
const AUTOSAVE_DELAY_MS = 1000;

/**
 * Generate a UUID for note IDs
 */
function generateId() {
  return 'note_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * NotesWindow Web Component
 * Provides note-taking with verse linking support
 */
export class NotesWindowComponent extends BaseWindow {
  constructor() {
    super();

    this.state = {
      ...this.state,
      notes: [],
      currentNoteId: null,
      currentReference: null,
      currentReferenceDisplay: null,
      filterMode: 'all',
      searchQuery: '',
      isDirty: false,
      sidebarVisible: true,
      searchSuggestions: [],
      selectedSuggestionIndex: -1
    };

    this._autosaveTimer = null;
  }

  async render() {
    this.innerHTML = '';
    const { header, main } = renderWindowStructure();
    this.appendChild(header);
    this.appendChild(main);
  }

  cacheRefs() {
    super.cacheRefs();

    this.refs.header = this.$('.notes-header');
    this.refs.main = this.$('.notes-main');
    this.refs.sidebarToggle = this.$('.notes-sidebar-toggle');
    this.refs.newBtn = this.$('.notes-new-btn');
    this.refs.linkBtn = this.$('.notes-link-btn');
    this.refs.downloadBtn = this.$('.notes-download-btn');
    this.refs.downloadMenu = this.$('.notes-download-menu');
    this.refs.uploadBtn = this.$('.notes-upload-btn');
    this.refs.uploadInput = this.$('.notes-upload-input');
    this.refs.filter = this.$('.notes-filter');
    this.refs.search = this.$('.notes-search');
    this.refs.searchSuggestions = this.$('.notes-search-suggestions');
    this.refs.sidebar = this.$('.notes-sidebar');
    this.refs.list = this.$('.notes-list');
    this.refs.editorContainer = this.$('.notes-editor-container');
    this.refs.titleInput = this.$('.notes-title-input');
    this.refs.referenceBadge = this.$('.notes-reference-badge');
    this.refs.unlinkBtn = this.$('.notes-unlink-btn');
    this.refs.deleteBtn = this.$('.notes-delete-btn');
    this.refs.toolbar = this.$('.notes-richtext-toolbar');
    this.refs.editor = this.$('.notes-editor');
    this.refs.status = this.$('.notes-status');
    this.refs.modified = this.$('.notes-modified');
    this.refs.emptyState = this.$('.notes-empty-state');
  }

  attachEventListeners() {
    // Sidebar toggle button
    this.addListener(this.refs.sidebarToggle, 'click', () => this.toggleSidebar());

    // New note button
    this.addListener(this.refs.newBtn, 'click', () => this.createNewNote());

    // Link button
    this.addListener(this.refs.linkBtn, 'click', () => this.linkCurrentNote());

    // Download button
    this.addListener(this.refs.downloadBtn, 'click', () => {
      this.refs.downloadMenu.classList.toggle('visible');
    });

    // Download menu items
    this.addListener(this.refs.downloadMenu, 'click', (e) => {
      const item = e.target.closest('.notes-download-item');
      if (item) {
        const format = item.dataset.format;
        downloadNotes(this.state.notes, format);
        this.refs.downloadMenu.classList.remove('visible');
      }
    });

    // Hide download menu on outside click
    this.addListener(document, 'click', (e) => {
      if (!e.target.closest('.notes-download-container')) {
        this.refs.downloadMenu.classList.remove('visible');
      }
    });

    // Upload button
    this.addListener(this.refs.uploadBtn, 'click', () => {
      this.refs.uploadInput.click();
    });

    // Upload file input change
    this.addListener(this.refs.uploadInput, 'change', () => {
      const file = this.refs.uploadInput.files[0];
      if (file) {
        this.importFile(file);
        this.refs.uploadInput.value = '';
      }
    });

    // Filter dropdown
    this.addListener(this.refs.filter, 'change', () => {
      this.state.filterMode = this.refs.filter.value;
      this.renderNotesList();
    });

    // Search input
    this.addListener(this.refs.search, 'input', () => {
      this.state.searchQuery = this.refs.search.value;
      this.updateSearchSuggestions();
      this.renderNotesList();
    });

    // Search keyboard navigation
    this.addListener(this.refs.search, 'keydown', (e) => {
      if (!this.refs.searchSuggestions.classList.contains('visible')) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.updateSuggestionSelection(this.state.selectedSuggestionIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.updateSuggestionSelection(this.state.selectedSuggestionIndex - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.selectSuggestion(this.state.selectedSuggestionIndex);
      } else if (e.key === 'Escape') {
        this.hideSearchSuggestions();
      }
    });

    // Search blur - hide suggestions
    this.addListener(this.refs.search, 'blur', () => {
      setTimeout(() => this.hideSearchSuggestions(), 150);
    });

    // Search focus - show suggestions if query exists
    this.addListener(this.refs.search, 'focus', () => {
      if (this.refs.search.value.trim()) {
        this.updateSearchSuggestions();
      }
    });

    // Suggestion click
    this.addListener(this.refs.searchSuggestions, 'mousedown', (e) => {
      const item = e.target.closest('.notes-suggestion-item');
      if (item) {
        const index = parseInt(item.dataset.index, 10);
        this.selectSuggestion(index);
      }
    });

    // Suggestion hover
    this.addListener(this.refs.searchSuggestions, 'mouseover', (e) => {
      const item = e.target.closest('.notes-suggestion-item');
      if (item) {
        const index = parseInt(item.dataset.index, 10);
        this.updateSuggestionSelection(index);
      }
    });

    // Note list click
    this.addListener(this.refs.list, 'click', (e) => {
      const item = e.target.closest('.notes-list-item');
      if (item) {
        this.selectNote(item.dataset.noteId);
      }
    });

    // Title input
    this.addListener(this.refs.titleInput, 'input', () => {
      this.markDirty();
      this.scheduleAutosave();
    });

    // Unlink button
    this.addListener(this.refs.unlinkBtn, 'click', () => this.unlinkCurrentNote());

    // Delete button
    this.addListener(this.refs.deleteBtn, 'click', () => this.deleteCurrentNote());

    // Toolbar buttons
    this.addListener(this.refs.toolbar, 'click', (e) => {
      const btn = e.target.closest('button');
      if (btn) {
        const command = btn.dataset.command;
        const value = btn.dataset.value || null;
        this.execFormatCommand(command, value);
      }
    });

    // Editor input
    this.addListener(this.refs.editor, 'input', () => {
      this.markDirty();
      this.scheduleAutosave();
    });

    // Keyboard shortcuts in editor
    this.addListener(this.refs.editor, 'keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'b':
            e.preventDefault();
            this.execFormatCommand('bold');
            break;
          case 'i':
            e.preventDefault();
            this.execFormatCommand('italic');
            break;
          case 'u':
            e.preventDefault();
            this.execFormatCommand('underline');
            break;
        }
      }
    });

    // Message handling for Bible navigation
    this.on('message', (e) => this.handleMessage(e));
  }

  async init() {
    this.loadNotes();
    this.renderNotesList();
    this.updateEditorVisibility();

    // Load initial state from params
    const initNoteId = this.getParam('noteId');
    const initFilter = this.getParam('filter');

    if (initFilter) {
      this.state.filterMode = initFilter;
      this.refs.filter.value = initFilter;
    }

    if (initNoteId) {
      this.selectNote(initNoteId);
    }
  }

  cleanup() {
    if (this._autosaveTimer) {
      clearTimeout(this._autosaveTimer);
      this.saveCurrentNote();
    }
    super.cleanup();
  }

  handleMessage(e) {
    if (e.data.messagetype === 'nav' && e.data.type === 'bible' && e.data.locationInfo) {
      // Update current reference from Bible navigation
      this.state.currentReference = e.data.locationInfo.fragmentid || null;
      this.state.currentReferenceDisplay = this.formatReferenceDisplay(e.data.locationInfo);

      // If filter is set to "current verse", update the list
      if (this.state.filterMode === 'reference') {
        this.renderNotesList();
      }
    }
  }

  formatReferenceDisplay(locationInfo) {
    if (!locationInfo?.fragmentid) return null;
    // Convert fragmentid like "JN3_16" to display like "John 3:16"
    // This is a simple version; could use BibleReference for better formatting
    const fid = locationInfo.fragmentid;
    const match = fid.match(/^([A-Z0-9]+)(\d+)_(\d+)$/);
    if (match) {
      return `${match[1]} ${match[2]}:${match[3]}`;
    }
    return fid;
  }

  loadNotes() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.state.notes = data.notes || [];
      } else {
        this.state.notes = [];
      }
    } catch (e) {
      console.error('Failed to load notes:', e);
      this.state.notes = [];
    }
  }

  saveNotes() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ notes: this.state.notes }));
    } catch (e) {
      console.error('Failed to save notes:', e);
    }
  }

  getFilteredNotes() {
    let notes = [...this.state.notes];

    // Apply filter
    switch (this.state.filterMode) {
      case 'linked':
        notes = notes.filter(n => n.reference);
        break;
      case 'standalone':
        notes = notes.filter(n => !n.reference);
        break;
      case 'reference':
        notes = notes.filter(n => n.reference === this.state.currentReference);
        break;
    }

    // Apply search
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      notes = notes.filter(n =>
        (n.title || '').toLowerCase().includes(query) ||
        stripHtml(n.content || '').toLowerCase().includes(query)
      );
    }

    // Sort by modified date descending
    notes.sort((a, b) => b.modified - a.modified);

    return notes;
  }

  renderNotesList() {
    const notes = this.getFilteredNotes();
    this.refs.list.innerHTML = '';
    this.refs.list.appendChild(renderNotesList(notes, this.state.currentNoteId));
  }

  updateEditorVisibility() {
    if (this.state.currentNoteId) {
      this.refs.editorContainer.classList.remove('hidden');
      this.refs.emptyState.classList.add('hidden');
    } else {
      this.refs.editorContainer.classList.add('hidden');
      this.refs.emptyState.classList.remove('hidden');
    }
  }

  toggleSidebar() {
    this.state.sidebarVisible = !this.state.sidebarVisible;
    this.refs.sidebar.classList.toggle('hidden', !this.state.sidebarVisible);
  }

  updateSearchSuggestions() {
    const query = this.refs.search.value.trim().toLowerCase();

    if (!query) {
      this.hideSearchSuggestions();
      return;
    }

    // Find matching notes
    const matches = this.state.notes.filter(n => {
      const titleMatch = (n.title || '').toLowerCase().includes(query);
      const contentMatch = stripHtml(n.content || '').toLowerCase().includes(query);
      return titleMatch || contentMatch;
    }).slice(0, 5); // Limit to 5 suggestions

    this.state.searchSuggestions = matches;
    this.state.selectedSuggestionIndex = matches.length > 0 ? 0 : -1;

    if (matches.length === 0) {
      this.hideSearchSuggestions();
      return;
    }

    // Render suggestions
    this.refs.searchSuggestions.innerHTML = '';
    this.refs.searchSuggestions.appendChild(
      renderSearchSuggestions(matches, this.state.selectedSuggestionIndex)
    );
    this.refs.searchSuggestions.classList.add('visible');
  }

  hideSearchSuggestions() {
    this.refs.searchSuggestions.classList.remove('visible');
    this.refs.searchSuggestions.innerHTML = '';
    this.state.searchSuggestions = [];
    this.state.selectedSuggestionIndex = -1;
  }

  updateSuggestionSelection(newIndex) {
    const count = this.state.searchSuggestions.length;
    if (count === 0) return;

    if (newIndex < 0) newIndex = count - 1;
    if (newIndex >= count) newIndex = 0;

    this.state.selectedSuggestionIndex = newIndex;

    const items = this.refs.searchSuggestions.querySelectorAll('.notes-suggestion-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === newIndex);
    });
  }

  selectSuggestion(index) {
    if (index < 0 || index >= this.state.searchSuggestions.length) return;

    const note = this.state.searchSuggestions[index];
    this.selectNote(note.id);
    this.refs.search.value = '';
    this.state.searchQuery = '';
    this.hideSearchSuggestions();
    this.renderNotesList();
  }

  createNewNote() {
    // Save any current note first
    this.saveCurrentNote();

    const now = Date.now();
    const newNote = {
      id: generateId(),
      title: '',
      content: '',
      reference: null,
      referenceDisplay: null,
      created: now,
      modified: now
    };

    this.state.notes.unshift(newNote);
    this.saveNotes();
    this.selectNote(newNote.id);
    this.renderNotesList();

    // Focus the title input
    this.refs.titleInput.focus();
  }

  selectNote(noteId) {
    // Save current note before switching
    this.saveCurrentNote();

    const note = this.state.notes.find(n => n.id === noteId);
    if (!note) return;

    this.state.currentNoteId = noteId;
    this.state.isDirty = false;

    // Update editor
    this.refs.titleInput.value = note.title || '';
    this.refs.editor.innerHTML = note.content || '';

    // Update reference badge
    if (note.reference) {
      this.refs.referenceBadge.textContent = note.referenceDisplay || note.reference;
      this.refs.referenceBadge.classList.add('visible');
      this.refs.unlinkBtn.classList.add('visible');
    } else {
      this.refs.referenceBadge.classList.remove('visible');
      this.refs.unlinkBtn.classList.remove('visible');
    }

    // Update modified display
    this.refs.modified.textContent = `Modified: ${new Date(note.modified).toLocaleString()}`;
    this.refs.status.textContent = '';

    this.updateEditorVisibility();
    this.renderNotesList();

    this.trigger('settingschange', { type: 'settingschange', target: this, data: null });
  }

  saveCurrentNote() {
    if (!this.state.currentNoteId || !this.state.isDirty) return;

    const note = this.state.notes.find(n => n.id === this.state.currentNoteId);
    if (!note) return;

    note.title = this.refs.titleInput.value.trim() || this.getAutoTitle();
    note.content = this.refs.editor.innerHTML;
    note.modified = Date.now();

    this.saveNotes();
    this.state.isDirty = false;
    this.refs.status.textContent = 'Saved';
    this.refs.modified.textContent = `Modified: ${new Date(note.modified).toLocaleString()}`;

    this.renderNotesList();
  }

  getAutoTitle() {
    // Use first line of content as title
    const text = stripHtml(this.refs.editor.innerHTML);
    const firstLine = text.split('\n')[0].trim();
    return firstLine.substring(0, 50) || 'Untitled';
  }

  deleteCurrentNote() {
    if (!this.state.currentNoteId) return;

    const confirmed = window.confirm('Delete this note?');
    if (!confirmed) return;

    const index = this.state.notes.findIndex(n => n.id === this.state.currentNoteId);
    if (index > -1) {
      this.state.notes.splice(index, 1);
      this.saveNotes();
    }

    this.state.currentNoteId = null;
    this.state.isDirty = false;
    this.updateEditorVisibility();
    this.renderNotesList();
  }

  linkCurrentNote() {
    if (!this.state.currentNoteId) {
      // Create a new note and link it
      this.createNewNote();
    }

    if (!this.state.currentReference) {
      this.refs.status.textContent = 'Navigate to a verse to link';
      return;
    }

    const note = this.state.notes.find(n => n.id === this.state.currentNoteId);
    if (!note) return;

    note.reference = this.state.currentReference;
    note.referenceDisplay = this.state.currentReferenceDisplay;
    note.modified = Date.now();

    this.saveNotes();

    // Update UI
    this.refs.referenceBadge.textContent = note.referenceDisplay || note.reference;
    this.refs.referenceBadge.classList.add('visible');
    this.refs.unlinkBtn.classList.add('visible');
    this.refs.status.textContent = `Linked to ${note.referenceDisplay}`;

    this.renderNotesList();
  }

  unlinkCurrentNote() {
    if (!this.state.currentNoteId) return;

    const note = this.state.notes.find(n => n.id === this.state.currentNoteId);
    if (!note) return;

    note.reference = null;
    note.referenceDisplay = null;
    note.modified = Date.now();

    this.saveNotes();

    // Update UI
    this.refs.referenceBadge.classList.remove('visible');
    this.refs.unlinkBtn.classList.remove('visible');
    this.refs.status.textContent = 'Verse link removed';

    this.renderNotesList();
  }

  importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result;
      const imported = parseImportedFile(text, file.name);

      if (imported.length === 0) {
        this.refs.status.textContent = 'No notes found in file';
        return;
      }

      this.state.notes.unshift(...imported);
      this.saveNotes();
      this.renderNotesList();
      this.selectNote(imported[0].id);
      this.refs.status.textContent = `Imported ${imported.length} note${imported.length !== 1 ? 's' : ''}`;
    };
    reader.readAsText(file);
  }

  markDirty() {
    this.state.isDirty = true;
    this.refs.status.textContent = 'Unsaved changes';
  }

  scheduleAutosave() {
    if (this._autosaveTimer) {
      clearTimeout(this._autosaveTimer);
    }
    this._autosaveTimer = setTimeout(() => {
      this.saveCurrentNote();
    }, AUTOSAVE_DELAY_MS);
  }

  execFormatCommand(command, value = null) {
    this.refs.editor.focus();
    document.execCommand(command, false, value);
    this.markDirty();
    this.scheduleAutosave();
  }

  size(width, height) {
    if (this.refs.header) {
      this.refs.header.style.width = `${width}px`;
    }
    if (this.refs.main) {
      this.refs.main.style.width = `${width}px`;
      this.refs.main.style.height = `${height - (this.refs.header?.offsetHeight || 50)}px`;
    }
  }

  getData() {
    return {
      params: {
        win: 'notes',
        noteId: this.state.currentNoteId,
        filter: this.state.filterMode
      }
    };
  }
}

registerWindowComponent('notes-window', NotesWindowComponent, {
  windowType: 'notes',
  displayName: 'Notes',
  paramKeys: { noteId: 'n', filter: 'f' }
});

export { NotesWindowComponent as NotesWindow };

export default NotesWindowComponent;
