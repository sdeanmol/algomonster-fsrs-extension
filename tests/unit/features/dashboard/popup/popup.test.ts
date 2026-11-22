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
        fsrsActivity: { '2026-11-20': 5 },
        dailyGoalTarget: 10,
        longestStreak: 3,
        ratingPromptState: { status: 'unrated', snoozedUntil: 0 }
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
      jest.advanceTimersByTime(3500);
      expect(statusMsg?.classList.contains('show')).toBe(false);
    });

    it('handles initPopupDashboard when DOM is loaded or loading', () => {
      expect(() => initPopupDashboard()).not.toThrow();
    });
  });

  describe('navigation button clicks and exact canonical destinations (R2)', () => {
    it('binds navigation button click listeners to open canonical option tabs', () => {
      const tabsCreateSpy = jest.spyOn(chrome.tabs, 'create');

      // 1. Help
      document.getElementById('help-btn')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/common/help/help.html'
      });

      // 2. History (Bento)
      document.getElementById('history-btn')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/dashboard/history/history.html'
      });

      // 3. Heatmap full screen
      document.getElementById('open-heatmap-tab-btn')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/dashboard/heatmap/heatmap.html'
      });

      // 4. Forecast
      document.getElementById('forecast-btn')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/dashboard/forecast/forecast.html'
      });

      // 5. Pomodoro
      document.getElementById('pomodoro-btn')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/dashboard/pomodoro/pomodoro.html'
      });

      // 6. Study Plan / Exam Mode
      document.getElementById('studyplan-btn')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/dashboard/studyplan/studyplan.html'
      });

      // 7. Summary
      document.getElementById('open-summary-page-btn')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/dashboard/summary/summary.html'
      });

      // 8. Settings Hub (Bento)
      document.getElementById('settings-hub-btn')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/common/settings/settings.html'
      });

      // 9. Total Cards view
      document.getElementById('box-total')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/common/data/data.html?view=total'
      });

      // 10. Due Cards view
      document.getElementById('box-due')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/common/data/data.html?view=due'
      });

      // 11. Retention Cards view
      document.getElementById('box-retention')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/common/data/data.html?view=retention'
      });

      // 12. Highlights Manager
      document.getElementById('manage-highlights-btn')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/highlighter/manager/highlights.html'
      });

      // 13. Highlighter Options / Colors
      document.getElementById('open-options-btn')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/highlighter/options/highlightOptions.html'
      });

      // 14. Bento Analytics
      document.getElementById('analytics-btn')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/dashboard/analytics/analytics.html'
      });

      // 15. Header Analytics
      document.getElementById('header-analytics-btn')?.click();
      expect(tabsCreateSpy).toHaveBeenCalledWith({
        url: 'chrome-extension://mock-id/features/dashboard/analytics/analytics.html'
      });

      expect(tabsCreateSpy).toHaveBeenCalledTimes(15);
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

  describe('Background messaging & Event handler parity', () => {
    it('sends check_due_cards_now action to background worker', () => {
      chrome.runtime.sendMessage = jest.fn((msg: any, cb?: any) => {
        if (cb) cb({ success: true, dueCount: 5 });
      }) as any;

      const checkNowBtn = document.getElementById('check-now-btn') as HTMLElement;
      checkNowBtn.click();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'check_due_cards_now' },
        expect.any(Function)
      );

      const statusMsg = document.getElementById('status-msg');
      expect(statusMsg?.textContent).toContain('Checked! 5 reviews due.');
    });

    it('toggles heatmap lifetime view when toggle-lifetime-btn is clicked', () => {
      const toggleBtn = document.getElementById('toggle-lifetime-btn') as HTMLElement;
      expect(toggleBtn.textContent).toBe('Show Lifetime');

      toggleBtn.click();
      expect(toggleBtn.textContent).toBe('Show Last 12 Weeks');

      toggleBtn.click();
      expect(toggleBtn.textContent).toBe('Show Lifetime');
    });

    it('sends test_notification and test_summary_notification actions in dev mode', () => {
      chrome.runtime.sendMessage = jest.fn((msg: any, cb?: any) => {
        if (cb) cb({ success: true });
      }) as any;

      const testNotifBtn = document.getElementById('test-notification-btn') as HTMLElement;
      testNotifBtn.click();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'test_notification' },
        expect.any(Function)
      );

      const testSummaryBtn = document.getElementById('test-summary-notification-btn') as HTMLElement;
      testSummaryBtn.click();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'test_summary_notification' },
        expect.any(Function)
      );
    });
  });

  describe('Rating prompt & Chrome review URL replacement', () => {
    it('substitutes chrome.runtime.id into store review URLs on Chrome build', () => {
      const staticReviewLink = document.getElementById('static-review-link') as HTMLAnchorElement;
      if (BROWSER_CONFIG.target === 'chrome') {
        expect(staticReviewLink.href).not.toContain('YOUR_EXTENSION_ID');
      }
    });

    it('persists rating snooze and rated state to chrome.storage.local', async () => {
      const snoozeBtn = document.getElementById('snooze-rate-btn') as HTMLElement;
      snoozeBtn.click();
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ratingPromptState: expect.objectContaining({ status: 'snoozed' })
        })
      );

      const alreadyBtn = document.getElementById('already-rated-btn') as HTMLElement;
      alreadyBtn.click();
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ratingPromptState: expect.objectContaining({ status: 'rated' })
        })
      );
    });

    it('handles edit rating click by opening store review URL and resetting status', async () => {
      const editBtn = document.getElementById('edit-rating-btn') as HTMLElement;
      editBtn.click();

      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.any(String) })
      );
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          ratingPromptState: expect.objectContaining({ status: 'unrated' })
        })
      );
    });
  });

  describe('Header, Layout, and Modal Parity', () => {
    it('header has exactly the 5 canonical action controls and 0 rogue buttons', () => {
      const headerControls = document.querySelector('.header-controls') as HTMLElement;
      expect(headerControls).not.toBeNull();

      expect(headerControls.querySelector('#user-level-badge')).not.toBeNull();
      expect(headerControls.querySelector('#check-now-btn')).not.toBeNull();
      expect(headerControls.querySelector('#header-analytics-btn')).not.toBeNull();
      expect(headerControls.querySelector('#theme-toggle-btn')).not.toBeNull();
      expect(headerControls.querySelector('#help-btn')).not.toBeNull();

      // Rogue buttons must not exist in header
      expect(headerControls.querySelector('#history-btn')).toBeNull();
      expect(headerControls.querySelector('#open-heatmap-tab-btn')).toBeNull();
      expect(headerControls.querySelector('#settings-hub-btn')).toBeNull();
      expect(headerControls.querySelector('#achievements-btn')).toBeNull();
    });

    it('contains only 1 details accordion (advanced-tools-drawer) and static card divs', () => {
      const detailsElements = document.querySelectorAll('details');
      expect(detailsElements.length).toBe(1);
      expect(detailsElements[0].id).toBe('advanced-tools-drawer');

      // Static div cards
      const dailyFocusCard = document.getElementById('daily-focus-card');
      expect(dailyFocusCard?.tagName.toLowerCase()).toBe('div');

      const bentoCard = document.getElementById('bento-command-center');
      expect(bentoCard?.tagName.toLowerCase()).toBe('div');

      const heatmapCard = document.getElementById('activity-charts-card');
      expect(heatmapCard?.tagName.toLowerCase()).toBe('div');

      // Rogue duplicate cards must not exist
      expect(document.getElementById('study-tools-card')).toBeNull();
      expect(document.getElementById('highlighter-settings-card')).toBeNull();
    });

    it('clicking user-level-badge opens achievements modal', () => {
      const levelBadge = document.getElementById('user-level-badge') as HTMLElement;
      const modal = document.getElementById('achievements-modal') as HTMLElement;

      expect(modal.classList.contains('hide-panel')).toBe(true);
      levelBadge.click();
      expect(modal.classList.contains('hide-panel')).toBe(false);

      const closeBtn = document.getElementById('close-achievements-btn') as HTMLElement;
      closeBtn.click();
      expect(modal.classList.contains('hide-panel')).toBe(true);
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
