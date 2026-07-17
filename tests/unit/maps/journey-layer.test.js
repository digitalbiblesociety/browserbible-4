import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ensureJourneyLayer,
  renderJourney,
  removeJourney,
  STOP_BADGE_SIZE
} from '@windows/MapWindow/journey-layer.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function makeBasemap() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.innerHTML = `
    <defs><clipPath id="content-clip"><rect/></clipPath></defs>
    <g clip-path="url(#content-clip)"><rect class="sea"/><path class="rivers"/></g>
    <rect class="border"/>
  `;
  return svg;
}

const journey = {
  id: 'paul1',
  name: "Paul's First Journey",
  color: '#7b3294',
  stops: [
    { id: 'a', name: 'Antioch', label: 'Antioch (Syria)', coordinates: [36.16, 36.2] },
    { id: 'b', name: 'Seleucia', coordinates: [35.93, 36.11] },
    { id: 'c', name: 'Salamis', coordinates: [33.91, 35.18] }
  ],
  legs: [
    { from: 'a', to: 'b', mode: 'land' },
    { from: 'b', to: 'c', mode: 'sea', via: [[35.2, 35.85]] },
    { from: 'c', to: 'a', mode: 'sea' }
  ]
};

let svg, overlay, layer;

beforeEach(() => {
  svg = makeBasemap();
  overlay = document.createElement('div');
  overlay.className = 'map-markers-overlay';
  layer = ensureJourneyLayer(svg);
});

describe('ensureJourneyLayer', () => {
  it('appends the layer as the last child of the content clip group', () => {
    const group = svg.querySelector('g[clip-path="url(#content-clip)"]');
    expect(layer.parentNode).toBe(group);
    expect(group.lastChild).toBe(layer);
    expect(layer.getAttribute('class')).toBe('journey-layer');
  });

  it('is idempotent', () => {
    const again = ensureJourneyLayer(svg);
    expect(again).toBe(layer);
    expect(svg.querySelectorAll('.journey-layer')).toHaveLength(1);
  });

  it('returns null without an svg element', () => {
    expect(ensureJourneyLayer(null)).toBeNull();
  });
});

describe('renderJourney', () => {
  it('creates one path per leg with mode classes and styling attributes', () => {
    renderJourney(layer, overlay, journey);

    const paths = layer.querySelectorAll('.journey-route');
    expect(paths).toHaveLength(3);

    expect(layer.querySelectorAll('.journey-route-land')).toHaveLength(1);
    expect(layer.querySelectorAll('.journey-route-sea')).toHaveLength(2);

    paths.forEach(path => {
      expect(path.getAttribute('data-journey-id')).toBe('paul1');
      expect(path.getAttribute('stroke')).toBe('#7b3294');
      expect(path.getAttribute('fill')).toBe('none');
      expect(path.getAttribute('vector-effect')).toBe('non-scaling-stroke');
      expect(path.getAttribute('pointer-events')).toBe('none');
      expect(path.getAttribute('d')).toMatch(/^M[\d.,-]+ C/);
    });
  });

  it('creates numbered badges in stop order with positioning fields', () => {
    renderJourney(layer, overlay, journey);

    const badges = overlay.querySelectorAll('.journey-stop');
    expect(badges).toHaveLength(3);

    badges.forEach((badge, i) => {
      expect(badge.textContent).toBe(String(i + 1));
      expect(badge.getAttribute('data-journey-id')).toBe('paul1');
      expect(badge.getAttribute('role')).toBe('button');
      expect(typeof badge._svgX).toBe('number');
      expect(typeof badge._svgY).toBe('number');
      expect(badge._anchorX).toBe(STOP_BADGE_SIZE / 2);
      expect(badge._anchorY).toBe(STOP_BADGE_SIZE / 2);
      expect(badge.style.getPropertyValue('--journey-color')).toBe('#7b3294');
    });

    expect(badges[0].getAttribute('aria-label')).toBe('Stop 1: Antioch (Syria)');
    expect(badges[1].getAttribute('aria-label')).toBe('Stop 2: Seleucia');
  });

  it('fires onStopClick with the stop and index on click and keyboard', () => {
    const onStopClick = vi.fn();
    renderJourney(layer, overlay, journey, onStopClick);

    const badges = overlay.querySelectorAll('.journey-stop');
    badges[1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onStopClick).toHaveBeenCalledWith(journey.stops[1], 1);

    badges[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onStopClick).toHaveBeenCalledWith(journey.stops[2], 2);
  });

  it('does not duplicate elements when re-rendered', () => {
    renderJourney(layer, overlay, journey);
    renderJourney(layer, overlay, journey);
    expect(layer.querySelectorAll('.journey-route')).toHaveLength(3);
    expect(overlay.querySelectorAll('.journey-stop')).toHaveLength(3);
  });

  it('skips legs whose stops are unknown', () => {
    const broken = { ...journey, legs: [...journey.legs, { from: 'a', to: 'nope', mode: 'land' }] };
    renderJourney(layer, overlay, broken);
    expect(layer.querySelectorAll('.journey-route')).toHaveLength(3);
  });
});

describe('removeJourney', () => {
  it('removes only the given journey', () => {
    const other = { ...journey, id: 'paul2', color: '#00796b' };
    renderJourney(layer, overlay, journey);
    renderJourney(layer, overlay, other);

    removeJourney(layer, overlay, 'paul1');

    expect(layer.querySelectorAll('[data-journey-id="paul1"]')).toHaveLength(0);
    expect(overlay.querySelectorAll('[data-journey-id="paul1"]')).toHaveLength(0);
    expect(layer.querySelectorAll('[data-journey-id="paul2"]')).toHaveLength(3);
    expect(overlay.querySelectorAll('[data-journey-id="paul2"]')).toHaveLength(3);
  });
});
