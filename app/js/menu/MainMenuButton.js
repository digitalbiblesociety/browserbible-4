/**
 * MainMenuButton
 * Main hamburger menu button and dropdown
 * Uses native popover API for click-off detection
 */

import { elem } from '../lib/helpers.esm.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';

/**
 * Create the main menu button
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {Object} Component API
 */
export function MainMenuButton(parentNode, _menu) {
  const mainMenuLogo = elem('div', { id: 'app-logo' });
  const mainMenuButton = elem('div', { id: 'main-menu-button' });
  const mainMenuDropDown = elem('div', { id: 'main-menu-dropdown', popover: '' });
  const heading1 = elem('div', { className: 'main-menu-heading i18n', textContent: 'Add Window' });
  heading1.setAttribute('data-i18n', '[html]menu.labels.addwindow');
  const windowsList = elem('div', { id: 'main-menu-windows-list', className: 'main-menu-list' });
  const heading2 = elem('div', { className: 'main-menu-heading i18n' });
  heading2.setAttribute('data-i18n', '[html]menu.labels.options');
  const features = elem('div', { id: 'main-menu-features', className: 'main-menu-list' });
  mainMenuDropDown.append(heading1, windowsList, heading2, features);

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
  mixinEventEmitter(ext);
  ext._events = {};

  return ext;
}

export default MainMenuButton;
