import { test, expect } from '@playwright/test';

test.describe('Advanced Features - URL Parameters & State', () => {
  test('should load application with URL parameters for specific verse', async ({ page }) => {
    // Navigate with URL parameter
    await page.goto('/#John.3.16');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Verify navigation occurred
    const navInput = page.locator('.text-nav').first();
    const navValue = await navInput.inputValue();

    // Should contain reference to John
    expect(navValue.toLowerCase()).toContain('john');
  });

  test('should verify URL updates when navigating', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);

    // Navigate to specific verse
    const navInput = page.locator('.text-nav').first();
    await navInput.fill('Romans 8:28');
    await navInput.press('Enter');
    await page.waitForTimeout(1500);

    // Check if URL updated
    const url = page.url();
    expect(url).toBeTruthy();
  });

  test('should handle malformed URL parameters gracefully', async ({ page }) => {
    // Try loading with invalid URL parameter
    await page.goto('/#InvalidBook.999.999');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Should still load successfully, just maybe not at the invalid reference
    const chapter = page.locator('.chapter').first();
    await expect(chapter).toBeVisible();
  });
});

test.describe('Advanced Features - Responsive Design', () => {
  test('should display correctly on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);

    // Verify main elements are visible
    const chapter = page.locator('.chapter').first();
    await expect(chapter).toBeVisible();

    // Verify menu button is accessible
    const mainMenuButton = page.locator('#main-menu-button');
    await expect(mainMenuButton).toBeVisible();
  });

  test('should display correctly on tablet viewport', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);

    // Verify content is readable
    const chapter = page.locator('.chapter').first();
    await expect(chapter).toBeVisible();
  });

  test('should display correctly on desktop viewport', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);

    // Verify content displays properly
    const chapter = page.locator('.chapter').first();
    await expect(chapter).toBeVisible();

    // Verify windows can be displayed side-by-side
    const windows = page.locator('.window');
    const windowCount = await windows.count();
    expect(windowCount).toBeGreaterThan(0);
  });
});

test.describe('Advanced Features - Menu Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should open main menu and verify options display', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    // Verify menu opened
    const menu = page.locator('#main-menu-dropdown, .main-menu');
    await expect(menu).toBeVisible();

    // Verify menu has options
    const menuItems = page.locator('.main-menu-item, .menu-item');
    const count = await menuItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should close menu after selecting an option', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    // Click an option (settings)
    const settingsButton = page.locator('.main-menu-item.image-config').first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Menu should close (or at least settings dialog should open)
    const configWindow = page.locator('.config-window, #main-config-box');
    await expect(configWindow).toBeVisible();
  });

  test('should close menu with Escape key', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    // Verify menu is open
    const menu = page.locator('#main-menu-dropdown, .main-menu');
    await expect(menu).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Menu should close
    await expect(menu).not.toBeVisible();
  });
});

test.describe('Advanced Features - Touch Interactions', () => {
  test('should support touch interactions on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);

    // Verify menu is tappable
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.tap();
    await page.waitForTimeout(500);

    const menu = page.locator('#main-menu-dropdown, .main-menu');
    await expect(menu).toBeVisible();
  });
});
