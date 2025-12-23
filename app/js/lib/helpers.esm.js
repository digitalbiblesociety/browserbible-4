/**
 * Vanilla JS Helper Library
 * Provides jQuery-like utilities for DOM manipulation, events, and AJAX
 */

export function toElement(el) {
  if (!el) return null;
  if (el.nodeType) return el;
  if (el[0]?.nodeType) return el[0];
  return null;
}

export function qs(selector, context) {
  return (context || document).querySelector(selector);
}

function isPlainObject(obj) {
  return obj !== null &&
    typeof obj === 'object' &&
    Object.prototype.toString.call(obj) === '[object Object]';
}

export function deepMerge(target, ...sources) {
  sources.forEach(source => {
    if (!source) return;

    Object.keys(source).forEach(key => {
      const sourceVal = source[key];
      const targetVal = target[key];

      if (isPlainObject(sourceVal)) {
        if (!isPlainObject(targetVal)) {
          target[key] = {};
        }
        deepMerge(target[key], sourceVal);
      } else if (Array.isArray(sourceVal)) {
        target[key] = sourceVal.slice();
      } else {
        target[key] = sourceVal;
      }
    });
  });

  return target;
}

export function extend(target, ...sources) {
  sources.forEach(source => {
    if (!source) return;
    Object.keys(source).forEach(key => {
      target[key] = source[key];
    });
  });
  return target;
}

export function offset(el) {
  if (!el) return { top: 0, left: 0 };
  const rect = el.getBoundingClientRect();
  const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  return {
    top: rect.top + scrollTop,
    left: rect.left + scrollLeft
  };
}

export function closest(el, selector) {
  if (!el) return null;
  if (el.closest) return el.closest(selector);

  while (el) {
    if (el.matches && el.matches(selector)) return el;
    el = el.parentElement;
  }
  return null;
}

export function siblings(el, selector) {
  if (!el || !el.parentElement) return [];
  let sibs = Array.from(el.parentElement.children).filter(sibling => sibling !== el);
  if (selector) {
    sibs = sibs.filter(sibling => sibling.matches && sibling.matches(selector));
  }
  return sibs;
}

export function createElements(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const content = template.content;
  return content.childNodes.length === 1 ? content.firstChild : content;
}

export function insertAfter(newEl, refEl) {
  if (refEl && refEl.parentNode && newEl) {
    refEl.parentNode.insertBefore(newEl, refEl.nextSibling);
  }
}

const eventStore = new WeakMap();

function getEventStore(el) {
  if (!eventStore.has(el)) {
    eventStore.set(el, {});
  }
  return eventStore.get(el);
}

function parseEventString(eventString) {
  const parts = eventString.split('.');
  return {
    type: parts[0],
    namespace: parts.slice(1).join('.') || ''
  };
}

export function on(el, events, selectorOrHandler, handler) {
  if (!el) return;

  const selector = typeof selectorOrHandler === 'string' ? selectorOrHandler : null;
  const fn = selector ? handler : selectorOrHandler;

  events.split(/\s+/).forEach(eventString => {
    const parsed = parseEventString(eventString);
    const store = getEventStore(el);

    const wrapper = (e) => {
      if (selector) {
        let target = e.target;
        while (target && target !== el) {
          if (target.matches && target.matches(selector)) {
            fn.call(target, e);
            return;
          }
          target = target.parentElement;
        }
      } else {
        fn.call(el, e);
      }
    };

    const key = parsed.type + (parsed.namespace ? '.' + parsed.namespace : '');
    if (!store[key]) store[key] = [];
    store[key].push({ original: fn, wrapper: wrapper, selector: selector });

    el.addEventListener(parsed.type, wrapper, false);
  });
}

export function fadeOut(el, duration, callback) {
  if (!el) return;
  duration = duration || 300;

  el.style.transition = 'opacity ' + duration + 'ms';
  el.style.opacity = '0';

  setTimeout(() => {
    el.style.display = 'none';
    el.style.transition = '';
    if (callback) callback();
  }, duration);
}

export function slideDown(el, duration, callback) {
  if (!el) return;
  duration = duration || 300;

  el.style.display = '';
  el.style.overflow = 'hidden';
  const height = el.scrollHeight;
  el.style.height = '0px';
  el.style.transition = 'height ' + duration + 'ms';

  el.offsetHeight;

  el.style.height = height + 'px';

  setTimeout(() => {
    el.style.height = '';
    el.style.overflow = '';
    el.style.transition = '';
    if (callback) callback();
  }, duration);
}

export function slideUp(el, duration, callback) {
  if (!el) return;
  duration = duration || 300;

  el.style.overflow = 'hidden';
  el.style.height = el.scrollHeight + 'px';
  el.style.transition = 'height ' + duration + 'ms';

  el.offsetHeight;

  el.style.height = '0px';

  setTimeout(() => {
    el.style.display = 'none';
    el.style.height = '';
    el.style.overflow = '';
    el.style.transition = '';
    if (callback) callback();
  }, duration);
}

const dataStore = new WeakMap();

export function data(el, key, value) {
  if (!el) return;

  if (!dataStore.has(el)) {
    dataStore.set(el, {});
  }
  const store = dataStore.get(el);

  if (key === undefined) {
    return store;
  }

  if (value !== undefined) {
    store[key] = value;
    return;
  }

  if (key in store) {
    return store[key];
  }

  const attrVal = el.dataset ? el.dataset[key] : el.getAttribute('data-' + key);
  if (attrVal !== null) {
    try {
      return JSON.parse(attrVal);
    } catch (_e) {
      return attrVal;
    }
  }

  return undefined;
}

const helpers = {
  toElement,
  qs,
  deepMerge,
  extend,
  offset,
  closest,
  siblings,
  createElements,
  insertAfter,
  on,
  fadeOut,
  slideDown,
  slideUp,
  data
};

export default helpers;
