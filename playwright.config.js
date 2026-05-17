import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.js$/,
  globalSetup: './e2e/global-setup.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  // Each browser runs twice — once against the remote inscript.bible.cloud
  // content (default config) and once against the local starter pack served
  // from browserbible/public/content/texts/. The "local" projects depend on
  // the starter pack having been downloaded; globalSetup handles this unless
  // SKIP_STARTER_PACK=1 is set.
  projects: [
    { name: 'chromium-remote', metadata: { profile: 'remote' }, use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-remote',  metadata: { profile: 'remote' }, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-remote',   metadata: { profile: 'remote' }, use: { ...devices['Desktop Safari'] } },
    { name: 'chromium-local',  metadata: { profile: 'local' },  use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-local',   metadata: { profile: 'local' },  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-local',    metadata: { profile: 'local' },  use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm exec vite --port 5173 --open false',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'pipe',
  },
});
