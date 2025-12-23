/**
 * ThemeSetting
 * Theme selector (default, sepia, dark)
 */

import { createElements, on, siblings, qs } from '../lib/helpers.esm.js';
import { getConfig, updateConfig } from '../core/config.js';
import AppSettings from '../common/AppSettings.js';

// Default config
updateConfig({
  enableThemeSelector: true
});

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

  const body = qs('#config-type .config-body');
  const themesBlock = createElements('<div id="config-themes"></div>');
  const themeNames = ['default', 'sepia', 'dark'];
  const defaultThemeSetting = { themeName: themeNames[0] };
  const themeKey = 'config-theme';
  const themeSetting = AppSettings.getValue(themeKey, defaultThemeSetting);

  body?.appendChild(themesBlock);

  for (const themeName of themeNames) {
    const span = createElements(`<span id="config-theme-${themeName}" class="config-theme-toggle i18n" data-i18n="[html]menu.themes.${themeName}" data-themename="${themeName}">${themeName}</span>`);
    themesBlock.appendChild(span);
  }

  // handle clicks using event delegation
  on(themesBlock, 'click', '.config-theme-toggle', function() {
    const span = this;
    const selectedTheme = span.getAttribute('data-themename');
    const selectedThemeClass = `theme-${selectedTheme}`;

    // remove all themes from body
    for (const themeName of themeNames) {
      const themeClassName = `theme-${themeName}`;
      document.body.classList.remove(themeClassName);
    }

    document.body.classList.add(selectedThemeClass);

    // Update selected state
    span.classList.add('config-theme-toggle-selected');
    siblings(span).forEach(sibling => {
      sibling.classList.remove('config-theme-toggle-selected');
    });

    AppSettings.setValue(themeKey, { themeName: selectedTheme });
  });

  // Trigger initial click on saved theme
  const initialTheme = body ? qs(`#config-theme-${themeSetting.themeName}`, body) : null;
  initialTheme?.click();
}

export default ThemeSetting;
