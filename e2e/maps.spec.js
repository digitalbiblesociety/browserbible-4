import { test, expect } from '@playwright/test';

test.describe('Maps Feature - Map Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should open map window and verify map loads', async ({ page }) => {
    // Open main menu
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    // Click Map option
    const addMapButton = page.locator('#add-map, .window-add').filter({ hasText: /map/i }).first();
    await addMapButton.click();
    await page.waitForTimeout(2000);

    // Verify map container exists
    const mapContainer = page.locator('.svg-map-container, .window-maps');
    await expect(mapContainer).toBeVisible({ timeout: 10000 });

    // Verify SVG element loaded
    const svgElement = page.locator('.svg-map-container svg, .window-maps svg');
    await expect(svgElement).toBeVisible({ timeout: 10000 });

    // Verify map has viewBox attribute
    const viewBox = await svgElement.getAttribute('viewBox');
    expect(viewBox).toBeTruthy();
  });

  test('should verify map controls are functional', async ({ page }) => {
    // Open map window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addMapButton = page.locator('#add-map, .window-add').filter({ hasText: /map/i }).first();
    await addMapButton.click();
    await page.waitForTimeout(2000);

    // Verify search input exists and is functional
    const searchInput = page.locator('.map-nav');
    await expect(searchInput).toBeVisible();

    // Verify search input accepts input
    await searchInput.fill('test');
    const value = await searchInput.inputValue();
    expect(value).toBe('test');
  });

  test('should verify map markers are present', async ({ page }) => {
    // Open map window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addMapButton = page.locator('#add-map, .window-add').filter({ hasText: /map/i }).first();
    await addMapButton.click();
    await page.waitForTimeout(2000);

    // Wait for SVG to load
    await page.waitForSelector('.svg-map-container svg, .window-maps svg', { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Verify markers group exists
    const markersGroup = page.locator('svg #markers');
    await expect(markersGroup).toBeVisible({ timeout: 5000 });

    // Verify at least some markers exist
    const markers = page.locator('.map-marker');
    const markerCount = await markers.count();
    expect(markerCount).toBeGreaterThan(0);
  });
});

