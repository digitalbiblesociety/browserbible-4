import { test, expect } from '@playwright/test';

test.describe('Window Management - Creating Windows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should create new Bible window via add window button', async ({ page }) => {
    // Count initial windows
    const initialWindows = page.locator('.window');
    const initialCount = await initialWindows.count();
    expect(initialCount).toBeGreaterThan(0);

    // Open main menu
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    // Click "Bible" add window option
    const addBibleButton = page.locator('#add-bible, .window-add').filter({ hasText: /bible/i }).first();
    await addBibleButton.click();
    await page.waitForTimeout(1500);

    // Wait for new window to load
    await page.waitForSelector('.window', { timeout: 5000 });

    // Verify window count increased
    const newWindows = page.locator('.window');
    const newCount = await newWindows.count();
    expect(newCount).toBe(initialCount + 1);

    // Verify new window has Bible content (check for .chapter in any window)
    const allChapters = page.locator('.chapter');
    await expect(allChapters.first()).toBeVisible();
  });

  test('should create new Search window', async ({ page }) => {
    // Count initial windows
    const initialWindows = page.locator('.window');
    const initialCount = await initialWindows.count();

    // Open main menu
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    // Click "Search" add window option
    const addSearchButton = page.locator('#add-search, .window-add').filter({ hasText: /search/i }).first();
    await addSearchButton.click();
    await page.waitForTimeout(1500);

    // Verify window count increased
    const newWindows = page.locator('.window');
    const newCount = await newWindows.count();
    expect(newCount).toBe(initialCount + 1);

    // Verify new window has Search content
    const searchWindow = page.locator('.search-main').last();
    await expect(searchWindow).toBeVisible();
  });

  test.skip('should create new Map window', async ({ page }) => {
    // Count initial windows
    const initialWindows = page.locator('.window');
    const initialCount = await initialWindows.count();

    // Open main menu
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    // Click "Map" add window option
    const addMapButton = page.locator('#add-map, .window-add').filter({ hasText: /map/i }).first();

    // Check if map option exists
    const mapButtonCount = await addMapButton.count();
    if (mapButtonCount === 0) {
      test.skip(true, 'Map window option not available in menu');
    }

    await addMapButton.click();
    await page.waitForTimeout(1500);

    // Verify window count increased
    const newWindows = page.locator('.window');
    const newCount = await newWindows.count();
    expect(newCount).toBe(initialCount + 1);

    // Verify map window exists by checking for SVG map container
    const mapSvg = page.locator('svg#mapsvg, .map-container svg');
    await expect(mapSvg).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Window Management - Managing Windows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should display multiple windows simultaneously', async ({ page }) => {
    // Count initial windows
    const initialWindows = page.locator('.window');
    const initialCount = await initialWindows.count();

    // Create a new window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addBibleButton = page.locator('#add-bible, .window-add').filter({ hasText: /bible/i }).first();
    await addBibleButton.click();
    await page.waitForTimeout(1500);

    // Verify window count increased
    const windows = page.locator('.window');
    const windowCount = await windows.count();
    expect(windowCount).toBe(initialCount + 1);

    // Verify all windows are visible
    for (let i = 0; i < windowCount; i++) {
      await expect(windows.nth(i)).toBeVisible();
    }
  });

  test('should close a window and verify others remain functional', async ({ page }) => {
    // Count initial windows
    const initialWindows = page.locator('.window');
    const initialCount = await initialWindows.count();

    // Create a new window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addBibleButton = page.locator('#add-bible, .window-add').filter({ hasText: /bible/i }).first();
    await addBibleButton.click();
    await page.waitForTimeout(1500);

    // Verify window was created
    const windowsBeforeClose = page.locator('.window');
    const countBeforeClose = await windowsBeforeClose.count();
    expect(countBeforeClose).toBe(initialCount + 1);

    // Find close button in last window
    const lastWindow = windowsBeforeClose.last();
    const closeButton = lastWindow.locator('.close-button').first();
    await closeButton.click();
    await page.waitForTimeout(500);

    // Verify window count decreased back to initial
    const remainingWindows = page.locator('.window');
    const remainingCount = await remainingWindows.count();
    expect(remainingCount).toBe(initialCount);

    // Verify remaining windows are still functional
    const chapter = page.locator('.chapter').first();
    await expect(chapter).toBeVisible();
  });

  test('should verify independent navigation in separate windows', async ({ page }) => {
    // Count initial windows
    const initialWindows = page.locator('.window');
    const initialCount = await initialWindows.count();

    // Create a new Bible window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addBibleButton = page.locator('#add-bible, .window-add').filter({ hasText: /bible/i }).first();
    await addBibleButton.click();
    await page.waitForTimeout(1500);

    // Verify window was created
    const windows = page.locator('.window');
    const windowCount = await windows.count();
    expect(windowCount).toBe(initialCount + 1);

    // Navigate first window to John 3
    const firstNavInput = page.locator('.text-nav').first();
    await firstNavInput.fill('John 3');
    await firstNavInput.press('Enter');
    await page.waitForTimeout(1500);

    // Get first window's location
    const firstNavValue = await firstNavInput.inputValue();

    // Navigate last window to Romans 8
    const lastNavInput = page.locator('.text-nav').last();
    await lastNavInput.fill('Romans 8');
    await lastNavInput.press('Enter');
    await page.waitForTimeout(1500);

    // Get last window's location
    const lastNavValue = await lastNavInput.inputValue();

    // Verify they navigated to different locations
    expect(firstNavValue.toLowerCase()).toContain('john');
    expect(lastNavValue.toLowerCase()).toContain('rom');
    expect(firstNavValue).not.toBe(lastNavValue);

    // Verify first window is still on John 3
    const firstNavValueCheck = await firstNavInput.inputValue();
    expect(firstNavValueCheck.toLowerCase()).toContain('john');
  });

  test('should verify window count persists across page reload', async ({ page }) => {
    // Count initial windows
    const initialWindows = page.locator('.window');
    const initialCount = await initialWindows.count();

    // Create a new window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addBibleButton = page.locator('#add-bible, .window-add').filter({ hasText: /bible/i }).first();
    await addBibleButton.click();
    await page.waitForTimeout(1500);

    // Count windows before reload
    const windowsBefore = page.locator('.window');
    const windowCountBefore = await windowsBefore.count();
    expect(windowCountBefore).toBe(initialCount + 1);

    // Wait for settings to save (debounced)
    await page.waitForTimeout(1500);

    // Reload page
    await page.reload();
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Verify window count persisted
    const windowsAfter = page.locator('.window');
    const windowCountAfter = await windowsAfter.count();
    expect(windowCountAfter).toBe(windowCountBefore);

    // Verify windows are still functional after reload
    const firstChapter = page.locator('.chapter').first();
    await expect(firstChapter).toBeVisible();
  });
});
