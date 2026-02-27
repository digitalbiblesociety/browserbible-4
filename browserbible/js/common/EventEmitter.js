/**
 * EventEmitter
 * Simple pub/sub event system for decoupled communication
 */

/**
 * Mixin object providing event methods - mix into any object
 * @type {Object}
 */
export const EventEmitterMixin = {
  /**
   * Subscribe to an event
   * @param {string} eventName - Event name
   * @param {Function} callback - Handler function
   * @returns {this} For chaining
   */
  on(eventName, callback) {
    this._events ??= {};
    this._events[eventName] ??= [];
    this._events[eventName].push(callback);
    return this;
  },

  /**
   * Unsubscribe from an event
   * @param {string} [eventName] - Event name (omit to clear all)
   * @param {Function} [callback] - Specific handler to remove (omit to clear all for event)
   * @returns {this} For chaining
   */
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

  /**
   * Emit an event to all subscribers
   * @param {string} eventName - Event name
   * @param {...*} args - Arguments to pass to handlers
   * @returns {this} For chaining
   */
  trigger(eventName, ...args) {
    const callbacks = this._events?.[eventName];
    if (callbacks) {
      for (const callback of callbacks) {
        callback(...args);
      }
    }
    return this;
  },

  /**
   * Remove all event listeners
   * @returns {this} For chaining
   */
  clearListeners() {
    this._events = {};
    return this;
  }
};

EventEmitterMixin.addEventListener = EventEmitterMixin.on;
EventEmitterMixin.removeEventListener = EventEmitterMixin.off;
EventEmitterMixin.dispatchEvent = EventEmitterMixin.trigger;

/**
 * Create a standalone event emitter instance
 * @returns {Object} New event emitter
 */
export function EventEmitter() {
  return { ...EventEmitterMixin, _events: {} };
}

/**
 * Add event emitter capabilities to an existing object
 * @param {Object} obj - Object to enhance
 * @returns {Object} The enhanced object
 */
export function mixinEventEmitter(obj) {
  return Object.assign(obj, EventEmitterMixin, { _events: {} });
}

export default EventEmitterMixin;