test.describe('Maps Feature - Location Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);

    // Open map window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addMapButton = page.locator('#add-map, .window-add').filter({ hasText: /map/i }).first();
    await addMapButton.click();
    await page.waitForTimeout(2000);

    // Wait for map to load
    await page.waitForSelector('.svg-map-container svg, .window-maps svg', { timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('should search for exact location name', async ({ page }) => {
    const searchInput = page.locator('.map-nav');

    // Search for Jerusalem
    await searchInput.fill('Jerusalem');
    await page.waitForTimeout(500);

    // Verify suggestions appear
    const suggestions = page.locator('.map-search-suggestions');
    await expect(suggestions).toBeVisible();

    // Verify Jerusalem is in results
    const suggestionItems = page.locator('.map-suggestion-item');
    const count = await suggestionItems.count();
    expect(count).toBeGreaterThan(0);

    // Verify first result contains Jerusalem
    const firstResult = suggestionItems.first();
    const resultText = await firstResult.textContent();
    expect(resultText.toLowerCase()).toContain('jerusalem');
  });

  test('should search using fuzzy matching for misspelled location', async ({ page }) => {
    const searchInput = page.locator('.map-nav');

    // Search for misspelled "Jrusalem" (missing 'e')
    await searchInput.fill('Jrusalem');
    await page.waitForTimeout(500);

    // Should still show suggestions with fuzzy matching
    const suggestions = page.locator('.map-search-suggestions');
    await expect(suggestions).toBeVisible();

    // Verify we get results (fuzzy matching should find Jerusalem)
    const suggestionItems = page.locator('.map-suggestion-item');
    const count = await suggestionItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should search for partial location name', async ({ page }) => {
    const searchInput = page.locator('.map-nav');

    // Search for partial name "Beth"
    await searchInput.fill('Beth');
    await page.waitForTimeout(500);

    // Verify suggestions appear
    const suggestions = page.locator('.map-search-suggestions');
    await expect(suggestions).toBeVisible();

    // Verify results contain locations starting with "Beth" (Bethlehem, Bethany, etc.)
    const suggestionItems = page.locator('.map-suggestion-item');
    const count = await suggestionItems.count();
    expect(count).toBeGreaterThan(0);

    const firstResult = await suggestionItems.first().textContent();
    expect(firstResult.toLowerCase()).toMatch(/beth/);
  });

  test('should display verse count in search results', async ({ page }) => {
    const searchInput = page.locator('.map-nav');

    await searchInput.fill('Jerusalem');
    await page.waitForTimeout(500);

    // Verify verse count is displayed
    const verseCount = page.locator('.map-suggestion-item .verse-count').first();
    await expect(verseCount).toBeVisible();

    const verseCountText = await verseCount.textContent();
    expect(verseCountText).toMatch(/\d+\s+verses?/i);
  });

  test('should navigate to location from search results', async ({ page }) => {
    const searchInput = page.locator('.map-nav');

    await searchInput.fill('Jerusalem');
    await page.waitForTimeout(500);

    // Click first suggestion
    const firstSuggestion = page.locator('.map-suggestion-item').first();
    await firstSuggestion.click();
    await page.waitForTimeout(500);

    // Verify info popup appeared
    const infoPopup = page.locator('.map-info-popup');
    await expect(infoPopup).toHaveClass(/visible/);

    // Verify popup contains location name
    const popupContent = await infoPopup.textContent();
    expect(popupContent.toLowerCase()).toContain('jerusalem');
  });

  test('should clear search and hide suggestions', async ({ page }) => {
    const searchInput = page.locator('.map-nav');

    // Enter search
    await searchInput.fill('Jerusalem');
    await page.waitForTimeout(500);

    // Verify suggestions visible
    const suggestions = page.locator('.map-search-suggestions');
    await expect(suggestions).toBeVisible();

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(300);

    // Verify suggestions hidden
    await expect(suggestions).not.toBeVisible();
  });

  test('should handle search with no matches gracefully', async ({ page }) => {
    const searchInput = page.locator('.map-nav');

    // Search for nonsense
    await searchInput.fill('xyzabc123nonsense');
    await page.waitForTimeout(500);

    // Verify no suggestions or empty suggestions
    const suggestions = page.locator('.map-search-suggestions');
    const isVisible = await suggestions.isVisible();

    if (isVisible) {
      // If suggestions div is visible, verify it has no items
      const suggestionItems = page.locator('.map-suggestion-item');
      const count = await suggestionItems.count();
      expect(count).toBe(0);
    } else {
      // Suggestions div is hidden, which is also acceptable
      expect(isVisible).toBe(false);
    }
  });

  test('should select location with Enter key', async ({ page }) => {
    const searchInput = page.locator('.map-nav');

    await searchInput.fill('Jerusalem');
    await page.waitForTimeout(500);

    // Press Enter to select first result
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Verify info popup appeared
    const infoPopup = page.locator('.map-info-popup');
    await expect(infoPopup).toHaveClass(/visible/);
  });

  test('should navigate suggestions with arrow keys', async ({ page }) => {
    const searchInput = page.locator('.map-nav');

    await searchInput.fill('Beth');
    await page.waitForTimeout(500);

    // Verify suggestions visible
    const suggestions = page.locator('.map-search-suggestions');
    await expect(suggestions).toBeVisible();

    // Press arrow down to select first item
    await searchInput.press('ArrowDown');
    await page.waitForTimeout(200);

    // Verify first item has selected class
    const firstItem = page.locator('.map-suggestion-item').first();
    await expect(firstItem).toHaveClass(/selected/);

    // Press arrow down again to select second item
    await searchInput.press('ArrowDown');
    await page.waitForTimeout(200);

    // Verify second item has selected class
    const secondItem = page.locator('.map-suggestion-item').nth(1);
    await expect(secondItem).toHaveClass(/selected/);
  });
});

test.describe('Maps Feature - Map Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);

    // Open map window
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addMapButton = page.locator('#add-map, .window-add').filter({ hasText: /map/i }).first();
    await addMapButton.click();
    await page.waitForTimeout(2000);

    // Wait for map to load
    await page.waitForSelector('.svg-map-container svg, .window-maps svg', { timeout: 10000 });
    await page.waitForTimeout(1000);
  });

  test('should zoom in/out on map with mouse wheel', async ({ page }) => {
    const svgElement = page.locator('.svg-map-container svg, .window-maps svg');
    const mapContainer = page.locator('.svg-map-container, .window-maps');

    // Get initial viewBox
    const initialViewBox = await svgElement.getAttribute('viewBox');
    expect(initialViewBox).toBeTruthy();

    // Zoom in with wheel event (negative deltaY)
    await mapContainer.hover();
    await page.mouse.wheel(0, -100);
    await page.waitForTimeout(300);

    // Get new viewBox
    const newViewBox = await svgElement.getAttribute('viewBox');
    expect(newViewBox).toBeTruthy();

    // ViewBox should have changed (zoomed in means smaller width/height)
    expect(newViewBox).not.toBe(initialViewBox);
  });

  test('should click on location marker to see details', async ({ page }) => {
    // Search for a location to ensure it's visible
    const searchInput = page.locator('.map-nav');
    await searchInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await searchInput.press('Enter');
    await page.waitForTimeout(1000);

    // Close the search-opened popup first
    const mapContainer = page.locator('.svg-map-container, .window-maps');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Now click directly on a marker (tier 1 markers should be visible)
    const markers = page.locator('.map-marker[data-tier="1"]');
    const markerCount = await markers.count();

    if (markerCount > 0) {
      // Find a visible marker and click it
      await markers.first().click({ force: true });
      await page.waitForTimeout(500);

      // Verify info popup appeared
      const infoPopup = page.locator('.map-info-popup');
      await expect(infoPopup).toHaveClass(/visible/);

      // Verify popup has content
      const popupContent = await infoPopup.locator('.map-popup-content');
      await expect(popupContent).toBeVisible();

      // Verify popup has location name (h2)
      const locationName = popupContent.locator('h2');
      await expect(locationName).toBeVisible();
      const nameText = await locationName.textContent();
      expect(nameText).toBeTruthy();
    } else {
      test.skip(true, 'No visible markers to test');
    }
  });

  test('should verify location details popup displays correctly', async ({ page }) => {
    const searchInput = page.locator('.map-nav');

    // Search and open a location
    await searchInput.fill('Jerusalem');
    await page.waitForTimeout(500);

    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Verify popup structure
    const infoPopup = page.locator('.map-info-popup');
    await expect(infoPopup).toHaveClass(/visible/);

    const popupContent = infoPopup.locator('.map-popup-content');
    await expect(popupContent).toBeVisible();

    // Verify has location name
    const locationName = popupContent.locator('h2');
    await expect(locationName).toBeVisible();

    // Verify has verse references
    const verses = popupContent.locator('.verse');
    const verseCount = await verses.count();
    expect(verseCount).toBeGreaterThan(0);

    // Verify verses are clickable (have data attributes)
    const firstVerse = verses.first();
    const fragmentId = await firstVerse.getAttribute('data-fragmentid');
    expect(fragmentId).toBeTruthy();
  });

  test('should close popup when clicking outside', async ({ page }) => {
    const searchInput = page.locator('.map-nav');

    // Open a location
    await searchInput.fill('Jerusalem');
    await page.waitForTimeout(500);
    await searchInput.press('Enter');
    await page.waitForTimeout(500);

    // Verify popup is visible
    const infoPopup = page.locator('.map-info-popup');
    await expect(infoPopup).toHaveClass(/visible/);

    // Click outside popup on the SVG itself (not the popup)
    const svgElement = page.locator('.svg-map-container svg, .window-maps svg');
    await svgElement.click({ position: { x: 100, y: 100 } });
    await page.waitForTimeout(500);

    // Verify popup closed
    await expect(infoPopup).not.toHaveClass(/visible/);
  });

  test('should verify pan functionality works', async ({ page }) => {
    const svgElement = page.locator('.svg-map-container svg, .window-maps svg');
    const mapContainer = page.locator('.svg-map-container, .window-maps');

    // Get initial viewBox
    const initialViewBox = await svgElement.getAttribute('viewBox');
    const initialValues = initialViewBox.split(' ').map(Number);

    // Get map container bounds
    const box = await mapContainer.boundingBox();
    if (!box) {
      test.skip(true, 'Could not get map bounds');
      return;
    }

    // Perform drag (pan) operation - drag much further to ensure change
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    const endX = startX + 200;
    const endY = startY + 150;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Get new viewBox
    const newViewBox = await svgElement.getAttribute('viewBox');
    const newValues = newViewBox.split(' ').map(Number);

    // ViewBox x and y should have changed (panned)
    // Use a lower threshold since the change might be small
    const xChanged = Math.abs(newValues[0] - initialValues[0]) > 0.1;
    const yChanged = Math.abs(newValues[1] - initialValues[1]) > 0.1;

    expect(xChanged || yChanged).toBe(true);
  });
});
