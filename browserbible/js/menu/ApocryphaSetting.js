/**
 * ApocryphaSetting
 * Options-section toggle for showing the apocryphal / deuterocanonical books.
 * Off by default; when off the apocryphal books are hidden from the navigators,
 * skipped while scrolling, and excluded from search.
 */

import { elem } from '../lib/helpers.esm.js';
import { getShowApocrypha, setShowApocrypha } from '../bible/Apocrypha.js';

/**
 * Create the apocrypha toggle in the Options (config-tools) section.
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {void}
 */
export function ApocryphaSetting(_parentNode, _menu) {
  const body = document.querySelector('#config-tools .config-body');
  if (!body) return;

  const input = elem('input', { id: 'config-apocrypha-input', type: 'checkbox' });
  input.checked = getShowApocrypha();

  const labelText = elem('span', {
    className: 'config-apocrypha-label i18n',
    textContent: 'Show Apocryphal Books',
    dataset: { i18n: '[html]menu.config.apocrypha' }
  });

  const track = elem('span', { className: 'config-switch-track' });
  const switchEl = elem('span', { className: 'config-switch' }, input, track);

  const row = elem('label', { className: 'config-apocrypha-row', htmlFor: 'config-apocrypha-input' },
    labelText, switchEl);

  body.appendChild(row);

  input.addEventListener('change', () => {
    setShowApocrypha(input.checked);
  }, false);
}

export default ApocryphaSetting;
