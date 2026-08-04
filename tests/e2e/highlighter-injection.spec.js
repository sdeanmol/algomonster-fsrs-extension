/**
 * @file tests/e2e/highlighter-injection.spec.js
 * @description End-to-End (E2E) test suite for in-page text highlighting interactions.
 * Tests text selection → tooltip display, highlight colour application, storage
 * persistence, and highlight restoration on page reload.
 *
 * Uses a lightweight Highlighter shim to isolate DOM highlight behaviour from
 * the full content script Webpack bundle.
 */

const { test, expect } = require('@playwright/test');
const { injectChromePolyfill } = require('./helpers/chrome-polyfill');
const { launchBrowser, closeBrowser } = require('./helpers/browser-setup');
const { getStorageValue } = require('./helpers/storage-helpers');
const { mockMarks, mockChromeSettings } = require('./helpers/fixtures');

/**
 * Injects a lightweight Highlighter tooltip + persistence shim into the test page.
 */
function injectHighlighterShim() {
  // Create tooltip container (mirrors highlighter.ts createHighlighterUI)
  const tooltip = document.createElement('div');
  tooltip.id = 'algo-highlight-tooltip';
  tooltip.setAttribute('role', 'dialog');
  tooltip.setAttribute('aria-label', 'Highlighter Options');
  tooltip.style.cssText = 'display:none;position:absolute;z-index:99999;padding:8px;background:#2a2a3e;border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.4);';

  // Color swatches
  const colors = ['#ffeb3b', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'];
  colors.forEach(color => {
    const swatch = document.createElement('button');
    swatch.className = 'highlight-color-swatch';
    swatch.setAttribute('data-color', color);
    swatch.style.cssText = `width:24px;height:24px;border-radius:50%;border:2px solid transparent;background:${color};cursor:pointer;margin:0 2px;`;
    swatch.addEventListener('click', () => {
      applyHighlight(color);
    });
    tooltip.appendChild(swatch);
  });

  // Link to Card button
  const linkBtn = document.createElement('button');
  linkBtn.id = 'highlight-link-card';
  linkBtn.textContent = '🔗 Link';
  linkBtn.style.cssText = 'padding:4px 8px;background:transparent;border:1px solid #4CAF50;color:#4CAF50;border-radius:4px;cursor:pointer;font-size:11px;margin-left:6px;';
  tooltip.appendChild(linkBtn);

  document.body.appendChild(tooltip);

  // Track selection for highlight
  let lastSelection = null;
  document.addEventListener('pointerup', (e) => {
    if (e.target && typeof e.target.closest === 'function' && e.target.closest('#algo-highlight-tooltip')) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      tooltip.style.display = 'none';
      lastSelection = null;
      return;
    }

    lastSelection = {
      text: selection.toString().trim(),
      range: selection.getRangeAt(0).cloneRange()
    };

    const rect = selection.getRangeAt(0).getBoundingClientRect();
    tooltip.style.display = 'flex';
    tooltip.style.alignItems = 'center';
    tooltip.style.left = `${rect.right + window.scrollX + 4}px`;
    tooltip.style.top = `${rect.bottom + window.scrollY + 4}px`;
  });

  function applyHighlight(color) {
    if (!lastSelection) return;

    // Wrap selected text in a mark element
    const range = lastSelection.range;
    const mark = document.createElement('mark');
    mark.className = 'algo-highlight-mark';
    mark.style.backgroundColor = color;
    mark.setAttribute('data-mark-id', 'hl-' + Date.now());

    try {
      range.surroundContents(mark);
    } catch {
      // If surroundContents fails (multi-element selection), just apply inline
      const wrapper = document.createElement('span');
      wrapper.className = 'algo-highlight-mark';
      wrapper.style.backgroundColor = color;
      wrapper.textContent = lastSelection.text;
      range.deleteContents();
      range.insertNode(wrapper);
    }

    // Clear selection
    window.getSelection().removeAllRanges();
    tooltip.style.display = 'none';

    // Persist to storage
    const newMark = {
      id: mark.getAttribute('data-mark-id'),
      url: window.location.href,
      text: lastSelection.text,
      color: color,
      type: 'highlight',
      createdAt: Date.now(),
      note: '',
      highlightSource: {
        startMeta: { parentTagName: 'p', parentIndex: 0, textOffset: 0, parentDomPath: [] },
        endMeta: { parentTagName: 'p', parentIndex: 0, textOffset: lastSelection.text.length, parentDomPath: [] }
      }
    };

    chrome.storage.local.get(['marks'], (result) => {
      const marks = result.marks || [];
      marks.push(newMark);
      chrome.storage.local.set({ marks: marks });
    });

    lastSelection = null;
  }

  // Link to Card handler
  linkBtn.addEventListener('click', () => {
    if (!lastSelection) return;
    const text = lastSelection.text;

    chrome.storage.local.get(['fsrsCards'], (result) => {
      const cards = result.fsrsCards || [];
      if (cards.length > 0) {
        const card = cards[0];
        card.approach = (card.approach || '') + '\n\n> ' + text;
        chrome.storage.local.set({ fsrsCards: cards });
      }
    });

    tooltip.style.display = 'none';
    lastSelection = null;
  });
}

