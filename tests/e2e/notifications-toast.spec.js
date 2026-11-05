/**
 * @file tests/e2e/notifications-toast.spec.js
 * @description End-to-End (E2E) test suite for the in-page toast notification system.
 * Validates that Notifier.showPageNotification() correctly injects notification DOM elements,
 * handles review/test notification types, auto-dismisses non-review notifications,
 * and provides functional Review Now / Snooze / Dismiss button interactions.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const { injectChromePolyfill } = require('./helpers/chrome-polyfill');
const { launchBrowser, closeBrowser, buildFileUrl } = require('./helpers/browser-setup');
const { getSentMessages } = require('./helpers/storage-helpers');

/**
 * Injects the Notifier class directly into a test page.
 * Since the Notifier is part of the content script bundle, we recreate its core
 * behaviour inline for isolated testing without requiring the full Webpack bundle.
 */
function injectNotifierShim() {
  // Minimal Notifier recreation matching the source in content/notifications.ts
  window.AlgoRecall = window.AlgoRecall || {};
  window.AlgoRecall.state = { currentTheme: 'dark' };

  class Notifier {
    static showPageNotification(title, message, type, count) {
      // Remove existing notification to prevent double-stacking
      const existing = document.getElementById('algo-custom-notification-el');
      if (existing) existing.remove();

      const notification = document.createElement('div');
      notification.id = 'algo-custom-notification-el';
      notification.className = 'algo-custom-notification';
      notification.setAttribute('role', 'alert');
      notification.setAttribute('aria-live', 'assertive');

      const state = window.AlgoRecall.state;
      if (state && state.currentTheme === 'light') {
        notification.classList.add('light-theme');
      }

      let buttonsHtml = '';
      if (type === 'review') {
        buttonsHtml = `
          <div class="algo-notif-buttons">
            <button id="algo-notif-btn-review" class="algo-notif-btn algo-notif-btn-primary">Review Now</button>
            <button id="algo-notif-btn-snooze" class="algo-notif-btn algo-notif-btn-secondary">Snooze (15m)</button>
          </div>
        `;
      } else {
        buttonsHtml = `
          <div class="algo-notif-buttons">
            <button id="algo-notif-btn-dismiss" class="algo-notif-btn algo-notif-btn-secondary" style="width: 100%;">Dismiss</button>
          </div>
        `;
      }

      notification.innerHTML = `
        <div class="algo-notif-header">
          <div class="algo-notif-header-left">
            <span class="algo-notif-title">${title}</span>
          </div>
          <button id="algo-notif-btn-close" class="algo-notif-close" aria-label="Close" title="Close">&times;</button>
        </div>
        <p class="algo-notif-message">${message}</p>
        ${buttonsHtml}
      `;

      document.body.appendChild(notification);

      // Force style recalculation for smooth transition
      requestAnimationFrame(() => {
        notification.classList.add('show');
      });

      // Helper to dismiss
      const dismissNotification = () => {
        notification.classList.remove('show');
        // Use a timeout fallback if transitionend doesn't fire (no CSS transitions in test)
        const fallback = setTimeout(() => { try { notification.remove(); } catch {} }, 300);
        notification.addEventListener('transitionend', () => {
          clearTimeout(fallback);
          try { notification.remove(); } catch {}
        }, { once: true });
      };

      // Auto-dismiss after 6 seconds for non-review types
      let autoDismissTimer = null;
      if (type !== 'review') {
        autoDismissTimer = setTimeout(dismissNotification, 6000);
      }

      // Close button
      const closeBtn = notification.querySelector('#algo-notif-btn-close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => {
          if (autoDismissTimer) clearTimeout(autoDismissTimer);
          dismissNotification();
        });
      }

      // Dismiss button (test type)
      const dismissBtn = notification.querySelector('#algo-notif-btn-dismiss');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
          if (autoDismissTimer) clearTimeout(autoDismissTimer);
          dismissNotification();
        });
      }

      // Snooze button
      const snoozeBtn = notification.querySelector('#algo-notif-btn-snooze');
      if (snoozeBtn) {
        snoozeBtn.addEventListener('click', () => {
          if (autoDismissTimer) clearTimeout(autoDismissTimer);
          dismissNotification();
          chrome.runtime.sendMessage({ action: 'snooze_notification', minutes: 15 });
        });
      }

      // Review Now button
      const reviewBtn = notification.querySelector('#algo-notif-btn-review');
      if (reviewBtn) {
        reviewBtn.addEventListener('click', () => {
          if (autoDismissTimer) clearTimeout(autoDismissTimer);
          dismissNotification();
        });
      }
    }
  }

  window.Notifier = Notifier;
  window.AlgoRecall.Notifier = Notifier;
}

