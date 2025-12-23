/**
 * LemmaMatchPlugin
 * Highlights matching lemmas (Strong's numbers) across Bible windows on hover
 */

import { on, closest } from '../lib/helpers.esm.js';
import { getConfig, updateConfig } from '../core/config.js';
const hasTouch = 'ontouchend' in document;
import { OT_BOOKS } from '../bible/BibleData.js';

// Default config
updateConfig({
  enableLemmaMatchPlugin: true
});

/**
 * Create a lemma match plugin
 * @param {Object} app - Application instance
 * @returns {Object} Plugin API
 */
export const LemmaMatchPlugin = (app) => {
  const config = getConfig();

  if (!config.enableLemmaMatchPlugin) {
    return {};
  }

  if (!hasTouch) {
    const windowsMain = document.querySelector('.windows-main');

    if (windowsMain) {
      on(windowsMain, 'mouseover', 'l', function(e) {
        const l = this;
        const s = l.getAttribute('s');

        if (!s) return;

        const strongs = s.replace('G', '').replace('H', '');
        const verse = closest(l, '.verse, .v');
        const verseid = verse?.getAttribute('data-id') ?? '';
        const bookid = verseid ? verseid.substring(0, 2) : '';
        const langPrefix = (bookid !== '' && OT_BOOKS.indexOf(bookid) > -1) ? 'H' : 'G';

        const strongParts = strongs.split(' ');

        for (const strong of strongParts) {
          // Ignore Greek article with second word
          if (strong === '3588' && strongParts.length > 1) continue;

          if (verseid) {
            document.querySelectorAll(`.${verseid} l[s*="${strong}"], .${verseid} l[s*="${langPrefix}${strong}"]`).forEach((el) => {
              el.classList.add('lemma-highlight');
            });
          } else {
            document.querySelectorAll(`l[s*="${strong}"],l[s*="${langPrefix}${strong}"]`).forEach((el) => {
              el.classList.add('lemma-highlight');
            });
          }
        }
      });

      on(windowsMain, 'mouseout', 'l', function(e) {
        document.querySelectorAll('.lemma-highlight').forEach((el) => {
          el.classList.remove('lemma-highlight');
        });
      });
    }
  }

  return {};
};

export default LemmaMatchPlugin;
