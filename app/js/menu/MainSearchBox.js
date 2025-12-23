/**
 * MainSearchBox
 * Top search input for Bible references and text search
 */

import { createElements, toElement } from '../lib/helpers.esm.js';
import { Reference } from '../bible/BibleReference.js';
import { getApp } from '../core/registry.js';
import { getConfig } from '../core/config.js';
import { PlaceKeeper } from '../common/Navigation.js';

/**
 * Create the main search box
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {HTMLElement} Search box element
 */
export function MainSearchBox(parentNode, _menu) {
  const searchBox = createElements(`<div id="main-search-box">
    <input type="search" class="i18n" data-i18n="[placeholder]menu.search.placeholder" id="main-search-input" />
    <input type="button" id="main-search-button" value="" />
    </div>`);

  // Append to node
  if (parentNode) {
    const nodeEl = toElement(parentNode);
    nodeEl?.appendChild(searchBox);
  }

  const searchInput = searchBox.querySelector('#main-search-input');
  const searchButton = searchBox.querySelector('#main-search-button');

  const handleSearch = () => {
    const inputText = searchInput.value.trim();

    if (!inputText) return;

    const app = getApp();
    const config = getConfig();

    // Try to parse as Bible reference first
    const reference = new Reference(inputText);

    if (typeof reference.isValid !== 'undefined') {
      // Valid Bible reference - navigate to it
      const fragmentid = reference.toSection();

      app?.handleGlobalMessage({
        data: {
          messagetype: 'nav',
          type: 'bible',
          locationInfo: {
            fragmentid,
            sectionid: fragmentid.split('_')[0],
            offset: 0
          }
        }
      });
    } else {
      // Not a valid reference - open search window
      PlaceKeeper?.storePlace();

      // Get first Bible window to get current version
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

      app?.windowManager?.add('SearchWindow', { searchtext: inputText, textid });
      PlaceKeeper?.restorePlace();
    }

    searchInput.value = '';
  };

  // Set up event listeners
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' || e.keyCode === 13) {
      handleSearch();
    }
  }, false);

  searchButton.addEventListener('click', handleSearch, false);

  return searchBox;
}

export default MainSearchBox;
