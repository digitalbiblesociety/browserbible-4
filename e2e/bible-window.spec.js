import { test, expect } from './fixtures.js';

test.describe('default Bible windows', () => {
  test('renders Bible windows from the default config', async ({ page, appPath }) => {
    await page.goto(appPath);

    // Default config has two BibleWindow entries (ENGWEB + ENGASV). Each
    // window contributes a tab in the header and a panel in the main region,
    // so the locator typically resolves to 2× the configured window count.
    const bibleWindows = page.locator('.BibleWindow');
    await expect.poll(async () => bibleWindows.count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(2);
  });

  test('a Bible window eventually shows a .section once content loads', async ({ page, appPath }) => {
    await page.goto(appPath);
    // Allow the network round-trip to inscript.bible.cloud (or local content)
    // to settle. If you serve content locally, this is fast; remote can take
    // a few seconds on first load.
    await expect(page.locator('.BibleWindow .section').first()).toBeVisible({ timeout: 30_000 });
  });
});
