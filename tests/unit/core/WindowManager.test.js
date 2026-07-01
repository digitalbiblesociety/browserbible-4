import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WindowManager } from '@core/WindowManager.js';

// These tests exercise the header drag-to-reorder behavior with hand-built
// window stubs rather than real Window instances, so no window types or web
// components need to be registered.

const SLOT_WIDTH = 400;

function makeFakeWindow(manager, id) {
  const node = document.createElement('div');
  node.className = 'window';
  const header = document.createElement('div');
  header.className = 'window-header scroller-header';
  const headerInner = document.createElement('div');
  headerInner.className = 'scroller-header-inner';
  header.appendChild(headerInner);
  node.appendChild(header);
  manager.nodeEl.appendChild(node);

  // Mimic real geometry (jsdom has no layout): the slot comes from the flex
  // order set by _applyWindowOrder, and the rect includes any inline
  // translate, just as getBoundingClientRect would in a browser.
  node.getBoundingClientRect = () => {
    const order = parseInt(node.style.order, 10) || 0;
    const left = order * SLOT_WIDTH + (parseFloat(node.style.translate) || 0);
    return { left, width: SLOT_WIDTH, right: left + SLOT_WIDTH, top: 0, bottom: 600, height: 600 };
  };

  const tab = document.createElement('div');
  tab.className = 'window-tab';

  return {
    id,
    node,
    tab,
    headerInner,
    size: vi.fn(),
    getData: () => ({}),
    close: vi.fn()
  };
}

function mouse(type, target, clientX) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX });
  target.dispatchEvent(event);
}

describe('WindowManager reorder', () => {
  let manager;
  let winA, winB;

  beforeEach(() => {
    document.body.className = '';
    const container = document.createElement('div');
    container.className = 'windows-main';
    // jsdom has no layout: give the container a real size so WindowManager's
    // size() takes the wide branch instead of toggling compact-ui
    Object.defineProperty(container, 'offsetWidth', { value: 1200, configurable: true });
    Object.defineProperty(container, 'offsetHeight', { value: 800, configurable: true });
    document.body.appendChild(container);

    manager = new WindowManager(container, null);

    // Two side-by-side windows: A [0, 400), B [400, 800)
    winA = makeFakeWindow(manager, 'winA');
    winB = makeFakeWindow(manager, 'winB');
    manager.windows = [winA, winB];
    manager.windowWidths = [0.5, 0.5];
    manager._applyWindowOrder();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('_moveWindow reorders windows, widths, and flex order together', () => {
    manager.windowWidths = [0.3, 0.7];
    manager._moveWindow(0, 1);

    expect(manager.windows.map(w => w.id)).toEqual(['winB', 'winA']);
    expect(manager.windowWidths).toEqual([0.7, 0.3]);
    expect(winB.node.style.order).toBe('0');
    expect(winA.node.style.order).toBe('1');
  });

  it("reorders once the dragged window's edge passes the neighbor midpoint, before the pointer does", () => {
    const onSettingsChange = vi.fn();
    manager.on('settingschange', onSettingsChange);

    mouse('mousedown', winA.headerInner, 100);
    // dx=250 puts A's right edge (650) past B's midpoint (600) while the
    // pointer itself (350) is still far short of it
    mouse('mousemove', document, 350);

    expect(manager.windows.map(w => w.id)).toEqual(['winB', 'winA']);
    expect(winA.node.classList.contains('reordering')).toBe(true);
    expect(document.body.classList.contains('window-reordering')).toBe(true);
    // A now belongs to the right slot (400); the rebased translate keeps it
    // visually where the pointer dragged it (400 - 150 = 250)
    expect(winA.node.style.translate).toBe('-150px 0');
    expect(winB.node.classList.contains('window-slide')).toBe(true);
    expect(onSettingsChange).not.toHaveBeenCalled();

    mouse('mouseup', document, 350);

    expect(winA.node.classList.contains('reordering')).toBe(false);
    expect(document.body.classList.contains('window-reordering')).toBe(false);
    // Dropped window snaps into its slot: translate cleared, snap class on
    expect(winA.node.style.translate).toBe('');
    expect(winA.node.classList.contains('window-snap')).toBe(true);
    expect(onSettingsChange).toHaveBeenCalledTimes(1);
  });

  it('re-grabbing a window mid-snap cancels the snap animation', () => {
    mouse('mousedown', winA.headerInner, 100);
    mouse('mousemove', document, 650);
    mouse('mouseup', document, 650);
    expect(winA.node.classList.contains('window-snap')).toBe(true);

    mouse('mousedown', winA.headerInner, 700);
    mouse('mousemove', document, 710);

    expect(winA.node.classList.contains('window-snap')).toBe(false);
    expect(winA.node.classList.contains('reordering')).toBe(true);

    mouse('mouseup', document, 710);
  });

  it('the dragged window follows the pointer without reordering until its edge crosses a midpoint', () => {
    const onSettingsChange = vi.fn();
    manager.on('settingschange', onSettingsChange);

    mouse('mousedown', winA.headerInner, 100);
    // dx=150 leaves A's right edge (550) short of B's midpoint (600)
    mouse('mousemove', document, 250);

    expect(winA.node.style.translate).toBe('150px 0');
    expect(manager.windows.map(w => w.id)).toEqual(['winA', 'winB']);

    mouse('mouseup', document, 250);

    expect(winA.node.style.translate).toBe('');
    expect(manager.windows.map(w => w.id)).toEqual(['winA', 'winB']);
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it('small movements below the threshold do not start a drag', () => {
    const onSettingsChange = vi.fn();
    manager.on('settingschange', onSettingsChange);

    mouse('mousedown', winA.headerInner, 100);
    mouse('mousemove', document, 103);
    mouse('mouseup', document, 103);

    expect(manager.windows.map(w => w.id)).toEqual(['winA', 'winB']);
    expect(onSettingsChange).not.toHaveBeenCalled();
  });

  it('drags starting on header controls are ignored', () => {
    const input = document.createElement('input');
    winA.headerInner.appendChild(input);

    mouse('mousedown', input, 100);
    mouse('mousemove', document, 650);
    mouse('mouseup', document, 650);

    expect(manager.windows.map(w => w.id)).toEqual(['winA', 'winB']);
  });

  it('does not reorder in compact-ui mode', () => {
    document.body.classList.add('compact-ui');

    mouse('mousedown', winA.headerInner, 100);
    mouse('mousemove', document, 650);
    mouse('mouseup', document, 650);

    expect(manager.windows.map(w => w.id)).toEqual(['winA', 'winB']);
  });

  it('does not start a drag with a single window', () => {
    manager.windows = [winA];
    manager.windowWidths = [1];

    mouse('mousedown', winA.headerInner, 100);
    mouse('mousemove', document, 650);
    mouse('mouseup', document, 650);

    expect(document.body.classList.contains('window-reordering')).toBe(false);
  });
});
