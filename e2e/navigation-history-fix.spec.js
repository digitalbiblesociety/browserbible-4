import { test, expect } from '@playwright/test';

test.describe('Navigation History Fix', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should NOT add history entry when scrolling through verses', async ({ page }) => {
    const navInput = page.locator('.text-nav').first();
    const backButton = page.locator('#main-back-button');

    // Start at John 1:1
    await navInput.click({ force: true });
    await page.waitForTimeout(500);
    const navPopover = page.locator('.text-navigator');
    await navPopover.waitFor({ state: 'visible', timeout: 5000 });

    const johnChapter = page.locator('.text-navigator-section[data-id="JN1"]').first();
    await johnChapter.click({ force: true });
    await page.waitForTimeout(1500);

    // Verify we're at John 1
    const currentNav = await navInput.inputValue();
    expect(currentNav).toContain('John 1');

    // Back button should be inactive (no history yet since this was initial load)
    const backButtonClass = await backButton.getAttribute('class');
    expect(backButtonClass).toContain('inactive');

    // Scroll down to trigger verse changes (John 1:1 -> 1:10, etc)
    const scrollerMain = page.locator('.scroller-main').first();
    await scrollerMain.evaluate((el) => {
      el.scrollTop = 500;
    });
    await page.waitForTimeout(500);

    // Scroll more
    await scrollerMain.evaluate((el) => {
      el.scrollTop = 1000;
    });
    await page.waitForTimeout(500);

    // Back button should STILL be inactive (scrolling doesn't add history)
    const backButtonClassAfterScroll = await backButton.getAttribute('class');
    expect(backButtonClassAfterScroll).toContain('inactive');
  });

  test('should add history entry when explicitly navigating via input', async ({ page }) => {
    const navInput = page.locator('.text-nav').first();
    const backButton = page.locator('#main-back-button');

    // Navigate to John 3:16 explicitly via input
    await navInput.click({ force: true });
    await page.waitForTimeout(300);
    await navInput.fill('John 3:16');
    await navInput.press('Enter');
    await page.waitForTimeout(1500);

    // Verify we're at John 3:16
    let currentNav = await navInput.inputValue();
    expect(currentNav).toContain('John 3:16');

    // Navigate to Romans 8:28 explicitly via input
    await navInput.click({ force: true });
    await page.waitForTimeout(300);
    await navInput.fill('Romans 8:28');
    await navInput.press('Enter');
    await page.waitForTimeout(1500);

    // Verify we're at Romans 8:28
    currentNav = await navInput.inputValue();
    expect(currentNav).toContain('Romans 8:28');

    // Back button should now be active (explicit navigation created history)
    const backButtonClass = await backButton.getAttribute('class');
    expect(backButtonClass).not.toContain('inactive');

    // Click back button
    await backButton.click();
    await page.waitForTimeout(1500);

    // Should be back at John 3:16
    currentNav = await navInput.inputValue();
    expect(currentNav).toContain('John 3:16');
  });

  test('should add history entry when navigating via dropdown', async ({ page }) => {
    const navInput = page.locator('.text-nav').first();
    const backButton = page.locator('#main-back-button');

    // Navigate to John 1 via dropdown
    await navInput.click({ force: true });
    await page.waitForTimeout(500);
    const navPopover = page.locator('.text-navigator');
    await navPopover.waitFor({ state: 'visible', timeout: 5000 });

    const johnChapter = page.locator('.text-navigator-section[data-id="JN1"]').first();
    await johnChapter.click({ force: true });
    await page.waitForTimeout(1500);

    // Verify we're at John 1
    let currentNav = await navInput.inputValue();
    expect(currentNav).toContain('John 1');

    // Navigate to John 2 via dropdown
    await navInput.click({ force: true });
    await page.waitForTimeout(500);
    await navPopover.waitFor({ state: 'visible', timeout: 5000 });

    const john2Chapter = page.locator('.text-navigator-section[data-id="JN2"]').first();
    await john2Chapter.click({ force: true });
    await page.waitForTimeout(1500);

    // Verify we're at John 2
    currentNav = await navInput.inputValue();
    expect(currentNav).toContain('John 2');

    // Back button should be active
    const backButtonClass = await backButton.getAttribute('class');
    expect(backButtonClass).not.toContain('inactive');

    // Click back
    await backButton.click();
    await page.waitForTimeout(1500);

    // Should be back at John 1
    currentNav = await navInput.inputValue();
    expect(currentNav).toContain('John 1');
  });

  test('should handle multiple explicit navigations correctly', async ({ page }) => {
    const navInput = page.locator('.text-nav').first();
    const backButton = page.locator('#main-back-button');
    const forwardButton = page.locator('#main-forward-button');

    // Navigate to several locations explicitly
    const locations = ['John 1:1', 'John 3:16', 'Romans 8:28', 'Psalm 23:1'];

    for (const location of locations) {
      await navInput.click({ force: true });
      await page.waitForTimeout(300);
      await navInput.fill(location);
      await navInput.press('Enter');
      await page.waitForTimeout(1500);
    }

    // Verify we're at the last location
    let currentNav = await navInput.inputValue();
    expect(currentNav).toContain('Psalm 23');

    // Back button should be active
    let backButtonClass = await backButton.getAttribute('class');
    expect(backButtonClass).not.toContain('inactive');

    // Go back through history
    await backButton.click();
    await page.waitForTimeout(1500);
    currentNav = await navInput.inputValue();
    expect(currentNav).toContain('Romans 8:28');

    await backButton.click();
    await page.waitForTimeout(1500);
    currentNav = await navInput.inputValue();
    expect(currentNav).toContain('John 3:16');

    // Forward button should now be active
    const forwardButtonClass = await forwardButton.getAttribute('class');
    expect(forwardButtonClass).not.toContain('inactive');

    // Go forward
    await forwardButton.click();
    await page.waitForTimeout(1500);
    currentNav = await navInput.inputValue();
    expect(currentNav).toContain('Romans 8:28');
  });
});
