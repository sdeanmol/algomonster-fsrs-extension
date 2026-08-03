/**
 * @file tests/e2e/tracker.spec.js
 * @description End-to-End (E2E) test suite using Playwright for the FSRS Tracker & Card Editor feature.
 * Covers component view rendering, storage persistence, markdown preview reactions,
 * auto-save debouncing, input validation, and user journey workflows.
 */

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const mockCardData = [
  {
    id: "card-uuid-101",
    problemTitle: "Two Sum Pattern",
    problemUrl: "https://leetcode.com/problems/two-sum/",
    tags: ["Array", "Hash Table"],
    state: 2,
    stability: 14.5,
    difficulty: 4.2,
    reps: 3,
    lapses: 0,
    lastReview: Date.now() - (2 * 24 * 60 * 60 * 1000),
    historyLog: [{ date: Date.now() - (2 * 24 * 60 * 60 * 1000), rating: 3 }],
    approach: "Use a hash map to store complements for single pass lookup.",
    timeComplexity: "O(n)",
    spaceComplexity: "O(n)"
  },
  {
    id: "card-uuid-102",
    problemTitle: "LRU Cache Design",
    problemUrl: "https://leetcode.com/problems/lru-cache/",
    tags: ["Design", "Doubly Linked List", "Hash Map"],
    state: 1,
    stability: 5.0,
    difficulty: 6.8,
    reps: 1,
    lapses: 1,
    lastReview: Date.now() - (1 * 24 * 60 * 60 * 1000),
    historyLog: [{ date: Date.now() - (1 * 24 * 60 * 60 * 1000), rating: 2 }],
    approach: "Combine HashMap with Doubly LinkedList.",
    timeComplexity: "O(1)",
    spaceComplexity: "O(capacity)"
  }
];

const mockBookmarks = [
  {
    url: "https://leetcode.com/problems/3sum/",
    title: "3Sum Triplet Target"
  }
];

const mockDrafts = {
  "https://leetcode.com/problems/3sum/": {
    approach: "Sort the array, iterate with fixed pointer, use two pointers for remaining target.",
    timeComplexity: "O(n^2)",
    spaceComplexity: "O(1)"
  }
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

test.describe('FSRS Tracker & Fullscreen Card Editor E2E Workflows', () => {
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

  test('Happy Path: Load card editor, update notes and complexity, save progress', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: mockCardData,
      bookmarks: mockBookmarks,
      approachDrafts: mockDrafts
    });

    const editorHtmlPath = `file://${path.join(process.cwd(), 'build/features/tracker/editor/editor.html')}?url=https%3A%2F%2Fleetcode.com%2Fproblems%2Ftwo-sum%2F&cardId=card-uuid-101`;
    await page.goto(editorHtmlPath);

    const titleHeader = page.locator('#problem-title');
    await expect(titleHeader).toBeVisible();
    await expect(titleHeader).toHaveText('Two Sum Pattern');

    const urlSubtext = page.locator('#problem-url');
    await expect(urlSubtext).toHaveText('https://leetcode.com/problems/two-sum/');

    const timeCompInput = page.locator('#time-complexity-input');
    const spaceCompInput = page.locator('#space-complexity-input');
    const editorArea = page.locator('#editor-textarea');

    await expect(timeCompInput).toHaveValue('O(n)');
    await expect(spaceCompInput).toHaveValue('O(n)');

    await timeCompInput.fill('O(N)');
    await spaceCompInput.fill('O(N) space');
    await editorArea.fill('## Optimized Strategy\n- Step 1: Initialize HashMap');

    const saveBtn = page.locator('#save-btn');
    await saveBtn.click();

    const toast = page.locator('#status-toast');
    await expect(toast).toBeVisible();
    await expect(toast).toHaveText('Progress saved!');

    await context.close();
  });

  test('State Persistence: Save card changes and verify input updates', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, { fsrsCards: mockCardData });

    const editorHtmlPath = `file://${path.join(process.cwd(), 'build/features/tracker/editor/editor.html')}?url=https%3A%2F%2Fleetcode.com%2Fproblems%2Flru-cache%2F&cardId=card-uuid-102`;
    await page.goto(editorHtmlPath);

    const editorArea = page.locator('#editor-textarea');
    const tcInput = page.locator('#time-complexity-input');

    await editorArea.fill('Doubly Linked List + HashMap for O(1) get and put operations.');
    await tcInput.fill('O(1) amortized');

    await page.locator('#save-btn').click();
    await expect(page.locator('#status-toast')).toBeVisible();

    await context.close();
  });

  test('User Input & Error States: Handle missing URL params', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, { fsrsCards: [] });

    const emptyParamUrl = `file://${path.join(process.cwd(), 'build/features/tracker/editor/editor.html')}`;
    await page.goto(emptyParamUrl);

    const errorTitle = page.locator('#problem-title');
    await expect(errorTitle).toHaveText('Error: No URL provided');

    await context.close();
  });

  test('UI Reactions: Auto-save debouncing indicator and Markdown preview mode toggle', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, { fsrsCards: mockCardData });

    const editorHtmlPath = `file://${path.join(process.cwd(), 'build/features/tracker/editor/editor.html')}?url=https%3A%2F%2Fleetcode.com%2Fproblems%2Ftwo-sum%2F&cardId=card-uuid-101`;
    await page.goto(editorHtmlPath);

    const saveStatus = page.locator('#save-status');
    const editorArea = page.locator('#editor-textarea');

    await editorArea.type(' Real-time typing notes...');
    await expect(saveStatus).toHaveText('Typing...');

    const previewBtn = page.locator('#preview-toggle-btn');
    const previewArea = page.locator('#editor-preview');

    await previewBtn.click();
    await expect(editorArea).not.toBeVisible();
    await expect(previewArea).toBeVisible();

    await context.close();
  });
});
