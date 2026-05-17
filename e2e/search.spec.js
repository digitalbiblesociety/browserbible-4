/**
 * Top-bar search box: navigation suggestions, search-window open.
 * Both profiles. Uses real content from the running app.
 */

import { test, expect } from './fixtures.js';

test.describe('top search box', () => {
  test('typing a reference shows a "Go to" suggestion', async ({ page, appPath }) => {
    await page.goto(appPath);
    await expect(page.locator('.BibleWindow .section').first()).toBeVisible({ timeout: 30_000 });

    const input = page.locator('#main-search-input');
    await input.fill('John 3:16');

    const suggestions = page.locator('#main-search-suggestions');
    await expect(suggestions).toBeVisible();
    await expect(suggestions.locator('.suggestion-item', { hasText: /Go to/ })).toBeVisible();
  });

  test('Enter on the navigation suggestion takes Bible windows to the chosen passage', async ({ page, appPath }) => {
    await page.goto(appPath);
    await expect(page.locator('.BibleWindow .section').first()).toBeVisible({ timeout: 30_000 });

    const input = page.locator('#main-search-input');
    await input.fill('Genesis 1:1');
    const suggestions = page.locator('#main-search-suggestions .suggestion-item');
    await expect(suggestions.first()).toBeVisible();

    // ArrowDown selects the navigate option (index 1, after the default search option).
    await input.press('ArrowDown');
    await input.press('Enter');

    // After the nav, at least one rendered section should reference Genesis 1.
    await expect.poll(async () => {
      const ids = await page.locator('.BibleWindow .section').evaluateAll(
        els => els.map(el => (el.getAttribute('data-id') ?? '').toLowerCase())
      );
      return ids.some(id => id.includes('gn1'));
    }, { timeout: 10_000 }).toBe(true);
  });

  test('a free-text query opens a SearchWindow', async ({ page, appPath }) => {
    await page.goto(appPath);
    await expect(page.locator('.BibleWindow .section').first()).toBeVisible({ timeout: 30_000 });

    const before = await page.locator('.window-tab.SearchWindow').count();

    const input = page.locator('#main-search-input');
    await input.fill('beginning');
    await expect(page.locator('#main-search-suggestions .suggestion-item').first()).toBeVisible();
    // First suggestion is always the search action.
    await input.press('Enter');

    await expect(page.locator('.window-tab.SearchWindow')).toHaveCount(before + 1, { timeout: 10_000 });
  });

  test('clearing the input hides suggestions', async ({ page, appPath }) => {
    await page.goto(appPath);
    const input = page.locator('#main-search-input');
    await input.fill('Jn');
    await expect(page.locator('#main-search-suggestions')).toBeVisible();
    await input.fill('');
    await expect(page.locator('#main-search-suggestions')).toBeHidden();
  });
});
