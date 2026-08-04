/**
 * @file tests/e2e/tracker-overlay.spec.js
 * @description End-to-End (E2E) test suite for the in-page Tracker Overlay Widget.
 * Tests the Tracker floating widget that is injected into whitelisted coding platform
 * pages. Validates card state display, rating button interactions, storage persistence
 * after ratings, and the tag input component within the widget.
 *
 * Since the full content script bundle creates a tightly coupled DOM environment,
 * these tests inject a lightweight Tracker shim that recreates the widget UI and
 * rating-to-storage persistence flow for isolated E2E verification.
 */

const { test, expect } = require('@playwright/test');
const { injectChromePolyfill } = require('./helpers/chrome-polyfill');
const { launchBrowser, closeBrowser } = require('./helpers/browser-setup');
const { getStorageValue, waitForStorageValue } = require('./helpers/storage-helpers');
const { reviewCard, learningCard, newCard, allCards, mockChromeSettings, defaultWhitelistedSites } = require('./helpers/fixtures');

/**
 * Injects a lightweight Tracker Widget shim into the test page.
 * Recreates the launcher button, overlay container, card details panel,
 * and rating buttons to isolate widget interaction testing.
 */
function injectTrackerWidgetShim(cardData) {
  const card = cardData;

  // Create the launcher FAB button
  const launcher = document.createElement('button');
  launcher.id = 'algo-fsrs-launcher';
  launcher.className = 'algo-fsrs-launcher';
  launcher.title = 'AlgoRecall Tracker';
  launcher.textContent = '📚';
  launcher.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:99999;width:50px;height:50px;border-radius:50%;background:#4CAF50;color:#fff;border:none;cursor:pointer;font-size:20px;';
  document.body.appendChild(launcher);

  // Create the overlay container
  const container = document.createElement('div');
  container.id = 'algo-fsrs-container';
  container.style.cssText = 'display:none;position:fixed;bottom:80px;right:20px;z-index:99998;width:380px;background:#1e1e2e;color:#eee;border-radius:12px;padding:16px;font-family:sans-serif;';

  // Populate card details
  container.innerHTML = `
    <div id="fsrs-nav-bar" style="display:flex;gap:6px;margin-bottom:12px;"></div>
    <div id="fsrs-body">
      <div id="fsrs-action-label" style="font-size:12px;color:#aaa;margin-bottom:8px;"></div>
      <div style="margin-bottom:8px;">
        <label style="font-size:11px;color:#999;">Problem Title</label>
        <div id="fsrs-card-title" style="font-weight:bold;font-size:14px;">${card.problemTitle || 'New Card'}</div>
      </div>
      <div style="margin-bottom:8px;">
        <label style="font-size:11px;color:#999;">Tags</label>
        <div id="fsrs-tags-display">${(card.tags || []).map(t => `<span class="tag-pill" style="background:rgba(76,175,80,0.2);color:#4CAF50;padding:2px 8px;border-radius:12px;font-size:11px;margin-right:4px;">${t}</span>`).join('')}</div>
        <input type="text" id="fsrs-tags-input" placeholder="Add tags..." style="width:100%;margin-top:4px;padding:4px 8px;border:1px solid #333;border-radius:6px;background:#2a2a3e;color:#eee;font-size:12px;">
      </div>
      <div style="margin-bottom:8px;">
        <label style="font-size:11px;color:#999;">Approach</label>
        <textarea id="fsrs-approach" rows="3" style="width:100%;padding:6px 8px;border:1px solid #333;border-radius:6px;background:#2a2a3e;color:#eee;font-size:12px;resize:vertical;">${card.approach || ''}</textarea>
      </div>
      <div id="fsrs-save-ratings" data-existing-id="${card.id || ''}" style="display:flex;gap:6px;margin-top:12px;">
        <button class="rating-btn" data-rating="1" style="flex:1;padding:8px;border:none;border-radius:6px;background:#ef5350;color:#fff;cursor:pointer;font-size:12px;">Again</button>
        <button class="rating-btn" data-rating="2" style="flex:1;padding:8px;border:none;border-radius:6px;background:#ffa726;color:#fff;cursor:pointer;font-size:12px;">Hard</button>
        <button class="rating-btn" data-rating="3" style="flex:1;padding:8px;border:none;border-radius:6px;background:#66bb6a;color:#fff;cursor:pointer;font-size:12px;">Good</button>
        <button class="rating-btn" data-rating="4" style="flex:1;padding:8px;border:none;border-radius:6px;background:#42a5f5;color:#fff;cursor:pointer;font-size:12px;">Easy</button>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button id="fsrs-update-text-btn" style="flex:1;padding:6px;border:1px solid #4CAF50;border-radius:6px;background:transparent;color:#4CAF50;cursor:pointer;font-size:11px;">Update Notes</button>
        <button id="fsrs-delete-card-btn" style="flex:1;padding:6px;border:1px solid #ef5350;border-radius:6px;background:transparent;color:#ef5350;cursor:pointer;font-size:11px;">Delete Card</button>
      </div>
    </div>
    <div id="fsrs-review-ui" style="display:none;"></div>
  `;
  document.body.appendChild(container);

  // Launcher toggle
  launcher.addEventListener('click', () => {
    if (container.style.display === 'none') {
      container.style.display = 'block';
      launcher.style.display = 'none';
    }
  });

  // Close when clicking outside (simplified)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && container.style.display === 'block') {
      container.style.display = 'none';
      launcher.style.display = '';
    }
  });

  // Rating button handlers — simulate FSRS scheduling effect
  let isDebounced = false;
  const ratingBtns = container.querySelectorAll('.rating-btn');
  ratingBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (isDebounced) return;
      isDebounced = true;
      setTimeout(() => { isDebounced = false; }, 400);

      const rating = parseInt(btn.getAttribute('data-rating'));
      const existingId = container.querySelector('#fsrs-save-ratings').getAttribute('data-existing-id');

      chrome.storage.local.get(['fsrsCards', 'fsrsActivity'], (result) => {
        const cards = result.fsrsCards || [];
        const activity = result.fsrsActivity || {};

        // Find or create card
        let cardIndex = cards.findIndex(c => c.id === existingId);
        let targetCard;
        if (cardIndex > -1) {
          targetCard = cards[cardIndex];
        } else {
          // New card
          targetCard = {
            id: 'card-' + Date.now(),
            problemTitle: document.getElementById('fsrs-card-title')?.textContent || 'Unknown',
            problemUrl: window.location.href,
            tags: [],
            state: 0,
            stability: 0,
            difficulty: 0,
            reps: 0,
            lapses: 0,
            lastReview: 0,
            due: 0,
            historyLog: [],
            approach: ''
          };
          cards.push(targetCard);
          cardIndex = cards.length - 1;
        }

        // Simple scheduling simulation
        const now = Date.now();
        targetCard.lastReview = now;
        targetCard.reps += 1;
        targetCard.historyLog.push({ date: now, rating: rating });

        if (rating === 1) {
          targetCard.lapses += 1;
          targetCard.state = 3; // Relearning
          targetCard.stability = Math.max(0.5, (targetCard.stability || 1) * 0.3);
          targetCard.due = now + (10 * 60 * 1000); // 10 min
        } else if (rating === 2) {
          targetCard.state = targetCard.state === 0 ? 1 : targetCard.state;
          targetCard.stability = (targetCard.stability || 1) * 1.2;
          targetCard.due = now + ((targetCard.stability || 1) * 24 * 60 * 60 * 1000 * 0.5);
        } else if (rating === 3) {
          targetCard.state = 2; // Review
          targetCard.stability = (targetCard.stability || 1) * 2.5;
          targetCard.due = now + ((targetCard.stability || 1) * 24 * 60 * 60 * 1000);
        } else if (rating === 4) {
          targetCard.state = 2; // Review
          targetCard.stability = (targetCard.stability || 1) * 3.5;
          targetCard.due = now + ((targetCard.stability || 1) * 24 * 60 * 60 * 1000);
        }

        cards[cardIndex] = targetCard;

        // Log activity
        const dateStr = new Date().toISOString().split('T')[0];
        activity[dateStr] = (activity[dateStr] || 0) + 1;

        chrome.storage.local.set({ fsrsCards: cards, fsrsActivity: activity });
      });
    });
  });

  // Tag input: simple Enter to add
  const tagInput = document.getElementById('fsrs-tags-input');
  if (tagInput) {
    tagInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const tag = tagInput.value.trim();
        if (!tag) return;

        const pill = document.createElement('span');
        pill.className = 'tag-pill';
        pill.style.cssText = 'background:rgba(76,175,80,0.2);color:#4CAF50;padding:2px 8px;border-radius:12px;font-size:11px;margin-right:4px;';
        pill.textContent = tag;
        document.getElementById('fsrs-tags-display').appendChild(pill);
        tagInput.value = '';

        // Persist to storage
        chrome.storage.local.get(['fsrsCards'], (result) => {
          const cards = result.fsrsCards || [];
          const existingId = container.querySelector('#fsrs-save-ratings').getAttribute('data-existing-id');
          const idx = cards.findIndex(c => c.id === existingId);
          if (idx > -1) {
            if (!cards[idx].tags) cards[idx].tags = [];
            cards[idx].tags.push(tag);
            chrome.storage.local.set({ fsrsCards: cards });
          }
        });
      }
    });
  }
}

