import { describe, it, expect } from 'vitest';
import {
  computeClusters,
  renderClusters,
  clearClusters,
  applyClusterVisibility
} from '@windows/MapWindow/clustering.js';
import { SVG_WIDTH } from '@windows/MapWindow/constants.js';

function makeOverlay(markers) {
  const overlay = document.createElement('div');
  for (const m of markers) {
    const el = document.createElement('div');
    el.className = 'map-marker';
    el._svgX = m.x;
    el._svgY = m.y;
    el.setAttribute('data-tier', String(m.tier ?? 4));
    el.locationData = { verses: new Array(m.verses ?? 1).fill('JN3_16') };
    overlay.appendChild(el);
  }
  return overlay;
}

const VIEW_BOX_FULL = { x: 0, y: 0, width: SVG_WIDTH, height: 800 };
const CONTAINER_WIDTH = 1200;

describe('computeClusters', () => {
  it('returns empty results for an empty overlay', () => {
    const overlay = document.createElement('div');
    expect(computeClusters(overlay, VIEW_BOX_FULL, CONTAINER_WIDTH))
      .toMatchObject({ clusters: [], singles: [] });
  });

  it('returns empty results when containerWidth is 0', () => {
    const overlay = makeOverlay([{ x: 100, y: 100 }]);
    expect(computeClusters(overlay, VIEW_BOX_FULL, 0)).toEqual({ clusters: [], singles: [] });
  });

  it('keeps far-apart markers as singles', () => {
    const overlay = makeOverlay([
      { x: 100, y: 100, tier: 1 },
      { x: 800, y: 600, tier: 1 }
    ]);
    const result = computeClusters(overlay, VIEW_BOX_FULL, CONTAINER_WIDTH);
    expect(result.clusters).toHaveLength(0);
    expect(result.singles).toHaveLength(2);
  });

  it('groups nearby markers into a cluster', () => {
    const overlay = makeOverlay([
      { x: 100, y: 100, tier: 1 },
      { x: 105, y: 105, tier: 2 },
      { x: 110, y: 95, tier: 3 }
    ]);
    const result = computeClusters(overlay, VIEW_BOX_FULL, CONTAINER_WIDTH);
    expect(result.clusters).toHaveLength(1);
    expect(result.clusters[0].count).toBe(3);
  });

  it('hides duplicates when markers are co-located, keeping the one with most verses', () => {
    const overlay = makeOverlay([
      { x: 100, y: 100, tier: 1, verses: 1 },
      { x: 100, y: 100, tier: 2, verses: 5 },
      { x: 100.1, y: 100.1, tier: 3, verses: 2 }
    ]);
    const result = computeClusters(overlay, VIEW_BOX_FULL, CONTAINER_WIDTH);
    // All co-located → no cluster badge, one single (best by verse count), rest hidden.
    expect(result.clusters).toHaveLength(0);
    expect(result.singles).toHaveLength(1);
    expect(result.singles[0].locationData.verses.length).toBe(5);
    expect(result.hidden).toHaveLength(2);
  });

  it('skips markers tagged .filtered-out', () => {
    const overlay = makeOverlay([
      { x: 100, y: 100, tier: 1 },
      { x: 105, y: 105, tier: 2 }
    ]);
    overlay.children[0].classList.add('filtered-out');
    const result = computeClusters(overlay, VIEW_BOX_FULL, CONTAINER_WIDTH);
    expect(result.singles).toHaveLength(1);
    expect(result.clusters).toHaveLength(0);
  });
});

describe('renderClusters / clearClusters', () => {
  it('renders a .map-cluster element per cluster, with count text', () => {
    const overlay = document.createElement('div');
    renderClusters(overlay, [
      { x: 100, y: 100, count: 3, members: [] },
      { x: 200, y: 200, count: 5, members: [] }
    ]);
    const els = overlay.querySelectorAll('.map-cluster');
    expect(els).toHaveLength(2);
    expect(els[0].querySelector('.map-cluster-text').textContent).toBe('3');
    expect(els[1].querySelector('.map-cluster-text').textContent).toBe('5');
  });

  it('clearClusters removes existing cluster elements', () => {
    const overlay = document.createElement('div');
    renderClusters(overlay, [{ x: 0, y: 0, count: 2, members: [] }]);
    expect(overlay.querySelectorAll('.map-cluster')).toHaveLength(1);
    clearClusters(overlay);
    expect(overlay.querySelectorAll('.map-cluster')).toHaveLength(0);
  });

  it('clearClusters is a no-op for null overlay', () => {
    expect(() => clearClusters(null)).not.toThrow();
  });
});

describe('applyClusterVisibility', () => {
  it('adds .clustered to cluster members and removes from singles', () => {
    const a = document.createElement('div');
    const b = document.createElement('div');
    const c = document.createElement('div');
    c.classList.add('clustered'); // pretend it was clustered before

    applyClusterVisibility(
      [{ members: [a, b] }],
      [c]
    );

    expect(a.classList.contains('clustered')).toBe(true);
    expect(b.classList.contains('clustered')).toBe(true);
    expect(c.classList.contains('clustered')).toBe(false);
  });

  it('hides "hidden" co-located markers via the .clustered class', () => {
    const h = document.createElement('div');
    applyClusterVisibility([], [], [h]);
    expect(h.classList.contains('clustered')).toBe(true);
  });
});
