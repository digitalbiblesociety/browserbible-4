/**
 * Parallels window: first-open defaults, description markup, passage loading
 * (including cross-chapter references), and the show/hide-all buttons.
 */

import { test, expect } from './fixtures.js';

test.describe('parallels window', () => {
  test('opens with defaults when added with empty init data (menu add)', async ({ page, appPath }) => {
    // Regression: adding a Parallels window from the menu passes {} as init
    // data, which used to leave the window permanently blank.
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto(appPath);
    await expect(page.locator('.BibleWindow .section').first()).toBeVisible({ timeout: 30_000 });

    await page.evaluate(() => {
      const app = window.BrowserBible.getApp();
      app.windowManager.add('ParallelsWindow', {});
    });

    const win = page.locator('.window.ParallelsWindow');
    await expect(win).toHaveCount(1, { timeout: 15_000 });
    await expect(win.locator('.parallel-entry-header').first()).toBeVisible({ timeout: 15_000 });
    await expect(win.locator('.parallel-list select')).not.toHaveValue('');

    expect(errors, `Page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('renders description markup and loads passages on expand', async ({ page, makeUrl }) => {
    await page.goto(makeUrl({ w1: 'parallel', t1: 'ENGWEB' }));

    const win = page.locator('.window.ParallelsWindow');
    await expect(win.locator('.parallel-entry-header').first()).toBeVisible({ timeout: 30_000 });

    // Regression: the BlueLetterBible link used to render as escaped HTML.
    await expect(win.locator('.parallel-description a')).toHaveAttribute('href', /blueletterbible/);

    // Expand the first entry that has passages on both sides.
    const luke = win.locator('td[data-passage="1:1-4"]');
    await luke.locator('xpath=../preceding-sibling::tr[1]').click();
    await expect(luke.locator('.v').first()).toBeVisible({ timeout: 15_000 });
  });

  test('loads verses from both chapters of a cross-chapter reference', async ({ page, makeUrl }) => {
    // Regression: refs like "8:32-9:9" used to produce an empty cell.
    await page.goto(makeUrl({ w1: 'parallel', t1: 'ENGWEB', p1: 'gospels-campbell' }));

    const win = page.locator('.window.ParallelsWindow');
    await expect(win.locator('.parallel-entry-header').first()).toBeVisible({ timeout: 30_000 });

    const cell = win.locator('td[data-passage="8:32-9:9"]');
    await cell.locator('xpath=../preceding-sibling::tr[1]').click();
    await expect(cell.locator('.v').first()).toBeVisible({ timeout: 15_000 });

    const bookid = await cell.getAttribute('data-bookid');
    await expect(cell.locator(`.v[data-id="${bookid}8_32"]`)).toBeAttached({ timeout: 15_000 });
    await expect(cell.locator(`.v[data-id="${bookid}9_9"]`)).toBeAttached({ timeout: 15_000 });
  });

  test('show all and hide all toggle every entry', async ({ page, makeUrl }) => {
    // The 2 Peter / Jude set is small enough to load fully.
    await page.goto(makeUrl({ w1: 'parallel', t1: 'ENGWEB', p1: '2peter-jude' }));

    const win = page.locator('.window.ParallelsWindow');
    await expect(win.locator('.parallel-entry-header').first()).toBeVisible({ timeout: 30_000 });

    await win.locator('.parallel-show-all').click();
    await expect(win.locator('tr.parallel-entry-text-collapsed')).toHaveCount(0, { timeout: 30_000 });
    await expect(win.locator('td.reading-text .v').first()).toBeVisible();

    await win.locator('.parallel-hide-all').click();
    const total = await win.locator('tr.parallel-entry-text').count();
    await expect(win.locator('tr.parallel-entry-text-collapsed')).toHaveCount(total);
  });
});
