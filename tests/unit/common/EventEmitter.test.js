import { describe, it, expect, vi } from 'vitest';
import {
  EventEmitter,
  EventEmitterMixin,
  mixinEventEmitter
} from '@common/EventEmitter.js';

describe('EventEmitter() factory', () => {
  it('returns an object with on/off/trigger/clearListeners', () => {
    const e = EventEmitter();
    expect(typeof e.on).toBe('function');
    expect(typeof e.off).toBe('function');
    expect(typeof e.trigger).toBe('function');
    expect(typeof e.clearListeners).toBe('function');
  });

  it('triggers a registered listener with args', () => {
    const e = EventEmitter();
    const fn = vi.fn();
    e.on('go', fn);
    e.trigger('go', 1, 2);
    expect(fn).toHaveBeenCalledWith(1, 2);
  });

  it('supports multiple listeners on the same event', () => {
    const e = EventEmitter();
    const a = vi.fn();
    const b = vi.fn();
    e.on('go', a).on('go', b);
    e.trigger('go');
    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('off(name, fn) removes only that listener', () => {
    const e = EventEmitter();
    const a = vi.fn();
    const b = vi.fn();
    e.on('go', a).on('go', b).off('go', a).trigger('go');
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });

  it('off(name) removes all listeners for that event', () => {
    const e = EventEmitter();
    const a = vi.fn();
    e.on('go', a).off('go').trigger('go');
    expect(a).not.toHaveBeenCalled();
  });

  it('off() removes all listeners across all events', () => {
    const e = EventEmitter();
    const a = vi.fn();
    const b = vi.fn();
    e.on('go', a).on('stop', b).off().trigger('go').trigger('stop');
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('clearListeners removes everything', () => {
    const e = EventEmitter();
    const a = vi.fn();
    e.on('go', a).clearListeners().trigger('go');
    expect(a).not.toHaveBeenCalled();
  });

  it('triggering an event with no listeners is a no-op', () => {
    const e = EventEmitter();
    expect(() => e.trigger('nothing')).not.toThrow();
  });

  it('chains on/off/trigger by returning this', () => {
    const e = EventEmitter();
    expect(e.on('go', () => {})).toBe(e);
    expect(e.off('go')).toBe(e);
    expect(e.trigger('go')).toBe(e);
  });
});

describe('EventEmitter aliases', () => {
  it('addEventListener / dispatchEvent / removeEventListener mirror on/trigger/off', () => {
    const e = EventEmitter();
    const fn = vi.fn();
    e.addEventListener('x', fn);
    e.dispatchEvent('x', 'a');
    expect(fn).toHaveBeenCalledWith('a');
    e.removeEventListener('x', fn);
    e.dispatchEvent('x');
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('mixinEventEmitter', () => {
  it('adds emitter methods to an existing object', () => {
    const obj = { name: 'foo' };
    mixinEventEmitter(obj);
    expect(obj.name).toBe('foo');
    const fn = vi.fn();
    obj.on('go', fn).trigger('go', 7);
    expect(fn).toHaveBeenCalledWith(7);
  });

  it('does not share _events between instances', () => {
    const a = mixinEventEmitter({});
    const b = mixinEventEmitter({});
    const fn = vi.fn();
    a.on('go', fn);
    b.trigger('go');
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('EventEmitterMixin default export', () => {
  it('exports the mixin as default', () => {
    expect(EventEmitterMixin.on).toBeTypeOf('function');
  });
});
