/**
 * FontFamilySettings
 * Font family selector
 */

import { elem } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import AppSettings from '../common/AppSettings.js';
import { PlaceKeeper } from '../common/PlaceKeeper.js';

const toSlug = (str) => str.replace(/\s+/g, '-').toLowerCase();

/**
 * Create font family setting controls
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {void}
 */
export function FontFamilySettings(_parentNode, _menu) {
  const config = getConfig();

  const body = document.querySelector('#config-type .config-body');
  const fontFamilyStacks = config.fontFamilyStacks ?? {};
  const fontFamilyStackNames = Object.keys(fontFamilyStacks);
  const defaultFontSetting = { fontName: fontFamilyStackNames[0] };
  const fontFamilyKey = 'config-font-family';
  const fontFamilySetting = AppSettings.getValue(fontFamilyKey, defaultFontSetting);
  let fontSettingHtml = '';
  let fontFamilyStyle = '';

  for (const fontStackName of fontFamilyStackNames) {
    const fontStackValue = fontFamilyStacks[fontStackName];
    const fontSlug = toSlug(fontStackName);

    fontSettingHtml +=
      `<label id="config-font-family-${fontSlug}" class="config-font-family" title="${fontStackName}">` +
        `<input type="radio" id="config-font-family-${fontSlug}-value" name="config-font-family" value="${fontStackName}" />` +
        'Aa' +
      '</label>';

    fontFamilyStyle +=
      `#config-font-family-${fontSlug}, ` +
      `.config-font-family-${fontSlug} .reading-text,` +
      `.config-font-family-${fontSlug} #font-size-table {` +
      `  font-family: ${fontStackValue};` +
      '}';
  }

  const styleEl = elem('style', fontFamilyStyle);
  document.head.appendChild(styleEl);

  // Define setFontFamily before usage
  const setFontFamily = (newFontStackName) => {
    PlaceKeeper.preservePlace(() => {
      // remove all others
      for (const fontStackName of fontFamilyStackNames) {
        const className = `config-font-family-${toSlug(fontStackName)}`;
        document.body.classList.remove(className);
      }

      document.body.classList.add(`config-font-family-${toSlug(newFontStackName)}`);

      AppSettings.setValue(fontFamilyKey, { fontName: newFontStackName });
    });
  };

  if (!config.enableFontFamilySelector) {
    setFontFamily(defaultFontSetting.fontName);
    return;
  }

  const fontFamiliesContainer = elem('div', { className: 'config-font-families' });
  fontFamiliesContainer.innerHTML = fontSettingHtml;
  body?.appendChild(fontFamiliesContainer);

  // handle clicks using event delegation
  if (fontFamiliesContainer) {
    fontFamiliesContainer.addEventListener('change', (e) => {
      const target = e.target.closest('input[name=config-font-family]');
      if (target) {
        const newFontFamilyValue = target.value;
        setFontFamily(newFontFamilyValue);
      }
    });
  }

  // set default
  const defaultRadio = fontFamiliesContainer.querySelector(`#config-font-family-${toSlug(fontFamilySetting.fontName)}-value`);
  defaultRadio?.click();
}

export default FontFamilySettings;
