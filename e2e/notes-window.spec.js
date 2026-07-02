/**
 * Notes window: a created note autosaves and survives a reload (the core
 * localStorage-only promise), plus same-tab multi-window sync and offline
 * verse-reference detection.
 */

import { test, expect } from './fixtures.js';

test.describe('notes window', () => {
  test('creates a note, autosaves, and survives a reload', async ({ page, makeUrl }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));

    await page.goto(makeUrl({ w1: 'notes' }));
    await expect(page.locator('.window.NotesWindow')).toHaveCount(1, { timeout: 15_000 });

    await page.locator('.notes-new-btn').click();
    await page.locator('.notes-title-input').fill('Persistence check');
    await page.locator('.notes-editor').fill('See John 3:16 for context');

    // Debounced autosave runs after 1s and flips the status to "Saved".
    await expect(page.locator('.notes-status')).toHaveText('Saved', { timeout: 5_000 });

    // Offline verse detection surfaces the typed reference as a chip.
    await expect(page.locator('.notes-ref-chip')).toHaveText('John 3:16');

    // The stored payload is versioned (schema v1).
    const payload = await page.evaluate(() => JSON.parse(localStorage.getItem('browserbible_notes')));
    expect(payload.version).toBe(1);
    expect(payload.notes).toHaveLength(1);
    expect(payload.notes[0].title).toBe('Persistence check');

    await page.reload();
    await expect(page.locator('.window.NotesWindow')).toHaveCount(1, { timeout: 15_000 });
    await expect(page.locator('.notes-list-item-title')).toHaveText('Persistence check', { timeout: 10_000 });

    expect(errors, `Page errors:\n${errors.join('\n')}`).toEqual([]);
  });

  test('two notes windows in one tab stay in sync through the shared store', async ({ page, makeUrl }) => {
    await page.goto(makeUrl({ w1: 'notes', w2: 'notes' }));
    await expect(page.locator('.window.NotesWindow')).toHaveCount(2, { timeout: 15_000 });

    const first = page.locator('.window.NotesWindow').nth(0);
    const second = page.locator('.window.NotesWindow').nth(1);

    await first.locator('.notes-new-btn').click();
    await first.locator('.notes-title-input').fill('Shared note');
    await expect(first.locator('.notes-status')).toHaveText('Saved', { timeout: 5_000 });

    // The second window renders the same note without any reload.
    await expect(second.locator('.notes-list-item-title')).toHaveText('Shared note', { timeout: 5_000 });
  });
});
