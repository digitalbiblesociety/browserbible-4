/**
 * FullScreenButton
 * Fullscreen toggle button
 */

import { createElements, qs } from '../lib/helpers.esm.js';

// Fullscreen API helper
const fullScreenApi = {
  supportsFullScreen: false,
  isFullScreen() { return false; },
  requestFullScreen() {},
  cancelFullScreen() {},
  fullScreenEventName: '',
  prefix: ''
};

// Initialize fullscreen API
const browserPrefixes = ['webkit', 'moz', 'o', 'ms', 'khtml'];

// check for native support
if (typeof document.cancelFullScreen !== 'undefined') {
  fullScreenApi.supportsFullScreen = true;
} else {
  // check for fullscreen support by vendor prefix
  for (const prefix of browserPrefixes) {
    fullScreenApi.prefix = prefix;

    if (typeof document[`${fullScreenApi.prefix}CancelFullScreen`] !== 'undefined') {
      fullScreenApi.supportsFullScreen = true;
      break;
    }
  }
}

// update methods to do something useful
if (fullScreenApi.supportsFullScreen) {
  fullScreenApi.fullScreenEventName = `${fullScreenApi.prefix}fullscreenchange`;

  fullScreenApi.isFullScreen = function() {
    switch (this.prefix) {
      case '':
        return document.fullScreen;
      case 'webkit':
        return document.webkitIsFullScreen;
      default:
        return document[`${this.prefix}FullScreen`];
    }
  };

  fullScreenApi.requestFullScreen = function(el) {
    if (navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
      el.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
    } else {
      return this.prefix === '' ? el.requestFullScreen() : el[`${this.prefix}RequestFullScreen`]();
    }
  };

  fullScreenApi.cancelFullScreen = function() {
    return this.prefix === '' ? document.cancelFullScreen() : document[`${this.prefix}CancelFullScreen`]();
  };
}

// Export for global access
if (typeof window !== 'undefined') {
  window.fullScreenApi = fullScreenApi;
}

/**
 * Create fullscreen button
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {HTMLElement|null} Button element or null if not supported
 */
export function FullScreenButton(_parentNode, _menu) {
  if (!fullScreenApi.supportsFullScreen) {
    return null;
  }

  document.documentElement.classList.add('supports-fullscreen');

  const el = document.body;
  const fullscreenButton = createElements('<div id="main-fullscreen-button"></div>');
  const windowsHeader = qs('.windows-header');

  if (windowsHeader) {
    windowsHeader.appendChild(fullscreenButton);
  }

  const enterFullscreen = () => {
    fullScreenApi.requestFullScreen(el);
  };

  const exitFullscreen = () => {
    fullScreenApi.cancelFullScreen();
  };

  const toggleFullscreen = () => {
    if (fullScreenApi.isFullScreen()) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  };

  fullscreenButton.addEventListener('click', toggleFullscreen, false);

  return fullscreenButton;
}

export { fullScreenApi };
export default FullScreenButton;
