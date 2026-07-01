import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MapPanel } from '@windows/MapWindow/map-panel.js';

/** MapPanel with a fake overlay containing two cluster-close markers. */
function makePanel() {
  const container = document.createElement('div');
  const panel = new MapPanel(container);

  const overlay = document.createElement('div');
  overlay.className = 'map-markers-overlay';
  for (const [x, y] of [[100, 100], [103, 103]]) {
    const marker = document.createElement('div');
    marker.className = 'map-marker';
    marker.setAttribute('data-tier', '2');
    marker._svgX = x;
    marker._svgY = y;
    marker._anchorX = 7;
    marker._anchorY = 7;
    marker.locationData = { verses: ['JN3_16'] };
    overlay.appendChild(marker);
  }
  container.appendChild(overlay);
  panel.markersOverlay = overlay;
  return panel;
}

describe('updateMarkerScales deferred decoration', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('decorates synchronously by default', () => {
    const panel = makePanel();
    panel.updateMarkerScales();
    expect(panel.markersOverlay.querySelectorAll('.map-cluster')).toHaveLength(1);
  });

  it('postpones clustering until the settle timer with defer: true', () => {
    const panel = makePanel();

    panel.updateMarkerScales({ defer: true });
    panel.updateMarkerScales({ defer: true });
    expect(panel.markersOverlay.querySelectorAll('.map-cluster')).toHaveLength(0);

    vi.advanceTimersByTime(200);
    expect(panel.markersOverlay.querySelectorAll('.map-cluster')).toHaveLength(1);
  });

  it('a synchronous call cancels a pending deferred decoration', () => {
    const panel = makePanel();

    panel.updateMarkerScales({ defer: true });
    panel.updateMarkerScales(); // sync — decorates now, cancels the timer
    expect(panel.markersOverlay.querySelectorAll('.map-cluster')).toHaveLength(1);

    const decorateSpy = vi.spyOn(panel, '_decorateMarkers');
    vi.advanceTimersByTime(500);
    expect(decorateSpy).not.toHaveBeenCalled();
  });

  it('destroy() cancels a pending decoration timer', () => {
    const panel = makePanel();
    panel.updateMarkerScales({ defer: true });
    panel.destroy();

    expect(() => vi.advanceTimersByTime(500)).not.toThrow();
    expect(panel.markersOverlay.querySelectorAll('.map-cluster')).toHaveLength(0);
  });
});
