import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SettingsController } from '../../../../../features/common/settings/settings';
import { BackupManager } from '../../../../../features/common/data/backupManager';
import { ActionService } from '../../../../../features/common/services/actionService';

jest.mock('../../../../../features/common/data/backupManager', () => ({
  BackupManager: {
    exportBackup: jest.fn().mockImplementation(() => Promise.resolve()),
    importBackup: jest.fn().mockImplementation((file: any, cb: any) => {
      if (cb) cb('Imported successfully', false);
      return Promise.resolve();
    })
  }
}));

describe('SettingsController', () => {
  let controller: SettingsController;

  const mockSettingsHTML = `
    <button class="nav-tab active" data-tab="notifications" id="tab-btn-notifications"></button>
    <button class="nav-tab" data-tab="highlighter" id="tab-btn-highlighter"></button>
    <button class="nav-tab" data-tab="data" id="tab-btn-data"></button>
    <button class="nav-tab" data-tab="integrations" id="tab-btn-integrations"></button>
    <button class="nav-tab" data-tab="developer" id="tab-btn-developer"></button>
    <button class="nav-tab" data-tab="about" id="tab-btn-about"></button>

    <div class="tab-panel active" id="panel-notifications"></div>
    <div class="tab-panel" id="panel-highlighter"></div>
    <div class="tab-panel" id="panel-data"></div>
    <div class="tab-panel" id="panel-integrations"></div>
    <div class="tab-panel" id="panel-developer"></div>
    <div class="tab-panel" id="panel-about"></div>

    <button id="theme-toggle-btn"></button>

    <input id="toggle-notifications" type="checkbox" checked />
    <select id="notification-interval">
      <option value="1" id="dev-interval-option" hidden disabled>1 min (Dev)</option>
      <option value="15">15 min</option>
      <option value="30">30 min</option>
      <option value="60" selected>1 hour</option>
      <option value="120">2 hours</option>
      <option value="custom">Custom</option>
    </select>
    <div id="custom-interval-container" class="hide-panel">
      <input id="custom-interval-input" value="45" />
    </div>
    <input id="toggle-sticky-notification" type="checkbox" checked />
    <input id="toggle-quiet-hours" type="checkbox" />
    <div id="quiet-hours-container" class="hide-panel">
      <input id="quiet-hours-start" value="23:00" />
      <input id="quiet-hours-end" value="07:00" />
    </div>
    <input id="toggle-weekly-digest" type="checkbox" checked />
    <input id="toggle-badge-due-count" type="checkbox" checked />

    <input id="toggle-marker-popup" type="checkbox" checked />
    <input id="toggle-algo-launcher" type="checkbox" checked />

    <button id="settings-export-btn"></button>
    <label id="settings-import-label"><input id="settings-import-file" type="file" /></label>
    <button id="settings-anki-export-btn"></button>
    <label id="settings-anki-import-label"><input id="settings-anki-import-file" type="file" /></label>

    <input id="toggle-show-charts" type="checkbox" checked />
    <input id="toggle-daily-focus" type="checkbox" checked />
    <input id="toggle-dev-mode" type="checkbox" />
    <div id="dev-actions-container" class="hide-panel"></div>
    <button id="settings-test-notification-btn"></button>
    <button id="settings-test-summary-notification-btn"></button>
    <button id="settings-export-debug-logs-btn"></button>

    <a id="about-rate-store-btn" href="#"></a>
    <div id="status-toast" class="toast"></div>
  `;

  beforeEach(() => {
    document.body.innerHTML = mockSettingsHTML;
    jest.useFakeTimers();

    (global as any).URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
    (global as any).URL.revokeObjectURL = jest.fn();

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const data = {
        extensionSettings: {
          showMarkerPopup: true,
          showLauncher: true,
          showCharts: true,
          developerMode: false
        },
        notificationSettings: {
          enabled: true,
          frequency: '60',
          sticky: true,
          quietHoursEnabled: false,
          quietHoursStart: '23:00',
          quietHoursEnd: '07:00',
          weeklyDigest: true,
          badgeDueCount: true
        },
        fsrsCards: [],
        debugLogs: [{ msg: 'log item' }]
      };
      if (typeof cb === 'function') cb(data);
      return Promise.resolve(data);
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((items: any, cb?: any) => {
      if (typeof cb === 'function') cb();
      return Promise.resolve();
    });

    (chrome.runtime.sendMessage as jest.Mock).mockImplementation((msg: any, cb?: any) => {
      if (typeof cb === 'function') {
        cb({ success: true, dueCount: 3 });
      }
    });

    controller = new SettingsController();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Initialization & Tab Navigation', () => {
    it('initializes and switches active tabs correctly', async () => {
      await controller.init();

      expect(controller.dom.tabs.length).toBe(6);
      expect(controller.dom.panels.length).toBe(6);

      // Click on data tab
      const dataTab = document.getElementById('tab-btn-data') as HTMLButtonElement;
      dataTab.click();

      expect(dataTab.classList.contains('active')).toBe(true);
      const dataPanel = document.getElementById('panel-data');
      expect(dataPanel?.classList.contains('active')).toBe(true);

      const notifPanel = document.getElementById('panel-notifications');
      expect(notifPanel?.classList.contains('active')).toBe(false);
    });

    it('sets initial tab from URL hash if present', async () => {
      window.location.hash = '#developer';
      await controller.init();

      const devPanel = document.getElementById('panel-developer');
      expect(devPanel?.classList.contains('active')).toBe(true);
    });
  });

  describe('Notification Settings', () => {
    it('toggles notification master switch and updates storage and aria-checked', async () => {
      await controller.init();

      const toggle = controller.dom.toggleNotifications;
      expect(toggle?.getAttribute('aria-checked')).toBe('true');

      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
      }

      await Promise.resolve();
      await Promise.resolve();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSettings: expect.objectContaining({ enabled: false })
        })
      );
      expect(toggle?.getAttribute('aria-checked')).toBe('false');
    });

    it('handles interval changes including custom minutes and standard presets', async () => {
      await controller.init();

      const select = controller.dom.notificationInterval;
      if (select) {
        select.value = 'custom';
        select.dispatchEvent(new Event('change'));
      }

      await Promise.resolve();
      expect(controller.dom.customIntervalContainer?.classList.contains('hide-panel')).toBe(false);

      if (controller.dom.customIntervalInput) {
        controller.dom.customIntervalInput.value = '45';
        controller.dom.customIntervalInput.dispatchEvent(new Event('change'));
      }

      await Promise.resolve();
      await Promise.resolve();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSettings: expect.objectContaining({ frequency: '45', customInterval: 45 })
        })
      );

      // Switch back to standard 30 min preset
      if (select) {
        select.value = '30';
        select.dispatchEvent(new Event('change'));
      }

      await Promise.resolve();
      await Promise.resolve();

      expect(controller.dom.customIntervalContainer?.classList.contains('hide-panel')).toBe(true);
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSettings: expect.objectContaining({ frequency: '30', customInterval: 30 })
        })
      );
    });

    it('handles sticky notifications switch and updates requireInteraction and sticky', async () => {
      await controller.init();

      const toggle = controller.dom.toggleSticky;
      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
      }

      await Promise.resolve();
      await Promise.resolve();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSettings: expect.objectContaining({
            requireInteraction: false,
            sticky: false
          })
        })
      );
      expect(toggle?.getAttribute('aria-checked')).toBe('false');
    });

    it('handles quiet hours toggles and expands/collapses container', async () => {
      await controller.init();

      const toggle = controller.dom.toggleQuietHours;
      if (toggle) {
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change'));
      }

      await Promise.resolve();
      expect(controller.dom.quietHoursContainer?.classList.contains('hide-panel')).toBe(false);

      await Promise.resolve();
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSettings: expect.objectContaining({ quietHoursEnabled: true })
        })
      );
      expect(toggle?.getAttribute('aria-checked')).toBe('true');
    });

    it('handles quiet hours time window updates', async () => {
      await controller.init();

      if (controller.dom.quietHoursStart) {
        controller.dom.quietHoursStart.value = '22:00';
        controller.dom.quietHoursStart.dispatchEvent(new Event('change'));
      }
      if (controller.dom.quietHoursEnd) {
        controller.dom.quietHoursEnd.value = '08:00';
        controller.dom.quietHoursEnd.dispatchEvent(new Event('change'));
      }

      await Promise.resolve();
      await Promise.resolve();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSettings: expect.objectContaining({
            quietHoursStart: '22:00',
            quietHoursEnd: '08:00'
          })
        })
      );
    });

    it('handles weekly digest toggle and sends toggle_weekly_summary message', async () => {
      await controller.init();

      const toggle = controller.dom.toggleWeeklyDigest;
      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
      }

      await Promise.resolve();
      await Promise.resolve();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          weeklySummaryEnabled: false,
          notificationSettings: expect.objectContaining({ weeklyDigest: false })
        })
      );
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'toggle_weekly_summary', enabled: false },
        expect.any(Function)
      );
      expect(toggle?.getAttribute('aria-checked')).toBe('false');
    });

    it('handles toolbar icon due count badge toggle and updates badgeEnabled and showDueBadge', async () => {
      await controller.init();

      const toggle = controller.dom.toggleBadgeDueCount;
      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
      }

      await Promise.resolve();
      await Promise.resolve();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSettings: expect.objectContaining({
            badgeEnabled: false,
            showDueBadge: false,
            badgeDueCount: false
          })
        })
      );
      expect(toggle?.getAttribute('aria-checked')).toBe('false');
    });

    it('correctly loads custom interval and quiet hours during init', async () => {
      const customData = {
        extensionSettings: {},
        notificationSettings: {
          enabled: true,
          frequency: '45',
          customInterval: 45,
          requireInteraction: false,
          sticky: false,
          quietHoursEnabled: true,
          quietHoursStart: '22:30',
          quietHoursEnd: '06:30',
          badgeEnabled: false,
          showDueBadge: false
        },
        weeklySummaryEnabled: false
      };
      (chrome.storage.local.get as jest.Mock).mockImplementation((_keys, cb) => {
        if (typeof cb === 'function') cb(customData);
        return Promise.resolve(customData);
      });

      await controller.init();

      expect(controller.dom.notificationInterval?.value).toBe('custom');
      expect(controller.dom.customIntervalInput?.value).toBe('45');
      expect(controller.dom.customIntervalContainer?.classList.contains('hide-panel')).toBe(false);
      expect(controller.dom.toggleSticky?.checked).toBe(false);
      expect(controller.dom.toggleQuietHours?.checked).toBe(true);
      expect(controller.dom.quietHoursContainer?.classList.contains('hide-panel')).toBe(false);
      expect(controller.dom.quietHoursStart?.value).toBe('22:30');
      expect(controller.dom.quietHoursEnd?.value).toBe('06:30');
      expect(controller.dom.toggleWeeklyDigest?.checked).toBe(false);
      expect(controller.dom.toggleBadgeDueCount?.checked).toBe(false);
    });
  });

  describe('Highlighter and Tool Toggles', () => {
    it('toggles floating marker menu and updates settings', async () => {
      await controller.init();

      const toggle = controller.dom.toggleMarker;
      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
      }

      await Promise.resolve();
      await Promise.resolve();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          extensionSettings: expect.objectContaining({ showMarkerPopup: false })
        })
      );
    });

    it('toggles problem tracker launcher and updates settings', async () => {
      await controller.init();

      const toggle = controller.dom.toggleLauncher;
      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
      }

      await Promise.resolve();
      await Promise.resolve();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          extensionSettings: expect.objectContaining({ showLauncher: false })
        })
      );
    });
  });

  describe('Developer Diagnostics & Theme', () => {
    it('toggles showCharts and updates settings', async () => {
      await controller.init();

      const toggle = controller.dom.toggleShowCharts;
      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
      }

      await Promise.resolve();
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          extensionSettings: expect.objectContaining({ showCharts: false })
        })
      );
    });

    it('toggles showDailyFocus and updates settings', async () => {
      await controller.init();

      const toggle = controller.dom.toggleDailyFocus;
      if (toggle) {
        toggle.checked = false;
        toggle.dispatchEvent(new Event('change'));
      }

      await Promise.resolve();
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          extensionSettings: expect.objectContaining({ showDailyFocus: false })
        })
      );
    });

    it('toggles developer mode and exposes dev tools', async () => {
      await controller.init();

      const toggle = controller.dom.toggleDevMode;
      if (toggle) {
        toggle.checked = true;
        toggle.dispatchEvent(new Event('change'));
      }

      await Promise.resolve();
      await Promise.resolve();

      expect(controller.dom.devActionsContainer?.classList.contains('hide-panel')).toBe(false);
    });

    it('triggers test notifications via background message', async () => {
      await controller.init();

      controller.dom.testNotificationBtn?.click();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'send_test_notification' });

      controller.dom.testSummaryBtn?.click();
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'send_test_summary_notification' });
    });

    it('exports debug logs as JSON download', async () => {
      await controller.init();

      controller.dom.exportDebugLogsBtn?.click();

      await Promise.resolve();
      await Promise.resolve();

      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });

    it('calls ActionService.toggleTheme on theme button click', async () => {
      const spy = jest.spyOn(ActionService, 'toggleTheme').mockResolvedValue('light');
      await controller.init();

      controller.dom.themeToggleBtn?.click();

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  describe('Data Backup & Anki Operations', () => {
    it('triggers BackupManager.exportBackup on export click', async () => {
      await controller.init();

      controller.dom.exportBtn?.click();

      expect(BackupManager.exportBackup).toHaveBeenCalled();
    });

    it('triggers ActionService.exportAnki on anki export click', async () => {
      const spy = jest.spyOn(ActionService, 'executeAction').mockResolvedValue({
        action: 'export-anki',
        success: true,
        data: 5
      });
      await controller.init();

      controller.dom.ankiExportBtn?.click();

      expect(spy).toHaveBeenCalledWith('export-anki');
      spy.mockRestore();
    });
  });

  describe('Toast Notifications', () => {
    it('displays and auto-hides status toast', () => {
      controller.showToast('Test notification message');

      const toast = document.getElementById('status-toast');
      expect(toast?.textContent).toBe('Test notification message');
      expect(toast?.classList.contains('show')).toBe(true);

      jest.advanceTimersByTime(3000);
      expect(toast?.classList.contains('show')).toBe(false);
    });
  });
});
