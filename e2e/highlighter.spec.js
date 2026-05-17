/**
 * HighlighterPlugin — verifies that a highlight stored in localStorage is
 * restored to the DOM on a fresh load. This is the user-perceived contract:
 * "highlight a verse, come back later, see it again."
 *
 * We seed localStorage rather than simulating a text selection (which is
 * brittle in headless browsers) — the restore path is what the user
 * experiences and is the meaningful thing to verify.
 */

import { test, expect } from './fixtures.js';

test.describe('highlighter persistence', () => {
  test('a highlight saved to localStorage is restored on the next load', async ({ page, makeUrl }) => {
    const textid = 'ENGWEB';
    const verseId = 'JN3_16';
    const hlId = 'hl_e2etest';

    // Seed before any page script runs.
    await page.addInitScript(({ textid, verseId, hlId }) => {
      window.localStorage.setItem('browserbible_highlights', JSON.stringify({
        [textid]: [{
          id: hlId,
          verseId,
          startOffset: 0,
          endOffset: 12,
          color: '#ff7',
          created: 0
        }]
      }));
    }, { textid, verseId, hlId });

    await page.goto(makeUrl({ w1: 'bible', t1: textid, v1: 'JN3_1' }));

    // Wait for the verse to render, then for at least one highlight mark to
    // attach. The plugin can split a range into multiple <mark> elements when
    // the selection crosses element boundaries (one per inner span), so we
    // assert "at least one" rather than "exactly one".
    await expect(page.locator(`.BibleWindow [data-id="${verseId}"]`)).toBeAttached({ timeout: 30_000 });
    await expect.poll(async () =>
      page.locator(`mark.user-highlight[data-hl-id="${hlId}"]`).count(),
      { timeout: 15_000 }
    ).toBeGreaterThan(0);
  });

  test('a different verse without a stored highlight has no .user-highlight', async ({ page, makeUrl }) => {
    // Explicit empty seed so the test is deterministic.
    await page.addInitScript(() => {
      window.localStorage.setItem('browserbible_highlights', JSON.stringify({}));
    });

    await page.goto(makeUrl({ w1: 'bible', t1: 'ENGWEB', v1: 'GN1_1' }));
    await expect(page.locator('.BibleWindow .section').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.BibleWindow mark.user-highlight')).toHaveCount(0);
  });
});
