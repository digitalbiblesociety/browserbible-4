import { mixinEventEmitter } from './EventEmitter.js';
import { getApp } from '../core/registry.js';

class PlaceKeeperClass {
  constructor() {
    this.currentWindow = null;
    this.currentData = null;
  }

  storePlace() {
    this.currentData = this.getFirstLocation();
  }

  getFirstLocation() {
    const app = getApp();
    this.currentWindow = app?.windowManager?.getWindows().find(w => w.className === 'BibleWindow') ?? null;

    return this.currentWindow?.getData() ?? null;
  }

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

  firstState(locationid) {
    this.locations.push(locationid);
    this.locationIndex = 0;

    window.history.replaceState({ locationid }, null, window.location.href);
  }

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

export default { PlaceKeeper, TextNavigation };
