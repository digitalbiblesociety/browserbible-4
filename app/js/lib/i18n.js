/**
 * Simple i18n (internationalization) module (ES6)
 * Replacement for i18next that doesn't require jQuery
 */

let currentLanguage = 'en';
let fallbackLanguage = 'en';
let resources = {};

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

export function t(key, options) {
  let translation = getNestedValue(resources, currentLanguage + '.translation.' + key);

  if (translation === undefined && currentLanguage !== fallbackLanguage) {
    translation = getNestedValue(resources, fallbackLanguage + '.translation.' + key);
  }

  if (translation === undefined) {
    return key;
  }

  if (options) {
    if (options.count !== undefined) {
      translation = translation.replace(/__count__/g, options.count);
    }

    if (Array.isArray(options)) {
      for (let i = 0; i < options.length; i++) {
        translation = translation.replace(new RegExp('\\{' + i + '\\}', 'g'), options[i]);
      }
    } else {
      for (const prop in options) {
        if (Object.prototype.hasOwnProperty.call(options, prop)) {
          translation = translation.replace(new RegExp('\\{' + prop + '\\}', 'g'), options[prop]);
        }
      }
    }
  }

  return translation;
}

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

export function setLng(langCode) {
  if (resources[langCode]) {
    currentLanguage = langCode;
    setCookie('i18next', langCode, 365);
    translatePage();
  }
}

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
