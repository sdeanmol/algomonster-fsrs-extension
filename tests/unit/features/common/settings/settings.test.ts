import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { BackupManager } from '../../../../../features/common/data/backupManager';
import { ActionService } from '../../../../../features/common/services/actionService';
import { BROWSER_CONFIG } from '../../../../../features/common/browserConfig';
import { StorageData, NotificationSettings, Card } from '../../../../../types/domain';
import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_EXTENSION_SETTINGS } from '../../../../../features/common/constants';
import { FullNotificationSettings, FullExtensionSettings } from '../../../../../features/common/settings/settings';

class SettingsController {
  private toastTimeout: ReturnType<typeof setTimeout> | null = null;

  dom: {
    tabs: NodeListOf<HTMLButtonElement>;
    panels: NodeListOf<HTMLElement>;
    themeToggleBtn: HTMLElement | null;
    toggleNotifications: HTMLInputElement | null;
    notificationInterval: HTMLSelectElement | null;
    customIntervalContainer: HTMLElement | null;
    customIntervalInput: HTMLInputElement | null;
    toggleSticky: HTMLInputElement | null;
    toggleQuietHours: HTMLInputElement | null;
    quietHoursContainer: HTMLElement | null;
    quietHoursStart: HTMLInputElement | null;
    quietHoursEnd: HTMLInputElement | null;
    toggleWeeklyDigest: HTMLInputElement | null;
    toggleBadgeDueCount: HTMLInputElement | null;
    devIntervalOption: HTMLElement | null;
    toggleMarker: HTMLInputElement | null;
    toggleLauncher: HTMLInputElement | null;
    exportBtn: HTMLElement | null;
    importFile: HTMLInputElement | null;
    importLabel: HTMLElement | null;
    ankiExportBtn: HTMLElement | null;
    ankiImportFile: HTMLInputElement | null;
    ankiImportLabel: HTMLElement | null;
    toggleShowCharts: HTMLInputElement | null;
    toggleDailyFocus: HTMLInputElement | null;
    toggleDevMode: HTMLInputElement | null;
    devActionsContainer: HTMLElement | null;
    testNotificationBtn: HTMLElement | null;
    testSummaryBtn: HTMLElement | null;
    exportDebugLogsBtn: HTMLElement | null;
    rateStoreBtn: HTMLAnchorElement | null;
    toast: HTMLElement | null;
  };

  constructor() {
    this.dom = {
      tabs: document.querySelectorAll('.nav-tab'),
      panels: document.querySelectorAll('.tab-panel'),
      themeToggleBtn: document.getElementById('theme-toggle-btn'),
      toggleNotifications: document.getElementById('toggle-notifications') as HTMLInputElement | null,
      notificationInterval: document.getElementById('notification-interval') as HTMLSelectElement | null,
      customIntervalContainer: document.getElementById('custom-interval-container'),
      customIntervalInput: document.getElementById('custom-interval-input') as HTMLInputElement | null,
      toggleSticky: document.getElementById('toggle-sticky-notification') as HTMLInputElement | null,
      toggleQuietHours: document.getElementById('toggle-quiet-hours') as HTMLInputElement | null,
      quietHoursContainer: document.getElementById('quiet-hours-container'),
      quietHoursStart: document.getElementById('quiet-hours-start') as HTMLInputElement | null,
      quietHoursEnd: document.getElementById('quiet-hours-end') as HTMLInputElement | null,
      toggleWeeklyDigest: document.getElementById('toggle-weekly-digest') as HTMLInputElement | null,
      toggleBadgeDueCount: document.getElementById('toggle-badge-due-count') as HTMLInputElement | null,
      devIntervalOption: document.getElementById('dev-interval-option'),
      toggleMarker: document.getElementById('toggle-marker-popup') as HTMLInputElement | null,
      toggleLauncher: document.getElementById('toggle-algo-launcher') as HTMLInputElement | null,
      exportBtn: document.getElementById('settings-export-btn'),
      importFile: document.getElementById('settings-import-file') as HTMLInputElement | null,
      importLabel: document.getElementById('settings-import-label'),
      ankiExportBtn: document.getElementById('settings-anki-export-btn'),
      ankiImportFile: document.getElementById('settings-anki-import-file') as HTMLInputElement | null,
      ankiImportLabel: document.getElementById('settings-anki-import-label'),
      toggleShowCharts: document.getElementById('toggle-show-charts') as HTMLInputElement | null,
      toggleDailyFocus: document.getElementById('toggle-daily-focus') as HTMLInputElement | null,
      toggleDevMode: document.getElementById('toggle-dev-mode') as HTMLInputElement | null,
      devActionsContainer: document.getElementById('dev-actions-container'),
      testNotificationBtn: document.getElementById('settings-test-notification-btn'),
      testSummaryBtn: document.getElementById('settings-test-summary-notification-btn'),
      exportDebugLogsBtn: document.getElementById('settings-export-debug-logs-btn'),
      rateStoreBtn: document.getElementById('about-rate-store-btn') as HTMLAnchorElement | null,
      toast: document.getElementById('status-toast')
    };
  }

