/**
 * @file features/dashboard/popup/notifications.ts
 * @description Controls notification and reminder configuration panels inside the dashboard popup.
 */

import { Logger } from '@common/logger';
import { DashboardComponent, DashboardCoordinator } from './DashboardComponent';
import { StorageData, NotificationSettings, MessageResponse } from '../../../types/domain';

export class NotificationsComponent extends DashboardComponent {
    constructor(coordinator: DashboardCoordinator) {
        super(coordinator);
    }

    /**
     * Required implementation of abstract load from DashboardComponent
     */
    async load(): Promise<void> {
        try {
            await this.loadSettings();
            this.checkPermissions();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('NotificationsComponent', `Error during notifications load: ${errorMessage}`, { err });
            // Comment: Catch component load failure gracefully
        }
    }

    /**
     * Checks Chrome/HTML Notification permissions, toggling permission warning banners
     * and adjusting action button visibility appropriately.
     */
    checkPermissions(): void {
        try {
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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('NotificationsComponent', `Error checking notification permissions: ${errorMessage}`, { err });
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
            try {
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
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                Logger.error('NotificationsComponent', `Error updating notification UI: ${errorMessage}`, { settings, err });
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
            const errorMessage = error instanceof Error ? error.message : String(error);
            Logger.error('NotificationsComponent', `Error loading notification settings: ${errorMessage}`, { error });
            // Comment: Non-fatal settings load catch
        }
    }

    /**
     * Binds event listeners to enable button, interval inputs, and test triggers.
     */
    bindEvents(): void {
        try {
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
                    try {
                        if (typeof Notification !== 'undefined') {
                            Notification.requestPermission().then((permission) => {
                                try {
                                    this.checkPermissions();
                                    if (permission === 'granted') {
                                        this.showStatus("Notifications enabled successfully!");
                                    } else {
                                        this.showStatus("Notifications were not allowed.");
                                    }
                                } catch (permCbErr) {
                                    const errorMessage = permCbErr instanceof Error ? permCbErr.message : String(permCbErr);
                                    Logger.error('NotificationsComponent', `Error in Notification.requestPermission callback: ${errorMessage}`, { permCbErr });
                                }
                            }).catch((reqErr) => {
                                const errorMessage = reqErr instanceof Error ? reqErr.message : String(reqErr);
                                Logger.error('NotificationsComponent', `Error requesting Notification permission: ${errorMessage}`, { reqErr });
                            });
                        }
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('NotificationsComponent', `Error in enable notifications button click handler: ${errorMessage}`, { err });
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
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    Logger.error('NotificationsComponent', `Error saving notification settings: ${errorMessage}`, { error });
                }
            };

            if (notifInterval) {
                notifInterval.addEventListener('change', () => {
                    try {
                        if (notifInterval.value === 'custom') {
                            if (customIntervalContainer) customIntervalContainer.classList.remove('hide-panel');
                            if (customIntervalInput && !customIntervalInput.value) {
                                customIntervalInput.value = '60';
                            }
                        } else {
                            if (customIntervalContainer) customIntervalContainer.classList.add('hide-panel');
                        }
                        saveNotificationSettings();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('NotificationsComponent', `Error in notification interval change listener: ${errorMessage}`, { err });
                    }
                });
            }

            if (notifToggle) {
                notifToggle.addEventListener('change', () => {
                    try {
                        saveNotificationSettings();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('NotificationsComponent', `Error in notification toggle change listener: ${errorMessage}`, { err });
                    }
                });
            }

            if (notifStickyToggle) {
                notifStickyToggle.addEventListener('change', () => {
                    try {
                        saveNotificationSettings();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('NotificationsComponent', `Error in sticky toggle change listener: ${errorMessage}`, { err });
                    }
                });
            }

            if (quietToggle) {
                quietToggle.addEventListener('change', () => {
                    try {
                        if (quietContainer) quietContainer.classList.toggle('hide-panel', !quietToggle.checked);
                        saveNotificationSettings();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('NotificationsComponent', `Error in quiet toggle change listener: ${errorMessage}`, { err });
                    }
                });
            }

            if (quietStart) {
                const handleQuietStart = () => {
                    try {
                        saveNotificationSettings();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('NotificationsComponent', `Error in quiet start change listener: ${errorMessage}`, { err });
                    }
                };
                quietStart.addEventListener('change', handleQuietStart);
                quietStart.addEventListener('input', handleQuietStart);
            }

            if (quietEnd) {
                const handleQuietEnd = () => {
                    try {
                        saveNotificationSettings();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('NotificationsComponent', `Error in quiet end change listener: ${errorMessage}`, { err });
                    }
                };
                quietEnd.addEventListener('change', handleQuietEnd);
                quietEnd.addEventListener('input', handleQuietEnd);
            }

            if (customIntervalInput) {
                customIntervalInput.addEventListener('input', () => {
                    try {
                        saveNotificationSettings();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('NotificationsComponent', `Error in custom interval input listener: ${errorMessage}`, { err });
                    }
                });
            }

            if (testNotifBtn) {
                testNotifBtn.addEventListener('click', () => {
                    try {
                        chrome.runtime.sendMessage({ action: 'test_notification' }, (response?: MessageResponse) => {
                            try {
                                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                if (lastError) {
                                    const errorMessage = lastError.message || String(lastError);
                                    Logger.error('NotificationsComponent', `Error sending test message: ${errorMessage}`, { error: lastError });
                                    this.showStatus("Error triggering notification.");
                                } else if (response && response.success) {
                                    this.showStatus("Test notification sent!");
                                } else {
                                    this.showStatus("Failed to send test notification.");
                                }
                            } catch (respErr) {
                                const errorMessage = respErr instanceof Error ? respErr.message : String(respErr);
                                Logger.error('NotificationsComponent', `Error in test notification response callback: ${errorMessage}`, { respErr });
                            }
                        });
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('NotificationsComponent', `Error in test notification button click handler: ${errorMessage}`, { err });
                    }
                });
            }

            // R3.6: Weekly Digest Toggle
            const weeklyDigestToggle = document.getElementById('toggle-weekly-digest') as HTMLInputElement | null;
            if (weeklyDigestToggle) {
                // Load saved preference
                chrome.storage.local.get(['weeklySummaryEnabled'], (result: { weeklySummaryEnabled?: boolean }) => {
                    try {
                        const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                        if (lastError) {
                            const errorMessage = lastError.message || String(lastError);
                            Logger.error('NotificationsComponent', `Storage error fetching weeklySummaryEnabled: ${errorMessage}`, { error: lastError });
                            return;
                        }
                        weeklyDigestToggle.checked = result.weeklySummaryEnabled !== false;
                    } catch (getErr) {
                        const errorMessage = getErr instanceof Error ? getErr.message : String(getErr);
                        Logger.error('NotificationsComponent', `Error rendering weekly summary toggle preference: ${errorMessage}`, { getErr });
                    }
                });

                weeklyDigestToggle.addEventListener('change', () => {
                    try {
                        const enabled = weeklyDigestToggle.checked;
                        chrome.storage.local.set({ weeklySummaryEnabled: enabled }, () => {
                            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                            if (lastError) {
                                const errorMessage = lastError.message || String(lastError);
                                Logger.error('NotificationsComponent', `Storage error saving weeklySummaryEnabled: ${errorMessage}`, { enabled, error: lastError });
                            }
                        });
                        chrome.runtime.sendMessage({ action: 'toggle_weekly_summary', enabled });
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('NotificationsComponent', `Error toggling weekly summary: ${errorMessage}`, { err });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('NotificationsComponent', `Error binding notification events: ${errorMessage}`, { err });
            // Comment: Non-fatal event binding catch
        }
    }
}
