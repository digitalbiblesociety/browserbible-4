/**
 * NotesStore - single source of truth for user notes in localStorage.
 *
 * All NotesWindow instances in a tab share one store (getSharedNotesStore),
 * so same-tab windows stay consistent through its 'change' events. A
 * 'storage' listener folds in writes from other tabs.
 *
 * Uses raw localStorage rather than AppSettings on purpose: AppSettings
 * prefixes keys with config.settingsPrefix, which gets bumped to reset
 * settings, and notes need to survive that.
 *
 * Persists are read-merge-write per note id (newer `modified` wins), with
 * session-scoped delete tombstones so a note removed in this tab isn't
 * resurrected by the merge. Editing the same note in two tabs at once is
 * still last-write-wins for that note.
 */

import { mixinEventEmitter } from '../../common/EventEmitter.js';
import { sanitizeHtml, stripHtml } from './sanitize.js';

export const NOTES_STORAGE_KEY = 'browserbible_notes';
export const CORRUPT_BACKUP_KEY = 'browserbible_notes_corrupt_backup';
export const SCHEMA_VERSION = 1;

export function generateId() {
  return 'note_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

/**
 * Validate/coerce a raw note object into schema v1.
 * @returns {object|null} Normalized note, or null if unusable
 */
export function normalizeNote(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const now = Date.now();
  const created = Number.isFinite(raw.created) ? raw.created : now;
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : generateId(),
    title: typeof raw.title === 'string' ? raw.title : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    reference: typeof raw.reference === 'string' && raw.reference ? raw.reference : null,
    referenceDisplay: typeof raw.referenceDisplay === 'string' && raw.referenceDisplay ? raw.referenceDisplay : null,
    pinned: raw.pinned === true,
    created,
    modified: Number.isFinite(raw.modified) ? raw.modified : created
  };
}

/**
 * Upgrade a parsed storage payload to schema v1. Legacy (unversioned)
 * payloads predate sanitization, so their content is cleaned once here;
 * after that the write sites keep it clean.
 * @param {object|Array} parsed - JSON.parse'd payload ({version, notes} or bare array)
 * @returns {{version: number, notes: Array}}
 */
export function migratePayload(parsed) {
  const isArray = Array.isArray(parsed);
  const rawNotes = isArray ? parsed : (parsed && Array.isArray(parsed.notes) ? parsed.notes : []);
  const version = isArray ? undefined : parsed?.version;
  const notes = rawNotes.map(normalizeNote).filter(Boolean);
  if (version !== SCHEMA_VERSION) {
    for (const note of notes) {
      note.content = sanitizeHtml(note.content);
    }
  }
  return { version: SCHEMA_VERSION, notes };
}

/**
 * Merge in-memory notes with what's currently in storage (read-merge-write).
 * Union by id: the newer `modified` wins, and stored-only notes survive
 * (another tab added them) unless their id is in deletedIds.
 * @returns {Array} Merged notes, memory order first, stored-only appended
 */
export function mergeNotes(storedNotes, memoryNotes, deletedIds = new Set()) {
  const byId = new Map();
  for (const note of storedNotes) {
    if (!deletedIds.has(note.id)) byId.set(note.id, note);
  }
  for (const note of memoryNotes) {
    const existing = byId.get(note.id);
    if (!existing || (note.modified || 0) >= (existing.modified || 0)) {
      byId.set(note.id, note);
    }
  }

  const result = [];
  const seen = new Set();
  for (const note of memoryNotes) {
    if (!seen.has(note.id) && byId.has(note.id)) {
      result.push(byId.get(note.id));
      seen.add(note.id);
    }
  }
  for (const note of storedNotes) {
    if (!seen.has(note.id) && byId.has(note.id)) {
      result.push(byId.get(note.id));
      seen.add(note.id);
    }
  }
  return result;
}

function isQuotaError(err) {
  return !!err && (
    err.name === 'QuotaExceededError' ||
    err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    err.code === 22 ||
    err.code === 1014
  );
}

/** In-memory stand-in used when localStorage is unavailable (private mode). */
function createMemoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); }
  };
}

function resolveStorage() {
  try {
    const s = window.localStorage;
    s.getItem(NOTES_STORAGE_KEY);
    return s;
  } catch {
    console.warn('[NotesStore] localStorage unavailable; notes will not persist this session');
    return createMemoryStorage();
  }
}

/**
 * Create a notes store. Use getSharedNotesStore() in app code; this factory
 * exists so tests can inject fake storage/window.
 * @param {{storage?: Storage, win?: Window}} deps
 * @returns {object} Store instance (EventEmitter: 'change', 'error')
 */
