
import { h, VNode } from "preact";

export interface PopupPermissionWarningBannerProps {
    permission: "default" | "granted" | "denied";
    onEnable: () => void;
}

export function PopupPermissionWarningBanner({ permission, onEnable }: PopupPermissionWarningBannerProps): VNode | null {
    if (permission === "granted") return null;

    const isDenied = permission === "denied";

    return (
        <div id="permission-warning-banner" className="warning-banner">
            <span>
                {isDenied
                    ? "⚠️ Notifications blocked. Enable them in settings for reminders."
                    : "⚠️ Reminders work best with notifications enabled."}
            </span>
            {!isDenied && (
                <button
                    id="enable-notifications-btn"
                    className="btn btn-warning btn-sm"
                    onClick={onEnable}
                >
                    Enable
                </button>
            )}
        </div>
    );
}

export interface PopupNotificationSettingsProps {
    enabled: boolean;
    interval: number;
    requireInteraction: boolean;
    quietHoursEnabled: boolean;
    quietStart: string;
    quietEnd: string;
    badgeEnabled: boolean;
    weeklyDigestEnabled: boolean;
    onToggleNotifications?: (enabled: boolean) => void;
    onIntervalChange?: (interval: number) => void;
    onToggleSticky?: (sticky: boolean) => void;
    onToggleQuietHours?: (enabled: boolean) => void;
    onToggleBadge?: (enabled: boolean) => void;
    onToggleWeeklyDigest?: (enabled: boolean) => void;
}

export function PopupNotificationSettings({
    enabled,
    interval,
    requireInteraction,
    quietHoursEnabled,
    quietStart,
    quietEnd,
    badgeEnabled,
    weeklyDigestEnabled,
    onToggleNotifications,
    onIntervalChange,
    onToggleSticky,
    onToggleQuietHours,
    onToggleBadge,
    onToggleWeeklyDigest
}: PopupNotificationSettingsProps): VNode {
    return (
        <div className="notification-settings-panel">
            <div className="setting-row">
                <label htmlFor="toggle-notifications">Enable Notifications</label>
                <input
                    type="checkbox"
                    id="toggle-notifications"
                    checked={enabled}
                    onChange={(e) => onToggleNotifications && onToggleNotifications((e.target as HTMLInputElement).checked)}
                />
            </div>
            <div className="setting-row">
                <label htmlFor="notification-interval">Reminder Frequency</label>
                <select
                    id="notification-interval"
                    value={interval}
                    onChange={(e) => onIntervalChange && onIntervalChange(parseInt((e.target as HTMLSelectElement).value, 10))}
                >
                    <option value="60">Every 1 hour</option>
                    <option value="120">Every 2 hours</option>
                    <option value="240">Every 4 hours</option>
                    <option value="480">Every 8 hours</option>
                </select>
            </div>
            <div className="setting-row">
                <label htmlFor="toggle-sticky-notification">Sticky Reminders</label>
                <input
                    type="checkbox"
                    id="toggle-sticky-notification"
                    checked={requireInteraction}
                    onChange={(e) => onToggleSticky && onToggleSticky((e.target as HTMLInputElement).checked)}
                />
            </div>
            <div className="setting-row">
                <label htmlFor="toggle-quiet-hours">Quiet Hours</label>
                <input
                    type="checkbox"
                    id="toggle-quiet-hours"
                    checked={quietHoursEnabled}
                    onChange={(e) => onToggleQuietHours && onToggleQuietHours((e.target as HTMLInputElement).checked)}
                />
            </div>
            <div className="setting-row">
                <label htmlFor="toggle-badge-due-count">Show Due Count on Badge</label>
                <input
                    type="checkbox"
                    id="toggle-badge-due-count"
                    checked={badgeEnabled}
                    onChange={(e) => onToggleBadge && onToggleBadge((e.target as HTMLInputElement).checked)}
                />
            </div>
            <div className="setting-row">
                <label htmlFor="toggle-weekly-digest">Weekly Email Digest</label>
                <input
                    type="checkbox"
                    id="toggle-weekly-digest"
                    checked={weeklyDigestEnabled}
                    onChange={(e) => onToggleWeeklyDigest && onToggleWeeklyDigest((e.target as HTMLInputElement).checked)}
                />
            </div>
        </div>
    );
}
/**
 * @file features/dashboard/popup/notifications.ts
 * @description Controls notification and reminder configuration panels inside the dashboard popup.
 * Manages permission requests, reminder frequencies, quiet hours schedules, sticky notifications,
 * pinned badge count toggles, and test notification triggers.
 *
 * Architecture Role: Popup Sub-View Component (Notifications & Scheduling).
 * Context: Extension Action Popup (`features/dashboard/popup/popup.html`).
 * Key Exports:
 * - {@link NotificationsComponent}: Sub-view component class managing notification preferences and tests.
 */

