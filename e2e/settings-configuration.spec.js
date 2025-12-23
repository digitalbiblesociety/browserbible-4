import { test, expect } from '@playwright/test';

test.describe('Settings & Configuration - Font Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should open settings dialog', async ({ page }) => {
    // Open main menu
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    // Click settings button
    const settingsButton = page.locator('.main-menu-item.image-config').first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Verify settings window opened
    const configWindow = page.locator('.config-window, #main-config-box');
    await expect(configWindow).toBeVisible();
  });

  test('should increase font size and verify text scales', async ({ page }) => {
    // Get initial font size from body class
    const initialBodyClasses = await page.locator('body').getAttribute('class');

    // Open settings
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const settingsButton = page.locator('.main-menu-item.image-config').first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Find font size slider
    const fontSizeSlider = page.locator('#font-size-table input[type="range"]');
    await expect(fontSizeSlider).toBeVisible();

    // Get current value
    const currentValue = await fontSizeSlider.inputValue();
    const currentSize = parseInt(currentValue);

    // Increase font size (add 2px)
    const newSize = currentSize + 2;
    await fontSizeSlider.fill(newSize.toString());
    await page.waitForTimeout(300);

    // Verify body has new font size class
    const bodyClasses = await page.locator('body').getAttribute('class');
    expect(bodyClasses).toContain(`config-font-size-${newSize}`);
    expect(bodyClasses).not.toContain(`config-font-size-${currentSize}`);

    // Verify text actually changed size
    const verseText = page.locator('.reading-text').first();
    const fontSize = await verseText.evaluate((el) => {
      return window.getComputedStyle(el).fontSize;
    });
    expect(fontSize).toBe(`${newSize}px`);
  });

  test('should decrease font size and verify text scales', async ({ page }) => {
    // Open settings
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const settingsButton = page.locator('.main-menu-item.image-config').first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Find font size slider
    const fontSizeSlider = page.locator('#font-size-table input[type="range"]');
    await expect(fontSizeSlider).toBeVisible();

    // Get current value
    const currentValue = await fontSizeSlider.inputValue();
    const currentSize = parseInt(currentValue);

    // Get min value to ensure we don't go below it
    const minValue = await fontSizeSlider.getAttribute('min');
    const minSize = parseInt(minValue);

    // Only decrease if we're above minimum
    if (currentSize > minSize) {
      const newSize = currentSize - 2;
      await fontSizeSlider.fill(newSize.toString());
      await page.waitForTimeout(300);

      // Verify body has new font size class
      const bodyClasses = await page.locator('body').getAttribute('class');
      expect(bodyClasses).toContain(`config-font-size-${newSize}`);

      // Verify text actually changed size
      const verseText = page.locator('.reading-text').first();
      const fontSize = await verseText.evaluate((el) => {
        return window.getComputedStyle(el).fontSize;
      });
      expect(fontSize).toBe(`${newSize}px`);
    } else {
      // Already at minimum, just verify it works
      expect(currentSize).toBe(minSize);
    }
  });

  test('should verify font settings persist across reload', async ({ page }) => {
    // Open settings
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const settingsButton = page.locator('.main-menu-item.image-config').first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Change font size
    const fontSizeSlider = page.locator('#font-size-table input[type="range"]');
    const currentValue = await fontSizeSlider.inputValue();
    const currentSize = parseInt(currentValue);
    const newSize = currentSize + 4; // Change by 4px to make it noticeable

    await fontSizeSlider.fill(newSize.toString());
    await page.waitForTimeout(500);

    // Verify change applied
    const bodyClassesBefore = await page.locator('body').getAttribute('class');
    expect(bodyClassesBefore).toContain(`config-font-size-${newSize}`);

    // Wait for settings to save
    await page.waitForTimeout(1000);

    // Reload page
    await page.reload();
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);

    // Verify font size persisted
    const bodyClassesAfter = await page.locator('body').getAttribute('class');
    expect(bodyClassesAfter).toContain(`config-font-size-${newSize}`);
  });
});

