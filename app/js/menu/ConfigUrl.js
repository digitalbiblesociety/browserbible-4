/**
 * ConfigUrl
 * URL copier for sharing current view
 */

import { elem } from '../lib/helpers.esm.js';
import { getConfig } from '../core/config.js';
import { getWindowType, getApp } from '../core/registry.js';

// URL parameter prefixes that are managed per-window and should be excluded from merging
const WINDOW_PARAM_PREFIXES = ['win', 'textid', 'searchtext', 'fragmentid'];

/**
 * Build shareable URL from current window settings
 * @returns {string} The shareable URL
 */
function buildShareableUrl() {
  const app = getApp();
  if (!app?.windowManager) return '';

  const windowSettings = app.windowManager.getSettings();
  const existingParams = Object.fromEntries(new URLSearchParams(window.location.search));
  const newParams = {};

  // Collect params from all windows
  windowSettings.forEach((winSettings, index) => {
    if (!winSettings.data?.params) return;

    const winTypeName = winSettings.data.params.win;
    const winTypeInfo = getWindowType(winTypeName);
    if (!winTypeInfo) return;

    for (const [paramName, paramData] of Object.entries(winSettings.data.params)) {
      const paramShort = paramName === 'win' ? 'w' : winTypeInfo.paramKeys[paramName];
      if (paramShort) {
        newParams[`${paramShort}${index + 1}`] = paramData;
      }
    }
  });

  // Keep existing params that aren't window-specific
  const mergedParams = {};
  for (const [param, value] of Object.entries(existingParams)) {
    const isWindowParam = WINDOW_PARAM_PREFIXES.some(prefix => param.startsWith(prefix));
    if (param && !isWindowParam) {
      mergedParams[param] = value;
    }
  }

  // Merge in new window params
  Object.assign(mergedParams, newParams);

  // Build query string
  const queryString = Object.entries(mergedParams)
    .filter(([param]) => param)
    .map(([param, value]) => `${param}=${encodeURIComponent(value)}`)
    .join('&');

  return `${location.protocol}//${location.host}${location.pathname}?${queryString}`;
}

/**
 * Copy text to clipboard with visual feedback
 * @param {string} text - Text to copy
 * @param {HTMLElement} feedbackElement - Element to show feedback on
 */
function copyToClipboard(text, feedbackElement) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      feedbackElement.classList.add('copied');
      setTimeout(() => feedbackElement.classList.remove('copied'), 500);
    }).catch(() => {
      feedbackElement.select?.();
    });
  } else {
    feedbackElement.select?.();
  }
}

/**
 * Create URL copier component
 * @returns {void}
 */
export function ConfigUrl() {
  const config = getConfig();

  if (!config.enableUrlCopier || location.protocol === 'file:') {
    return;
  }

  const body = document.querySelector('#main-menu-features');
  const linkButton = elem('span', { className: 'url-copy-button' });
  const urlInput = elem('input', {type: 'text', id: 'config-global-url-input', readOnly: true});
  const urlBox = elem('div', { id: 'config-global-url' });
  urlBox.append(linkButton, urlInput);

  if (body) {
    body.after(urlBox);
  }

  const updateUrl = () => {
    urlInput.value = buildShareableUrl();
  };

  const handleCopyClick = () => {
    updateUrl();
    copyToClipboard(urlInput.value, urlInput);
  };

  // Debounced settings change handler
  let debounceId = null;
  setTimeout(() => {
    const app = getApp();
    app?.windowManager?.on('settingschange', () => {
      if (debounceId === null) {
        debounceId = setTimeout(() => {
          updateUrl();
          debounceId = null;
        }, 500);
      }
    });
    updateUrl();
  }, 1000);

  urlInput.addEventListener('click', handleCopyClick);
  linkButton.addEventListener('click', handleCopyClick);
}
