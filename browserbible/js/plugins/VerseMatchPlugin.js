/**
 * VerseMatchPlugin
 * Highlights matching verses across Bible windows on hover
 */

import { getConfig } from '../core/config.js';
const hasTouch = 'ontouchend' in document;

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
      windowsMain.addEventListener('mouseover', (e) => {
        const verse = e.target.closest('.BibleWindow .verse, .BibleWindow .v');
        if (verse) {
          const verseid = verse.getAttribute('data-id');

          document.querySelectorAll(`.BibleWindow .${verseid}`).forEach((el) => {
            el.classList.add('selected-verse');
          });
        }
      });

      windowsMain.addEventListener('mouseout', (e) => {
        const verse = e.target.closest('.BibleWindow .verse, .BibleWindow .v');
        if (verse) {
          const verseid = verse.getAttribute('data-id');

          document.querySelectorAll(`.BibleWindow .${verseid}`).forEach((el) => {
            el.classList.remove('selected-verse');
          });
        }
      });
    }
  }

  return {};
};

export default VerseMatchPlugin;
