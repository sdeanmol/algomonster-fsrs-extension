/**
 * @file features/common/settings/settings.ts
 * @context Options & Dedicated Settings Hub Tab
 * @description Controller for the AlgoRecall Settings & Management Hub.
 * Manages notification schedules, in-page overlay switches, JSON backup/restore,
 * Anki deck exchange, developer diagnostics, and browser theme preferences.
 */

import { Logger } from '@common/logger';
import { UIUtils } from '../utils/uiUtils';
import { CatchAndLog, withErrorHandling } from '../../../decorators';
import { StorageData, NotificationSettings, ExtensionSettings, Card } from '../../../types/domain';
import { DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_EXTENSION_SETTINGS } from '../constants';
import { BROWSER_CONFIG } from '../browserConfig';
import { BackupManager } from '../data/backupManager';
import { ActionService } from '../services/actionService';

/**
 * Extended notification preferences including legacy and UI convenience keys.
 */
export interface FullNotificationSettings extends NotificationSettings {
    sticky?: boolean;
    weeklyDigest?: boolean;
    badgeDueCount?: boolean;
    customInterval?: number;
}

/**
 * Controller class coordinating the unified AlgoRecall Settings Hub.
 */
export class SettingsController {
    private toastTimeout: ReturnType<typeof setTimeout> | null = null;

