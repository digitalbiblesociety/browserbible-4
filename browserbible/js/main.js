/**
 * BrowserBible v4 - Main Entry Point
 * ES6 Module-based architecture
 */

// ============================================
// Core Library Imports
// ============================================
import helpers from './lib/helpers.esm.js';
import { i18n } from './lib/i18n.js';

// ============================================
// Core Module Imports
// ============================================
import config, { getConfig, updateConfig, getCustomConfig } from './core/config.js';
import registry, {
  registerPlugin,
  registerWindowType,
  registerMenuComponent,
  registerTextProvider,
  registerResource,
  runInitMethods,
  getApp,
  VERSION
} from './core/registry.js';

// ============================================
// Common Module Imports
// ============================================
import { EventEmitter, mixinEventEmitter, EventEmitterMixin } from './common/EventEmitter.js';
import AppSettings from './common/AppSettings.js';
import { PlaceKeeper } from './common/PlaceKeeper.js';
import { TextNavigation } from './common/TextNavigation.js';

// ============================================
// App Module Imports
// ============================================
import { App } from './core/App.js';
import { WindowManager } from './core/WindowManager.js';
import { MainMenu } from './menu/MainMenu.js';

// ============================================
// Resource Imports (i18n)
// ============================================
import './resources/index.js';

// ============================================
// Bible Data Imports
// ============================================
import './bible/index.js';

// ============================================
// Text Loading Imports
// ============================================
import './texts/index.js';

// ============================================
// Media Imports
// ============================================
import './media/index.js';

// ============================================
// UI Component Imports
// ============================================
import './ui/index.js';

// ============================================
// Plugin Imports
// ============================================
import './plugins/index.js';

// ============================================
// Window Type Imports
// ============================================
import './windows/index.js';

// ============================================
// Menu Component Imports
// ============================================
import './menu/index.js';

// ============================================
// Startup
// ============================================

async function startup() {
  // Hide initial text area
  const startupEl = document.getElementById('startup');
  if (startupEl) {
    startupEl.style.display = 'none';
  }

  // Test for local file support
  if (window.location.protocol === 'file:') {
    fetch('about.html')
      .then(() => init())
      .catch(e => {
        showLocalFileError(e);
      });
  } else {
    init();
  }
}

function showLocalFileError(e) {
  // Import MovableWindow dynamically for error display
  const modal = document.createElement('div');
  modal.className = 'local-file-error';
  modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#000;color:#fff;padding:20px;max-width:500px;z-index:var(--z-top);';

  const ua = navigator.userAgent.toLowerCase();
  let errorMessage = '';

  if (ua.indexOf('chrome') > -1) {
    if (ua.indexOf('mac os') > -1) {
      errorMessage =
        '<p>Mac, Terminal</p>' +
        '<code>/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --allow-file-access-from-files</code>';
    } else if (ua.indexOf('windows') > -1) {
      errorMessage =
        '<p>Windows, Command Prompt</p>' +
        '<code>chrome.exe --allow-file-access-from-files</code>';
    }
  } else {
    errorMessage = '<p>Unknown error loading files (cannot load about.html): ' + e + '</p>';
  }

  modal.innerHTML = '<h3>Local Files Error</h3>' + errorMessage;
  document.body.appendChild(modal);
}

async function init() {
  const cfg = getConfig();

  // Load config from querystring
  const params = Object.fromEntries(new URLSearchParams(window.location.search));
  const custom = params['custom'];

  if (custom) {
    const customizations = getCustomConfig(custom);
    if (customizations) {
      updateConfig(customizations);
    }
  }

  // Load custom CSS
  const finalConfig = getConfig();
  if (finalConfig.customCssUrl) {
    const link = document.createElement('link');
    link.href = finalConfig.customCssUrl;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  // Check for iOS app mode
  const isiOSApp = (navigator.userAgent.toLowerCase().indexOf('ipad') > -1 ||
    navigator.userAgent.toLowerCase().indexOf('iphone') > -1) &&
    window.location.protocol === 'file:';

  if (window.navigator.standalone === true || isiOSApp) {
    document.body.classList.add('app-mobile-fullscreen');
  }

  // Run init methods
  runInitMethods();

  // Create and initialize app
  const app = new App();

  // Initialize i18n (lazy loads language resources)
  let lngSetting = '';
  const i18nCookieValue = AppSettings.getCookieValue('i18next');

  if ((i18nCookieValue === '' || i18nCookieValue === null) && cfg.defaultLanguage !== '') {
    lngSetting = cfg.defaultLanguage;
  }

  await i18n.init({
    fallbackLng: 'en',
    lng: lngSetting
  });

  app.init();

  // Translate page
  i18n.translatePage();

  // Update language selector
  setTimeout(() => {
    const lang = i18n.lng();
    const langSelector = document.getElementById('config-language');

    if (langSelector) {
      langSelector.value = lang;

      if (lang !== langSelector.value) {
        langSelector.value = lang.split('-')[0];
      }

      if (langSelector.localizeLanguages) {
        langSelector.localizeLanguages();
      }
    }
  }, 50);
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startup);
} else {
  startup();
}

// ============================================
// Export for global access (development/debugging)
// ============================================
export {
  // Version
  VERSION,
  // Core
  config,
  registry,
  App,
  WindowManager,
  MainMenu,
  // Helpers
  helpers,
  // Common
  EventEmitter,
  EventEmitterMixin,
  mixinEventEmitter,
  AppSettings,
  PlaceKeeper,
  TextNavigation,
  // i18n
  i18n,
  // Registry functions
  registerPlugin,
  registerWindowType,
  registerMenuComponent,
  registerTextProvider,
  registerResource,
  getApp
};

// For debugging in console
if (typeof window !== 'undefined') {
  window.BrowserBible = {
    VERSION,
    config: getConfig,
    registry,
    getApp,
    helpers,
    i18n
  };
}
