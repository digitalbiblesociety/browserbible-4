import { test, expect } from '@playwright/test';

test.describe('Visual Filters Plugin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for the chapter content to load
    await page.waitForSelector('.chapter', { timeout: 30000 });
  });

  // Helper to open settings via main menu
  const openSettings = async (page) => {
    // First open the main menu dropdown
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(200);

    // Then click settings
    const settingsButton = page.locator('.image-config');
    await settingsButton.click();
    await page.waitForTimeout(200);
  };

  test('opens Visual Filters window from settings', async ({ page }) => {
    // Open the settings/config menu
    await openSettings(page);

    // Wait for config window to open
    const configWindow = page.locator('#config-window');
    await expect(configWindow).toBeVisible();

    // Click the Visual Filters button in the tools section
    const visualFiltersButton = page.locator('#config-visualfilters-button');
    await expect(visualFiltersButton).toBeVisible();
    await visualFiltersButton.click();

    // Visual Filters window should open
    const filtersWindow = page.locator('#visualfilters-config');
    await expect(filtersWindow).toBeVisible();
  });

  test('adds new filter row when clicking New Filter button', async ({ page }) => {
    // Open settings
    await openSettings(page);

    // Open Visual Filters window
    const visualFiltersButton = page.locator('#config-visualfilters-button');
    await visualFiltersButton.click();
    await page.waitForTimeout(300);

    // Count initial rows (default transforms from settings)
    const filtersWindow = page.locator('#visualfilters-config');
    const initialRows = await filtersWindow.locator('tbody tr').count();

    // Click "New Filter" button
    const newFilterButton = filtersWindow.locator('input[value="New Filter"]');
    await newFilterButton.click();

    // Should have one more row
    const newRowCount = await filtersWindow.locator('tbody tr').count();
    expect(newRowCount).toBe(initialRows + 1);
  });

  test('removes filter row when clicking close button', async ({ page }) => {
    // Open settings
    await openSettings(page);

    // Open Visual Filters window
    const visualFiltersButton = page.locator('#config-visualfilters-button');
    await visualFiltersButton.click();
    await page.waitForTimeout(300);

    // Add a new filter first
    const filtersWindow = page.locator('#visualfilters-config');
    const newFilterButton = filtersWindow.locator('input[value="New Filter"]');
    await newFilterButton.click();

    // Count rows after adding
    const rowsAfterAdd = await filtersWindow.locator('tbody tr').count();
    expect(rowsAfterAdd).toBeGreaterThan(0);

    // Click the close button on the last row
    const lastRow = filtersWindow.locator('tbody tr').last();
    const closeButton = lastRow.locator('.close-button');
    await closeButton.click();

    // Should have one less row
    const rowsAfterRemove = await filtersWindow.locator('tbody tr').count();
    expect(rowsAfterRemove).toBe(rowsAfterAdd - 1);
  });

  test('filter row has color picker and style type selector', async ({ page }) => {
    // Open settings
    await openSettings(page);

    // Open Visual Filters window
    const visualFiltersButton = page.locator('#config-visualfilters-button');
    await visualFiltersButton.click();
    await page.waitForTimeout(300);

    // Add a new filter
    const filtersWindow = page.locator('#visualfilters-config');
    const newFilterButton = filtersWindow.locator('input[value="New Filter"]');
    await newFilterButton.click();

    // Verify color picker exists
    const colorPicker = filtersWindow.locator('tbody tr').last().locator('input[type="color"]');
    await expect(colorPicker).toBeAttached();

    // Verify style type selector exists with correct options
    const styleTypeSelect = filtersWindow.locator('tbody tr').last().locator('.style-type');
    await expect(styleTypeSelect).toBeAttached();

    // Check for all three style type options
    const textOption = styleTypeSelect.locator('option[value="text"]');
    const backgroundOption = styleTypeSelect.locator('option[value="background"]');
    const underlineOption = styleTypeSelect.locator('option[value="underline"]');
    await expect(textOption).toBeAttached();
    await expect(backgroundOption).toBeAttached();
    await expect(underlineOption).toBeAttached();
  });

  test('morphology selector exists and contains parts of speech', async ({ page }) => {
    // Open settings
    await openSettings(page);

    // Open Visual Filters window
    const visualFiltersButton = page.locator('#config-visualfilters-button');
    await visualFiltersButton.click();
    await page.waitForTimeout(300);

    // Verify morphology selector exists in DOM
    const morphSelector = page.locator('.morph-selector');
    await expect(morphSelector).toBeAttached();

    // Verify it has parts of speech (Noun, Verb)
    const nounOption = morphSelector.locator('span:has-text("Noun")');
    const verbOption = morphSelector.locator('span:has-text("Verb")');
    await expect(nounOption).toBeAttached();
    await expect(verbOption).toBeAttached();
  });

  test('can enter Strong\'s number in filter', async ({ page }) => {
    // Open settings
    await openSettings(page);

    // Open Visual Filters window
    const visualFiltersButton = page.locator('#config-visualfilters-button');
    await visualFiltersButton.click();
    await page.waitForTimeout(300);

    // Add a new filter
    const filtersWindow = page.locator('#visualfilters-config');
    const newFilterButton = filtersWindow.locator('input[value="New Filter"]');
    await newFilterButton.click();

    // Enter a Strong's number
    const strongsInput = filtersWindow.locator('tbody tr').last().locator('.visualfilters-strongs input');
    await strongsInput.fill('G2424');

    // Verify the value was entered
    await expect(strongsInput).toHaveValue('G2424');
  });

  test('filter row has morphology language selector', async ({ page }) => {
    // Open settings
    await openSettings(page);

    // Open Visual Filters window
    const visualFiltersButton = page.locator('#config-visualfilters-button');
    await visualFiltersButton.click();
    await page.waitForTimeout(300);

    // Add a new filter
    const filtersWindow = page.locator('#visualfilters-config');
    const newFilterButton = filtersWindow.locator('input[value="New Filter"]');
    await newFilterButton.click();

    // Verify the morphology dropdown has Hebrew and Greek options
    const morphSelect = filtersWindow.locator('tbody tr').last().locator('.visualfilters-morph select');
    await expect(morphSelect).toBeAttached();

    // Check for Hebrew option
    const hebrewOption = morphSelect.locator('option[value="morphhb"]');
    await expect(hebrewOption).toBeAttached();

    // Check for Greek option
    const greekOption = morphSelect.locator('option[value="robinson"]');
    await expect(greekOption).toBeAttached();
  });
});
