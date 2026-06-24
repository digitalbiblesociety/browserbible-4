/**
 * Theme selector (default, shiloh, jabbok, gethsemane)
 */

import { elem } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import AppSettings from '../common/AppSettings.js';

export function ThemeSetting() {
  const config = getConfig();

  if (!config.enableThemeSelector) {
    return;
  }

  const body = document.querySelector('#config-type .config-body');
  const themeNames = ['default', 'shiloh', 'jabbok', 'gethsemane'];
  const themeKey = 'config-theme';
  const themeSetting = AppSettings.getValue(themeKey, { themeName: themeNames[0] });

  const themesBlock = elem('div', { id: 'config-themes' },
    themeNames.map(themeName => elem('span', {
      id: `config-theme-${themeName}`,
      className: 'config-theme-toggle i18n',
      textContent: themeName,
      dataset: { i18n: `[html]menu.themes.${themeName}`, themename: themeName }
    }))
  );

  body?.appendChild(themesBlock);

  // handle clicks using event delegation
  themesBlock.addEventListener('click', (e) => {
    const span = e.target.closest('.config-theme-toggle');
    if (!span) return;

    const selectedTheme = span.getAttribute('data-themename');

    for (const themeName of themeNames) {
      document.body.classList.toggle(`theme-${themeName}`, themeName === selectedTheme);
    }

    for (const sibling of span.parentElement.children) {
      sibling.classList.toggle('config-theme-toggle-selected', sibling === span);
    }

    AppSettings.setValue(themeKey, { themeName: selectedTheme });
  });

  // Trigger initial click on saved theme
  body?.querySelector(`#config-theme-${themeSetting.themeName}`)?.click();
}
