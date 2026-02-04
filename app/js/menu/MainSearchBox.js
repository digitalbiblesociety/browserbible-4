/**
 * MainSearchBox
 * Top search input for Bible references and text search
 */

import { elem } from '../lib/helpers.esm.js';
import { Reference } from '../bible/BibleReference.js';
import { getApp } from '../core/registry.js';
import { getConfig } from '../core/config.js';
import { PlaceKeeper, TextNavigation } from '../common/Navigation.js';

/**
 * Get the current Bible version from the first Bible window
 * @returns {string} The text ID of the current version
 */
function getCurrentVersion() {
  const app = getApp();
  const config = getConfig();
  let textid = config.newBibleWindowVersion;
  const appSettings = app?.windowManager?.getSettings();

  if (appSettings) {
    for (const settings of appSettings) {
      if (settings.windowType === 'BibleWindow') {
        textid = settings.data.textid;
        break;
      }
    }
  }

  return textid;
}

/**
 * Create the main search box
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {HTMLElement} Search box element
 */
export function MainSearchBox(parentNode, _menu) {
  const searchBox = elem('div', { id: 'main-search-box' });
  const searchInput = elem('input', { type: 'search', className: 'i18n', id: 'main-search-input', autocomplete: 'off' });
  searchInput.setAttribute('data-i18n', '[placeholder]menu.search.placeholder');
  const searchButton = elem('input', { type: 'button', id: 'main-search-button', value: '' });
  searchBox.append(searchInput, searchButton);

  const suggestions = elem('div', { id: 'main-search-suggestions', style: { display: 'none' } });

  if (parentNode) {
    parentNode.appendChild(searchBox);
    parentNode.appendChild(suggestions);
  }

  let selectedIndex = 0;
  let currentOptions = [];

  const doSearch = (searchText) => {
    const app = getApp();
    PlaceKeeper?.storePlace();
    const textid = getCurrentVersion();
    app?.windowManager?.add('SearchWindow', { searchtext: searchText, textid });
    PlaceKeeper?.restorePlace();
    searchInput.value = '';
    hideSuggestions();
  };

  const doNavigate = (reference) => {
    const app = getApp();
    const sectionid = reference.toSection();

    // Navigate all Bible windows simultaneously
    const bibleWindows = app?.windowManager?.getWindows()?.filter(w => w.className === 'BibleWindow') || [];

    if (bibleWindows.length > 0) {
      TextNavigation.locationChange(sectionid);
      for (const win of bibleWindows) {
        win.controller?.scroller?.load('text', sectionid);
      }
    }

    searchInput.value = '';
    hideSuggestions();
  };

  const hideSuggestions = () => {
    suggestions.style.display = 'none';
    suggestions.innerHTML = '';
    currentOptions = [];
    selectedIndex = 0;
  };

  const escapeHtml = (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  };

  const updateSuggestions = () => {
    const inputText = searchInput.value.trim();

    if (!inputText) {
      hideSuggestions();
      return;
    }

    const textid = getCurrentVersion()?.replace(/^local:/, '') || '';
    const reference = new Reference(inputText);
    const hasValidReference = reference?.isValid?.();
    const escapedInput = escapeHtml(inputText);

    currentOptions = [];

    // Always add search option first (default)
    currentOptions.push({
      type: 'search',
      text: inputText,
      label: `Search "<strong>${escapedInput}</strong>" in ${textid}`
    });

    // Add navigation option if valid reference
    if (hasValidReference) {
      currentOptions.push({
        type: 'navigate',
        reference,
        label: `Go to <strong>${reference.toString()}</strong> in ${textid}`
      });
    }

    // Reset selection to first item
    selectedIndex = 0;

    // Render options
    suggestions.innerHTML = currentOptions
      .map((opt, i) => `<div class="suggestion-item${i === selectedIndex ? ' selected' : ''}" data-index="${i}">${opt.label}</div>`)
      .join('');

    suggestions.style.display = 'block';
  };

  const selectOption = (index) => {
    if (index < 0 || index >= currentOptions.length) return;

    const option = currentOptions[index];
    if (option.type === 'search') {
      doSearch(option.text);
    } else if (option.type === 'navigate') {
      doNavigate(option.reference);
    }
  };

  const updateSelection = (newIndex) => {
    if (newIndex < 0) newIndex = currentOptions.length - 1;
    if (newIndex >= currentOptions.length) newIndex = 0;

    selectedIndex = newIndex;

    const items = suggestions.querySelectorAll('.suggestion-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === selectedIndex);
    });
  };

  // Event listeners
  searchInput.addEventListener('input', updateSuggestions);

  searchInput.addEventListener('keydown', (e) => {
    if (suggestions.style.display === 'none') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      updateSelection(selectedIndex + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      updateSelection(selectedIndex - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectOption(selectedIndex);
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  });

  searchInput.addEventListener('blur', () => {
    // Delay to allow click on suggestion
    setTimeout(hideSuggestions, 150);
  });

  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim()) {
      updateSuggestions();
    }
  });

  suggestions.addEventListener('mousedown', (e) => {
    const item = e.target.closest('.suggestion-item');
    if (item) {
      const index = parseInt(item.dataset.index, 10);
      selectOption(index);
    }
  });

  suggestions.addEventListener('mouseover', (e) => {
    const item = e.target.closest('.suggestion-item');
    if (item) {
      const index = parseInt(item.dataset.index, 10);
      updateSelection(index);
    }
  });

  searchButton.addEventListener('click', () => {
    if (currentOptions.length > 0) {
      selectOption(selectedIndex);
    } else {
      const inputText = searchInput.value.trim();
      if (inputText) {
        doSearch(inputText);
      }
    }
  });

  return searchBox;
}

export default MainSearchBox;
