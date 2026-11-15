import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests run against the production build (so the offline service worker is real),
 * on phone-, tablet- and desktop-sized viewports, using real touch events on the mobile ones.
 * Device scale factor stays at 1: headless Chromium renders WebGL in software, and layout is
 * measured in CSS pixels, so density adds minutes without adding coverage.
 */
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // Chromium renders WebGL in software here; a few workers keep frame times honest.
  workers: 3,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
  projects: [
    { name: 'phone', use: { viewport: { width: 393, height: 851 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true }, testIgnore: /desktop\.spec\.ts/ },
    { name: 'small-phone', use: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true }, testMatch: /layout\.spec\.ts/ },
    { name: 'large-phone', use: { viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true }, testMatch: /layout\.spec\.ts/ },
    { name: 'tablet', use: { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true }, testMatch: /layout\.spec\.ts/ },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } }, testMatch: /(layout|desktop)\.spec\.ts/ },
  ],
});
