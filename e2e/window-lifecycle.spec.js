/**
 * Window add/remove lifecycle — adding via the public API and closing via the
 * close button.
 */

import { test, expect } from './fixtures.js';

test.describe('window lifecycle', () => {
  test('clicking a Bible window\'s close button removes it', async ({ page, makeUrl }) => {
    await page.goto(makeUrl({
      w1: 'bible', t1: 'ENGWEB', v1: 'JN1_1',
      w2: 'bible', t2: 'ENGWEB', v2: 'GN1_1'
    }));
    await expect(page.locator('.window-tab.BibleWindow')).toHaveCount(2, { timeout: 15_000 });

    // Click the close button on the first Bible window.
    await page.locator('.window.BibleWindow .close-container .close-button').first().click();

    await expect(page.locator('.window-tab.BibleWindow')).toHaveCount(1, { timeout: 5_000 });
    await expect(page.locator('.window.BibleWindow')).toHaveCount(1);
  });

  test('windowManager.add programmatically opens a new window', async ({ page, appPath }) => {
    await page.goto(appPath);
    await expect(page.locator('.BibleWindow .section').first()).toBeVisible({ timeout: 30_000 });

    const before = await page.locator('.window-tab.SearchWindow').count();

    await page.evaluate(() => {
      const app = window.BrowserBible.getApp();
      app.windowManager.add('SearchWindow', { textid: 'ENGWEB', searchtext: 'love' });
    });

    await expect(page.locator('.window-tab.SearchWindow')).toHaveCount(before + 1, { timeout: 5_000 });
  });
});
