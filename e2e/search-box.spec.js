import { test, expect } from '@playwright/test';

test.describe('MainSearchBox', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should navigate to Bible reference when entered', async ({ page }) => {
    const searchInput = page.locator('#main-search-input');

    // Type a Bible reference
    await searchInput.fill('John 3:16');
    await searchInput.press('Enter');

    // Wait for navigation
    await page.waitForTimeout(1500);

    // Verify navigation occurred
    const navInput = page.locator('.text-nav').first();
    const navText = await navInput.inputValue();
    expect(navText).toContain('John 3:16');

    // Verify search input was cleared
    const searchValue = await searchInput.inputValue();
    expect(searchValue).toBe('');
  });

  test('should navigate using search button click', async ({ page }) => {
    const searchInput = page.locator('#main-search-input');
    const searchButton = page.locator('#main-search-button');

    // Type a Bible reference
    await searchInput.fill('Romans 8:28');
    await searchButton.click();

    // Wait for navigation
    await page.waitForTimeout(1500);

    // Verify navigation occurred
    const navInput = page.locator('.text-nav').first();
    const navText = await navInput.inputValue();
    expect(navText).toContain('Romans 8:28');

    // Verify search input was cleared
    const searchValue = await searchInput.inputValue();
    expect(searchValue).toBe('');
  });

  test('should open search window for non-reference text', async ({ page }) => {
    const searchInput = page.locator('#main-search-input');

    // Count windows before search
    const windowsBefore = await page.locator('.window').count();

    // Type non-reference text that definitely isn't a Bible reference
    await searchInput.fill('salvation and redemption');
    await searchInput.press('Enter');

    // Wait for search window to open
    await page.waitForTimeout(1500);

    // Verify a new window was added
    const windowsAfter = await page.locator('.window').count();
    expect(windowsAfter).toBeGreaterThan(windowsBefore);

    // Verify it's a search window by checking the tab exists
    const searchTab = page.locator('.window-tab.SearchWindow').last();
    expect(await searchTab.count()).toBeGreaterThan(0);

    // Verify search input was cleared
    const searchValue = await searchInput.inputValue();
    expect(searchValue).toBe('');
  });

  test('should handle different Bible reference formats', async ({ page }) => {
    const searchInput = page.locator('#main-search-input');
    const testCases = [
      { input: 'Genesis 1:1', expectedBook: 'Genesis' },
      { input: 'Ps 23', expectedBook: 'Psalm 23' },
      { input: 'Mt 5:3', expectedBook: 'Matthew 5:3' }
    ];

    for (const testCase of testCases) {
      // Type reference
      await searchInput.fill(testCase.input);
      await searchInput.press('Enter');

      // Wait for navigation
      await page.waitForTimeout(1500);

      // Verify navigation occurred
      const navInput = page.locator('.text-nav').first();
      const navText = await navInput.inputValue();
      expect(navText).toContain(testCase.expectedBook);

      // Verify search input was cleared
      const searchValue = await searchInput.inputValue();
      expect(searchValue).toBe('');
    }
  });

  test('should do nothing when search box is empty', async ({ page }) => {
    const searchInput = page.locator('#main-search-input');
    const searchButton = page.locator('#main-search-button');

    // Get initial navigation state
    const navInput = page.locator('.text-nav').first();
    const initialNavText = await navInput.inputValue();

    // Press Enter with empty input
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Verify navigation didn't change
    const navText = await navInput.inputValue();
    expect(navText).toBe(initialNavText);

    // Try with button click
    await searchButton.click();
    await page.waitForTimeout(500);

    // Verify navigation still didn't change
    const navText2 = await navInput.inputValue();
    expect(navText2).toBe(initialNavText);
  });
});
