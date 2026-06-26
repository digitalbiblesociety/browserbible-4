import { describe, it, expect, vi } from 'vitest';
import {
  extend,
  closest,
  siblings,
  elem,
  insertAfter,
  on,
  data
} from '@lib/helpers.esm.js';

describe('extend', () => {
  it('merges sources into target shallowly', () => {
    const t = { a: 1 };
    const result = extend(t, { b: 2 }, { c: 3 });
    expect(result).toBe(t);
    expect(t).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('later sources overwrite earlier ones', () => {
    expect(extend({}, { a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });

  it('skips falsy sources', () => {
    expect(extend({ a: 1 }, null, undefined, { b: 2 })).toEqual({ a: 1, b: 2 });
  });
});

describe('closest', () => {
  it('returns the matching ancestor', () => {
    document.body.innerHTML = '<div class="outer"><div class="inner"><span id="leaf"></span></div></div>';
    const leaf = document.getElementById('leaf');
    expect(closest(leaf, '.outer')).toBe(document.querySelector('.outer'));
  });

  it('returns the element itself when it matches', () => {
    document.body.innerHTML = '<div id="me" class="m"></div>';
    const el = document.getElementById('me');
    expect(closest(el, '.m')).toBe(el);
  });

  it('returns null when no ancestor matches', () => {
    document.body.innerHTML = '<div><span id="leaf"></span></div>';
    expect(closest(document.getElementById('leaf'), '.nope')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(closest(null, '.x')).toBeNull();
  });
});

describe('siblings', () => {
  it('returns sibling elements (excludes self)', () => {
    document.body.innerHTML = '<ul><li id="a"></li><li id="b"></li><li id="c"></li></ul>';
    const b = document.getElementById('b');
    const sibs = siblings(b);
    expect(sibs.map(s => s.id)).toEqual(['a', 'c']);
  });

  it('filters siblings by selector', () => {
    document.body.innerHTML = '<ul><li id="a" class="match"></li><li id="b"></li><li id="c" class="match"></li></ul>';
    const b = document.getElementById('b');
    const sibs = siblings(b, '.match');
    expect(sibs.map(s => s.id)).toEqual(['a', 'c']);
  });

  it('returns [] when element has no parent', () => {
    const orphan = document.createElement('div');
    expect(siblings(orphan)).toEqual([]);
  });
});

describe('elem', () => {
  it('creates a tag with text shorthand', () => {
    const el = elem('span', 'Hello');
    expect(el.tagName).toBe('SPAN');
    expect(el.textContent).toBe('Hello');
  });

  it('applies properties from an object', () => {
    const el = elem('a', { href: 'https://example.com', className: 'link' });
    expect(el.getAttribute('href')).toBe('https://example.com');
    expect(el.className).toBe('link');
  });

  it('merges style object', () => {
    const el = elem('div', { style: { color: 'red', display: 'block' } });
    expect(el.style.color).toBe('red');
    expect(el.style.display).toBe('block');
  });

  it('merges dataset object', () => {
    const el = elem('div', { dataset: { ref: 'JN3_16' } });
    expect(el.dataset.ref).toBe('JN3_16');
  });

  it('appends element children', () => {
    const child = document.createElement('span');
    const el = elem('div', {}, child);
    expect(el.firstChild).toBe(child);
  });

  it('appends children passed via props.children', () => {
    const a = document.createElement('span');
    const b = document.createElement('em');
    const el = elem('div', { children: [a, b] });
    expect(el.children.length).toBe(2);
  });

  it('flattens an array passed as a variadic child', () => {
    const spans = ['a', 'b', 'c'].map(t => elem('span', t));
    const el = elem('div', {}, spans);
    expect(el.children.length).toBe(3);
    expect(el.textContent).toBe('abc');
    expect(el.firstChild).toBe(spans[0]);
  });
});

describe('insertAfter', () => {
  it('inserts the new element after the reference', () => {
    document.body.innerHTML = '<div id="ref"></div><div id="next"></div>';
    const newEl = document.createElement('span');
    insertAfter(newEl, document.getElementById('ref'));
    expect(document.getElementById('ref').nextSibling).toBe(newEl);
  });

  it('is a no-op for missing args', () => {
    expect(() => insertAfter(null, null)).not.toThrow();
  });
});

describe('on', () => {
  it('binds a direct event handler', () => {
    const el = document.createElement('button');
    document.body.appendChild(el);
    const fn = vi.fn();
    on(el, 'click', fn);
    el.click();
    expect(fn).toHaveBeenCalled();
  });

  it('supports event delegation via selector', () => {
    document.body.innerHTML = '<ul id="list"><li class="item">a</li><li>b</li></ul>';
    const list = document.getElementById('list');
    const fn = vi.fn();
    on(list, 'click', '.item', fn);
    list.querySelector('.item').click();
    list.querySelector('li:not(.item)').click();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('supports namespaced event strings (e.g. "click.ns")', () => {
    const el = document.createElement('button');
    const fn = vi.fn();
    on(el, 'click.myns', fn);
    el.click();
    expect(fn).toHaveBeenCalled();
  });
});

describe('data', () => {
  it('stores and retrieves a value', () => {
    const el = document.createElement('div');
    data(el, 'foo', 42);
    expect(data(el, 'foo')).toBe(42);
  });

  it('returns the full store when called without a key', () => {
    const el = document.createElement('div');
    data(el, 'a', 1);
    data(el, 'b', 2);
    expect(data(el)).toEqual({ a: 1, b: 2 });
  });

  it('falls back to data-* attribute when nothing is stored', () => {
    const el = document.createElement('div');
    el.setAttribute('data-ref', 'JN3_16');
    expect(data(el, 'ref')).toBe('JN3_16');
  });

  it('parses JSON in data-* attribute when possible', () => {
    const el = document.createElement('div');
    el.setAttribute('data-config', '{"size":12}');
    expect(data(el, 'config')).toEqual({ size: 12 });
  });

  it('returns undefined when key does not exist anywhere', () => {
    const el = document.createElement('div');
    expect(data(el, 'missing')).toBeUndefined();
  });
});
