/**
 * @file tests/e2e/helpers/browser-setup.js
 * @description Shared browser launch and teardown utilities for Playwright E2E tests.
 * Provides a consistent Chromium launch configuration used across all spec files.
 *
 * Uses launchPersistentContext with a workspace-local temp user-data-dir to
 * avoid ProcessSingleton lock conflicts with any running Chrome instance.
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Default Chrome executable path for macOS.
 * Can be overridden via the CHROME_PATH environment variable.
 */
const CHROME_EXECUTABLE = process.env.CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/**
 * Standard Chromium launch args for extension E2E testing.
 */
const DEFAULT_LAUNCH_ARGS = [
  '--no-sandbox', 
  '--disable-gpu', 
  '--allow-file-access-from-files',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-extensions'
];

/**
 * Creates a unique temp directory inside the workspace for Chrome profiles.
 * @returns {string} Absolute path to the new temp directory.
 */
function createTempDir() {
  const tmpBase = path.join(process.cwd(), '.tmp-e2e');
  if (!fs.existsSync(tmpBase)) {
    fs.mkdirSync(tmpBase, { recursive: true });
  }
  return fs.mkdtempSync(path.join(tmpBase, 'chrome-'));
}

/**
 * Launches a Chromium browser via launchPersistentContext with a unique
 * workspace-local temp profile directory.
 *
 * Returns a wrapper that exposes browser.newContext() and browser.close()
 * so existing test code works without modification.
 *
 * @param {Object} [overrides] - Optional Playwright launch option overrides.
 * @returns {Promise<Object>} Browser-like wrapper.
 */
async function launchBrowser(overrides = {}) {
  const userDataDir = createTempDir();

  const persistentCtx = await chromium.launchPersistentContext(userDataDir, {
    executablePath: CHROME_EXECUTABLE,
    headless: true,
    args: DEFAULT_LAUNCH_ARGS,
    ...overrides
  });

  // Track pages created per "context" so we can close them properly
  const wrapper = {
    _persistentContext: persistentCtx,
    _e2eTempDir: userDataDir,

    /**
     * Creates a new context-like wrapper. Each call returns an object with
     * newPage() and close() methods. close() cleans up the page(s) created
     * through this specific context wrapper.
     */
    async newContext() {
      const contextPages = [];

      return {
        async newPage() {
          const page = await persistentCtx.newPage();
          contextPages.push(page);
          return page;
        },

        async close() {
          for (const page of contextPages) {
            await page.close().catch(() => {});
          }
          contextPages.length = 0;
        }
      };
    },

    async close() {
      await persistentCtx.close().catch(() => {});
      // Clean up temp user-data-dir
      try {
        fs.rmSync(userDataDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  };

  return wrapper;
}

/**
 * Safely closes a browser wrapper and cleans up its temp user-data-dir.
 * @param {Object|null} browser
 */
async function closeBrowser(browser) {
  if (browser) {
    await browser.close();
  }
}

/**
 * Resolves a build-relative HTML file to an absolute `file://` URL.
 * @param {string} relativePath - Path relative to the `build/` directory.
 * @returns {string} Absolute file:// URL.
 */
function buildFileUrl(relativePath) {
  return `file://${path.join(process.cwd(), 'build', relativePath)}`;
}

module.exports = {
  launchBrowser,
  closeBrowser,
  buildFileUrl,
  CHROME_EXECUTABLE,
  DEFAULT_LAUNCH_ARGS
};
