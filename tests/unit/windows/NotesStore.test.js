import { describe, it, expect } from 'vitest';
import {
  createNotesStore,
  mergeNotes,
  normalizeNote,
  migratePayload,
  NOTES_STORAGE_KEY,
  CORRUPT_BACKUP_KEY,
  SCHEMA_VERSION
} from '@windows/NotesWindow/NotesStore.js';

/** Map-backed Storage double with switchable quota failure. */
function createFakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  const storage = {
    failWrites: false,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => {
      if (storage.failWrites) {
        const err = new Error('quota exceeded');
        err.name = 'QuotaExceededError';
        throw err;
      }
      data.set(k, String(v));
    },
    removeItem: (k) => data.delete(k),
    data
  };
  return storage;
}

/** Minimal window double: collects 'storage' handlers, fires them on demand. */
function createFakeWin() {
  const handlers = [];
  return {
    addEventListener: (type, fn) => { if (type === 'storage') handlers.push(fn); },
    removeEventListener: (type, fn) => {
      const i = handlers.indexOf(fn);
      if (i > -1) handlers.splice(i, 1);
    },
    fireStorage: (event) => handlers.forEach((fn) => fn(event)),
    handlers
  };
}

function makeStore(storage = createFakeStorage(), win = createFakeWin()) {
  return { store: createNotesStore({ storage, win }), storage, win };
}

function storedPayload(storage) {
  return JSON.parse(storage.data.get(NOTES_STORAGE_KEY));
}

describe('normalizeNote', () => {
  it('coerces missing fields to schema defaults', () => {
    const note = normalizeNote({ title: 'T' });
    expect(note.id).toMatch(/^note_/);
    expect(note.content).toBe('');
    expect(note.reference).toBeNull();
    expect(note.pinned).toBe(false);
    expect(note.created).toBeGreaterThan(0);
    expect(note.modified).toBe(note.created);
  });

  it('rejects non-objects', () => {
    expect(normalizeNote(null)).toBeNull();
    expect(normalizeNote('x')).toBeNull();
    expect(normalizeNote([1, 2])).toBeNull();
  });
});

describe('migratePayload', () => {
  it('upgrades legacy unversioned payloads, sanitizing content once', () => {
    const legacy = { notes: [{ id: 'a', title: 'T', content: '<p>hi</p><script>x()</script>', created: 1, modified: 2 }] };
    const payload = migratePayload(legacy);
    expect(payload.version).toBe(SCHEMA_VERSION);
    expect(payload.notes[0].content).toBe('<p>hi</p>');
    expect(payload.notes[0].pinned).toBe(false);
  });

  it('leaves current-version content alone', () => {
    const v1 = { version: SCHEMA_VERSION, notes: [{ id: 'a', content: '<p>x</p>', created: 1, modified: 1 }] };
    expect(migratePayload(v1).notes[0].content).toBe('<p>x</p>');
  });

  it('drops unusable entries', () => {
    expect(migratePayload({ notes: [null, 'junk', { id: 'ok', created: 1, modified: 1 }] }).notes).toHaveLength(1);
  });
});

