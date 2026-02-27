/**
 * App - Main application controller
 * Manages windows, plugins, and global state
 */

import { WindowManager } from './WindowManager.js';
import { MainMenu } from '../menu/MainMenu.js';
import AppSettings from '../common/AppSettings.js';
import { elem } from '../lib/helpers.esm.js';
import { getConfig, updateConfig, getCustomConfig } from './config.js';
import {
  setApp,
  getWindowType,
  getAllWindowTypes,
  getAllPlugins,
  addPluginInstance
} from './registry.js';
import { TextNavigation } from '../common/TextNavigation.js';
import { PlaceKeeper } from '../common/PlaceKeeper.js';
import { i18n } from '../lib/i18n.js';

/**
 * Main application class
 * @class
 */
export class App {
  constructor() {
    this.settingsKey = 'app-windows';
    this.windowManager = null;
    this.mainMenu = null;
    this.plugins = [];

    this.container = elem('div', { className: 'windows-container' });
    this.header = elem('div', { className: 'windows-header' });
    this.main = elem('div', { className: 'windows-main' });
    this.footer = elem('div', { className: 'windows-footer' });

    document.body.appendChild(this.container);
    this.container.appendChild(this.header);
    this.container.appendChild(this.main);
    this.container.appendChild(this.footer);

    setApp(this);
  }

  /**
   * Initialize the application - creates windows, plugins, and event handlers
   */
  init() {
    this.mainMenu = new MainMenu(this.header);
    this.windowManager = new WindowManager(this.main, this);

    window.addEventListener('resize', this.resize.bind(this));
    window.addEventListener('orientationchange', this.resize.bind(this));
    this.resize();

    try {
      window.top.scrollTo(0, 1);
    } catch (_ex) {
      // cross-origin iframe
    }

    const settings = this._getWindowSettings();

    for (const setting of settings.windows) {
      let windowClassName = setting.windowType;

      if (!windowClassName) {
        const param = setting.type;
        const windowType = getWindowType(param);
        if (windowType) {
          windowClassName = windowType.className;
        }
      }

      if (windowClassName) {
        this.windowManager.add(windowClassName, setting.data);
      }
    }

    document.querySelectorAll('.window, .window-tab').forEach(el => {
      el.classList.remove('active');
    });
    const firstWindow = document.querySelector('.window');
    const firstTab = document.querySelector('.window-tab');
    firstWindow?.classList.add('active');
    firstTab?.classList.add('active');

    const bibleWindows = settings.windows.filter(s => s.windowType === 'BibleWindow');
    const firstBibleWindow = bibleWindows[0] ?? null;
    const firstFragmentid = firstBibleWindow?.data?.fragmentid ?? null;

    if (firstFragmentid && TextNavigation) {
      TextNavigation.firstState(firstFragmentid);
    }

    let settingsTimeoutId = null;

    this.windowManager.on('settingschange', (e) => {
      if (e.data?.label && e.data.hasFocus) {
        document.title = e.data.labelLong;
      }
      if (settingsTimeoutId === null) {
        settingsTimeoutId = setTimeout(() => {
          this._storeSettings();
          settingsTimeoutId = null;
        }, 1000);
      }
    });

    this._initPlugins();
  }

  _initPlugins() {
    const allPlugins = getAllPlugins();

    for (const [name, PluginFactory] of allPlugins) {
      try {
        const plugin = PluginFactory(this);
        this.plugins.push(plugin);
        addPluginInstance(plugin);

        if (plugin.on) {
          plugin.on('globalmessage', this.handleGlobalMessage.bind(this));
        }
      } catch (e) {
        console.error(`Failed to initialize plugin "${name}":`, e);
      }
    }
  }

