/**
 * @file Popup Notification Preferences and Alarms Configuration (Preact)
 * @module features/dashboard/popup/notifications
 * @context Browser Action Popup UI (`features/dashboard/popup/popup.html`)
 * @description Provides controls for notification toggle switches, check interval dropdowns,
 * quiet hours time range pickers, sticky desktop notification options, badge counters, and test dispatches.
 *
 * Key Exports:
 * - `PopupPermissionWarningBanner`: Warning banner displayed when browser notification permissions are missing.
 * - `PopupNotificationSettings`: Preact component rendering the collapsible notification preferences section.
 * - `NotificationSettingsSection`: Preact component rendering notifications card wrapper.
 * - `NotificationsApp`: Complete declarative Preact component for notification configuration.
 * - `NotificationsComponent`: Coordinator class managing storage synchronization and alarms.
 */

import { h, VNode, render as preactRender } from "preact";
import { useState, useEffect, useLayoutEffect } from "preact/hooks";
import { flushSync } from 'preact/compat';
import { BROWSER_CONFIG } from '../../common/browserConfig';
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { DashboardComponent, DashboardCoordinator } from './DashboardComponent';
import { StorageData, NotificationSettings, MessageResponse } from '../../../types/domain';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../../common/constants';

function safeFlushSync(fn: () => void): void {
    try {
        flushSync(fn);
    } catch (_) {
        fn();
    }
}

/**
 * Props for the PopupPermissionWarningBanner component.
 */
export interface PopupPermissionWarningBannerProps {
    /** Current browser notification permission state ('default' | 'granted' | 'denied') */
    permission: "default" | "granted" | "denied";
    /** Callback to request browser notification permission */
    onEnable: () => void;
}

/**
 * Preact component rendering a permission warning banner when notifications are blocked or ungranted.
 */
export function PopupPermissionWarningBanner({ permission, onEnable }: PopupPermissionWarningBannerProps): VNode {
    const isDenied = permission === "denied";
    const isGranted = permission === "granted";

    return (
        <div
            id="permission-warning-banner"
            className={`warning-banner ${isGranted ? "hide-panel" : ""}`}
            style={{ display: isGranted ? 'none' : '' }}
        >
            <span>
                {isDenied
                    ? "⚠️ Notifications blocked. Enable them in settings for reminders."
                    : "⚠️ Reminders work best with notifications enabled."}
            </span>
            <button
                id="enable-notifications-btn"
                className="btn btn-warning btn-sm"
                style={{ display: isDenied || isGranted ? 'none' : 'inline-block' }}
                onClick={onEnable}
            >
                Enable
            </button>
        </div>
    );
}

