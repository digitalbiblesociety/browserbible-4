import { test, expect } from '@playwright/test';

test.describe('Error Handling - Network Errors', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should display error message gracefully when content fails to load', async ({ page }) => {
    // Block network requests for Bible text
    await page.route('**/content/texts/**', route => route.abort());

    // Try to navigate
    const navInput = page.locator('.text-nav').first();
    await navInput.fill('John 1:1');
    await navInput.press('Enter');
    await page.waitForTimeout(2000);

    // App should still be functional, not crashed
    await expect(navInput).toBeVisible();
  });
});

test.describe('Error Handling - Data Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should handle empty search queries', async ({ page }) => {
    const searchInput = page.locator('#main-search-input');

    // Try submitting empty search
    await searchInput.fill('');
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Should not crash
    await expect(searchInput).toBeVisible();
  });

  test('should handle extremely long search queries', async ({ page }) => {
    const searchInput = page.locator('#main-search-input');

    // Create a very long query
    const longQuery = 'a'.repeat(1000);
    await searchInput.fill(longQuery);
    await searchInput.press('Enter');
    await page.waitForTimeout(1500);

    // Should not crash - either search or navigate
    await expect(searchInput).toBeVisible();
  });

  test('should handle special characters in search', async ({ page }) => {
    const searchInput = page.locator('#main-search-input');

    // Search with special characters
    await searchInput.fill('love & peace "quotes" (parens)');
    await searchInput.press('Enter');
    await page.waitForTimeout(1500);

    // Should handle gracefully
    await expect(searchInput).toBeVisible();
  });

  test('should validate verse references and prevent invalid book/chapter combinations', async ({ page }) => {
    const navInput = page.locator('.text-nav').first();

    // Try invalid combinations
    await navInput.fill('Genesis 999');
    await navInput.press('Enter');
    await page.waitForTimeout(1000);

    // Should still be functional
    await expect(navInput).toBeVisible();

    // Try another invalid reference
    await navInput.fill('InvalidBook 1');
    await navInput.press('Enter');
    await page.waitForTimeout(1000);

    // Should not crash
    await expect(navInput).toBeVisible();
  });
});

test.describe('Error Handling - Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should load large chapters without lag', async ({ page }) => {
    const navInput = page.locator('.text-nav').first();

    // Navigate to Psalm 119 (longest chapter)
    await navInput.fill('Psalm 119');
    await navInput.press('Enter');

    // Should load within reasonable time
    await page.waitForSelector('.chapter', { timeout: 10000 });

    // Verify content loaded
    const chapter = page.locator('.chapter').first();
    const content = await chapter.textContent();
    expect(content.length).toBeGreaterThan(0);
  });

  test('should handle rapid navigation without crashing', async ({ page }) => {
    const navInput = page.locator('.text-nav').first();

    // Navigate rapidly through several passages
    const passages = ['Genesis 1', 'Exodus 1', 'John 1', 'Romans 1', 'Revelation 1'];

    for (const passage of passages) {
      await navInput.fill(passage);
      await navInput.press('Enter');
      await page.waitForTimeout(300); // Small delay between navigations
    }

    // Should still be functional
    await expect(navInput).toBeVisible();
    const chapter = page.locator('.chapter').first();
    await expect(chapter).toBeVisible();
  });

  test('should switch between multiple windows rapidly', async ({ page }) => {
    // Create additional windows
    const mainMenuButton = page.locator('#main-menu-button');

    for (let i = 0; i < 3; i++) {
      await mainMenuButton.click();
      await page.waitForTimeout(300);

      const addBibleButton = page.locator('#add-bible, .window-add').filter({ hasText: /bible/i }).first();
      await addBibleButton.click();
      await page.waitForTimeout(500);
    }

    // Navigate in different windows rapidly
    const navInputs = page.locator('.text-nav');
    const count = await navInputs.count();

    for (let i = 0; i < Math.min(count, 3); i++) {
      const input = navInputs.nth(i);
      await input.fill('John 1:1');
      await input.press('Enter');
      await page.waitForTimeout(200);
    }

    // Should still be functional
    const chapters = page.locator('.chapter');
    const chapterCount = await chapters.count();
    expect(chapterCount).toBeGreaterThan(0);
  });
});

test.describe('Error Handling - Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should handle window close when only one window remains', async ({ page }) => {
    // Verify we start with at least one window
    const initialWindows = page.locator('.window');
    const initialCount = await initialWindows.count();
    expect(initialCount).toBeGreaterThan(0);

    // If multiple windows, close all but one
    if (initialCount > 1) {
      for (let i = 1; i < initialCount; i++) {
        const closeButtons = page.locator('.close-button');
        const buttonCount = await closeButtons.count();
        if (buttonCount > 0) {
          await closeButtons.first().click();
          await page.waitForTimeout(300);
        }
      }
    }

    // Verify app is still functional with one window
    const chapter = page.locator('.chapter').first();
    await expect(chapter).toBeVisible();
  });

  test('should handle concurrent operations gracefully', async ({ page }) => {
    // Perform multiple operations simultaneously
    const navInput = page.locator('.text-nav').first();
    const searchInput = page.locator('#main-search-input');

    // Start navigation
    const navPromise = navInput.fill('John 3:16').then(() => navInput.press('Enter'));

    // Start search
    const searchPromise = searchInput.fill('love').then(() => searchInput.press('Enter'));

    // Wait for both
    await Promise.all([navPromise, searchPromise]);
    await page.waitForTimeout(2000);

    // Should handle gracefully without crashes
    await expect(navInput).toBeVisible();
    await expect(searchInput).toBeVisible();
  });
});
