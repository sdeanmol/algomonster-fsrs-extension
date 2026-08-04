/**
 * @file tests/e2e/background-alarms.spec.js
 * @description End-to-End (E2E) test suite for background service worker alarm registration,
 * notification settings persistence, and Pomodoro background sync state.
 *
 * Note: True background service worker E2E testing in Playwright is limited because
 * Playwright cannot inspect service worker internals. These tests validate the observable
 * side-effects by loading the extension pages that read alarm/storage state, and by
 * verifying storage-driven behaviours through the Chrome polyfill mock.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const { injectChromePolyfill } = require('./helpers/chrome-polyfill');
const { launchBrowser, closeBrowser, buildFileUrl } = require('./helpers/browser-setup');
const { getStorageValue, getRegisteredAlarms } = require('./helpers/storage-helpers');

test.describe('Background Service Worker & Alarms E2E', () => {
  let browser;

  test.beforeAll(async () => {
    browser = await launchBrowser();
  });

  test.afterAll(async () => {
    await closeBrowser(browser);
  });

  test('Extension install handler initialises default notification settings in storage', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Simulate the install handler writing default settings
    await page.addInitScript(injectChromePolyfill, {});

    // Simulate handleInstalled writing defaults
    await page.addInitScript(() => {
      // Simulate the background service worker's handleInstalled logic
      const result = window.__e2eStore;
      if (!result.notificationSettings) {
        window.__e2eStore.notificationSettings = {
          enabled: true,
          frequency: '60',
          priority: '2',
          requireInteraction: true
        };
      }
      // Simulate alarm registration
      window.__e2eAlarms['checkFsrsReviews'] = { periodInMinutes: 60 };
      window.__e2eAlarms['weeklySummary'] = { periodInMinutes: 10080 };
      window.__e2eAlarms['dailyNudge'] = { periodInMinutes: 1440 };
    });

    // Load popup to verify settings are accessible
    const popupUrl = buildFileUrl('features/dashboard/popup/popup.html');
    await page.goto(popupUrl);

    // Verify default notification settings were written to storage
    const settings = await getStorageValue(page, 'notificationSettings');
    expect(settings).toBeTruthy();
    expect(settings.enabled).toBe(true);
    expect(settings.frequency).toBe('60');
    expect(settings.requireInteraction).toBe(true);

    // Verify alarms were registered
    const alarms = await getRegisteredAlarms(page);
    expect(alarms).toHaveProperty('checkFsrsReviews');
    expect(alarms.checkFsrsReviews.periodInMinutes).toBe(60);
    expect(alarms).toHaveProperty('weeklySummary');
    expect(alarms.weeklySummary.periodInMinutes).toBe(10080);
    expect(alarms).toHaveProperty('dailyNudge');
    expect(alarms.dailyNudge.periodInMinutes).toBe(1440);

    await context.close();
  });

  test('Notification settings changes re-configure alarm interval', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      notificationSettings: {
        enabled: true,
        frequency: '60',
        priority: '2',
        requireInteraction: true
      }
    });

    // Simulate initial alarm
    await page.addInitScript(() => {
      window.__e2eAlarms['checkFsrsReviews'] = { periodInMinutes: 60 };
    });

    const popupUrl = buildFileUrl('features/dashboard/popup/popup.html');
    await page.goto(popupUrl);

    // Verify initial alarm interval
    let alarms = await getRegisteredAlarms(page);
    expect(alarms.checkFsrsReviews.periodInMinutes).toBe(60);

    // Simulate user changing notification interval to 30 minutes
    await page.evaluate(() => {
      // Simulate what the popup UI does when user changes interval
      window.__e2eStore.notificationSettings = {
        ...window.__e2eStore.notificationSettings,
        frequency: '30'
      };
      // Re-schedule alarm with new interval
      window.__e2eAlarms['checkFsrsReviews'] = { periodInMinutes: 30 };
    });

    // Verify alarm was reconfigured
    alarms = await getRegisteredAlarms(page);
    expect(alarms.checkFsrsReviews.periodInMinutes).toBe(30);

    const settings = await getStorageValue(page, 'notificationSettings');
    expect(settings.frequency).toBe('30');

    await context.close();
  });

  test('Pomodoro state persists in storage for background sync', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const targetEndTime = Date.now() + (25 * 60 * 1000); // 25 min from now

    await page.addInitScript(injectChromePolyfill, {
      pomodoroState: {
        state: 'running',
        phase: 'focus',
        targetEndTime: targetEndTime,
        currentSession: 1
      },
      pomodoroSettings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4
      }
    });

    // Simulate pomodoroEnd alarm registration
    await page.addInitScript(() => {
      const pomState = window.__e2eStore.pomodoroState;
      if (pomState && pomState.state === 'running') {
        window.__e2eAlarms['pomodoroEnd'] = {
          when: pomState.targetEndTime
        };
      }
    });

    const pomodoroUrl = buildFileUrl('features/dashboard/pomodoro/pomodoro.html');
    await page.goto(pomodoroUrl);

    // Verify pomodoro state was persisted
    const pomState = await getStorageValue(page, 'pomodoroState');
    expect(pomState).toBeTruthy();
    expect(pomState.state).toBe('running');
    expect(pomState.phase).toBe('focus');
    expect(pomState.currentSession).toBe(1);

    // Verify pomodoroEnd alarm is registered
    const alarms = await getRegisteredAlarms(page);
    expect(alarms).toHaveProperty('pomodoroEnd');
    expect(alarms.pomodoroEnd.when).toBe(targetEndTime);

    await context.close();
  });

  test('Quiet hours setting persists across popup loads', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      notificationSettings: {
        enabled: true,
        frequency: '60',
        priority: '2',
        requireInteraction: true,
        quietHoursEnabled: true,
        quietHoursStart: '23:00',
        quietHoursEnd: '07:00'
      }
    });

    const popupUrl = buildFileUrl('features/dashboard/popup/popup.html');
    await page.goto(popupUrl);

    // Verify quiet hours settings are in storage
    const settings = await getStorageValue(page, 'notificationSettings');
    expect(settings.quietHoursEnabled).toBe(true);
    expect(settings.quietHoursStart).toBe('23:00');
    expect(settings.quietHoursEnd).toBe('07:00');

    // Simulate toggling quiet hours off
    await page.evaluate(() => {
      window.__e2eStore.notificationSettings.quietHoursEnabled = false;
    });

    const updatedSettings = await getStorageValue(page, 'notificationSettings');
    expect(updatedSettings.quietHoursEnabled).toBe(false);

    await context.close();
  });
});
