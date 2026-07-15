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
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
});
