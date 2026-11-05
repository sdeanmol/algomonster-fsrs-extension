/**
 * @file tests/e2e/helpers/storage-helpers.js
 * @description Storage assertion and state extraction utilities for E2E tests.
 * Provides helpers to read back Chrome storage state, check sent messages,
 * and verify alarm registrations within Playwright page contexts.
 */

/**
 * Reads the current value of a key from the in-memory Chrome storage mock.
 * @param {import('@playwright/test').Page} page
 * @param {string} key - Storage key to read.
 * @returns {Promise<*>} The current value for the key (or undefined).
 */
async function getStorageValue(page, key) {
  return page.evaluate((k) => {
    return window.__e2eStore ? window.__e2eStore[k] : undefined;
  }, key);
}

/**
 * Reads the entire in-memory storage state.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Object>} Full storage snapshot.
 */
async function getFullStorage(page) {
  return page.evaluate(() => {
    return window.__e2eStore ? { ...window.__e2eStore } : {};
  });
}

/**
 * Gets the list of messages sent via chrome.runtime.sendMessage.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<Object>>} Array of sent message payloads.
 */
async function getSentMessages(page) {
  return page.evaluate(() => {
    return window.__e2eSentMessages || [];
  });
}

/**
 * Gets the registered alarms from the chrome.alarms mock.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Object>} Map of alarm name → alarm options.
 */
async function getRegisteredAlarms(page) {
  return page.evaluate(() => {
    return window.__e2eAlarms || {};
  });
}

/**
 * Gets the list of notifications created via chrome.notifications.create.
 * @param {import('@playwright/test').Page} page
 * @returns {Promise<Array<Object>>} Array of notification payloads.
 */
async function getCreatedNotifications(page) {
  return page.evaluate(() => {
    return window.__e2eNotifications || [];
  });
}

/**
 * Simulates an incoming chrome.runtime.onMessage event.
 * @param {import('@playwright/test').Page} page
 * @param {Object} message - The message payload to deliver.
 */
async function simulateMessage(page, message) {
  await page.evaluate((msg) => {
    if (window.__e2eSimulateMessage) {
      window.__e2eSimulateMessage(msg);
    }
  }, message);
}

/**
 * Waits for a storage key to reach an expected value (polling).
 * Useful for testing async storage writes after user interactions.
 * @param {import('@playwright/test').Page} page
 * @param {string} key - Storage key to watch.
 * @param {Function} predicate - Function receiving the value, returns true when satisfied.
 * @param {number} [timeoutMs=5000] - Maximum wait time.
 * @returns {Promise<*>} The final value that satisfied the predicate.
 */
async function waitForStorageValue(page, key, predicate, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await getStorageValue(page, key);
    if (predicate(value)) return value;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timeout waiting for storage key "${key}" to satisfy predicate after ${timeoutMs}ms`);
}

module.exports = {
  getStorageValue,
  getFullStorage,
  getSentMessages,
  getRegisteredAlarms,
  getCreatedNotifications,
  simulateMessage,
  waitForStorageValue
};
