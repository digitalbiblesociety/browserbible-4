/**
 * ConfigUrl
 * URL copier for sharing current view
 */

import { createElements } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import { getWindowType, getApp } from '../core/registry.js';

/**
 * Create URL copier component
 * @param {HTMLElement} parentNode - Parent container
 * @param {Object} menu - Menu instance
 * @returns {void}
 */
export function ConfigUrl(_parentNode, _menu) {
  const config = getConfig();

  if (!config.enableUrlCopier || location.protocol === 'file:') {
    return;
  }

  const body = document.querySelector('#main-menu-features');
  const urlBox = createElements(
    `<div id="config-global-url">` +
      `<span class="url-copy-button"></span>` +
      `<input type="text" id="config-global-url-input" readonly placeholder="Click to copy shareable URL" />` +
    `</div>`);
  const linkButton = urlBox.querySelector('span');
  const urlInput = urlBox.querySelector('input');
  const urlDiv = urlBox.querySelector('div');

  if (body) {
    body.after(urlBox);
  }

  /**
   * Update URL based on current window settings
   */
  const updateUrl = () => {
    const app = getApp();
    if (!app?.windowManager) return;

    // get settings from all windows
    const windowSettings = app.windowManager.getSettings();
    const existingParams = Object.fromEntries(new URLSearchParams(window.location.search));
    let newParams = {};
    let mergedParams = {};
    const mergedArray = [];

    windowSettings.forEach((winSettings, index) => {
      // get window settings
      if (winSettings.data === null || typeof winSettings.data?.params === 'undefined') {
        return;
      }

      // get window type info from registry
      const winTypeName = winSettings.data.params.win;
      const winTypeInfo = getWindowType(winTypeName);

      if (!winTypeInfo) {
        return;
      }

      // go through the params object
      for (const paramName in winSettings.data.params) {
        const paramData = winSettings.data.params[paramName];
        const paramShort = paramName === 'win' ? 'w' : winTypeInfo.paramKeys[paramName];
        if (paramShort) {
          newParams[`${paramShort}${index + 1}`] = paramData;
        }
      }
    });

    // keep all parameters that aren't windowed ones
    for (const param in existingParams) {
      if (param !== '' && !param.startsWith('win') && !param.startsWith('textid') && !param.startsWith('searchtext') && !param.startsWith('fragmentid')) {
        mergedParams[param] = existingParams[param];
      }
    }

    mergedParams = { ...mergedParams, ...newParams };

    for (const param in mergedParams) {
      if (param !== '') {
        mergedArray.push(`${param}=${encodeURIComponent(mergedParams[param])}`);
      }
    }

    const url = `${location.protocol}//${location.host}${location.pathname}?${mergedArray.join('&')}`;

    urlInput.value = url;
    if (urlDiv) {
      urlDiv.innerHTML = url;
    }
  };

  /**
   * Copy text to clipboard using modern Clipboard API
   * @param {string} text - Text to copy
   */
  const copyToClipboard = (text) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        // Visual feedback - briefly highlight the input
        urlInput.classList.add('copied');
        setTimeout(() => {
          urlInput.classList.remove('copied');
        }, 500);
      }).catch((err) => {
        console.warn('Clipboard write failed:', err);
        // Fallback: select text for manual copy
        urlInput.select();
      });
    } else {
      // Fallback for older browsers: select text for manual copy
      urlInput.select();
    }
  };

  let urlTimeoutId = null;

  setTimeout(() => {
    const app = getApp();
    if (app?.windowManager) {
      app.windowManager.on('settingschange', () => {
        // Debounce URL updates
        if (urlTimeoutId === null) {
          urlTimeoutId = setTimeout(() => {
            updateUrl();
            urlTimeoutId = null;
          }, 500);
        }
      });
    }

    updateUrl();
  }, 1000);

  urlInput.addEventListener('click', () => {
    updateUrl();
    copyToClipboard(urlInput.value);
  }, false);

  linkButton.addEventListener('click', () => {
    updateUrl();
    copyToClipboard(urlInput.value);
  }, false);
}

export default ConfigUrl;
