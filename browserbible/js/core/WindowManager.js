/**
 * WindowManager
 * Manages multiple resizable window instances with tabs and splitters
 */

import { elem } from '../lib/helpers.esm.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import { getWindowTypeByClassName, getApp } from './registry.js';
import { getWindowIcon } from './windowIcons.js';

/**
 * Individual window instance within the manager
 * @class
 */
export class Window {
  /**
   * @param {string} id - Unique window identifier
   * @param {HTMLElement} parentNode - Container element
   * @param {string} className - Window type class name
   * @param {Object} data - Initial window data
   * @param {WindowManager} manager - Parent manager instance
   */
  constructor(id, parentNode, className, data, manager) {
    this.id = id;
    this.className = className;
    this.manager = manager;

    const parentNodeEl = parentNode?.nodeType ? parentNode : parentNode?.[0];

    this.node = elem('div', { className: `window ${className} active` });
    const closeBtn = elem('span', { className: 'close-button' });
    this.closeContainer = elem('div', { className: 'close-container' }, closeBtn);
    const tabLabel = elem('span', { className: `window-tab-label ${className}-tab` });
    const iconSvg = getWindowIcon(className);
    if (iconSvg) {
      const iconSpan = elem('span', { className: 'window-tab-icon' });
      iconSpan.innerHTML = iconSvg;
      tabLabel.appendChild(iconSpan);
    }
    tabLabel.appendChild(document.createTextNode(className));
    const tabInner = elem('div', { className: 'window-tab-inner' }, tabLabel);
    this.tab = elem('div', { className: `window-tab ${className} active` }, tabInner);

    parentNodeEl.appendChild(this.node);
    this.node.appendChild(this.closeContainer);
    document.body.appendChild(this.tab);
    closeBtn.addEventListener('click', () => {
      manager.remove(this.id);
    });

    Array.from(this.node.parentNode?.children || [])
      .filter(el => el !== this.node && el.matches('.window'))
      .forEach(sibling => sibling.classList.remove('active'));
    Array.from(this.tab.parentNode?.children || [])
      .filter(el => el !== this.tab && el.matches('.window-tab'))
      .forEach(sibling => sibling.classList.remove('active'));

    const WindowType = getWindowTypeByClassName(className);
    if (WindowType && WindowType.WindowClass) {
      const isWebComponent = WindowType.WindowClass.prototype instanceof HTMLElement;

      if (isWebComponent) {
        this.controller = new WindowType.WindowClass();
        this.controller.parentInfo = { node: this.node, tab: this.tab };
        this.controller.windowId = id;
        this.controller.initData = data || {};
        this.controller.setAttribute('window-id', id);
        this.controller.setAttribute('init-data', JSON.stringify(data || {}));
        this.node.appendChild(this.controller);
      } else {
        this.controller = WindowType.WindowClass(id, this, data);
      }
    } else {
      console.error(`Window type "${className}" not found`);
      return;
    }

    if (this.controller?.on) {
      this.controller.on('settingschange', e => this.trigger('settingschange', e));
      this.controller.on('globalmessage', e => {
        e.id = id;
        this.trigger('globalmessage', e);
      });
    }

    this.node.addEventListener('mouseenter', this._handleFocus.bind(this));
    this.node.addEventListener('touchstart', this._handleFocus.bind(this));
    this.node.addEventListener('mouseleave', this._handleBlur.bind(this));
    this.node.addEventListener('windowblur', this._handleBlur.bind(this));

    this.tab.addEventListener('click', () => {
      document.querySelectorAll('.window, .window-tab').forEach(el => {
        el.classList.remove('active');
      });
      this.tab.classList.add('active');
      this.node.classList.add('active');
    });

    mixinEventEmitter(this);

    this.on('message', e => {
      this.controller?.trigger?.('message', e);

      if (e.data?.labelTab) {
        const tabSpan = this.tab.querySelector('span');
        if (tabSpan) {
          tabSpan.innerHTML = e.data.labelTab;
        }
      }
    });

    this.on('settingschange', e => manager.trigger('settingschange', e));

    this.on('globalmessage', e => {
      const app = getApp();
      app?.handleGlobalMessage?.(e);
    });
  }

