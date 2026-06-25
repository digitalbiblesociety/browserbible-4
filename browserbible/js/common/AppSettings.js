/**
 * AppSettings
 * Persistent key-value storage using localStorage with prefix namespacing
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

  /**
   * Get a stored value, merged with defaults
   * @param {string} key - Storage key
   * @param {Object} [defaultValue={}] - Default values
   * @returns {Object} Stored value merged with defaults
   */
  getValue(key, defaultValue = {}) {
    const fullKey = this._getKey(key);
    const returnValue = { ...defaultValue };

    let storedValue = this.storage[fullKey];
    if (storedValue == null) {
      return returnValue;
    }

    try {
      storedValue = JSON.parse(storedValue);
    } catch {
      return returnValue;
    }

    return { ...returnValue, ...storedValue };
  }

  /**
   * Store a value
   * @param {string} key - Storage key
   * @param {*} value - Value to store (will be JSON stringified)
   */
  setValue(key, value) {
    const fullKey = this._getKey(key);
    this.storage[fullKey] = JSON.stringify(value);
  }

  /**
   * Remove a stored value
   * @param {string} key - Storage key
   */
  removeValue(key) {
    const fullKey = this._getKey(key);
    delete this.storage[fullKey];
  }
}

const AppSettings = new AppSettingsManager();

export { AppSettings };
export default AppSettings;
