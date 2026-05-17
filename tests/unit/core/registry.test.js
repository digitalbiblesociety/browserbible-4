import { describe, it, expect, vi } from 'vitest';
import * as registry from '@core/registry.js';

// Note: registry maintains module-level state. Tests use unique names so they
// don't collide with each other or with main.js bootstrap (which only runs in
// the app, not in unit tests).

describe('plugins', () => {
  it('registerPlugin + getPlugin round-trips', () => {
    const Plugin = () => {};
    registry.registerPlugin('test:plugin:a', Plugin);
    expect(registry.getPlugin('test:plugin:a')).toBe(Plugin);
  });

  it('getAllPlugins includes registered entries', () => {
    const Plugin = () => {};
    registry.registerPlugin('test:plugin:b', Plugin);
    const all = registry.getAllPlugins();
    expect(all.find(([name]) => name === 'test:plugin:b')[1]).toBe(Plugin);
  });

  it('addPluginInstance / getPluginInstances round-trips', () => {
    const before = registry.getPluginInstances().length;
    const inst = { name: 'inst:test:1' };
    registry.addPluginInstance(inst);
    const after = registry.getPluginInstances();
    expect(after).toHaveLength(before + 1);
    expect(after).toContain(inst);
  });
});

describe('window types', () => {
  it('registerWindowType + getWindowType round-trips by param', () => {
    const WindowClass = () => {};
    registry.registerWindowType({
      param: 'test:wt:a',
      className: 'TestWindowA',
      WindowClass,
      displayName: 'Test A'
    });
    const wt = registry.getWindowType('test:wt:a');
    expect(wt).toMatchObject({
      param: 'test:wt:a',
      className: 'TestWindowA',
      WindowClass,
      displayName: 'Test A'
    });
    expect(wt.paramKeys).toEqual({});
  });

  it('paramKeys defaults to {} when omitted', () => {
    registry.registerWindowType({
      param: 'test:wt:b',
      className: 'TestWindowB',
      WindowClass: () => {}
    });
    expect(registry.getWindowType('test:wt:b').paramKeys).toEqual({});
  });

  it('getWindowTypeByClassName looks up by className', () => {
    registry.registerWindowType({
      param: 'test:wt:c',
      className: 'TestWindowC',
      WindowClass: () => {}
    });
    expect(registry.getWindowTypeByClassName('TestWindowC').param).toBe('test:wt:c');
  });

  it('getWindowTypeByClassName returns null when not found', () => {
    expect(registry.getWindowTypeByClassName('NoSuchWindow')).toBeNull();
  });

  it('registering with same param overwrites', () => {
    const A = () => {};
    const B = () => {};
    registry.registerWindowType({ param: 'test:wt:dup', className: 'X', WindowClass: A });
    registry.registerWindowType({ param: 'test:wt:dup', className: 'Y', WindowClass: B });
    expect(registry.getWindowType('test:wt:dup').WindowClass).toBe(B);
  });
});

describe('text providers', () => {
  it('registerTextProvider + getTextProvider round-trips', () => {
    const provider = { load: () => null };
    registry.registerTextProvider('test:provider:a', provider);
    expect(registry.getTextProvider('test:provider:a')).toBe(provider);
  });
});

describe('menu components', () => {
  it('registerMenuComponent + getMenuComponent round-trips', () => {
    const C = () => {};
    registry.registerMenuComponent('test:menu:a', C);
    expect(registry.getMenuComponent('test:menu:a')).toBe(C);
  });
});

describe('audio sources', () => {
  it('registerAudioSource appends to the list', () => {
    const before = registry.getAudioSources().length;
    const source = { id: 'test:audio:a' };
    registry.registerAudioSource(source);
    expect(registry.getAudioSources()).toContain(source);
    expect(registry.getAudioSources()).toHaveLength(before + 1);
  });
});

describe('init methods', () => {
  it('registerInitMethod + runInitMethods invokes registered fns', () => {
    const fn = vi.fn();
    registry.registerInitMethod(fn);
    registry.runInitMethods();
    expect(fn).toHaveBeenCalled();
  });

  it('getInitMethods returns the underlying array', () => {
    const fn = () => {};
    registry.registerInitMethod(fn);
    expect(registry.getInitMethods()).toContain(fn);
  });
});

describe('globals', () => {
  it('setGlobal + getGlobal round-trips', () => {
    registry.setGlobal('test:g:a', 42);
    expect(registry.getGlobal('test:g:a')).toBe(42);
  });

  it('getGlobals returns a live object including registered keys', () => {
    registry.setGlobal('test:g:b', 'value');
    expect(registry.getGlobals()['test:g:b']).toBe('value');
  });
});

describe('resources', () => {
  it('registerResource + getResource round-trips by language', () => {
    const data = { translation: { hi: 'hello' } };
    registry.registerResource('test-lang', data);
    expect(registry.getResource('test-lang')).toBe(data);
    expect(registry.getAllResources()['test-lang']).toBe(data);
  });
});

describe('app instance', () => {
  it('setApp + getApp round-trips', () => {
    const app = { name: 'fakeApp' };
    registry.setApp(app);
    expect(registry.getApp()).toBe(app);
  });
});

describe('default export', () => {
  it('exposes the documented surface', () => {
    expect(registry.default.VERSION).toBe(registry.VERSION);
    expect(registry.default.registerPlugin).toBe(registry.registerPlugin);
    expect(registry.default.setApp).toBe(registry.setApp);
  });
});
