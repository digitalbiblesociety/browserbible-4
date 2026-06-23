import { test, expect } from './fixtures.js';

const navigatorLocator = (page) => page.locator('.text-navigator:not(.verse-navigator)');

async function openNavigator(page, url) {
  await page.goto(url);
  await expect(page.locator('.BibleWindow .section').first()).toBeVisible({ timeout: 30_000 });
  const nav = page.locator('.BibleWindow .text-nav').filter({ visible: true }).first();
  await nav.click();
  const navigator = navigatorLocator(page);
  await expect(navigator).toBeVisible();
  return { nav, navigator };
}

test.describe('passages column (right of the books)', () => {
  test('shows the active book\'s passages with the current one highlighted', async ({ page, makeUrl }) => {
    const { navigator } = await openNavigator(page, makeUrl({ w1: 'bible', t1: 'ENGWEB', v1: 'JN3_16' }));

    // Two-column layout with a passages column
    await expect(navigator).toHaveClass(/text-navigator-2col/);
    const passages = navigator.locator('.text-navigator-pericopes');
    await expect(passages).toBeVisible();

    // Active book = John (from the current reference)
    await expect(passages.locator('.text-navigator-peri-header')).toHaveText('John');
    await expect(passages.locator('.peri-item').first()).toBeVisible();

    // Exactly one passage is marked current (the one containing John 3:16)
    await expect(passages.locator('.peri-item.current')).toHaveCount(1);
    await expect(passages.locator('.peri-item.current')).toHaveAttribute('data-section', 'JN3');
  });

  test('selecting a book updates the passages column', async ({ page, makeUrl }) => {
    const { navigator } = await openNavigator(page, makeUrl({ w1: 'bible', t1: 'ENGWEB', v1: 'JN3_16' }));

    await navigator.locator('.text-navigator-division[data-id="GN"]').click();

    const passages = navigator.locator('.text-navigator-pericopes');
    await expect(passages.locator('.text-navigator-peri-header')).toHaveText('Genesis');
    await expect(passages.locator('.peri-item[data-fragment="GN1_1"]')).toBeVisible();
  });

  test('selecting a book scrolls it to the top of the book list', async ({ page, makeUrl }) => {
    const { navigator } = await openNavigator(page, makeUrl({ w1: 'bible', t1: 'ENGWEB', v1: 'JN3_16' }));

    // 1 Samuel — a book with many chapters, where the old offsetTop math overshot
    await navigator.locator('.text-navigator-division[data-id="S1"]').click();
    await page.waitForTimeout(400); // let the chapter grid animate open

    const delta = await page.evaluate(() => {
      const d = document.querySelector('.text-navigator:not(.verse-navigator) .divisionid-S1');
      const c = document.querySelector('.text-navigator:not(.verse-navigator) .text-navigator-divisions');
      return d.getBoundingClientRect().top - c.getBoundingClientRect().top;
    });
    // Book sits just below the container top, not scrolled past its end
    expect(delta).toBeGreaterThanOrEqual(0);
    expect(delta).toBeLessThan(24);
  });

  test('the filter searches passages across books and jumps', async ({ page, makeUrl }) => {
    const { nav, navigator } = await openNavigator(page, makeUrl({ w1: 'bible', t1: 'ENGWEB', v1: 'JN3_16' }));

    await navigator.locator('.text-navigator-filter').fill('Samson');
    const item = navigator.locator('.peri-item', { hasText: 'Samson and Delilah' });
    await expect(item).toBeVisible();
    await item.click();

    await expect(navigator).toBeHidden();
    await expect.poll(async () => nav.inputValue(), { timeout: 15_000 }).toContain('16');
  });

  test('search keeps the result books visible in the left column', async ({ page, makeUrl }) => {
    const { navigator } = await openNavigator(page, makeUrl({ w1: 'bible', t1: 'ENGWEB', v1: 'JN3_16' }));

    await navigator.locator('.text-navigator-filter').fill('abraham');

    // "abraham" matches passages in Genesis, 1 Chronicles, John, Romans —
    // those books stay visible on the left; non-matching books are hidden.
    for (const id of ['GN', 'R1', 'JN', 'RM']) {
      await expect(navigator.locator(`.text-navigator-division[data-id="${id}"]`)).toBeVisible();
    }
    await expect(navigator.locator('.text-navigator-division[data-id="EX"]')).toBeHidden();
  });

  test('non-English text hides the passages column (English-only for now)', async ({ page, makeUrl }) => {
    const { navigator } = await openNavigator(page, makeUrl({ w1: 'bible', t1: 'SPABES', v1: 'JN1_1' }));

    await expect(navigator).not.toHaveClass(/text-navigator-2col/);
    await expect(navigator.locator('.text-navigator-pericopes')).toBeHidden();
    // Book navigation still works
    await expect(navigator.locator('.text-navigator-division[data-id="GN"]')).toBeVisible();
  });
});
