const { defineConfig } = require('@playwright/test');
const path = require('path');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Extensions cannot easily run in parallel in Playwright due to shared contexts
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    channel: 'chrome',
    executablePath: process.platform === 'darwin' ? (process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') : undefined,
    trace: 'on-first-retry',
  },
});
