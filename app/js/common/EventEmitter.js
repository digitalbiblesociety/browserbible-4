/**
 * EventEmitter
 * Provides event handling functionality
 */

export class EventEmitter {
  constructor() {
    this.events = {};
  }

  addEventListener(eventName, callback) {
    this.events[eventName] ??= [];
    this.events[eventName].push(callback);
    return this;
  }

  removeEventListener(eventName, callback) {
    if (!eventName) {
      this.events = {};
      return true;
    }

    const callbacks = this.events[eventName];
    if (!callbacks) return true;

    if (!callback) {
      this.events[eventName] = [];
      return true;
    }

    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      this.events[eventName].splice(index, 1);
      return true;
    }
    return false;
  }

  dispatchEvent(eventName, ...args) {
    const callbacks = this.events[eventName];
    if (callbacks) {
      for (const callback of callbacks) {
        callback(...args);
      }
    }
    return this;
  }

  clearListeners() {
    this.events = {};
    return this;
  }

  on(eventName, callback) {
    return this.addEventListener(eventName, callback);
  }

  off(eventName, callback) {
    return this.removeEventListener(eventName, callback);
  }

  trigger(eventName, value) {
    return this.dispatchEvent(eventName, value);
  }

  emit(eventName, ...args) {
    return this.dispatchEvent(eventName, ...args);
  }
}

export const mixinEventEmitter = (obj) => {
  const emitter = new EventEmitter();

  obj.events = emitter.events;
  obj.addEventListener = emitter.addEventListener.bind(emitter);
  obj.removeEventListener = emitter.removeEventListener.bind(emitter);
  obj.dispatchEvent = emitter.dispatchEvent.bind(emitter);
  obj.clearListeners = emitter.clearListeners.bind(emitter);
  obj.on = emitter.on.bind(emitter);
  obj.off = emitter.off.bind(emitter);
  obj.trigger = emitter.trigger.bind(emitter);
  obj.emit = emitter.emit.bind(emitter);

  return obj;
};

export const EventEmitterMixin = {
  events: {},

  addEventListener(eventName, callback) {
    this.events ??= {};
    this.events[eventName] ??= [];
    this.events[eventName].push(callback);
  },

  removeEventListener(eventName, callback) {
    this.events ??= {};
    if (!eventName) {
      this.events = {};
      return true;
    }
    const callbacks = this.events[eventName];
    if (!callbacks) return true;
    if (!callback) {
      this.events[eventName] = [];
      return true;
    }
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      this.events[eventName].splice(index, 1);
      return true;
    }
    return false;
  },

  dispatchEvent(eventName, ...args) {
    this.events ??= {};
    const callbacks = this.events[eventName];
    if (callbacks) {
      for (const callback of callbacks) {
        callback(...args);
      }
    }
  },

  clearListeners() {
    this.events = {};
  },

  on(eventName, callback) {
    this.addEventListener(eventName, callback);
  },

  off(eventName, callback) {
    this.removeEventListener(eventName, callback);
  },

  trigger(eventName, value) {
    this.dispatchEvent(eventName, value);
  }
};

export default EventEmitter;
