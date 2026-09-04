import { defineConfig } from '@playwright/test';

/**
 * By default the suite boots its own production build on :3000 and
 * reuses one if it is already there — which in practice means the dev
 * server, since that is what is usually running on that port.
 *
 * PLAYWRIGHT_BASE_URL overrides it and skips the managed server, for
 * running against a production build on another port. It used to be
 * ignored: the base URL was hard-coded, so runs that looked like they
 * were verifying `npm run build` output were quietly hitting the dev
 * server instead. Dev is roughly twice as janky, which makes it a
 * pessimistic place to measure timing and a flaky one to assert on.
 */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run build && npm run start',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