/**
 * Restores highlights from marks data by wrapping matching text nodes.
 * Simplified version of the production restoreRangeFromMeta flow.
 */
function injectHighlightRestorer(marksData) {
  marksData.forEach(mark => {
    // Simple text search restoration
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      const idx = node.textContent.indexOf(mark.text);
      if (idx !== -1) {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + mark.text.length);
        const wrapper = document.createElement('mark');
        wrapper.className = 'algo-highlight-mark';
        wrapper.style.backgroundColor = mark.color;
        wrapper.setAttribute('data-mark-id', mark.id);
        try {
          range.surroundContents(wrapper);
        } catch { /* multi-element span, skip */ }
        break;
      }
    }
  });
}

test.describe('Highlighter In-Page DOM Injection E2E', () => {
  let browser;

  const testPageHtml = `<!DOCTYPE html><html><head><style>body{font-family:sans-serif;padding:20px;background:#1a1a2e;color:#eee;line-height:1.8;} p{margin:16px 0;} mark{border-radius:2px;}</style></head><body>
    <h1>Algorithm Notes</h1>
    <p id="para-1">Hash Map single-pass lookup guarantees O(n) runtime complexity for array problems.</p>
    <p id="para-2">Always check boundary condition left <= right in binary search implementations.</p>
    <p id="para-3">Monotonic stack maintains elements in strictly increasing or decreasing order.</p>
  </body></html>`;

  test.beforeAll(async () => {
    browser = await launchBrowser();
  });

  test.afterAll(async () => {
    await closeBrowser(browser);
  });

  test('Text selection triggers floating tooltip with colour swatches', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(testPageHtml);
    await page.evaluate(injectChromePolyfill, { marks: [], chromeSettings: mockChromeSettings });
    await page.evaluate(injectHighlighterShim);

    // Simulate text selection on paragraph 1
    const para = page.locator('#para-1');
    await para.click({ position: { x: 0, y: 10 } });

    // Use JavaScript to programmatically select text (more reliable than mouse drag)
    await page.evaluate(() => {
      const textNode = document.querySelector('#para-1').firstChild;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 8); // "Hash Map"
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      // Dispatch pointerup to trigger tooltip on the element, not document
      document.querySelector('#para-1').dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        clientX: 100,
        clientY: 50
      }));
    });

    // Verify tooltip appeared
    const tooltip = page.locator('#algo-highlight-tooltip');
    await expect(tooltip).toBeVisible();

    // Verify colour swatches are present
    const swatches = page.locator('.highlight-color-swatch');
    expect(await swatches.count()).toBe(5);

    // Verify Link to Card button exists
    const linkBtn = page.locator('#highlight-link-card');
    await expect(linkBtn).toBeAttached();

    await context.close();
  });

  test('Apply highlight and verify mark wraps text and persists to storage', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(testPageHtml);
    await page.evaluate(injectChromePolyfill, { marks: [] });
    await page.evaluate(injectHighlighterShim);

    // Programmatically select "boundary condition" in para-2
    await page.evaluate(() => {
      const textNode = document.querySelector('#para-2').firstChild;
      const text = textNode.textContent;
      const start = text.indexOf('boundary condition');
      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, start + 'boundary condition'.length);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      document.querySelector('#para-2').dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        clientX: 200,
        clientY: 100
      }));
    });

    // Click the green colour swatch (#2ecc71)
    const greenSwatch = page.locator('.highlight-color-swatch[data-color="#2ecc71"]');
    await greenSwatch.click();

    // Verify tooltip hidden after applying
    const tooltip = page.locator('#algo-highlight-tooltip');
    expect(await tooltip.evaluate(el => el.style.display)).toBe('none');

    // Verify a mark element was created in the DOM
    const highlightMark = page.locator('.algo-highlight-mark');
    expect(await highlightMark.count()).toBeGreaterThanOrEqual(1);

    // Verify it has the right colour
    const bgColor = await highlightMark.first().evaluate(el => el.style.backgroundColor);
    expect(bgColor).toContain('46, 204, 113'); // rgb(46, 204, 113) = #2ecc71

    // Verify mark was persisted to storage
    await page.waitForTimeout(300);
    const marks = await getStorageValue(page, 'marks');
    expect(marks).toBeTruthy();
    expect(marks.length).toBe(1);
    expect(marks[0].text).toBe('boundary condition');
    expect(marks[0].color).toBe('#2ecc71');

    await context.close();
  });

  test('Highlight-to-card linking appends selected text as blockquote to card approach', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const card = {
      id: 'card-link-test',
      problemTitle: 'Binary Search',
      problemUrl: 'https://leetcode.com/problems/binary-search/',
      tags: ['Binary Search'],
      state: 2,
      stability: 10,
      difficulty: 3,
      reps: 2,
      lapses: 0,
      lastReview: Date.now(),
      due: Date.now() + 86400000,
      historyLog: [],
      approach: 'Standard binary search template.'
    };

    await page.setContent(testPageHtml);
    await page.evaluate(injectChromePolyfill, {
      fsrsCards: [card],
      marks: []
    });
    await page.evaluate(injectHighlighterShim);

    // Select text and trigger tooltip
    await page.evaluate(() => {
      const textNode = document.querySelector('#para-3').firstChild;
      const text = textNode.textContent;
      const start = text.indexOf('Monotonic stack');
      const range = document.createRange();
      range.setStart(textNode, start);
      range.setEnd(textNode, start + 'Monotonic stack'.length);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);

      document.querySelector('#para-3').dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        clientX: 300,
        clientY: 150
      }));
    });

    // Click "Link to Card" button
    const linkBtn = page.locator('#highlight-link-card');
    await linkBtn.click();

    // Verify the card's approach was updated in storage
    await page.waitForTimeout(300);
    const cards = await getStorageValue(page, 'fsrsCards');
    expect(cards).toBeTruthy();
    expect(cards[0].approach).toContain('> Monotonic stack');
    expect(cards[0].approach).toContain('Standard binary search template.');

    await context.close();
  });

  test('Restore highlights on page load from pre-seeded marks', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const seededMarks = [
      {
        id: 'hl-restore-1',
        url: 'about:blank',
        text: 'Hash Map',
        color: '#ffeb3b',
        type: 'highlight',
        createdAt: Date.now() - 5000,
        note: ''
      },
      {
        id: 'hl-restore-2',
        url: 'about:blank',
        text: 'Monotonic stack',
        color: '#e74c3c',
        type: 'highlight',
        createdAt: Date.now() - 3000,
        note: ''
      }
    ];

    await page.setContent(testPageHtml);
    await page.evaluate(injectChromePolyfill, { marks: seededMarks });

    // Run the highlight restorer with the seeded marks
    await page.evaluate(injectHighlightRestorer, seededMarks);

    // Verify highlights are restored in the DOM
    const highlights = page.locator('.algo-highlight-mark');
    expect(await highlights.count()).toBe(2);

    // Verify first highlight has correct text and colour
    const first = highlights.nth(0);
    await expect(first).toHaveText('Hash Map');
    const firstBg = await first.evaluate(el => el.style.backgroundColor);
    expect(firstBg).toContain('255, 235, 59'); // #ffeb3b

    // Verify second highlight
    const second = highlights.nth(1);
    await expect(second).toHaveText('Monotonic stack');
    const secondBg = await second.evaluate(el => el.style.backgroundColor);
    expect(secondBg).toContain('231, 76, 60'); // #e74c3c

    await context.close();
  });
});
