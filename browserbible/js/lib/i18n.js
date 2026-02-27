/**
 * Simple i18n (internationalization) module
 * Lightweight replacement for i18next without jQuery dependency
 * Supports lazy loading of language resources
 */

let currentLanguage = 'en';
let fallbackLanguage = 'en';
let resources = {};
let resourceBasePath = './js/resources';
const loadingPromises = new Map();
const RTL_LANGUAGES = new Set(['ar', 'ur', 'he', 'fa']);

/**
 * Load a language resource file
 * @param {string} lang - Language code
 * @returns {Promise<Object|null>} The loaded resource or null on error
 */
async function loadLanguage(lang) {
  // Return cached if already loaded
  if (resources[lang]) {
    return resources[lang];
  }

  // Return existing promise if already loading
  if (loadingPromises.has(lang)) {
    return loadingPromises.get(lang);
  }

  // Start loading
  const promise = (async () => {
    try {
      const response = await fetch(`${resourceBasePath}/${lang}.json`);
      if (!response.ok) {
        console.warn(`Failed to load language resource: ${lang}`);
        return null;
      }
      const data = await response.json();
      resources[lang] = data;
      return data;
    } catch (err) {
      console.warn(`Error loading language resource ${lang}:`, err);
      return null;
    } finally {
      loadingPromises.delete(lang);
    }
  })();

  loadingPromises.set(lang, promise);
  return promise;
}

/**
 * Initialize the i18n system
 * @param {Object} [options={}] - Configuration options
 * @param {Object} [options.resStore] - Resource store with translations keyed by language (optional, for preloaded resources)
 * @param {string} [options.fallbackLng] - Fallback language code
 * @param {string} [options.lng] - Initial language code (auto-detected if not provided)
 * @param {string} [options.basePath] - Base path for loading JSON files
 * @returns {Promise<void>}
 */
export async function init(options = {}) {
  if (options.basePath) {
    resourceBasePath = options.basePath;
  }

  if (options.resStore) {
    resources = { ...resources, ...options.resStore };
  }

  if (options.fallbackLng) {
    fallbackLanguage = options.fallbackLng;
  }

  if (options.lng && options.lng !== '') {
    currentLanguage = options.lng;
  } else {
    const cookieLang = getCookie('i18next');
    if (cookieLang) {
      currentLanguage = cookieLang;
    } else if (typeof navigator !== 'undefined' && navigator.language) {
      currentLanguage = navigator.language.split('-')[0];
    }
  }

  // Load fallback language first
  await loadLanguage(fallbackLanguage);

  // Load current language if different from fallback
  if (currentLanguage !== fallbackLanguage) {
    const loaded = await loadLanguage(currentLanguage);
    if (!loaded) {
      currentLanguage = fallbackLanguage;
    }
  }

  updateDocumentDirection();
}

/**
 * Update the document root element's lang and dir attributes
 */
function updateDocumentDirection() {
  if (typeof document === 'undefined') return;
  const dir = RTL_LANGUAGES.has(currentLanguage) ? 'rtl' : 'ltr';
  document.documentElement.lang = currentLanguage;
  document.documentElement.dir = dir;
}

function getNestedValue(obj, path) {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length; i++) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = current[parts[i]];
  }

  return current;
}

function interpolate(str, options) {
  if (!options) return str;

  if (options.count !== undefined) {
    str = str.replace(/__count__/g, options.count);
  }

  if (Array.isArray(options)) {
    for (let i = 0; i < options.length; i++) {
      str = str.replace(new RegExp('\\{' + i + '\\}', 'g'), options[i]);
    }
    return str;
  }

  for (const prop in options) {
    if (Object.hasOwn(options, prop)) {
      str = str.replace(new RegExp('\\{' + prop + '\\}', 'g'), options[prop]);
    }
  }
  return str;
}

/**
 * Translate a key to the current language
 * @param {string} key - Translation key (dot notation supported)
 * @param {Object|Array} [options] - Interpolation values or array of positional values
 * @returns {string} Translated string, or key if not found
 */
export function t(key, options) {
  let translation = getNestedValue(resources, currentLanguage + '.translation.' + key);

  if (translation === undefined && currentLanguage !== fallbackLanguage) {
    translation = getNestedValue(resources, fallbackLanguage + '.translation.' + key);
  }

  if (translation === undefined) return key;

  return interpolate(translation, options);
}

/**
 * Get current language code
 * @returns {string} Current language code
 */
export function lng() {
  return currentLanguage;
}

function getCookie(name) {
  if (typeof document === 'undefined') return '';
  const value = '; ' + document.cookie;
  const parts = value.split('; ' + name + '=');
  if (parts.length === 2) {
    return parts.pop().split(';').shift();
  }
  return '';
}

function setCookie(name, value, days) {
  if (typeof document === 'undefined') return;
  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = '; expires=' + date.toUTCString();
  }
  document.cookie = name + '=' + (value || '') + expires + '; path=/';
}

/**
 * Change the current language and re-translate the page
 * @param {string} langCode - Language code to switch to
 * @returns {Promise<boolean>} True if language was changed successfully
 */
export async function setLng(langCode) {
  // Load the language if not already loaded
  const loaded = await loadLanguage(langCode);

  if (loaded) {
    currentLanguage = langCode;
    setCookie('i18next', langCode, 365);
    updateDocumentDirection();
    translatePage();
    return true;
  }
  return false;
}

/**
 * Translate a single element using its data-i18n attribute
 * Supports attribute targeting: [attr]key (e.g., [title]tooltip.help)
 * Sets lang and dir attributes to match the current language
 * @param {Element} el - Element with data-i18n attribute
 */
export function translateElement(el) {
  const attr = el.getAttribute('data-i18n');
  if (!attr) return;

  const match = attr.match(/^\[(\w+)\](.+)$/);
  let target, key;

  if (match) {
    target = match[1];
    key = match[2];
  } else {
    target = 'html';
    key = attr;
  }

  const translation = t(key);

  switch (target) {
    case 'html':
      el.innerHTML = translation;
      break;
    case 'text':
      el.textContent = translation;
      break;
    case 'title':
      el.setAttribute('title', translation);
      break;
    case 'placeholder':
      el.setAttribute('placeholder', translation);
      break;
    case 'value':
      el.value = translation;
      break;
    default:
      el.setAttribute(target, translation);
  }

  el.lang = currentLanguage;
  el.dir = RTL_LANGUAGES.has(currentLanguage) ? 'rtl' : 'ltr';
}

/**
 * Translate all elements with data-i18n attribute within a container
 * @param {Element|Document} [container=document] - Container to search within
 */
export function translatePage(container) {
  if (typeof document === 'undefined') return;
  container = container || document;
  const elements = container.querySelectorAll('[data-i18n]');

  elements.forEach(el => {
    translateElement(el);
  });
}

/**
 * Check if a language is loaded
 * @param {string} lang - Language code
 * @returns {boolean}
 */
export function isLoaded(lang) {
  return !!resources[lang];
}

/**
 * Preload a language without switching to it
 * @param {string} lang - Language code
 * @returns {Promise<boolean>} True if loaded successfully
 */
export async function preload(lang) {
  const loaded = await loadLanguage(lang);
  return !!loaded;
}

/**
 * Get the loaded resource data for a specific language
 * @param {string} lang - Language code
 * @returns {Object|null} The resource data or null if not loaded
 */
export function getResource(lang) {
  return resources[lang] ?? null;
}

export const i18n = {
  init,
  t,
  lng,
  setLng,
  translatePage,
  translateElement,
  isLoaded,
  preload,
  getResource
};

export default i18n;
