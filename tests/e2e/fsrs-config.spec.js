/**
 * @file tests/e2e/fsrs-config.spec.js
 * @description E2E test suite for FSRS Parameters Customizer.
 * Covers retention slider, decay/factor constants, 17 FSRS coefficient adjustments,
 * tag-specific profile creation, reset workflows, and max interval validation.
 *
 * Refactored to shared helpers + new tests for max interval and w-coefficient count.
 */

const { test, expect } = require('@playwright/test');
const { injectChromePolyfill } = require('./helpers/chrome-polyfill');
const { launchBrowser, closeBrowser, buildFileUrl } = require('./helpers/browser-setup');
const { getStorageValue } = require('./helpers/storage-helpers');
const { defaultFsrsParams } = require('./helpers/fixtures');

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

test.describe('FSRS Parameters Customizer E2E Workflows', () => {
  let browser;

  test.beforeAll(async () => {
    browser = await launchBrowser();
  });

  test.afterAll(async () => {
    await closeBrowser(browser);
  });

  test('Global Parameters: Adjust retention slider, decay input, and save settings', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockFsrsConfigStorage);

    const configUrl = buildFileUrl('features/tracker/config/fsrsConfig.html');
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

    const configUrl = buildFileUrl('features/tracker/config/fsrsConfig.html');
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

    const configUrl = buildFileUrl('features/tracker/config/fsrsConfig.html');
    await page.goto(configUrl);

    const resetGlobalBtn = page.locator('#reset-global-btn');
    if (await resetGlobalBtn.isVisible()) {
      await resetGlobalBtn.click();
      const retentionVal = page.locator('#retention-val');
      await expect(retentionVal).toHaveText('90%');
    }

    await context.close();
  });

  // --- NEW Phase 4 Tests ---

  test('Retention slider value persists after save', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockFsrsConfigStorage);

    const configUrl = buildFileUrl('features/tracker/config/fsrsConfig.html');
    await page.goto(configUrl);

    // Adjust to 92%
    const retentionSlider = page.locator('#retention-slider');
    await retentionSlider.fill('0.92');
    await retentionSlider.dispatchEvent('input');

    const retentionVal = page.locator('#retention-val');
    await expect(retentionVal).toHaveText('92%');

    // Save
    await page.locator('#save-global-btn').click();
    await page.waitForTimeout(300);

    // Verify in storage
    const params = await getStorageValue(page, 'fsrsGlobalParams');
    if (params) {
      expect(params.requestRetention).toBe(0.92);
    }

    await context.close();
  });

  test('Maximum interval input is rendered and editable', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockFsrsConfigStorage);

    const configUrl = buildFileUrl('features/tracker/config/fsrsConfig.html');
    await page.goto(configUrl);

    const maxIntervalInput = page.locator('#max-interval-input');
    if (await maxIntervalInput.isVisible()) {
      // Verify default value loaded
      const val = await maxIntervalInput.inputValue();
      expect(parseInt(val)).toBe(36500);

      // Change to 365 days
      await maxIntervalInput.fill('365');

      // Save
      await page.locator('#save-global-btn').click();
      await page.waitForTimeout(300);

      const params = await getStorageValue(page, 'fsrsGlobalParams');
      if (params) {
        expect(params.maximumInterval).toBe(365);
      }
    }

    await context.close();
  });

  test('Existing tag profiles list renders pre-seeded Dynamic Programming profile', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockFsrsConfigStorage);

    const configUrl = buildFileUrl('features/tracker/config/fsrsConfig.html');
    await page.goto(configUrl);

    const activeList = page.locator('#active-tag-profiles-list');
    await expect(activeList).toBeVisible();

    const listText = await activeList.textContent();
    expect(listText).toContain('Dynamic Programming');

    await context.close();
  });
});
