/**
 * WindowManager
 * Manages multiple resizable window instances with tabs and splitters
 */

import { elem } from '../lib/helpers.esm.js';
import { mixinEventEmitter } from '../common/EventEmitter.js';
import { getWindowTypeByClassName, getApp } from './registry.js';
import { getWindowIcon } from './windowIcons.js';

const linkedSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>';
const unlinkedSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M5.17 11.75l-1.71 1.71a5 5 0 0 0 7.07 7.07l1.71-1.71"/><line x1="8" y1="2" x2="8" y2="5"/><line x1="2" y1="8" x2="5" y2="8"/><line x1="16" y1="19" x2="16" y2="22"/><line x1="19" y1="16" x2="22" y2="16"/></svg>';

/**
 * Individual window instance within the manager
 * @class
 */
class Window {
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

    // The comparison window navigates independently and never participates in
    // linked navigation, so it doesn't get a link/unlink button.
    const supportsLinking = className !== 'TextComparisonWindow';
    const linkBtn = supportsLinking ? elem('span', { className: 'link-button' }) : null;
    this.closeContainer = linkBtn
      ? elem('div', { className: 'close-container' }, linkBtn, closeBtn)
      : elem('div', { className: 'close-container' }, closeBtn);

    // Linked windows follow (and broadcast) navigation; unlinked windows
    // scroll and navigate independently of the rest.
    this.linked = data?.linked !== false;

    if (linkBtn) {
      const updateLinkButton = () => {
        linkBtn.innerHTML = this.linked ? linkedSvg : unlinkedSvg;
        linkBtn.classList.toggle('unlinked', !this.linked);
        linkBtn.title = this.linked
          ? 'Linked: follows navigation in other windows. Click to unlink.'
          : 'Unlinked: navigates independently. Click to relink.';
      };
      updateLinkButton();

      linkBtn.addEventListener('click', () => {
        this.linked = !this.linked;
        updateLinkButton();
        manager.trigger('settingschange', { type: 'settingschange', target: this, data: null });
      });
    }
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
        const tagName = WindowType.WindowClass._tagName;
        this.controller = (tagName && customElements.get(tagName))
          ? document.createElement(tagName)
          : new WindowType.WindowClass();
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
    // mouseenter only fires on a real pointer boundary crossing, so after the
    // browser app loses and regains focus (hover state resets, pointer hasn't
    // moved) no window has focus and scroll sync stalls. Wheel and pointerdown
    // both imply the pointer is inside this window, so use them to re-focus.
    this.node.addEventListener('wheel', this._handleFocus.bind(this), { passive: true });
    this.node.addEventListener('pointerdown', this._handleFocus.bind(this));
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
    if (this.node.classList.contains('focused')) return;
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
    const data = this.controller?.getData() ?? {};
    if (!this.linked) data.linked = false;
    return data;
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

    this._bindReorderEvents();
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
    this._applyWindowOrder();
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
    this._applyWindowOrder();
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
        const tabBarHeight = 26; // tabs sit in their own row below the top bar

