/**
 * Drag a window header sideways to reorder windows. Uses a Bible window and a
 * comparison window so the order can be asserted by className in both the
 * remote and local profiles.
 */

import { test, expect } from './fixtures.js';

test.describe('window reorder', () => {
  test('dragging a header past its neighbor swaps window order', async ({ page, makeUrl }) => {
    await page.goto(makeUrl({ w1: 'bible', t1: 'ENGWEB', v1: 'JN1_1', w2: 'comparison' }));

    const bible = page.locator('.window.BibleWindow');
    const comparison = page.locator('.window.TextComparisonWindow');
    await expect(bible).toHaveCount(1, { timeout: 15_000 });
    await expect(comparison).toHaveCount(1, { timeout: 15_000 });

    const headerInner = page.locator('.window.BibleWindow .scroller-header-inner');
    await expect(headerInner).toBeVisible({ timeout: 15_000 });

    // Empty header space advertises the drag
    const cursor = await headerInner.evaluate(el => getComputedStyle(el).cursor);
    expect(cursor).toBe('grab');

    let bibleBox = await bible.boundingBox();
    let comparisonBox = await comparison.boundingBox();
    expect(bibleBox.x).toBeLessThan(comparisonBox.x);

    // Start in the empty header area right of the nav controls. Dragging by
    // just over half the neighbor's width pushes the window's edge past the
    // neighbor's midpoint — the swap must fire even though the pointer stays
    // well short of that midpoint.
    const innerBox = await headerInner.boundingBox();
    const startX = innerBox.x + innerBox.width * 0.7;
    const startY = innerBox.y + innerBox.height / 2;
    const dragTo = startX + comparisonBox.width / 2 + 30;
    expect(dragTo).toBeLessThan(comparisonBox.x + comparisonBox.width / 2);

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(dragTo, startY, { steps: 10 });

    await expect(page.locator('body.window-reordering')).toHaveCount(1);

    // Mid-drag: the window rides with the pointer, and windows stop reacting
    // to hover (no hover styles, tooltips, or focus handlers).
    const midDrag = await bible.evaluate(el => ({
      translate: getComputedStyle(el).translate,
      pointerEvents: getComputedStyle(el).pointerEvents,
      zIndex: parseInt(getComputedStyle(el).zIndex, 10),
      splitterZ: parseInt(getComputedStyle(document.querySelector('.window-splitter')).zIndex, 10)
    }));
    expect(midDrag.translate).not.toBe('none');
    expect(midDrag.pointerEvents).toBe('none');
    // The dragged window must stack above all window chrome and the splitters
    expect(midDrag.zIndex).toBeGreaterThan(midDrag.splitterZ);

    await page.mouse.up();
    await expect(page.locator('body.window-reordering')).toHaveCount(0);

    // Let the drop animation settle before measuring final positions
    await page.waitForTimeout(400);

    bibleBox = await bible.boundingBox();
    comparisonBox = await comparison.boundingBox();
    expect(comparisonBox.x).toBeLessThan(bibleBox.x);

    const pointerEventsAfter = await bible.evaluate(el => getComputedStyle(el).pointerEvents);
    expect(pointerEventsAfter).toBe('auto');
  });
});
