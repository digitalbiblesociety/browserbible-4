export const EventEmitterMixin = {
  on(eventName, callback) {
    this._events ??= {};
    this._events[eventName] ??= [];
    this._events[eventName].push(callback);
    return this;
  },

  off(eventName, callback) {
    if (!this._events) return this;
    if (!eventName) {
      this._events = {};
      return this;
    }
    if (!callback) {
      delete this._events[eventName];
      return this;
    }
    const callbacks = this._events[eventName];
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) callbacks.splice(index, 1);
    }
    return this;
  },

  trigger(eventName, ...args) {
    const callbacks = this._events?.[eventName];
    if (callbacks) {
      for (const callback of callbacks) {
        callback(...args);
      }
    }
    return this;
  },

  clearListeners() {
    this._events = {};
    return this;
  }
};

EventEmitterMixin.addEventListener = EventEmitterMixin.on;
EventEmitterMixin.removeEventListener = EventEmitterMixin.off;
EventEmitterMixin.dispatchEvent = EventEmitterMixin.trigger;

export function EventEmitter() {
  return { ...EventEmitterMixin, _events: {} };
}

export function mixinEventEmitter(obj) {
  return Object.assign(obj, EventEmitterMixin, { _events: {} });
}

export default EventEmitterMixin;
