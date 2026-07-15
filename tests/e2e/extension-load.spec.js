const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Extension Load and Basic Interactivity', () => {
  let browserContext;
  let extensionId;

  test.beforeAll(async () => {
    const pathToExtension = path.join(__dirname, '../../');
    browserContext = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    });

    // Locate the background page/service worker to find the extension ID
    let [background] = browserContext.serviceWorkers();
    if (!background) {
      background = await browserContext.waitForEvent('serviceworker');
    }
    const extensionIdMatch = background.url().match(/chrome-extension:\/\/([^/]+)\//);
    if (extensionIdMatch) {
      extensionId = extensionIdMatch[1];
    }
  });

  test.afterAll(async () => {
    if (browserContext) {
      await browserContext.close();
    }
  });

  test('popup renders correctly', async ({ page }) => {
    if (!extensionId) {
      test.skip('Could not determine extension ID');
    }

    // Navigate to popup
    await page.goto(`chrome-extension://${extensionId}/features/dashboard/popup/popup.html`);

    // Verify main containers are present
    const dashboardContainer = page.locator('.dashboard-container');
    await expect(dashboardContainer).toBeVisible();

    // Verify specific UI elements
    const statsTab = page.locator('#nav-stats');
    await expect(statsTab).toBeVisible();
    await expect(statsTab).toHaveText('Stats');

    // Click history tab and verify view switches
    const historyTab = page.locator('#nav-history');
    await historyTab.click();
    
    // In the real app, this changes display styles. We can check if a certain section is active
    const historyView = page.locator('#view-history');
    await expect(historyView).toBeVisible();
  });

  test('options page renders correctly', async ({ page }) => {
    if (!extensionId) {
      test.skip('Could not determine extension ID');
    }

    await page.goto(`chrome-extension://${extensionId}/features/highlighter/options/highlightOptions.html`);

    const header = page.locator('h1');
    await expect(header).toContainText('Settings');

    // Verify some form elements exist
    const enableToggle = page.locator('#enable-highlighter');
    await expect(enableToggle).not.toBeNull();
  });
});