export interface PopupNotificationSettingsProps {
    enabled: boolean;
    interval: number | string;
    requireInteraction: boolean;
    quietHoursEnabled: boolean;
    quietStart: string;
    quietEnd: string;
    badgeEnabled: boolean;
    weeklyDigestEnabled: boolean;
    onToggleNotifications?: (enabled: boolean) => void;
    onIntervalChange?: (interval: number | string) => void;
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
                    onChange={(e) => onIntervalChange && onIntervalChange((e.target as HTMLSelectElement).value)}
                >
                    <option value="60">Every 1 hour</option>
                    <option value="120">Every 2 hours</option>
                    <option value="240">Every 4 hours</option>
                    <option value="480">Every 8 hours</option>
                    <option value="custom">Custom</option>
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

export interface NotificationSettingsSectionProps {
    permission?: 'default' | 'granted' | 'denied';
    onEnablePermission?: () => void;
}

export function NotificationSettingsSection({
    permission = 'granted',
    onEnablePermission
}: NotificationSettingsSectionProps = {}): VNode {
    return (
        <div id="notification-settings-card" className="card notification-card" style={{ display: BROWSER_CONFIG.supportsNotifications ? '' : 'none' }}>
            <PopupPermissionWarningBanner
                permission={permission}
                onEnable={onEnablePermission || (() => {})}
            />
            <div id="test-notifications-container" className="button-row" style={{ display: 'none', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <button id="test-notification-btn" className="btn btn-secondary flex-1">Send Test Notification</button>
                <button id="test-summary-notification-btn" className="btn btn-secondary flex-1">Send Test Summary Notification</button>
            </div>
        </div>
    );
}

export interface NotificationAppState {
    permission: 'default' | 'granted' | 'denied';
    enabled: boolean;
    frequency: string;
    customFrequency: string;
    requireInteraction: boolean;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    badgeEnabled: boolean;
    weeklySummaryEnabled: boolean;
}

export function NotificationsApp({
    initialState,
    onSave,
    coordinator
}: {
    initialState: NotificationAppState;
    onSave?: (settings: NotificationSettings, weeklySummary?: boolean) => void;
    coordinator?: DashboardCoordinator;
}): VNode {
    const [state, setState] = useState<NotificationAppState>(initialState);

    useLayoutEffect(() => {
        NotificationsComponent.updateAppState = (partial: Partial<NotificationAppState>) => {
            safeFlushSync(() => {
                setState(prev => ({ ...prev, ...partial }));
            });
        };
        return () => {
            NotificationsComponent.updateAppState = null;
        };
    }, []);

    useLayoutEffect(() => {
        setState(initialState);
    }, [initialState]);

    const isDenied = state.permission === 'denied';
    const isGranted = state.permission === 'granted';

    const handleEnablePermission = () => {
        try {
            if (typeof Notification !== 'undefined') {
                Notification.requestPermission().then((perm) => {
                    safeFlushSync(() => {
                        setState(prev => ({ ...prev, permission: perm as 'default' | 'granted' | 'denied' }));
                    });
                    if (perm === 'granted') {
                        coordinator?.showStatus?.('Notifications enabled successfully!');
                    } else {
                        coordinator?.showStatus?.('Notifications were not allowed.');
                    }
                }).catch(reqErr => {
                    const errorMessage = reqErr instanceof Error ? reqErr.message : String(reqErr);
                    Logger.error('NotificationsComponent', `Error requesting Notification permission: ${errorMessage}`, { reqErr });
                });
            }
        } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error enabling notifications', err);
        }
    };

    const handleTestNotification = () => {
        try {
            chrome.runtime.sendMessage({ action: 'test_notification' }, (response?: MessageResponse) => {
                try {
                    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                    if (lastError) {
                        const errorMessage = lastError.message || String(lastError);
                        Logger.error('NotificationsComponent', `Error sending test message: ${errorMessage}`, { error: lastError });
                        coordinator?.showStatus?.('Error triggering notification.');
                    } else if (response && response.success) {
                        coordinator?.showStatus?.('Test notification sent!');
                    } else {
                        coordinator?.showStatus?.('Failed to send test notification.');
                    }
                } catch (respErr) {
                    UIUtils.catchError('NotificationsComponent', 'Error in test notification response callback', respErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error triggering test notification', err);
        }
    };

    const handleTestSummaryNotification = () => {
        try {
            chrome.runtime.sendMessage({ action: 'test_summary_notification' }, (response?: MessageResponse) => {
                try {
                    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                    if (lastError) {
                        const errorMessage = lastError.message || String(lastError);
                        Logger.error('NotificationsComponent', `Error sending test summary message: ${errorMessage}`, { error: lastError });
                        coordinator?.showStatus?.('Error triggering summary notification.');
                    } else if (response && response.success) {
                        coordinator?.showStatus?.('Test weekly summary notification sent!');
                    } else {
                        coordinator?.showStatus?.('Failed to send test summary notification.');
                    }
                } catch (respErr) {
                    UIUtils.catchError('NotificationsComponent', 'Error in test summary notification response callback', respErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error triggering test summary notification', err);
        }
    };

    const saveChanges = (partial: Partial<NotificationAppState>) => {
        const next = { ...state, ...partial };
        safeFlushSync(() => {
            setState(next);
        });

        let freq = next.frequency;
        if (freq === 'custom') {
            const customVal = parseInt(next.customFrequency, 10);
            freq = (!isNaN(customVal) && customVal > 0) ? String(customVal) : '60';
        }

        const settings: NotificationSettings = {
            enabled: next.enabled,
            frequency: freq,
            priority: '2',
            requireInteraction: next.requireInteraction,
            quietHoursEnabled: next.quietHoursEnabled,
            quietHoursStart: next.quietHoursStart,
            quietHoursEnd: next.quietHoursEnd,
            badgeEnabled: next.badgeEnabled,
            showDueBadge: next.badgeEnabled
        };

        onSave?.(settings, next.weeklySummaryEnabled);
    };

    const standardOptions = ['1', '15', '30', '60', '120', '360', '720', '1440'];
    const isCustom = state.frequency === 'custom' || (!standardOptions.includes(state.frequency));

    return (
        <div id="notification-settings-card" className="card notification-card" style={{ display: BROWSER_CONFIG.supportsNotifications ? '' : 'none' }}>
            {/* Permission Warning Banner */}
            <div
                id="permission-warning-banner"
                className={`warning-banner ${isGranted ? 'hide-panel' : ''}`}
                style={{ display: isGranted ? 'none' : '' }}
            >
                <span>
                    {isDenied
                        ? "⚠️ Notifications blocked. Enable them in settings for reminders."
                        : "⚠️ Reminders work best with notifications enabled."}
                </span>
                <button
                    id="enable-notifications-btn"
                    className="btn btn-warning btn-sm"
                    style={{ display: isDenied ? 'none' : 'inline-block' }}
                    onClick={handleEnablePermission}
                >
                    Enable
                </button>
            </div>

            {/* Notification Settings Panel */}
            <div className="notification-settings-panel">
                <div className="setting-row">
                    <label htmlFor="toggle-notifications">Enable Notifications</label>
                    <input
                        type="checkbox"
                        id="toggle-notifications"
                        checked={state.enabled}
                        aria-checked={state.enabled ? 'true' : 'false'}
                        onChange={(e) => saveChanges({ enabled: (e.target as HTMLInputElement).checked })}
                    />
                </div>

                <div className="setting-row">
                    <label htmlFor="notification-interval">Reminder Frequency</label>
                    <select
                        id="notification-interval"
                        value={isCustom ? 'custom' : state.frequency}
                        onChange={(e) => {
                            const val = (e.target as HTMLSelectElement).value;
                            saveChanges({
                                frequency: val,
                                customFrequency: val === 'custom' ? (state.customFrequency || '60') : state.customFrequency
                            });
                        }}
                    >
                        <option value="60">1 Hour</option>
                        <option value="120">2 Hours</option>
                        <option value="240">4 Hours</option>
                        <option value="480">8 Hours</option>
                        <option value="custom">Custom</option>
                    </select>
                </div>

                <div
                    id="custom-interval-container"
                    className={`custom-interval-container ${isCustom ? '' : 'hide-panel'}`}
                    style={{ display: isCustom ? '' : 'none' }}
                >
                    <input
                        type="number"
                        id="custom-interval-input"
                        className="custom-interval-input"
                        value={state.customFrequency}
                        onInput={(e) => saveChanges({ customFrequency: (e.target as HTMLInputElement).value })}
                    />
                </div>

                <div className="setting-row">
                    <label htmlFor="toggle-sticky-notification">Sticky Reminders</label>
                    <input
                        type="checkbox"
                        id="toggle-sticky-notification"
                        checked={state.requireInteraction}
                        aria-checked={state.requireInteraction ? 'true' : 'false'}
                        onChange={(e) => saveChanges({ requireInteraction: (e.target as HTMLInputElement).checked })}
                    />
                </div>

                <div className="setting-row">
                    <label htmlFor="toggle-quiet-hours">Quiet Hours</label>
                    <input
                        type="checkbox"
                        id="toggle-quiet-hours"
                        checked={state.quietHoursEnabled}
                        aria-checked={state.quietHoursEnabled ? 'true' : 'false'}
                        onChange={(e) => saveChanges({ quietHoursEnabled: (e.target as HTMLInputElement).checked })}
                    />
                </div>

                <div
                    id="quiet-hours-container"
                    className={`quiet-hours-container ${state.quietHoursEnabled ? '' : 'hide-panel'}`}
                    style={{ display: state.quietHoursEnabled ? '' : 'none' }}
                >
                    <input
                        type="text"
                        id="quiet-hours-start"
                        value={state.quietHoursStart}
                        onChange={(e) => saveChanges({ quietHoursStart: (e.target as HTMLInputElement).value })}
                        onInput={(e) => saveChanges({ quietHoursStart: (e.target as HTMLInputElement).value })}
                    />
                    <input
                        type="text"
                        id="quiet-hours-end"
                        value={state.quietHoursEnd}
                        onChange={(e) => saveChanges({ quietHoursEnd: (e.target as HTMLInputElement).value })}
                        onInput={(e) => saveChanges({ quietHoursEnd: (e.target as HTMLInputElement).value })}
                    />
                </div>

                <div className="setting-row">
                    <label htmlFor="toggle-badge-due-count">Show Due Count on Badge</label>
                    <input
                        type="checkbox"
                        id="toggle-badge-due-count"
                        checked={state.badgeEnabled}
                        aria-checked={state.badgeEnabled ? 'true' : 'false'}
                        onChange={(e) => {
                            const val = (e.target as HTMLInputElement).checked;
                            saveChanges({ badgeEnabled: val });
                            coordinator?.showStatus?.(`Pinned icon due badge ${val ? 'enabled' : 'disabled'}!`);
                        }}
                    />
                </div>

                <div className="setting-row">
                    <label htmlFor="toggle-weekly-digest">Weekly Summary Email</label>
                    <input
                        type="checkbox"
                        id="toggle-weekly-digest"
                        checked={state.weeklySummaryEnabled}
                        onChange={(e) => {
                            const val = (e.target as HTMLInputElement).checked;
                            saveChanges({ weeklySummaryEnabled: val });
                            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                                chrome.runtime.sendMessage({ action: 'toggle_weekly_summary', enabled: val });
                            }
                        }}
                    />
                </div>

                <div id="test-notifications-container" className="button-row">
                    <button id="test-notification-btn" className="btn btn-secondary flex-1" onClick={handleTestNotification}>Test</button>
                    <button id="test-summary-notification-btn" className="btn btn-secondary flex-1" onClick={handleTestSummaryNotification}>Test Summary</button>
                </div>
            </div>
        </div>
    );
}

/**
 * Sub-component for the popup dashboard managing background notification settings,
 * permission status detection, quiet hours intervals, and test alerts.
 */
export class NotificationsComponent extends DashboardComponent {
    public static updateAppState: ((partial: Partial<NotificationAppState>) => void) | null = null;
    private currentSettings: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS };
    private weeklySummaryEnabled: boolean = true;

    constructor(coordinator: DashboardCoordinator) {
        super(coordinator);
        this.mountInitial();
    }

    private mountInitial(): void {
        try {
            const root = document.getElementById('root');
            if (root) {
                const perm = typeof Notification !== 'undefined' ? (Notification.permission as 'default' | 'granted' | 'denied') : 'granted';
                const initial: NotificationAppState = {
                    permission: perm,
                    enabled: true,
                    frequency: '60',
                    customFrequency: '',
                    requireInteraction: true,
                    quietHoursEnabled: true,
                    quietHoursStart: '22:00',
                    quietHoursEnd: '07:00',
                    badgeEnabled: true,
                    weeklySummaryEnabled: true
                };
                safeFlushSync(() => {
                    preactRender(
                        <NotificationsApp
                            initialState={initial}
                            onSave={async (settings, weeklySummary) => {
                                await this.saveSettings(settings, weeklySummary);
                            }}
                            coordinator={this.coordinator}
                        />,
                        root
                    );
                });
            }
        } catch (_) {}
    }

    async load(): Promise<void> {
        try {
            await this.loadSettings();
            this.checkPermissions();
        } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error during notifications load', err);
        }
    }

    checkPermissions(): void {
        try {
            if (typeof Notification !== 'undefined') {
                const perm = Notification.permission as 'default' | 'granted' | 'denied';
                if (NotificationsComponent.updateAppState) {
                    NotificationsComponent.updateAppState({ permission: perm });
                }
            }
        } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error checking notification permissions', err);
        }
    }

    async loadSettings(): Promise<void> {
        try {
            const result = (await chrome.storage.local.get(['notificationSettings', 'weeklySummaryEnabled'])) as StorageData & {
                notificationSettings?: NotificationSettings;
                weeklySummaryEnabled?: boolean;
            };

            const settings = result.notificationSettings || { ...DEFAULT_NOTIFICATION_SETTINGS };
            this.currentSettings = settings;
            this.weeklySummaryEnabled = result.weeklySummaryEnabled !== false;

            const perm = typeof Notification !== 'undefined' ? (Notification.permission as 'default' | 'granted' | 'denied') : 'granted';
            const freqStr = settings.frequency || '60';
            const standardOptions = ['1', '15', '30', '60', '120', '360', '720', '1440'];
            const isCustom = !standardOptions.includes(freqStr);

            const appState: NotificationAppState = {
                permission: perm,
                enabled: settings.enabled !== false,
                frequency: isCustom ? 'custom' : freqStr,
                customFrequency: isCustom ? freqStr : '',
                requireInteraction: settings.requireInteraction !== false,
                quietHoursEnabled: settings.quietHoursEnabled === true,
                quietHoursStart: settings.quietHoursStart || '22:00',
                quietHoursEnd: settings.quietHoursEnd || '07:00',
                badgeEnabled: settings.badgeEnabled !== false && settings.showDueBadge !== false,
                weeklySummaryEnabled: this.weeklySummaryEnabled
            };

            const root = document.getElementById('root');
            if (root) {
                safeFlushSync(() => {
                    preactRender(
                        <NotificationsApp
                            initialState={appState}
                            onSave={async (s, w) => {
                                await this.saveSettings(s, w);
                            }}
                            coordinator={this.coordinator}
                        />,
                        root
                    );
                });
            } else if (NotificationsComponent.updateAppState) {
                NotificationsComponent.updateAppState(appState);
            }
        } catch (error) {
            UIUtils.catchError('NotificationsComponent', 'Error loading notification settings', error);
        }
    }

    async saveSettings(settings: NotificationSettings, weeklySummary?: boolean): Promise<void> {
        try {
            await chrome.storage.local.set({
                notificationSettings: settings,
                ...(weeklySummary !== undefined ? { weeklySummaryEnabled: weeklySummary } : {})
            });
        } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error saving notification settings', err);
        }
    }

    bindEvents(): void {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['weeklySummaryEnabled'], (result: { weeklySummaryEnabled?: boolean }) => {
                    try {
                        const lastError = chrome.runtime?.lastError;
                        if (lastError) {
                            Logger.error('NotificationsComponent', `Storage error: ${lastError.message}`);
                            return;
                        }
                        if (result && typeof result.weeklySummaryEnabled === 'boolean' && NotificationsComponent.updateAppState) {
                            NotificationsComponent.updateAppState({ weeklySummaryEnabled: result.weeklySummaryEnabled });
                        }
                    } catch (err) {
                        UIUtils.catchError('NotificationsComponent', 'Error in weeklySummaryEnabled callback', err);
                    }
                });
            }
        } catch (err) {
            UIUtils.catchError('NotificationsComponent', 'Error in bindEvents', err);
        }
    }
}

if (typeof module !== "undefined" && module.exports) {
    (module.exports as any).NotificationsComponent = NotificationsComponent;
    (module.exports as any).PopupPermissionWarningBanner = PopupPermissionWarningBanner;
    (module.exports as any).PopupNotificationSettings = PopupNotificationSettings;
    (module.exports as any).NotificationSettingsSection = NotificationSettingsSection;
    (module.exports as any).NotificationsApp = NotificationsApp;
}
