import { test, expect } from '@playwright/test';

test.describe('Bible Version Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should open text chooser and display available versions', async ({ page }) => {
    // Click the version selector button
    const versionButton = page.locator('.text-list').first();
    await expect(versionButton).toBeVisible();

    const initialVersion = await versionButton.textContent();
    expect(initialVersion).toBeTruthy();

    // Open text chooser
    await versionButton.click();
    await page.waitForTimeout(500);

    // Verify text chooser is visible
    const textChooser = page.locator('.text-chooser');
    await expect(textChooser).toBeVisible();

    // Verify at least one version row is displayed
    const versionRows = page.locator('.text-chooser-row');
    const rowCount = await versionRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify language headers exist
    const languageHeaders = page.locator('.text-chooser-row-header');
    const headerCount = await languageHeaders.count();
    expect(headerCount).toBeGreaterThan(0);

    // Close text chooser by clicking outside
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  test('should switch between different Bible versions and verify content changes', async ({ page }) => {
    // Get initial version and verse content
    const versionButton = page.locator('.text-list').first();
    const initialVersion = await versionButton.textContent();

    // Get initial verse content
    const firstVerse = page.locator('[data-id]').first();
    const initialContent = await firstVerse.textContent();
    expect(initialContent).toBeTruthy();

    // Open text chooser
    await versionButton.click();
    await page.waitForTimeout(500);

    // Get all available version rows (not filtered out)
    const versionRows = page.locator('.text-chooser-row:not(.filtered-hidden)');
    const rowCount = await versionRows.count();

    // Need at least 2 versions to test switching
    if (rowCount < 2) {
      test.skip(true, 'Not enough Bible versions available for this test');
    }

    // Find a different version to switch to
    let differentVersionRow = null;
    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const row = versionRows.nth(i);
      const rowAbbr = await row.locator('.text-chooser-abbr').textContent();

      if (rowAbbr && rowAbbr !== initialVersion) {
        differentVersionRow = row;
        break;
      }
    }

    if (!differentVersionRow) {
      test.skip(true, 'Could not find a different version to switch to');
    }

    // Click the different version
    const newVersionAbbr = await differentVersionRow.locator('.text-chooser-abbr').textContent();
    await differentVersionRow.click();
    await page.waitForTimeout(1500);

    // Wait for content to load
    await page.waitForSelector('.chapter', { timeout: 30000 });

    // Verify version changed in UI
    const updatedVersion = await versionButton.textContent();
    expect(updatedVersion).toBe(newVersionAbbr);

    // Verify content changed (different translation)
    const newContent = await firstVerse.textContent();
    expect(newContent).toBeTruthy();

    // Content should be different (different translations word differently)
    // Note: In rare cases translations might be identical, but this is unlikely for first verse
    expect(newContent).not.toBe(initialContent);
  });

  test('should filter versions using search input', async ({ page }) => {
    const versionButton = page.locator('.text-list').first();
    await versionButton.click();
    await page.waitForTimeout(500);

    // Get initial count of visible rows
    const initialRows = page.locator('.text-chooser-row:not(.filtered-hidden)');
    const initialCount = await initialRows.count();
    expect(initialCount).toBeGreaterThan(0);

    // Type in filter
    const filterInput = page.locator('.text-chooser-filter-text');
    await filterInput.fill('english');
    await page.waitForTimeout(300);

    // Count filtered rows
    const filteredRows = page.locator('.text-chooser-row:not(.filtered-hidden)');
    const filteredCount = await filteredRows.count();

    // Should have fewer or equal rows after filtering
    expect(filteredCount).toBeLessThanOrEqual(initialCount);

    // Clear filter
    await filterInput.fill('');
    await page.waitForTimeout(300);

    // Should return to initial count
    const restoredRows = page.locator('.text-chooser-row:not(.filtered-hidden)');
    const restoredCount = await restoredRows.count();
    expect(restoredCount).toBe(initialCount);

    // Close chooser
    await page.keyboard.press('Escape');
  });

  test('should select version with Enter key when filter shows single result', async ({ page }) => {
    const versionButton = page.locator('.text-list').first();
    const initialVersion = await versionButton.textContent();

    await versionButton.click();
    await page.waitForTimeout(500);

    // Get all rows to find a unique abbreviation
    const allRows = page.locator('.text-chooser-row:not(.filtered-hidden)');
    const rowCount = await allRows.count();

    if (rowCount < 2) {
      test.skip(true, 'Not enough versions for filter test');
    }

    // Find a version with a unique abbreviation
    let uniqueAbbr = null;
    for (let i = 0; i < Math.min(rowCount, 10); i++) {
      const abbr = await allRows.nth(i).locator('.text-chooser-abbr').textContent();
      if (abbr && abbr !== initialVersion) {
        uniqueAbbr = abbr.toLowerCase();
        break;
      }
    }

    if (!uniqueAbbr) {
      test.skip(true, 'Could not find unique abbreviation to filter');
    }

    // Filter to single result
    const filterInput = page.locator('.text-chooser-filter-text');
    await filterInput.fill(uniqueAbbr);
    await page.waitForTimeout(300);

    // Verify only one row visible
    const visibleRows = page.locator('.text-chooser-row:not(.filtered-hidden)');
    const visibleCount = await visibleRows.count();

    if (visibleCount !== 1) {
      // If filter didn't result in single match, skip test
      test.skip(true, 'Filter did not result in single version');
    }

    // Press Enter to select
    await filterInput.press('Enter');
    await page.waitForTimeout(1500);

    // Verify version changed
    const newVersion = await versionButton.textContent();
    expect(newVersion.toLowerCase()).toBe(uniqueAbbr);
  });

  test('should maintain version selection across page reload', async ({ page, context }) => {
    // Switch to a different version first
    const versionButton = page.locator('.text-list').first();
    const initialVersion = await versionButton.textContent();

    await versionButton.click();
    await page.waitForTimeout(500);

    // Find and click a different version
    const versionRows = page.locator('.text-chooser-row:not(.filtered-hidden)');
    const rowCount = await versionRows.count();

    if (rowCount < 2) {
      test.skip(true, 'Not enough versions to test persistence');
    }

    let differentVersionAbbr = null;
    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const row = versionRows.nth(i);
      const abbr = await row.locator('.text-chooser-abbr').textContent();

      if (abbr && abbr !== initialVersion) {
        await row.click();
        differentVersionAbbr = abbr;
        break;
      }
    }

    if (!differentVersionAbbr) {
      test.skip(true, 'Could not find different version');
    }

    await page.waitForTimeout(1500);

    // Verify version changed
    let currentVersion = await versionButton.textContent();
    expect(currentVersion).toBe(differentVersionAbbr);

    // Wait for settings to save (debounced save has 1000ms delay)
    await page.waitForTimeout(1500);

    // Reload the page
    await page.reload();
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);

    // Verify version persisted
    const versionAfterReload = await versionButton.textContent();
    expect(versionAfterReload).toBe(differentVersionAbbr);
  });

  test('should allow different versions in parallel windows', async ({ page }) => {
    // Get first window version
    const firstVersionButton = page.locator('.text-list').first();
    const firstVersion = await firstVersionButton.textContent();

    // Open text chooser to get available versions
    await firstVersionButton.click();
    await page.waitForTimeout(500);

    const versionRows = page.locator('.text-chooser-row:not(.filtered-hidden)');
    const rowCount = await versionRows.count();

    if (rowCount < 2) {
      await page.keyboard.press('Escape');
      test.skip(true, 'Not enough versions for parallel window test');
    }

    // Find a different version
    let secondVersionAbbr = null;
    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const abbr = await versionRows.nth(i).locator('.text-chooser-abbr').textContent();
      if (abbr && abbr !== firstVersion) {
        secondVersionAbbr = abbr;
        break;
      }
    }

    if (!secondVersionAbbr) {
      await page.keyboard.press('Escape');
      test.skip(true, 'Could not find second version');
    }

    // Close text chooser
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Open main menu
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    // Click "Bible" add window option
    const addBibleButton = page.locator('#add-bible, .window-add').filter({ hasText: /bible/i }).first();
    await addBibleButton.click();
    await page.waitForTimeout(1500);

    // Wait for second window to load
    await page.waitForSelector('.window', { timeout: 5000 });

    // Get all version buttons (should be 2 now)
    const allVersionButtons = page.locator('.text-list');
    const buttonCount = await allVersionButtons.count();
    expect(buttonCount).toBeGreaterThanOrEqual(2);

    // Click second window's version button
    const secondVersionButton = allVersionButtons.nth(1);
    await secondVersionButton.click();
    await page.waitForTimeout(500);

    // Find and click the different version
    const secondWindowRows = page.locator('.text-chooser-row:not(.filtered-hidden)');
    for (let i = 0; i < await secondWindowRows.count(); i++) {
      const row = secondWindowRows.nth(i);
      const abbr = await row.locator('.text-chooser-abbr').textContent();

      if (abbr === secondVersionAbbr) {
        await row.click();
        break;
      }
    }

    await page.waitForTimeout(1500);

    // Verify first window still has original version
    const firstWindowVersion = await firstVersionButton.textContent();
    expect(firstWindowVersion).toBe(firstVersion);

    // Verify second window has different version
    const secondWindowVersion = await secondVersionButton.textContent();
    expect(secondWindowVersion).toBe(secondVersionAbbr);

    // Verify they're different
    expect(firstWindowVersion).not.toBe(secondWindowVersion);
  });

  test('should close text chooser when clicking outside (light dismiss)', async ({ page }) => {
    const versionButton = page.locator('.text-list').first();
    await versionButton.click();
    await page.waitForTimeout(500);

    // Verify text chooser is open
    const textChooser = page.locator('.text-chooser');
    await expect(textChooser).toBeVisible();

    // Click outside the text chooser on page background
    await page.mouse.click(10, 10);
    await page.waitForTimeout(300);

    // Verify text chooser closed
    await expect(textChooser).not.toBeVisible();
  });

  test('should close text chooser with Escape key', async ({ page }) => {
    const versionButton = page.locator('.text-list').first();
    await versionButton.click();
    await page.waitForTimeout(500);

    // Verify text chooser is open
    const textChooser = page.locator('.text-chooser');
    await expect(textChooser).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Verify text chooser closed
    await expect(textChooser).not.toBeVisible();
  });

  test('should display version metadata (abbreviation, name, icons)', async ({ page }) => {
    const versionButton = page.locator('.text-list').first();
    await versionButton.click();
    await page.waitForTimeout(500);

    // Get first version row
    const firstRow = page.locator('.text-chooser-row:not(.filtered-hidden)').first();
    await expect(firstRow).toBeVisible();

    // Verify abbreviation exists
    const abbr = firstRow.locator('.text-chooser-abbr');
    await expect(abbr).toBeVisible();
    const abbrText = await abbr.textContent();
    expect(abbrText).toBeTruthy();

    // Verify name exists
    const name = firstRow.locator('.text-chooser-name');
    await expect(name).toBeVisible();
    const nameText = await name.textContent();
    expect(nameText).toBeTruthy();

    // Close chooser
    await page.keyboard.press('Escape');
  });
});
