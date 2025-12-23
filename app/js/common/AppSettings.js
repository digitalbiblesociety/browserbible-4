/**
 * AppSettings
 * Manages application settings with localStorage persistence
 */

import { getConfig } from '../core/config.js';

class AppSettingsManager {
  constructor() {
    this.storage = this._initStorage();
  }

  _initStorage() {
    try {
      window.localStorage.setItem('1', '2');
      if (window.localStorage.getItem('1') !== '2') {
        return {};
      }
      window.localStorage.removeItem('1');
      return window.localStorage.getItem('1') !== '2' ? window.localStorage : {};
    } catch (_e) {
      return {};
    }
  }

  _getKey(key) {
    const config = getConfig();
    return `${config.settingsPrefix}${key}`;
  }

  getValue(key, defaultValue = {}) {
    const fullKey = this._getKey(key);
    const returnValue = { ...defaultValue };

    let storedValue = this.storage[fullKey];
    if (storedValue == null) {
      return returnValue;
    }

    try {
      storedValue = JSON.parse(storedValue);
    } catch (_ex) {
    }

    return { ...returnValue, ...storedValue };
  }

  setValue(key, value) {
    const fullKey = this._getKey(key);
    this.storage[fullKey] = JSON.stringify(value);
  }

  removeValue(key) {
    const fullKey = this._getKey(key);
    delete this.storage[fullKey];
  }

  getCookieValue(name) {
    const nameEQ = `${name}=`;
    const ca = document.cookie.split(';');
    for (const cookie of ca) {
      const c = cookie.trimStart();
      if (c.startsWith(nameEQ)) {
        return c.substring(nameEQ.length);
      }
    }
    return null;
  }
}

const AppSettings = new AppSettingsManager();

export { AppSettings };
export default AppSettings;
