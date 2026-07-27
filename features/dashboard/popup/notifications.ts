import { DashboardComponent, DashboardCoordinator } from './DashboardComponent';
import { StorageData, NotificationSettings, MessageResponse } from '../../../types/domain';

/**
 * @class NotificationsComponent
 * @extends DashboardComponent
 * @description Controls notification and reminder configuration panels inside the dashboard popup.
 * Checks active browser notification permissions, binds listeners to toggles (enable, snooze interval),
 * and routes test notifications through runtime messages to the background script.
 */
export class NotificationsComponent extends DashboardComponent {
    constructor(coordinator: DashboardCoordinator) {
        super(coordinator);
    }

    /**
     * Required implementation of abstract load from DashboardComponent
     */
    async load(): Promise<void> {
        await this.loadSettings();
        this.checkPermissions();
    }

    /**
     * Checks Chrome/HTML Notification permissions, toggling permission warning banners
     * and adjusting action button visibility appropriately.
     */
    checkPermissions(): void {
        if (typeof Notification !== 'undefined') {
            const warningBanner = document.getElementById('permission-warning-banner');
            const enableBtn = document.getElementById('enable-notifications-btn');
            if (!warningBanner) return;

            if (Notification.permission !== 'granted') {
                warningBanner.classList.remove('hide-panel');
                if (Notification.permission === 'denied') {
                    if (enableBtn) enableBtn.style.display = 'none';
                    const spanEl = warningBanner.querySelector('span');
                    if (spanEl) spanEl.innerText = "⚠️ Notifications blocked. Enable them in settings for reminders.";
                } else {
                    if (enableBtn) enableBtn.style.display = 'inline-block';
                    const spanEl = warningBanner.querySelector('span');
                    if (spanEl) spanEl.innerText = "⚠️ Reminders work best with notifications enabled.";
                }
            } else {
                warningBanner.classList.add('hide-panel');
            }
        }
    }

    /**
     * Initializes notification toggles, frequency select dropdowns, and test triggers.
     * Sets up local change listeners to sync preferences back to storage databases.
     */
    async loadSettings(): Promise<void> {
        const notifToggle = document.getElementById('toggle-notifications') as HTMLInputElement | null;
        const notifInterval = document.getElementById('notification-interval') as HTMLSelectElement | null;
        const customIntervalContainer = document.getElementById('custom-interval-container');
        const customIntervalInput = document.getElementById('custom-interval-input') as HTMLInputElement | null;
        const notifStickyToggle = (document.getElementById('toggle-sticky-notification') || document.getElementById('toggle-require-interaction')) as HTMLInputElement | null;
        const quietToggle = document.getElementById('toggle-quiet-hours') as HTMLInputElement | null;
        const quietContainer = document.getElementById('quiet-hours-container') || document.getElementById('quiet-hours-inputs');
        const quietStart = (document.getElementById('quiet-hours-start') || document.getElementById('quiet-start')) as HTMLInputElement | null;
        const quietEnd = (document.getElementById('quiet-hours-end') || document.getElementById('quiet-end')) as HTMLInputElement | null;

        const updateNotificationUI = (settings: NotificationSettings) => {
            if (!notifToggle) return;
            notifToggle.checked = settings.enabled !== false;
            if (notifStickyToggle) {
                notifStickyToggle.checked = settings.requireInteraction !== false;
            }
            if (quietToggle) {
                quietToggle.checked = settings.quietHoursEnabled === true;
                if (quietContainer) quietContainer.classList.toggle('hide-panel', !settings.quietHoursEnabled);
            }
            if (quietStart && settings.quietHoursStart) quietStart.value = settings.quietHoursStart;
            if (quietEnd && settings.quietHoursEnd) quietEnd.value = settings.quietHoursEnd;

            const freqStr = settings.frequency || '60';
            const standardOptions = ['1', '15', '30', '60', '120', '360', '720', '1440'];
            if (notifInterval) {
                if (standardOptions.includes(freqStr)) {
                    notifInterval.value = freqStr;
                    if (customIntervalContainer) customIntervalContainer.classList.add('hide-panel');
                } else {
                    notifInterval.value = 'custom';
                    if (customIntervalContainer) customIntervalContainer.classList.remove('hide-panel');
                    if (customIntervalInput) customIntervalInput.value = freqStr;
                }
            }
        };

        try {
            const result = (await chrome.storage.local.get(['notificationSettings'])) as StorageData & { notificationSettings?: NotificationSettings };
            const settings = result.notificationSettings || {
                enabled: true,
                frequency: '60',
                priority: '2',
                requireInteraction: true
            };
            updateNotificationUI(settings);
        } catch (error) {
            console.error("Error loading notification settings:", error);
        }
    }

