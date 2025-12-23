/**
 * RestoreButton
 * Reset/restore button for window layout
 */

import { createElements, qs } from '../lib/helpers.esm.js';
import { getConfig, updateConfig } from '../core/config.js';

// Default config
updateConfig({
  enableRestore: false
});

/**
 * Create restore button
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {HTMLElement|void} Button element
 */
export function RestoreButton(_parentNode, _menu) {
  const config = getConfig();

  if (!config.enableRestore) {
    return;
  }

  const buttonMenu = qs('#main-menu-windows-list');

  const restoreButton = createElements('<span class="window-reset i18n" data-i18n="[html]menu.reset">Reset</span>');

  restoreButton.addEventListener('click', () => {
    if (config.windows !== undefined) {
      const querystring = [];

      for (const [i, win] of config.windows.entries()) {
        // type
        querystring.push(`win${i + 1}=${win.type}`);

        // data
        const keys = Object.keys(win.data ?? {});
        for (const key of keys) {
          querystring.push(`${key}${i + 1}=${win.data[key]}`);
        }
      }

      window.location.href = `${window.location.pathname}?${querystring.join('&')}`;
    } else {
      window.location.reload();
    }
  }, false);

  buttonMenu?.appendChild(restoreButton);

  return restoreButton;
}

export default RestoreButton;
