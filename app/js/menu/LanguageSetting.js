/**
 * LanguageSetting
 * UI language selector
 */

import { createElements, qs } from '../lib/helpers.esm.js';
import { getConfig, updateConfig } from '../core/config.js';
import { i18n } from '../lib/i18n.js';
import { getAllResources } from '../core/registry.js';

// Default config
updateConfig({
  enableLanguageSelector: true,
  languageSelectorFallbackLang: 'en'
});

/**
 * Create language setting controls
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {void}
 */
export function LanguageSetting(_parentNode, _menu) {
  const config = getConfig();

  if (!config.enableLanguageSelector) {
    return;
  }

  const body = qs('#config-tools .config-body');
  const list = createElements('<select id="config-language" class="app-list"></select>');
  const resources = getAllResources();
  const langKeys = Object.keys(resources);

  if (body) {
    body.appendChild(list);
    body.appendChild(createElements('<div class="clear"></div>'));
  }

  // make sure English isn't first!
  langKeys.sort();

  for (const langKey of langKeys) {
    const langName = resources[langKey].translation.name;

    const option = createElements(`<option value="${langKey}">${langName}</option>`);
    list.appendChild(option);
  }

  // Define localizeLanguages before usage
  const localizeLanguages = () => {
    const usersLanguage = i18n.lng();
    const fallbackLang = config.languageSelectorFallbackLang ?? 'en';

    // go through options and add new info
    const options = list.querySelectorAll('option');
    options.forEach((option) => {
      const langValue = option.getAttribute('value');
      const resourceData = resources[langValue]?.translation ?? null;
      if (!resourceData) return;

      const name = resourceData.name;
      const fallbackName = resourceData.names?.[fallbackLang] ?? null;
      const localizedName = resourceData.names?.[usersLanguage] ?? null;
      let fullname = name;

      // use the localized name if possible
      if (localizedName !== null && typeof localizedName !== 'undefined' && localizedName !== fullname) {
        fullname += ` (${localizedName})`;
      // fallback to english
      } else if (fallbackName !== null && typeof fallbackName !== 'undefined' && fullname !== fallbackName) {
        fullname += ` (${fallbackName})`;
      }

      option.innerHTML = fullname;
    });
  };

  // handle clicks
  list.addEventListener('change', () => {
    const newLang = list.value;

    i18n.setLng(newLang);
    // Update all i18n elements
    i18n.translatePage();

    localizeLanguages();
  }, false);

  list.localizeLanguages = localizeLanguages;
}

export default LanguageSetting;
