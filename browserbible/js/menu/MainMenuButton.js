/**
 * MainMenuButton
 * Main hamburger menu button and dropdown
 * Uses native popover API for click-off detection
 */

import { elem } from '../lib/helpers.esm.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import { VERSION } from '../core/registry.js';
/**
 * Create the main menu button
 * @param {HTMLElement} parentNode - Parent container
 * @returns {Object} Component API
 */
export function MainMenuButton(parentNode) {
  const mainMenuLogo = elem('div', { id: 'app-logo' },
    elem('img', { src: './img/inscript_logo.svg', alt: 'Logo', width: 114, height: 22 }),
    elem('span', { className: 'app-version-pill' }, VERSION.split('.').slice(0, 2).join('.'))
  );
  const mainMenuButton = elem('div', { id: 'main-menu-button' });
  const mainMenuDropDown = elem('div', { id: 'main-menu-dropdown', popover: '' },
    elem('div', { className: 'main-menu-heading i18n', dataset: { i18n: '[html]menu.labels.addwindow' } }, 'Add Window'),
    elem('div', { id: 'main-menu-windows-list', className: 'main-menu-list' }),
    elem('div', { className: 'main-menu-heading i18n', dataset: { i18n: '[html]menu.labels.options' } }),
    elem('div', { id: 'main-menu-features', className: 'main-menu-list' })
  );

  if (parentNode) {
    parentNode.appendChild(mainMenuButton);
    parentNode.appendChild(mainMenuLogo);
  }
  document.body.appendChild(mainMenuDropDown);

  // Handle popover toggle events (fires on light dismiss - click outside or Escape)
  mainMenuDropDown.addEventListener('toggle', (e) => {
    mainMenuButton.classList.toggle('active', e.newState !== 'closed');
  });

  const hide = () => {
    mainMenuDropDown.hidePopover();
  };

  const mainMenuClick = () => {
    if (mainMenuDropDown.matches(':popover-open')) {
      hide();
    } else {
      mainMenuDropDown.showPopover();
    }
  };

  mainMenuButton.addEventListener('click', mainMenuClick);
  mainMenuLogo.addEventListener('click', mainMenuClick);

  mainMenuDropDown.addEventListener('click', (e) => {
    if (e.target.closest('.main-menu-item')) hide();
  });

  const ext = {};
  mixinEventEmitter(ext);
  ext._events = {};

  return ext;
}