    /**
     * DOM references cached during initialization.
     */
    dom: {
        // Tabs
        tabs: NodeListOf<HTMLButtonElement>;
        panels: NodeListOf<HTMLElement>;

        // Theme
        themeToggleBtn: HTMLElement | null;

        // Notifications
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

        // Highlighter & Tools
        toggleMarker: HTMLInputElement | null;
        toggleLauncher: HTMLInputElement | null;

        // Data & Anki
        exportBtn: HTMLElement | null;
        importFile: HTMLInputElement | null;
        importLabel: HTMLElement | null;
        ankiExportBtn: HTMLElement | null;

        // Developer & General
        toggleShowCharts: HTMLInputElement | null;
        toggleDailyFocus: HTMLInputElement | null;
        toggleDevMode: HTMLInputElement | null;
        devActionsContainer: HTMLElement | null;
        testNotificationBtn: HTMLElement | null;
        testSummaryBtn: HTMLElement | null;
        exportDebugLogsBtn: HTMLElement | null;

        // About & Feedback
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

    /**
     * Initializes the settings dashboard, registers event listeners, and loads current settings.
     */
    @CatchAndLog('SettingsController', 'Error initializing settings hub')
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

    /**
     * Binds tab switching clicks and manages ARIA accessibility attributes.
     */
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

    /**
     * Reads window URL hash and sets initial active tab.
     */
    private handleUrlHash(): void {
        const hash = window.location.hash.replace('#', '');
        if (hash) {
            this.setActiveTab(hash);
        } else {
            this.setActiveTab('notifications');
        }
    }

    /**
     * Switches the active tab panel.
     */
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

    /**
     * Loads stored settings and reflects values in UI controls.
     */
    @CatchAndLog('SettingsController', 'Error loading settings from storage')
    async loadAllSettings(): Promise<void> {
        const result = (await chrome.storage.local.get([
            'extensionSettings',
            'notificationSettings',
            'weeklySummaryEnabled'
        ])) as StorageData & {
            notificationSettings?: NotificationSettings & FullNotificationSettings;
            weeklySummaryEnabled?: boolean;
        };

        const extSettings = (result.extensionSettings || {}) as ExtensionSettings;
        const notifSettings = (result.notificationSettings || { ...DEFAULT_NOTIFICATION_SETTINGS }) as NotificationSettings & FullNotificationSettings;
        const weeklySummaryEnabled = result.weeklySummaryEnabled !== false;

        // Populate notification controls
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

        // Populate highlighter & launcher controls
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

        // Populate appearance & developer controls
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

    /**
     * Binds dark/light theme toggle.
     */
    private bindThemeToggle(): void {
        this.dom.themeToggleBtn?.addEventListener('click', withErrorHandling(async () => {
            await ActionService.toggleTheme();
        }, 'SettingsController', 'Error toggling theme'));
    }

    /**
     * Binds notification preferences event listeners and auto-saves changes.
     */
    private bindNotificationControls(): void {
        const saveNotifSettings = withErrorHandling(async () => {
            const isEnabled = this.dom.toggleNotifications?.checked ?? true;
            const isSticky = this.dom.toggleSticky?.checked ?? true;
            const isQuiet = this.dom.toggleQuietHours?.checked ?? false;
            const qStart = this.dom.quietHoursStart?.value || '23:00';
            const qEnd = this.dom.quietHoursEnd?.value || '07:00';
            const isWeekly = this.dom.toggleWeeklyDigest?.checked ?? true;
            const isBadge = this.dom.toggleBadgeDueCount?.checked ?? true;

            // Sync ARIA attributes on toggles
            this.dom.toggleNotifications?.setAttribute('aria-checked', isEnabled.toString());
            this.dom.toggleSticky?.setAttribute('aria-checked', isSticky.toString());
            this.dom.toggleQuietHours?.setAttribute('aria-checked', isQuiet.toString());
            this.dom.toggleWeeklyDigest?.setAttribute('aria-checked', isWeekly.toString());
            this.dom.toggleBadgeDueCount?.setAttribute('aria-checked', isBadge.toString());

            if (isEnabled && typeof Notification !== 'undefined' && Notification.permission === 'default') {
                Notification.requestPermission().catch(() => {});
            }

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
                    chrome.runtime.sendMessage({ action: 'toggle_weekly_summary', enabled: isWeekly }, () => {
                        if (chrome.runtime?.lastError) { /* ignore */ }
                    });
                } catch {
                    // ignore messaging errors
                }
            }

            this.showToast('Notification settings saved');
        }, 'SettingsController', 'Error saving notification settings');

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

    /**
     * Binds in-page overlay switches (Floating Marker Menu, Problem Tracker Launcher).
     */
    private bindHighlighterControls(): void {
        this.dom.toggleMarker?.addEventListener('change', withErrorHandling(async () => {
            const res = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
            const settings = res.extensionSettings || { ...DEFAULT_EXTENSION_SETTINGS };
            settings.showMarkerPopup = this.dom.toggleMarker?.checked ?? true;
            await chrome.storage.local.set({ extensionSettings: settings });
            this.showToast(`Floating marker ${settings.showMarkerPopup ? 'enabled' : 'disabled'}`);
        }, 'SettingsController', 'Error saving marker setting'));

        this.dom.toggleLauncher?.addEventListener('change', withErrorHandling(async () => {
            const res = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
            const settings = res.extensionSettings || { ...DEFAULT_EXTENSION_SETTINGS };
            settings.showLauncher = this.dom.toggleLauncher?.checked ?? true;
            await chrome.storage.local.set({ extensionSettings: settings });
            this.showToast(`Problem tracker launcher ${settings.showLauncher ? 'enabled' : 'disabled'}`);
        }, 'SettingsController', 'Error saving launcher setting'));
    }

    /**
     * Binds backup export/restore and Anki export/import interactions.
     */
    private bindDataControls(): void {
        // Backup Export
        this.dom.exportBtn?.addEventListener('click', withErrorHandling(async () => {
            await BackupManager.exportBackup();
            this.showToast('Backup export initiated');
        }, 'SettingsController', {
            contextMessage: 'Error exporting backup',
            fallback: () => { this.showToast('Failed to export backup', true); }
        }));

        // Backup Restore
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

        // Anki Export
        this.dom.ankiExportBtn?.addEventListener('click', withErrorHandling(async () => {
            const result = await ActionService.executeAction('export-anki');
            if (result.success) {
                this.showToast('Anki deck exported successfully');
            } else {
                this.showToast(result.error || 'No cards to export', true);
            }
        }, 'SettingsController', {
            contextMessage: 'Error exporting Anki cards',
            fallback: () => { this.showToast('Failed to export Anki deck', true); }
        }));
    }

    /**
     * Binds developer diagnostics and chart visibility controls.
     */
    private bindDeveloperControls(): void {
        this.dom.toggleShowCharts?.addEventListener('change', withErrorHandling(async () => {
            const res = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
            const settings = res.extensionSettings || { ...DEFAULT_EXTENSION_SETTINGS };
            settings.showCharts = this.dom.toggleShowCharts?.checked ?? true;
            await chrome.storage.local.set({ extensionSettings: settings });
            this.showToast(`Popup activity charts ${settings.showCharts ? 'enabled' : 'hidden'}`);
        }, 'SettingsController', 'Error updating chart settings'));

        this.dom.toggleDailyFocus?.addEventListener('change', withErrorHandling(async () => {
            const res = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
            const settings = res.extensionSettings || { ...DEFAULT_EXTENSION_SETTINGS };
            settings.showDailyFocus = this.dom.toggleDailyFocus?.checked ?? true;
            await chrome.storage.local.set({ extensionSettings: settings });
            this.showToast(`Popup daily focus ${settings.showDailyFocus ? 'enabled' : 'hidden'}`);
        }, 'SettingsController', 'Error updating daily focus settings'));

        this.dom.toggleDevMode?.addEventListener('change', withErrorHandling(async () => {
            const isDev = this.dom.toggleDevMode?.checked ?? false;
            const res = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
            const settings = res.extensionSettings || { ...DEFAULT_EXTENSION_SETTINGS };
            settings.developerMode = isDev;
            await chrome.storage.local.set({ extensionSettings: settings });
            this.updateDevModeDisplay(isDev);
            this.showToast(`Developer mode ${isDev ? 'enabled' : 'disabled'}`);
        }, 'SettingsController', 'Error saving developer mode'));

        this.dom.testNotificationBtn?.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'send_test_notification' });
            this.showToast('Test notification dispatched');
        });

        this.dom.testSummaryBtn?.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'send_test_summary_notification' });
            this.showToast('Test summary notification dispatched');
        });

        this.dom.exportDebugLogsBtn?.addEventListener('click', withErrorHandling(async () => {
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
        }, 'SettingsController', {
            contextMessage: 'Error exporting debug logs',
            fallback: () => { this.showToast('Failed to export debug logs', true); }
        }));
    }

    /**
     * Updates UI visibility for developer features.
     */
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

    /**
     * Configures the browser-specific store review URL in the About section.
     */
    private setupRatingLink(): void {
        if (this.dom.rateStoreBtn) {
            this.dom.rateStoreBtn.href = BROWSER_CONFIG.reviewUrl;
            this.dom.rateStoreBtn.title = `Rate AlgoRecall on ${BROWSER_CONFIG.storeName}`;
        }
    }

    /**
     * Displays a temporary modern toast feedback banner.
     */
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

/**
 * Bootstrap entry function creating and initializing the settings controller on DOM readiness.
 */
function initSettings(): void {
    withErrorHandling(() => {
        const controller = new SettingsController();
        controller.init().catch((err) => {
            Logger.error('SettingsController', 'Uncaught error during bootstrap', { err });
        });
        (window as unknown as { settingsController?: SettingsController }).settingsController = controller;
    }, 'SettingsController', 'Error instantiating SettingsController')();
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSettings);
    } else {
        initSettings();
    }
}
