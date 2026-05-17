import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TextNavigation } from '@common/TextNavigation.js';
import { setApp } from '@core/registry.js';

describe('TextNavigation', () => {
  let app;

  beforeEach(() => {
    app = { handleGlobalMessage: vi.fn() };
    setApp(app);
    // Reset internal state — singleton persists across tests in this file.
    TextNavigation.locations = [];
    TextNavigation.locationIndex = -1;
    TextNavigation.clearListeners?.();
  });

  afterEach(() => {
    setApp(null);
  });

  it('firstState seeds the initial location', () => {
    TextNavigation.firstState('JN3');
    expect(TextNavigation.getLocations()).toEqual(['JN3']);
    expect(TextNavigation.getLocationIndex()).toBe(0);
  });

  it('locationChange appends and advances the index', () => {
    TextNavigation.firstState('JN3');
    TextNavigation.locationChange('JN4', 'forward');
    expect(TextNavigation.getLocations()).toEqual(['JN3', 'JN4']);
    expect(TextNavigation.getLocationIndex()).toBe(1);
  });

  it('locationChange truncates forward history when navigating from a back state', () => {
    TextNavigation.firstState('JN3');
    TextNavigation.locationChange('JN4');
    TextNavigation.locationChange('JN5');
    // Simulate back to index 1
    TextNavigation.locationIndex = 1;
    TextNavigation.locationChange('JN6');
    expect(TextNavigation.getLocations()).toEqual(['JN3', 'JN4', 'JN6']);
    expect(TextNavigation.getLocationIndex()).toBe(2);
  });

  it('locationChange triggers a locationchange event with the type', () => {
    TextNavigation.firstState('JN3');
    const listener = vi.fn();
    TextNavigation.on('locationchange', listener);
    TextNavigation.locationChange('JN4', 'forward');
    expect(listener).toHaveBeenCalledWith({ type: 'forward' });
  });

  it('popstate event is wired and dispatches a nav message via the app', () => {
    TextNavigation.firstState('JN3');
    TextNavigation.locationChange('JN4');
    // Dispatch a popstate as if the user clicked back to JN3
    window.dispatchEvent(new PopStateEvent('popstate', { state: { locationid: 'JN3' } }));
    expect(app.handleGlobalMessage).toHaveBeenCalled();
    const arg = app.handleGlobalMessage.mock.calls[0][0];
    expect(arg.data.locationInfo.sectionid).toBe('JN3');
    expect(arg.data.locationInfo.fragmentid).toBe('JN3_1');
  });

  it('popstate with a verse fragment uses it as-is', () => {
    TextNavigation.firstState('JN3_16');
    TextNavigation.locationChange('JN3_17');
    window.dispatchEvent(new PopStateEvent('popstate', { state: { locationid: 'JN3_16' } }));
    const arg = app.handleGlobalMessage.mock.calls[0][0];
    expect(arg.data.locationInfo.fragmentid).toBe('JN3_16');
    expect(arg.data.locationInfo.sectionid).toBe('JN3');
  });

  it('popstate without a state.locationid is a no-op', () => {
    TextNavigation.firstState('JN3');
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
    expect(app.handleGlobalMessage).not.toHaveBeenCalled();
  });
});
