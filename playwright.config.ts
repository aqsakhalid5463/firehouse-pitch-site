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
  /*
   * One worker, deliberately.
   *
   * Every page in this suite runs a live WebGL scene plus two or three
   * 2D canvases, and the preloader will not lift until the scene has
   * rendered a frame. Run several of those at once and they starve each
   * other: a run with the default worker count failed four tests on a
   * 20-second wait for the preloader, and the same four passed in 35
   * seconds sequentially. The failures moved around between runs, which
   * is the worst kind — the suite looked like it was catching
   * regressions when it was reporting machine load.
   *
   * The wall-clock cost is small because the suite was effectively
   * serialising on the CPU anyway.
   */
  workers: 1,
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
