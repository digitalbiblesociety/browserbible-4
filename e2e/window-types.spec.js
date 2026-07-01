/**
 * Open each window type via URL params and verify it renders. The exact
 * content varies, but every window class produces a tab + a panel with the
 * matching className.
 */

import { test, expect } from './fixtures.js';

const windowTypes = [
  { param: 'bible',      className: 'BibleWindow',          extra: { t1: 'ENGWEB', v1: 'JN1_1' } },
  { param: 'search',     className: 'SearchWindow',         extra: { t1: 'ENGWEB', s1: 'love' } },
  { param: 'audio',      className: 'AudioWindow',          extra: { t1: 'ENGWEB', v1: 'JN1_1' } },
  { param: 'parallel',   className: 'ParallelsWindow',      extra: { t1: 'ENGWEB' } },
  { param: 'comparison', className: 'TextComparisonWindow', extra: {} },
  { param: 'stats',      className: 'StatisticsWindow',     extra: {} },
  { param: 'media',      className: 'MediaWindow',          extra: {} },
  { param: 'map',        className: 'MapWindow',            extra: {} },
  { param: 'notes',      className: 'NotesWindow',          extra: {} }
];

test.describe('window-type smoke', () => {
  for (const { param, className, extra } of windowTypes) {
    test(`opens a ${className} via ?w1=${param}`, async ({ page, makeUrl }) => {
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));

      await page.goto(makeUrl({ w1: param, ...extra }));

      // Tab + panel both have the className.
      await expect(page.locator(`.window-tab.${className}`)).toHaveCount(1, { timeout: 15_000 });
      await expect(page.locator(`.window.${className}`)).toHaveCount(1, { timeout: 15_000 });

      // No uncaught page errors during boot.
      expect(errors, `Page errors:\n${errors.join('\n')}`).toEqual([]);
    });
  }
});

test.describe('link/unlink button', () => {
  // Open two windows so the single-window CSS (which hides all link buttons)
  // no longer applies, then confirm only the linkable window shows one.
  test('comparison window has no link button; bible window does', async ({ page, makeUrl }) => {
    await page.goto(makeUrl({
      w1: 'bible', t1: 'ENGWEB', v1: 'JN1_1',
      w2: 'comparison'
    }));

    await expect(page.locator('.window.BibleWindow')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('.window.TextComparisonWindow')).toHaveCount(1, { timeout: 15_000 });

    await expect(page.locator('.window.BibleWindow .link-button')).toHaveCount(1);
    await expect(page.locator('.window.TextComparisonWindow .link-button')).toHaveCount(0);
  });
});