export function createNotesStore({ storage, win } = {}) {
  const _storage = storage || resolveStorage();
  const _win = win || window;
  const _deletedIds = new Set();
  const _plainTextCache = new Map();
  let _notes = [];

  const store = mixinEventEmitter({
    corruptionDetected: false,
    hasPendingWrites: false
  });

  function emitChange(source, ids) {
    store.trigger('change', { source, ids });
  }

  function quarantine(raw) {
    try {
      _storage.setItem(CORRUPT_BACKUP_KEY, raw);
    } catch (err) {
      console.error('[NotesStore] Could not back up corrupt notes payload:', err);
    }
    store.corruptionDetected = true;
    store.trigger('error', { code: 'corrupt' });
  }

  function readStoredNotes() {
    const raw = _storage.getItem(NOTES_STORAGE_KEY);
    if (raw == null || raw === '') return { raw, notes: [] };
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
    if (!parsed || (!Array.isArray(parsed) && !Array.isArray(parsed.notes))) {
      return { raw, notes: null, version: undefined };
    }
    const payload = migratePayload(parsed);
    return { raw, notes: payload.notes, version: Array.isArray(parsed) ? undefined : parsed.version };
  }

  function load() {
    let result;
    try {
      result = readStoredNotes();
    } catch (err) {
      console.error('[NotesStore] Failed to read notes:', err);
      _notes = [];
      return;
    }
    if (result.notes === null) {
      // Unparseable: back up the raw payload for recovery before starting
      // fresh, so the next save can't destroy it.
      quarantine(result.raw);
      _notes = [];
      return;
    }
    _notes = result.notes;
    if (result.raw != null && result.raw !== '' && result.version !== SCHEMA_VERSION) {
      persist(); // write back the migrated payload
    }
  }

  function persist() {
    try {
      const result = readStoredNotes();
      if (Array.isArray(result.notes)) {
        _notes = mergeNotes(result.notes, _notes, _deletedIds);
      }
    } catch {
      // Storage unreadable mid-merge: fall through, memory wins.
    }

    try {
      _storage.setItem(NOTES_STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, notes: _notes }));
      store.hasPendingWrites = false;
      return true;
    } catch (err) {
      // Keep the memory state and flag it. Nothing is lost while the tab
      // lives, and every later write retries.
      store.hasPendingWrites = true;
      if (isQuotaError(err)) {
        store.trigger('error', { code: 'quota', error: err });
      } else {
        console.error('[NotesStore] Failed to save notes:', err);
        store.trigger('error', { code: 'unknown', error: err });
      }
      return false;
    }
  }

  function handleStorageEvent(e) {
    // e.key === null means storage.clear()
    if (e.key !== null && e.key !== NOTES_STORAGE_KEY) return;
    _plainTextCache.clear();
    load();
    emitChange('external');
  }

  store.getAll = () => _notes;

  store.get = (id) => _notes.find((n) => n.id === id) || null;

  store.create = (fields = {}) => {
    const note = normalizeNote({ ...fields });
    _notes.unshift(note);
    persist();
    emitChange('local', [note.id]);
    return note;
  };

  store.update = (id, changes = {}) => {
    const index = _notes.findIndex((n) => n.id === id);
    // If the id vanished (another tab deleted it mid-edit), re-add instead of
    // throwing the user's work away.
    const base = index === -1 ? { id } : _notes[index];
    const modified = Object.prototype.hasOwnProperty.call(changes, 'modified')
      ? changes.modified
      : Date.now();
    const updated = normalizeNote({ ...base, ...changes, id, modified });
    if (index === -1) {
      _notes.unshift(updated);
      _deletedIds.delete(id);
    } else {
      _notes[index] = updated;
    }
    _plainTextCache.delete(id);
    persist();
    emitChange('local', [id]);
    return updated;
  };

  store.remove = (id) => {
    const index = _notes.findIndex((n) => n.id === id);
    if (index === -1) return false;
    _notes.splice(index, 1);
    _deletedIds.add(id);
    _plainTextCache.delete(id);
    persist();
    emitChange('local', [id]);
    return true;
  };

  /**
   * Bulk import. Mode 'add' prepends everything (file imports carry fresh
   * ids); 'merge' dedupes by id with newer `modified` winning (JSON restore).
   * @returns {{added: number, updated: number, skipped: number}}
   */
  store.importNotes = (imported, { mode = 'add' } = {}) => {
    const result = { added: 0, updated: 0, skipped: 0 };
    const clean = (imported || []).map(normalizeNote).filter(Boolean);

    for (const note of clean) {
      if (mode === 'merge') {
        const index = _notes.findIndex((n) => n.id === note.id);
        if (index !== -1) {
          if ((note.modified || 0) > (_notes[index].modified || 0)) {
            _notes[index] = note;
            _plainTextCache.delete(note.id);
            result.updated++;
          } else {
            result.skipped++;
          }
          continue;
        }
        _deletedIds.delete(note.id);
      }
      _notes.unshift(note);
      result.added++;
    }

    if (result.added || result.updated) {
      persist();
      emitChange('local');
    }
    return result;
  };

  /** Cached plain text of a note's content (for search/filter/previews). */
  store.getPlainText = (id) => {
    if (_plainTextCache.has(id)) return _plainTextCache.get(id);
    const note = store.get(id);
    const text = note ? stripHtml(note.content || '') : '';
    _plainTextCache.set(id, text);
    return text;
  };

  store.retryPersist = () => (store.hasPendingWrites ? persist() : true);

  store.destroy = () => {
    _win.removeEventListener('storage', handleStorageEvent);
    store.clearListeners();
  };

  load();
  _win.addEventListener('storage', handleStorageEvent);

  return store;
}

let _sharedStore = null;

/** The store shared by all NotesWindow instances in this tab. */
export function getSharedNotesStore() {
  if (!_sharedStore) _sharedStore = createNotesStore();
  return _sharedStore;
}

/** Test hook: tear down the shared store so the next call builds a fresh one. */
export function resetSharedNotesStore() {
  if (_sharedStore) _sharedStore.destroy();
  _sharedStore = null;
}
