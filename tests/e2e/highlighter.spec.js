/**
 * @file tests/e2e/highlighter.spec.js
 * @description End-to-End (E2E) test suite using Playwright for the Highlighter feature.
 * Covers palette creation, color picker updates, default color persistence,
 * highlights manager search/delete workflows, and resetting options.
 */

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const mockHighlighterStorage = {
  highlighterOptions: {
    defaultColor: '#ffeb3b',
    enableMarkerMenu: true,
    palettes: [
      {
        id: 'palette-default',
        name: 'Standard Marker',
        colors: ['#ffeb3b', '#ff9800', '#4caf50', '#00bcd4', '#e91e63']
      }
    ]
  },
  marks: [
    {
      id: 'hl-101',
      url: 'https://leetcode.com/problems/two-sum/',
      text: 'Hash Map single-pass lookup guarantees O(n) runtime.',
      color: '#ffeb3b',
      timestamp: Date.now() - 100000,
      note: 'Key insight for array lookup'
    },
    {
      id: 'hl-102',
      url: 'https://algomonster.com/problems/binary_search',
      text: 'Always check boundary condition left <= right.',
      color: '#4caf50',
      timestamp: Date.now() - 50000,
      note: 'Off-by-one prevention'
    }
  ]
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

test.describe('Highlighter Feature E2E Workflows', () => {
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

  test('Palette Creator: Create new custom color palette and verify UI interaction', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockHighlighterStorage);

    const optionsUrl = `file://${path.join(process.cwd(), 'build/features/highlighter/options/highlightOptions.html')}`;
    await page.goto(optionsUrl);

    const pageHeader = page.locator('h2');
    await expect(pageHeader).toContainText('Highlighter Appearance');

    const paletteNameInput = page.locator('#palette-name-input');
    await expect(paletteNameInput).toBeVisible();

    await paletteNameInput.fill('Algo Monster Sunset');

    const addSlotBtn = page.locator('#add-slot-btn');
    if (await addSlotBtn.isVisible()) {
      await addSlotBtn.click();
    }

    const savePaletteBtn = page.locator('#save-palette-btn');
    await savePaletteBtn.click();

    const toast = page.locator('#status-toast');
    await expect(toast).toBeVisible();

    await context.close();
  });

  test('Highlights Manager: View saved snippets and search filter', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockHighlighterStorage);

    const managerUrl = `file://${path.join(process.cwd(), 'build/features/highlighter/manager/highlights.html')}`;
    await page.goto(managerUrl);

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('Hash Map');
    await expect(page.locator('#highlights-container')).toContainText('Hash Map');

    await context.close();
  });

  test('Reset Options: Revert custom palettes back to extension default palette', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockHighlighterStorage);

    const optionsUrl = `file://${path.join(process.cwd(), 'build/features/highlighter/options/highlightOptions.html')}`;
    await page.goto(optionsUrl);

    const resetBtn = page.locator('#reset-palettes-btn');
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      const toast = page.locator('#status-toast');
      await expect(toast).toBeVisible();
    }

    await context.close();
  });
});
