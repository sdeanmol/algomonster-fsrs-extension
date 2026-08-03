const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

test.describe('Extension Load and Basic Interactivity', () => {
  let browser;

  test.beforeAll(async () => {
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-gpu']
    });
  });

  test.afterAll(async () => {
    if (browser) {
      await browser.close().catch(() => {});
    }
  });

  test('popup renders correctly', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(() => {
      window.chrome = window.chrome || {};
      window.chrome.storage = {
        local: {
          get: (keys, cb) => {
            const res = { fsrsCards: [] };
            if (cb) cb(res);
            return Promise.resolve(res);
          },
          set: (items, cb) => {
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
    });

    const popupPath = `file://${path.join(process.cwd(), 'build/features/dashboard/popup/popup.html')}`;
    await page.goto(popupPath);

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

    await page.addInitScript(() => {
      window.chrome = window.chrome || {};
      window.chrome.storage = {
        local: {
          get: (keys, cb) => {
            const res = { highlighterOptions: { defaultColor: '#ffeb3b', palettes: [] } };
            if (cb) cb(res);
            return Promise.resolve(res);
          },
          set: (items, cb) => {
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
    });

    const optionsPath = `file://${path.join(process.cwd(), 'build/features/highlighter/options/highlightOptions.html')}`;
    await page.goto(optionsPath);

    const header = page.locator('h2');
    await expect(header).toBeVisible();
    await expect(header).toContainText('Highlighter Appearance');

    const paletteNameInput = page.locator('#palette-name-input');
    await expect(paletteNameInput).toBeVisible();

    await context.close();
  });
});
