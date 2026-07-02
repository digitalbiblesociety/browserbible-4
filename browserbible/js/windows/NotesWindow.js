/**
 * NotesWindow - Web Component for note-taking with verse linking
 *
 * Notes live in a shared NotesStore (one per tab, synced across tabs), so
 * multiple Notes windows stay consistent. This class owns the editor buffer
 * and view state (filter/sort/search/selection) only.
 */

import { BaseWindow, registerWindowComponent } from './BaseWindow.js';
import { Reference } from '../bible/BibleReference.js';
import { t } from '../lib/i18n.js';
import { downloadNotes } from './NotesWindow/download.js';
import { parseImportedFile } from './NotesWindow/upload.js';
import { printNotes } from './NotesWindow/print.js';
import { getSharedNotesStore } from './NotesWindow/NotesStore.js';
import { filterAndSortNotes } from './NotesWindow/query.js';
import { sanitizeHtml, stripHtml } from './NotesWindow/sanitize.js';
import { detectReferences } from './NotesWindow/references.js';
import { showNotice, showConfirm } from './NotesWindow/notice.js';
import {
  updateSearchSuggestions,
  hideSearchSuggestions,
  updateSuggestionSelection,
  selectSuggestion
} from './NotesWindow/search.js';
import {
  renderWindowStructure,
  renderNotesList,
  renderDetectedRefs
} from './NotesWindow/render.js';

const AUTOSAVE_DELAY_MS = 1000;
const NARROW_WIDTH_PX = 480;

/**
 * NotesWindow Web Component
 * Provides note-taking with verse linking support
 */
class NotesWindowComponent extends BaseWindow {
  constructor() {
    super();

    this.state = {
      ...this.state,
      currentNoteId: null,
      currentReference: null,
      currentReferenceDisplay: null,
      currentTextId: null,
      filterMode: 'all',
      sortMode: 'modified',
      searchQuery: '',
      isDirty: false,
      sidebarVisible: true,
      searchSuggestions: [],
      selectedSuggestionIndex: -1
    };

    this.store = getSharedNotesStore();
    this._autosaveTimer = null;
    this._selfChange = false;
    this._quotaNotified = false;
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
    this.refs.printBtn = this.$('.notes-print-btn');
    this.refs.printMenu = this.$('.notes-print-menu');
    this.refs.printVersesCheckbox = this.$('.notes-print-verses-checkbox');
    this.refs.filter = this.$('.notes-filter');
    this.refs.sortSelect = this.$('.notes-sort');
    this.refs.search = this.$('.notes-search');
    this.refs.searchSuggestions = this.$('.notes-search-suggestions');
    this.refs.sidebar = this.$('.notes-sidebar');
    this.refs.list = this.$('.notes-list');
    this.refs.editorContainer = this.$('.notes-editor-container');
    this.refs.titleInput = this.$('.notes-title-input');
    this.refs.referenceBadge = this.$('.notes-reference-badge');
    this.refs.unlinkBtn = this.$('.notes-unlink-btn');
    this.refs.pinToggle = this.$('.notes-pin-toggle');
    this.refs.deleteBtn = this.$('.notes-delete-btn');
    this.refs.toolbar = this.$('.notes-richtext-toolbar');
    this.refs.editor = this.$('.notes-editor');
    this.refs.detectedRefs = this.$('.notes-detected-refs');
    this.refs.status = this.$('.notes-status');
    this.refs.modified = this.$('.notes-modified');
    this.refs.emptyState = this.$('.notes-empty-state');
  }

