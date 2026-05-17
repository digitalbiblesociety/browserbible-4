import { describe, it, expect } from 'vitest';
import windowIconsDefault, { getWindowIcon } from '@core/windowIcons.js';

describe('windowIcons', () => {
  it('returns a non-empty SVG string for each known window className', () => {
    const knownClasses = [
      'BibleWindow', 'CommentaryWindow', 'SearchWindow', 'TextComparisonWindow',
      'NotesWindow', 'MediaWindow', 'ParallelsWindow', 'StatisticsWindow',
      'AudioWindow', 'DeafBibleWindow', 'MapWindow'
    ];
    for (const cls of knownClasses) {
      const svg = getWindowIcon(cls);
      expect(svg, cls).toBeTypeOf('string');
      expect(svg.length, cls).toBeGreaterThan(0);
    }
  });

  it('returns null for an unknown className', () => {
    expect(getWindowIcon('NoSuchWindow')).toBeNull();
  });

  it('also exposes non-window icons (highlighter, settings, about)', () => {
    expect(getWindowIcon('highlighter')).toBeTypeOf('string');
    expect(getWindowIcon('settings')).toBeTypeOf('string');
    expect(getWindowIcon('about')).toBeTypeOf('string');
  });

  it('default export is the underlying map', () => {
    expect(windowIconsDefault.BibleWindow).toBe(getWindowIcon('BibleWindow'));
  });
});
