/**
 * Settings persistence — window state survives page reload.
 */

import { test, expect } from './fixtures.js';

test.describe('persistence', () => {
  test('the window layout persists across reload', async ({ page, profile, makeUrl }) => {
    const text = 'ENGWEB';
    const second = profile === 'local' ? 'SPABES' : 'ENGASV';

    // First load: pin two windows via URL params.
    await page.goto(makeUrl({
      w1: 'bible', t1: text, v1: 'JN1_1',
      w2: 'bible', t2: second, v2: 'JN1_1'
    }));
    await expect(page.locator('.window-tab.BibleWindow')).toHaveCount(2, { timeout: 15_000 });

    // Reload WITHOUT URL params — the persisted layout should be honored.
    await page.goto(makeUrl());
    await expect(page.locator('.window-tab.BibleWindow')).toHaveCount(2, { timeout: 15_000 });
  });

  test('a settings change is persisted to localStorage (debounced ~1s)', async ({ page, profile, makeUrl }) => {
    await page.goto(makeUrl({ w1: 'bible', t1: 'ENGWEB', v1: 'JN1_1' }));
    await expect(page.locator('.BibleWindow .section').first()).toBeVisible({ timeout: 30_000 });

    // Trigger a navigation by typing a reference and pressing Enter — that's a
    // settings change which the windowManager broadcasts.
    await page.locator('#main-search-input').fill('Genesis 1:1');
    await page.locator('#main-search-input').press('ArrowDown');
    await page.locator('#main-search-input').press('Enter');

    // App debounces persistence by 1s.
    await expect.poll(async () => page.evaluate(() => {
      const prefix = window.BrowserBible.config().settingsPrefix;
      const key = Object.keys(window.localStorage).find(k => k.startsWith(prefix) && k.endsWith('app-windows'));
      return key ? JSON.parse(window.localStorage.getItem(key)) : null;
    }), { timeout: 5_000 }).not.toBeNull();
  });
});
