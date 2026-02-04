/**
 * Navigation
 * Browser history integration and scroll position preservation
 */

import { mixinEventEmitter } from './EventEmitter.js';
import { getApp } from '../core/registry.js';

/**
 * Preserves scroll position during resize by storing and restoring the current location
 */
class PlaceKeeperClass {
  constructor() {
    this.currentWindow = null;
    this.currentData = null;
  }

  /**
   * Store current scroll position before resize
   */
  storePlace() {
    this.currentData = this.getFirstLocation();
  }

  getFirstLocation() {
    const app = getApp();
    this.currentWindow = app?.windowManager?.getWindows().find(w => w.className === 'BibleWindow') ?? null;
    return this.currentWindow?.getData() ?? null;
  }

  /**
   * Restore scroll position after resize
   */
  restorePlace() {
    this.currentWindow?.trigger('globalmessage', {
      type: 'globalmessage',
      target: this.currentWindow,
      data: {
        messagetype: 'nav',
        type: 'bible',
        locationInfo: this.currentData
      }
    });
  }
}

export const PlaceKeeper = new PlaceKeeperClass();

/**
 * Manages browser history for Bible navigation with back/forward support
 * @fires locationchange When navigation occurs
 */
class TextNavigationClass {
  constructor() {
    this.locations = [];
    this.locationIndex = -1;

    mixinEventEmitter(this);

    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', this._handleBrowserNavigation.bind(this));
    }
  }

  _handleBrowserNavigation(e) {
    const locationid = e.state?.locationid;
    if (locationid === undefined) return;

    let type = '';
    if (this.locationIndex > 0 && this.locations[this.locationIndex - 1] === locationid) {
      this.locationIndex--;
      type = 'back';
    } else if (this.locationIndex < this.locations.length - 1 && this.locations[this.locationIndex + 1] === locationid) {
      this.locationIndex++;
      type = 'forward';
    }

    this._setLocation(locationid);
    this.trigger('locationchange', { type });
  }

  /**
   * Set initial location on page load (uses replaceState)
   * @param {string} locationid - Initial location ID
   */
  firstState(locationid) {
    this.locations.push(locationid);
    this.locationIndex = 0;
    window.history.replaceState({ locationid }, null, window.location.href);
  }

  /**
   * Navigate to a new location (adds to history)
   * @param {string} locationid - Location ID (e.g., "JN3" or "JN3_16")
   * @param {string} type - Navigation type
   */
  locationChange(locationid, type) {
    this.locations.push(locationid);
    this.locationIndex++;
    window.history.pushState({ locationid }, null, window.location.href);
    this.trigger('locationchange', { type });
  }

  _setLocation(locationid) {
    const fragmentid = locationid.includes('_') ? locationid : `${locationid}_1`;
    getApp()?.handleGlobalMessage({
      type: 'globalmessage',
      target: this,
      data: {
        messagetype: 'nav',
        type: 'bible',
        locationInfo: {
          fragmentid,
          sectionid: fragmentid.split('_')[0],
          offset: 0
        }
      }
    });
  }

  /** Navigate back in history */
  back() {
    window.history.go(-1);
  }

  /** Navigate forward in history */
  forward() {
    window.history.go(1);
  }

  /** @returns {string[]} All stored locations */
  getLocations() {
    return this.locations;
  }

  /** @returns {number} Current position in history */
  getLocationIndex() {
    return this.locationIndex;
  }
}

export const TextNavigation = new TextNavigationClass();

export default { PlaceKeeper, TextNavigation };
