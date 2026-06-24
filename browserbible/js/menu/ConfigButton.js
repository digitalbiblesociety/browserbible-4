/**
 * ConfigButton
 * Settings/configuration dialog button
 * Uses native popover API for click-off detection
 */

import { elem } from '../lib/helpers.esm.js';
import { i18n } from '../lib/i18n.js';
import { MovableWindow } from '../ui/MovableWindow.js';
import { getWindowIcon } from '../core/windowIcons.js';

/** Create the settings button and its config dialog. */
export function ConfigButton() {
  const configButton = elem('div', { className: 'main-menu-item' },
    elem('span', { className: 'main-menu-icon', innerHTML: getWindowIcon('settings') || '' }),
    elem('span', { className: 'i18n', dataset: { i18n: '[html]menu.labels.settings' } })
  );
  document.querySelector('#main-menu-features')?.appendChild(configButton);

  const configWindow = new MovableWindow(null, null, i18n.t('menu.labels.settings'), 'config-window');
  configWindow.title.classList.add('i18n');
  configWindow.title.dataset.i18n = '[html]menu.labels.settings';
  configWindow.body.innerHTML = `
    <div id="main-config-box">
      <fieldset class="settings-fieldset" id="config-type">
        <legend class="settings-legend i18n" data-i18n="[html]menu.config.font"></legend>
        <div class="config-body"></div>
      </fieldset>
      <fieldset class="settings-fieldset" id="config-tools">
        <legend class="settings-legend i18n" data-i18n="[html]menu.config.tools"></legend>
        <div class="config-body"></div>
      </fieldset>
    </div>
  `;

  configButton.addEventListener('click', (e) => {
    e.preventDefault();
    if (configWindow.isVisible()) {
      configWindow.hide();
      return;
    }
    configWindow.show();
    // Properly close the main menu popover
    const mainMenuDropdown = document.querySelector('#main-menu-dropdown');
    if (mainMenuDropdown?.matches(':popover-open')) {
      mainMenuDropdown.hidePopover();
    }
  });
}
