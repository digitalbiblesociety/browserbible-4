/**
 * MapWindow loads real location data and renders markers.
 */

import { test, expect } from './fixtures.js';

test.describe('map window', () => {
  test('opens with markers rendered from maps.json', async ({ page, makeUrl }) => {
    await page.goto(makeUrl({ w1: 'map' }));

    await expect(page.locator('.window.MapWindow')).toBeVisible({ timeout: 15_000 });

    // At least one marker should exist once data loads. Map JSON ships ~200+
    // locations; we just need any of them to land in the DOM.
    await expect.poll(async () =>
      page.locator('.window.MapWindow .map-marker').count(),
      { timeout: 15_000 }
    ).toBeGreaterThan(0);
  });
});
