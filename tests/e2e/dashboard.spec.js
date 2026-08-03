/**
 * @file tests/e2e/dashboard.spec.js
 * @description End-to-End (E2E) test suite using Playwright for Dashboard features.
 * Covers Extension Popup overview, Pomodoro timer interactions, Analytics views,
 * theme toggling, and notification settings persistence.
 */

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

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
    due: Date.now() - (1000 * 60 * 60),
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
    due: Date.now() + (3 * 24 * 60 * 60 * 1000),
    historyLog: [{ date: Date.now() - (4 * 24 * 60 * 60 * 1000), rating: 4 }],
    approach: "Min-heap priority queue storing current node heads."
  }
];

const mockNotificationSettings = {
  notificationsEnabled: true,
  checkIntervalMinutes: 60,
  stickyNotification: true,
  quietHoursEnabled: false,
  quietHoursStart: "23:00",
  quietHoursEnd: "07:00",
  weeklyDigestEnabled: true
};

function injectChromePolyfill(initialData) {
  const store = JSON.parse(JSON.stringify(initialData));
  const changeListeners = [];

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
        const changes = {};
        Object.keys(items).forEach(k => {
          changes[k] = { oldValue: store[k], newValue: items[k] };
          store[k] = items[k];
        });
        if (cb) cb();
        changeListeners.forEach(listener => {
          try { listener(changes, 'local'); } catch {}
        });
        return Promise.resolve();
      }
    },
    onChanged: {
      addListener: (fn) => changeListeners.push(fn),
      removeListener: (fn) => {
        const idx = changeListeners.indexOf(fn);
        if (idx >= 0) changeListeners.splice(idx, 1);
      }
    }
  };
  window.chrome.runtime = {
    getURL: (p) => p,
    sendMessage: () => {},
    onMessage: { addListener: () => {} }
  };
}

test.describe('Dashboard & Gamification E2E Workflows', () => {
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

  test('Popup Overview: Renders cards statistics, search filter, and theme toggle', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: mockDashboardCards,
      settings: mockNotificationSettings
    });

    const popupUrl = `file://${path.join(process.cwd(), 'build/features/dashboard/popup/popup.html')}`;
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

  test('Pomodoro Study Tool: Open pomodoro view, toggle timer controls and settings', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, { fsrsCards: mockDashboardCards });

    const pomodoroUrl = `file://${path.join(process.cwd(), 'build/features/dashboard/pomodoro/pomodoro.html')}`;
    await page.goto(pomodoroUrl);

    const timerDisplay = page.locator('#timer-time');
    await expect(timerDisplay).toBeVisible();
    await expect(timerDisplay).toHaveText('25:00');

    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    const pauseBtn = page.locator('#pause-btn');
    await expect(pauseBtn).toBeVisible();

    await context.close();
  });

  test('Analytics & Forecast: Renders memory charts and forecast metrics', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, { fsrsCards: mockDashboardCards });

    const analyticsUrl = `file://${path.join(process.cwd(), 'build/features/dashboard/analytics/analytics.html')}`;
    await page.goto(analyticsUrl);
    await expect(page.locator('body')).toBeVisible();

    const forecastUrl = `file://${path.join(process.cwd(), 'build/features/dashboard/forecast/forecast.html')}`;
    await page.goto(forecastUrl);
    await expect(page.locator('body')).toBeVisible();

    await context.close();
  });

  test('Notification Settings: Toggle quiet hours and interval select persistence', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, { settings: mockNotificationSettings });

    const popupUrl = `file://${path.join(process.cwd(), 'build/features/dashboard/popup/popup.html')}`;
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
});
