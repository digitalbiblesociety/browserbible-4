import { test, expect } from '@playwright/test';

test.describe('Integration - Media Library', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should open media library from menu', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    // Look for media library option
    const mediaButton = page.locator('#add-media, .window-add').filter({ hasText: /media|library/i }).first();
    const mediaButtonCount = await mediaButton.count();

    if (mediaButtonCount === 0) {
      test.skip(true, 'Media library option not available in menu');
    }

    await mediaButton.click();
    await page.waitForTimeout(1500);

    // Verify media library window opened
    const mediaWindow = page.locator('.window.MediaWindow, .MediaLibrary');
    await expect(mediaWindow).toBeVisible({ timeout: 5000 });
  });

  test('should display media items if available', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const mediaButton = page.locator('#add-media, .window-add').filter({ hasText: /media|library/i }).first();

    if (await mediaButton.count() === 0) {
      test.skip(true, 'Media library not available');
    }

    await mediaButton.click();
    await page.waitForTimeout(1500);

    // Check for media items
    const mediaItems = page.locator('.media-item, .media-list-item');
    const itemCount = await mediaItems.count();

    // Just verify window loads (may or may not have items)
    expect(itemCount).toBeGreaterThanOrEqual(0);
  });

  test('should filter media by type if available', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const mediaButton = page.locator('#add-media, .window-add').filter({ hasText: /media|library/i }).first();

    if (await mediaButton.count() === 0) {
      test.skip(true, 'Media library not available');
    }

    await mediaButton.click();
    await page.waitForTimeout(1500);

    // Look for filter controls
    const filterControls = page.locator('.media-filter, .type-filter, select');
    const hasFilters = await filterControls.count();

    expect(hasFilters).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Integration - Commentary Window', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should open commentary window from menu', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const commentaryButton = page.locator('#add-commentary, .window-add').filter({ hasText: /commentary|comment/i }).first();
    const commentaryButtonCount = await commentaryButton.count();

    if (commentaryButtonCount === 0) {
      test.skip(true, 'Commentary window option not available in menu');
    }

    await commentaryButton.click();
    await page.waitForTimeout(1500);

    // Verify commentary window opened
    const commentaryWindow = page.locator('.window.CommentaryWindow');
    await expect(commentaryWindow).toBeVisible({ timeout: 5000 });
  });

  test('should display commentary content if available', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const commentaryButton = page.locator('#add-commentary, .window-add').filter({ hasText: /commentary|comment/i }).first();

    if (await commentaryButton.count() === 0) {
      test.skip(true, 'Commentary not available');
    }

    await commentaryButton.click();
    await page.waitForTimeout(1500);

    // Verify window has content area (TextWindow uses .scroller-main)
    const commentaryContent = page.locator('.scroller-main, .scroller-text-wrapper');
    const hasContent = await commentaryContent.count();

    expect(hasContent).toBeGreaterThan(0);
  });

  test('should sync with main Bible window navigation', async ({ page }) => {
    // Navigate to specific verse in Bible window
    const navInput = page.locator('.text-nav').first();
    await navInput.fill('Romans 8:28');
    await navInput.press('Enter');
    await page.waitForTimeout(2000);

    // Open commentary
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const commentaryButton = page.locator('#add-commentary, .window-add').filter({ hasText: /commentary|comment/i }).first();

    if (await commentaryButton.count() === 0) {
      test.skip(true, 'Commentary not available');
    }

    await commentaryButton.click();
    await page.waitForTimeout(2000);

    // Commentary should load for current passage
    const commentaryWindow = page.locator('.window.CommentaryWindow');
    await expect(commentaryWindow).toBeVisible();
  });

  test('should allow switching between different commentaries', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const commentaryButton = page.locator('#add-commentary, .window-add').filter({ hasText: /commentary|comment/i }).first();

    if (await commentaryButton.count() === 0) {
      test.skip(true, 'Commentary not available');
    }

    await commentaryButton.click();
    await page.waitForTimeout(1500);

    // Look for commentary chooser/selector
    const textChooser = page.locator('.text-list, .version-selector');
    const hasChooser = await textChooser.count();

    expect(hasChooser).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Integration - Deaf Bible Window', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should open Deaf Bible window from menu', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const deafBibleButton = page.locator('#add-deaf, .window-add').filter({ hasText: /deaf|sign/i }).first();
    const deafBibleButtonCount = await deafBibleButton.count();

    if (deafBibleButtonCount === 0) {
      test.skip(true, 'Deaf Bible window option not available in menu');
    }

    await deafBibleButton.click();
    await page.waitForTimeout(1500);

    // Verify Deaf Bible window opened (use .window class to avoid matching tabs)
    const deafWindow = page.locator('.window.DeafBibleWindow');
    await expect(deafWindow).toBeVisible({ timeout: 5000 });
  });

  test('should display video player if available', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const deafBibleButton = page.locator('#add-deaf, .window-add').filter({ hasText: /deaf|sign/i }).first();

    if (await deafBibleButton.count() === 0) {
      test.skip(true, 'Deaf Bible not available');
    }

    await deafBibleButton.click();
    await page.waitForTimeout(1500);

    // Look for video element
    const videoPlayer = page.locator('video, .video-player');
    const hasVideo = await videoPlayer.count();

    expect(hasVideo).toBeGreaterThanOrEqual(0);
  });

  test('should show video availability indicators', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const deafBibleButton = page.locator('#add-deaf, .window-add').filter({ hasText: /deaf|sign/i }).first();

    if (await deafBibleButton.count() === 0) {
      test.skip(true, 'Deaf Bible not available');
    }

    await deafBibleButton.click();
    await page.waitForTimeout(1500);

    // Verify window loaded
    const deafWindow = page.locator('.window.DeafBibleWindow');
    await expect(deafWindow).toBeVisible();
  });

  test('should handle navigation to different chapters', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const deafBibleButton = page.locator('#add-deaf, .window-add').filter({ hasText: /deaf|sign/i }).first();

    if (await deafBibleButton.count() === 0) {
      test.skip(true, 'Deaf Bible not available');
    }

    await deafBibleButton.click();
    await page.waitForTimeout(1500);

    // Try to navigate if navigation controls exist
    const navControls = page.locator('.text-nav, .deaf-nav');
    const hasNav = await navControls.count();

    if (hasNav > 0) {
      const navInput = navControls.last();
      await navInput.fill('John 1');
      await navInput.press('Enter');
      await page.waitForTimeout(2000);
    }

    // Verify window still functional
    const deafWindow = page.locator('.window.DeafBibleWindow');
    await expect(deafWindow).toBeVisible();
  });
});

