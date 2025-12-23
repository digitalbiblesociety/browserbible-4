/**
 * BaseWindow - Base class for all window web components
 * Provides common functionality like state management, event handling, and lifecycle
 */

import { mixinEventEmitter } from '../common/EventEmitter.js';
import { getConfig } from '../core/config.js';

export const AsyncHelpers = {
  /**
   * Promisify a callback-based function (success callback only)
   * @param {Function} fn - Function that takes a callback as last argument
   * @param  {...any} args - Arguments to pass to the function
   * @returns {Promise} Promise that resolves with callback result
   */
  promisify: (fn, ...args) => new Promise((resolve, reject) => {
    try {
      fn(...args, resolve);
    } catch (err) {
      reject(err);
    }
  }),

  /**
   * Promisify with success and error callbacks
   * @param {Function} fn - Function that takes success and error callbacks
   * @param  {...any} args - Arguments to pass to the function
   * @returns {Promise} Promise that resolves/rejects appropriately
   */
  promisifyWithError: (fn, ...args) => new Promise((resolve, reject) => {
    fn(...args, resolve, reject);
  }),

  /**
   * Wait for a timeout
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after timeout
   */
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

export class BaseWindow extends HTMLElement {
  constructor() {
    super();

    mixinEventEmitter(this);

    this.config = getConfig();

    this.state = {
      isInitialized: false,
      isLoading: false
    };

    this.refs = {};

    this.windowId = null;
    this.parentInfo = null;
    this.initData = null;

    this._boundHandlers = new Map();
    this._abortController = null;
  }

  /**
   * Called when element is added to DOM
   * Lifecycle: connectedCallback -> render -> cacheRefs -> attachEventListeners -> init
   */
  async connectedCallback() {
    if (this.state.isInitialized) return;

    this._abortController = new AbortController();

    try {
      this.windowId = this.windowId || this.getAttribute('window-id');
      this.initData = this.initData || this._parseInitData();

      await this.render();
      this.cacheRefs();
      this.attachEventListeners();
      await this.init();

      this.state.isInitialized = true;

      this.trigger('initialized', {
        type: 'initialized',
        target: this
      });
    } catch (err) {
      console.error(`${this.constructor.name} initialization error:`, err);
      this.showError('Failed to initialize window');
    }
  }

  disconnectedCallback() {
    this.cleanup();
  }

  _parseInitData() {
    const dataAttr = this.getAttribute('init-data');
    if (!dataAttr) return {};

    try {
      return JSON.parse(dataAttr);
    } catch (err) {
      console.warn('Failed to parse init-data:', err);
      return {};
    }
  }

  async render() {
    this.innerHTML = `
      <div class="window-content">
        <div class="window-header"></div>
        <div class="window-main"></div>
        <div class="window-footer"></div>
      </div>
    `;
  }

  cacheRefs() {
    this.refs.content = this.querySelector('.window-content');
    this.refs.header = this.querySelector('.window-header');
    this.refs.main = this.querySelector('.window-main');
    this.refs.footer = this.querySelector('.window-footer');
  }

  attachEventListeners() {
  }

  async init() {
  }

  cleanup() {
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }

    this._boundHandlers.clear();
    this.clearListeners();
  }

  addListener(target, event, handler, options = {}) {
    if (!target || !this._abortController) return;

    const opts = {
      ...options,
      signal: this._abortController.signal
    };

    target.addEventListener(event, handler, opts);
  }

  bindHandler(name, handler) {
    if (!this._boundHandlers.has(name)) {
      this._boundHandlers.set(name, handler.bind(this));
    }
    return this._boundHandlers.get(name);
  }

  setState(updates, shouldRender = false) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };

    this.trigger('statechange', {
      type: 'statechange',
      target: this,
      data: { oldState, newState: this.state, updates }
    });

    if (shouldRender) {
      this.rerender();
    }
  }

  async rerender() {
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();

    await this.render();
    this.cacheRefs();
    this.attachEventListeners();
  }

  showLoading(message = '') {
    this.state.isLoading = true;
    if (this.refs.main) {
      this.refs.main.classList.add('loading-indicator');
      if (message) {
        const loadingEl = this.refs.main.querySelector('.loading-message');
        if (!loadingEl) {
          const msgEl = document.createElement('div');
          msgEl.className = 'loading-message';
          msgEl.textContent = message;
          this.refs.main.prepend(msgEl);
        } else {
          loadingEl.textContent = message;
        }
      }
    }
  }

  hideLoading() {
    this.state.isLoading = false;
    if (this.refs.main) {
      this.refs.main.classList.remove('loading-indicator');
      const loadingEl = this.refs.main.querySelector('.loading-message');
      if (loadingEl) {
        loadingEl.remove();
      }
    }
  }

  showError(message, error = null) {
    this.state.isLoading = false;
    if (error) {
      console.error(`${this.constructor.name} error:`, error);
    }

    if (this.refs.main) {
      this.refs.main.classList.remove('loading-indicator');
      this.refs.main.innerHTML = `<div class="window-error">${this.escapeHtml(message)}</div>`;
    }
  }

  size(width, height) {
    this.style.width = `${width}px`;
    this.style.height = `${height}px`;

    if (this.refs.main && this.refs.header) {
      const headerHeight = this.refs.header.offsetHeight || 0;
      const footerHeight = this.refs.footer?.offsetHeight || 0;
      const mainHeight = height - headerHeight - footerHeight;

      this.refs.main.style.width = `${width}px`;
      this.refs.main.style.height = `${mainHeight}px`;
    }

    this.trigger('resize', {
      type: 'resize',
      target: this,
      data: { width, height }
    });
  }

  getData() {
    return {
      params: {
        win: this.constructor.windowType || 'base'
      }
    };
  }

  close() {
    this.cleanup();
    this.remove();
  }

  sendMessage(data) {
    this.trigger('message', {
      type: 'message',
      target: this,
      data
    });
  }

  getParam(key, defaultValue = null) {
    return this.initData?.[key] ??
           this.initData?.params?.[key] ??
           defaultValue;
  }

  $(selector) {
    return this.querySelector(selector);
  }

  $$(selector) {
    return this.querySelectorAll(selector);
  }

  escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = String(text);
    return div.innerHTML;
  }

  createElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  updateTabLabel(label) {
    const tabSpan = this.parentInfo?.tab?.querySelector?.('span');
    if (tabSpan) {
      tabSpan.textContent = label;
    }
  }
}

const style = document.createElement('style');
style.textContent = `
  bible-window,
  commentary-window,
  text-comparison-window,
  deaf-bible-window,
  search-window,
  map-window,
  audio-window,
  parallels-window,
  statistics-window,
  media-window {
    display: block;
    width: 100%;
    height: 100%;
    position: relative;
    z-index: 1;
  }
`;
document.head.appendChild(style);

export function registerWindowComponent(tagName, WindowClass, metadata = {}) {
  WindowClass.windowType = metadata.windowType;
  WindowClass.displayName = metadata.displayName;
  WindowClass.paramKeys = metadata.paramKeys || {};
  WindowClass.defaultInit = metadata.defaultInit || {};

  if (!customElements.get(tagName)) {
    customElements.define(tagName, WindowClass);
  }
}

export default BaseWindow;
