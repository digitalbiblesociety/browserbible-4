/**
 * Vanilla JS Helper Library
 * jQuery-like utilities for DOM manipulation and events
 */

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
 * Create a DOM element with properties
 * @param {string} tag - HTML tag name
 * @param {Object|string} [props={}] - Properties object, or string for textContent shorthand
 * @param {...(Element|string)} [children] - Child elements or text to append
 * @returns {Element} The created element
 */
export function elem(tag, props = {}, ...children) {
  const el = document.createElement(tag);

  // Text shorthand: elem('span', 'Hello')
  if (typeof props === 'string') {
    el.textContent = props;
    children = children.filter(Boolean);
    if (children.length) el.append(...children);
    return el;
  }

  for (const [key, val] of Object.entries(props)) {
    if (key === 'style' && typeof val === 'object') {
      Object.assign(el.style, val);
    } else if (key === 'dataset' && typeof val === 'object') {
      Object.assign(el.dataset, val);
    } else if (key === 'children') {
      children.push(...[val].flat());
    } else {
      el[key] = val;
    }
  }

  children = children.filter(Boolean);
  if (children.length) el.append(...children);
  return el;
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
  extend,
  offset,
  closest,
  siblings,
  elem,
  insertAfter,
  on,
  data
};

export default helpers;
