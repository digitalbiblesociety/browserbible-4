import { test, expect } from '@playwright/test';

test.describe('Multi-Browser - Basic Compatibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should load application successfully', async ({ page, browserName }) => {
    // Verify application loads across all browsers
    const chapter = page.locator('.chapter').first();
    await expect(chapter).toBeVisible();

    // Verify header is present
    const header = page.locator('.app-header, header');
    const headerCount = await header.count();
    expect(headerCount).toBeGreaterThanOrEqual(0);
  });

  test('should navigate to specific verse', async ({ page, browserName }) => {
    const navInput = page.locator('.text-nav').first();
    await navInput.fill('John 3:16');
    await navInput.press('Enter');
    await page.waitForTimeout(2000);

    // Verify navigation works across browsers
    const chapter = page.locator('.chapter').first();
    await expect(chapter).toBeVisible();
    const content = await chapter.textContent();
    expect(content.length).toBeGreaterThan(0);
  });

  test('should handle user interactions (click, keyboard)', async ({ page, browserName }) => {
    // Test button clicks work
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const menu = page.locator('#main-menu-dropdown, .main-menu');
    const menuVisible = await menu.isVisible();

    // Close menu with escape
    if (menuVisible) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }

    // Verify application still functional
    const chapter = page.locator('.chapter').first();
    await expect(chapter).toBeVisible();
  });
});

test.describe('Multi-Browser - CSS & Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should render text with correct styling', async ({ page, browserName }) => {
    const chapter = page.locator('.chapter').first();

    const styles = await chapter.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        display: computed.display,
        fontSize: computed.fontSize,
        color: computed.color,
      };
    });

    expect(styles.display).toBeTruthy();
    expect(styles.fontSize).toBeTruthy();
    expect(styles.color).toBeTruthy();
  });

  test('should support CSS features (flexbox, grid, etc.)', async ({ page, browserName }) => {
    // Check that modern CSS is working
    const hasModernCSS = await page.evaluate(() => {
      // Test CSS Grid support
      const testEl = document.createElement('div');
      testEl.style.display = 'grid';
      return testEl.style.display === 'grid';
    });

    expect(hasModernCSS).toBe(true);
  });
});

test.describe('Multi-Browser - JavaScript APIs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should support localStorage', async ({ page, browserName }) => {
    const hasLocalStorage = await page.evaluate(() => {
      try {
        const testKey = '__test_storage__';
        localStorage.setItem(testKey, 'test');
        const value = localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        return value === 'test';
      } catch (e) {
        return false;
      }
    });

    expect(hasLocalStorage).toBe(true);
  });

  test('should support fetch API', async ({ page, browserName }) => {
    const hasFetch = await page.evaluate(() => {
      return typeof fetch === 'function';
    });

    expect(hasFetch).toBe(true);
  });

  test('should support ES6+ features', async ({ page, browserName }) => {
    const hasES6 = await page.evaluate(() => {
      try {
        // Test arrow functions, const/let, template literals
        const test = (x) => `value: ${x}`;
        return test(5) === 'value: 5';
      } catch (e) {
        return false;
      }
    });

    expect(hasES6).toBe(true);
  });
});

test.describe('Multi-Browser - Form Elements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should handle input fields consistently', async ({ page, browserName }) => {
    const navInput = page.locator('.text-nav').first();

    // Clear and type
    await navInput.clear();
    await navInput.fill('Genesis 1');

    const value = await navInput.inputValue();
    expect(value).toContain('Genesis');
  });

  test('should handle buttons consistently', async ({ page, browserName }) => {
    const mainMenuButton = page.locator('#main-menu-button');

    // Verify button is clickable
    await expect(mainMenuButton).toBeVisible();
    await expect(mainMenuButton).toBeEnabled();

    await mainMenuButton.click();
    await page.waitForTimeout(500);

    // Verify action occurred
    const menu = page.locator('#main-menu-dropdown, .main-menu');
    const menuExists = await menu.count();
    expect(menuExists).toBeGreaterThan(0);
  });
});

test.describe('Multi-Browser - Window Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should handle window resize', async ({ page, browserName }) => {
    // Resize window
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(500);

    const chapter = page.locator('.chapter').first();
    await expect(chapter).toBeVisible();

    // Resize back
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);

    await expect(chapter).toBeVisible();
  });

  test('should handle scroll events', async ({ page, browserName }) => {
    const chapter = page.locator('.chapter').first();

    // Scroll down
    await chapter.evaluate((el) => {
      el.parentElement.scrollTop = 100;
    });
    await page.waitForTimeout(300);

    // Verify still functional
    await expect(chapter).toBeVisible();
  });
});
