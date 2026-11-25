import { defineConfig } from '@playwright/test';

// PW_CHANNEL lets a developer use an installed browser (e.g. "msedge", "chrome")
// instead of downloading Playwright's Chromium.
const channel = process.env['PW_CHANNEL'];
const ci = Boolean(process.env['CI']);

export default defineConfig({
  testDir: 'test/browser',
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  reporter: ci ? [['list'], ['junit', { outputFile: 'test-results/junit.xml' }]] : 'list',
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium', ...(channel ? { channel } : {}) } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