  /**
   * Handle window resize and orientation changes
   */
  resize() {
    PlaceKeeper.preservePlace(() => {
      if (this.windowManager?.getWindows().length === 1) {
        document.body.classList.add('one-window');
      } else {
        document.body.classList.remove('one-window');
      }

      const width = window.innerWidth;
      const height = window.innerHeight;

      const mainStyle = window.getComputedStyle(this.main);
      const areaHeight = height - this.header.offsetHeight + this.footer.offsetHeight;
      const areaWidth = width - parseInt(mainStyle.marginLeft, 10) - parseInt(mainStyle.marginRight, 10);

      this.main.style.height = `${areaHeight}px`;
      this.main.style.width = `${areaWidth}px`;

      this.windowManager?.size(areaWidth, areaHeight);
    });
  }

  _getWindowSettings() {
    const config = getConfig();
    let settings = { windows: config.windows };
    settings = AppSettings.getValue(this.settingsKey, settings);

    const queryData = Object.fromEntries(new URLSearchParams(window.location.search));
    if (!queryData.w1) return settings;

    const allWindowTypes = getAllWindowTypes();
    const tempSettings = [];

    for (let i = 1; i <= 4; i++) {
      const winTypeName = queryData[`w${i}`];
      if (!winTypeName) continue;

      const winTypeInfo = allWindowTypes.find(wt => wt.param === winTypeName);
      const paramKeys = winTypeInfo?.paramKeys ?? {};
      const setting = { type: winTypeName, data: {} };

      const suffix = i.toString();
      for (const [q, value] of Object.entries(queryData)) {
        if (!q.endsWith(suffix) || q === `w${i}`) continue;
        const key = q.slice(0, -1);
        const longKey = Object.keys(paramKeys).find(k => key === (paramKeys[k] ?? k) || key === k) ?? key;
        setting.data[longKey] = value;
      }

      tempSettings.push(setting);
    }

    if (tempSettings.length > 0) settings.windows = tempSettings;
    return settings;
  }

  _storeSettings() {
    const windowSettings = this.windowManager.getSettings();
    const settings = { windows: windowSettings };

    AppSettings.setValue(this.settingsKey, settings);
  }

  /**
   * Broadcast a message to all windows and plugins
   * @param {Object} e - Event object with id and data
   */
  handleGlobalMessage(e) {
    const windows = this.windowManager.getWindows();

    for (const win of windows) {
      if (win.id !== e.id) {
        win.trigger('message', e);
      }
    }

    for (const plugin of this.plugins) {
      if (plugin.trigger) {
        plugin.trigger('message', e);
      }
    }
  }
}

/**
 * Initialize and start the application
 * Handles custom configs, i18n setup, and CSS loading
 * @returns {Promise<App>} The initialized app instance
 */
export async function initApp() {
  const config = getConfig();

  const params = Object.fromEntries(new URLSearchParams(window.location.search));
  const custom = params.custom;

  if (custom) {
    const customizations = getCustomConfig(custom);
    if (customizations) {
      updateConfig(customizations);
    }
  }

  const finalConfig = getConfig();
  if (finalConfig.customCssUrl) {
    const link = document.createElement('link');
    link.href = finalConfig.customCssUrl;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const isiOSApp = (userAgent.includes('ipad') || userAgent.includes('iphone')) &&
    window.location.protocol === 'file:';

  if (window.navigator.standalone === true || isiOSApp) {
    document.body.classList.add('app-mobile-fullscreen');
  }

  const app = new App();

  let lngSetting = '';
  const i18nCookieValue = AppSettings.getCookieValue('i18next');

  if ((i18nCookieValue === '' || i18nCookieValue === null) && config.defaultLanguage !== '') {
    lngSetting = config.defaultLanguage;
  }

  await i18n.init({
    fallbackLng: 'en',
    lng: lngSetting
  });

  app.init();

  i18n.translatePage();

  setTimeout(() => {
    const lang = i18n.lng();
    const langSelector = document.getElementById('config-language');

    if (langSelector) {
      langSelector.value = lang;

      if (lang !== langSelector.value) {
        langSelector.value = lang.split('-')[0];
      }

      langSelector.localizeLanguages?.();
    }
  }, 50);

  return app;
}

export default App;