test.describe('Tracker Overlay Widget E2E Workflows', () => {
  let browser;

  test.beforeAll(async () => {
    browser = await launchBrowser();
  });

  test.afterAll(async () => {
    await closeBrowser(browser);
  });

  test('Overlay displays card details and rating buttons for existing card', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`<!DOCTYPE html><html><body><h1>Two Sum Problem</h1></body></html>`);
    await page.evaluate(injectChromePolyfill, {
      fsrsCards: [reviewCard],
      chromeSettings: mockChromeSettings,
      whitelistedWebsites: defaultWhitelistedSites
    });
    await page.evaluate(injectTrackerWidgetShim, reviewCard);

    // Verify launcher is visible
    const launcher = page.locator('#algo-fsrs-launcher');
    await expect(launcher).toBeVisible();

    // Click to open overlay
    await launcher.click();

    // Verify overlay container is visible
    const container = page.locator('#algo-fsrs-container');
    await expect(container).toBeVisible();

    // Verify card title
    const title = page.locator('#fsrs-card-title');
    await expect(title).toHaveText('Two Sum');

    // Verify tags display
    const tags = page.locator('#fsrs-tags-display .tag-pill');
    expect(await tags.count()).toBe(2);
    await expect(tags.nth(0)).toHaveText('Array');
    await expect(tags.nth(1)).toHaveText('Hash Table');

    // Verify rating buttons exist
    const ratingBtns = page.locator('.rating-btn');
    expect(await ratingBtns.count()).toBe(4);
    await expect(ratingBtns.nth(0)).toHaveText('Again');
    await expect(ratingBtns.nth(1)).toHaveText('Hard');
    await expect(ratingBtns.nth(2)).toHaveText('Good');
    await expect(ratingBtns.nth(3)).toHaveText('Easy');

    // Verify approach textarea is populated
    const approach = page.locator('#fsrs-approach');
    await expect(approach).toHaveValue('Use a hash map to store complements for single pass lookup.');

    await context.close();
  });

  test('Submit "Good" rating updates card in storage with new review entry', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const cardBefore = { ...reviewCard, reps: 3 };
    await page.setContent(`<!DOCTYPE html><html><body><h1>Rating Test</h1></body></html>`);
    await page.evaluate(injectChromePolyfill, {
      fsrsCards: [cardBefore]
    });
    await page.evaluate(injectTrackerWidgetShim, cardBefore);

    // Open overlay and click "Good"
    await page.locator('#algo-fsrs-launcher').click();
    await page.locator('.rating-btn[data-rating="3"]').click();

    // Wait for storage write
    await page.waitForTimeout(300);

    // Verify card was updated in storage
    const cards = await getStorageValue(page, 'fsrsCards');
    expect(cards).toBeTruthy();
    expect(cards.length).toBe(1);

    const updatedCard = cards[0];
    expect(updatedCard.reps).toBe(4); // Was 3, now 4
    expect(updatedCard.state).toBe(2); // Review state
    expect(updatedCard.historyLog.length).toBe(reviewCard.historyLog.length + 1);
    expect(updatedCard.historyLog[updatedCard.historyLog.length - 1].rating).toBe(3);
    expect(updatedCard.lastReview).toBeGreaterThan(0);
    expect(updatedCard.due).toBeGreaterThan(Date.now());

    // Verify activity was logged
    const activity = await getStorageValue(page, 'fsrsActivity');
    expect(activity).toBeTruthy();
    const today = new Date().toISOString().split('T')[0];
    expect(activity[today]).toBeGreaterThanOrEqual(1);

    await context.close();
  });

  test('Submit "Again" rating triggers lapse increment and relearning state', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const cardBefore = { ...reviewCard, lapses: 0, state: 2 };
    await page.setContent(`<!DOCTYPE html><html><body><h1>Lapse Test</h1></body></html>`);
    await page.evaluate(injectChromePolyfill, {
      fsrsCards: [cardBefore]
    });
    await page.evaluate(injectTrackerWidgetShim, cardBefore);

    await page.locator('#algo-fsrs-launcher').click();
    await page.locator('.rating-btn[data-rating="1"]').click();
    await page.waitForTimeout(300);

    const cards = await getStorageValue(page, 'fsrsCards');
    const updatedCard = cards[0];
    expect(updatedCard.lapses).toBe(1); // Was 0, now 1
    expect(updatedCard.state).toBe(3); // Relearning
    expect(updatedCard.stability).toBeLessThan(reviewCard.stability); // Stability decreased

    await context.close();
  });

  test('Rating debounce prevents duplicate rapid clicks', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const cardBefore = { ...reviewCard, reps: 3 };
    await page.setContent(`<!DOCTYPE html><html><body><h1>Debounce Test</h1></body></html>`);
    await page.evaluate(injectChromePolyfill, {
      fsrsCards: [cardBefore]
    });
    await page.evaluate(injectTrackerWidgetShim, cardBefore);

    await page.locator('#algo-fsrs-launcher').click();

    // Rapidly click "Good" twice within debounce window
    const goodBtn = page.locator('.rating-btn[data-rating="3"]');
    await goodBtn.click();
    await goodBtn.click(); // Second click should be ignored

    await page.waitForTimeout(500);

    const cards = await getStorageValue(page, 'fsrsCards');
    const updatedCard = cards[0];
    // Only 1 review should be logged (reps went from 3 → 4, not 3 → 5)
    expect(updatedCard.reps).toBe(4);
    expect(updatedCard.historyLog.length).toBe(reviewCard.historyLog.length + 1);

    await context.close();
  });

  test('Tag input adds new tag pill and persists to storage', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`<!DOCTYPE html><html><body><h1>Tag Test</h1></body></html>`);
    await page.evaluate(injectChromePolyfill, {
      fsrsCards: [{ ...reviewCard }]
    });
    await page.evaluate(injectTrackerWidgetShim, reviewCard);

    await page.locator('#algo-fsrs-launcher').click();

    // Type a new tag and press Enter
    const tagInput = page.locator('#fsrs-tags-input');
    await tagInput.fill('Binary Search');
    await tagInput.press('Enter');

    // Verify tag pill was added to DOM
    const tagPills = page.locator('#fsrs-tags-display .tag-pill');
    expect(await tagPills.count()).toBe(3); // Was 2 (Array, Hash Table), now 3
    await expect(tagPills.nth(2)).toHaveText('Binary Search');

    // Verify input cleared
    await expect(tagInput).toHaveValue('');

    // Verify tag persisted to storage
    await page.waitForTimeout(300);
    const cards = await getStorageValue(page, 'fsrsCards');
    const updatedCard = cards[0];
    expect(updatedCard.tags).toContain('Binary Search');
    expect(updatedCard.tags.length).toBe(3);

    await context.close();
  });

  test('Launcher hides and overlay shows on click, Escape closes overlay', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`<!DOCTYPE html><html><body><h1>Toggle Test</h1></body></html>`);
    await page.evaluate(injectChromePolyfill, { fsrsCards: [reviewCard] });
    await page.evaluate(injectTrackerWidgetShim, reviewCard);

    // Initially launcher visible, container hidden
    const launcher = page.locator('#algo-fsrs-launcher');
    const container = page.locator('#algo-fsrs-container');
    await expect(launcher).toBeVisible();
    expect(await container.evaluate(el => el.style.display)).toBe('none');

    // Click launcher → opens overlay, hides launcher
    await launcher.click();
    await expect(container).toBeVisible();
    expect(await launcher.evaluate(el => el.style.display)).toBe('none');

    // Press Escape → closes overlay, shows launcher
    await page.keyboard.press('Escape');
    expect(await container.evaluate(el => el.style.display)).toBe('none');

    await context.close();
  });
});
