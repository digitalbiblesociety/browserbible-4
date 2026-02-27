import { mixinEventEmitter } from './EventEmitter.js';
import { getApp } from '../core/registry.js';

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

    const index = this.locations.lastIndexOf(locationid);
    let type = '';

    if (index !== -1 && index < this.locationIndex) {
      this.locationIndex = index;
      type = 'back';
    } else if (index !== -1 && index > this.locationIndex) {
      this.locationIndex = index;
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
    this.locations = this.locations.slice(0, this.locationIndex + 1);
    this.locations.push(locationid);
    this.locationIndex = this.locations.length - 1;
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

  back() {
    window.history.go(-1);
  }

  forward() {
    window.history.go(1);
  }

  getLocations() {
    return this.locations;
  }

  getLocationIndex() {
    return this.locationIndex;
  }
}

export const TextNavigation = new TextNavigationClass();
