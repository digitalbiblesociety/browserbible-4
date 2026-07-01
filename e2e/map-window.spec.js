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

  test('clicking a highlighted place name in the Bible text opens it on the map', async ({ page, makeUrl }) => {
    await page.goto(makeUrl({ w1: 'bible', t1: 'ENGWEB', v1: 'MT2_1', w2: 'map' }));

    const map = page.locator('.window.MapWindow');
    await expect(map).toBeVisible({ timeout: 15_000 });

    // MapPanel highlights place names in the Bible text once data + text are loaded
    const linked = page.locator('.window.BibleWindow .linked-location').first();
    await expect(linked).toBeVisible({ timeout: 20_000 });

    const name = await linked.getAttribute('data-location-name');
    await linked.click();

    const heading = map.locator('.map-detail-header h2');
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText(name);
  });
});
