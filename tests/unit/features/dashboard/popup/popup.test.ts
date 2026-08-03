import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AlgoRecallDashboard } from '../../../../../features/dashboard/popup/popup';
import { Card } from '../../../../../types/domain';

describe('AlgoRecallDashboard (Popup)', () => {
  let dashboard: AlgoRecallDashboard;

  const getFreshCards = (): Card[] => [
    {
      id: 'c1',
      problemTitle: 'Two Sum',
      problemUrl: 'https://leetcode.com/problems/two-sum',
      due: Date.now() - 1000,
      stability: 5,
      historyLog: []
    }
  ] as unknown as Card[];

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    jest.useFakeTimers();

    document.body.innerHTML = `
      <button id="theme-toggle-btn"></button>
      <input id="toggle-marker-popup" type="checkbox" />
      <input id="toggle-show-charts" type="checkbox" />
      <input id="toggle-dev-mode" type="checkbox" />
      <button id="manage-platforms-btn"></button>
      <button id="configure-fsrs-btn"></button>
      <button id="help-btn"></button>
      <button id="history-btn"></button>
      <button id="open-heatmap-tab-btn"></button>
      <div id="box-total"></div>
      <div id="box-due"></div>
      <div id="box-retention"></div>
      <button id="manage-highlights-btn"></button>
      <button id="open-options-btn"></button>
      <button id="analytics-btn"></button>
      <button id="header-analytics-btn"></button>
      <button id="forecast-btn"></button>
      <button id="export-btn"></button>
      <input id="import-file" type="file" />
      <button id="anki-export-btn"></button>
      <input id="anki-import-file" type="file" />
      <button id="studyplan-btn"></button>
      <button id="pomodoro-btn"></button>
      <button id="open-summary-page-btn"></button>
      <input id="toggle-weekly-digest" type="checkbox" />
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
      <input id="toggle-notifications" type="checkbox" />
      <select id="notification-interval"><option value="60"></option></select>
      <div id="custom-interval-container" class="hide-panel"><input id="custom-interval-input" value="" /></div>
      <input id="toggle-sticky-notification" type="checkbox" />
      <input id="toggle-quiet-hours" type="checkbox" />
      <div id="quiet-hours-container" class="hide-panel"><input id="quiet-hours-start" value="22:00" /><input id="quiet-hours-end" value="07:00" /></div>
      <button id="test-notification-btn"></button>
    `;

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const result = {
        fsrsCards: getFreshCards(),
        chromeSettings: { isDarkMode: true, showHighlighterMarker: true, showCharts: true, devModeEnabled: true },
        fsrsActivity: { '2026-08-03': 5 },
        dailyGoalTarget: 10,
        notificationSettings: { enabled: true, frequency: '60' }
      };
      if (typeof cb === 'function') cb(result);
      return Promise.resolve(result);
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
      if (typeof cb === 'function') cb();
      return Promise.resolve();
    });

    (chrome as any).tabs = {
      create: jest.fn().mockImplementation((options: any, cb?: any) => {
        if (cb) cb({ id: 5 });
      })
    };

    (chrome as any).runtime = {
      id: 'mock-id',
      getURL: jest.fn().mockImplementation((path: any) => `chrome-extension://mock-id/${path}`),
      sendMessage: jest.fn(),
      lastError: undefined
    };

    dashboard = new AlgoRecallDashboard();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('init and loadComponents', () => {
    it('initializes popup dashboard and loads stored settings and subclass components', async () => {
      await dashboard.init();

      expect(chrome.storage.local.get).toHaveBeenCalled();
    });

    it('handles status toast notifications', () => {
      dashboard.showStatus('Toast test message');

      const statusMsg = document.getElementById('status-msg');
      expect(statusMsg?.innerHTML).toContain('Toast test message');
      expect(statusMsg?.classList.contains('show')).toBe(true);
    });

    it('handles exception in showStatus gracefully', () => {
      dashboard.dom.statusMsg = null;
      expect(() => dashboard.showStatus('Toast message')).not.toThrow();
    });
  });

  describe('bindEvents and navigation button clicks', () => {
    it('binds navigation button click listeners to open option tabs', async () => {
      await dashboard.init();

      const helpBtn = document.getElementById('help-btn');
      helpBtn?.click();
      expect(chrome.tabs.create).toHaveBeenCalled();

      const historyBtn = document.getElementById('history-btn');
      historyBtn?.click();
      expect(chrome.tabs.create).toHaveBeenCalled();

      const forecastBtn = document.getElementById('forecast-btn');
      forecastBtn?.click();
      expect(chrome.tabs.create).toHaveBeenCalled();

      const pomodoroBtn = document.getElementById('pomodoro-btn');
      pomodoroBtn?.click();
      expect(chrome.tabs.create).toHaveBeenCalled();
    });

    it('handles theme toggle button clicks', async () => {
      await dashboard.init();

      const themeBtn = document.getElementById('theme-toggle-btn');
      themeBtn?.click();

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('handles Anki export and import helper methods', () => {
      const exportText = dashboard.exportToAnkiText(getFreshCards());
      expect(exportText).toContain('#separator:tab');

      const importedCards = dashboard.importFromAnkiText('Two Sum\tSolution Approach\talgorecall::tag');
      expect(importedCards.length).toBe(1);
    });
  });
});
