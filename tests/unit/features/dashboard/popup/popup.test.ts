import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AlgoRecallDashboard } from '../../../../../features/dashboard/popup/popup';

describe('AlgoRecallDashboard (Popup)', () => {
  let dashboard: AlgoRecallDashboard;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    jest.useFakeTimers();

    (global as any).URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');

    document.body.innerHTML = `
      <button id="theme-toggle-btn"></button>
      <input id="toggle-marker-popup" type="checkbox" />
      <input id="toggle-algo-launcher" type="checkbox" />
      <input id="toggle-show-charts" type="checkbox" />
      <input id="toggle-daily-focus" type="checkbox" />
      <div id="daily-focus-card"></div>
      <div id="activity-charts-card"></div>
      <input id="toggle-dev-mode" type="checkbox" />
      <button id="help-btn"></button>
      <button id="history-btn"></button>
      <button id="open-heatmap-tab-btn"></button>
      <div id="box-total" tabindex="0"></div>
      <div id="box-due" tabindex="0"></div>
      <div id="box-retention" tabindex="0"></div>
      <button id="manage-highlights-btn"></button>
      <button id="open-options-btn"></button>
      <button id="analytics-btn"></button>
      <button id="header-analytics-btn"></button>
      <button id="forecast-btn"></button>
      <button id="studyplan-btn"></button>
      <button id="pomodoro-btn"></button>
      <button id="open-summary-page-btn"></button>
      <button id="settings-hub-btn"></button>
      <button id="check-now-btn"></button>
      <div id="notification-settings-card"></div>
      <span id="status-msg"></span>
      <div id="dev-mode-actions" style="display: none;"></div>
      <button id="export-debug-logs-btn"></button>
      <div id="test-notifications-container" style="display: none;"></div>

      <div id="heatmap-grid"></div>
      <button id="toggle-lifetime-btn"></button>
      <span id="total-cards"></span>
      <span id="due-cards"></span>
      <span id="retention-rate"></span>
      <input id="daily-goal-target" value="10" />
      <span id="goal-progress-text"></span>
      <circle id="goal-progress-ring"></circle>
      <span id="streak-days"></span>
      <span id="longest-streak"></span>
      <div id="celebration-confetti-canvas"></div>
      <div id="level-badge"></div>
      <span id="level-num"></span>
      <span id="level-title"></span>
      <div id="xp-bar-fill"></div>
      <span id="xp-text"></span>
      <input id="popup-search-input" value="" />
      <select id="popup-tag-filter"><option value="all">All Tags</option></select>
      <div id="popup-search-results"></div>
      <div id="rating-prompt-card" class="hide-panel">
        <div id="rating-prompt-state"></div>
        <div id="rating-thanks-state"></div>
        <a id="rate-store-btn" href="YOUR_EXTENSION_ID"></a>
        <button id="snooze-rate-btn"></button>
        <button id="already-rated-btn"></button>
        <button id="edit-rating-btn"></button>
      </div>
      <div id="permission-warning-banner" class="hide-panel"><span></span><button id="enable-notifications-btn"></button></div>
    `;

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const result = {
        extensionSettings: {
          showMarkerPopup: true,
          showCharts: true,
          showLauncher: true,
          developerMode: false
        },
        fsrsCards: [],
        reviewLogs: [],
        studyStreak: { current: 3, longest: 5, lastActiveDate: '2026-11-20' }
      };
      if (typeof cb === 'function') cb(result);
      return Promise.resolve(result);
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
      if (typeof cb === 'function') cb();
      return Promise.resolve();
    });

    chrome.tabs.create = jest.fn().mockImplementation(() => Promise.resolve({ id: 1 })) as any;
    chrome.runtime.getURL = jest.fn().mockImplementation((path: any) => `chrome-extension://mock-id/${path}`) as any;

    dashboard = new AlgoRecallDashboard();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('init and loadComponents', () => {
    it('initializes popup dashboard and loads stored settings and subclass components', async () => {
      await dashboard.init();
      expect(dashboard.dom.markerToggle?.checked).toBe(true);
      expect(dashboard.dom.chartsToggle?.checked).toBe(true);
      expect(dashboard.dom.launcherToggle?.checked).toBe(true);
    });

    it('handles status toast notifications and error formatting', () => {
      dashboard.showStatus('Operation successful!', false);
      const statusMsg = document.getElementById('status-msg');
      expect(statusMsg?.className).toContain('show success');
      expect(statusMsg?.textContent).toContain('Operation successful!');

      // Error branch
      dashboard.showStatus('Operation failed!', true);
      expect(statusMsg?.className).toContain('show error');
      expect(statusMsg?.textContent).toContain('Operation failed!');

      // Fast-forward auto-dismiss timer
      jest.advanceTimersByTime(2600);
      expect(statusMsg?.classList.contains('show')).toBe(false);
    });

    it('handles exception in showStatus gracefully', () => {
      dashboard.dom.statusMsg = null;
      expect(() => dashboard.showStatus('Ignored status')).not.toThrow();
    });

    it('handles constructor exceptions gracefully', () => {
      const origGetElement = document.getElementById;
      document.getElementById = jest.fn().mockImplementation(() => {
        throw new Error('DOM Error');
      }) as any;
      expect(() => new AlgoRecallDashboard()).not.toThrow();
      document.getElementById = origGetElement;
    });

    it('handles init exception gracefully', async () => {
      const localDashboard = new AlgoRecallDashboard();
      jest.spyOn(localDashboard, 'bindEvents').mockImplementationOnce(() => {
        throw new Error('bindEvents error');
      });
      await expect(localDashboard.init()).resolves.not.toThrow();
    });
  });

  describe('bindEvents, switches, and navigation button clicks', () => {
    it('binds navigation button click listeners to open option tabs', async () => {
      await dashboard.init();

      const helpBtn = document.getElementById('help-btn');
      helpBtn?.click();
      expect(chrome.tabs.create).toHaveBeenCalled();

      const historyBtn = document.getElementById('history-btn');
      historyBtn?.click();

      const heatmapBtn = document.getElementById('open-heatmap-tab-btn');
      heatmapBtn?.click();

      const forecastBtn = document.getElementById('forecast-btn');
      forecastBtn?.click();

      const pomodoroBtn = document.getElementById('pomodoro-btn');
      pomodoroBtn?.click();

      const studyplanBtn = document.getElementById('studyplan-btn');
      studyplanBtn?.click();

      const summaryBtn = document.getElementById('open-summary-page-btn');
      summaryBtn?.click();

      const settingsHubBtn = document.getElementById('settings-hub-btn');
      settingsHubBtn?.click();

      const boxTotal = document.getElementById('box-total');
      boxTotal?.click();

      const boxDue = document.getElementById('box-due');
      boxDue?.click();

      const boxRetention = document.getElementById('box-retention');
      boxRetention?.click();

      const manageHighlightsBtn = document.getElementById('manage-highlights-btn');
      manageHighlightsBtn?.click();

      const openOptionsBtn = document.getElementById('open-options-btn');
      openOptionsBtn?.click();

      const analyticsBtn = document.getElementById('analytics-btn');
      analyticsBtn?.click();

      const headerAnalyticsBtn = document.getElementById('header-analytics-btn');
      headerAnalyticsBtn?.click();

      expect(chrome.tabs.create).toHaveBeenCalledTimes(15);
    });

    it('handles theme, marker, charts, and dev mode toggle changes', async () => {
      await dashboard.init();

      const themeBtn = document.getElementById('theme-toggle-btn');
      themeBtn?.click();
      await Promise.resolve();

      const markerToggle = document.getElementById('toggle-marker-popup') as HTMLInputElement;
      markerToggle.checked = false;
      markerToggle.dispatchEvent(new Event('change'));
      await Promise.resolve();
      expect(chrome.storage.local.set).toHaveBeenCalled();

      const chartsToggle = document.getElementById('toggle-show-charts') as HTMLInputElement;
      chartsToggle.checked = false;
      chartsToggle.dispatchEvent(new Event('change'));
      await Promise.resolve();
      expect(chrome.storage.local.set).toHaveBeenCalled();

      const launcherToggle = document.getElementById('toggle-algo-launcher') as HTMLInputElement;
      launcherToggle.checked = false;
      launcherToggle.dispatchEvent(new Event('change'));
      await Promise.resolve();
      expect(chrome.storage.local.set).toHaveBeenCalled();

      const devToggle = document.getElementById('toggle-dev-mode') as HTMLInputElement;
      devToggle.checked = true;
      devToggle.dispatchEvent(new Event('change'));
      await Promise.resolve();
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('exports debug logs on exportDebugLogsBtn click and handles empty logs branch', async () => {
      chrome.storage.local.get = jest.fn((keys: any, cb?: any) => {
        const result = { debugLogs: [] };
        if (cb) cb(result);
        return Promise.resolve(result);
      }) as any;

      await dashboard.init();

      const exportLogsBtn = document.getElementById('export-debug-logs-btn');
      exportLogsBtn?.click();
      expect(dashboard.dom.statusMsg?.textContent).toContain('No debug logs found.');
    });
  });

  describe('Global Init function', () => {
    it('initializes popup safely', () => {
      expect(dashboard).toBeDefined();
    });
  });

  describe('Popup Button Error Handlers', () => {
    it('safely catches errors when chrome.tabs.create fails on buttons', async () => {
      await dashboard.init();
      chrome.tabs.create = jest.fn().mockImplementation(() => {
        throw new Error('Tabs create failed');
      }) as any;

      const buttons = [
        'help-btn',
        'history-btn',
        'open-heatmap-tab-btn',
        'forecast-btn',
        'studyplan-btn',
        'pomodoro-btn',
        'open-summary-page-btn',
        'settings-hub-btn',
        'manage-highlights-btn',
        'open-options-btn',
        'analytics-btn',
        'header-analytics-btn'
      ];

      buttons.forEach(id => {
        const btn = document.getElementById(id);
        expect(() => btn?.click()).not.toThrow();
      });
    });

    it('safely catches errors when exporting debug logs fails', async () => {
      await dashboard.init();
      const exportBtn = document.getElementById('export-debug-logs-btn') as HTMLElement;

      chrome.storage.local.get = jest.fn((keys: any, cb?: any) => {
        if (cb) cb(null);
        return Promise.resolve(null);
      }) as any;

      expect(() => exportBtn.click()).not.toThrow();
    });
  });

  describe('Popup Success Actions', () => {
    it('successfully exports debug logs when supportsDownloads is true', async () => {
      await dashboard.init();
      const exportBtn = document.getElementById('export-debug-logs-btn');

      const BROWSER_CONFIG = require('../../../../../features/common/browserConfig').BROWSER_CONFIG;
      BROWSER_CONFIG.supportsDownloads = true;

      chrome.storage.local.get = jest.fn((keys: any, cb?: any) => {
        const result = { debugLogs: [{ msg: 'Test' }] };
        if (cb) cb(result);
        return Promise.resolve(result);
      }) as any;

      chrome.downloads = {
        download: jest.fn((options: any, cb: any) => {
          if (cb) cb();
        })
      } as any;

      expect(() => exportBtn?.click()).not.toThrow();
    });

    it('successfully exports debug logs when supportsDownloads is false', async () => {
      await dashboard.init();
      const exportBtn = document.getElementById('export-debug-logs-btn');

      const BROWSER_CONFIG = require('../../../../../features/common/browserConfig').BROWSER_CONFIG;
      BROWSER_CONFIG.supportsDownloads = false;

      chrome.storage.local.get = jest.fn((keys: any, cb?: any) => {
        const result = { debugLogs: [{ msg: 'Test' }] };
        if (cb) cb(result);
        return Promise.resolve(result);
      }) as any;

      expect(() => exportBtn?.click()).not.toThrow();
    });
  });

  describe('Usability Audit Fixes (UA-002, UA-010, UA-029)', () => {
    it('UA-029: triggers manual review check via check-now-btn and shows status', async () => {
      await dashboard.init();

      chrome.runtime.sendMessage = jest.fn((msg: any, cb?: any) => {
        if (cb) cb({ success: true, dueCount: 3 });
      }) as any;

      const checkNowBtn = document.getElementById('check-now-btn') as HTMLElement;
      checkNowBtn.click();
      const statusMsg = document.getElementById('status-msg');
      expect(statusMsg?.textContent).toContain('Checked! 3 reviews due.');
    });

    it('UA-002: sets and syncs aria-checked attribute on switch toggles', async () => {
      await dashboard.init();
      const chartsToggle = document.getElementById('toggle-show-charts') as HTMLInputElement;
      expect(chartsToggle.getAttribute('aria-checked')).toBe('true');

      chartsToggle.checked = false;
      chartsToggle.dispatchEvent(new Event('change'));
      expect(chartsToggle.getAttribute('aria-checked')).toBe('false');

      const launcherToggle = document.getElementById('toggle-algo-launcher') as HTMLInputElement;
      expect(launcherToggle.getAttribute('aria-checked')).toBe('true');
      launcherToggle.checked = false;
      launcherToggle.dispatchEvent(new Event('change'));
      expect(launcherToggle.getAttribute('aria-checked')).toBe('false');

      const devToggle = document.getElementById('toggle-dev-mode') as HTMLInputElement;
      devToggle.checked = true;
      devToggle.dispatchEvent(new Event('change'));
      expect(devToggle.getAttribute('aria-checked')).toBe('true');
    });

    it('UA-010: hides notification settings card on Safari builds', async () => {
      const BROWSER_CONFIG = require('../../../../../features/common/browserConfig').BROWSER_CONFIG;
      const origSupports = BROWSER_CONFIG.supportsNotifications;
      BROWSER_CONFIG.supportsNotifications = false;

      await dashboard.init();
      const notifCard = document.getElementById('notification-settings-card') as HTMLElement;
      expect(notifCard.style.display).toBe('none');

      BROWSER_CONFIG.supportsNotifications = origSupports;
    });

    it('UX-003: enables accessible keyboard activation on metric stat boxes', async () => {
      await dashboard.init();
      const boxTotal = document.getElementById('box-total') as HTMLElement;
      const boxDue = document.getElementById('box-due') as HTMLElement;
      const boxRetention = document.getElementById('box-retention') as HTMLElement;

      const tabsCreateSpy = jest.spyOn(chrome.tabs, 'create');

      // Enter key on boxTotal triggers navigation
      boxTotal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      expect(tabsCreateSpy).toHaveBeenCalled();

      // Space key on boxDue triggers navigation
      boxDue.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      expect(tabsCreateSpy).toHaveBeenCalledTimes(2);

      // Enter key on boxRetention triggers navigation
      boxRetention.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      expect(tabsCreateSpy).toHaveBeenCalledTimes(3);

      // Other keys do nothing
      boxTotal.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      expect(tabsCreateSpy).toHaveBeenCalledTimes(3);
    });

    it('UX-009: toggle-show-charts updates activity-charts-card while daily-focus-card remains visible', async () => {
      await dashboard.init();
      const chartsToggle = document.getElementById('toggle-show-charts') as HTMLInputElement;
      const activityCard = document.getElementById('activity-charts-card') as HTMLElement;
      const dailyFocusCard = document.getElementById('daily-focus-card') as HTMLElement;

      expect(activityCard.style.display).not.toBe('none');
      expect(dailyFocusCard.style.display).not.toBe('none');

      // Toggle off - activity charts (heatmap) hidden, daily focus stays visible
      chartsToggle.checked = false;
      chartsToggle.dispatchEvent(new Event('change'));
      await Promise.resolve();
      expect(activityCard.style.display).toBe('none');
      expect(dailyFocusCard.style.display).not.toBe('none');

      // Toggle on - activity charts restored
      chartsToggle.checked = true;
      chartsToggle.dispatchEvent(new Event('change'));
      await Promise.resolve();
      expect(activityCard.style.display).not.toBe('none');
      expect(dailyFocusCard.style.display).not.toBe('none');
    });

    it('UX-010: toggle-daily-focus updates daily-focus-card visibility', async () => {
      await dashboard.init();
      const dailyFocusToggle = document.getElementById('toggle-daily-focus') as HTMLInputElement;
      const dailyFocusCard = document.getElementById('daily-focus-card') as HTMLElement;

      expect(dailyFocusCard.style.display).not.toBe('none');

      // Toggle off - daily focus hidden
      dailyFocusToggle.checked = false;
      dailyFocusToggle.dispatchEvent(new Event('change'));
      await Promise.resolve();
      expect(dailyFocusCard.style.display).toBe('none');

      // Toggle on - daily focus restored
      dailyFocusToggle.checked = true;
      dailyFocusToggle.dispatchEvent(new Event('change'));
      await Promise.resolve();
      expect(dailyFocusCard.style.display).not.toBe('none');
    });
  });
});
