/**
 * LemmaMatchPlugin
 * Highlights matching lemmas (Strong's numbers) across Bible windows on hover
 */

import { getConfig } from '../core/config.js';
const hasTouch = 'ontouchend' in document;
import { OT_BOOKS } from '../bible/BibleData.js';

function getLangPrefix(verseid) {
  if (!verseid) return 'G';
  const bookid = verseid.substring(0, 2);
  return OT_BOOKS.indexOf(bookid) > -1 ? 'H' : 'G';
}

function highlightStrong(strong, langPrefix, verseid) {
  const scope = verseid ? `.${verseid} ` : '';
  const selector = `${scope}l[s*="${strong}"], ${scope}l[s*="${langPrefix}${strong}"]`;
  document.querySelectorAll(selector).forEach(el => el.classList.add('lemma-highlight'));
}

function handleLemmaHover(e) {
  const l = e.target.closest('l');
  if (!l) return;

  const s = l.getAttribute('s');
  if (!s) return;

  const strongs = s.replace('G', '').replace('H', '');
  const verse = l.closest('.verse, .v');
  const verseid = verse?.getAttribute('data-id') ?? '';
  const langPrefix = getLangPrefix(verseid);
  const strongParts = strongs.split(' ');

  for (const strong of strongParts) {
    if (strong === '3588' && strongParts.length > 1) continue;
    highlightStrong(strong, langPrefix, verseid);
  }
}

function handleLemmaOut(e) {
  if (e.target.closest('l')) {
    document.querySelectorAll('.lemma-highlight').forEach(el => el.classList.remove('lemma-highlight'));
  }
}

/**
 * Create a lemma match plugin
 * @param {Object} app - Application instance
 * @returns {Object} Plugin API
 */
export const LemmaMatchPlugin = (app) => {
  const config = getConfig();
  if (!config.enableLemmaMatchPlugin) return {};

  if (!hasTouch) {
    const windowsMain = document.querySelector('.windows-main');
    if (windowsMain) {
      windowsMain.addEventListener('mouseover', handleLemmaHover);
      windowsMain.addEventListener('mouseout', handleLemmaOut);
    }
  }

  return {};
};

export default LemmaMatchPlugin;
