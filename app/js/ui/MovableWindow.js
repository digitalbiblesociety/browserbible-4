/**
 * MovableWindow
 * A popup window component
 */

import { elem } from '../lib/helpers.esm.js';

/**
 * Create a movable window
 * @param {number} width - Window width
 * @param {number} height - Window height
 * @param {string} titleText - Window title
 * @param {string} id - Optional element ID
 * @returns {Object} Window API object
 */
export function MovableWindow(width = 300, height = 200, titleText = '', id = null) {
  const title = elem('span', { className: 'movable-header-title' }, titleText);
  const close = elem('span', { className: 'close-button' });
  const header = elem('div', { className: 'movable-header' }, title, close);
  const body = elem('div', { className: 'movable-body' });
  const container = elem('div', { className: 'movable-window', popover: '' }, header, body);
  if (id) container.id = id;

  document.body.appendChild(container);

  close.addEventListener('click', hide, false);

  function size(w, h) {
    if (w) container.style.width = w + 'px';
    if (h) body.style.height = h + 'px';
    return ext;
  }

  function show() {
    container.showPopover();
    return ext;
  }

  function hide() {
    container.hidePopover();
    return ext;
  }

  function isVisible() {
    return container.matches(':popover-open');
  }

  function onToggle(callback) {
    container.addEventListener('toggle', callback);
    return ext;
  }

  function destroy() {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }

  const ext = {
    show,
    hide,
    isVisible,
    onToggle,
    size,
    container,
    body,
    title,
    closeButton: close,
    destroy
  };

  size(width, height);

  return ext;
}

export default MovableWindow;