        this.windows.forEach((win, i) => {
          win.size(width, height - tabBarHeight);
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

  /**
   * Bring a window to the front, same as clicking its tab. Matters in
   * compact-ui where `.window.active` controls which window is visible.
   * @param {string} id - Window ID
   */
  activate(id) {
    const win = this.windows.find(w => w.id === id);
    if (!win) return;

    document.querySelectorAll('.window, .window-tab').forEach(el => {
      el.classList.remove('active');
    });
    win.tab.classList.add('active');
    win.node.classList.add('active');
  }

  /**
   * Keep visual order in sync with the windows array via flex `order`.
   * Window nodes are never moved in the DOM: re-inserting a node disconnects
   * its web component, and disconnectedCallback() tears down all of its
   * listeners with no re-init path.
   */
  _applyWindowOrder() {
    this.windows.forEach((win, i) => {
      win.node.style.order = i;
    });
  }

  _moveWindow(fromIndex, toIndex) {
    const [win] = this.windows.splice(fromIndex, 1);
    this.windows.splice(toIndex, 0, win);

    // Widths travel with their window so a resized window keeps its size
    const [width] = this.windowWidths.splice(fromIndex, 1);
    this.windowWidths.splice(toIndex, 0, width);

    this._applyWindowOrder();
    this.size();
  }

  /**
   * Drag a window header left/right to reorder windows. Delegated from the
   * container so it works for every window type's header, including content
   * rendered after the window is created.
   */
  _bindReorderEvents() {
    const interactiveSelector =
      'input, textarea, select, button, a, [contenteditable], .app-list, .header-icon, .map-search-suggestions';
    const dragThreshold = 5; // px before a press becomes a drag, so clicks stay clicks
    const slideMs = 180; // matches the .window-slide transition in windows.css
    const snapMs = 320; // matches the .window-snap transition in windows.css

    let win = null;
    let startX = 0;
    let dragging = false;
    let moved = false;
    // Slot geometry per window node. Only a swap changes layout, so measuring
    // at drag start and after swaps keeps mousemove free of forced reflows.
    let slots = null;

    // A window's layout slot with any in-flight translate factored out, so
    // measurements stay stable while slide animations are running.
    const translateX = (node) => parseFloat(getComputedStyle(node).translate) || 0;

    const measureSlots = () => {
      slots = new Map();
      for (const w of this.windows) {
        const rect = w.node.getBoundingClientRect();
        const left = rect.left - translateX(w.node);
        slots.set(w.node, { left, mid: left + rect.width / 2, width: rect.width });
      }
    };

    // Animate a window from `offset` px back into its natural slot
    const slideHome = (node, offset) => {
      node.classList.remove('window-slide', 'window-snap');
      node.style.translate = `${offset}px 0`;
      node.offsetWidth; // commit the start position before transitioning
      node.classList.add('window-slide');
      node.style.translate = '';
      clearTimeout(node._slideTimer);
      node._slideTimer = setTimeout(() => node.classList.remove('window-slide'), slideMs + 70);
    };

    // Drop the dragged window into its slot with a springy snap; the lift
    // (opacity, shadow) eases away in the same motion
    const snapHome = (node) => {
      node.classList.remove('window-slide');
      node.classList.add('window-snap');
      node.style.translate = '';
      clearTimeout(node._slideTimer);
      node._slideTimer = setTimeout(() => node.classList.remove('window-snap'), snapMs + 70);
    };

    const swapWith = (neighbor, fromIndex, toIndex, clientX) => {
      const neighborLeft = slots.get(neighbor.node).left;
      const draggedLeft = slots.get(win.node).left;

      this._moveWindow(fromIndex, toIndex);
      measureSlots(); // the reorder moved every slot

      // Rebase so the dragged window stays under the pointer in its new slot
      startX += slots.get(win.node).left - draggedLeft;
      win.node.style.translate = `${clientX - startX}px 0`;

      slideHome(neighbor.node, neighborLeft - slots.get(neighbor.node).left);
      moved = true;
    };

    const onMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;

      if (!dragging) {
        if (Math.abs(clientX - startX) < dragThreshold) return;
        dragging = true;

        // If grabbed mid-animation, freeze the in-flight position and carry
        // it into the drag so the window doesn't jump
        const inFlight = translateX(win.node);
        if (inFlight) {
          win.node.style.translate = `${inFlight}px 0`;
          startX -= inFlight;
        }
        win.node.classList.remove('window-slide', 'window-snap');
        clearTimeout(win.node._slideTimer);

        win.node.classList.add('reordering');
        document.body.classList.add('window-reordering');
        measureSlots();
      }

      e.preventDefault();

      // The dragged window follows the pointer
      const dx = clientX - startX;
      win.node.style.translate = `${dx}px 0`;

      const index = this.windows.indexOf(win);
      const next = this.windows[index + 1];
      const prev = this.windows[index - 1];

      // Swap as soon as the dragged window's leading edge crosses the
      // neighbor's midpoint. Comparing the pointer instead would force a much
      // longer drag: it starts inside the dragged window, so it would have to
      // cross the rest of that window before even entering the neighbor.
      const slot = slots.get(win.node);
      const winLeft = slot.left + dx;
      const winRight = winLeft + slot.width;

      if (next && winRight > slots.get(next.node).mid) {
        swapWith(next, index, index + 1, clientX);
      } else if (prev && winLeft < slots.get(prev.node).mid) {
        swapWith(prev, index, index - 1, clientX);
      }
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', onUp);

      if (dragging) {
        win.node.classList.remove('reordering');
        snapHome(win.node);
        document.body.classList.remove('window-reordering');

        if (moved) {
          this.trigger('settingschange', { type: 'settingschange', target: this, data: null });
        }
      }

      win = null;
      dragging = false;
      moved = false;
      slots = null;
    };

    const onDown = (e) => {
      if (win) return; // already tracking a press; ignore extra fingers/buttons
      if (!e.touches && e.button !== 0) return;
      if (this.windows.length < 2) return;
      if (document.body.classList.contains('compact-ui')) return;
      if (e.target.closest(interactiveSelector)) return;

      const header = e.target.closest('.window-header');
      if (!header) return;

      const windowNode = header.closest('.window');
      win = this.windows.find(w => w.node === windowNode) || null;
      if (!win) return;

      if (!e.touches) {
        e.preventDefault(); // stop text selection from starting
        // preventDefault also blocks the native blur, which the map search
        // dropdown relies on to close
        if (document.activeElement !== document.body) document.activeElement?.blur?.();
      }

      startX = e.touches ? e.touches[0].clientX : e.clientX;

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchmove', onMove, { passive: false });
      document.addEventListener('touchend', onUp);
      // An OS-cancelled touch (notification shade, incoming call) must still
      // end the drag, or body.window-reordering freezes all pointer input.
      document.addEventListener('touchcancel', onUp);
    };

    this.nodeEl.addEventListener('mousedown', onDown);
    this.nodeEl.addEventListener('touchstart', onDown, { passive: true });
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
