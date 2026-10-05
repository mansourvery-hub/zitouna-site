import { defineConfig, devices } from '@playwright/test';

// BASE_URL lets the same suite run against the local build (default) or the
// deployed site:  BASE_URL=https://example.com pnpm exec playwright test
const BASE_URL = process.env.BASE_URL ?? 'http://localhost:8082';
const IS_LIVE = process.env.BASE_URL !== undefined;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],
  // No local server when pointing at an already-deployed site.
  webServer: IS_LIVE
    ? undefined
    : {
        command: 'python3 tools/serve.py',
        url: 'http://localhost:8082',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});