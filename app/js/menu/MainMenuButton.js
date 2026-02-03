/**
 * MainMenuButton
 * Main hamburger menu button and dropdown
 * Uses native popover API for click-off detection
 */

import { createElements, deepMerge } from '../lib/helpers.esm.js';
import { EventEmitterMixin } from '../common/EventEmitter.js';

/**
 * Create the main menu button
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {Object} Component API
 */
export function MainMenuButton(parentNode, _menu) {
  const mainMenuLogo = Object.assign(document.createElement('div'), { id: 'app-logo' });
  const mainMenuButton = Object.assign(document.createElement('div'), { id: 'main-menu-button' });
  const mainMenuDropDown = createElements(`<div id="main-menu-dropdown" popover>
    <div class="main-menu-heading i18n" data-i18n="[html]menu.labels.addwindow">Add Window</div>
    <div id="main-menu-windows-list" class="main-menu-list"></div>
    <div class="main-menu-heading i18n" data-i18n="[html]menu.labels.options"></div>
    <div id="main-menu-features" class="main-menu-list"></div>
    </div>`);

  // Append elements
  if (parentNode) {
    parentNode.appendChild(mainMenuLogo);
    parentNode.appendChild(mainMenuButton);
  }
  document.body.appendChild(mainMenuDropDown);

  // Handle popover toggle events (fires on light dismiss - click outside or Escape)
  mainMenuDropDown.addEventListener('toggle', (e) => {
    if (e.newState === 'closed') {
      mainMenuButton.classList.remove('active');
    } else {
      mainMenuButton.classList.add('active');
    }
  });

  const show = () => {
    mainMenuDropDown.showPopover();
  };

  const hide = () => {
    mainMenuDropDown.hidePopover();
  };

  const mainMenuClick = (_e) => {
    if (mainMenuDropDown.matches(':popover-open')) {
      hide();
    } else {
      show();
    }
  };

  mainMenuButton.addEventListener('click', mainMenuClick, false);

  mainMenuDropDown.addEventListener('click', (e) => {
    const target = e.target.closest('.main-menu-item');
    if (target) hide();
  });

  let ext = {};
  ext = deepMerge(ext, EventEmitterMixin);
  ext._events = {};

  return ext;
}

export default MainMenuButton;
