/**
 * VerseMatchPlugin
 * Highlights matching verses across Bible windows on hover
 */

import { on } from '../lib/helpers.esm.js';
import { getConfig, updateConfig } from '../core/config.js';
const hasTouch = 'ontouchend' in document;

// Default config
updateConfig({
  enableVerseMatchPlugin: true
});

/**
 * Create a verse match plugin
 * @param {Object} app - Application instance
 * @returns {Object} Plugin API
 */
export const VerseMatchPlugin = (app) => {
  const config = getConfig();

  if (!config.enableVerseMatchPlugin) {
    return {};
  }

  if (!hasTouch) {
    const windowsMain = document.querySelector('.windows-main');

    if (windowsMain) {
      on(windowsMain, 'mouseover', '.BibleWindow .verse, .BibleWindow .v', function(e) {
        const verse = this;
        const verseid = verse.getAttribute('data-id');

        document.querySelectorAll(`.BibleWindow .${verseid}`).forEach((el) => {
          el.classList.add('selected-verse');
        });
      });

      on(windowsMain, 'mouseout', '.BibleWindow .verse, .BibleWindow .v', function(e) {
        const verse = this;
        const verseid = verse.getAttribute('data-id');

        document.querySelectorAll(`.BibleWindow .${verseid}`).forEach((el) => {
          el.classList.remove('selected-verse');
        });
      });
    }
  }

  return {};
};

export default VerseMatchPlugin;
