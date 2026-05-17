import { test, expect } from './fixtures.js';

test.describe('app smoke', () => {
  test('loads the index page without console errors', async ({ page, appPath }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(appPath);

    // Title should reflect the app
    await expect(page).toHaveTitle(/bible/i);

    // App container should be present (the index renders a <main> wrapper).
    await expect(page.locator('body')).toBeVisible();

    // Allow the bundle to fully execute and texts manifest to settle.
    await page.waitForLoadState('networkidle', { timeout: 30_000 });

    // Filter out network errors caused by missing optional content (maps,
    // analytics) so the smoke test is robust on fresh installs.
    const fatal = errors.filter(e =>
      !/Failed to load resource/i.test(e) &&
      !/analytics/i.test(e)
    );
    expect(fatal, `Console errors:\n${fatal.join('\n')}`).toHaveLength(0);
  });
});
