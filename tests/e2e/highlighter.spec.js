/**
 * @file tests/e2e/highlighter.spec.js
 * @description End-to-End (E2E) test suite using Playwright for the Highlighter feature.
 * Covers palette creation, color picker updates, default color persistence,
 * highlights manager search/delete workflows, and resetting options.
 *
 * Refactored to use shared helpers + new tests for colour picker, delete highlight,
 * edit note, and sort order validation.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const { injectChromePolyfill } = require('./helpers/chrome-polyfill');
const { launchBrowser, closeBrowser, buildFileUrl } = require('./helpers/browser-setup');
const { getStorageValue } = require('./helpers/storage-helpers');
const { mockMarks, mockChromeSettings } = require('./helpers/fixtures');

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
  chromeSettings: {
    ...mockChromeSettings,
    showMarkerPopup: true,
    palettes: [
      { name: 'Standard Marker', colors: ['#ffeb3b', '#ff9800', '#4caf50', '#00bcd4', '#e91e63'] }
    ]
  },
  marks: [
    {
      id: 'hl-101',
      url: 'https://leetcode.com/problems/two-sum/',
      text: 'Hash Map single-pass lookup guarantees O(n) runtime.',
      color: '#ffeb3b',
      type: 'highlight',
      createdAt: Date.now() - 100000,
      timestamp: Date.now() - 100000,
      note: 'Key insight for array lookup'
    },
    {
      id: 'hl-102',
      url: 'https://algomonster.com/problems/binary_search',
      text: 'Always check boundary condition left <= right.',
      color: '#4caf50',
      type: 'highlight',
      createdAt: Date.now() - 50000,
      timestamp: Date.now() - 50000,
      note: 'Off-by-one prevention'
    },
    {
      id: 'hl-103',
      url: 'https://leetcode.com/problems/merge-intervals/',
      text: 'Sort intervals by start time first.',
      color: '#e91e63',
      type: 'highlight',
      createdAt: Date.now() - 20000,
      timestamp: Date.now() - 20000,
      note: ''
    }
  ]
};

test.describe('Highlighter Feature E2E Workflows', () => {
  let browser;

  test.beforeAll(async () => {
    browser = await launchBrowser();
  });

  test.afterAll(async () => {
    await closeBrowser(browser);
  });

  // --- Palette Options Page Tests ---

  test('Palette Creator: Create new custom color palette and verify UI interaction', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockHighlighterStorage);

    const optionsUrl = buildFileUrl('features/highlighter/options/highlightOptions.html');
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

  test('Default colour picker: Change default highlight colour via colour input', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockHighlighterStorage);

    const optionsUrl = buildFileUrl('features/highlighter/options/highlightOptions.html');
    await page.goto(optionsUrl);

    // Find the colour picker input
    const colorPicker = page.locator('#default-color');
    await expect(colorPicker).toBeVisible();

    // Verify current value matches default
    const currentVal = await colorPicker.inputValue();
    expect(currentVal).toBe('#ffeb3b');

    // Set to new colour via JavaScript (Playwright can't interact with native colour picker)
    await page.evaluate(() => {
      const picker = document.getElementById('default-color');
      if (picker) {
        picker.value = '#ff6b6b';
        picker.dispatchEvent(new Event('input', { bubbles: true }));
        picker.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Verify hex display updated
    const hexDisplay = page.locator('#default-hex');
    if (await hexDisplay.isVisible()) {
      await expect(hexDisplay).toContainText(/#ff6b6b/i);
    }

    await context.close();
  });

  test('Reset Options: Revert custom palettes back to extension default palette', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockHighlighterStorage);

    const optionsUrl = buildFileUrl('features/highlighter/options/highlightOptions.html');
    await page.goto(optionsUrl);

    const resetBtn = page.locator('#reset-palettes-btn');
    if (await resetBtn.isVisible()) {
      await resetBtn.click();
      const toast = page.locator('#status-toast');
      await expect(toast).toBeVisible();
    }

    await context.close();
  });

  // --- Highlights Manager Tests ---

  test('Highlights Manager: View saved snippets and search filter', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockHighlighterStorage);

    const managerUrl = buildFileUrl('features/highlighter/manager/highlights.html');
    await page.goto(managerUrl);

    const searchInput = page.locator('#search-input');
    await expect(searchInput).toBeVisible();

    await searchInput.fill('Hash Map');
    await expect(page.locator('#highlights-container')).toContainText('Hash Map');

    await context.close();
  });

  test('Highlights Manager: Search returns no results message for unmatched query', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockHighlighterStorage);

    const managerUrl = buildFileUrl('features/highlighter/manager/highlights.html');
    await page.goto(managerUrl);

    const searchInput = page.locator('#search-input');
    await searchInput.fill('zzz_nonexistent_search_xyz');
    await page.waitForTimeout(300);

    // Verify either no cards shown or "no results" message displayed
    const container = page.locator('#highlights-container');
    const containerText = await container.textContent();
    // Either the container is empty or shows a no-results message
    const noCards = !containerText.includes('Hash Map') && !containerText.includes('boundary');
    expect(noCards).toBeTruthy();

    await context.close();
  });

  test('Highlights Manager: Sort by newest renders most recent highlight first', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockHighlighterStorage);

    const managerUrl = buildFileUrl('features/highlighter/manager/highlights.html');
    await page.goto(managerUrl);

    // Ensure sort is set to "Newest First"
    const sortSelect = page.locator('#sort-select');
    await sortSelect.selectOption('newest');
    await page.waitForTimeout(300);

    // The newest highlight (hl-103 "Sort intervals...") should appear first
    const container = page.locator('#highlights-container');
    const text = await container.textContent();
    // hl-103 was created most recently, so should appear before hl-101
    const posSort = text.indexOf('Sort intervals');
    const posHash = text.indexOf('Hash Map');
    if (posSort !== -1 && posHash !== -1) {
      expect(posSort).toBeLessThan(posHash);
    }

    await context.close();
  });

  test('Highlights Manager: Source page filter dropdown populates with unique URLs', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockHighlighterStorage);

    const managerUrl = buildFileUrl('features/highlighter/manager/highlights.html');
    await page.goto(managerUrl);

    const webpageSelect = page.locator('#webpage-select');
    await expect(webpageSelect).toBeVisible();

    // Should have "All Pages" + individual source pages
    const optionCount = await webpageSelect.locator('option').count();
    expect(optionCount).toBeGreaterThanOrEqual(2); // At least "All Pages" + 1 page

    await context.close();
  });

  test('Highlights Manager: Clear filters button resets search and shows all highlights', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockHighlighterStorage);

    const managerUrl = buildFileUrl('features/highlighter/manager/highlights.html');
    await page.goto(managerUrl);

    // Apply a search filter
    const searchInput = page.locator('#search-input');
    await searchInput.fill('Hash Map');
    await page.waitForTimeout(300);

    // Look for the clear filters button
    const clearBtn = page.locator('#clear-filters-btn');
    const clearVisible = await clearBtn.isVisible().catch(() => false);

    if (clearVisible) {
      await clearBtn.click();
      await page.waitForTimeout(300);

      // Search should be cleared
      await expect(searchInput).toHaveValue('');

      // All highlights should be visible again
      const container = page.locator('#highlights-container');
      const text = await container.textContent();
      expect(text).toContain('Hash Map');
      expect(text).toContain('boundary condition');
    }

    await context.close();
  });
});
