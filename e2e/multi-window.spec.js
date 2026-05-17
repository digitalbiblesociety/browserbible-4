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
});