  _handleFocus() {
    this.controller?.trigger?.('focus', {});
    this.node.classList.add('focused');
    Array.from(this.node.parentNode?.children || [])
      .filter(el => el !== this.node)
      .forEach(sibling => {
        sibling.classList.remove('focused');
        const blurEvent = new CustomEvent('windowblur');
        sibling.dispatchEvent(blurEvent);
      });
  }

  _handleBlur() {
    this.node.classList.remove('focused');
    this.controller?.trigger?.('blur', {});
  }

  /**
   * Resize the window
   * @param {number} width - Width in pixels
   * @param {number} height - Height in pixels
   */
  size(width, height) {
    this.node.style.width = `${width}px`;
    this.node.style.height = `${height}px`;

    this.controller?.size?.(width, height);
  }

  quit() {
    this.controller?.quit?.();
  }

  /**
   * Get window's current state data
   * @returns {Object} Window data for persistence
   */
  getData() {
    return this.controller?.getData() ?? {};
  }

  /**
   * Close and clean up the window
   */
  close() {
    this.controller?.close?.();
    this.controller = null;

    this.clearListeners();

    this.tab.parentNode?.removeChild(this.tab);
    this.node.parentNode?.removeChild(this.node);
  }
}

/**
 * Manages a collection of windows with resizable splitters
 * @class
 */
export class WindowManager {
  /**
   * @param {HTMLElement} node - Container element
   * @param {App} app - Parent application instance
   */
  constructor(node, app) {
    this.nodeEl = node?.nodeType ? node : node?.[0];
    this.app = app;
    this.windows = [];
    this.splitters = [];
    this.windowWidths = []; // proportional widths (0-1)

    mixinEventEmitter(this);
  }

  /**
   * Add a new window
   * @param {string} className - Window type class name
   * @param {Object} data - Initial window data
   * @returns {Window|null} The created window or null on error
   */
  add(className, data) {
    const id = `win${Date.now()}`;

    if (className === 'TextWindow') {
      className = 'BibleWindow';
    }

    const windowType = getWindowTypeByClassName(className);
    if (!windowType) {
      console.error(`Window type "${className}" not registered`);
      return null;
    }

    const win = new Window(id, this.nodeEl, className, data, this);
    this.windows.push(win);

    this._resetWindowWidths();
    this._rebuildSplitters();

    setTimeout(() => this.app?.resize?.(), 10);

    return win;
  }

  /**
   * Remove a window by ID
   * @param {string} id - Window ID to remove
   */
  remove(id) {
    const windowToClose = this.windows.find(win => win.id === id);

    if (!windowToClose) {
      console.warn("Can't find window", id);
      return;
    }

    this.windows = this.windows.filter(win => win.id !== id);

    windowToClose.close();

    if (this.windows.length > 0) {
      this.windows[0].tab.classList.add('active');
      this.windows[0].node.classList.add('active');
    }

    this._resetWindowWidths();
    this._rebuildSplitters();

    setTimeout(() => this.app?.resize?.(), 10);

    this.trigger('settingschange', { type: 'settingschange', target: this, data: null });
  }

