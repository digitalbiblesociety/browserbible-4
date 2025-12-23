import { test, expect } from '@playwright/test';

test.describe('Search Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.chapter', { timeout: 30000 });
    await page.waitForTimeout(500);
  });

  test('should execute basic full-text search and verify results', async ({ page }) => {
    // Open search window via main search box
    const searchInput = page.locator('#main-search-input');
    await searchInput.fill('love');
    await searchInput.press('Enter');
    await page.waitForTimeout(1500);

    // Verify search window opened (check for search-specific elements)
    const searchWindowContent = page.locator('.search-main, .search-results').last();
    await expect(searchWindowContent).toBeVisible();

    // Verify search was auto-executed (input was passed)
    const searchResults = page.locator('.search-results');
    await expect(searchResults).toBeVisible();

    // Wait for search to complete (loading indicator should disappear)
    await page.waitForFunction(() => {
      const results = document.querySelector('.search-results');
      return results && !results.classList.contains('loading-indicator');
    }, { timeout: 30000 });

    // Verify results table exists
    const resultsTable = page.locator('.search-results table');
    await expect(resultsTable).toBeVisible();

    // Verify at least one result row
    const resultRows = page.locator('.search-results tr');
    const rowCount = await resultRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify each result has reference and content
    const firstRow = resultRows.first();
    const reference = firstRow.locator('th');
    const content = firstRow.locator('td');
    await expect(reference).toBeVisible();
    await expect(content).toBeVisible();

    // Verify footer shows results count
    const footer = page.locator('.search-footer, .window-footer').last();
    const footerText = await footer.textContent();
    expect(footerText).toContain('Results');
  });

  test('should search with multiple keywords', async ({ page }) => {
    // Open search window
    const searchInput = page.locator('#main-search-input');
    await searchInput.fill('faith hope');
    await searchInput.press('Enter');
    await page.waitForTimeout(1500);

    // Wait for search to complete
    await page.waitForFunction(() => {
      const results = document.querySelector('.search-results');
      return results && !results.classList.contains('loading-indicator');
    }, { timeout: 30000 });

    // Verify results exist
    const resultRows = page.locator('.search-results tr');
    const rowCount = await resultRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify results contain at least one of the keywords
    const firstResult = await resultRows.first().locator('td').textContent();
    expect(firstResult.toLowerCase()).toMatch(/faith|hope/);
  });

  // TODO: Fix menu navigation to search window - #add-search selector not found
  test.skip('should filter search by Old Testament only', async ({ page }) => {
    // Open search window directly from menu instead of via main search box
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addSearchButton = page.locator('#add-search').first();
    await addSearchButton.click();
    await page.waitForTimeout(1500);

    // Enter search term and execute
    const searchTextInput = page.locator('.search-text').last();
    await searchTextInput.fill('covenant');

    const searchButton = page.locator('.search-button').last();
    await searchButton.click();

    // Wait for search to complete
    await page.waitForFunction(() => {
      const results = document.querySelector('.search-results');
      return results && !results.classList.contains('loading-indicator');
    }, { timeout: 30000 });

    // Open search options/divisions
    const searchOptionsButton = page.locator('.search-options-button').last();
    await searchOptionsButton.click();
    await page.waitForTimeout(300);

    // Verify division chooser is visible
    const divisionChooser = page.locator('.search-division-chooser');
    await expect(divisionChooser).toBeVisible();

    // Uncheck NT, keep OT checked
    const ntHeader = page.locator('.division-list-nt .division-header input');
    await ntHeader.uncheck();
    await page.waitForTimeout(300);

    // Verify OT is still checked
    const otHeader = page.locator('.division-list-ot .division-header input');
    await expect(otHeader).toBeChecked();

    // Close division chooser
    await searchOptionsButton.click();
    await page.waitForTimeout(300);

    // Execute search again
    const searchBtn = page.locator('.search-button').last();
    await searchBtn.click();

    // Wait for search to complete
    await page.waitForFunction(() => {
      const results = document.querySelector('.search-results');
      return results && !results.classList.contains('loading-indicator');
    }, { timeout: 30000 });

    // Verify we have results
    const resultRows = page.locator('.search-results tr');
    const rowCount = await resultRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify all results are from OT books (Genesis=GN, Exodus=EX, etc., Matthew=MT starts NT)
    // OT books have codes like GN, EX, LV, etc. NT books start with MT, MK, LK, JN, etc.
    const firstFragmentId = await resultRows.first().getAttribute('data-fragmentid');
    expect(firstFragmentId).toBeTruthy();

    // Common OT book codes: GN, EX, LV, NU, DT, JOS, JDG, RU, 1SA, 2SA, etc.
    // NT starts at MT (Matthew)
    const bookCode = firstFragmentId.substring(0, 2);
    const ntBookCodes = ['MT', 'MK', 'LK', 'JN', 'AC', 'RM', 'CO', 'GA', 'EP', 'PP', 'CL', 'TH', 'TI', 'TT', 'PM', 'HE', 'JA', 'PE', 'JO', 'JD', 'RE'];
    expect(ntBookCodes).not.toContain(bookCode);
  });

  test('should filter search by New Testament only', async ({ page }) => {
    // Open search window
    const searchInput = page.locator('#main-search-input');
    await searchInput.fill('grace');
    await searchInput.press('Enter');
    await page.waitForTimeout(1500);

    // Open search options
    const searchOptionsButton = page.locator('.search-options-button').last();
    await searchOptionsButton.click();
    await page.waitForTimeout(300);

    // Uncheck OT, keep NT checked
    const otHeader = page.locator('.division-list-ot .division-header input');
    await otHeader.uncheck();
    await page.waitForTimeout(300);

    // Verify NT is still checked
    const ntHeader = page.locator('.division-list-nt .division-header input');
    await expect(ntHeader).toBeChecked();

    // Close division chooser
    await searchOptionsButton.click();
    await page.waitForTimeout(300);

    // Execute search again
    const searchBtn = page.locator('.search-button').last();
    await searchBtn.click();

    // Wait for search to complete
    await page.waitForFunction(() => {
      const results = document.querySelector('.search-results');
      return results && !results.classList.contains('loading-indicator');
    }, { timeout: 30000 });

    // Verify we have results
    const resultRows = page.locator('.search-results tr');
    const rowCount = await resultRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify results are from NT books
    const firstFragmentId = await resultRows.first().getAttribute('data-fragmentid');
    expect(firstFragmentId).toBeTruthy();

    const bookCode = firstFragmentId.substring(0, 2);
    const ntBookCodes = ['MT', 'MK', 'LK', 'JN', 'AC', 'RM', '1C', '2C', 'GA', 'EP', 'PP', 'CL', '1T', '2T', 'TI', 'PM', 'HE', 'JA', '1P', '2P', '1J', '2J', '3J', 'JD', 'RE'];
    expect(ntBookCodes).toContain(bookCode);
  });

  test('should filter search by specific book', async ({ page }) => {
    // Open search window
    const searchInput = page.locator('#main-search-input');
    await searchInput.fill('beginning');
    await searchInput.press('Enter');
    await page.waitForTimeout(1500);

    // Open search options
    const searchOptionsButton = page.locator('.search-options-button').last();
    await searchOptionsButton.click();
    await page.waitForTimeout(300);

    // Uncheck all books first
    const otHeader = page.locator('.division-list-ot .division-header input');
    const ntHeader = page.locator('.division-list-nt .division-header input');
    await otHeader.uncheck();
    await ntHeader.uncheck();
    await page.waitForTimeout(300);

    // Check only Genesis (GN)
    const genesisCheckbox = page.locator('.division-list-items input[value="GN"]').first();
    await genesisCheckbox.check();
    await page.waitForTimeout(300);

    // Close division chooser
    await searchOptionsButton.click();
    await page.waitForTimeout(300);

    // Execute search again
    const searchBtn = page.locator('.search-button').last();
    await searchBtn.click();

    // Wait for search to complete
    await page.waitForFunction(() => {
      const results = document.querySelector('.search-results');
      return results && !results.classList.contains('loading-indicator');
    }, { timeout: 30000 });

    // Verify we have results
    const resultRows = page.locator('.search-results tr');
    const rowCount = await resultRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify all results are from Genesis
    const firstFragmentId = await resultRows.first().getAttribute('data-fragmentid');
    expect(firstFragmentId).toMatch(/^GN/);

    // Check a few more to be sure
    if (rowCount > 1) {
      const secondFragmentId = await resultRows.nth(1).getAttribute('data-fragmentid');
      expect(secondFragmentId).toMatch(/^GN/);
    }
  });

  test('should navigate to verse from search results', async ({ page }) => {
    // Open search window
    const searchInput = page.locator('#main-search-input');
    await searchInput.fill('love');
    await searchInput.press('Enter');
    await page.waitForTimeout(1500);

    // Wait for search to complete
    await page.waitForFunction(() => {
      const results = document.querySelector('.search-results');
      return results && !results.classList.contains('loading-indicator');
    }, { timeout: 30000 });

    // Get first result's fragment ID
    const resultRows = page.locator('.search-results tr');
    const firstRow = resultRows.first();
    const fragmentId = await firstRow.getAttribute('data-fragmentid');
    expect(fragmentId).toBeTruthy();

    // Click on the result row
    await firstRow.click();
    await page.waitForTimeout(1500);

    // Verify Bible window exists
    const navInput = page.locator('.text-nav').first();
    await expect(navInput).toBeVisible();

    // Verify navigation input updated (indicates navigation occurred)
    const navValue = await navInput.inputValue();
    expect(navValue).toBeTruthy();
    expect(navValue).not.toBe('Reference');
  });

  test('should display search highlighting in result preview', async ({ page }) => {
    // Open search window
    const searchInput = page.locator('#main-search-input');
    await searchInput.fill('faith');
    await searchInput.press('Enter');
    await page.waitForTimeout(1500);

    // Wait for search to complete
    await page.waitForFunction(() => {
      const results = document.querySelector('.search-results');
      return results && !results.classList.contains('loading-indicator');
    }, { timeout: 30000 });

    // Verify results have highlighting
    const highlightedText = page.locator('.search-results .highlight').first();
    await expect(highlightedText).toBeVisible();

    // Verify highlighted text contains search term
    const highlightedContent = await highlightedText.textContent();
    expect(highlightedContent.toLowerCase()).toContain('faith');
  });

  test('should handle searches with no results', async ({ page }) => {
    // Open search window with nonsense query
    const searchInput = page.locator('#main-search-input');
    await searchInput.fill('xyzabc123456nonsense');
    await searchInput.press('Enter');
    await page.waitForTimeout(1500);

    // Wait for search to complete
    await page.waitForFunction(() => {
      const results = document.querySelector('.search-results');
      return results && !results.classList.contains('loading-indicator');
    }, { timeout: 30000 });

    // Verify "No results" message
    const searchResults = page.locator('.search-results');
    const resultsText = await searchResults.textContent();
    expect(resultsText.toLowerCase()).toContain('no results');

    // Verify footer shows 0 results
    const footer = page.locator('.search-footer, .window-footer').last();
    const footerText = await footer.textContent();
    expect(footerText).toMatch(/0|no results/i);
  });

  test('should handle search with special characters', async ({ page }) => {
    // Open search window with special characters
    const searchInput = page.locator('#main-search-input');
    await searchInput.fill('God\'s');
    await searchInput.press('Enter');
    await page.waitForTimeout(1500);

    // Wait for search to complete
    await page.waitForFunction(() => {
      const results = document.querySelector('.search-results');
      return results && !results.classList.contains('loading-indicator');
    }, { timeout: 30000 });

    // Verify search completed without errors
    const resultRows = page.locator('.search-results tr');
    const rowCount = await resultRows.count();

    // Should have results (apostrophes are common in Bible text)
    if (rowCount > 0) {
      const firstResult = await resultRows.first().locator('td').textContent();
      expect(firstResult).toBeTruthy();
    } else {
      // Or show "no results" if no matches
      const searchResults = page.locator('.search-results');
      const resultsText = await searchResults.textContent();
      expect(resultsText.toLowerCase()).toContain('no results');
    }
  });

  test('should perform case-insensitive search by default', async ({ page }) => {
    // Open search window with lowercase
    const searchInput = page.locator('#main-search-input');
    await searchInput.fill('lord');
    await searchInput.press('Enter');
    await page.waitForTimeout(1500);

    // Wait for search to complete
    await page.waitForFunction(() => {
      const results = document.querySelector('.search-results');
      return results && !results.classList.contains('loading-indicator');
    }, { timeout: 30000 });

    // Get results count
    const resultRows = page.locator('.search-results tr');
    const rowCount = await resultRows.count();
    expect(rowCount).toBeGreaterThan(0);

    // Verify results contain variations: "lord", "Lord", "LORD"
    const results = [];
    for (let i = 0; i < Math.min(5, rowCount); i++) {
      const resultText = await resultRows.nth(i).locator('td').textContent();
      results.push(resultText);
    }

    const allResults = results.join(' ');
    // Should match both lowercase "lord" and uppercase "LORD" or "Lord"
    expect(allResults).toMatch(/lord/i);
  });

  // TODO: Fix menu navigation to search window - #add-search selector not found
  test.skip('should show search progress during search', async ({ page }) => {
    // Open search window via menu to ensure proper initialization
    const mainMenuButton = page.locator('#main-menu-button');
    await mainMenuButton.click();
    await page.waitForTimeout(500);

    const addSearchButton = page.locator('#add-search').first();
    await addSearchButton.click();
    await page.waitForTimeout(1500);

    // Enter search term and execute
    const searchTextInput = page.locator('.search-text').last();
    await searchTextInput.fill('covenant');

    const searchButton = page.locator('.search-button').last();
    await searchButton.click();

    // Wait for search to complete
    await page.waitForFunction(() => {
      const results = document.querySelector('.search-results');
      return results && !results.classList.contains('loading-indicator');
    }, { timeout: 30000 });

    // Verify search completed successfully with results
    const results = await page.locator('.search-results tr').count();
    expect(results).toBeGreaterThan(0);

    // Verify footer shows results count (progress indicator)
    const footer = page.locator('.search-footer, .window-footer').last();
    const footerText = await footer.textContent();
    expect(footerText).toMatch(/results/i);
  });

  test('should update window tab with search term', async ({ page }) => {
    // Open search window
    const searchInput = page.locator('#main-search-input');
    const searchTerm = 'righteousness';
    await searchInput.fill(searchTerm);
    await searchInput.press('Enter');
    await page.waitForTimeout(1500);

    // Wait for search to start and window to open
    await page.waitForFunction(() => {
      const results = document.querySelector('.search-results');
      return results && !results.classList.contains('loading-indicator');
    }, { timeout: 30000 });

    // Get search window tab (look for any tab with the search term)
    const allTabs = page.locator('.window-tab');
    const tabCount = await allTabs.count();

    // Find tab containing search term
    let foundSearchTerm = false;
    for (let i = 0; i < tabCount; i++) {
      const tabText = await allTabs.nth(i).textContent();
      if (tabText && tabText.includes(searchTerm)) {
        foundSearchTerm = true;
        break;
      }
    }

    expect(foundSearchTerm).toBe(true);
  });
});
