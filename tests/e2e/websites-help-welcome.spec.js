/**
 * @file tests/e2e/websites-help-welcome.spec.js
 * @description End-to-End (E2E) test suite using Playwright for Platforms Manager, Help Center,
 * Welcome Onboarding, and Digest Summary pages.
 * Covers whitelisting custom domains, searching help topics, tab navigation, theme selection,
 * and digest KPI hero card rendering.
 */

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const mockWebsitesData = {
  customWhitelistedSites: [
    { domain: "geeksforgeeks.org", isDefault: false }
  ],
  theme: "dark",
  fsrsCards: [
    {
      id: "summary-card-1",
      problemTitle: "Course Schedule",
      problemUrl: "https://leetcode.com/problems/course-schedule/",
      tags: ["Graph", "Topological Sort", "DFS"],
      state: 2,
      stability: 12.0,
      difficulty: 5.5,
      reps: 5,
      lapses: 0,
      lastReview: Date.now() - (2 * 24 * 60 * 60 * 1000),
      due: Date.now() + (10 * 24 * 60 * 60 * 1000),
      historyLog: [{ date: Date.now() - (2 * 24 * 60 * 60 * 1000), rating: 3 }],
      approach: "Kahn's algorithm using in-degree array and BFS queue."
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
  window.chrome.permissions = {
    request: (perm, cb) => {
      if (cb) cb(true);
      return Promise.resolve(true);
    }
  };
}

test.describe('Platforms Manager, Help Center, Welcome & Summary E2E Workflows', () => {
  let browser;

  test.beforeAll(async () => {
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--allow-file-access-from-files']
    });
  });

  test.afterAll(async () => {
    if (browser) await browser.close().catch(() => {});
  });

  test('Active Platforms Manager: Add custom domain, render whitelist, and trigger restore defaults', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockWebsitesData);

    const websitesUrl = `file://${path.join(process.cwd(), 'build/features/common/websites/websites.html')}`;
    await page.goto(websitesUrl);

    const pageTitle = page.locator('#page-title');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toContainText('Active Platforms');

    const domainInput = page.locator('#domain-input');
    const addBtn = page.locator('#add-domain-btn');
    const sitesList = page.locator('#whitelisted-sites-list');

    await expect(domainInput).toBeVisible();
    await expect(sitesList).toBeVisible();

    await domainInput.fill('mycodeplatform.io');
    await addBtn.click();

    const restoreBtn = page.locator('#restore-defaults-btn');
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();

    await context.close();
  });

  test('Interactive Help Center: Search topic filter and switch navigation tabs', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockWebsitesData);

    const helpUrl = `file://${path.join(process.cwd(), 'build/features/common/help/help.html')}`;
    await page.goto(helpUrl);

    const overviewTab = page.locator('.tab-btn[data-tab="overview"]');
    await expect(overviewTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });

    const searchInput = page.locator('#help-search-input');
    await expect(searchInput).toBeVisible();
    await searchInput.fill('FSRS');

    // Clear search filter to restore tab navigation
    await searchInput.fill('');
    await searchInput.dispatchEvent('input');

    const fsrsTab = page.locator('.tab-btn[data-tab="fsrs"]');
    await expect(fsrsTab).toBeVisible();
    await fsrsTab.click();

    const fsrsPane = page.locator('#tab-fsrs');
    await expect(fsrsPane).toBeVisible();

    const analyticsTab = page.locator('.tab-btn[data-tab="analytics"]');
    await analyticsTab.click();

    const analyticsPane = page.locator('#tab-analytics');
    await expect(analyticsPane).toBeVisible();

    await context.close();
  });

  test('Welcome Onboarding: Navigate onboarding steps, switch themes, and grant permissions', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockWebsitesData);

    const welcomeUrl = `file://${path.join(process.cwd(), 'build/features/common/welcome/welcome.html')}`;
    await page.goto(welcomeUrl);

    const step1 = page.locator('#step-1');
    await expect(step1).toBeVisible();

    const lightThemeBtn = page.locator('#set-light-btn');
    await expect(lightThemeBtn).toBeVisible();
    await lightThemeBtn.click();

    const nextBtn = page.locator('#welcome-next-btn');
    await nextBtn.click();

    const step2 = page.locator('#step-2');
    await expect(step2).toBeVisible();

    await nextBtn.click();
    const step3 = page.locator('#step-3');
    await expect(step3).toBeVisible();

    const enableBtn = page.locator('#welcome-enable-btn');
    await expect(enableBtn).toBeVisible();
    await enableBtn.click();

    await context.close();
  });

  test('Digest & Summary View: Toggle period tabs and render KPI hero metrics', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, mockWebsitesData);

    const summaryUrl = `file://${path.join(process.cwd(), 'build/features/dashboard/summary/summary.html')}`;
    await page.goto(summaryUrl);

    const kpiReviews = page.locator('#kpi-reviews');
    await expect(kpiReviews).not.toHaveText('-', { timeout: 10000 });

    const weeklyBtn = page.locator('#period-weekly-btn');
    const monthlyBtn = page.locator('#period-monthly-btn');

    await expect(weeklyBtn).toBeVisible();
    await expect(monthlyBtn).toBeVisible();

    await monthlyBtn.click();
    await expect(monthlyBtn).toHaveClass(/active/);

    await weeklyBtn.click();
    await expect(weeklyBtn).toHaveClass(/active/);

    await context.close();
  });
});
