import { describe, it, expect, beforeEach } from 'vitest';
import '@windows/NotesWindow.js';
import { resetSharedNotesStore } from '@windows/NotesWindow/NotesStore.js';

/**
 * Unconnected notes-window element: the constructor runs (state, shared
 * store), but render()/init() never do, so tests drive individual methods
 * with hand-stubbed refs (same technique as MediaWindow.test.js).
 */
function makeWindow() {
  const win = document.createElement('notes-window');
  win.refs = {
    status: { textContent: '' },
    editor: { innerHTML: '' },
    titleInput: { value: '' }
  };
  return win;
}

beforeEach(() => {
  window.localStorage.clear();
  resetSharedNotesStore();
});

describe('NotesWindow formatReferenceDisplay', () => {
  it('formats fragmentids through Reference (localized book names)', () => {
    const win = makeWindow();
    expect(win.formatReferenceDisplay({ fragmentid: 'JN3_16' })).toBe('John 3:16');
    expect(win.formatReferenceDisplay({ fragmentid: 'PS23' })).toBe('Psalm 23');
  });

  it('handles numbered-book codes the old regex mangled', () => {
    const win = makeWindow();
    expect(win.formatReferenceDisplay({ fragmentid: 'J12_5' })).toBe('1 John 2:5');
  });

  it('falls back to the raw id for unparseable input, null for none', () => {
    const win = makeWindow();
    expect(win.formatReferenceDisplay({ fragmentid: 'NOPE' })).toBe('NOPE');
    expect(win.formatReferenceDisplay({})).toBeNull();
    expect(win.formatReferenceDisplay(null)).toBeNull();
  });
});

describe('NotesWindow message handling', () => {
  it('tracks the current reference from nav messages', () => {
    const win = makeWindow();
    win.handleMessage({ data: { messagetype: 'nav', type: 'bible', locationInfo: { fragmentid: 'RM8_28' } } });
    expect(win.state.currentReference).toBe('RM8_28');
    expect(win.state.currentReferenceDisplay).toBe('Romans 8:28');
  });

  it('tracks reference and text id from textload replies (sync-on-open)', () => {
    const win = makeWindow();
    win.handleMessage({ data: { messagetype: 'textload', textid: 'ENGWEB', fragmentid: 'JN3_16' } });
    expect(win.state.currentTextId).toBe('ENGWEB');
    expect(win.state.currentReference).toBe('JN3_16');
  });

  it('ignores unrelated messages', () => {
    const win = makeWindow();
    win.handleMessage({ data: { messagetype: 'search' } });
    win.handleMessage({});
    expect(win.state.currentReference).toBeNull();
  });
});

describe('NotesWindow linkCurrentNote', () => {
  it('does not create a blank note when there is no current reference', () => {
    const win = makeWindow();
    win.state.currentReference = null;

    win.linkCurrentNote();

    expect(win.store.getAll()).toHaveLength(0);
    expect(win.state.currentNoteId).toBeNull();
    expect(win.refs.status.textContent).not.toBe('');
  });
});

describe('NotesWindow editor helpers', () => {
  it('normalizeEmptyEditor clears the <br> husk contentEditable leaves behind', () => {
    const win = makeWindow();
    for (const husk of ['<br>', '<div><br></div>', '<p><br></p>', '  ']) {
      win.refs.editor.innerHTML = husk;
      win.normalizeEmptyEditor();
      expect(win.refs.editor.innerHTML).toBe('');
    }
  });

  it('normalizeEmptyEditor leaves real content alone', () => {
    const win = makeWindow();
    win.refs.editor.innerHTML = '<p>text</p>';
    win.normalizeEmptyEditor();
    expect(win.refs.editor.innerHTML).toBe('<p>text</p>');
  });

  it('getAutoTitle uses the first line of content', () => {
    const win = makeWindow();
    win.refs.editor.innerHTML = '<div>First line of the note</div><div>second line</div>';
    expect(win.getAutoTitle()).toBe('First line of the note');
  });
});

describe('NotesWindow getData', () => {
  it('returns flat keys for settings persistence and params for URLs', () => {
    const win = makeWindow();
    win.state.currentNoteId = 'note_abc';
    win.state.filterMode = 'linked';
    win.state.sortMode = 'title';
    win.state.sidebarVisible = false;

    expect(win.getData()).toEqual({
      noteId: 'note_abc',
      filter: 'linked',
      sort: 'title',
      sidebarVisible: false,
      params: { win: 'notes', noteId: 'note_abc', filter: 'linked', sort: 'title' }
    });
  });
});
