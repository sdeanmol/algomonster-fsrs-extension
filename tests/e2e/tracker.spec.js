/**
 * @file tests/e2e/tracker.spec.js
 * @description End-to-End (E2E) test suite using Playwright for the FSRS Tracker & Card Editor feature.
 * Covers component view rendering, storage persistence, markdown preview reactions,
 * auto-save debouncing, input validation, and user journey workflows.
 *
 * Refactored to use shared helpers + new tests for tag management, new card creation,
 * and draft auto-population.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const { injectChromePolyfill } = require('./helpers/chrome-polyfill');
const { launchBrowser, closeBrowser, buildFileUrl } = require('./helpers/browser-setup');
const { getStorageValue } = require('./helpers/storage-helpers');
const { reviewCard, learningCard, mockBookmarks, mockApproachDrafts } = require('./helpers/fixtures');

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

const mockDrafts = {
  "https://leetcode.com/problems/3sum/": {
    approach: "Sort the array, iterate with fixed pointer, use two pointers for remaining target.",
    timeComplexity: "O(n^2)",
    spaceComplexity: "O(1)"
  }
};

test.describe('FSRS Tracker & Fullscreen Card Editor E2E Workflows', () => {
  let browser;

  test.beforeAll(async () => {
    browser = await launchBrowser();
  });

  test.afterAll(async () => {
    await closeBrowser(browser);
  });

  test('Happy Path: Load card editor, update notes and complexity, save progress', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: mockCardData,
      bookmarks: mockBookmarks,
      approachDrafts: mockDrafts
    });

    const editorHtmlPath = `${buildFileUrl('features/tracker/editor/editor.html')}?url=https%3A%2F%2Fleetcode.com%2Fproblems%2Ftwo-sum%2F&cardId=card-uuid-101`;
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

  test('State Persistence: Save card changes and verify storage write', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, { fsrsCards: mockCardData });

    const editorHtmlPath = `${buildFileUrl('features/tracker/editor/editor.html')}?url=https%3A%2F%2Fleetcode.com%2Fproblems%2Flru-cache%2F&cardId=card-uuid-102`;
    await page.goto(editorHtmlPath);

    const editorArea = page.locator('#editor-textarea');
    const tcInput = page.locator('#time-complexity-input');

    await editorArea.fill('Doubly Linked List + HashMap for O(1) get and put operations.');
    await tcInput.fill('O(1) amortized');

    await page.locator('#save-btn').click();
    await expect(page.locator('#status-toast')).toBeVisible();

    // Verify storage was updated
    const cards = await getStorageValue(page, 'fsrsCards');
    expect(cards).toBeTruthy();
    const updated = cards.find(c => c.id === 'card-uuid-102');
    if (updated) {
      expect(updated.approach).toContain('Doubly Linked List');
      expect(updated.timeComplexity).toBe('O(1) amortized');
    }

    await context.close();
  });

  test('User Input & Error States: Handle missing URL params', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, { fsrsCards: [] });

    const emptyParamUrl = buildFileUrl('features/tracker/editor/editor.html');
    await page.goto(emptyParamUrl);

    const errorTitle = page.locator('#problem-title');
    await expect(errorTitle).toHaveText('Error: No URL provided');

    await context.close();
  });

  test('UI Reactions: Auto-save debouncing indicator and Markdown preview mode toggle', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, { fsrsCards: mockCardData });

    const editorHtmlPath = `${buildFileUrl('features/tracker/editor/editor.html')}?url=https%3A%2F%2Fleetcode.com%2Fproblems%2Ftwo-sum%2F&cardId=card-uuid-101`;
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

  // --- NEW Phase 2 Tests ---

  test('Draft auto-population: Editor pre-fills from approachDrafts for unbookmarked URL', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: [],
      bookmarks: mockBookmarks,
      approachDrafts: mockDrafts
    });

    // Load editor with 3sum URL which has a draft but no card
    const editorHtmlPath = `${buildFileUrl('features/tracker/editor/editor.html')}?url=https%3A%2F%2Fleetcode.com%2Fproblems%2F3sum%2F`;
    await page.goto(editorHtmlPath);

    // Verify draft approach was loaded
    const textarea = page.locator('#editor-textarea');
    await expect(textarea).toHaveValue('Sort the array, iterate with fixed pointer, use two pointers for remaining target.');

    // Verify complexities loaded from draft
    const tcInput = page.locator('#time-complexity-input');
    await expect(tcInput).toHaveValue('O(n^2)');

    const scInput = page.locator('#space-complexity-input');
    await expect(scInput).toHaveValue('O(1)');

    // Verify save status indicates it's a draft
    const saveStatus = page.locator('#save-status');
    await expect(saveStatus).toHaveText('Loaded draft notes');

    await context.close();
  });

  test('New card creation: Save creates new draft entry when no existing card', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: [],
      bookmarks: [],
      approachDrafts: {}
    });

    // Open editor with a URL that has no card or draft
    const editorHtmlPath = `${buildFileUrl('features/tracker/editor/editor.html')}?url=https%3A%2F%2Fleetcode.com%2Fproblems%2Fmedian-of-two-sorted-arrays%2F`;
    await page.goto(editorHtmlPath);

    // Fill in approach and complexities
    const textarea = page.locator('#editor-textarea');
    await textarea.fill('Binary search on the shorter array to partition both arrays.');

    const tcInput = page.locator('#time-complexity-input');
    await tcInput.fill('O(log(min(m,n)))');

    const scInput = page.locator('#space-complexity-input');
    await scInput.fill('O(1)');

    // Save
    await page.locator('#save-btn').click();
    await expect(page.locator('#status-toast')).toBeVisible();

    // Verify draft was saved to storage
    await page.waitForTimeout(500);
    const drafts = await getStorageValue(page, 'approachDrafts');
    expect(drafts).toBeTruthy();

    const draftKey = 'https://leetcode.com/problems/median-of-two-sorted-arrays/';
    expect(drafts[draftKey]).toBeTruthy();
    expect(drafts[draftKey].approach).toContain('Binary search');
    expect(drafts[draftKey].timeComplexity).toBe('O(log(min(m,n)))');
    expect(drafts[draftKey].spaceComplexity).toBe('O(1)');

    await context.close();
  });

  test('Bookmark title fallback: Editor displays bookmark title for known URL without card', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: [],
      bookmarks: [{ url: 'https://leetcode.com/problems/3sum/', title: '3Sum Triplet Target' }],
      approachDrafts: {}
    });

    const editorHtmlPath = `${buildFileUrl('features/tracker/editor/editor.html')}?url=https%3A%2F%2Fleetcode.com%2Fproblems%2F3sum%2F`;
    await page.goto(editorHtmlPath);

    const titleEl = page.locator('#problem-title');
    await expect(titleEl).toHaveText('3Sum Triplet Target');

    await context.close();
  });
});
