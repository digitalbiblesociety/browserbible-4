/**
 * Playwright test fixtures.
 *
 * Provides `appPath` keyed off the project's `metadata.profile`:
 *   - 'remote' (default) → '/'           hits inscript.bible.cloud
 *   - 'local'            → '/?custom=local' serves content from public/
 *
 * Specs use `await page.goto(appPath)` instead of hardcoding '/' so the same
 * suite runs in both modes without forking.
 */

import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  appPath: async ({}, use, testInfo) => {
    const profile = testInfo.project.metadata?.profile ?? 'remote';
    const path = profile === 'local' ? '/?custom=local' : '/';
    await use(path);
  },
  profile: async ({}, use, testInfo) => {
    await use(testInfo.project.metadata?.profile ?? 'remote');
  },
  // Build a URL combining the profile's base query with extra params.
  // makeUrl({ dev: 'true' }) → '/?custom=local&dev=true' (local) or '/?dev=true' (remote)
  makeUrl: async ({}, use, testInfo) => {
    const profile = testInfo.project.metadata?.profile ?? 'remote';
    await use((extra = {}) => {
      const params = new URLSearchParams();
      if (profile === 'local') params.set('custom', 'local');
      for (const [k, v] of Object.entries(extra)) params.set(k, v);
      const qs = params.toString();
      return qs ? `/?${qs}` : '/';
    });
  }
});

export { expect };
