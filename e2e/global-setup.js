/**
 * Playwright global setup — runs once before any e2e test.
 *
 * Ensures the starter pack of Bible texts is present. Set SKIP_STARTER_PACK=1
 * to opt out (useful for tests that don't depend on real texts).
 */

import { ensureStarterPack } from '../tests/scripts/fetch-starter-pack.mjs';

export default async function globalSetup() {
  if (process.env.SKIP_STARTER_PACK === '1') {
    console.log('[e2e] SKIP_STARTER_PACK=1 — skipping starter-pack fetch');
    return;
  }
  const result = await ensureStarterPack();
  if (result.downloaded) {
    console.log('[e2e] Starter pack downloaded.');
  } else {
    console.log(`[e2e] Starter pack: ${result.reason}.`);
  }
}
