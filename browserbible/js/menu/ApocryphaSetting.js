/**
 * ApocryphaSetting
 * Options-section toggle for showing the apocryphal / deuterocanonical books.
 * Off by default; when off the apocryphal books are hidden from the navigators,
 * skipped while scrolling, and excluded from search.
 */

import { elem } from '../lib/helpers.esm.js';
import { getShowApocrypha, setShowApocrypha } from '../bible/Apocrypha.js';

/** Create the apocrypha toggle in the Options (config-tools) section. */
export function ApocryphaSetting() {
  const body = document.querySelector('#config-tools .config-body');
  if (!body) return;

  const input = elem('input', {
    id: 'config-apocrypha-input',
    type: 'checkbox',
    checked: getShowApocrypha()
  });

  body.appendChild(
    elem('label', { className: 'config-apocrypha-row', htmlFor: 'config-apocrypha-input' },
      elem('span', {
        className: 'config-apocrypha-label i18n',
        textContent: 'Show Apocryphal Books',
        dataset: { i18n: '[html]menu.config.apocrypha' }
      }),
      elem('span', { className: 'config-switch' },
        input,
        elem('span', { className: 'config-switch-track' })
      )
    )
  );

  input.addEventListener('change', () => setShowApocrypha(input.checked));
}
