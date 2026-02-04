/**
 * MovableWindow
 * A draggable popup window component
 */

import { elem, offset } from '../lib/helpers.esm.js';

/**
 * Create a movable window
 * @param {number} width - Window width
 * @param {number} height - Window height
 * @param {string} titleText - Window title
 * @param {string} id - Optional element ID
 * @returns {Object} Window API object
 */
export function MovableWindow(width = 300, height = 200, titleText = '', id = null) {
  const container = elem('div', { className: 'movable-window', popover: '' });
  if (id) container.id = id;
  const header = elem('div', { className: 'movable-header' });
  const title = elem('span', { className: 'movable-header-title', textContent: titleText });
  const close = elem('span', { className: 'close-button' });
  header.append(title, close);
  const body = elem('div', { className: 'movable-body' });
  container.append(header, body);

  document.body.appendChild(container);

  let startWindowPosition = null;
  let startMousePosition = null;

  header.addEventListener('mousedown', function(e) {
    document.addEventListener('mousemove', move, false);
    document.addEventListener('mouseup', mouseup, false);

    startWindowPosition = offset(container);
    startMousePosition = { x: e.clientX, y: e.clientY };
  }, false);

  function mouseup() {
    document.removeEventListener('mousemove', move, false);
    document.removeEventListener('mouseup', mouseup, false);
  }

  function move(e) {
    container.style.top = (startWindowPosition.top - (startMousePosition.y - e.clientY)) + 'px';
    container.style.left = (startWindowPosition.left - (startMousePosition.x - e.clientX)) + 'px';
  }

  close.addEventListener('click', hide, false);

  function size(w, h) {
    body.style.width = w + 'px';
    body.style.height = h + 'px';
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

  function center() {
    const infoWidth = container.offsetWidth;
    const infoHeight = container.offsetHeight;
    let top = window.innerHeight / 2 - infoHeight / 2;
    let left = window.innerWidth / 2 - infoWidth / 2;

    if (top < 0) top = 0;
    if (left < 0) left = 0;

    container.style.top = top + 'px';
    container.style.left = left + 'px';

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
    center,
    closeButton: close,
    destroy
  };

  size(width, height);
  center();

  return ext;
}

export default MovableWindow;
