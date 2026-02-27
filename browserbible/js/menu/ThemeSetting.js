/**
 * ThemeSetting
 * Theme selector (default, shiloh, jabbok, gethsemane)
 */

import { elem } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import AppSettings from '../common/AppSettings.js';

/**
 * Create theme setting controls
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {void}
 */
export function ThemeSetting(_parentNode, _menu) {
  const config = getConfig();

  if (!config.enableThemeSelector) {
    return;
  }

  const body = document.querySelector('#config-type .config-body');
  const themesBlock = elem('div', { id: 'config-themes' });
  const themeNames = ['default', 'shiloh', 'jabbok', 'gethsemane'];
  const defaultThemeSetting = { themeName: themeNames[0] };
  const themeKey = 'config-theme';
  const themeSetting = AppSettings.getValue(themeKey, defaultThemeSetting);

  body?.appendChild(themesBlock);

  for (const themeName of themeNames) {
    const span = elem('span', {
      id: `config-theme-${themeName}`,
      className: 'config-theme-toggle i18n',
      textContent: themeName,
      dataset: { i18n: `[html]menu.themes.${themeName}`, themename: themeName }
    });
    themesBlock.appendChild(span);
  }

  // handle clicks using event delegation
  themesBlock.addEventListener('click', (e) => {
    const span = e.target.closest('.config-theme-toggle');
    if (!span) return;

    const selectedTheme = span.getAttribute('data-themename');
    const selectedThemeClass = `theme-${selectedTheme}`;

    // remove all themes from body
    for (const themeName of themeNames) {
      const themeClassName = `theme-${themeName}`;
      document.body.classList.remove(themeClassName);
    }

    document.body.classList.add(selectedThemeClass);

    span.classList.add('config-theme-toggle-selected');
    [...span.parentElement.children].filter(s => s !== span).forEach(sibling => {
      sibling.classList.remove('config-theme-toggle-selected');
    });

    AppSettings.setValue(themeKey, { themeName: selectedTheme });
  });

  // Trigger initial click on saved theme
  const initialTheme = body ? body.querySelector(`#config-theme-${themeSetting.themeName}`) : null;
  initialTheme?.click();
}

export default ThemeSetting;
