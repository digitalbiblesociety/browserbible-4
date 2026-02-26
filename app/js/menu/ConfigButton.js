/**
 * ConfigButton
 * Settings/configuration dialog button
 * Uses native popover API for click-off detection
 */

import { elem } from '../lib/helpers.esm.js';
import { i18n } from '../lib/i18n.js';
import { MovableWindow } from '../ui/MovableWindow.js';
import { getWindowIcon } from '../core/windowIcons.js';

/**
 * Create config button and dialog
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {void}
 */
export function ConfigButton(_parentNode, _menu) {
  const configButton = elem('div', { className: 'main-menu-item' });
  const configIconSpan = elem('span', { className: 'main-menu-icon' });
  configIconSpan.innerHTML = getWindowIcon('settings') || '';
  configButton.appendChild(configIconSpan);
  const configTextSpan = elem('span', { className: 'i18n' });
  configTextSpan.dataset.i18n = '[html]menu.labels.settings';
  configButton.appendChild(configTextSpan);
  const mainMenuFeatures = document.querySelector('#main-menu-features');

  const configWindow = new MovableWindow(null, null, i18n.t('menu.labels.settings'), 'config-window');
  mainMenuFeatures?.appendChild(configButton);

  const showConfig = () => {
    configWindow.show();
    // Properly close the main menu popover
    const mainMenuDropdown = document.querySelector('#main-menu-dropdown');
    if (mainMenuDropdown?.matches(':popover-open')) {
      mainMenuDropdown.hidePopover();
    }
  };

  const buttonClick = (e) => {
    e.preventDefault();

    if (configWindow.isVisible()) {
      configWindow.hide();
    } else {
      showConfig();
    }

    return false;
  };

  configButton.addEventListener('click', buttonClick, false);

  const configBody = configWindow.body;
  configBody.innerHTML = `
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
}

export default ConfigButton;