  attachEventListeners() {
    this.addListener(this.refs.sidebarToggle, 'click', () => this.toggleSidebar());
    this.addListener(this.refs.newBtn, 'click', () => this.createNewNote());
    this.addListener(this.refs.linkBtn, 'click', () => this.linkCurrentNote());

    this.addListener(this.refs.downloadBtn, 'click', () => {
      this.refs.downloadMenu.classList.toggle('visible');
    });

    this.addListener(this.refs.downloadMenu, 'click', (e) => {
      const item = e.target.closest('.notes-download-item');
      if (item) {
        this.saveCurrentNote();
        downloadNotes(this.store.getAll(), item.dataset.format);
        this.refs.downloadMenu.classList.remove('visible');
      }
    });

    // Close dropdown menus on outside click
    this.addListener(document, 'click', (e) => {
      if (!e.target.closest('.notes-download-container')) {
        this.refs.downloadMenu.classList.remove('visible');
      }
      if (!e.target.closest('.notes-print-container')) {
        this.refs.printMenu.classList.remove('visible');
      }
    });

    this.addListener(this.refs.uploadBtn, 'click', () => {
      this.refs.uploadInput.click();
    });

    this.addListener(this.refs.uploadInput, 'change', () => {
      const file = this.refs.uploadInput.files[0];
      if (file) {
        this.importFile(file);
        this.refs.uploadInput.value = '';
      }
    });

    this.addListener(this.refs.printBtn, 'click', () => {
      this.refs.printMenu.classList.toggle('visible');
    });

    this.addListener(this.refs.printMenu, 'click', (e) => {
      const item = e.target.closest('.notes-print-item');
      if (item) {
        const action = item.dataset.action;
        const includeVerseText = this.refs.printVersesCheckbox.checked;
        this.refs.printMenu.classList.remove('visible');

        if (action === 'current') {
          this.printCurrentNote(includeVerseText);
        } else if (action === 'all') {
          this.printAllNotes(includeVerseText);
        }
      }
    });

    this.addListener(this.refs.filter, 'change', () => {
      this.state.filterMode = this.refs.filter.value;
      this.renderNotesList();
      this.notifySettingsChange();
    });

    this.addListener(this.refs.sortSelect, 'change', () => {
      this.state.sortMode = this.refs.sortSelect.value;
      this.renderNotesList();
      this.notifySettingsChange();
    });

    this.addListener(this.refs.search, 'input', () => {
      this.state.searchQuery = this.refs.search.value;
      updateSearchSuggestions(this.state, this.refs, this.store.getAll(), this.getPlainText);
      this.renderNotesList();
    });

    this.addListener(this.refs.search, 'keydown', (e) => {
      if (!this.refs.searchSuggestions.classList.contains('visible')) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        updateSuggestionSelection(this.state, this.refs, this.state.selectedSuggestionIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        updateSuggestionSelection(this.state, this.refs, this.state.selectedSuggestionIndex - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.selectSuggestion(this.state.selectedSuggestionIndex);
      } else if (e.key === 'Escape') {
        hideSearchSuggestions(this.state, this.refs);
      }
    });

    // Delay on blur so a click on a suggestion lands before the list hides
    this.addListener(this.refs.search, 'blur', () => {
      setTimeout(() => hideSearchSuggestions(this.state, this.refs), 150);
    });

    this.addListener(this.refs.search, 'focus', () => {
      if (this.refs.search.value.trim()) {
        updateSearchSuggestions(this.state, this.refs, this.store.getAll(), this.getPlainText);
      }
    });

    // mousedown so the pick fires before the search input's blur
    this.addListener(this.refs.searchSuggestions, 'mousedown', (e) => {
      const item = e.target.closest('.notes-suggestion-item');
      if (item) {
        const index = parseInt(item.dataset.index, 10);
        this.selectSuggestion(index);
      }
    });

    this.addListener(this.refs.list, 'click', (e) => {
      const pinBtn = e.target.closest('.notes-pin-btn');
      if (pinBtn) {
        const item = pinBtn.closest('.notes-list-item');
        if (item) this.togglePinNote(item.dataset.noteId);
        return;
      }
      const item = e.target.closest('.notes-list-item');
      if (item) {
        this.selectNote(item.dataset.noteId);
      }
    });

    this.addListener(this.refs.titleInput, 'input', () => {
      this.markDirty();
      this.scheduleAutosave();
    });

    this.addListener(this.refs.unlinkBtn, 'click', () => this.unlinkCurrentNote());

    this.addListener(this.refs.pinToggle, 'click', () => {
      if (this.state.currentNoteId) this.togglePinNote(this.state.currentNoteId);
    });

    this.addListener(this.refs.deleteBtn, 'click', () => this.deleteCurrentNote());

    this.addListener(this.refs.toolbar, 'click', (e) => {
      const btn = e.target.closest('button');
      if (btn) {
        const command = btn.dataset.command;
        const value = btn.dataset.value || null;
        this.execFormatCommand(command, value);
      }
    });

    this.addListener(this.refs.editor, 'input', () => {
      this.normalizeEmptyEditor();
      this.markDirty();
      this.scheduleAutosave();
    });

    this.addListener(this.refs.editor, 'paste', (e) => this.handlePaste(e));

    this.addListener(this.refs.detectedRefs, 'click', (e) => {
      const chip = e.target.closest('.notes-ref-chip');
      if (chip) {
        this.navigateToReference(chip.dataset.fragmentid, chip.dataset.sectionid);
      }
    });

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

    this.on('message', (e) => this.handleMessage(e));
  }

  async init() {
    // Bound getter shared with search/render helpers
    this.getPlainText = (id) => this.store.getPlainText(id);

    this._onStoreChange = (e) => this.handleStoreChange(e);
    this._onStoreError = (e) => this.handleStoreError(e);
    this.store.on('change', this._onStoreChange);
    this.store.on('error', this._onStoreError);

    // The corrupt-load error fires during store construction, before any
    // window can subscribe, so read the flag instead.
    if (this.store.corruptionDetected) {
      showNotice(t('windows.notes.corruptError'));
    }

    const initFilter = this.getParam('filter');
    if (initFilter) {
      this.state.filterMode = initFilter;
      this.refs.filter.value = initFilter;
    }

    const initSort = this.getParam('sort');
    if (initSort) {
      this.state.sortMode = initSort;
      this.refs.sortSelect.value = initSort;
    }

    // Settings restore round-trips as a boolean, URL params as a string
    const initSidebar = this.getParam('sidebarVisible');
    if (initSidebar === false || initSidebar === 'false') {
      this.state.sidebarVisible = false;
      this.refs.sidebar.classList.add('hidden');
    }

    this.renderNotesList();
    this.updateEditorVisibility();

    const initNoteId = this.getParam('noteId');
    if (initNoteId) {
      this.selectNote(initNoteId);
    }

    // Ask Bible windows to re-broadcast their position so linking works
    // before the user's next navigation.
    this.requestCurrentContent();
  }

  cleanup() {
    if (this._autosaveTimer) {
      clearTimeout(this._autosaveTimer);
      this._autosaveTimer = null;
      this.saveCurrentNote();
    }
    // The shared store outlives this window, so always detach.
    if (this._onStoreChange) this.store.off('change', this._onStoreChange);
    if (this._onStoreError) this.store.off('error', this._onStoreError);
    super.cleanup();
  }

  // --- Store events ---

  handleStoreChange() {
    this.renderNotesList();

    const currentId = this.state.currentNoteId;
    if (!currentId) return;

    const note = this.store.get(currentId);
    if (!note) {
      // Deleted in another window/tab. With local edits pending, keep the
      // buffer; the next autosave re-adds it through store.update().
      if (!this.state.isDirty) {
        this.state.currentNoteId = null;
        this.updateEditorVisibility();
        this.renderNotesList();
      }
      return;
    }

    // Skip editor refresh for this window's own writes and while the user
    // has unsaved local edits (their keystrokes win).
    if (this._selfChange || this.state.isDirty) return;

    this.refs.titleInput.value = note.title || '';
    this.refs.editor.innerHTML = sanitizeHtml(note.content || '');
    this.normalizeEmptyEditor();
    this.updateEditorChrome(note);
    this.refs.modified.textContent = t('windows.notes.modified', { date: new Date(note.modified).toLocaleString() });
    this.updateDetectedRefs();
  }

  handleStoreError(e) {
    if (e.code === 'quota') {
      this.refs.status.textContent = t('windows.notes.notSaved');
      if (!this._quotaNotified) {
        this._quotaNotified = true;
        showNotice(t('windows.notes.quotaError'));
      }
    } else if (e.code === 'corrupt') {
      showNotice(t('windows.notes.corruptError'));
    } else {
      this.refs.status.textContent = t('windows.notes.saveFailed');
    }
  }

  /** Mark store writes from this window so change events don't bounce back into the editor. */
  _withStoreWrite(fn) {
    this._selfChange = true;
    try {
      return fn();
    } finally {
      this._selfChange = false;
    }
  }

  // --- Navigation messages ---

  handleMessage(e) {
    const data = e?.data;
    if (!data) return;

    if (data.messagetype === 'nav' && data.type === 'bible' && data.locationInfo) {
      this.setCurrentReference(data.locationInfo.fragmentid || null);
    } else if (data.messagetype === 'textload') {
      // Covers replies to requestCurrentContent() and regular text loads.
      // Carries the position and the Bible version (used to print verse text).
      if (data.textid) this.state.currentTextId = data.textid;
      if (data.fragmentid) this.setCurrentReference(data.fragmentid);
    }
  }

  setCurrentReference(fragmentid) {
    this.state.currentReference = fragmentid || null;
    this.state.currentReferenceDisplay = fragmentid
      ? this.formatReferenceDisplay({ fragmentid })
      : null;

    if (this.state.filterMode === 'reference') {
      this.renderNotesList();
    }
  }

  requestCurrentContent() {
    // Historical message name: TextWindow answers exactly this shape
    // (originally added for MapWindow) by re-broadcasting a 'textload'.
    this.trigger('globalmessage', {
      type: 'globalmessage',
      target: this,
      data: { messagetype: 'maprequest', requesttype: 'currentcontent' }
    });
  }

  navigateToReference(fragmentid, sectionid) {
    if (!fragmentid) return;
    this.setCurrentReference(fragmentid);
    this.trigger('globalmessage', {
      type: 'globalmessage',
      target: this,
      data: { messagetype: 'nav', type: 'bible', locationInfo: { sectionid, fragmentid } }
    });
  }

  formatReferenceDisplay(locationInfo) {
    const fid = locationInfo?.fragmentid;
    if (!fid) return null;
    const ref = Reference(fid);
    return ref?.isValid() ? ref.toString() : fid;
  }

  // --- List rendering ---

  getFilteredNotes() {
    return filterAndSortNotes(this.store.getAll(), {
      filterMode: this.state.filterMode,
      currentReference: this.state.currentReference,
      searchQuery: this.state.searchQuery,
      sortMode: this.state.sortMode,
      getPlainText: this.getPlainText
    });
  }

  renderNotesList() {
    const notes = this.getFilteredNotes();
    const emptyMessage = this.store.getAll().length === 0
      ? t('windows.notes.emptyListHint')
      : t('windows.notes.noNotesFound');
    this.refs.list.innerHTML = '';
    this.refs.list.appendChild(
      renderNotesList(notes, this.state.currentNoteId, this.getPlainText, emptyMessage)
    );
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
    this.notifySettingsChange();
  }

  selectSuggestion(index) {
    const noteId = selectSuggestion(this.state, this.refs, index);
    if (noteId) {
      this.state.searchQuery = '';
      this.selectNote(noteId);
      this.renderNotesList();
    }
  }

  // --- Note operations ---

  createNewNote() {
    this.saveCurrentNote();

    const note = this._withStoreWrite(() => this.store.create({}));
    this.selectNote(note.id);
    this.refs.titleInput.focus();
  }

  selectNote(noteId) {
    this.saveCurrentNote();

    const note = this.store.get(noteId);
    if (!note) return;

    this.state.currentNoteId = noteId;
    this.state.isDirty = false;

    // Sanitize on the way in: old data or other sources may predate the
    // write-side sanitization
    this.refs.titleInput.value = note.title || '';
    this.refs.editor.innerHTML = sanitizeHtml(note.content || '');
    this.normalizeEmptyEditor();

    this.updateEditorChrome(note);
    this.refs.modified.textContent = t('windows.notes.modified', { date: new Date(note.modified).toLocaleString() });
    this.refs.status.textContent = '';

    this.updateEditorVisibility();
    this.renderNotesList();
    this.updateDetectedRefs();

    // In narrow mode the sidebar overlays the editor, so close it after picking
    if (this.classList.contains('notes-narrow') && this.state.sidebarVisible) {
      this.toggleSidebar();
    }

    this.notifySettingsChange();
  }

  /** Sync the reference badge, unlink button, and pin toggle to a note. */
  updateEditorChrome(note) {
    if (note.reference) {
      this.refs.referenceBadge.textContent = note.referenceDisplay || note.reference;
      this.refs.referenceBadge.classList.add('visible');
      this.refs.unlinkBtn.classList.add('visible');
    } else {
      this.refs.referenceBadge.classList.remove('visible');
      this.refs.unlinkBtn.classList.remove('visible');
    }

    this.refs.pinToggle.classList.toggle('active', !!note.pinned);
    this.refs.pinToggle.title = t(note.pinned ? 'windows.notes.unpin' : 'windows.notes.pin');
    this.refs.pinToggle.setAttribute('aria-pressed', String(!!note.pinned));
  }

  saveCurrentNote() {
    if (!this.state.currentNoteId || !this.state.isDirty) return;

    const title = this.refs.titleInput.value.trim() || this.getAutoTitle();
    const content = sanitizeHtml(this.refs.editor.innerHTML);

    const updated = this._withStoreWrite(() =>
      this.store.update(this.state.currentNoteId, { title, content })
    );

    this.state.isDirty = false;
    this.refs.modified.textContent = t('windows.notes.modified', { date: new Date(updated.modified).toLocaleString() });
    if (!this.store.hasPendingWrites) {
      this._quotaNotified = false;
      this.refs.status.textContent = t('windows.notes.saved');
    }

    this.updateDetectedRefs();
  }

  getAutoTitle() {
    const text = stripHtml(this.refs.editor.innerHTML);
    const firstLine = text.split('\n')[0].trim();
    return firstLine.substring(0, 50) || t('windows.notes.untitled');
  }

  async deleteCurrentNote() {
    if (!this.state.currentNoteId) return;

    const confirmed = await showConfirm(t('windows.notes.deleteConfirm'), {
      confirmLabel: t('windows.notes.delete')
    });
    if (!confirmed) return;

    const noteId = this.state.currentNoteId;

    // Cancel any pending autosave; it would re-add the deleted note
    if (this._autosaveTimer) {
      clearTimeout(this._autosaveTimer);
      this._autosaveTimer = null;
    }
    this.state.currentNoteId = null;
    this.state.isDirty = false;

    this._withStoreWrite(() => this.store.remove(noteId));

    this.updateEditorVisibility();
    this.renderNotesList();
    this.notifySettingsChange();
  }

  linkCurrentNote() {
    // Bail before creating anything when there's nowhere to link to
    if (!this.state.currentReference) {
      this.refs.status.textContent = t('windows.notes.navigateToLink');
      return;
    }

    if (!this.state.currentNoteId) {
      this.createNewNote();
    }
    const noteId = this.state.currentNoteId;
    if (!noteId) return;

    this.saveCurrentNote();
    const updated = this._withStoreWrite(() => this.store.update(noteId, {
      reference: this.state.currentReference,
      referenceDisplay: this.state.currentReferenceDisplay
    }));

    this.updateEditorChrome(updated);
    this.refs.status.textContent = t('windows.notes.linkedTo', { reference: updated.referenceDisplay || updated.reference });
  }

  unlinkCurrentNote() {
    if (!this.state.currentNoteId) return;

    const note = this.store.get(this.state.currentNoteId);
    if (!note) return;

    const updated = this._withStoreWrite(() => this.store.update(note.id, {
      reference: null,
      referenceDisplay: null
    }));

    this.updateEditorChrome(updated);
    this.refs.status.textContent = t('windows.notes.linkRemoved');
  }

  togglePinNote(noteId) {
    const note = this.store.get(noteId);
    if (!note) return;

    // Keep modified unchanged so pinning doesn't reorder the list
    const updated = this._withStoreWrite(() =>
      this.store.update(noteId, { pinned: !note.pinned, modified: note.modified })
    );

    if (noteId === this.state.currentNoteId) {
      this.updateEditorChrome(updated);
    }
  }

  // --- Import / export / print ---

  importFile(file) {
    const reader = new FileReader();

    reader.onerror = () => {
      this.refs.status.textContent = t('windows.notes.importReadError');
      showNotice(t('windows.notes.importReadError'));
    };

    reader.onload = () => {
      let parsed;
      try {
        parsed = parseImportedFile(reader.result, file.name);
      } catch {
        this.refs.status.textContent = t('windows.notes.importInvalid');
        showNotice(t('windows.notes.importInvalid'));
        return;
      }

      const { notes, mode } = parsed;
      if (notes.length === 0) {
        this.refs.status.textContent = t('windows.notes.importNone');
        return;
      }

      const result = this._withStoreWrite(() => this.store.importNotes(notes, { mode }));

      if (mode === 'merge') {
        this.refs.status.textContent = t('windows.notes.importMerged', {
          added: result.added, updated: result.updated, skipped: result.skipped
        });
      } else {
        this.refs.status.textContent = t('windows.notes.imported', { count: result.added });
        this.selectNote(notes[0].id);
      }
    };

    reader.readAsText(file);
  }

  printCurrentNote(includeVerseText) {
    if (!this.state.currentNoteId) {
      this.refs.status.textContent = t('windows.notes.selectToPrint');
      return;
    }

    this.saveCurrentNote();
    const note = this.store.get(this.state.currentNoteId);
    if (!note) return;

    this.refs.status.textContent = includeVerseText ? t('windows.notes.preparingPrint') : '';
    printNotes([note], { includeVerseText, textId: this.state.currentTextId }).then(() => {
      this.refs.status.textContent = '';
    }).catch(err => {
      console.error('[NotesWindow] printCurrentNote error:', err);
      this.refs.status.textContent = t('windows.notes.printError');
    });
  }

  printAllNotes(includeVerseText) {
    this.saveCurrentNote();
    const notes = this.store.getAll();
    if (notes.length === 0) {
      this.refs.status.textContent = t('windows.notes.noNotesToPrint');
      return;
    }

    this.refs.status.textContent = includeVerseText ? t('windows.notes.preparingPrint') : '';
    printNotes(notes, {
      includeVerseText,
      title: t('windows.notes.printAllTitle'),
      textId: this.state.currentTextId
    }).then(() => {
      this.refs.status.textContent = '';
    }).catch(err => {
      console.error('[NotesWindow] printAllNotes error:', err);
      this.refs.status.textContent = t('windows.notes.printError');
    });
  }

  // --- Editor helpers ---

  markDirty() {
    this.state.isDirty = true;
    this.refs.status.textContent = t('windows.notes.unsavedChanges');
  }

  scheduleAutosave() {
    if (this._autosaveTimer) {
      clearTimeout(this._autosaveTimer);
    }
    this._autosaveTimer = setTimeout(() => {
      this._autosaveTimer = null;
      this.saveCurrentNote();
    }, AUTOSAVE_DELAY_MS);
  }

  execFormatCommand(command, value = null) {
    this.refs.editor.focus();
    document.execCommand(command, false, value);
    this.markDirty();
    this.scheduleAutosave();
  }

  handlePaste(e) {
    e.preventDefault();
    const html = e.clipboardData?.getData('text/html');
    if (html) {
      document.execCommand('insertHTML', false, sanitizeHtml(html));
    } else {
      const text = e.clipboardData?.getData('text/plain') || '';
      if (text) document.execCommand('insertText', false, text);
    }
    this.markDirty();
    this.scheduleAutosave();
  }

  /**
   * contentEditable leaves a lone <br> (or an empty block) behind when all
   * text is deleted, which defeats the :empty placeholder. Clear it.
   */
  normalizeEmptyEditor() {
    const html = this.refs.editor.innerHTML;
    const trimmed = html.trim();
    if (trimmed === '' || trimmed === '<br>' || trimmed === '<div><br></div>' || trimmed === '<p><br></p>') {
      if (html !== '') this.refs.editor.innerHTML = '';
    }
  }

  updateDetectedRefs() {
    const container = this.refs.detectedRefs;
    container.innerHTML = '';

    const note = this.state.currentNoteId ? this.store.get(this.state.currentNoteId) : null;
    const refs = note ? detectReferences(this.store.getPlainText(note.id)) : [];
    const fragment = renderDetectedRefs(refs);

    if (fragment) {
      container.appendChild(fragment);
      container.classList.add('visible');
    } else {
      container.classList.remove('visible');
    }
  }

  // --- Chrome plumbing ---

  notifySettingsChange() {
    this.trigger('settingschange', { type: 'settingschange', target: this, data: null });
  }

  size(width, height) {
    this.style.width = `${width}px`;
    this.style.height = `${height}px`;

    // The flex column layout sizes .notes-main; no height math needed here
    this.classList.toggle('notes-narrow', width > 0 && width < NARROW_WIDTH_PX);

    this.trigger('resize', {
      type: 'resize',
      target: this,
      data: { width, height }
    });
  }

  getData() {
    return {
      // Flat keys persist across reloads via AppSettings
      noteId: this.state.currentNoteId,
      filter: this.state.filterMode,
      sort: this.state.sortMode,
      sidebarVisible: this.state.sidebarVisible,
      // params (+ paramKeys) round-trip through the URL
      params: {
        win: 'notes',
        noteId: this.state.currentNoteId,
        filter: this.state.filterMode,
        sort: this.state.sortMode
      }
    };
  }
}

registerWindowComponent('notes-window', NotesWindowComponent, {
  windowType: 'notes',
  displayName: 'Notes',
  paramKeys: { noteId: 'n', filter: 'f', sort: 'o' }
});

export { NotesWindowComponent as NotesWindow };
