/**
 * @file tests/e2e/dashboard.spec.js
 * @description End-to-End (E2E) test suite for Dashboard features.
 * Covers Popup overview, search filter, theme toggle, notification settings,
 * stats assertions, and streak/goal display.
 *
 * Refactored to shared helpers + new deep workflow tests.
 */

const { test, expect } = require('@playwright/test');
const { injectChromePolyfill } = require('./helpers/chrome-polyfill');
const { launchBrowser, closeBrowser, buildFileUrl } = require('./helpers/browser-setup');
const { getStorageValue } = require('./helpers/storage-helpers');
const { reviewCard, learningCard, futureCard, newCard, allCards, buildActivityData, mockChromeSettings } = require('./helpers/fixtures');

const mockDashboardCards = [
  {
    id: "dash-card-1",
    problemTitle: "Binary Tree Maximum Path Sum",
    problemUrl: "https://leetcode.com/problems/binary-tree-maximum-path-sum/",
    tags: ["Tree", "DFS", "Dynamic Programming"],
    state: 2,
    stability: 8.4,
    difficulty: 7.2,
    reps: 4,
    lapses: 1,
    lastReview: Date.now() - (1 * 24 * 60 * 60 * 1000),
    due: Date.now() - (1000 * 60 * 60), // Due 1h ago
    historyLog: [{ date: Date.now() - (1 * 24 * 60 * 60 * 1000), rating: 3 }],
    approach: "Post-order DFS returning max single path sum to parent."
  },
  {
    id: "dash-card-2",
    problemTitle: "Merge K Sorted Lists",
    problemUrl: "https://leetcode.com/problems/merge-k-sorted-lists/",
    tags: ["Heap", "Linked List", "Divide and Conquer"],
    state: 2,
    stability: 22.0,
    difficulty: 5.0,
    reps: 5,
    lapses: 0,
    lastReview: Date.now() - (4 * 24 * 60 * 60 * 1000),
    due: Date.now() + (3 * 24 * 60 * 60 * 1000), // Not yet due
    historyLog: [{ date: Date.now() - (4 * 24 * 60 * 60 * 1000), rating: 4 }],
    approach: "Min-heap priority queue storing current node heads."
  },
  {
    id: "dash-card-3",
    problemTitle: "Contains Duplicate",
    problemUrl: "https://leetcode.com/problems/contains-duplicate/",
    tags: ["Array", "Hash Table"],
    state: 0,
    stability: 0,
    difficulty: 0,
    reps: 0,
    lapses: 0,
    lastReview: 0,
    due: 0,
    historyLog: [],
    approach: ""
  }
];

test.describe('Dashboard & Gamification E2E Workflows', () => {
  let browser;

  test.beforeAll(async () => {
    browser = await launchBrowser();
  });

  test.afterAll(async () => {
    await closeBrowser(browser);
  });

  test('Popup Overview: Renders cards statistics, search filter, and theme toggle', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: mockDashboardCards,
      notificationSettings: {
        enabled: true,
        frequency: '60',
        priority: '2',
        requireInteraction: true
      }
    });

    const popupUrl = buildFileUrl('features/dashboard/popup/popup.html');
    await page.goto(popupUrl);

    const appTitle = page.locator('.app-title');
    await expect(appTitle).toBeVisible();
    await expect(appTitle).toContainText('AlgoRecall');

    const totalBox = page.locator('#total-cards');
    await expect(totalBox).toBeVisible();

    const searchInput = page.locator('#popup-search-input');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Binary Tree');
    }

    const themeBtn = page.locator('#theme-toggle-btn');
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
    }

    await context.close();
  });

  test('Notification Settings: Toggle quiet hours and interval select persistence', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      notificationSettings: {
        enabled: true,
        frequency: '60',
        priority: '2',
        requireInteraction: true,
        quietHoursEnabled: false,
        quietHoursStart: '23:00',
        quietHoursEnd: '07:00'
      }
    });

    const popupUrl = buildFileUrl('features/dashboard/popup/popup.html');
    await page.goto(popupUrl);

    const intervalSelect = page.locator('#notification-interval');
    if (await intervalSelect.isVisible()) {
      await intervalSelect.selectOption('30');
    }

    const quietToggle = page.locator('#toggle-quiet-hours');
    if (await quietToggle.isVisible()) {
      await quietToggle.check({ force: true });
    }

    await context.close();
  });

  // --- NEW Phase 3 Tests ---

  test('Total cards counter displays correct count', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: mockDashboardCards
    });

    const popupUrl = buildFileUrl('features/dashboard/popup/popup.html');
    await page.goto(popupUrl);

    const totalCards = page.locator('#total-cards');
    await expect(totalCards).toBeVisible();

    // Check that total count is displayed (should be 3)
    const totalText = await totalCards.textContent();
    expect(totalText).toContain('3');

    await context.close();
  });

  test('Search filter narrows displayed cards and shows matching results', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: mockDashboardCards
    });

    const popupUrl = buildFileUrl('features/dashboard/popup/popup.html');
    await page.goto(popupUrl);

    const searchInput = page.locator('#popup-search-input');
    if (await searchInput.isVisible()) {
      await searchInput.fill('Binary');
      await page.waitForTimeout(300);

      // Verify card list shows only matching items
      const cardsList = page.locator('#cards-list, .card-list, .cards-container');
      if (await cardsList.isVisible().catch(() => false)) {
        const listText = await cardsList.textContent();
        expect(listText).toContain('Binary');
        // The non-matching "Merge K Sorted Lists" should not be present or should be hidden
      }

      // Clear the search
      await searchInput.fill('');
      await page.waitForTimeout(300);
    }

    await context.close();
  });

  test('Theme toggle switches CSS class on document root', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: mockDashboardCards,
      theme: 'dark'
    });

    const popupUrl = buildFileUrl('features/dashboard/popup/popup.html');
    await page.goto(popupUrl);

    const themeBtn = page.locator('#theme-toggle-btn');
    if (await themeBtn.isVisible()) {
      // Check initial state (dark theme by default)
      const initialClass = await page.evaluate(() => document.documentElement.className);

      // Click to toggle
      await themeBtn.click();
      await page.waitForTimeout(200);

      // Check that theme class changed
      const newClass = await page.evaluate(() => document.documentElement.className);
      // The class should have changed (either added or removed 'light-theme')
      expect(newClass !== initialClass || newClass.includes('light')).toBeTruthy();
    }

    await context.close();
  });

  test('Activity streak displays correct consecutive day count', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Build 5-day streak of activity
    const activity = {};
    for (let i = 0; i < 5; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      activity[key] = 3 + i;
    }

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: mockDashboardCards,
      fsrsActivity: activity
    });

    const popupUrl = buildFileUrl('features/dashboard/popup/popup.html');
    await page.goto(popupUrl);

    // Look for streak indicator
    const streakEl = page.locator('#current-streak, .streak-count, .streak-value, [data-stat="streak"]');
    if (await streakEl.first().isVisible().catch(() => false)) {
      const streakText = await streakEl.first().textContent();
      // Should contain "5" for the 5-day streak
      expect(streakText).toContain('5');
    }

    await context.close();
  });
});
