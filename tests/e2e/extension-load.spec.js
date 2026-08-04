/**
 * @file tests/e2e/extension-load.spec.js
 * @description End-to-End (E2E) test suite for basic extension loading and page rendering.
 * Verifies that the popup dashboard and highlighter options page render correctly
 * with expected DOM elements using the shared Chrome API polyfill.
 *
 * Refactored to use shared helpers from tests/e2e/helpers/.
 */

const { test, expect } = require('@playwright/test');
const { injectChromePolyfill } = require('./helpers/chrome-polyfill');
const { launchBrowser, closeBrowser, buildFileUrl } = require('./helpers/browser-setup');
const { mockChromeSettings } = require('./helpers/fixtures');

test.describe('Extension Load and Basic Interactivity', () => {
  let browser;

  test.beforeAll(async () => {
    browser = await launchBrowser();
  });

  test.afterAll(async () => {
    await closeBrowser(browser);
  });

  test('popup renders correctly', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, { fsrsCards: [] });

    const popupUrl = buildFileUrl('features/dashboard/popup/popup.html');
    await page.goto(popupUrl);

    // Verify main app title and header render
    const appTitle = page.locator('.app-title');
    await expect(appTitle).toBeVisible();
    await expect(appTitle).toContainText('AlgoRecall');

    // Verify stats boxes exist
    const totalBox = page.locator('#total-cards');
    await expect(totalBox).toBeVisible();

    await context.close();
  });

  test('options page renders correctly', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      highlighterOptions: { defaultColor: '#ffeb3b', palettes: [] }
    });

    const optionsUrl = buildFileUrl('features/highlighter/options/highlightOptions.html');
    await page.goto(optionsUrl);

    const header = page.locator('h2');
    await expect(header).toBeVisible();
    await expect(header).toContainText('Highlighter Appearance');

    const paletteNameInput = page.locator('#palette-name-input');
    await expect(paletteNameInput).toBeVisible();

    await context.close();
  });
});
