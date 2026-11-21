/**
 * @file tests/unit/features/common/settings/settings.test.ts
 * @description Unit tests for production Settings view and SettingsApp Preact component.
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { act } from 'preact/test-utils';
import { SettingsApp, initSettings } from '../../../../../features/common/settings/settings';
import { BackupManager } from '../../../../../features/common/data/backupManager';
import { ActionService } from '../../../../../features/common/services/actionService';
import { BROWSER_CONFIG } from '../../../../../features/common/browserConfig';

jest.mock('../../../../../features/common/data/backupManager', () => ({
  BackupManager: {
    exportBackup: jest.fn().mockImplementation(() => Promise.resolve()),
    importBackup: jest.fn().mockImplementation((_file: any, cb: any) => {
      if (cb) cb('Imported successfully', false);
      return Promise.resolve();
    })
  }
}));

jest.mock('../../../../../features/common/services/actionService', () => ({
  ActionService: {
    toggleTheme: jest.fn().mockImplementation(() => Promise.resolve('light')),
    executeAction: jest.fn().mockImplementation((action: any) => {
      if (action === 'export-anki') return Promise.resolve({ success: true, count: 5 });
      return Promise.resolve({ success: true });
    })
  }
}));

describe('SettingsApp & initSettings (Production Preact UI)', () => {
  let container: HTMLDivElement;
  let mockStorage: Record<string, any>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);

    mockStorage = {
      extensionSettings: {
        showMarkerPopup: true,
        showLauncher: true,
        showCharts: true,
        showDailyFocus: true,
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
      theme: 'dark',
      fsrsCards: [
        { id: 'c1', title: 'Two Sum', algorithm: 'fsrs', state: 'review' }
      ],
      debugLogs: [{ msg: 'Test debug log' }]
    };

    (global as any).chrome = {
      storage: {
        local: {
          get: jest.fn().mockImplementation((keys: any, cb?: any) => {
            const result: Record<string, any> = {};
            if (Array.isArray(keys)) {
              keys.forEach((k) => {
                if (k in mockStorage) result[k] = mockStorage[k];
              });
            } else if (typeof keys === 'string') {
              if (keys in mockStorage) result[keys] = mockStorage[keys];
            } else if (!keys) {
              Object.assign(result, mockStorage);
            }
            if (typeof cb === 'function') cb(result);
            return Promise.resolve(result);
          }),
          set: jest.fn().mockImplementation((items: any, cb?: any) => {
            Object.assign(mockStorage, items);
            if (typeof cb === 'function') cb();
            return Promise.resolve();
          })
        }
      },
      runtime: {
        sendMessage: jest.fn().mockImplementation((_msg: any, cb?: any) => {
          if (typeof cb === 'function') cb({ success: true, dueCount: 3 });
        }),
        lastError: null
      }
    };

    (global as any).URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');
    (global as any).URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    render(null, container);
    container.remove();
    document.body.innerHTML = '';
    window.location.hash = '';
  });

  describe('Initialization & Tab Navigation', () => {
    it('renders all 6 navigation tabs and panels, defaulting to notifications', async () => {
      await act(async () => {
        render(h(SettingsApp, {}), container);
        await Promise.resolve();
      });

      const tabs = container.querySelectorAll('.nav-tab');
      expect(tabs.length).toBe(6);

      const panels = container.querySelectorAll('.tab-panel');
      expect(panels.length).toBe(6);

      // Default tab notifications is active
      const notifPanel = container.querySelector('#panel-notifications');
      expect(notifPanel?.classList.contains('active')).toBe(true);

      const dataPanel = container.querySelector('#panel-data');
      expect(dataPanel?.classList.contains('active')).toBe(false);
    });

    it('switches active tab when nav tab buttons are clicked', async () => {
      await act(async () => {
        render(h(SettingsApp, {}), container);
        await Promise.resolve();
      });

      const dataTabBtn = container.querySelector('#tab-btn-data') as HTMLButtonElement;
      expect(dataTabBtn).not.toBeNull();

      await act(async () => {
        dataTabBtn.click();
        await Promise.resolve();
      });

      expect(container.querySelector('#panel-data')?.classList.contains('active')).toBe(true);
      expect(container.querySelector('#panel-notifications')?.classList.contains('active')).toBe(false);

      // Switch to about tab
      const aboutTabBtn = container.querySelector('#tab-btn-about') as HTMLButtonElement;
      await act(async () => {
        aboutTabBtn.click();
        await Promise.resolve();
      });

      expect(container.querySelector('#panel-about')?.classList.contains('active')).toBe(true);
      expect(container.querySelector('#panel-data')?.classList.contains('active')).toBe(false);
    });

    it('sets initial tab from initialTab prop', async () => {
      await act(async () => {
        render(h(SettingsApp, { initialTab: 'developer' }), container);
        await Promise.resolve();
      });

      expect(container.querySelector('#panel-developer')?.classList.contains('active')).toBe(true);
      expect(container.querySelector('#panel-notifications')?.classList.contains('active')).toBe(false);
    });

    it('initSettings boots SettingsApp into root element', async () => {
      const root = document.createElement('div');
      root.id = 'root';
      document.body.appendChild(root);

      await act(async () => {
        initSettings();
        await Promise.resolve();
      });

      expect(root.querySelector('.settings-layout')).not.toBeNull();
      expect(root.querySelector('#status-toast')).not.toBeNull();
    });
  });

  describe('Theme Management', () => {
    it('toggles theme when theme toggle button is clicked', async () => {
      await act(async () => {
        render(h(SettingsApp, {}), container);
        await Promise.resolve();
      });

      const themeBtn = container.querySelector('#theme-toggle-btn') as HTMLButtonElement;
      expect(themeBtn).not.toBeNull();

      await act(async () => {
        themeBtn.click();
        await Promise.resolve();
      });

      expect(ActionService.toggleTheme).toHaveBeenCalled();
    });
  });

  describe('Notification Settings', () => {
    it('toggles master notifications switch and updates storage', async () => {
      await act(async () => {
        render(h(SettingsApp, {}), container);
        await Promise.resolve();
      });

      const notifToggle = container.querySelector('#toggle-notifications') as HTMLInputElement;
      expect(notifToggle).not.toBeNull();

      await act(async () => {
        notifToggle.click();
        await Promise.resolve();
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSettings: expect.objectContaining({ enabled: false })
        })
      );
    });

    it('changes notification interval and displays custom input when custom selected', async () => {
      await act(async () => {
        render(h(SettingsApp, {}), container);
        await Promise.resolve();
      });

      const intervalSelect = container.querySelector('#notification-interval') as HTMLSelectElement;
      expect(intervalSelect).not.toBeNull();

      await act(async () => {
        intervalSelect.value = 'custom';
        intervalSelect.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();
      });

      const customContainer = container.querySelector('#custom-interval-container');
      expect(customContainer?.classList.contains('hide-panel')).toBe(false);

      const customInput = container.querySelector('#custom-interval-input') as HTMLInputElement;
      expect(customInput).not.toBeNull();

      await act(async () => {
        customInput.value = '45';
        customInput.dispatchEvent(new Event('input', { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSettings: expect.objectContaining({ frequency: '45' })
        })
      );
    });

    it('toggles sticky notification and quiet hours', async () => {
      await act(async () => {
        render(h(SettingsApp, {}), container);
        await Promise.resolve();
      });

      const stickyToggle = container.querySelector('#toggle-sticky-notification') as HTMLInputElement;
      await act(async () => {
        stickyToggle.click();
        await Promise.resolve();
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSettings: expect.objectContaining({ sticky: false })
        })
      );

      const quietToggle = container.querySelector('#toggle-quiet-hours') as HTMLInputElement;
      await act(async () => {
        quietToggle.click();
        await Promise.resolve();
      });

      const quietContainer = container.querySelector('#quiet-hours-container');
      expect(quietContainer?.classList.contains('hide-panel')).toBe(false);
    });

    it('toggles weekly digest and badge due count', async () => {
      await act(async () => {
        render(h(SettingsApp, {}), container);
        await Promise.resolve();
      });

      const weeklyDigestToggle = container.querySelector('#toggle-weekly-digest') as HTMLInputElement;
      await act(async () => {
        weeklyDigestToggle.click();
        await Promise.resolve();
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSettings: expect.objectContaining({ weeklyDigest: false })
        })
      );

      const badgeToggle = container.querySelector('#toggle-badge-due-count') as HTMLInputElement;
      await act(async () => {
        badgeToggle.click();
        await Promise.resolve();
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSettings: expect.objectContaining({ badgeDueCount: false })
        })
      );
    });
  });

  describe('Highlighter Settings', () => {
    it('toggles marker popup and algo launcher switches', async () => {
      await act(async () => {
        render(h(SettingsApp, { initialTab: 'highlighter' }), container);
        await Promise.resolve();
      });

      const markerToggle = container.querySelector('#toggle-marker-popup') as HTMLInputElement;
      await act(async () => {
        markerToggle.click();
        await Promise.resolve();
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          extensionSettings: expect.objectContaining({ showMarkerPopup: false })
        })
      );

      const launcherToggle = container.querySelector('#toggle-algo-launcher') as HTMLInputElement;
      await act(async () => {
        launcherToggle.click();
        await Promise.resolve();
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          extensionSettings: expect.objectContaining({ showLauncher: false })
        })
      );
    });
  });

  describe('Data Management & Backup', () => {
    it('calls BackupManager.exportBackup when export button clicked', async () => {
      await act(async () => {
        render(h(SettingsApp, { initialTab: 'data' }), container);
        await Promise.resolve();
      });

      const exportBtn = container.querySelector('#settings-export-btn') as HTMLButtonElement;
      expect(exportBtn).not.toBeNull();

      await act(async () => {
        exportBtn.click();
        await Promise.resolve();
      });

      expect(BackupManager.exportBackup).toHaveBeenCalled();
    });

    it('triggers BackupManager.importBackup when file is selected', async () => {
      await act(async () => {
        render(h(SettingsApp, { initialTab: 'data' }), container);
        await Promise.resolve();
      });

      const importFileInput = container.querySelector('#settings-import-file') as HTMLInputElement;
      expect(importFileInput).not.toBeNull();

      const mockFile = new File(['{"cards":[]}'], 'backup.json', { type: 'application/json' });
      Object.defineProperty(importFileInput, 'files', {
        value: [mockFile],
        writable: true
      });

      await act(async () => {
        importFileInput.dispatchEvent(new Event('change', { bubbles: true }));
        await Promise.resolve();
      });

      expect(BackupManager.importBackup).toHaveBeenCalledWith(mockFile, expect.any(Function));
    });

    it('calls ActionService.executeAction when Anki export button is clicked', async () => {
      await act(async () => {
        render(h(SettingsApp, { initialTab: 'data' }), container);
        await Promise.resolve();
      });

      const ankiExportBtn = container.querySelector('#settings-anki-export-btn') as HTMLButtonElement;
      expect(ankiExportBtn).not.toBeNull();

      await act(async () => {
        ankiExportBtn.click();
        await Promise.resolve();
      });

      expect(ActionService.executeAction).toHaveBeenCalledWith('export-anki');
    });
  });

  describe('Developer Mode & Diagnostics', () => {
    it('toggles developerMode and expands dev actions container', async () => {
      await act(async () => {
        render(h(SettingsApp, { initialTab: 'developer' }), container);
        await Promise.resolve();
      });

      const devToggle = container.querySelector('#toggle-dev-mode') as HTMLInputElement;
      expect(devToggle).not.toBeNull();

      // Initially dev actions container hidden
      const devActions = container.querySelector('#dev-actions-container');
      expect(devActions?.classList.contains('hide-panel')).toBe(true);

      await act(async () => {
        devToggle.click();
        await Promise.resolve();
      });

      expect(devActions?.classList.contains('hide-panel')).toBe(false);
    });

    it('sends test notification message when test button is clicked', async () => {
      await act(async () => {
        render(h(SettingsApp, { initialTab: 'developer' }), container);
        await Promise.resolve();
      });

      const devToggle = container.querySelector('#toggle-dev-mode') as HTMLInputElement;
      await act(async () => {
        devToggle.click();
        await Promise.resolve();
      });

      const testNotifBtn = container.querySelector('#settings-test-notification-btn') as HTMLButtonElement;
      expect(testNotifBtn).not.toBeNull();

      await act(async () => {
        testNotifBtn.click();
        await Promise.resolve();
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'send_test_notification' }
      );
    });

    it('sends test summary notification message when summary button is clicked', async () => {
      await act(async () => {
        render(h(SettingsApp, { initialTab: 'developer' }), container);
        await Promise.resolve();
      });

      const devToggle = container.querySelector('#toggle-dev-mode') as HTMLInputElement;
      await act(async () => {
        devToggle.click();
        await Promise.resolve();
      });

      const testSummaryBtn = container.querySelector('#settings-test-summary-notification-btn') as HTMLButtonElement;
      expect(testSummaryBtn).not.toBeNull();

      await act(async () => {
        testSummaryBtn.click();
        await Promise.resolve();
      });

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        { action: 'send_test_summary_notification' }
      );
    });
  });

  describe('About Panel & Rating Link', () => {
    it('renders store review link with correct browser target url and title', async () => {
      await act(async () => {
        render(h(SettingsApp, { initialTab: 'about' }), container);
        await Promise.resolve();
      });

      const rateLink = container.querySelector('#about-rate-store-btn') as HTMLAnchorElement;
      expect(rateLink).not.toBeNull();
      expect(rateLink.href).toContain(BROWSER_CONFIG.reviewUrl);
      expect(rateLink.title).toContain(BROWSER_CONFIG.storeName);
    });
  });

  describe('Toast Notifications in Settings', () => {
    it('displays status toast reactively when settings are saved', async () => {
      await act(async () => {
        render(h(SettingsApp, { initialTab: 'notifications' }), container);
        await Promise.resolve();
      });

      const notifToggle = container.querySelector('#toggle-notifications') as HTMLInputElement;
      await act(async () => {
        notifToggle.click();
        await Promise.resolve();
      });

      const toast = container.querySelector('#status-toast');
      expect(toast).not.toBeNull();
      expect(toast?.textContent).toBe('Notification settings saved');
      expect(toast?.className).toContain('show');
    });
  });
});
