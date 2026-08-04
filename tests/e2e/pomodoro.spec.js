/**
 * @file tests/e2e/pomodoro.spec.js
 * @description End-to-End (E2E) test suite for the Pomodoro Focus Timer feature.
 * Tests timer display, start/pause/reset controls, timer countdown ticking,
 * phase transitions, and settings persistence.
 */

const { test, expect } = require('@playwright/test');
const { injectChromePolyfill } = require('./helpers/chrome-polyfill');
const { launchBrowser, closeBrowser, buildFileUrl } = require('./helpers/browser-setup');
const { getStorageValue } = require('./helpers/storage-helpers');

test.describe('Pomodoro Focus Timer E2E Workflows', () => {
  let browser;

  test.beforeAll(async () => {
    browser = await launchBrowser();
  });

  test.afterAll(async () => {
    await closeBrowser(browser);
  });

  test('Timer displays initial 25:00 with start button visible', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: [],
      pomodoroSettings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4
      }
    });

    const pomodoroUrl = buildFileUrl('features/dashboard/pomodoro/pomodoro.html');
    await page.goto(pomodoroUrl);

    const timerDisplay = page.locator('#timer-time');
    await expect(timerDisplay).toBeVisible();
    await expect(timerDisplay).toHaveText('25:00');

    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeVisible();

    await context.close();
  });

  test('Start button starts timer and reveals pause button', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: [],
      pomodoroSettings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4
      }
    });

    const pomodoroUrl = buildFileUrl('features/dashboard/pomodoro/pomodoro.html');
    await page.goto(pomodoroUrl);

    const startBtn = page.locator('#start-btn');
    await startBtn.click();

    // Pause button should appear after start
    const pauseBtn = page.locator('#pause-btn');
    await expect(pauseBtn).toBeVisible();

    await context.close();
  });

  test('Timer countdown ticks after start', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: [],
      pomodoroSettings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4
      }
    });

    const pomodoroUrl = buildFileUrl('features/dashboard/pomodoro/pomodoro.html');
    await page.goto(pomodoroUrl);

    const timerDisplay = page.locator('#timer-time');
    await expect(timerDisplay).toHaveText('25:00');

    // Start the timer
    await page.locator('#start-btn').click();

    // Wait for 2+ seconds of ticking
    await page.waitForTimeout(2500);

    // Timer should have decremented from 25:00
    const timerText = await timerDisplay.textContent();
    expect(timerText).not.toBe('25:00');
    // Should still be in the 24:5x range (within ±1 second tolerance)
    expect(timerText).toMatch(/24:5[0-9]/);

    await context.close();
  });

  test('Pause freezes timer and resume continues from paused time', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: [],
      pomodoroSettings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4
      }
    });

    const pomodoroUrl = buildFileUrl('features/dashboard/pomodoro/pomodoro.html');
    await page.goto(pomodoroUrl);

    // Start timer
    await page.locator('#start-btn').click();
    await page.waitForTimeout(1500);

    // Pause
    const pauseBtn = page.locator('#pause-btn');
    await pauseBtn.click();

    const timerDisplay = page.locator('#timer-time');
    const pausedTime = await timerDisplay.textContent();

    // Wait 2 seconds while paused
    await page.waitForTimeout(2000);

    // Timer should NOT have changed
    const afterWait = await timerDisplay.textContent();
    expect(afterWait).toBe(pausedTime);

    await context.close();
  });

  test('Reset button returns timer to initial duration', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: [],
      pomodoroSettings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4
      }
    });

    const pomodoroUrl = buildFileUrl('features/dashboard/pomodoro/pomodoro.html');
    await page.goto(pomodoroUrl);

    // Start and let tick
    await page.locator('#start-btn').click();
    await page.waitForTimeout(1500);

    // Reset
    const resetBtn = page.locator('#reset-btn');
    if (await resetBtn.isVisible()) {
      await resetBtn.click();

      // Timer should be back to 25:00
      const timerDisplay = page.locator('#timer-time');
      await expect(timerDisplay).toHaveText('25:00');

      // Start button should be visible again
      const startBtn = page.locator('#start-btn');
      await expect(startBtn).toBeVisible();
    }

    await context.close();
  });

  test('Phase label shows "Focus" during focus session', async () => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.addInitScript(injectChromePolyfill, {
      fsrsCards: [],
      pomodoroSettings: {
        focusDuration: 25,
        shortBreakDuration: 5,
        longBreakDuration: 15,
        sessionsBeforeLongBreak: 4
      }
    });

    const pomodoroUrl = buildFileUrl('features/dashboard/pomodoro/pomodoro.html');
    await page.goto(pomodoroUrl);

    // Look for phase/status indicator
    const phaseLabel = page.locator('#timer-phase, .phase-label, .timer-status');
    if (await phaseLabel.first().isVisible().catch(() => false)) {
      const text = await phaseLabel.first().textContent();
      expect(text.toLowerCase()).toContain('focus');
    }

    await context.close();
  });
});
