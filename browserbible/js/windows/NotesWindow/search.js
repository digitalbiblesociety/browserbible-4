import { renderSearchSuggestions } from './render.js';
import { searchNotes } from './query.js';

/** Rebuild the suggestions dropdown for the current search query. */
export function updateSearchSuggestions(state, refs, notes, getPlainText) {
  const query = refs.search.value.trim();

  if (!query) {
    hideSearchSuggestions(state, refs);
    return;
  }

  const matches = searchNotes(notes, query, getPlainText, 5);

  state.searchSuggestions = matches;
  state.selectedSuggestionIndex = matches.length > 0 ? 0 : -1;

  if (matches.length === 0) {
    hideSearchSuggestions(state, refs);
    return;
  }

  refs.searchSuggestions.innerHTML = '';
  refs.searchSuggestions.appendChild(
    renderSearchSuggestions(matches, state.selectedSuggestionIndex, getPlainText)
  );
  refs.searchSuggestions.classList.add('visible');
}

export function hideSearchSuggestions(state, refs) {
  refs.searchSuggestions.classList.remove('visible');
  refs.searchSuggestions.innerHTML = '';
  state.searchSuggestions = [];
  state.selectedSuggestionIndex = -1;
}

/** Move the keyboard selection to newIndex, wrapping at either end. */
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
 * Pick a suggestion by index and clear the search box.
 * @returns {string|null} Note id; the caller selects it and re-renders the list
 */
export function selectSuggestion(state, refs, index) {
  if (index < 0 || index >= state.searchSuggestions.length) return null;

  const note = state.searchSuggestions[index];
  refs.search.value = '';
  state.searchQuery = '';
  hideSearchSuggestions(state, refs);

  return note.id;
}
