/**
 * MapWindow loads real location data and renders markers.
 */

import { test, expect } from './fixtures.js';

test.describe('map window', () => {
  test('opens with markers rendered from maps.json', async ({ page, makeUrl }) => {
    await page.goto(makeUrl({ w1: 'map' }));

    await expect(page.locator('.window.MapWindow')).toBeVisible({ timeout: 15_000 });

    // At least one marker should exist once data loads. Map JSON ships ~200+
    // locations; we just need any of them to land in the DOM.
    await expect.poll(async () =>
      page.locator('.window.MapWindow .map-marker').count(),
      { timeout: 15_000 }
    ).toBeGreaterThan(0);
  });

  test('zoom controls and double-click zoom the map', async ({ page, makeUrl }) => {
    await page.goto(makeUrl({ w1: 'map' }));

    const map = page.locator('.window.MapWindow');
    await expect(map).toBeVisible({ timeout: 15_000 });
    // Direct child only — every marker also contains an inline <svg> icon
    const svg = map.locator('.svg-map-container > svg');
    await expect(svg).toBeVisible({ timeout: 15_000 });

    const viewBoxWidth = async () =>
      parseFloat((await svg.getAttribute('viewBox')).split(' ')[2]);

    const initial = await viewBoxWidth();

    // Zoom in shrinks the viewBox
    await map.locator('.map-zoom-in').click();
    await expect.poll(viewBoxWidth).toBeLessThan(initial);

    // Zoom out grows it back
    await map.locator('.map-zoom-out').click();
    await expect.poll(viewBoxWidth).toBeGreaterThanOrEqual(initial - 1);

    // Reset view zooms to the full extent and disables further zoom-out
    await map.locator('.map-zoom-fit').click();
    await expect.poll(viewBoxWidth).toBeGreaterThan(initial);
    await expect(map.locator('.map-zoom-out')).toBeDisabled();

    // Double-click zooms in
    const afterFit = await viewBoxWidth();
    await map.locator('.svg-map-container').dblclick({ position: { x: 40, y: 40 } });
    await expect.poll(viewBoxWidth).toBeLessThan(afterFit);
  });

  test('keyboard pans and zooms the focused map', async ({ page, makeUrl }) => {
    await page.goto(makeUrl({ w1: 'map' }));

    const map = page.locator('.window.MapWindow');
    await expect(map).toBeVisible({ timeout: 15_000 });
    const container = map.locator('.svg-map-container');
    const svg = map.locator('.svg-map-container > svg');
    await expect(svg).toBeVisible({ timeout: 15_000 });

    const viewBox = async () =>
      (await svg.getAttribute('viewBox')).split(' ').map(parseFloat);

    await container.focus();

    const [, , initialWidth] = await viewBox();
    await container.press('+');
    await expect.poll(async () => (await viewBox())[2]).toBeLessThan(initialWidth);

    const [xBefore] = await viewBox();
    await container.press('ArrowRight');
    await expect.poll(async () => (await viewBox())[0]).toBeGreaterThan(xBefore);
  });

  test('marker opens the detail panel; Escape and background click dismiss it', async ({ page, makeUrl }) => {
    await page.goto(makeUrl({ w1: 'map' }));

    const map = page.locator('.window.MapWindow');
    await expect(map).toBeVisible({ timeout: 15_000 });
    await map.locator('.map-mode-btn[data-mode="explore"]').click();

    const visibleMarker = () =>
      map.locator('.map-marker:not(.filtered-out):not(.clustered)').first();
    await expect(visibleMarker()).toBeVisible({ timeout: 15_000 });

    // Keyboard activation opens the inline detail panel
    await visibleMarker().press('Enter');
    const detail = map.locator('.map-detail');
    await expect(detail).toBeVisible();

    // Verse snippets hydrate on demand even though no Bible window is open
    await expect(
      detail.locator('.search-result-text:not(.verse-text-pending):not(.verse-text-missing)').first()
    ).toBeVisible({ timeout: 15_000 });

    // Escape closes it
    await page.keyboard.press('Escape');
    await expect(detail).toBeHidden();

    // Reset to the full extent so the first unclustered marker is on screen,
    // then re-open by click and dismiss with a background click
    await map.locator('.map-zoom-fit').click();
    await visibleMarker().click();
    await expect(detail).toBeVisible();
    await map.locator('.svg-map-container').click({ position: { x: 8, y: 8 } });
    await expect(detail).toBeHidden();
  });

  test('journeys mode swaps in a journey dropdown and draws the route', async ({ page, makeUrl, profile }) => {
    test.skip(profile !== 'local', 'journeys.json is not yet deployed to the remote content server');

    await page.goto(makeUrl({ w1: 'map' }));

    const map = page.locator('.window.MapWindow');
    await expect(map).toBeVisible({ timeout: 15_000 });

    // Mode button unhides once journeys.json loads
    const journeysBtn = map.locator('.map-mode-btn[data-mode="journeys"]');
    await expect(journeysBtn).toBeVisible({ timeout: 15_000 });
    await journeysBtn.click();

    // The search box gives way to the journey dropdown, and the first
    // journey (Abraham's) is auto-selected
    await expect(map.locator('.map-nav')).toBeHidden();
    const trigger = map.locator('.map-journey-list');
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText('Abraham');

    // No location/stop count in the header while in journeys mode
    await expect(map.locator('.map-location-count')).toHaveText('');

    // Switch to Paul's first journey via the dropdown
    await trigger.click();
    const menu = map.locator('.map-journey-menu');
    await expect(menu).toBeVisible();
    await menu.locator('.map-journey-menu-item[data-journey-id="paul1"]').click();
    await expect(menu).toBeHidden();
    await expect(trigger).toContainText("Paul's First Journey");

    // Single-select: only paul1's route (14 legs, 10 stops) is rendered
    await expect.poll(() => map.locator('path.journey-route').count()).toBe(14);
    // Sea legs are dashed via CSS (screen-space under non-scaling-stroke)
    await expect(map.locator('path.journey-route-sea').first())
      .toHaveCSS('stroke-dasharray', /8.*6/);
    await expect(map.locator('.journey-stop')).toHaveCount(10);

    // Regular pins give way to the numbered stop badges
    await expect(map.locator('.map-marker:not(.filtered-out)')).toHaveCount(0);

    // Ordered stop list shows in the detail area
    const detail = map.locator('.map-detail');
    await expect(detail).toBeVisible();
    await expect(detail.locator('.map-journey-stop-row')).toHaveCount(10);

    // Clicking stop badge 4 opens Paphos; Back returns to the stop list
    await map.locator('.journey-stop', { hasText: '4' }).click();
    await expect(detail.locator('.map-detail-header h2')).toHaveText('Paphos');
    await map.locator('.map-detail-back').click();
    await expect(detail.locator('.map-journey-stop-row')).toHaveCount(10);
  });

  test('journey deep link restores journeys mode', async ({ page, makeUrl, profile }) => {
    test.skip(profile !== 'local', 'journeys.json is not yet deployed to the remote content server');

    await page.goto(makeUrl({ w1: 'map', j1: 'paul1' }));

    const map = page.locator('.window.MapWindow');
    await expect(map).toBeVisible({ timeout: 15_000 });

    await expect(map.locator('.map-mode-btn[data-mode="journeys"]')).toHaveClass(/active/, { timeout: 15_000 });
    await expect(map.locator('.map-journey-list')).toContainText("Paul's First Journey");
    await expect(map.locator('.journey-stop')).toHaveCount(10);
  });

  test('clicking a highlighted place name in the Bible text opens it on the map', async ({ page, makeUrl }) => {
    await page.goto(makeUrl({ w1: 'bible', t1: 'ENGWEB', v1: 'MT2_1', w2: 'map' }));

    const map = page.locator('.window.MapWindow');
    await expect(map).toBeVisible({ timeout: 15_000 });

    // MapPanel highlights place names in the Bible text once data + text are
    // loaded. Names highlight progressively as sections stream in, so pin a
    // known name instead of racing whichever span happens to be first.
    const linked = page.locator(
      '.window.BibleWindow .linked-location[data-location-name="Bethlehem"]').first();
    await expect(linked).toBeVisible({ timeout: 20_000 });
    await linked.click();

    const heading = map.locator('.map-detail-header h2');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText('Bethlehem');
  });
});