    /**
     * Binds event listeners to enable button, interval inputs, and test triggers.
     */
    bindEvents(): void {
        const enableBtn = document.getElementById('enable-notifications-btn');
        const notifToggle = document.getElementById('toggle-notifications') as HTMLInputElement | null;
        const notifInterval = document.getElementById('notification-interval') as HTMLSelectElement | null;
        const customIntervalContainer = document.getElementById('custom-interval-container');
        const customIntervalInput = document.getElementById('custom-interval-input') as HTMLInputElement | null;
        const notifStickyToggle = (document.getElementById('toggle-sticky-notification') || document.getElementById('toggle-require-interaction')) as HTMLInputElement | null;
        const quietToggle = document.getElementById('toggle-quiet-hours') as HTMLInputElement | null;
        const quietContainer = document.getElementById('quiet-hours-container') || document.getElementById('quiet-hours-inputs');
        const quietStart = (document.getElementById('quiet-hours-start') || document.getElementById('quiet-start')) as HTMLInputElement | null;
        const quietEnd = (document.getElementById('quiet-hours-end') || document.getElementById('quiet-end')) as HTMLInputElement | null;
        const testNotifBtn = document.getElementById('test-notification-btn');

        if (enableBtn) {
            enableBtn.addEventListener('click', () => {
                if (typeof Notification !== 'undefined') {
                    Notification.requestPermission().then((permission) => {
                        this.checkPermissions();
                        if (permission === 'granted') {
                            this.showStatus("Notifications enabled successfully!");
                        } else {
                            this.showStatus("Notifications were not allowed.");
                        }
                    });
                }
            });
        }

        const saveNotificationSettings = async () => {
            try {
                const result = (await chrome.storage.local.get(['notificationSettings'])) as StorageData & { notificationSettings?: NotificationSettings };
                const oldSettings = result.notificationSettings || { priority: '2' };
                let frequency = notifInterval ? notifInterval.value : '60';
                if (frequency === 'custom' && customIntervalInput) {
                    const customVal = parseInt(customIntervalInput.value, 10);
                    frequency = (!isNaN(customVal) && customVal > 0) ? String(customVal) : '60';
                }

                const updatedSettings: NotificationSettings = {
                    enabled: notifToggle ? notifToggle.checked : true,
                    frequency: frequency,
                    priority: oldSettings.priority || '2',
                    requireInteraction: notifStickyToggle ? notifStickyToggle.checked : true,
                    quietHoursEnabled: quietToggle ? quietToggle.checked : false,
                    quietHoursStart: quietStart ? quietStart.value : '23:00',
                    quietHoursEnd: quietEnd ? quietEnd.value : '07:00'
                };

                await chrome.storage.local.set({ notificationSettings: updatedSettings });
            } catch (error) {
                console.error("Error saving notification settings:", error);
            }
        };

        if (notifInterval) {
            notifInterval.addEventListener('change', () => {
                if (notifInterval.value === 'custom') {
                    if (customIntervalContainer) customIntervalContainer.classList.remove('hide-panel');
                    if (customIntervalInput && !customIntervalInput.value) {
                        customIntervalInput.value = '60';
                    }
                } else {
                    if (customIntervalContainer) customIntervalContainer.classList.add('hide-panel');
                }
                saveNotificationSettings();
            });
        }

        if (notifToggle) {
            notifToggle.addEventListener('change', saveNotificationSettings);
        }

        if (notifStickyToggle) {
            notifStickyToggle.addEventListener('change', saveNotificationSettings);
        }

        if (quietToggle) {
            quietToggle.addEventListener('change', () => {
                if (quietContainer) quietContainer.classList.toggle('hide-panel', !quietToggle.checked);
                saveNotificationSettings();
            });
        }
        if (quietStart) {
            quietStart.addEventListener('change', saveNotificationSettings);
            quietStart.addEventListener('input', saveNotificationSettings);
        }
        if (quietEnd) {
            quietEnd.addEventListener('change', saveNotificationSettings);
            quietEnd.addEventListener('input', saveNotificationSettings);
        }

        if (customIntervalInput) {
            customIntervalInput.addEventListener('input', saveNotificationSettings);
        }

        if (testNotifBtn) {
            testNotifBtn.addEventListener('click', () => {
                chrome.runtime.sendMessage({ action: 'test_notification' }, (response?: MessageResponse) => {
                    if (chrome.runtime.lastError) {
                        console.error("Error sending test message:", chrome.runtime.lastError.message);
                        this.showStatus("Error triggering notification.");
                    } else if (response && response.success) {
                        this.showStatus("Test notification sent!");
                    } else {
                        this.showStatus("Failed to send test notification.");
                    }
                });
            });
        }

        // R3.6: Weekly Digest Toggle
        const weeklyDigestToggle = document.getElementById('toggle-weekly-digest') as HTMLInputElement | null;
        if (weeklyDigestToggle) {
            // Load saved preference
            chrome.storage.local.get(['weeklySummaryEnabled'], (result: { weeklySummaryEnabled?: boolean }) => {
                weeklyDigestToggle.checked = result.weeklySummaryEnabled !== false;
            });
            weeklyDigestToggle.addEventListener('change', () => {
                const enabled = weeklyDigestToggle.checked;
                chrome.storage.local.set({ weeklySummaryEnabled: enabled });
                chrome.runtime.sendMessage({ action: 'toggle_weekly_summary', enabled });
            });
        }
    }
}
