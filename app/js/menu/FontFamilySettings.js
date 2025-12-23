/**
 * FontFamilySettings
 * Font family selector
 */

import { createElements, on, qs } from '../lib/helpers.esm.js';
import { getConfig, updateConfig } from '../core/config.js';
import AppSettings from '../common/AppSettings.js';
import { PlaceKeeper } from '../common/Navigation.js';

// Default config
updateConfig({
  enableFontFamilySelector: true,
  fontFamilyStacks: {
    'Cambria': 'Cambria, Georgia, serif',
    'Palatino': 'Palatino, "Palatino Linotype", "Palatino LT STD", "Book Antiqua", Georgia, serif',
    'Libertine': 'Libertine',
    'Helvetica': '"Helvetica Neue", Helvetica, Arial, sans-serif',
    'Trebuchet': '"Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", Tahoma, sans-serif'
  }
});

/**
 * Create font family setting controls
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {void}
 */
export function FontFamilySettings(_parentNode, _menu) {
  const config = getConfig();

  const body = qs('#config-type .config-body');
  const fontFamilyStacks = config.fontFamilyStacks ?? {};
  const fontFamilyStackNames = Object.keys(fontFamilyStacks);
  const defaultFontSetting = { fontName: fontFamilyStackNames[0] };
  const fontFamilyKey = 'config-font-family';
  const fontFamilySetting = AppSettings.getValue(fontFamilyKey, defaultFontSetting);
  let fontSettingHtml = '';
  let fontFamilyStyle = '';

  for (const fontStackName of fontFamilyStackNames) {
    const fontStackValue = fontFamilyStacks[fontStackName];

    fontSettingHtml +=
      `<label id="config-font-family-${fontStackName}" class="config-font-family" title="${fontStackName}">` +
        `<input type="radio" id="config-font-family-${fontStackName}-value" name="config-font-family" value="${fontStackName}" />` +
        'Aa' +
      '</label>';

    fontFamilyStyle +=
      `#config-font-family-${fontStackName}, ` +
      `.config-font-family-${fontStackName} .reading-text,` +
      `.config-font-family-${fontStackName} #font-size-table {` +
      `  font-family: ${fontStackValue};` +
      '}';
  }

  const styleEl = createElements(`<style>${fontFamilyStyle}</style>`);
  document.head.appendChild(styleEl);

  // Define setFontFamily before usage
  const setFontFamily = (newFontStackName) => {
    PlaceKeeper?.storePlace();

    // remove all others
    for (const fontStackName of fontFamilyStackNames) {
      const className = `config-font-family-${fontStackName}`;
      document.body.classList.remove(className);
    }

    document.body.classList.add(`config-font-family-${newFontStackName}`);

    AppSettings.setValue(fontFamilyKey, { fontName: newFontStackName });

    PlaceKeeper?.restorePlace();
  };

  if (!config.enableFontFamilySelector) {
    setFontFamily(defaultFontSetting.fontName);
    return;
  }

  body?.insertAdjacentHTML('beforeend', fontSettingHtml);

  // handle clicks using event delegation
  if (body) {
    on(body, 'change', 'input[name=config-font-family]', function() {
      const newFontFamilyValue = this.value;
      setFontFamily(newFontFamilyValue);
    });
  }

  // set default
  const defaultRadio = body ? qs(`#config-font-family-${fontFamilySetting.fontName}-value`, body) : null;
  defaultRadio?.click();
}

export default FontFamilySettings;
