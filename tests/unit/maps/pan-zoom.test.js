import { describe, it, expect, vi } from 'vitest';
import {
  zoomAtPoint,
  zoomBy,
  isAtMinZoom,
  isAtMaxZoom,
  setViewBoxSize,
  constrainViewBox
} from '@windows/MapWindow/pan-zoom.js';
import { SVG_WIDTH, SVG_HEIGHT, MIN_VIEW_WIDTH } from '@windows/MapWindow/constants.js';
import { getViewTransform, screenToSvg } from '@windows/MapWindow/view-transform.js';

const WIDTH = 800;
const HEIGHT = 600;

/** Minimal duck-typed component matching what pan-zoom.js expects. */
function makeComponent() {
  return {
    refs: {
      mapContainer: {
        getBoundingClientRect: () => ({
          width: WIDTH, height: HEIGHT, left: 0, top: 0, right: WIDTH, bottom: HEIGHT
        })
      }
    },
    state: { isPanning: false, currentCenter: {} },
    viewBox: { x: 0, y: 0, width: SVG_WIDTH, height: SVG_HEIGHT },
    panStart: { x: 0, y: 0 },
    svgElement: null, // updateViewBox no-ops without an element
    updateMarkerScales: vi.fn(),
    triggerSettingsChange: vi.fn(),
    panMarkersBy: vi.fn(),
    addListener: vi.fn()
  };
}

describe('zoomAtPoint', () => {
  it('keeps the SVG point under the anchor fixed while zooming', () => {
    const component = makeComponent();
    // Zoomed-in starting view well away from the map edges
    setViewBoxSize(component, 300);
    component.viewBox.x = 400;
    component.viewBox.y = 200;

    const rect = component.refs.mapContainer.getBoundingClientRect();
    const px = 200, py = 150;
    const before = screenToSvg(px, py, component.viewBox, getViewTransform(component.viewBox, rect));

    zoomAtPoint(component, px, py, 0.8);

    const after = screenToSvg(px, py, component.viewBox, getViewTransform(component.viewBox, rect));
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(component.viewBox.width).toBeCloseTo(240, 6);
    expect(component.updateMarkerScales).toHaveBeenCalled();
  });

  it('keeps the viewBox inside the map when zooming out near an edge', () => {
    const component = makeComponent();
    setViewBoxSize(component, 300);
    component.viewBox.x = 0;
    component.viewBox.y = 0;

    zoomAtPoint(component, 0, 0, 2);

    expect(component.viewBox.x).toBeGreaterThanOrEqual(0);
    expect(component.viewBox.y).toBeGreaterThanOrEqual(0);
    expect(component.viewBox.x + component.viewBox.width).toBeLessThanOrEqual(SVG_WIDTH + 1e-6);
    expect(component.viewBox.y + component.viewBox.height).toBeLessThanOrEqual(SVG_HEIGHT + 1e-6);
  });
});

describe('zoomBy bounds', () => {
  it('clamps zoom-in at MIN_VIEW_WIDTH and reports isAtMaxZoom', () => {
    const component = makeComponent();
    setViewBoxSize(component, 100);

    zoomBy(component, 0.0001);

    expect(component.viewBox.width).toBe(MIN_VIEW_WIDTH);
    expect(isAtMaxZoom(component)).toBe(true);
    expect(isAtMinZoom(component)).toBe(false);
  });

  it('clamps zoom-out at the full map extent and reports isAtMinZoom', () => {
    const component = makeComponent();
    setViewBoxSize(component, 100);

    zoomBy(component, 10000);

    // One dimension must span the whole map; nothing may exceed it
    expect(
      component.viewBox.width >= SVG_WIDTH - 1e-6 ||
      component.viewBox.height >= SVG_HEIGHT - 1e-6
    ).toBe(true);
    expect(component.viewBox.width).toBeLessThanOrEqual(SVG_WIDTH + 1e-6);
    expect(component.viewBox.height).toBeLessThanOrEqual(SVG_HEIGHT + 1e-6);
    expect(isAtMinZoom(component)).toBe(true);
    expect(isAtMaxZoom(component)).toBe(false);
  });
});

describe('constrainViewBox', () => {
  it('clamps x and y into the map extent', () => {
    const viewBox = { x: -50, y: 9999, width: 300, height: 200 };
    constrainViewBox(viewBox);
    expect(viewBox.x).toBe(0);
    expect(viewBox.y).toBe(SVG_HEIGHT - 200);
  });
});