  /**
   * Resize all windows to fit container
   * @param {number} [width] - Container width (auto-detected if omitted)
   * @param {number} [height] - Container height (auto-detected if omitted)
   */
  size(width, height) {
    if (width && height) {
      this.nodeEl.style.width = `${width}px`;
      this.nodeEl.style.height = `${height}px`;
    } else {
      width = this.nodeEl.offsetWidth;
      height = this.nodeEl.offsetHeight;
    }

    const sizeThreshold = 560;

    if (width < sizeThreshold) {
      document.body.classList.add('compact-ui');
    } else {
      document.body.classList.remove('compact-ui');
    }

    if (this.windows.length > 0) {
      if (width < sizeThreshold) {
        const tabWidth = this.windows[0].tab.offsetWidth - 10;

        this.windows.forEach((win, i) => {
          win.size(width, height);
          win.tab.style.right = `${(this.windows.length - i - 1) * tabWidth}px`;
        });
      } else {
        const firstNodeStyle = window.getComputedStyle(this.windows[0].node);
        const marginLeft = parseInt(firstNodeStyle.marginLeft, 10) || 0;
        const marginRight = parseInt(firstNodeStyle.marginRight, 10) || 0;
        const marginPerWindow = marginLeft + marginRight;
        const totalMargins = marginPerWindow * this.windows.length;
        const availableWidth = width - totalMargins;

        if (this.windowWidths.length !== this.windows.length) {
          this._resetWindowWidths();
        }

        let xPos = 0;
        this.windows.forEach((win, i) => {
          const winWidth = Math.floor(availableWidth * this.windowWidths[i]);
          win.size(winWidth, height);
          xPos += winWidth + marginPerWindow;

          if (i < this.splitters.length) {
            this.splitters[i].style.left = `${xPos - 4}px`;
            this.splitters[i].style.height = `${height}px`;
          }
        });
      }
    }
  }

  /**
   * Get serializable settings for all windows
   * @returns {Array<{windowType: string, data: Object}>}
   */
  getSettings() {
    return this.windows.map(win => ({
      windowType: win.className,
      data: win.getData()
    }));
  }

  /**
   * Get all window instances
   * @returns {Window[]}
   */
  getWindows() {
    return this.windows;
  }

  _resetWindowWidths() {
    const count = this.windows.length;
    if (count === 0) {
      this.windowWidths = [];
    } else {
      const equalWidth = 1 / count;
      this.windowWidths = this.windows.map(() => equalWidth);
    }
  }

  _rebuildSplitters() {
    this.splitters.forEach(splitter => {
      splitter.removeEventListener('mousedown', splitter._mousedownHandler);
      splitter.removeEventListener('touchstart', splitter._touchstartHandler);
      splitter.parentNode?.removeChild(splitter);
    });
    this.splitters = [];

    for (let i = 0; i < this.windows.length - 1; i++) {
      const splitter = elem('div', { className: 'window-splitter' });
      this.nodeEl.appendChild(splitter);
      this.splitters.push(splitter);

      this._bindSplitterEvents(splitter, i);
    }
  }

  _bindSplitterEvents(splitter, index) {
    let startX = 0;
    let startWidths = [];

    const onMouseMove = (e) => {
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const deltaX = clientX - startX;
      const containerWidth = this.nodeEl.offsetWidth;
      const deltaProportion = deltaX / containerWidth;

      const newLeftWidth = startWidths[index] + deltaProportion;
      const newRightWidth = startWidths[index + 1] - deltaProportion;

      const minWidth = 0.1; // 10% minimum
      if (newLeftWidth >= minWidth && newRightWidth >= minWidth) {
        this.windowWidths[index] = newLeftWidth;
        this.windowWidths[index + 1] = newRightWidth;
        this.size();
      }
    };

    const onMouseUp = () => {
      splitter.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('touchmove', onMouseMove);
      document.removeEventListener('touchend', onMouseUp);

      this.trigger('settingschange', { type: 'settingschange', target: this, data: null });
    };

    const onMouseDown = (e) => {
      e.preventDefault();
      startX = e.touches ? e.touches[0].clientX : e.clientX;
      startWidths = [...this.windowWidths];

      splitter.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.addEventListener('touchmove', onMouseMove, { passive: false });
      document.addEventListener('touchend', onMouseUp);
    };

    splitter._mousedownHandler = onMouseDown;
    splitter._touchstartHandler = onMouseDown;

    splitter.addEventListener('mousedown', onMouseDown);
    splitter.addEventListener('touchstart', onMouseDown, { passive: false });
  }
}

export default WindowManager;
