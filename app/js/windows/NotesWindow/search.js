import { renderSearchSuggestions, stripHtml } from './render.js';

/**
 * Update search suggestions based on current query
 * @param {object} state - Component state
 * @param {object} refs - Component refs
 */
export function updateSearchSuggestions(state, refs) {
  const query = refs.search.value.trim().toLowerCase();

  if (!query) {
    hideSearchSuggestions(state, refs);
    return;
  }

  const matches = state.notes.filter(n => {
    const titleMatch = (n.title || '').toLowerCase().includes(query);
    const contentMatch = stripHtml(n.content || '').toLowerCase().includes(query);
    return titleMatch || contentMatch;
  }).slice(0, 5); // Limit to 5 suggestions

  state.searchSuggestions = matches;
  state.selectedSuggestionIndex = matches.length > 0 ? 0 : -1;

  if (matches.length === 0) {
    hideSearchSuggestions(state, refs);
    return;
  }

  refs.searchSuggestions.innerHTML = '';
  refs.searchSuggestions.appendChild(
    renderSearchSuggestions(matches, state.selectedSuggestionIndex)
  );
  refs.searchSuggestions.classList.add('visible');
}

/**
 * Hide search suggestions dropdown
 * @param {object} state - Component state
 * @param {object} refs - Component refs
 */
export function hideSearchSuggestions(state, refs) {
  refs.searchSuggestions.classList.remove('visible');
  refs.searchSuggestions.innerHTML = '';
  state.searchSuggestions = [];
  state.selectedSuggestionIndex = -1;
}

/**
 * Update which suggestion is selected (keyboard/hover navigation)
 * @param {object} state - Component state
 * @param {object} refs - Component refs
 * @param {number} newIndex - New selection index
 */
export function updateSuggestionSelection(state, refs, newIndex) {
  const count = state.searchSuggestions.length;
  if (count === 0) return;

  if (newIndex < 0) newIndex = count - 1;
  if (newIndex >= count) newIndex = 0;

  state.selectedSuggestionIndex = newIndex;

  const items = refs.searchSuggestions.querySelectorAll('.notes-suggestion-item');
  items.forEach((item, i) => {
    item.classList.toggle('selected', i === newIndex);
  });
}

/**
 * Select a suggestion by index
 * Returns the selected note ID, or null if invalid index.
 * Caller is responsible for calling selectNote() and renderNotesList().
 * @param {object} state - Component state
 * @param {object} refs - Component refs
 * @param {number} index - Suggestion index to select
 * @returns {string|null} Selected note ID
 */
export function selectSuggestion(state, refs, index) {
  if (index < 0 || index >= state.searchSuggestions.length) return null;

  const note = state.searchSuggestions[index];
  refs.search.value = '';
  state.searchQuery = '';
  hideSearchSuggestions(state, refs);

  return note.id;
}
