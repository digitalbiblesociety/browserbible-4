/**
 * ConfigButton
 * Settings/configuration dialog button
 * Uses native popover API for click-off detection
 */

import { elem } from '../lib/helpers.esm.js';
import { i18n } from '../lib/i18n.js';
import { MovableWindow } from '../ui/MovableWindow.js';

/**
 * Create config button and dialog
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {void}
 */
export function ConfigButton(_parentNode, _menu) {
  const container = document.querySelector('.windows-container');
  const configButton = elem('div', { className: 'main-menu-item image-config i18n' });
  configButton.setAttribute('data-i18n', '[html]menu.labels.settings');
  const mainMenuFeatures = document.querySelector('#main-menu-features');

  const configWindow = new MovableWindow(300, 380, i18n.t('menu.labels.settings'), 'config-window');

  mainMenuFeatures?.appendChild(configButton);

  // Handle popover toggle events (fires on light dismiss - click outside or Escape)
  configWindow.onToggle((e) => {
    if (e.newState === 'closed') {
      container?.classList.remove('blur');
    } else {
      container?.classList.add('blur');
    }
  });

  const showConfig = () => {
    configWindow
      .show()
      .center();

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
      <div class="config-section" id="config-type">
        <span class="config-header i18n" data-i18n="[html]menu.config.font"></span>
        <div class="config-body"></div>
        <div class="clear"></div>
      </div>
      <div class="config-section" id="config-tools">
        <span class="config-header i18n" data-i18n="[html]menu.config.tools"></span>
        <div class="config-body"></div>
        <div class="clear"></div>
      </div>
    </div>
  `;
}

export default ConfigButton;
