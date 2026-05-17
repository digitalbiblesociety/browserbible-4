import { test, expect } from './fixtures.js';

test.describe('app structure', () => {
  test('renders the windows scaffolding and main menu', async ({ page, appPath }) => {
    await page.goto(appPath);

    // App scaffolding from core/App.js
    await expect(page.locator('.windows-container')).toBeAttached();
    await expect(page.locator('.windows-header')).toBeAttached();
    await expect(page.locator('.windows-main')).toBeAttached();
    await expect(page.locator('.windows-footer')).toBeAttached();

    // Main menu container from menu/MainMenu.js
    await expect(page.locator('.main-menu-container')).toBeAttached();
  });

  test('exposes the BrowserBible debug global', async ({ page, appPath }) => {
    await page.goto(appPath);
    const has = await page.evaluate(() => typeof window.BrowserBible === 'object');
    expect(has).toBe(true);

    const version = await page.evaluate(() => window.BrowserBible.VERSION);
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
