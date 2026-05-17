/**
 * Deep-link tests — URL parameters land users on the right passage.
 * Runs in both remote and local profiles. Profile-specific text ids are
 * provided so each profile uses content that's actually available.
 */

import { test, expect } from './fixtures.js';

const profileText = {
  remote: 'ENGWEB',
  local: 'ENGWEB' // both have ENGWEB
};

test.describe('URL deep-linking', () => {
  test('?w1=bible loads a single Bible window with the requested text and fragment', async ({ page, profile, makeUrl }) => {
    const text = profileText[profile];
    await page.goto(makeUrl({ w1: 'bible', t1: text, v1: 'JN3_16' }));

    // Exactly one Bible window when only w1 is specified.
    const tabs = page.locator('.window-tab.BibleWindow');
    await expect(tabs).toHaveCount(1, { timeout: 15_000 });

    // Section content for John 3 must load. The Scroller pre-loads adjacent
    // chapters, so we check that at least one rendered section matches.
    await expect(page.locator('.BibleWindow .section').first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => {
      const ids = await page.locator('.BibleWindow .section').evaluateAll(
        els => els.map(el => (el.getAttribute('data-id') ?? '').toLowerCase())
      );
      return ids.some(id => id.includes('jn3'));
    }, { timeout: 15_000 }).toBe(true);
  });

  test('long-form params (textid1/fragmentid1) work the same as short (t1/v1)', async ({ page, profile, makeUrl }) => {
    const text = profileText[profile];
    await page.goto(makeUrl({ w1: 'bible', textid1: text, fragmentid1: 'GN1_1' }));

    await expect(page.locator('.BibleWindow .section').first()).toBeVisible({ timeout: 30_000 });
    await expect.poll(async () => {
      const ids = await page.locator('.BibleWindow .section').evaluateAll(
        els => els.map(el => (el.getAttribute('data-id') ?? '').toLowerCase())
      );
      return ids.some(id => id.includes('gn1'));
    }, { timeout: 15_000 }).toBe(true);
  });

  test('URL params can pin two different windows', async ({ page, profile, makeUrl }) => {
    const text = profileText[profile];
    const second = profile === 'local' ? 'SPABES' : 'ENGASV';
    await page.goto(makeUrl({
      w1: 'bible', t1: text, v1: 'JN1_1',
      w2: 'bible', t2: second, v2: 'JN1_1'
    }));

    await expect(page.locator('.window-tab.BibleWindow')).toHaveCount(2, { timeout: 15_000 });
  });
});
