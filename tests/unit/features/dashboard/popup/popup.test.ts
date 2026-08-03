import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AlgoRecallDashboard } from '../../../../../features/dashboard/popup/popup';
import { BackupManager } from '../../../../../features/common/data/backupManager';
import { Card } from '../../../../../types/domain';

jest.mock('../../../../../features/common/data/backupManager', () => ({
  BackupManager: {
    exportBackup: jest.fn().mockImplementation(() => Promise.resolve()),
    importBackup: jest.fn().mockImplementation((file: any, cb: any) => {
      if (cb) cb('Imported successfully', false);
      return Promise.resolve();
    })
  }
}));

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

    (global as any).URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');

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
        chromeSettings: { showMarkerPopup: true, showCharts: true, developerMode: true },
        fsrsActivity: { '2026-08-03': 5 },
        dailyGoalTarget: 10,
        notificationSettings: { enabled: true, frequency: '60' },
        debugLogs: [{ msg: 'log 1' }, { msg: 'log 2' }]
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

    (chrome as any).downloads = {
      download: jest.fn()
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

    it('handles status toast notifications and error formatting', () => {
      dashboard.showStatus('Toast test message');

      const statusMsg = document.getElementById('status-msg');
      expect(statusMsg?.innerHTML).toContain('Toast test message');
      expect(statusMsg?.classList.contains('show')).toBe(true);

      dashboard.showStatus('Error message', true);
      expect(statusMsg?.classList.contains('error')).toBe(true);

      jest.advanceTimersByTime(3000);
      expect(statusMsg?.classList.contains('show')).toBe(false);
    });

    it('handles exception in showStatus gracefully', () => {
      dashboard.dom.statusMsg = null;
      expect(() => dashboard.showStatus('Toast message')).not.toThrow();
    });

    it('handles constructor exceptions gracefully', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI Error'); };

      expect(() => new AlgoRecallDashboard()).not.toThrow();

      document.getElementById = origGEBI;
    });

    it('handles init exception gracefully', async () => {
      const localDashboard = new AlgoRecallDashboard();
      jest.spyOn(localDashboard, 'loadAll').mockRejectedValue(new Error('Load failure'));

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

      const managePlatformsBtn = document.getElementById('manage-platforms-btn');
      managePlatformsBtn?.click();

      const configureFsrsBtn = document.getElementById('configure-fsrs-btn');
      configureFsrsBtn?.click();

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

      const chartsToggle = document.getElementById('toggle-show-charts') as HTMLInputElement;
      chartsToggle.checked = false;
      chartsToggle.dispatchEvent(new Event('change'));
      await Promise.resolve();

      const devToggle = document.getElementById('toggle-dev-mode') as HTMLInputElement;
      devToggle.checked = true;
      devToggle.dispatchEvent(new Event('change'));
      await Promise.resolve();

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('exports debug logs on exportDebugLogsBtn click and handles empty logs branch', async () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        const result = { debugLogs: [] };
        if (cb) cb(result);
        return Promise.resolve(result);
      });

      await dashboard.init();

      const exportLogsBtn = document.getElementById('export-debug-logs-btn');
      exportLogsBtn?.click();
      expect(dashboard.dom.statusMsg?.textContent).toContain('No debug logs found.');
    });

    it('handles JSON backup import file change event', async () => {
      await dashboard.init();

      const importFileInput = document.getElementById('import-file') as HTMLInputElement;
      const file = new File(['{"fsrsCards":[]}'], 'backup.json', { type: 'application/json' });

      Object.defineProperty(importFileInput, 'files', { value: [file] });
      importFileInput.dispatchEvent(new Event('change'));
      await Promise.resolve();

      expect(BackupManager.importBackup).toHaveBeenCalled();
    });

    it('handles Anki export button click and downloads file', async () => {
      await dashboard.init();

      const ankiExportBtn = document.getElementById('anki-export-btn');
      ankiExportBtn?.click();

      expect(chrome.downloads.download).toHaveBeenCalled();
    });

    it('handles Anki text export and import helper methods', () => {
      const exportText = dashboard.exportToAnkiText(getFreshCards());
      expect(exportText).toContain('#separator:tab');

      const importedCards = dashboard.importFromAnkiText('Two Sum [URL: https://leetcode.com/problems/two-sum]\tSolution Approach\talgorecall::tag_one');
      expect(importedCards.length).toBe(1);
      expect(importedCards[0].problemTitle).toBe('Two Sum');
      expect(importedCards[0].problemUrl).toBe('https://leetcode.com/problems/two-sum');

      const emptyImport = dashboard.importFromAnkiText('#header comment\ninvalid line');
      expect(emptyImport.length).toBe(0);
    });

    it('handles Anki import file input change event', async () => {
      await dashboard.init();

      const ankiFileInput = document.getElementById('anki-import-file') as HTMLInputElement;
      const file = new File(['Two Sum\tApproach Text\ttag'], 'anki.txt', { type: 'text/plain' });

      Object.defineProperty(ankiFileInput, 'files', { value: [file] });

      // Mock FileReader
      const mockFileReader = {
        readAsText: jest.fn().mockImplementation(function (this: any) {
          if (this.onload) {
            this.onload({ target: { result: 'New Anki Card\tApproach\ttag' } } as any);
          }
        })
      };
      (global as any).FileReader = jest.fn().mockImplementation(() => mockFileReader);

      ankiFileInput.dispatchEvent(new Event('change'));
      await Promise.resolve();

      expect(chrome.storage.local.set).toHaveBeenCalled();
    });
  });
});