  async init(): Promise<void> {
    this.bindTabNavigation();
    this.bindThemeToggle();
    this.bindNotificationControls();
    this.bindHighlighterControls();
    this.bindDataControls();
    this.bindDeveloperControls();
    this.setupRatingLink();
    await this.loadAllSettings();
    this.handleUrlHash();
  }

  private bindTabNavigation(): void {
    this.dom.tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        if (targetTab) {
          this.setActiveTab(targetTab);
        }
      });
    });

    window.addEventListener('hashchange', () => {
      this.handleUrlHash();
    });
  }

  private handleUrlHash(): void {
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      this.setActiveTab(hash);
    } else {
      this.setActiveTab('notifications');
    }
  }

  setActiveTab(tabId: string): void {
    let matchingTabFound = false;
    this.dom.tabs.forEach((tab) => {
      const isMatch = tab.dataset.tab === tabId;
      tab.classList.toggle('active', isMatch);
      tab.setAttribute('aria-selected', isMatch ? 'true' : 'false');
      if (isMatch) matchingTabFound = true;
    });

    this.dom.panels.forEach((panel) => {
      const isMatch = panel.id === `panel-${tabId}`;
      panel.classList.toggle('active', isMatch);
    });

    if (matchingTabFound && window.location.hash !== `#${tabId}`) {
      window.location.hash = tabId;
    }
  }

  async loadAllSettings(): Promise<void> {
    const result = (await chrome.storage.local.get([
      'extensionSettings',
      'notificationSettings',
      'weeklySummaryEnabled'
    ])) as StorageData & {
      notificationSettings?: NotificationSettings & FullNotificationSettings;
      weeklySummaryEnabled?: boolean;
    };

    const extSettings = (result.extensionSettings || {}) as FullExtensionSettings;
    const notifSettings = (result.notificationSettings || { ...DEFAULT_NOTIFICATION_SETTINGS }) as NotificationSettings & FullNotificationSettings;
    const weeklySummaryEnabled = result.weeklySummaryEnabled !== false;

    if (this.dom.toggleNotifications) {
      const isEnabled = notifSettings.enabled !== false;
      this.dom.toggleNotifications.checked = isEnabled;
      this.dom.toggleNotifications.setAttribute('aria-checked', isEnabled.toString());
    }

    if (this.dom.notificationInterval) {
      const freq = String(notifSettings.frequency || '60');
      const standardOptions = ['1', '15', '30', '60', '120', '360', '720', '1440'];
      if (standardOptions.includes(freq)) {
        this.dom.notificationInterval.value = freq;
        this.dom.customIntervalContainer?.classList.add('hide-panel');
      } else {
        this.dom.notificationInterval.value = 'custom';
        if (this.dom.customIntervalInput) {
          this.dom.customIntervalInput.value = notifSettings.customInterval ? String(notifSettings.customInterval) : (freq !== 'custom' ? freq : '60');
        }
        this.dom.customIntervalContainer?.classList.remove('hide-panel');
      }
    }

    if (this.dom.toggleSticky) {
      const isSticky = notifSettings.requireInteraction !== false && notifSettings.sticky !== false;
      this.dom.toggleSticky.checked = isSticky;
      this.dom.toggleSticky.setAttribute('aria-checked', isSticky.toString());
    }

    if (this.dom.toggleQuietHours) {
      const isQuiet = notifSettings.quietHoursEnabled === true;
      this.dom.toggleQuietHours.checked = isQuiet;
      this.dom.toggleQuietHours.setAttribute('aria-checked', isQuiet.toString());
      if (this.dom.quietHoursContainer) {
        this.dom.quietHoursContainer.classList.toggle('hide-panel', !isQuiet);
      }
    }

    if (this.dom.quietHoursStart) {
      this.dom.quietHoursStart.value = notifSettings.quietHoursStart || '23:00';
    }

    if (this.dom.quietHoursEnd) {
      this.dom.quietHoursEnd.value = notifSettings.quietHoursEnd || '07:00';
    }

    if (this.dom.toggleWeeklyDigest) {
      const isWeekly = weeklySummaryEnabled && notifSettings.weeklyDigest !== false;
      this.dom.toggleWeeklyDigest.checked = isWeekly;
      this.dom.toggleWeeklyDigest.setAttribute('aria-checked', isWeekly.toString());
    }

    if (this.dom.toggleBadgeDueCount) {
      const isBadge = notifSettings.badgeEnabled !== false && notifSettings.showDueBadge !== false && notifSettings.badgeDueCount !== false;
      this.dom.toggleBadgeDueCount.checked = isBadge;
      this.dom.toggleBadgeDueCount.setAttribute('aria-checked', isBadge.toString());
    }

    if (this.dom.toggleMarker) {
      const isMarker = extSettings.showMarkerPopup !== false;
      this.dom.toggleMarker.checked = isMarker;
      this.dom.toggleMarker.setAttribute('aria-checked', isMarker.toString());
    }

    if (this.dom.toggleLauncher) {
      const isLauncher = extSettings.showLauncher !== false;
      this.dom.toggleLauncher.checked = isLauncher;
      this.dom.toggleLauncher.setAttribute('aria-checked', isLauncher.toString());
    }

    if (this.dom.toggleShowCharts) {
      const isCharts = extSettings.showCharts !== false;
      this.dom.toggleShowCharts.checked = isCharts;
      this.dom.toggleShowCharts.setAttribute('aria-checked', isCharts.toString());
    }

    if (this.dom.toggleDailyFocus) {
      const isDailyFocus = extSettings.showDailyFocus !== false;
      this.dom.toggleDailyFocus.checked = isDailyFocus;
      this.dom.toggleDailyFocus.setAttribute('aria-checked', isDailyFocus.toString());
    }

    if (this.dom.toggleDevMode) {
      const isDev = extSettings.developerMode ?? false;
      this.dom.toggleDevMode.checked = isDev;
      this.dom.toggleDevMode.setAttribute('aria-checked', isDev.toString());
      this.updateDevModeDisplay(isDev);
    }
  }

  private bindThemeToggle(): void {
    this.dom.themeToggleBtn?.addEventListener('click', async () => {
      await ActionService.toggleTheme();
    });
  }

  private bindNotificationControls(): void {
    const saveNotifSettings = async () => {
      const isEnabled = this.dom.toggleNotifications?.checked ?? true;
      const isSticky = this.dom.toggleSticky?.checked ?? true;
      const isQuiet = this.dom.toggleQuietHours?.checked ?? false;
      const qStart = this.dom.quietHoursStart?.value || '23:00';
      const qEnd = this.dom.quietHoursEnd?.value || '07:00';
      const isWeekly = this.dom.toggleWeeklyDigest?.checked ?? true;
      const isBadge = this.dom.toggleBadgeDueCount?.checked ?? true;

      this.dom.toggleNotifications?.setAttribute('aria-checked', isEnabled.toString());
      this.dom.toggleSticky?.setAttribute('aria-checked', isSticky.toString());
      this.dom.toggleQuietHours?.setAttribute('aria-checked', isQuiet.toString());
      this.dom.toggleWeeklyDigest?.setAttribute('aria-checked', isWeekly.toString());
      this.dom.toggleBadgeDueCount?.setAttribute('aria-checked', isBadge.toString());

      const res = (await chrome.storage.local.get(['notificationSettings', 'weeklySummaryEnabled'])) as StorageData & {
        notificationSettings?: NotificationSettings & FullNotificationSettings;
        weeklySummaryEnabled?: boolean;
      };
      const current: NotificationSettings & FullNotificationSettings = (res.notificationSettings || { ...DEFAULT_NOTIFICATION_SETTINGS }) as FullNotificationSettings;

      let freq = this.dom.notificationInterval?.value || '60';
      if (freq === 'custom') {
        if (this.dom.customIntervalInput) {
          const customVal = parseInt(this.dom.customIntervalInput.value, 10);
          const validVal = !isNaN(customVal) && customVal > 0 ? customVal : 60;
          freq = String(validVal);
          current.customInterval = validVal;
        } else {
          freq = '60';
          current.customInterval = 60;
        }
      } else {
        current.customInterval = parseInt(freq, 10) || 60;
      }

      current.enabled = isEnabled;
      current.frequency = freq;
      current.requireInteraction = isSticky;
      current.sticky = isSticky;
      current.quietHoursEnabled = isQuiet;
      current.quietHoursStart = qStart;
      current.quietHoursEnd = qEnd;
      current.badgeEnabled = isBadge;
      current.showDueBadge = isBadge;
      current.badgeDueCount = isBadge;
      current.weeklyDigest = isWeekly;

      await chrome.storage.local.set({
        notificationSettings: current,
        weeklySummaryEnabled: isWeekly
      });

      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        try {
          chrome.runtime.sendMessage({ action: 'toggle_weekly_summary', enabled: isWeekly }, () => {});
        } catch {
          // ignore
        }
      }

      this.showToast('Notification settings saved');
    };

    this.dom.toggleNotifications?.addEventListener('change', saveNotifSettings);
    this.dom.toggleSticky?.addEventListener('change', saveNotifSettings);
    this.dom.toggleWeeklyDigest?.addEventListener('change', saveNotifSettings);
    this.dom.toggleBadgeDueCount?.addEventListener('change', saveNotifSettings);

    this.dom.notificationInterval?.addEventListener('change', () => {
      const isCustom = this.dom.notificationInterval?.value === 'custom';
      this.dom.customIntervalContainer?.classList.toggle('hide-panel', !isCustom);
      if (isCustom && this.dom.customIntervalInput && !this.dom.customIntervalInput.value) {
        this.dom.customIntervalInput.value = '60';
      }
      saveNotifSettings();
    });

    this.dom.customIntervalInput?.addEventListener('change', saveNotifSettings);
    this.dom.customIntervalInput?.addEventListener('input', saveNotifSettings);

    this.dom.toggleQuietHours?.addEventListener('change', () => {
      const isQuiet = this.dom.toggleQuietHours?.checked ?? false;
      this.dom.quietHoursContainer?.classList.toggle('hide-panel', !isQuiet);
      saveNotifSettings();
    });

    this.dom.quietHoursStart?.addEventListener('change', saveNotifSettings);
    this.dom.quietHoursStart?.addEventListener('input', saveNotifSettings);
    this.dom.quietHoursEnd?.addEventListener('change', saveNotifSettings);
    this.dom.quietHoursEnd?.addEventListener('input', saveNotifSettings);
  }

  private bindHighlighterControls(): void {
    this.dom.toggleMarker?.addEventListener('change', async () => {
      const res = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
      const settings = res.extensionSettings || { ...DEFAULT_EXTENSION_SETTINGS };
      settings.showMarkerPopup = this.dom.toggleMarker?.checked ?? true;
      await chrome.storage.local.set({ extensionSettings: settings });
      this.showToast(`Floating marker ${settings.showMarkerPopup ? 'enabled' : 'disabled'}`);
    });

    this.dom.toggleLauncher?.addEventListener('change', async () => {
      const res = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
      const settings = res.extensionSettings || { ...DEFAULT_EXTENSION_SETTINGS };
      settings.showLauncher = this.dom.toggleLauncher?.checked ?? true;
      await chrome.storage.local.set({ extensionSettings: settings });
      this.showToast(`Problem tracker launcher ${settings.showLauncher ? 'enabled' : 'disabled'}`);
    });
  }

  private bindDataControls(): void {
    this.dom.exportBtn?.addEventListener('click', async () => {
      await BackupManager.exportBackup();
      this.showToast('Backup export initiated');
    });

    const handleRestore = (file: File) => {
      BackupManager.importBackup(file, (msg: string, isError?: boolean) => {
        this.showToast(msg, isError ?? false);
        if (this.dom.importFile) this.dom.importFile.value = '';
      });
    };

    this.dom.importFile?.addEventListener('change', (e: Event) => {
      const input = e.target as HTMLInputElement;
      if (input.files && input.files[0]) {
        handleRestore(input.files[0]);
      }
    });

    this.dom.importLabel?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.dom.importFile?.click();
      }
    });

    this.dom.ankiExportBtn?.addEventListener('click', async () => {
      const result = await ActionService.executeAction('export-anki');
      if (result.success) {
        this.showToast('Anki deck exported successfully');
      } else {
        this.showToast(result.error || 'No cards to export', true);
      }
    });

    this.dom.ankiImportFile?.addEventListener('change', async (e: Event) => {
      const input = e.target as HTMLInputElement;
      if (!input.files || !input.files[0]) return;
      const file = input.files[0];
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

      if (lines.length === 0) {
        this.showToast('Import file is empty', true);
        return;
      }

      const res = (await chrome.storage.local.get(['fsrsCards'])) as StorageData;
      const existingCards: Card[] = res.fsrsCards || [];
      let importedCount = 0;

      for (const line of lines) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const title = parts[0].trim();
          const approach = parts[1].trim();
          const tags = parts[2] ? parts[2].split(',').map((t) => t.trim()) : ['Anki'];

          const newCard: Card = {
            id: `card_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            problemTitle: title,
            problemUrl: '',
            approach: approach,
            tags: tags,
            due: Date.now(),
            stability: 1,
            difficulty: 5,
            elapsed_days: 0,
            scheduled_days: 0,
            learning_steps: 0,
            reps: 0,
            lapses: 0,
            state: 0,
            historyLog: []
          };
          existingCards.push(newCard);
          importedCount++;
        }
      }

      if (importedCount > 0) {
        await chrome.storage.local.set({ fsrsCards: existingCards });
        this.showToast(`Imported ${importedCount} card(s) from Anki`);
      } else {
        this.showToast('No valid tab-separated cards found in file', true);
      }
      input.value = '';
    });

    this.dom.ankiImportLabel?.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.dom.ankiImportFile?.click();
      }
    });
  }

  private bindDeveloperControls(): void {
    this.dom.toggleShowCharts?.addEventListener('change', async () => {
      const res = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
      const settings = res.extensionSettings || { ...DEFAULT_EXTENSION_SETTINGS };
      settings.showCharts = this.dom.toggleShowCharts?.checked ?? true;
      await chrome.storage.local.set({ extensionSettings: settings });
      this.showToast(`Popup activity charts ${settings.showCharts ? 'enabled' : 'hidden'}`);
    });

    this.dom.toggleDailyFocus?.addEventListener('change', async () => {
      const res = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
      const settings = (res.extensionSettings || { ...DEFAULT_EXTENSION_SETTINGS }) as FullExtensionSettings;
      settings.showDailyFocus = this.dom.toggleDailyFocus?.checked ?? true;
      await chrome.storage.local.set({ extensionSettings: settings });
      this.showToast(`Popup daily focus ${settings.showDailyFocus ? 'enabled' : 'hidden'}`);
    });

    this.dom.toggleDevMode?.addEventListener('change', async () => {
      const isDev = this.dom.toggleDevMode?.checked ?? false;
      const res = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
      const settings = res.extensionSettings || { ...DEFAULT_EXTENSION_SETTINGS };
      settings.developerMode = isDev;
      await chrome.storage.local.set({ extensionSettings: settings });
      this.updateDevModeDisplay(isDev);
      this.showToast(`Developer mode ${isDev ? 'enabled' : 'disabled'}`);
    });

    this.dom.testNotificationBtn?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'send_test_notification' });
      this.showToast('Test notification dispatched');
    });

    this.dom.testSummaryBtn?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'send_test_summary_notification' });
      this.showToast('Test summary notification dispatched');
    });

    this.dom.exportDebugLogsBtn?.addEventListener('click', async () => {
      const result = (await chrome.storage.local.get(['debugLogs'])) as StorageData;
      const logs = result.debugLogs || [];
      const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `algorecall-debug-logs-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.showToast('Debug logs exported');
    });
  }

  private updateDevModeDisplay(isDev: boolean): void {
    this.dom.devActionsContainer?.classList.toggle('hide-panel', !isDev);
    if (this.dom.devIntervalOption) {
      if (isDev) {
        this.dom.devIntervalOption.removeAttribute('hidden');
        this.dom.devIntervalOption.removeAttribute('disabled');
      } else {
        this.dom.devIntervalOption.setAttribute('hidden', 'true');
        this.dom.devIntervalOption.setAttribute('disabled', 'true');
      }
    }
  }

  private setupRatingLink(): void {
    if (this.dom.rateStoreBtn) {
      this.dom.rateStoreBtn.href = BROWSER_CONFIG.reviewUrl;
      this.dom.rateStoreBtn.title = `Rate AlgoRecall on ${BROWSER_CONFIG.storeName}`;
    }
  }

  showToast(message: string, isError: boolean = false): void {
    if (!this.dom.toast) return;
    if (this.toastTimeout) clearTimeout(this.toastTimeout);

    this.dom.toast.textContent = message;
    this.dom.toast.className = `toast modern-toast show ${isError ? 'error' : 'success'}`;

    this.toastTimeout = setTimeout(() => {
      if (this.dom.toast) {
        this.dom.toast.classList.remove('show');
      }
    }, 3000);
  }
}

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
