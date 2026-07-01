import { describe, it, expect, vi } from 'vitest';
import { createPins } from '@windows/MapWindow/marker-renderer.js';

const jerusalem = {
  name: 'Jerusalem',
  coordinates: [35.23, 31.78],
  verses: ['PS122_2', 'MT2_1'],
  type: 'city'
};

describe('createPins accessibility', () => {
  it('renders markers as focusable buttons with a descriptive label', () => {
    const overlay = document.createElement('div');
    createPins(overlay, [jerusalem], vi.fn());

    const marker = overlay.querySelector('.map-marker');
    expect(marker.getAttribute('role')).toBe('button');
    expect(marker.getAttribute('tabindex')).toBe('0');
    expect(marker.getAttribute('aria-label')).toBe('Jerusalem, City, 2 verses');
  });

  it('activates on Enter and Space keys', () => {
    const overlay = document.createElement('div');
    const onLocationClick = vi.fn();
    createPins(overlay, [jerusalem], onLocationClick);

    const marker = overlay.querySelector('.map-marker');
    marker.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    marker.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

    expect(onLocationClick).toHaveBeenCalledTimes(2);
    expect(onLocationClick).toHaveBeenCalledWith(jerusalem);
  });

  it('does not activate on other keys', () => {
    const overlay = document.createElement('div');
    const onLocationClick = vi.fn();
    createPins(overlay, [jerusalem], onLocationClick);

    overlay.querySelector('.map-marker')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

    expect(onLocationClick).not.toHaveBeenCalled();
  });
});
