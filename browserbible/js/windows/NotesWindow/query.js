/**
 * Pure filter/search/sort logic for the notes list and search suggestions.
 * Plain-text search goes through getPlainText (the store's cached lookup)
 * so typing doesn't re-parse note HTML.
 */

const COMPARATORS = {
  modified: (a, b) => (b.modified || 0) - (a.modified || 0),
  created: (a, b) => (b.created || 0) - (a.created || 0),
  title: (a, b) => (a.title || '').localeCompare(b.title || '')
};

export const SORT_MODES = Object.keys(COMPARATORS);

/**
 * Filter, search, and sort notes for the sidebar list. Pinned notes come
 * first, keeping the same sort within each group.
 * @param {string} [options.filterMode] - 'all' | 'linked' | 'standalone' | 'reference'
 * @param {string|null} [options.currentReference] - Current fragmentid (for 'reference' mode)
 * @param {string} [options.sortMode] - 'modified' | 'created' | 'title'
 * @param {Function} [options.getPlainText] - (id) => plain text of note content
 * @returns {Array} New array; input is not mutated
 */
export function filterAndSortNotes(notes, {
  filterMode = 'all',
  currentReference = null,
  searchQuery = '',
  sortMode = 'modified',
  getPlainText
} = {}) {
  let filtered = [...notes];

  switch (filterMode) {
    case 'linked':
      filtered = filtered.filter((n) => n.reference);
      break;
    case 'standalone':
      filtered = filtered.filter((n) => !n.reference);
      break;
    case 'reference':
      filtered = filtered.filter((n) => n.reference && n.reference === currentReference);
      break;
  }

  if (searchQuery) {
    filtered = searchNotes(filtered, searchQuery, getPlainText, Infinity);
  }

  filtered.sort(COMPARATORS[sortMode] || COMPARATORS.modified);

  const pinned = filtered.filter((n) => n.pinned);
  if (pinned.length === 0) return filtered;
  return [...pinned, ...filtered.filter((n) => !n.pinned)];
}

/**
 * Notes whose title or plain-text content contains the query (case-insensitive).
 * @param {Function} [getPlainText] - (id) => plain text of note content
 */
export function searchNotes(notes, query, getPlainText, limit = 5) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];
  const plain = getPlainText || (() => '');

  const matches = [];
  for (const note of notes) {
    if ((note.title || '').toLowerCase().includes(q) ||
        plain(note.id).toLowerCase().includes(q)) {
      matches.push(note);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}
