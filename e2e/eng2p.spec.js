import { test, expect } from '@playwright/test';

test.describe('English Second Person Plural Plugin', () => {
  // Default config loads John 1:1 in two windows, so we use .first() to target one

  test('replaces second person plural pronouns in John 1:26', async ({ page }) => {
    // Load with Y'all mode enabled - default starts at John 1
    await page.goto('/?eng2p=yall');

    // Wait for the chapter content to load
    await page.waitForSelector('.chapter', { timeout: 30000 });

    // Wait for the Eng2p plugin to process
    await page.waitForTimeout(500);

    // Find verse 26 (JN1_26) in the first window
    const verse26 = page.locator('[data-id="JN1_26"]').first();
    await expect(verse26).toBeAttached();

    // The verse should have .eng2p-corrected spans with the Y'all replacements
    const correctedSpans = verse26.locator('.eng2p-corrected');
    await expect(correctedSpans.first()).toBeAttached();

    // Check that the corrected text contains "y'all" (plugin uses fancy apostrophe)
    const correctedText = await correctedSpans.first().textContent();
    expect(correctedText.toLowerCase()).toMatch(/y.all/);
  });

  test('highlights second person plural pronouns when highlight mode is selected', async ({ page }) => {
    // Load with highlight mode
    await page.goto('/?eng2p=highlight');

    // Wait for the chapter content to load
    await page.waitForSelector('.chapter', { timeout: 30000 });

    // Wait a moment for the Eng2p plugin to process
    await page.waitForTimeout(500);

    // Find verse 26 in the first window
    const verse26 = page.locator('[data-id="JN1_26"]').first();
    await expect(verse26).toBeAttached();

    // Should have .eng2p-highlight spans
    const highlightSpans = verse26.locator('.eng2p-highlight');
    await expect(highlightSpans.first()).toBeAttached();
  });

  test('does not modify text when mode is none', async ({ page }) => {
    // Load with no transformation
    await page.goto('/?eng2p=none');

    // Wait for the chapter content to load
    await page.waitForSelector('.chapter', { timeout: 30000 });

    // Wait a moment to ensure plugin had a chance to run (or not)
    await page.waitForTimeout(500);

    // Find verse 26 in the first window
    const verse26 = page.locator('[data-id="JN1_26"]').first();
    await expect(verse26).toBeAttached();

    // Should NOT have .eng2p-corrected or .eng2p-highlight spans
    const correctedSpans = verse26.locator('.eng2p-corrected');
    const highlightSpans = verse26.locator('.eng2p-highlight');

    await expect(correctedSpans).toHaveCount(0);
    await expect(highlightSpans).toHaveCount(0);
  });
});