describe('mergeNotes', () => {
  const n = (id, modified, extra = {}) => ({ id, title: id, content: '', reference: null, referenceDisplay: null, pinned: false, created: 1, modified, ...extra });

  it('newer modified wins when both sides have a note', () => {
    const merged = mergeNotes([n('a', 100, { title: 'stored' })], [n('a', 200, { title: 'memory' })]);
    expect(merged).toHaveLength(1);
    expect(merged[0].title).toBe('memory');

    const merged2 = mergeNotes([n('a', 300, { title: 'stored' })], [n('a', 200, { title: 'memory' })]);
    expect(merged2[0].title).toBe('stored');
  });

  it('keeps stored-only notes (added by another tab)', () => {
    const merged = mergeNotes([n('a', 1), n('b', 1)], [n('a', 2)]);
    expect(merged.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('never resurrects tombstoned ids', () => {
    const merged = mergeNotes([n('dead', 999)], [], new Set(['dead']));
    expect(merged).toHaveLength(0);
  });
});

describe('NotesStore', () => {
  it('round-trips notes with a versioned payload', () => {
    const { store, storage } = makeStore();
    const note = store.create({ title: 'Hello', content: '<p>World</p>' });

    const payload = storedPayload(storage);
    expect(payload.version).toBe(SCHEMA_VERSION);
    expect(payload.notes[0].id).toBe(note.id);

    // A fresh store on the same storage sees the same notes.
    const { store: store2 } = makeStore(storage);
    expect(store2.getAll()).toHaveLength(1);
    expect(store2.get(note.id).title).toBe('Hello');
  });

  it('migrates a legacy payload on load and writes back v1', () => {
    const storage = createFakeStorage({
      [NOTES_STORAGE_KEY]: JSON.stringify({ notes: [{ id: 'old1', title: 'Legacy', content: '<p>x</p><img src=x onerror=alert(1)>', created: 1, modified: 1 }] })
    });
    const { store } = makeStore(storage);

    expect(store.getAll()).toHaveLength(1);
    expect(store.get('old1').content).toBe('<p>x</p>');
    expect(storedPayload(storage).version).toBe(SCHEMA_VERSION);
  });

  it('quarantines a corrupt payload instead of wiping it', () => {
    const storage = createFakeStorage({ [NOTES_STORAGE_KEY]: '{definitely not json' });
    const { store } = makeStore(storage);

    expect(store.corruptionDetected).toBe(true);
    expect(store.getAll()).toEqual([]);
    expect(storage.data.get(CORRUPT_BACKUP_KEY)).toBe('{definitely not json');

    // Subsequent saves must not destroy the backup.
    store.create({ title: 'new' });
    expect(storage.data.get(CORRUPT_BACKUP_KEY)).toBe('{definitely not json');
    expect(storedPayload(storage).notes).toHaveLength(1);
  });

  it('quarantines a parseable-but-unusable payload', () => {
    const storage = createFakeStorage({ [NOTES_STORAGE_KEY]: '"just a string"' });
    const { store } = makeStore(storage);
    expect(store.corruptionDetected).toBe(true);
    expect(storage.data.get(CORRUPT_BACKUP_KEY)).toBe('"just a string"');
  });

  it('keeps memory state and emits an error on quota failure, then retries', () => {
    const { store, storage } = makeStore();
    const errors = [];
    store.on('error', (e) => errors.push(e));

    storage.failWrites = true;
    const note = store.create({ title: 'kept in memory' });

    expect(errors).toEqual([expect.objectContaining({ code: 'quota' })]);
    expect(store.hasPendingWrites).toBe(true);
    expect(store.get(note.id)).toBeTruthy();
    expect(storage.data.has(NOTES_STORAGE_KEY)).toBe(false);

    storage.failWrites = false;
    expect(store.retryPersist()).toBe(true);
    expect(store.hasPendingWrites).toBe(false);
    expect(storedPayload(storage).notes[0].title).toBe('kept in memory');
  });

  it('merges concurrent writes from two stores on the same storage', () => {
    const storage = createFakeStorage();
    const { store: a } = makeStore(storage);
    const { store: b } = makeStore(storage);

    const noteA = a.create({ title: 'from A' });
    const noteB = b.create({ title: 'from B' }); // b never saw noteA in memory

    const ids = storedPayload(storage).notes.map((x) => x.id);
    expect(ids).toContain(noteA.id);
    expect(ids).toContain(noteB.id);
    expect(b.getAll().map((x) => x.id)).toContain(noteA.id); // merge pulled it in
  });

  it('does not resurrect a note it deleted when persisting later changes', () => {
    const storage = createFakeStorage();
    const { store } = makeStore(storage);
    const dead = store.create({ title: 'doomed' });
    store.remove(dead.id);
    store.create({ title: 'alive' });

    const titles = storedPayload(storage).notes.map((x) => x.title);
    expect(titles).toEqual(['alive']);
  });

  it('reloads and emits an external change on cross-tab storage events', () => {
    const storage = createFakeStorage();
    const { store, win } = makeStore(storage);
    const events = [];
    store.on('change', (e) => events.push(e));

    // Another tab wrote a new payload.
    storage.data.set(NOTES_STORAGE_KEY, JSON.stringify({
      version: SCHEMA_VERSION,
      notes: [{ id: 'remote1', title: 'From other tab', content: '', created: 1, modified: 1 }]
    }));
    win.fireStorage({ key: NOTES_STORAGE_KEY });

    expect(events).toEqual([expect.objectContaining({ source: 'external' })]);
    expect(store.get('remote1')).toBeTruthy();
  });

  it('ignores storage events for other keys', () => {
    const { store, win } = makeStore();
    const events = [];
    store.on('change', (e) => events.push(e));
    win.fireStorage({ key: 'some-other-key' });
    expect(events).toHaveLength(0);
  });

  it('update() re-adds a note that another tab deleted mid-edit', () => {
    const storage = createFakeStorage();
    const { store } = makeStore(storage);
    const note = store.create({ title: 'editing' });

    // Simulate the other tab deleting it (storage + our memory both lose it).
    storage.data.set(NOTES_STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, notes: [] }));
    store.getAll().length = 0;

    store.update(note.id, { title: 'still here', content: '<p>work</p>' });
    expect(store.get(note.id).title).toBe('still here');
    expect(storedPayload(storage).notes.map((x) => x.id)).toContain(note.id);
  });

  it('update() leaves modified alone when explicitly passed (pin toggles)', () => {
    const { store } = makeStore();
    const note = store.create({ title: 'x' });
    const updated = store.update(note.id, { pinned: true, modified: note.modified });
    expect(updated.pinned).toBe(true);
    expect(updated.modified).toBe(note.modified);
  });

  it('importNotes merge mode dedupes by id with newer modified winning', () => {
    const { store } = makeStore();
    const existing = store.create({ title: 'mine' });
    const stale = store.create({ title: 'newer here' });

    const result = store.importNotes([
      { id: existing.id, title: 'imported newer', content: '', created: 1, modified: existing.modified + 1000 },
      { id: stale.id, title: 'imported older', content: '', created: 1, modified: stale.modified - 1000 },
      { id: 'brand-new', title: 'added', content: '', created: 1, modified: 1 }
    ], { mode: 'merge' });

    expect(result).toEqual({ added: 1, updated: 1, skipped: 1 });
    expect(store.get(existing.id).title).toBe('imported newer');
    expect(store.get(stale.id).title).toBe('newer here');
    expect(store.get('brand-new')).toBeTruthy();
  });

  it('importNotes add mode prepends everything', () => {
    const { store } = makeStore();
    const result = store.importNotes([
      { id: 'i1', title: 'a', content: '', created: 1, modified: 1 },
      { id: 'i2', title: 'b', content: '', created: 1, modified: 1 }
    ], { mode: 'add' });
    expect(result).toEqual({ added: 2, updated: 0, skipped: 0 });
    expect(store.getAll()).toHaveLength(2);
  });

  it('caches plain text and invalidates on update and external reload', () => {
    const storage = createFakeStorage();
    const { store, win } = makeStore(storage);
    const note = store.create({ content: '<p>Hello <b>World</b></p>' });

    expect(store.getPlainText(note.id)).toBe('Hello World');
    expect(store.getPlainText(note.id)).toBe('Hello World'); // cached path

    store.update(note.id, { content: '<p>Changed</p>' });
    expect(store.getPlainText(note.id)).toBe('Changed');

    storage.data.set(NOTES_STORAGE_KEY, JSON.stringify({
      version: SCHEMA_VERSION,
      notes: [{ ...note, content: '<p>External</p>' }]
    }));
    win.fireStorage({ key: NOTES_STORAGE_KEY });
    expect(store.getPlainText(note.id)).toBe('External');
  });

  it('emits local change events with the affected ids', () => {
    const { store } = makeStore();
    const events = [];
    store.on('change', (e) => events.push(e));

    const note = store.create({ title: 'x' });
    store.update(note.id, { title: 'y' });
    store.remove(note.id);

    expect(events.map((e) => e.source)).toEqual(['local', 'local', 'local']);
    expect(events[1].ids).toEqual([note.id]);
  });

  it('destroy() removes the storage listener', () => {
    const { store, win } = makeStore();
    expect(win.handlers).toHaveLength(1);
    store.destroy();
    expect(win.handlers).toHaveLength(0);
  });
});