test.describe('Settings & Configuration - Theme Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should toggle dark mode on and verify styles', async ({ page }) => {
    // Open settings
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const settingsButton = page.locator('.main-menu-item.image-config').first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Click dark theme
    const darkThemeButton = page.locator('#config-theme-dark');
    await expect(darkThemeButton).toBeVisible();
    await darkThemeButton.click();
    await page.waitForTimeout(300);

    // Verify body has dark theme class
    const bodyClasses = await page.locator('body').getAttribute('class');
    expect(bodyClasses).toContain('theme-dark');
    expect(bodyClasses).not.toContain('theme-default');
    expect(bodyClasses).not.toContain('theme-sepia');

    // Verify dark theme button is selected
    const darkThemeClasses = await darkThemeButton.getAttribute('class');
    expect(darkThemeClasses).toContain('config-theme-toggle-selected');
  });

  test('should toggle dark mode off and verify light theme', async ({ page }) => {
    // First enable dark mode
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const settingsButton = page.locator('.main-menu-item.image-config').first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    const darkThemeButton = page.locator('#config-theme-dark');
    await darkThemeButton.click();
    await page.waitForTimeout(300);

    // Verify dark mode is on
    let bodyClasses = await page.locator('body').getAttribute('class');
    expect(bodyClasses).toContain('theme-dark');

    // Switch back to default theme
    const defaultThemeButton = page.locator('#config-theme-default');
    await defaultThemeButton.click();
    await page.waitForTimeout(300);

    // Verify default theme is active
    bodyClasses = await page.locator('body').getAttribute('class');
    expect(bodyClasses).toContain('theme-default');
    expect(bodyClasses).not.toContain('theme-dark');

    // Verify default theme button is selected
    const defaultThemeClasses = await defaultThemeButton.getAttribute('class');
    expect(defaultThemeClasses).toContain('config-theme-toggle-selected');
  });

  test('should verify theme setting persists across reload', async ({ page }) => {
    // Open settings and switch to dark theme
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const settingsButton = page.locator('.main-menu-item.image-config').first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    const darkThemeButton = page.locator('#config-theme-dark');
    await darkThemeButton.click();
    await page.waitForTimeout(500);

    // Verify dark mode applied
    const bodyClassesBefore = await page.locator('body').getAttribute('class');
    expect(bodyClassesBefore).toContain('theme-dark');

    // Wait for settings to save
    await page.waitForTimeout(1000);

    // Reload page
    await page.reload();
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);

    // Verify dark theme persisted
    const bodyClassesAfter = await page.locator('body').getAttribute('class');
    expect(bodyClassesAfter).toContain('theme-dark');
  });

  test('should verify sepia theme applies correctly', async ({ page }) => {
    // Open settings
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const settingsButton = page.locator('.main-menu-item.image-config').first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    // Click sepia theme
    const sepiaThemeButton = page.locator('#config-theme-sepia');
    await expect(sepiaThemeButton).toBeVisible();
    await sepiaThemeButton.click();
    await page.waitForTimeout(300);

    // Verify body has sepia theme class
    const bodyClasses = await page.locator('body').getAttribute('class');
    expect(bodyClasses).toContain('theme-sepia');
    expect(bodyClasses).not.toContain('theme-default');
    expect(bodyClasses).not.toContain('theme-dark');

    // Verify sepia theme button is selected
    const sepiaThemeClasses = await sepiaThemeButton.getAttribute('class');
    expect(sepiaThemeClasses).toContain('config-theme-toggle-selected');
  });
});

test.describe('Settings & Configuration - Theme Applies to All Windows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should verify theme applies to all windows', async ({ page }) => {
    // Create a second window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addBibleButton = page.locator('#add-bible, .window-add').filter({ hasText: /bible/i }).first();
    await addBibleButton.click();
    await page.waitForTimeout(1500);

    // Verify we have multiple windows
    const windows = page.locator('.window');
    const windowCount = await windows.count();
    expect(windowCount).toBeGreaterThan(1);

    // Open settings and change theme
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const settingsButton = page.locator('.main-menu-item.image-config').first();
    await settingsButton.click();
    await page.waitForTimeout(500);

    const darkThemeButton = page.locator('#config-theme-dark');
    await darkThemeButton.click();
    await page.waitForTimeout(300);

    // Verify theme applied to body (affects all windows)
    const bodyClasses = await page.locator('body').getAttribute('class');
    expect(bodyClasses).toContain('theme-dark');

    // Verify all windows are visible and functional with dark theme
    for (let i = 0; i < windowCount; i++) {
      const window = windows.nth(i);
      await expect(window).toBeVisible();
    }
  });
});
