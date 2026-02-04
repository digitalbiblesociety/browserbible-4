/**
 * Simple i18n (internationalization) module
 * Lightweight replacement for i18next without jQuery dependency
 */

let currentLanguage = 'en';
let fallbackLanguage = 'en';
let resources = {};

/**
 * Initialize the i18n system
 * @param {Object} [options={}] - Configuration options
 * @param {Object} [options.resStore] - Resource store with translations keyed by language
 * @param {string} [options.fallbackLng] - Fallback language code
 * @param {string} [options.lng] - Initial language code (auto-detected if not provided)
 */
export function init(options = {}) {
  if (options.resStore) {
    resources = options.resStore;
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

  if (!resources[currentLanguage]) {
    currentLanguage = fallbackLanguage;
  }
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
 */
export function setLng(langCode) {
  if (resources[langCode]) {
    currentLanguage = langCode;
    setCookie('i18next', langCode, 365);
    translatePage();
  }
}

/**
 * Translate a single element using its data-i18n attribute
 * Supports attribute targeting: [attr]key (e.g., [title]tooltip.help)
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

export const i18n = {
  init,
  t,
  lng,
  setLng,
  translatePage,
  translateElement
};

export default i18n;
