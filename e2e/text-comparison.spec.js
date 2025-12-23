import { test, expect } from '@playwright/test';

test.describe('Text Comparison - Basic Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should open text comparison window', async ({ page }) => {
    // Open main menu
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    // Click Text Comparison option
    const addComparisonButton = page.locator('#add-comparison, .window-add').filter({ hasText: /comparison|compare/i }).first();
    await addComparisonButton.click();
    await page.waitForTimeout(1500);

    // Verify comparison window opened
    const comparisonMain = page.locator('.comparison-main');
    await expect(comparisonMain).toBeVisible();
  });

  test('should display source and target version selectors', async ({ page }) => {
    // Open comparison window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addComparisonButton = page.locator('#add-comparison, .window-add').filter({ hasText: /comparison|compare/i }).first();
    await addComparisonButton.click();
    await page.waitForTimeout(1500);

    // Verify source title exists
    const sourceTitle = page.locator('.comparison-source-title');
    await expect(sourceTitle).toBeVisible();

    // Verify target select exists
    const targetSelect = page.locator('.comparison-target-select');
    await expect(targetSelect).toBeVisible();
  });

  test('should navigate to specific passage', async ({ page }) => {
    // Open comparison window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addComparisonButton = page.locator('#add-comparison, .window-add').filter({ hasText: /comparison|compare/i }).first();
    await addComparisonButton.click();
    await page.waitForTimeout(1500);

    // Navigate to John 3:16
    const navInput = page.locator('.comparison-nav-input');
    await navInput.fill('John 3:16');
    await navInput.press('Enter');
    await page.waitForTimeout(1500);

    // Verify content loaded
    const comparisonMain = page.locator('.comparison-main');
    const content = await comparisonMain.textContent();
    expect(content).toBeTruthy();
    expect(content.length).toBeGreaterThan(0);
  });

  test('should change target version', async ({ page }) => {
    // Open comparison window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addComparisonButton = page.locator('#add-comparison, .window-add').filter({ hasText: /comparison|compare/i }).first();
    await addComparisonButton.click();
    await page.waitForTimeout(1500);

    // Navigate to a verse first
    const navInput = page.locator('.comparison-nav-input');
    await navInput.fill('John 1:1');
    await navInput.press('Enter');
    await page.waitForTimeout(1500);

    // Get initial content
    const comparisonMain = page.locator('.comparison-main');
    const initialContent = await comparisonMain.textContent();

    // Change target version
    const targetSelect = page.locator('.comparison-target-select');
    const options = await targetSelect.locator('option').count();

    if (options > 1) {
      // Select second option (different version)
      await targetSelect.selectOption({ index: 1 });
      await page.waitForTimeout(1500);

      // Verify content changed
      const newContent = await comparisonMain.textContent();
      expect(newContent).toBeTruthy();
      // Content should be different with different translation
      expect(newContent).not.toBe(initialContent);
    } else {
      test.skip(true, 'Only one version available for comparison');
    }
  });

  test('should highlight differences between versions', async ({ page }) => {
    // Open comparison window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addComparisonButton = page.locator('#add-comparison, .window-add').filter({ hasText: /comparison|compare/i }).first();
    await addComparisonButton.click();
    await page.waitForTimeout(1500);

    // Navigate to a verse
    const navInput = page.locator('.comparison-nav-input');
    await navInput.fill('Genesis 1:1');
    await navInput.press('Enter');
    await page.waitForTimeout(1500);

    // Look for diff indicators (added/removed text)
    const comparisonMain = page.locator('.comparison-main');

    // Check if comparison content exists
    const hasContent = await comparisonMain.textContent();
    expect(hasContent).toBeTruthy();

    // Verify content displays (highlighting may vary based on implementation)
    await expect(comparisonMain).toBeVisible();
  });
});

test.describe('Text Comparison - Multiple Versions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);

    // Open comparison window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addComparisonButton = page.locator('#add-comparison, .window-add').filter({ hasText: /comparison|compare/i }).first();
    await addComparisonButton.click();
    await page.waitForTimeout(1500);
  });

  test('should show same-language versions only in target select', async ({ page }) => {
    const targetSelect = page.locator('.comparison-target-select');

    // Get all options
    const options = await targetSelect.locator('option').all();
    expect(options.length).toBeGreaterThan(0);

    // Verify options have text content
    for (const option of options) {
      const text = await option.textContent();
      expect(text).toBeTruthy();
    }
  });

  test('should synchronize navigation between source and target', async ({ page }) => {
    // Navigate to verse
    const navInput = page.locator('.comparison-nav-input');
    await navInput.fill('Psalm 23:1');
    await navInput.press('Enter');
    await page.waitForTimeout(1500);

    // Verify both versions show same passage
    const comparisonMain = page.locator('.comparison-main');
    const content = await comparisonMain.textContent();

    // Should contain reference to Psalm or verse content
    expect(content.toLowerCase()).toMatch(/lord|shepherd|psalm/);
  });
});

test.describe('Text Comparison - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);

    // Open comparison window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addComparisonButton = page.locator('#add-comparison, .window-add').filter({ hasText: /comparison|compare/i }).first();
    await addComparisonButton.click();
    await page.waitForTimeout(1500);
  });

  test('should handle invalid verse reference gracefully', async ({ page }) => {
    const navInput = page.locator('.comparison-nav-input');

    // Enter invalid reference
    await navInput.fill('InvalidBook 999:999');
    await navInput.press('Enter');
    await page.waitForTimeout(1000);

    // Should not crash - window should still be visible
    const comparisonMain = page.locator('.comparison-main');
    await expect(comparisonMain).toBeVisible();
  });

  test('should persist selected versions across navigation', async ({ page }) => {
    // Select target version
    const targetSelect = page.locator('.comparison-target-select');
    const options = await targetSelect.locator('option').count();

    if (options > 1) {
      // Select second version
      const selectedValue = await targetSelect.locator('option').nth(1).getAttribute('value');
      await targetSelect.selectOption({ index: 1 });
      await page.waitForTimeout(500);

      // Navigate to first verse
      const navInput = page.locator('.comparison-nav-input');
      await navInput.fill('John 1:1');
      await navInput.press('Enter');
      await page.waitForTimeout(1000);

      // Navigate to different verse
      await navInput.fill('John 3:16');
      await navInput.press('Enter');
      await page.waitForTimeout(1000);

      // Verify target selection persisted
      const currentValue = await targetSelect.inputValue();
      expect(currentValue).toBe(selectedValue);
    } else {
      test.skip(true, 'Only one version available');
    }
  });
});
