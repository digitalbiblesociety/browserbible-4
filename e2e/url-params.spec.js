import { test, expect } from './fixtures.js';

test.describe('URL parameters', () => {
  test('?dev=true switches the textsPath to content/texts_dev', async ({ page, makeUrl }) => {
    await page.goto(makeUrl({ dev: 'true' }));
    const textsPath = await page.evaluate(() => window.BrowserBible.config().textsPath);
    expect(textsPath).toBe('content/texts_dev');
  });

  test('config exposed via window.BrowserBible.config() returns settings prefix', async ({ page, appPath }) => {
    await page.goto(appPath);
    const prefix = await page.evaluate(() => window.BrowserBible.config().settingsPrefix);
    expect(prefix).toBeTruthy();
  });

  test('local profile applies an empty baseContentUrl', async ({ page, appPath, profile }) => {
    test.skip(profile !== 'local', 'only meaningful in local profile');
    await page.goto(appPath);
    const baseContentUrl = await page.evaluate(() => window.BrowserBible.config().baseContentUrl);
    expect(baseContentUrl).toBe('');
  });

  test('remote profile keeps the inscript.bible.cloud baseContentUrl', async ({ page, appPath, profile }) => {
    test.skip(profile !== 'remote', 'only meaningful in remote profile');
    await page.goto(appPath);
    const baseContentUrl = await page.evaluate(() => window.BrowserBible.config().baseContentUrl);
    expect(baseContentUrl).toMatch(/^https:\/\//);
  });
});
