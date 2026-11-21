import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { PopupApp, initPopupDashboard } from '../../../../../features/dashboard/popup/popup';
import { BROWSER_CONFIG } from '../../../../../features/common/browserConfig';

describe('PopupApp (Declarative Preact Popup)', () => {
  let root: HTMLElement;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    jest.useFakeTimers();

    (global as any).URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');

    root = document.createElement('div');
    root.id = 'root';
    document.body.appendChild(root);

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const result = {
        extensionSettings: {
          showMarkerPopup: true,
          showCharts: true,
          showLauncher: true,
          developerMode: false,
          showDailyFocus: true
        },
        fsrsCards: [],
        reviewLogs: [],
        fsrsActivity: { '2026-11-20': 5 }
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

    render(h(PopupApp, {}), root);
  });

  afterEach(() => {
    render(null, root);
    root.remove();
    document.body.innerHTML = '';
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('init and render', () => {
    it('initializes popup dashboard and renders stored settings toggles', async () => {
      const markerToggle = document.getElementById('toggle-marker-popup') as HTMLInputElement;
      const chartsToggle = document.getElementById('toggle-show-charts') as HTMLInputElement;
      const launcherToggle = document.getElementById('toggle-algo-launcher') as HTMLInputElement;

      expect(markerToggle?.checked).toBe(true);
      expect(chartsToggle?.checked).toBe(true);
      expect(launcherToggle?.checked).toBe(true);
    });

    it('renders and auto-dismisses toast notifications', async () => {
      const checkNowBtn = document.getElementById('check-now-btn') as HTMLElement;
      chrome.runtime.sendMessage = jest.fn((msg: any, cb?: any) => {
        if (cb) cb({ success: true, dueCount: 0 });
      }) as any;

      checkNowBtn.click();
      const statusMsg = document.getElementById('status-msg');
      expect(statusMsg?.textContent).toContain('Checked! 0 reviews due.');
      expect(statusMsg?.classList.contains('show')).toBe(true);

      // Fast-forward auto-dismiss timer
      jest.advanceTimersByTime(3000);
      expect(statusMsg?.classList.contains('show')).toBe(false);
    });

    it('handles initPopupDashboard when DOM is loaded or loading', () => {
      expect(() => initPopupDashboard()).not.toThrow();
    });
  });

  describe('navigation button clicks and links', () => {
    it('binds navigation button click listeners to open option tabs', () => {
      const helpBtn = document.getElementById('help-btn');
      helpBtn?.click();

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

      expect(chrome.tabs.create).toHaveBeenCalled();
    });
  });

  describe('toggle changes and settings persistence', () => {
    it('handles theme, marker, charts, and dev mode toggle changes', async () => {
      const themeBtn = document.getElementById('theme-toggle-btn');
      themeBtn?.click();
      expect(chrome.storage.local.set).toHaveBeenCalled();

      const markerToggle = document.getElementById('toggle-marker-popup') as HTMLInputElement;
      markerToggle.checked = false;
      markerToggle.dispatchEvent(new Event('change'));
      expect(chrome.storage.local.set).toHaveBeenCalled();

      const chartsToggle = document.getElementById('toggle-show-charts') as HTMLInputElement;
      chartsToggle.checked = false;
      chartsToggle.dispatchEvent(new Event('change'));
      expect(chrome.storage.local.set).toHaveBeenCalled();

      const launcherToggle = document.getElementById('toggle-algo-launcher') as HTMLInputElement;
      launcherToggle.checked = false;
      launcherToggle.dispatchEvent(new Event('change'));
      expect(chrome.storage.local.set).toHaveBeenCalled();

      const devToggle = document.getElementById('toggle-dev-mode') as HTMLInputElement;
      devToggle.checked = true;
      devToggle.dispatchEvent(new Event('change'));
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('exports debug logs on exportDebugLogsBtn click and handles empty logs branch', async () => {
      chrome.storage.local.get = jest.fn((keys: any, cb?: any) => {
        const result = { debugLogs: [] };
        if (cb) cb(result);
        return Promise.resolve(result);
      }) as any;

      const exportLogsBtn = document.getElementById('export-debug-logs-btn');
      exportLogsBtn?.click();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();

      const statusMsg = document.getElementById('status-msg');
      expect(statusMsg?.textContent).toContain('No debug logs found.');
    });

    it('successfully exports debug logs when logs are present', async () => {
      chrome.storage.local.get = jest.fn((keys: any, cb?: any) => {
        const result = { debugLogs: [{ msg: 'Test log entry' }] };
        if (cb) cb(result);
        return Promise.resolve(result);
      }) as any;

      chrome.downloads = {
        download: jest.fn((options: any, cb: any) => {
          if (cb) cb();
        })
      } as any;

      const exportLogsBtn = document.getElementById('export-debug-logs-btn');
      exportLogsBtn?.click();
      await Promise.resolve();

      expect(chrome.downloads.download).toHaveBeenCalled();
    });
  });

  describe('Usability Audit (UA-002, UA-010, UA-029, UX-003, UX-009, UX-010)', () => {
    it('UA-029: triggers manual review check via check-now-btn and shows status', async () => {
      chrome.runtime.sendMessage = jest.fn((msg: any, cb?: any) => {
        if (cb) cb({ success: true, dueCount: 3 });
      }) as any;

      const checkNowBtn = document.getElementById('check-now-btn') as HTMLElement;
      checkNowBtn.click();
      const statusMsg = document.getElementById('status-msg');
      expect(statusMsg?.textContent).toContain('Checked! 3 reviews due.');
    });

    it('UA-002: sets and syncs aria-checked attribute on switch toggles', async () => {
      const chartsToggle = document.getElementById('toggle-show-charts') as HTMLInputElement;
      expect(chartsToggle.getAttribute('aria-checked')).toBe('true');

      chartsToggle.checked = false;
      chartsToggle.dispatchEvent(new Event('change'));
      await Promise.resolve();
      render(h(PopupApp, {}), root);
      expect(chartsToggle.getAttribute('aria-checked')).toBe('false');
    });

    it('UA-010: hides notification settings card on Safari builds', () => {
      const notifCard = document.getElementById('notification-settings-card') as HTMLElement;
      if (!BROWSER_CONFIG.supportsNotifications) {
        expect(notifCard.style.display).toBe('none');
      } else {
        expect(notifCard.style.display).not.toBe('none');
      }
    });

    it('UX-003: enables accessible keyboard activation on metric stat boxes', () => {
      const boxTotal = document.getElementById('box-total') as HTMLElement;
      const boxDue = document.getElementById('box-due') as HTMLElement;
      const boxRetention = document.getElementById('box-retention') as HTMLElement;

      const tabsCreateSpy = jest.spyOn(chrome.tabs, 'create');

      boxTotal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      expect(tabsCreateSpy).toHaveBeenCalled();

      boxDue.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      expect(tabsCreateSpy).toHaveBeenCalledTimes(2);

      boxRetention.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      expect(tabsCreateSpy).toHaveBeenCalledTimes(3);

      boxTotal.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      expect(tabsCreateSpy).toHaveBeenCalledTimes(3);
    });

    it('UX-009: toggle-show-charts updates activity-charts-card visibility', async () => {
      const chartsToggle = document.getElementById('toggle-show-charts') as HTMLInputElement;
      const activityCard = document.getElementById('activity-charts-card') as HTMLElement;
      const dailyFocusCard = document.getElementById('daily-focus-card') as HTMLElement;

      expect(activityCard.style.display).not.toBe('none');
      expect(dailyFocusCard.style.display).not.toBe('none');

      chartsToggle.checked = false;
      chartsToggle.dispatchEvent(new Event('change'));
      await Promise.resolve();
      render(h(PopupApp, {}), root);

      const updatedActivityCard = document.getElementById('activity-charts-card') as HTMLElement;
      expect(updatedActivityCard.style.display).toBe('none');
    });

    it('UX-010: toggle-daily-focus updates daily-focus-card visibility', async () => {
      const dailyFocusToggle = document.getElementById('toggle-daily-focus') as HTMLInputElement;
      const dailyFocusCard = document.getElementById('daily-focus-card') as HTMLElement;

      expect(dailyFocusCard.style.display).not.toBe('none');

      dailyFocusToggle.checked = false;
      dailyFocusToggle.dispatchEvent(new Event('change'));
      await Promise.resolve();
      render(h(PopupApp, {}), root);

      const updatedDailyCard = document.getElementById('daily-focus-card') as HTMLElement;
      expect(updatedDailyCard.style.display).toBe('none');
    });
  });
});
