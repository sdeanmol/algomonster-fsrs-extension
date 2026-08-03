/**
 * @file tests/e2e/study-plan.spec.js
 * @description End-to-End (E2E) test suite using Playwright for Exam Countdown Mode & Study Planner features.
 * Covers setting target exam date, configuring daily review limits, live calculation previews,
 * activating exam countdown mode, rendering daily review schedule, and deactivating mode back to default.
 */

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const mockStudyPlanCards = [
  {
    id: "sp-card-1",
    problemTitle: "LRU Cache",
    problemUrl: "https://leetcode.com/problems/lru-cache/",
    tags: ["Hash Table", "Doubly Linked List", "Design"],
    state: 2,
    stability: 4.2,
    difficulty: 6.5,
    reps: 3,
    lapses: 0,
    lastReview: Date.now() - (3 * 24 * 60 * 60 * 1000),
    due: Date.now() - (1 * 24 * 60 * 60 * 1000), // Overdue card
    historyLog: [{ date: Date.now() - (3 * 24 * 60 * 60 * 1000), rating: 3 }],
    approach: "Hash map storing keys and nodes in doubly linked list."
  },
  {
    id: "sp-card-2",
    problemTitle: "Word Search II",
    problemUrl: "https://leetcode.com/problems/word-search-ii/",
    tags: ["Trie", "Backtracking", "Matrix"],
    state: 2,
    stability: 15.0,
    difficulty: 7.8,
    reps: 5,
    lapses: 1,
    lastReview: Date.now() - (5 * 24 * 60 * 60 * 1000),
    due: Date.now() + (2 * 24 * 60 * 60 * 1000),
    historyLog: [{ date: Date.now() - (5 * 24 * 60 * 60 * 1000), rating: 4 }],
    approach: "Prefix Trie combined with grid DFS backtracking."
  }
];

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

function getLocalDateString(daysOffset) {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

test.describe('Exam Countdown Mode & Study Planner E2E Workflows', () => {
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

  test('Setup Panel: Render form controls, select exam date, and verify live preview metrics', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, { fsrsCards: mockStudyPlanCards });

    const studyplanUrl = `file://${path.join(process.cwd(), 'build/features/dashboard/studyplan/studyplan.html')}`;
    await page.goto(studyplanUrl);

    // Verify setup panel is visible initially when no active exam mode
    const setupPanel = page.locator('#setup-panel');
    await expect(setupPanel).toBeVisible();

    const examDateInput = page.locator('#exam-date-input');
    const dailyLimitInput = page.locator('#daily-limit-input');
    const activateBtn = page.locator('#activate-btn');

    await expect(examDateInput).toBeVisible();
    await expect(dailyLimitInput).toBeVisible();
    await expect(activateBtn).toBeDisabled();

    // Await controller initialization by checking min attribute populated by bindEvents()
    await expect(examDateInput).toHaveAttribute('min', /.+/, { timeout: 10000 });

    // Set exam date 10 days in the future
    const dateString = getLocalDateString(10);
    await examDateInput.fill(dateString);
    await examDateInput.dispatchEvent('input');
    await examDateInput.dispatchEvent('change');

    // Verify activate button is enabled and setup preview stats are calculated
    await expect(activateBtn).toBeEnabled();
    const setupPreview = page.locator('#setup-preview');
    await expect(setupPreview).toBeVisible();

    const previewDays = page.locator('#preview-days');
    await expect(previewDays).not.toHaveText('-');

    await context.close();
  });

  test('Exam Mode Lifecycle: Activate countdown mode, view daily schedule table, and deactivate', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, { fsrsCards: mockStudyPlanCards });

    const studyplanUrl = `file://${path.join(process.cwd(), 'build/features/dashboard/studyplan/studyplan.html')}`;
    await page.goto(studyplanUrl);

    const examDateInput = page.locator('#exam-date-input');
    const activateBtn = page.locator('#activate-btn');

    await expect(examDateInput).toHaveAttribute('min', /.+/, { timeout: 10000 });

    const dateString = getLocalDateString(14);
    await examDateInput.fill(dateString);
    await examDateInput.dispatchEvent('input');
    await examDateInput.dispatchEvent('change');

    await expect(activateBtn).toBeEnabled();
    await activateBtn.click();

    // Verify transition to Active Exam Panel
    const activePanel = page.locator('#active-panel');
    await expect(activePanel).toBeVisible();
    const setupPanel = page.locator('#setup-panel');
    await expect(setupPanel).toBeHidden();

    // Verify countdown days display and schedule table rendering
    const countdownDays = page.locator('#countdown-days');
    await expect(countdownDays).toBeVisible();

    const scheduleTable = page.locator('#schedule-table');
    await expect(scheduleTable).toBeVisible();

    // Deactivate exam mode — accept the confirmation dialog
    const deactivateBtn = page.locator('#deactivate-btn');
    await expect(deactivateBtn).toBeVisible();
    page.on('dialog', dialog => dialog.accept());
    await deactivateBtn.click();

    // Verify return to setup panel
    await expect(setupPanel).toBeVisible();
    await expect(activePanel).toBeHidden();

    await context.close();
  });
});
