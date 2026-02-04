/**
 * Vanilla JS Helper Library
 * jQuery-like utilities for DOM manipulation, events, and animations
 */

/**
 * Convert various input types to a DOM element
 * @param {Element|NodeList|Array|null} el - Element, array-like, or null
 * @returns {Element|null} DOM element or null
 */
export function toElement(el) {
  if (!el) return null;
  if (el.nodeType) return el;
  if (el[0]?.nodeType) return el[0];
  return null;
}

/**
 * Query selector shorthand
 * @param {string} selector - CSS selector
 * @param {Element|Document} [context=document] - Context to search within
 * @returns {Element|null} First matching element
 */
export function qs(selector, context) {
  return (context || document).querySelector(selector);
}

function isPlainObject(obj) {
  return obj !== null &&
    typeof obj === 'object' &&
    Object.prototype.toString.call(obj) === '[object Object]';
}

/**
 * Deep merge objects recursively
 * @param {Object} target - Target object to merge into
 * @param {...Object} sources - Source objects to merge from
 * @returns {Object} The modified target object
 */
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

/**
 * Shallow merge objects (Object.assign alternative)
 * @param {Object} target - Target object
 * @param {...Object} sources - Source objects
 * @returns {Object} The modified target object
 */
export function extend(target, ...sources) {
  sources.forEach(source => {
    if (!source) return;
    Object.keys(source).forEach(key => {
      target[key] = source[key];
    });
  });
  return target;
}

/**
 * Get element's position relative to document
 * @param {Element} el - DOM element
 * @returns {{top: number, left: number}} Position coordinates
 */
export function offset(el) {
  if (!el) return { top: 0, left: 0 };
  const rect = el.getBoundingClientRect();
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  return {
    top: rect.top + scrollTop,
    left: rect.left + scrollLeft
  };
}

/**
 * Find closest ancestor matching selector (polyfill)
 * @param {Element} el - Starting element
 * @param {string} selector - CSS selector
 * @returns {Element|null} Matching ancestor or null
 */
export function closest(el, selector) {
  if (!el) return null;
  if (el.closest) return el.closest(selector);

  while (el) {
    if (el.matches && el.matches(selector)) return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * Get sibling elements, optionally filtered by selector
 * @param {Element} el - Reference element
 * @param {string} [selector] - Optional CSS selector to filter siblings
 * @returns {Element[]} Array of sibling elements
 */
export function siblings(el, selector) {
  if (!el || !el.parentElement) return [];
  let sibs = Array.from(el.parentElement.children).filter(sibling => sibling !== el);
  if (selector) {
    sibs = sibs.filter(sibling => sibling.matches && sibling.matches(selector));
  }
  return sibs;
}

/**
 * Create DOM elements from HTML string
 * @param {string} html - HTML string
 * @returns {Element|DocumentFragment} Single element or fragment if multiple
 */
export function createElements(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const content = template.content;
  return content.childNodes.length === 1 ? content.firstChild : content;
}

/**
 * Insert element after a reference element
 * @param {Element} newEl - Element to insert
 * @param {Element} refEl - Reference element
 */
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

/**
 * Attach event listener with optional delegation
 * @param {Element} el - Target element
 * @param {string} events - Space-separated event types (supports namespaces like "click.myns")
 * @param {string|Function} selectorOrHandler - CSS selector for delegation, or handler function
 * @param {Function} [handler] - Handler function (when using delegation)
 */
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


/**
 * Animate element height from 0 to full (slide down)
 * @param {Element} el - Element to animate
 * @param {number|Function} [duration=300] - Animation duration in ms, or callback
 * @param {Function} [callback] - Called when animation completes
 */
export function slideDown(el, duration, callback) {
  if (!el) return;
  if (typeof duration === 'function') {
    callback = duration;
    duration = 300;
  }
  duration = duration || 300;

  el.style.display = '';
  el.style.overflow = 'hidden';
  const height = el.scrollHeight;
  el.style.height = '0px';
  el.style.transition = 'height ' + duration + 'ms';

  el.getBoundingClientRect(); // force reflow

  el.style.height = height + 'px';

  setTimeout(() => {
    el.style.height = '';
    el.style.overflow = '';
    el.style.transition = '';
    if (callback) callback();
  }, duration);
}

/**
 * Animate element height to 0 then hide (slide up)
 * @param {Element} el - Element to animate
 * @param {number|Function} [duration=300] - Animation duration in ms, or callback
 * @param {Function} [callback] - Called when animation completes
 */
export function slideUp(el, duration, callback) {
  if (!el) return;
  if (typeof duration === 'function') {
    callback = duration;
    duration = 300;
  }
  duration = duration || 300;

  el.style.overflow = 'hidden';
  el.style.height = el.scrollHeight + 'px';
  el.style.transition = 'height ' + duration + 'ms';

  el.getBoundingClientRect(); // force reflow

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

/**
 * Get/set arbitrary data on elements (like jQuery.data)
 * @param {Element} el - DOM element
 * @param {string} [key] - Data key (omit to get all data)
 * @param {*} [value] - Value to set (omit to get)
 * @returns {*} Stored value when getting
 */
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
  slideDown,
  slideUp,
  data
};

export default helpers;