import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { DashboardComponent, DashboardCoordinator } from './DashboardComponent';
import { StorageData, NotificationSettings, MessageResponse } from '../../../types/domain';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../../common/constants';

/**
 * Sub-component for the popup dashboard managing background notification settings,
 * permission status detection, quiet hours intervals, and test alerts.
 */
export class NotificationsComponent extends DashboardComponent {
    /**
     * Initializes notifications component with reference to parent coordinator.
     * @param coordinator - Parent dashboard coordinator.
     */
    constructor(coordinator: DashboardCoordinator) {
        super(coordinator);
    }

    /**
     * Required implementation of abstract load from DashboardComponent.
     * Loads settings from storage and validates browser notification permissions.
     * @async
     * @returns Promise resolving when settings and permissions have loaded.
     */
    async load(): Promise<void> {
        try {
            await this.loadSettings();
            this.checkPermissions();
        } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error during notifications load', err);
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
            UIUtils.catchError('NotificationsComponent', 'Error checking notification permissions', err);
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
        const badgeToggle = document.getElementById('toggle-badge-due-count') as HTMLInputElement | null;

        const updateNotificationUI = (settings: NotificationSettings) => {
            try {
                if (!notifToggle) return;
                notifToggle.checked = settings.enabled !== false;
                notifToggle.setAttribute('aria-checked', notifToggle.checked.toString());
                if (notifStickyToggle) {
                    notifStickyToggle.checked = settings.requireInteraction !== false;
                    notifStickyToggle.setAttribute('aria-checked', notifStickyToggle.checked.toString());
                }
                if (quietToggle) {
                    quietToggle.checked = settings.quietHoursEnabled === true;
                    quietToggle.setAttribute('aria-checked', quietToggle.checked.toString());
                    if (quietContainer) quietContainer.classList.toggle('hide-panel', !settings.quietHoursEnabled);
                }
                if (quietStart && settings.quietHoursStart) quietStart.value = settings.quietHoursStart;
                if (quietEnd && settings.quietHoursEnd) quietEnd.value = settings.quietHoursEnd;
                if (badgeToggle) {
                    const isBadgeEnabled = settings.badgeEnabled !== false && settings.showDueBadge !== false;
                    badgeToggle.checked = isBadgeEnabled;
                    badgeToggle.setAttribute('aria-checked', isBadgeEnabled.toString());
                }

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
            UIUtils.catchError('NotificationsComponent', 'Error updating notification UI', err, { settings });
        }
        };

        try {
            const result = (await chrome.storage.local.get(['notificationSettings'])) as StorageData & { notificationSettings?: NotificationSettings };
            const settings = result.notificationSettings || { ...DEFAULT_NOTIFICATION_SETTINGS };
            updateNotificationUI(settings);
        } catch (error) {
            UIUtils.catchError('NotificationsComponent', 'Error loading notification settings', error);
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
            const badgeToggle = document.getElementById('toggle-badge-due-count') as HTMLInputElement | null;
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
            UIUtils.catchError('NotificationsComponent', 'Error in Notification.requestPermission callback', permCbErr);
        }
                            }).catch((reqErr) => {
                                const errorMessage = reqErr instanceof Error ? reqErr.message : String(reqErr);
                                Logger.error('NotificationsComponent', `Error requesting Notification permission: ${errorMessage}`, { reqErr });
                            });
                        }
                    } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error in enable notifications button click handler', err);
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
                        quietHoursEnd: quietEnd ? quietEnd.value : '07:00',
                        badgeEnabled: badgeToggle ? badgeToggle.checked : (oldSettings.badgeEnabled !== false),
                        showDueBadge: badgeToggle ? badgeToggle.checked : (oldSettings.showDueBadge !== false)
                    };

                    if (notifToggle) notifToggle.setAttribute('aria-checked', notifToggle.checked.toString());
                    if (notifStickyToggle) notifStickyToggle.setAttribute('aria-checked', notifStickyToggle.checked.toString());
                    if (quietToggle) quietToggle.setAttribute('aria-checked', quietToggle.checked.toString());
                    if (badgeToggle) badgeToggle.setAttribute('aria-checked', badgeToggle.checked.toString());

                    await chrome.storage.local.set({ notificationSettings: updatedSettings });
                } catch (error) {
            UIUtils.catchError('NotificationsComponent', 'Error saving notification settings', error);
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
            UIUtils.catchError('NotificationsComponent', 'Error in notification interval change listener', err);
        }
                });
            }

            if (notifToggle) {
                notifToggle.addEventListener('change', () => {
                    try {
                        saveNotificationSettings();
                    } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error in notification toggle change listener', err);
        }
                });
            }

            if (notifStickyToggle) {
                notifStickyToggle.addEventListener('change', () => {
                    try {
                        saveNotificationSettings();
                    } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error in sticky toggle change listener', err);
        }
                });
            }

            if (quietToggle) {
                quietToggle.addEventListener('change', () => {
                    try {
                        if (quietContainer) quietContainer.classList.toggle('hide-panel', !quietToggle.checked);
                        saveNotificationSettings();
                    } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error in quiet toggle change listener', err);
        }
                });
            }

            if (badgeToggle) {
                badgeToggle.addEventListener('change', () => {
                    try {
                        badgeToggle.setAttribute('aria-checked', badgeToggle.checked.toString());
                        saveNotificationSettings();
                        this.showStatus(`Pinned icon due badge ${badgeToggle.checked ? 'enabled' : 'disabled'}!`);
                    } catch (err) {
                        UIUtils.catchError('NotificationsComponent', 'Error in badge toggle change listener', err);
                    }
                });
            }

            if (quietStart) {
                const handleQuietStart = () => {
                    try {
                        saveNotificationSettings();
                    } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error in quiet start change listener', err);
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
            UIUtils.catchError('NotificationsComponent', 'Error in quiet end change listener', err);
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
            UIUtils.catchError('NotificationsComponent', 'Error in custom interval input listener', err);
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
            UIUtils.catchError('NotificationsComponent', 'Error in test notification response callback', respErr);
        }
                        });
                    } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error in test notification button click handler', err);
        }
                });
            }

            const testSummaryNotifBtn = document.getElementById('test-summary-notification-btn');
            if (testSummaryNotifBtn) {
                testSummaryNotifBtn.addEventListener('click', () => {
                    try {
                        chrome.runtime.sendMessage({ action: 'test_summary_notification' }, (response?: MessageResponse) => {
                            try {
                                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                if (lastError) {
                                    const errorMessage = lastError.message || String(lastError);
                                    Logger.error('NotificationsComponent', `Error sending test summary message: ${errorMessage}`, { error: lastError });
                                    this.showStatus("Error triggering summary notification.");
                                } else if (response && response.success) {
                                    this.showStatus("Test weekly summary notification sent!");
                                } else {
                                    this.showStatus("Failed to send test summary notification.");
                                }
                            } catch (respErr) {
            UIUtils.catchError('NotificationsComponent', 'Error in test summary notification response callback', respErr);
        }
                        });
                    } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error in test summary notification button click handler', err);
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
            UIUtils.catchError('NotificationsComponent', 'Error rendering weekly summary toggle preference', getErr);
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
                        if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
                            chrome.runtime.sendMessage({ action: 'toggle_weekly_summary', enabled });
                        }
                    } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error toggling weekly summary', err);
        }
                });
            }
        } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error binding notification events', err);
        }
    }
}

if (typeof module !== "undefined" && module.exports) {
    (module.exports as any).NotificationsComponent = NotificationsComponent;
    (module.exports as any).PopupPermissionWarningBanner = PopupPermissionWarningBanner;
    (module.exports as any).PopupNotificationSettings = PopupNotificationSettings;
}
