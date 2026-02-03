/**
 * InfoWindow
 * A positioned popup window for displaying information
 * Uses native popover API for click-off detection
 */

import { createElements, offset, deepMerge } from '../lib/helpers.esm.js';
import { EventEmitterMixin } from '../common/EventEmitter.js';

/**
 * Create an info window
 * @param {string} id - Optional element ID
 * @returns {Object} InfoWindow API object
 */
export function InfoWindow(id = null) {
  const container = createElements(
    '<div class="info-window" popover' + (id ? ' id="' + id + '"' : '') + '>' +
      '<span class="close-button"></span>' +
      '<div class="info-body"></div>' +
    '</div>'
  );

  document.body.appendChild(container);

  const body = container.querySelector('.info-body');
  const close = container.querySelector('.close-button');

  close.addEventListener('click', hide, false);

  // Handle popover toggle events (fires on light dismiss - click outside or Escape)
  container.addEventListener('toggle', (e) => {
    if (e.newState === 'closed') {
      ext.trigger('hide');
    }
  });

  function show() {
    container.showPopover();
    ext.trigger('show');
    return ext;
  }

  function hide() {
    container.hidePopover();
    ext.trigger('hide');
    return ext;
  }

  function center() {
    const infoWidth = container.offsetWidth;
    const infoHeight = container.offsetHeight;

    container.style.top = (window.innerHeight / 2 - infoHeight / 2) + 'px';
    container.style.left = (window.innerWidth / 2 - infoWidth / 2) + 'px';

    return ext;
  }

  function position(targetEl) {
    const tOffset = offset(targetEl);
    const tHeight = targetEl.offsetHeight;
    const infoWidth = container.offsetWidth;
    const infoHeight = container.offsetHeight;
    let left = tOffset.left - 20;
    let top = tOffset.top + tHeight;

    // Far left edge
    if (left < 0) {
      left = 0;
    // Far right
    } else if (left + infoWidth > window.innerWidth) {
      left = window.innerWidth - infoWidth;
    }

    if (top + infoHeight > window.innerHeight) {
      top = tOffset.top - infoHeight;
    }

    container.style.top = top + 'px';
    container.style.left = left + 'px';
    return ext;
  }

  function destroy() {
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }

  let ext = {
    show,
    hide,
    container,
    body,
    position,
    center,
    destroy
  };

  ext = deepMerge(ext, EventEmitterMixin);
  ext._events = {};

  return ext;
}

export default InfoWindow;
