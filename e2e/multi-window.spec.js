/**
 * Two Bible windows side-by-side: navigating via the search box updates both.
 */

import { test, expect } from './fixtures.js';

test.describe('two-window navigation', () => {
  test('a top-bar "Go to" suggestion moves both Bible windows', async ({ page, profile, makeUrl }) => {
    const second = profile === 'local' ? 'SPABES' : 'ENGASV';

    await page.goto(makeUrl({
      w1: 'bible', t1: 'ENGWEB', v1: 'JN1_1',
      w2: 'bible', t2: second,  v2: 'JN1_1'
    }));

    // Wait for both windows to populate.
    await expect(page.locator('.window-tab.BibleWindow')).toHaveCount(2, { timeout: 15_000 });
    const sections = page.locator('.window.BibleWindow .section').first();
    await expect(sections).toBeVisible({ timeout: 30_000 });

    // Navigate to Genesis 1.
    await page.locator('#main-search-input').fill('Genesis 1:1');
    await page.locator('#main-search-input').press('ArrowDown');
    await page.locator('#main-search-input').press('Enter');

    // Each Bible window panel should now have at least one section whose
    // data-id references Genesis 1. The Scroller pre-loads adjacent chapters,
    // so don't require every section to match — just at least one per window.
    await expect.poll(async () => {
      const perWindow = await page.locator('.window.BibleWindow').evaluateAll(panels =>
        panels.map(panel =>
          Array.from(panel.querySelectorAll('.section'))
            .some(s => (s.getAttribute('data-id') ?? '').toLowerCase().includes('gn1'))
        )
      );
      return perWindow.length === 2 && perWindow.every(Boolean);
    }, { timeout: 15_000 }).toBe(true);
  });

  test('a TextNavigator chapter pick moves the other Bible window', async ({ page, profile, makeUrl }) => {
    const second = profile === 'local' ? 'SPABES' : 'ENGASV';

    await page.goto(makeUrl({
      w1: 'bible', t1: 'ENGWEB', v1: 'JN1_1',
      w2: 'bible', t2: second,  v2: 'JN1_1'
    }));

    // Wait for both windows to render verses.
    await page.waitForFunction(() => {
      const wrappers = document.querySelectorAll('.scroller-text-wrapper');
      return wrappers.length >= 2 &&
        [...wrappers].every(w => w.querySelectorAll('.section .verse, .section .v').length > 0);
    }, null, { timeout: 60_000 });

    // Open window 1's navigator and pick Genesis 1.
    await page.locator('.window.BibleWindow .text-nav').first().click();
    await page.locator('.text-navigator .text-navigator-division.divisionid-GN').click();
    await page.locator('.text-navigator .text-navigator-section.section-GN1').click();

    // Both windows land on Genesis 1 with no manual scrolling in between.
    await expect.poll(async () => {
      const perWindow = await page.locator('.window.BibleWindow').evaluateAll(panels =>
        panels.map(panel =>
          Array.from(panel.querySelectorAll('.section'))
            .some(s => (s.getAttribute('data-id') ?? '') === 'GN1')
        )
      );
      return perWindow.length === 2 && perWindow.every(Boolean);
    }, { timeout: 15_000 }).toBe(true);
  });

  test('scroll sync survives losing window focus (app switch)', async ({ page, profile, makeUrl }) => {
    const second = profile === 'local' ? 'SPABES' : 'ENGASV';

    await page.goto(makeUrl({
      w1: 'bible', t1: 'ENGWEB', v1: 'JN1_1',
      w2: 'bible', t2: second,  v2: 'JN1_1'
    }));

    // Wait for both windows to render verses.
    await page.waitForFunction(() => {
      const wrappers = document.querySelectorAll('.scroller-text-wrapper');
      return wrappers.length >= 2 &&
        [...wrappers].every(w => w.querySelectorAll('.section .verse, .section .v').length > 0);
    }, null, { timeout: 60_000 });

    // Put the pointer over window 1 (focuses it via mouseenter).
    const box = await page.locator('.window.BibleWindow').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

    // Simulate clicking off the browser and returning: hover state resets
    // (mouseleave fires) but the pointer never moves, so no mouseenter
    // re-fires. Every window ends up unfocused.
    await page.evaluate(() => {
      document.querySelectorAll('.window').forEach(n =>
        n.dispatchEvent(new MouseEvent('mouseleave'))
      );
    });
    await expect(page.locator('.window.focused')).toHaveCount(0);

    const scrollTops = () => page.evaluate(() =>
      [...document.querySelectorAll('.scroller-text-wrapper')].map(w => w.parentElement.scrollTop)
    );
    const before = await scrollTops();

    // Wheel-scroll at the current pointer position — no mousemove involved.
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(100);
    }

    // Window 1 scrolled and window 2 followed it.
    await expect.poll(async () => {
      const after = await scrollTops();
      return after[0] - before[0] > 100 && Math.abs(after[1] - before[1]) > 20;
    }, { timeout: 15_000 }).toBe(true);
  });
});
