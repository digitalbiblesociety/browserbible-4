/**
 * VerseMatchPlugin
 * Highlights matching verses across Bible windows on hover
 */

import { getConfig } from '../core/config.js';
const hasTouch = 'ontouchend' in document;

function toggleMatches(e, on) {
  const verse = e.target.closest('.BibleWindow .verse, .BibleWindow .v');
  if (!verse) return;

  const verseid = verse.getAttribute('data-id');
  document.querySelectorAll(`.BibleWindow .${verseid}`).forEach((el) => {
    el.classList.toggle('selected-verse', on);
  });
}

export const VerseMatchPlugin = () => {
  if (!getConfig().enableVerseMatchPlugin) return {};
  if (hasTouch) return {};

  const windowsMain = document.querySelector('.windows-main');
  if (!windowsMain) return {};

  windowsMain.addEventListener('mouseover', (e) => toggleMatches(e, true));
  windowsMain.addEventListener('mouseout', (e) => toggleMatches(e, false));

  return {};
};
