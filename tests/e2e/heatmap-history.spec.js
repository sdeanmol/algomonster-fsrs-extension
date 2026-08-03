/**
 * @file tests/e2e/heatmap-history.spec.js
 * @description End-to-End (E2E) test suite using Playwright for Activity Heatmap & Review History workflows.
 * Covers contribution heatmap grid rendering, streak metrics calculations, filter dropdown views,
 * and review history timeline view switching (Years, Months, Days).
 */

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const mockActivityCards = [
  {
    id: "act-card-1",
    problemTitle: "Trapping Rain Water",
    problemUrl: "https://leetcode.com/problems/trapping-rain-water/",
    tags: ["Two Pointers", "Stack", "Dynamic Programming"],
    state: 2,
    stability: 18.5,
    difficulty: 6.8,
    reps: 6,
    lapses: 0,
    lastReview: Date.now() - (2 * 24 * 60 * 60 * 1000),
    due: Date.now() + (16 * 24 * 60 * 60 * 1000),
    historyLog: [
      { date: Date.now() - (30 * 24 * 60 * 60 * 1000), rating: 3 },
      { date: Date.now() - (15 * 24 * 60 * 60 * 1000), rating: 3 },
      { date: Date.now() - (2 * 24 * 60 * 60 * 1000), rating: 4 }
    ],
    approach: "Two pointers approach tracking max left and max right walls."
  },
  {
    id: "act-card-2",
    problemTitle: "Serialize and Deserialize Binary Tree",
    problemUrl: "https://leetcode.com/problems/serialize-and-deserialize-binary-tree/",
    tags: ["Tree", "BFS", "String"],
    state: 2,
    stability: 9.1,
    difficulty: 7.0,
    reps: 4,
    lapses: 1,
    lastReview: Date.now() - (1 * 24 * 60 * 60 * 1000),
    due: Date.now() + (8 * 24 * 60 * 60 * 1000),
    historyLog: [
      { date: Date.now() - (20 * 24 * 60 * 60 * 1000), rating: 2 },
      { date: Date.now() - (1 * 24 * 60 * 60 * 1000), rating: 3 }
    ],
    approach: "Preorder traversal serialization with comma delimiters."
  }
];

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

test.describe('Activity Heatmap & Review History E2E Workflows', () => {
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

  test('Activity Heatmap: Render grid, streak cards, and filter selection updates', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, { fsrsCards: mockActivityCards });

    const heatmapUrl = `file://${path.join(process.cwd(), 'build/features/dashboard/heatmap/heatmap.html')}`;
    await page.goto(heatmapUrl);

    // Verify heatmap grid container
    const heatmapGrid = page.locator('#full-heatmap-grid');
    await expect(heatmapGrid).toBeVisible();

    // Verify gamified stats cards container
    const statsContainer = page.locator('#heatmap-stats-container');
    await expect(statsContainer).toBeVisible();

    // Test filter type dropdown selection
    const filterSelect = page.locator('#filter-type');
    await expect(filterSelect).toBeVisible();

    await filterSelect.selectOption('year-wise');
    const selectYear = page.locator('#select-year');
    await expect(selectYear).toBeVisible();

    await filterSelect.selectOption('lifetime');

    await context.close();
  });

  test('Review History: Render activity history log, breadcrumb, and view button toggles', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, { fsrsCards: mockActivityCards });

    const historyUrl = `file://${path.join(process.cwd(), 'build/features/dashboard/history/history.html')}`;
    await page.goto(historyUrl);

    // Verify header and breadcrumb navigation
    const breadcrumb = page.locator('#breadcrumb');
    await expect(breadcrumb).toBeVisible();

    // Verify view toggle buttons
    const viewYearBtn = page.locator('#view-year');
    const viewMonthBtn = page.locator('#view-month');
    const viewDayBtn = page.locator('#view-day');

    await expect(viewYearBtn).toBeVisible();
    await expect(viewMonthBtn).toBeVisible();
    await expect(viewDayBtn).toBeVisible();

    // Click view buttons and verify active class updates
    await viewMonthBtn.click();
    await expect(viewMonthBtn).toHaveClass(/active/);

    await viewDayBtn.click();
    await expect(viewDayBtn).toHaveClass(/active/);

    await viewYearBtn.click();
    await expect(viewYearBtn).toHaveClass(/active/);

    // Verify chart/data container grid is rendered
    const chartContainer = page.locator('#chart-container');
    await expect(chartContainer).toBeVisible();

    await context.close();
  });
});
