/**
 * LanguageSetting
 * UI language selector
 */

import { getConfig } from '../core/config.js';
import { i18n } from '../lib/i18n.js';
import { elem } from '../lib/helpers.esm.js';
import { AVAILABLE_LANGUAGES } from '../resources/index.js';

/**
 * Get a nested value from a resource's translation object
 * @param {string} lang - Language code
 * @param {string} key - Dot-notation key (e.g. "names.en")
 * @returns {string|null}
 */
function getLangTranslation(lang, key) {
  const resource = i18n.getResource(lang);
  if (!resource) return null;

  let current = resource.translation;
  for (const part of key.split('.')) {
    if (current == null) return null;
    current = current[part];
  }
  return typeof current === 'string' ? current : null;
}

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

  const body = document.querySelector('#config-tools .config-body');
  const list = elem('select', { id: 'config-language', className: 'app-list' });

  if (body) {
    body.appendChild(list);
  }

  const langKeys = [...AVAILABLE_LANGUAGES].sort((a, b) => a.localeCompare(b));

  for (const langKey of langKeys) {
    const option = elem('option', { value: langKey, textContent: langKey });
    list.appendChild(option);
  }

  // Preload all languages then update option labels with native names
  const localizeLanguages = async () => {
    const usersLanguage = i18n.lng();
    const fallbackLang = config.languageSelectorFallbackLang ?? 'en';

    // Preload all languages in parallel
    await Promise.all(langKeys.map(lang => i18n.preload(lang)));

    for (const option of list.querySelectorAll('option')) {
      const langValue = option.getAttribute('value');

      const name = getLangTranslation(langValue, 'name');
      if (!name) continue;

      let fullname = name;
      const localizedName = getLangTranslation(langValue, `names.${usersLanguage}`);
      const fallbackName = getLangTranslation(langValue, `names.${fallbackLang}`);

      if (localizedName && localizedName !== fullname) {
        fullname += ` (${localizedName})`;
      } else if (fallbackName && fallbackName !== fullname) {
        fullname += ` (${fallbackName})`;
      }

      option.textContent = fullname;
    }
  };

  // handle clicks
  list.addEventListener('change', async () => {
    const newLang = list.value;

    await i18n.setLng(newLang);
    localizeLanguages();
  }, false);

  list.localizeLanguages = localizeLanguages;
}

export default LanguageSetting;
