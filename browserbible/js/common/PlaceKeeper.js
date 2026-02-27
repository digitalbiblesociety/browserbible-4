import { getApp } from '../core/registry.js';

class PlaceKeeperClass {
  constructor() {
    this.currentWindow = null;
    this.currentData = null;
  }

  storePlace() {
    const app = getApp();
    this.currentWindow = app?.windowManager?.getWindows().find(w => w.className === 'BibleWindow') ?? null;
    this.currentData = this.currentWindow?.getData() ?? null;
  }

  getFirstLocation() {
    const app = getApp();
    const window = app?.windowManager?.getWindows().find(w => w.className === 'BibleWindow') ?? null;
    return window?.getData() ?? null;
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

  preservePlace(callback) {
    this.storePlace();
    try {
      callback();
    } finally {
      this.restorePlace();
    }
  }
}

export const PlaceKeeper = new PlaceKeeperClass();
