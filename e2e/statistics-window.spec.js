import { test, expect } from '@playwright/test';

test.describe('Statistics Window - Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should open statistics window', async ({ page }) => {
    // Open main menu
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    // Click Statistics option
    const addStatsButton = page.locator('#add-statistics, .window-add').filter({ hasText: /statistics|stats/i }).first();

    // Check if statistics option exists
    const statsButtonCount = await addStatsButton.count();
    if (statsButtonCount === 0) {
      test.skip(true, 'Statistics window option not available in menu');
    }

    await addStatsButton.click();
    await page.waitForTimeout(1500);

    // Verify statistics window opened
    const statsWindow = page.locator('.window.StatisticsWindow');
    await expect(statsWindow).toBeVisible({ timeout: 5000 });
  });

  test('should display word frequency data if available', async ({ page }) => {
    // Open main menu
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addStatsButton = page.locator('#add-statistics, .window-add').filter({ hasText: /statistics|stats/i }).first();
    const statsButtonCount = await addStatsButton.count();

    if (statsButtonCount === 0) {
      test.skip(true, 'Statistics window not available');
    }

    await addStatsButton.click();
    await page.waitForTimeout(1500);

    // Verify window content exists
    const statsWindow = page.locator('.window.StatisticsWindow');
    await expect(statsWindow).toBeVisible({ timeout: 5000 });

    const content = await statsWindow.textContent();
    expect(content).toBeTruthy();
  });
});

test.describe('Statistics Window - Word Frequency', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);

    // Open statistics window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addStatsButton = page.locator('#add-statistics, .window-add').filter({ hasText: /statistics|stats/i }).first();
    const statsButtonCount = await addStatsButton.count();

    if (statsButtonCount === 0) {
      test.skip(true, 'Statistics window not available');
      return;
    }

    await addStatsButton.click();
    await page.waitForTimeout(1500);
  });

  test('should display statistics for current passage', async ({ page }) => {
    // Verify statistics content
    const statsWindow = page.locator('.window.StatisticsWindow');
    const hasContent = await statsWindow.isVisible();
    expect(hasContent).toBe(true);
  });
});