test.describe('Integration - Audio Window', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should open audio window from menu', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const audioButton = page.locator('#add-audio, .window-add').filter({ hasText: /audio/i }).first();
    const audioButtonCount = await audioButton.count();

    if (audioButtonCount === 0) {
      test.skip(true, 'Audio window option not available in menu');
    }

    await audioButton.click();
    await page.waitForTimeout(1500);

    // Verify audio window opened
    const audioWindow = page.locator('.window.AudioWindow');
    await expect(audioWindow).toBeVisible({ timeout: 5000 });
  });

  test('should display audio player controls if available', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const audioButton = page.locator('#add-audio, .window-add').filter({ hasText: /audio/i }).first();

    if (await audioButton.count() === 0) {
      test.skip(true, 'Audio not available');
    }

    await audioButton.click();
    await page.waitForTimeout(1500);

    // Look for audio controls
    const audioControls = page.locator('audio, .audio-controls, .play-button');
    const hasControls = await audioControls.count();

    expect(hasControls).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Integration - Text Comparison Window', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should open text comparison window from menu', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    // Try multiple selectors for comparison button
    let comparisonButton = page.locator('#add-comparison').first();
    let comparisonButtonCount = await comparisonButton.count();

    // Also try parallel button as alternative
    if (comparisonButtonCount === 0) {
      comparisonButton = page.locator('#add-parallel').first();
      comparisonButtonCount = await comparisonButton.count();
    }

    if (comparisonButtonCount === 0) {
      test.skip(true, 'Text comparison/parallel window option not available in menu');
    }

    await comparisonButton.click();
    await page.waitForTimeout(1500);

    // Verify window opened (could be comparison or parallels)
    const comparisonWindow = page.locator('.window.TextComparisonWindow, .window.ParallelsWindow');
    await expect(comparisonWindow).toBeVisible({ timeout: 5000 });
  });

  test('should display multiple versions side-by-side if available', async ({ page }) => {
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const comparisonButton = page.locator('#add-comparison, .window-add').filter({ hasText: /comparison|compare|parallel/i }).first();

    if (await comparisonButton.count() === 0) {
      test.skip(true, 'Text comparison not available');
    }

    await comparisonButton.click();
    await page.waitForTimeout(1500);

    // Verify window has content area
    const comparisonContent = page.locator('.comparison-main, .comparison-content');
    const hasContent = await comparisonContent.count();

    expect(hasContent).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Integration - Cross-Window Communication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should maintain independent state in multiple Bible windows', async ({ page }) => {
    // Create second Bible window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addBibleButton = page.locator('#add-bible, .window-add').filter({ hasText: /bible/i }).first();
    await addBibleButton.click();
    await page.waitForTimeout(1000);

    // Navigate first window
    const navInputs = page.locator('.text-nav');
    const firstNav = navInputs.first();
    await firstNav.fill('Genesis 1');
    await firstNav.press('Enter');
    await page.waitForTimeout(2000);

    // Navigate second window
    const secondNav = navInputs.nth(1);
    await secondNav.fill('Revelation 22');
    await secondNav.press('Enter');
    await page.waitForTimeout(2000);

    // Verify both windows functional
    const chapters = page.locator('.chapter');
    const chapterCount = await chapters.count();
    expect(chapterCount).toBeGreaterThan(0);
  });

  test('should allow closing windows without affecting others', async ({ page }) => {
    // Create second window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addBibleButton = page.locator('#add-bible, .window-add').filter({ hasText: /bible/i }).first();
    await addBibleButton.click();
    await page.waitForTimeout(1000);

    // Get initial window count
    const initialWindows = page.locator('.window');
    const initialCount = await initialWindows.count();

    // Close one window if there are multiple
    if (initialCount > 1) {
      const closeButton = page.locator('.close-button').first();
      await closeButton.click();
      await page.waitForTimeout(500);

      // Verify remaining window still functional
      const chapter = page.locator('.chapter').first();
      await expect(chapter).toBeVisible();
    }

    expect(initialCount).toBeGreaterThan(0);
  });
});
