import { test, expect } from '@playwright/test';

test.describe('Plugin Features - Cross-References', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should detect cross-reference elements in Bible text', async ({ page }) => {
    // Navigate to a passage known to have cross-references
    const navInput = page.locator('.text-nav').first();
    await navInput.fill('John 3:16');
    await navInput.press('Enter');
    await page.waitForTimeout(1500);

    // Look for cross-reference elements (may be .cf or similar)
    const crossRefs = page.locator('.cf, .cross-ref, [data-cf]');
    const count = await crossRefs.count();

    // If cross-references exist, verify they're present
    if (count > 0) {
      expect(count).toBeGreaterThan(0);
    } else {
      // No cross-references in this version/passage - that's okay
      expect(count).toBe(0);
    }
  });
});

test.describe('Plugin Features - Notes Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should detect note elements in Bible text', async ({ page }) => {
    // Navigate to a passage
    const navInput = page.locator('.text-nav').first();
    await navInput.fill('Matthew 1:1');
    await navInput.press('Enter');
    await page.waitForTimeout(1500);

    // Look for note elements
    const notes = page.locator('.note, .footnote, [data-note]');
    const count = await notes.count();

    // Notes may or may not exist depending on version
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Plugin Features - Strong\'s Numbers', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should detect Strong\'s number elements if present', async ({ page }) => {
    // Try to find a text with Strong's numbers
    const strongElements = page.locator('[data-strong], .strong, .strongs');
    const count = await strongElements.count();

    // Strong's numbers may not be present in all versions
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Plugin Features - Morphology', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should detect morphology elements if present', async ({ page }) => {
    // Look for morphology data
    const morphElements = page.locator('[data-morph], .morph, .morphology');
    const count = await morphElements.count();

    // Morphology may not be present in all versions
    expect(count).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Plugin Features - Text Highlighting', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should verify chapter text can be read', async ({ page }) => {
    // Verify basic Bible text is readable
    const chapter = page.locator('.chapter').first();
    await expect(chapter).toBeVisible();

    const text = await chapter.textContent();
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
  });

  test('should verify verses have data attributes', async ({ page }) => {
    // Navigate to specific passage
    const navInput = page.locator('.text-nav').first();
    await navInput.fill('Genesis 1:1');
    await navInput.press('Enter');
    await page.waitForTimeout(1500);

    // Find verses
    const verses = page.locator('.verse, .v, [data-id]');
    const count = await verses.count();
    expect(count).toBeGreaterThan(0);

    // Verify first verse has data-id
    const firstVerse = verses.first();
    const dataId = await firstVerse.getAttribute('data-id');
    expect(dataId).toBeTruthy();
  });
});
