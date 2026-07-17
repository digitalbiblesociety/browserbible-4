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
  const scope = verseid ? `.${CSS.escape(verseid)} ` : '';
  const target = strong.toUpperCase();
  const prefixed = `${langPrefix}${target}`;

  document.querySelectorAll(`${scope}l[s]`).forEach(el => {
    const matches = el.getAttribute('s').toUpperCase().split(/\s+/).some(token => {
      const bare = token.replace(/[A-Z]$/, '');
      return bare === target || bare === prefixed || bare.replace(/^[GH]/, '') === target;
    });
    if (matches) el.classList.add('lemma-highlight');
  });
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

export const LemmaMatchPlugin = () => {
  if (!getConfig().enableLemmaMatchPlugin) return {};
  if (hasTouch) return {};

  const windowsMain = document.querySelector('.windows-main');
  if (!windowsMain) return {};

  windowsMain.addEventListener('mouseover', handleLemmaHover);
  windowsMain.addEventListener('mouseout', handleLemmaOut);

  return {};
};
