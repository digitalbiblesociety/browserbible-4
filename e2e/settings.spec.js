/**
 * Theme and font-size settings — verify body class transitions when settings
 * change. Clicks happen on the in-DOM elements directly (the settings panel
 * is in the DOM regardless of popover visibility).
 */

import { test, expect } from './fixtures.js';

test.describe('settings', () => {
  test('theme switch toggles theme-* class on <body>', async ({ page, appPath }) => {
    await page.goto(appPath);

    // Theme picker lives inside a popover. We dispatch click events directly
    // on the elements rather than user-clicking through the menu UI.
    await expect(page.locator('#config-theme-shiloh')).toBeAttached({ timeout: 15_000 });
    await page.locator('#config-theme-shiloh').dispatchEvent('click');

    await expect.poll(async () =>
      page.evaluate(() => document.body.classList.contains('theme-shiloh'))
    ).toBe(true);
    expect(await page.evaluate(() => document.body.classList.contains('theme-default'))).toBe(false);

    // Switch back
    await page.locator('#config-theme-default').dispatchEvent('click');
    await expect.poll(async () =>
      page.evaluate(() => document.body.classList.contains('theme-default'))
    ).toBe(true);
    expect(await page.evaluate(() => document.body.classList.contains('theme-shiloh'))).toBe(false);
  });

  test('font-size slider toggles config-font-size-* class on <body>', async ({ page, appPath }) => {
    await page.goto(appPath);

    const slider = page.locator('#font-size-container .settings-slider');
    await expect(slider).toBeAttached({ timeout: 15_000 });

    // The slider value drives the body class. Set to 24 via the input event
    // (typical user interaction with a range input).
    await slider.evaluate((el) => {
      el.value = '24';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect.poll(async () =>
      page.evaluate(() => document.body.classList.contains('config-font-size-24'))
    ).toBe(true);
  });
});
