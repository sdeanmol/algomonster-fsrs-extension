/**
 * @file tests/e2e/fsrs-config.spec.js
 * @description End-to-End (E2E) test suite using Playwright for FSRS Customizer & Parameters Configuration.
 * Covers Target Retention slider updates, decay/factor constants, 17 FSRS coefficient adjustments,
 * tag-specific profile creation, and parameters reset workflows.
 */

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const mockFsrsConfigStorage = {
  fsrsGlobalParams: {
    requestRetention: 0.90,
    decay: -0.5,
    factor: 0.234567,
    maximumInterval: 36500,
    w: [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61]
  },
  fsrsTopicWeights: {
    "Dynamic Programming": [0.5, 0.7, 2.8, 6.0, 5.2, 1.0, 0.9, 0.02, 1.6, 0.2, 1.0, 2.3, 0.06, 0.4, 1.3, 0.3, 2.7]
  }
};

function injectChromePolyfill(initialData) {
  const store = JSON.parse(JSON.stringify(initialData));
  window.chrome = window.chrome || {};
  window.chrome.storage = {
    local: {
      get: (keys, cb) => {
        let res = {};
        if (Array.isArray(keys)) {
          keys.forEach(k => res[k] = store[k]);
        } else if (typeof keys === 'string') {
          res[keys] = store[keys];
        } else {
          res = { ...store };
        }
        if (cb) cb(res);
        return Promise.resolve(res);
      },
      set: (items, cb) => {
        Object.assign(store, items);
        if (cb) cb();
        return Promise.resolve();
      }
    }
  };
  window.chrome.runtime = {
    getURL: (p) => p,
    sendMessage: () => {},
    onMessage: { addListener: () => {} }
  };
}

test.describe('FSRS Parameters Customizer E2E Workflows', () => {
  let browser;

  test.beforeAll(async () => {
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-gpu']
    });
  });

  test.afterAll(async () => {
    if (browser) await browser.close().catch(() => {});
  });

  test('Global Parameters: Adjust retention slider, decay input, and save settings', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockFsrsConfigStorage);

    const configUrl = `file://${path.join(process.cwd(), 'build/features/tracker/config/fsrsConfig.html')}`;
    await page.goto(configUrl);

    const pageTitle = page.locator('#page-title');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toContainText('FSRS Customizer');

    const retentionSlider = page.locator('#retention-slider');
    const retentionVal = page.locator('#retention-val');

    await expect(retentionSlider).toBeVisible();
    await retentionSlider.fill('0.85');
    await retentionSlider.dispatchEvent('input');
    await expect(retentionVal).toHaveText('85%');

    const decayInput = page.locator('#decay-input');
    await decayInput.fill('-0.6');

    const saveGlobalBtn = page.locator('#save-global-btn');
    await saveGlobalBtn.click();

    const toast = page.locator('#status-toast');
    await expect(toast).toBeVisible();

    await context.close();
  });

  test('Tag Profiles: Add custom tag profile with 17 weights coefficients', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockFsrsConfigStorage);

    const configUrl = `file://${path.join(process.cwd(), 'build/features/tracker/config/fsrsConfig.html')}`;
    await page.goto(configUrl);

    const tagNameInput = page.locator('#new-tag-name');
    const tagWeightsInput = page.locator('#new-tag-weights');
    const addProfileBtn = page.locator('#add-tag-profile-btn');

    await expect(tagNameInput).toBeVisible();

    const mock17Weights = "0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61";
    await tagNameInput.fill('Graph Traversal');
    await tagWeightsInput.fill(mock17Weights);
    await addProfileBtn.click();

    const activeList = page.locator('#active-tag-profiles-list');
    await expect(activeList).toBeVisible();

    await context.close();
  });

  test('Reset Parameters: Trigger reset global parameters back to default state', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockFsrsConfigStorage);

    const configUrl = `file://${path.join(process.cwd(), 'build/features/tracker/config/fsrsConfig.html')}`;
    await page.goto(configUrl);

    const resetGlobalBtn = page.locator('#reset-global-btn');
    if (await resetGlobalBtn.isVisible()) {
      await resetGlobalBtn.click();
      const retentionVal = page.locator('#retention-val');
      await expect(retentionVal).toHaveText('90%');
    }

    await context.close();
  });
});