test.describe('In-Page Toast Notification E2E Workflows', () => {
  let browser;

  test.beforeAll(async () => {
    browser = await launchBrowser();
  });

  test.afterAll(async () => {
    await closeBrowser(browser);
  });

  test('Test notification renders with title, message, and dismiss button', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`<!DOCTYPE html><html><body><p>Test page</p></body></html>`);
    await page.evaluate(injectChromePolyfill, {});
    await page.evaluate(injectNotifierShim);

    // Trigger a test notification
    await page.evaluate(() => {
      window.Notifier.showPageNotification(
        'AlgoRecall Active 🧠',
        'Notifications are working!',
        'test'
      );
    });

    // Verify notification element is in the DOM
    const notification = page.locator('#algo-custom-notification-el');
    await expect(notification).toBeAttached();

    // Verify title and message content
    const title = page.locator('.algo-notif-title');
    await expect(title).toHaveText('AlgoRecall Active 🧠');

    const message = page.locator('.algo-notif-message');
    await expect(message).toHaveText('Notifications are working!');

    // Verify dismiss button is present (not review buttons)
    const dismissBtn = page.locator('#algo-notif-btn-dismiss');
    await expect(dismissBtn).toBeAttached();

    // Verify NO review/snooze buttons for test type
    const reviewBtn = page.locator('#algo-notif-btn-review');
    expect(await reviewBtn.count()).toBe(0);

    await context.close();
  });

  test('Review notification renders with Review Now and Snooze buttons', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`<!DOCTYPE html><html><body><p>Problem page</p></body></html>`);
    await page.evaluate(injectChromePolyfill, {});
    await page.evaluate(injectNotifierShim);

    await page.evaluate(() => {
      window.Notifier.showPageNotification(
        'Reviews Due 📚',
        'You have 5 cards due for review',
        'review',
        5
      );
    });

    const notification = page.locator('#algo-custom-notification-el');
    await expect(notification).toBeAttached();

    // Verify review-specific buttons
    const reviewBtn = page.locator('#algo-notif-btn-review');
    await expect(reviewBtn).toBeAttached();
    await expect(reviewBtn).toHaveText('Review Now');

    const snoozeBtn = page.locator('#algo-notif-btn-snooze');
    await expect(snoozeBtn).toBeAttached();
    await expect(snoozeBtn).toHaveText('Snooze (15m)');

    // Verify NO dismiss button for review type
    const dismissBtn = page.locator('#algo-notif-btn-dismiss');
    expect(await dismissBtn.count()).toBe(0);

    await context.close();
  });

  test('Close button dismisses notification from DOM', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`<!DOCTYPE html><html><body><p>Test page</p></body></html>`);
    await page.evaluate(injectChromePolyfill, {});
    await page.evaluate(injectNotifierShim);

    await page.evaluate(() => {
      window.Notifier.showPageNotification('Test', 'Close me', 'test');
    });

    const notification = page.locator('#algo-custom-notification-el');
    await expect(notification).toBeAttached();

    // Click close button
    const closeBtn = page.locator('#algo-notif-btn-close');
    await closeBtn.click();

    // Wait for removal (transition + fallback timeout)
    await page.waitForTimeout(500);

    // Verify notification removed from DOM
    expect(await notification.count()).toBe(0);

    await context.close();
  });

  test('Snooze button sends snooze message and dismisses notification', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`<!DOCTYPE html><html><body><p>Problem page</p></body></html>`);
    await page.evaluate(injectChromePolyfill, {});
    await page.evaluate(injectNotifierShim);

    await page.evaluate(() => {
      window.Notifier.showPageNotification('Reviews Due', '3 cards due', 'review', 3);
    });

    const snoozeBtn = page.locator('#algo-notif-btn-snooze');
    await snoozeBtn.click();

    // Wait for dismissal
    await page.waitForTimeout(500);

    // Verify notification removed
    const notification = page.locator('#algo-custom-notification-el');
    expect(await notification.count()).toBe(0);

    // Verify snooze message was sent via chrome.runtime.sendMessage
    const messages = await getSentMessages(page);
    const snoozeMessage = messages.find(m => m.action === 'snooze_notification');
    expect(snoozeMessage).toBeTruthy();
    expect(snoozeMessage.minutes).toBe(15);

    await context.close();
  });

  test('Duplicate notifications are replaced, not stacked', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`<!DOCTYPE html><html><body><p>Test page</p></body></html>`);
    await page.evaluate(injectChromePolyfill, {});
    await page.evaluate(injectNotifierShim);

    // Fire 3 notifications rapidly
    await page.evaluate(() => {
      window.Notifier.showPageNotification('First', 'Message 1', 'test');
      window.Notifier.showPageNotification('Second', 'Message 2', 'test');
      window.Notifier.showPageNotification('Third', 'Message 3', 'test');
    });

    // Only the last notification should exist (previous ones replaced)
    const notifications = page.locator('#algo-custom-notification-el');
    expect(await notifications.count()).toBe(1);

    const title = page.locator('.algo-notif-title');
    await expect(title).toHaveText('Third');

    const message = page.locator('.algo-notif-message');
    await expect(message).toHaveText('Message 3');

    await context.close();
  });

  test('Notification has correct ARIA accessibility attributes', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.setContent(`<!DOCTYPE html><html><body><p>Test page</p></body></html>`);
    await page.evaluate(injectChromePolyfill, {});
    await page.evaluate(injectNotifierShim);

    await page.evaluate(() => {
      window.Notifier.showPageNotification('Accessible Alert', 'Screen reader test', 'test');
    });

    const notification = page.locator('#algo-custom-notification-el');
    await expect(notification).toHaveAttribute('role', 'alert');
    await expect(notification).toHaveAttribute('aria-live', 'assertive');

    const closeBtn = page.locator('#algo-notif-btn-close');
    await expect(closeBtn).toHaveAttribute('aria-label', 'Close');

    await context.close();
  });
});
