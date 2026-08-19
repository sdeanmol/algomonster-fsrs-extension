/**
 * @file background/background.ts
 * @description Extension background service worker (Manifest V3) implemented as an OOP class.
 * Manages background alarms for checking scheduled card due times, schedules/delivers OS notifications,
 * handles custom whitelisted website routing messages, reacts to SPA client-side history state updates,
 * and sends weekly summary digest notifications (R3.6).
 */
import { Logger } from '@common/logger';
import {
    Card,
    StorageData,
    ExtensionMessage,
    MessageResponse,
    NotificationSettings,
    WhitelistedWebsite,
    PomodoroState,
    PomodoroSettings,
    PomodoroStats
} from '../types/domain';
import {
    MS_PER_MINUTE,
    MS_PER_DAY,
    MS_PER_WEEK,
    ALARM_DEFAULT_CHECK_INTERVAL_MIN,
    ALARM_DAILY_PERIOD_MIN,
    ALARM_WEEKLY_PERIOD_MIN,
    SNOOZE_DEFAULT_MINUTES,
    DEFAULT_WHITELISTED_WEBSITES
} from '../features/common/constants';

(self as unknown as { onerror: (message: string | Event, source?: string, lineno?: number, colno?: number, error?: Error) => boolean }).onerror = function (message: string | Event, source?: string, lineno?: number, colno?: number, error?: Error) {
    try {
        Logger.error('Background', 'Unhandled runtime error', { message, source, lineno, colno, error });
    } catch (err) {
        // Comment: Suppress recursive logging failures during global onerror handler
        console.warn('[AlgoRecall Background] Suppressed error in onerror handler:', err);
    }
    return false;
};

(self as unknown as { onunhandledrejection: (event: PromiseRejectionEvent) => void }).onunhandledrejection = function (event: PromiseRejectionEvent) {
    try {
        Logger.error('Background', 'Unhandled promise rejection', { reason: event?.reason });
    } catch (err) {
        // Comment: Suppress recursive logging failures during unhandled promise rejection handler
        console.warn('[AlgoRecall Background] Suppressed error in onunhandledrejection handler:', err);
    }
};

export type { NotificationSettings, WhitelistedWebsite, PomodoroState, PomodoroSettings, PomodoroStats };

export class AlgoRecallBackground {
    private pomodoroIntervalId: ReturnType<typeof setInterval> | null = null;
    private _lastPomodoroTitle: string | null = null;
    private _lastPomodoroBadge: string | null = null;
    private _lastPomodoroColor: string | null = null;
    private isCheckingDueCards: boolean = false;

    constructor() {
        this.init();
    }

    /**
     * Initializes the service worker listeners and settings.
     */
    async init(): Promise<void> {
        Logger.info('Background', 'Initializing background service worker...');
        Logger.time('Background', 'Startup');
        try {
            this.bindEvents();
            await this.resumePomodoroBackground();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Failed background initialization: ${errorMessage}`, { err });
            // Comment: Recover gracefully so service worker listeners remain attached
        } finally {
            // Comment: Always end startup timer regardless of init outcome
            Logger.timeEnd('Background', 'Startup');
        }
    }

    /**
     * Binds all Chrome API event listeners.
     */
    bindEvents(): void {
        try {
            chrome.runtime.onInstalled.addListener(this.handleInstalled.bind(this));
            chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
            chrome.webNavigation.onHistoryStateUpdated.addListener(this.handleHistoryStateUpdated.bind(this));
            chrome.storage.onChanged.addListener(this.handleStorageChanged.bind(this));
            chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
            chrome.notifications.onClicked.addListener(this.handleNotificationClicked.bind(this));
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Failed to bind background Chrome API event listeners: ${errorMessage}`, { err });
            // Comment: Catch listener registration error to prevent constructor failure
        }
    }

    /**
     * Handles extension installation event.
     * @param {chrome.runtime.InstalledDetails} details - Details of install event.
     */
    async handleInstalled(details?: chrome.runtime.InstalledDetails): Promise<void> {
        try {
            // Initialize default notification settings if they don't exist
            const result = await chrome.storage.local.get(['notificationSettings']);
            if (chrome.runtime.lastError) {
                Logger.error('Background', `Storage get error in handleInstalled: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
            }
            let settings = result.notificationSettings;
            if (!settings) {
                settings = {
                    enabled: true,
                    frequency: '60',
                    priority: '2',
                    requireInteraction: true
                };
                await chrome.storage.local.set({ notificationSettings: settings });
                if (chrome.runtime.lastError) {
                    Logger.error('Background', `Storage set error in handleInstalled: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
                }
            }

            await this.setupAlarm();
            await this.setupWeeklySummaryAlarm();
            await this.setupDailyNudgeAlarm();
            Logger.debug('Background', `Extension installed/updated. Reason: ${details ? details.reason : 'unknown'}`);

            // Redirect to Onboarding Welcome page on initial install (and update for debugging)
            if (details && (details.reason === 'install' || details.reason === 'update')) {
                chrome.tabs.create({ url: chrome.runtime.getURL('features/common/welcome/welcome.html') });
            } else {
                this.dispatchSystemNotification(
                    'test-install',
                    'AlgoRecall Active 🧠',
                    'Notifications are working! You will be alerted when reviews are due.',
                    2,
                    settings.requireInteraction !== false
                );
            }

            await this.checkDueCards();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Error in handleInstalled: ${errorMessage}`, { details, err });
            // Comment: Non-fatal error during install setup, background worker remains active
        }
    }

    /**
     * Handles incoming background alarm trigger events.
     * @param {chrome.alarms.Alarm} alarm - Fired alarm details.
     */
    handleAlarm(alarm: chrome.alarms.Alarm): void {
        try {
            if (!alarm || !alarm.name) return;
            if (alarm.name === 'checkFsrsReviews' || alarm.name === 'snoozeFsrsReviews' || alarm.name === 'smartReviewSchedule') {
                this.checkDueCards(alarm.name);
            } else if (alarm.name === 'weeklySummary') {
                this.handleWeeklySummary();
            } else if (alarm.name === 'dailyNudge') {
                this.handleDailyNudge();
            } else if (alarm.name === 'pomodoroEnd') {
                this.handlePomodoroEnd();
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Error handling background alarm '${alarm?.name}': ${errorMessage}`, { alarm, err });
            // Comment: Recover gracefully on alarm execution failure to maintain service worker longevity
        }
    }

    /**
     * Handles SPA Client-Side Routing for Highlighter updates.
     * @param {chrome.webNavigation.WebNavigationSourceCallbackDetails} details - Navigation history update details.
     */
    handleHistoryStateUpdated(details: chrome.webNavigation.WebNavigationSourceCallbackDetails): void {
        try {
            if (!details || typeof details.tabId !== 'number') return;
            Logger.debug('Background', `History state updated for tab ${details.tabId}`, { url: details.url });
            chrome.tabs.sendMessage(details.tabId, {
                action: "spa_url_changed",
                url: details.url
            }).catch((err) => {
                // Comment: Non-blocking tab message failure catch (e.g., non-whitelisted site or script not injected yet)
                Logger.debug('Background', `Failed to send spa_url_changed to tab ${details.tabId}: script not injected or non-whitelisted site.`, { tabId: details.tabId, err });
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Error in handleHistoryStateUpdated: ${errorMessage}`, { details, err });
            // Comment: Recover from history state update routing error
        }
    }

    /**
     * Reads user configurations from storage and schedules/reschedules the review check alarms.
     */
    async setupAlarm(): Promise<void> {
        try {
            const result = await chrome.storage.local.get(['notificationSettings', 'fsrsActivity']);
            if (chrome.runtime.lastError) {
                Logger.error('Background', `Storage get error in setupAlarm: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
            }
            const settings: NotificationSettings = result.notificationSettings || {
                enabled: true,
                frequency: '60',
                priority: '2',
                requireInteraction: true
            };

            await chrome.alarms.clear('checkFsrsReviews');
            await chrome.alarms.clear('snoozeFsrsReviews');
            await chrome.alarms.clear('smartReviewSchedule');

            if (settings.enabled) {
                const interval = parseInt(settings.frequency || String(ALARM_DEFAULT_CHECK_INTERVAL_MIN), 10);
                if (!isNaN(interval) && interval > 0) {
                    chrome.alarms.create('checkFsrsReviews', { delayInMinutes: interval, periodInMinutes: interval });
                    Logger.info('Background', `Scheduled checkFsrsReviews alarm every ${interval} minutes.`);
                } else {
                    // If frequency is invalid, fall back to default interval
                    chrome.alarms.create('checkFsrsReviews', { delayInMinutes: ALARM_DEFAULT_CHECK_INTERVAL_MIN, periodInMinutes: ALARM_DEFAULT_CHECK_INTERVAL_MIN });
                    Logger.info('Background', `Scheduled checkFsrsReviews alarm every ${ALARM_DEFAULT_CHECK_INTERVAL_MIN} minutes (fallback).`);
                }

                // R8.1 Smart Scheduling: Also schedule a daily check at their most active study hour
                const now = new Date();
                const smartTarget = new Date(now);
                smartTarget.setHours(17, 0, 0, 0);
                if (smartTarget <= now) smartTarget.setDate(smartTarget.getDate() + 1);

                const delayInMinutes = Math.max(1, Math.ceil((smartTarget.getTime() - now.getTime()) / MS_PER_MINUTE));
                chrome.alarms.create('smartReviewSchedule', { delayInMinutes, periodInMinutes: ALARM_DAILY_PERIOD_MIN });
                Logger.info('Background', `Scheduled smartReviewSchedule alarm daily at 17:00.`);

            } else {
                Logger.info('Background', `Notifications are disabled, cleared review alarms.`);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Failed to set up alarms: ${errorMessage}`, { err });
            // Comment: Non-fatal error during alarm scheduling, service worker continues running
        }
    }

    /**
     * R3.6: Sets up the weekly summary alarm.
     * Fires every Monday at 9:00 AM local time (approximately).
     */
    async setupWeeklySummaryAlarm(): Promise<void> {
        try {
            const result = await chrome.storage.local.get(['weeklySummaryEnabled']);
            if (chrome.runtime.lastError) {
                Logger.error('Background', `Storage get error in setupWeeklySummaryAlarm: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
            }
            const enabled = result.weeklySummaryEnabled !== false; // Default true

            await chrome.alarms.clear('weeklySummary');

            if (enabled) {
                // Calculate minutes until next Monday 9:00 AM
                const now = new Date();
                const target = new Date(now);

                // Find next Monday
                const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
                let daysUntilMonday = (1 - dayOfWeek + 7) % 7;
                if (daysUntilMonday === 0) {
                    // If today is Monday, check if we're past 9am
                    if (now.getHours() >= 9) {
                        daysUntilMonday = 7; // Next Monday
                    }
                }

                target.setDate(target.getDate() + daysUntilMonday);
                target.setHours(9, 0, 0, 0);

                const delayMs = target.getTime() - now.getTime();
                const delayMinutes = Math.max(1, Math.ceil(delayMs / MS_PER_MINUTE));

                chrome.alarms.create('weeklySummary', {
                    delayInMinutes: delayMinutes,
                    periodInMinutes: ALARM_WEEKLY_PERIOD_MIN
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Failed to set up weekly summary alarm: ${errorMessage}`, { err });
            // Comment: Catch weekly summary alarm configuration error gracefully
        }
    }

    /**
     * R8.4: Sets up the daily nudge alarm.
     * Fires every day at 8:00 PM (20:00).
     */
    async setupDailyNudgeAlarm(): Promise<void> {
        try {
            await chrome.alarms.clear('dailyNudge');
            const now = new Date();
            const target = new Date(now);
            target.setHours(20, 0, 0, 0);
            if (target <= now) {
                target.setDate(target.getDate() + 1);
            }
            const delayInMinutes = Math.max(1, Math.ceil((target.getTime() - now.getTime()) / MS_PER_MINUTE));
            chrome.alarms.create('dailyNudge', { delayInMinutes, periodInMinutes: ALARM_DAILY_PERIOD_MIN });
            Logger.info('Background', `Scheduled dailyNudge alarm at 20:00.`);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Failed to set up daily nudge alarm: ${errorMessage}`, { err });
            // Comment: Non-fatal error in daily nudge alarm setup
        }
    }

    /**
     * Watches for changes in settings to dynamically reschedule the alarm.
     * @param {{ [key: string]: chrome.storage.StorageChange }} changes - Object describing key storage differences.
     * @param {string} areaName - The name of the storage area.
     */
    async handleStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): Promise<void> {
        try {
            if (areaName === 'local' && changes.notificationSettings) {
                await this.setupAlarm();
            }
            if (areaName === 'local' && changes.weeklySummaryEnabled) {
                await this.setupWeeklySummaryAlarm();
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Error handling storage change: ${errorMessage}`, { changes, areaName, err });
            // Comment: Recover gracefully from storage change handler failure
        }
    }

    /**
     * Coordinates background script runtime communication channels.
     * @param {ExtensionMessage} message - Received payload object.
     * @param {chrome.runtime.MessageSender} sender - Messaging sender metadata.
     * @param {(response?: MessageResponse) => void} sendResponse - Callback for routing replies.
     */
    handleMessage(message: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: MessageResponse) => void): boolean | void {
        if (!message || typeof message !== 'object') {
            return false;
        }
        Logger.debug('Background', `Received message: ${message.action}`, { senderId: sender.id, tabId: sender.tab?.id });

        if (message.action === 'test_notification') {
            (async () => {
                let success = false;
                let errorMessage: string | undefined;
                try {
                    this.checkDueCards('test');
                    await this.showTestNotification();
                    success = true;
                } catch (err) {
                    errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Background', `Error processing test_notification: ${errorMessage}`, { message, err });
                    // Comment: Recover gracefully by returning error response to client tab
                } finally {
                    // Comment: Guarantee sendResponse call to prevent hanging runtime messaging channel
                    sendResponse(success ? { success: true } : { success: false, error: errorMessage });
                }
            })();
            return true; // Keep message channel open for async response
        }

        if (message.action === 'open_fullscreen_editor') {
            try {
                let targetUrl = 'features/tracker/editor/editor.html?url=' + encodeURIComponent((message.url as string) || '');
                if (message.cardId) {
                    targetUrl += '&cardId=' + encodeURIComponent((message.cardId as string) || '');
                }
                chrome.tabs.create({ url: chrome.runtime.getURL(targetUrl) });
                sendResponse({ success: true });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                Logger.error('Background', `Error in open_fullscreen_editor: ${errorMessage}`, { message, err });
                sendResponse({ success: false, error: errorMessage });
            }
            return true;
        }

        if (message.action === 'snooze_notification') {
            try {
                const minutes = message.minutes || SNOOZE_DEFAULT_MINUTES;
                chrome.alarms.create('snoozeFsrsReviews', { delayInMinutes: minutes });
                sendResponse({ success: true });
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                Logger.error('Background', `Error in snooze_notification: ${errorMessage}`, { message, err });
                sendResponse({ success: false, error: errorMessage });
            }
            return true;
        }

        // R3.6: Toggle weekly summary alarm
        if (message.action === 'toggle_weekly_summary') {
            (async () => {
                let success = false;
                let errorMessage: string | undefined;
                try {
                    await this.setupWeeklySummaryAlarm();
                    success = true;
                } catch (err) {
                    errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Background', `Error toggling weekly summary: ${errorMessage}`, { message, err });
                    // Comment: Return error payload to caller without failing SW execution
                } finally {
                    // Comment: Guarantee sendResponse execution in finally block
                    sendResponse(success ? { success: true } : { success: false, error: errorMessage });
                }
            })();
            return true;
        }

        if (message.action === 'test_summary_notification') {
            (async () => {
                let success = false;
                let errorMessage: string | undefined;
                try {
                    await this.handleWeeklySummary(true);
                    success = true;
                } catch (err) {
                    errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Background', `Error processing test_summary_notification: ${errorMessage}`, { message, err });
                } finally {
                    sendResponse(success ? { success: true } : { success: false, error: errorMessage });
                }
            })();
            return true;
        }

        if (message.action === 'pomodoro_action') {
            (async () => {
                let success = false;
                let errorMessage: string | undefined;
                try {
                    await this.handlePomodoroAction(message.payload as { command: string; state: PomodoroState });
                    success = true;
                } catch (err) {
                    errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Background', `Error handling pomodoro_action: ${errorMessage}`, { message, err });
                    // Comment: Return error status to pomodoro UI tab
                } finally {
                    // Comment: Always reply to caller to close messaging channel
                    sendResponse(success ? { success: true } : { success: false, error: errorMessage });
                }
            })();
            return true;
        }

        return false;
    }

    /**
     * Triggers a test notification. Attempts to deliver an in-page DOM alert inside the active tab
     * if it matches whitelisted coding domains; otherwise, triggers a standard system tray OS notification.
     */
    async showTestNotification(): Promise<void> {
        const result = await chrome.storage.local.get(['notificationSettings']);
        if (chrome.runtime.lastError) {
            Logger.error('Background', `Storage get error in showTestNotification: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
        }
        const settings: NotificationSettings = result.notificationSettings || {
            enabled: true,
            frequency: '60',
            priority: '2',
            requireInteraction: true
        };

        return new Promise<void>((resolve) => {
            try {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
                    try {
                        if (chrome.runtime.lastError) {
                            Logger.error('Background', `Tabs query error in showTestNotification: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
                        }
                        let handledInPage = false;
                        if (tabs && tabs[0] && tabs[0].id) {
                            const tab = tabs[0];
                            const isMatching = tab.url && (tab.url.includes('algo.monster') || tab.url.includes('systemdesignschool.io'));
                            if (isMatching && tab.id !== undefined) {
                                chrome.tabs.sendMessage(tab.id, {
                                    action: 'show_custom_notification',
                                    title: '🔔 Notification Test',
                                    message: `This is a test. Reviews check every ${settings.frequency} minutes.`,
                                    type: 'test'
                                }, (response?: MessageResponse) => {
                                    try {
                                        if (chrome.runtime.lastError || !response || !response.success) {
                                            this.createSystemTestNotification(settings);
                                        }
                                    } catch (err) {
                                        // Comment: Fallback to system notification on custom notification message error
                                        const errorMessage = err instanceof Error ? err.message : String(err);
                                        Logger.error('Background', `Error in test notification message callback: ${errorMessage}`, { err });
                                        this.createSystemTestNotification(settings);
                                    }
                                });
                                handledInPage = true;
                            }
                        }
                        if (!handledInPage) {
                            this.createSystemTestNotification(settings);
                        }
                    } catch (queryCallbackErr) {
                        // Comment: Safe recovery inside tabs query callback
                        const errorMessage = queryCallbackErr instanceof Error ? queryCallbackErr.message : String(queryCallbackErr);
                        Logger.error('Background', `Error in tabs query callback for showTestNotification: ${errorMessage}`, { queryCallbackErr });
                        this.createSystemTestNotification(settings);
                    } finally {
                        // Comment: Resolve promise once tabs query callback completes
                        resolve();
                    }
                });
            } catch (err) {
                // Comment: Safe recovery if chrome.tabs.query throws synchronously
                const errorMessage = err instanceof Error ? err.message : String(err);
                Logger.error('Background', `Failed to query tabs for showTestNotification: ${errorMessage}`, { err });
                this.createSystemTestNotification(settings);
                resolve();
            }
        });
    }

    /**
     * Helper to create and clear system tray notifications securely.
     */
    private dispatchSystemNotification(
        id: string,
        title: string,
        message: string,
        priority: number,
        requireInteraction: boolean
    ): void {
        try {
            chrome.notifications.clear(id, () => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('Background', `Error clearing notification ${id}: ${errorMessage}`, { error: chrome.runtime.lastError });
                    }
                    chrome.notifications.create(id, {
                        type: 'basic',
                        iconUrl: '../icons/icon.png',
                        title,
                        message,
                        priority,
                        requireInteraction
                    }, (createdId) => {
                        try {
                            if (chrome.runtime.lastError) {
                                const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                Logger.error('Background', `Notification ${id} Error: ${errorMessage}`, { error: chrome.runtime.lastError });
                            } else {
                                Logger.debug('Background', `Notification sent with ID: ${createdId}`);
                            }
                        } catch (createErr) {
                            const errorMessage = createErr instanceof Error ? createErr.message : String(createErr);
                            Logger.error('Background', `Error in notification ${id} create callback: ${errorMessage}`, { createErr });
                        }
                    });
                } catch (clearErr) {
                    const errorMessage = clearErr instanceof Error ? clearErr.message : String(clearErr);
                    Logger.error('Background', `Error handling notification ${id} clear callback: ${errorMessage}`, { clearErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Failed to create system notification ${id}: ${errorMessage}`, { err });
        }
    }

    /**
     * Generates and triggers a standard Google Chrome system tray test notification.
     * @param {NotificationSettings} settings - Active notification configurations.
     */
    createSystemTestNotification(settings: NotificationSettings): void {
        this.dispatchSystemNotification(
            'algo-test-notification',
            '🔔 Notification Test',
            `This is a test. Reviews will check every ${settings.frequency} minutes.`,
            parseInt(settings.priority || '2', 10) || 2,
            settings.requireInteraction !== false
        );
    }

    /**
     * Queries the list of scheduled cards in storage, filters due items, and prompts the user.
     * Delivers alerts either through an in-page notification frame or a native system notification.
     */
    async checkDueCards(source?: string): Promise<void> {
        if (this.isCheckingDueCards) {
            Logger.debug('Background', 'checkDueCards is already running, skipping duplicate invocation.');
            return;
        }
        this.isCheckingDueCards = true;
        try {
            const result = (await chrome.storage.local.get(['fsrsCards', 'notificationSettings', 'whitelistedWebsites', 'lastNotificationTime'])) as StorageData & {
                notificationSettings?: NotificationSettings;
                whitelistedWebsites?: WhitelistedWebsite[];
                lastNotificationTime?: number;
            };
            if (chrome.runtime.lastError) {
                Logger.error('Background', `Storage get error in checkDueCards: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
            }
            const settings: NotificationSettings = result.notificationSettings || {
                enabled: true,
                frequency: '60',
                priority: '2',
                requireInteraction: true
            };
            const whitelistedWebsites: WhitelistedWebsite[] = result.whitelistedWebsites || DEFAULT_WHITELISTED_WEBSITES;

            // Enforce minimum interval to bypass MV3 alarm bugs (like frequent re-triggering upon wake-up)
            // Allow explicit 'snoozeFsrsReviews' and 'test' source to bypass this throttle
            if (source !== 'snoozeFsrsReviews' && source !== 'test') {
                const interval = parseInt(settings.frequency || String(ALARM_DEFAULT_CHECK_INTERVAL_MIN), 10);
                const lastCheck = result.lastNotificationTime || 0;
                const now = Date.now();
                // 1-minute buffer to account for alarm timing drift
                if (now - lastCheck < (interval * 60000) - 60000) {
                    Logger.info('Background', `Skipping checkDueCards; interval of ${interval} minutes has not passed yet. Source: ${source}`);
                    return;
                }
            }

            // If notifications are disabled, do not notify
            if (settings.enabled === false) return;

            // R8.3 Quiet hours check
            if (settings.quietHoursEnabled) {
                const startStr = settings.quietHoursStart || '23:00';
                const endStr = settings.quietHoursEnd || '07:00';
                const nowTime = new Date();
                const currentHour = nowTime.getHours();
                const currentMinute = nowTime.getMinutes();
                const currentTotal = currentHour * 60 + currentMinute;

                const [startH, startM] = startStr.split(':').map(Number);
                const startTotal = startH * 60 + startM;

                const [endH, endM] = endStr.split(':').map(Number);
                const endTotal = endH * 60 + endM;

                if (startTotal <= endTotal) {
                    if (currentTotal >= startTotal && currentTotal < endTotal) {
                        Logger.debug('Background', 'Quiet hours active. Suppressing review notification.');
                        return;
                    }
                } else {
                    // Crosses midnight
                    if (currentTotal >= startTotal || currentTotal < endTotal) {
                        Logger.debug('Background', 'Quiet hours active (crosses midnight). Suppressing review notification.');
                        return;
                    }
                }
            }

            if (!result.fsrsCards || result.fsrsCards.length === 0) return;
            const now = Date.now();
            const dueCards = result.fsrsCards.filter((c: Card) => c.due <= now);

            if (dueCards.length > 0) {
                // R8.2: Notification grouping by tags
                const tagCounts: Record<string, number> = {};
                dueCards.forEach((c: Card) => {
                    if (c.tags && c.tags.length > 0) {
                        c.tags.forEach((t: string) => {
                            tagCounts[t] = (tagCounts[t] || 0) + 1;
                        });
                    } else {
                        tagCounts['Untagged'] = (tagCounts['Untagged'] || 0) + 1;
                    }
                });
                const tagStrs = Object.entries(tagCounts)
                    .sort((a, b) => b[1] - a[1]) // highest count first
                    .slice(0, 3) // top 3 tags
                    .map(([tag, count]) => `${count} ${tag}`);

                const groupMessage = tagStrs.length > 0
                    ? `You have ${tagStrs.join(', ')} patterns ready for review.`
                    : `You have ${dueCards.length} pattern(s) ready for review.`;

                // Record the time of this notification to enforce intervals across MV3 service worker restarts
                await chrome.storage.local.set({ lastNotificationTime: Date.now() });

                this.dispatchReviewNotification(dueCards.length, groupMessage, settings, whitelistedWebsites);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Error checking due cards: ${errorMessage}`, { err });
            // Comment: Non-fatal error during due card check, background worker recovers cleanly
        } finally {
            this.isCheckingDueCards = false;
        }
    }

    /**
     * Dispatches the review notification to the active tab if whitelisted, or falls back to system notification.
     * @param {number} dueCount - The number of cards currently due.
     * @param {string} groupMessage - The message string.
     * @param {NotificationSettings} settings - Active notification configurations.
     * @param {WhitelistedWebsite[]} whitelistedWebsites - User configured whitelist.
     */
    private dispatchReviewNotification(dueCount: number, groupMessage: string, settings: NotificationSettings, whitelistedWebsites: WhitelistedWebsite[]): void {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
            try {
                if (chrome.runtime.lastError) {
                    Logger.error('Background', `Tabs query error in dispatchReviewNotification: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
                }
                let handledInPage = false;
                if (tabs && tabs[0] && tabs[0].id) {
                    const tab = tabs[0];
                    const url = tab.url;
                    if (url) {
                        const isMatching = whitelistedWebsites.some(site => url.includes(site.domain));
                        if (isMatching && tab.id !== undefined) {
                            chrome.tabs.sendMessage(tab.id, {
                                action: 'show_custom_notification',
                                title: '🧠 AlgoRecall Reviews Due!',
                                message: groupMessage,
                                type: 'review',
                                count: dueCount
                            }, (response?: MessageResponse) => {
                                try {
                                    if (chrome.runtime.lastError || !response || !response.success) {
                                        this.createSystemReviewNotification(dueCount, settings, groupMessage);
                                    }
                                } catch (msgErr) {
                                    // Comment: Safe recovery in tabs message review notification callback
                                    const errorMessage = msgErr instanceof Error ? msgErr.message : String(msgErr);
                                    Logger.error('Background', `Error in review notification message callback: ${errorMessage}`, { msgErr });
                                    this.createSystemReviewNotification(dueCount, settings, groupMessage);
                                }
                            });
                            handledInPage = true;
                        }
                    }
                }
                if (!handledInPage) {
                    this.createSystemReviewNotification(dueCount, settings, groupMessage);
                }
            } catch (queryErr) {
                // Comment: Safe recovery in tabs query callback for dispatchReviewNotification
                const errorMessage = queryErr instanceof Error ? queryErr.message : String(queryErr);
                Logger.error('Background', `Error in tabs query callback for dispatchReviewNotification: ${errorMessage}`, { queryErr });
                this.createSystemReviewNotification(dueCount, settings, groupMessage);
            }
        });
    }

    /**
     * Triggers a native system alert signaling due cards are waiting for study.
     * @param {number} dueCount - The number of cards currently due.
     * @param {NotificationSettings} settings - Active notification configurations.
     * @param {string} message - The message string.
     */
    createSystemReviewNotification(dueCount: number, settings: NotificationSettings, message?: string): void {
        this.dispatchSystemNotification(
            'algo-review-notification',
            '🧠 AlgoRecall Reviews Due!',
            message || `You have ${dueCount} pattern(s) ready for review.`,
            parseInt(settings.priority || '2', 10) || 2,
            settings.requireInteraction !== false
        );
    }

    // ========================================================================
    // R3.6: Weekly Summary Notification
    // ========================================================================

    /**
     * Computes weekly review statistics and fires a digest notification.
     * Summarizes: reviews this week, active days, current streak, upcoming load.
     */
    async handleWeeklySummary(ignoreEnabledCheck: boolean = false): Promise<void> {
        try {
            const result = (await chrome.storage.local.get(['fsrsActivity', 'fsrsCards', 'weeklySummaryEnabled', 'notificationSettings'])) as StorageData & {
                weeklySummaryEnabled?: boolean;
                notificationSettings?: NotificationSettings;
            };
            if (chrome.runtime.lastError) {
                Logger.error('Background', `Storage get error in handleWeeklySummary: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
            }

            // Check if still enabled
            if (!ignoreEnabledCheck && result.weeklySummaryEnabled === false) return;

            const activity = result.fsrsActivity || {};
            const cards = result.fsrsCards || [];
            const now = Date.now();

            // Calculate this week's stats (last 7 days)
            let weekReviews = 0;
            let activeDays = 0;
            const today = new Date();

            for (let i = 0; i < 7; i++) {
                const checkDate = new Date(today);
                checkDate.setDate(checkDate.getDate() - i);
                const dateKey = new Date(checkDate.getTime() - (checkDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

                if (activity[dateKey] && activity[dateKey] > 0) {
                    weekReviews += activity[dateKey];
                    activeDays++;
                }
            }

            // Calculate previous week's stats for comparison
            let prevWeekReviews = 0;
            for (let i = 7; i < 14; i++) {
                const checkDate = new Date(today);
                checkDate.setDate(checkDate.getDate() - i);
                const dateKey = new Date(checkDate.getTime() - (checkDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

                if (activity[dateKey] && activity[dateKey] > 0) {
                    prevWeekReviews += activity[dateKey];
                }
            }

            // Upcoming load (cards due in next 7 days)
            const nextWeekEnd = now + MS_PER_WEEK;
            const upcomingDue = cards.filter((c: Card) => c.due > now && c.due <= nextWeekEnd).length;
            const currentlyDue = cards.filter((c: Card) => c.due <= now).length;

            // Build message
            const trend = weekReviews > prevWeekReviews ? '📈' : (weekReviews < prevWeekReviews ? '📉' : '➡️');
            const trendText = prevWeekReviews > 0
                ? ` ${trend} ${weekReviews > prevWeekReviews ? '+' : ''}${weekReviews - prevWeekReviews} vs last week.`
                : '';

            const message = `This week: ${weekReviews} reviews across ${activeDays} day(s).${trendText} Upcoming: ${upcomingDue} cards due next week${currentlyDue > 0 ? `, ${currentlyDue} overdue now` : ''}.`;

            const settings: NotificationSettings = result.notificationSettings || {};
            
            this.dispatchSystemNotification(
                'algo-weekly-summary',
                '📊 AlgoRecall Weekly Summary',
                message,
                2,
                settings.requireInteraction !== false
            );

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            Logger.error('Background', "Error generating weekly summary", { error, errorMessage });
            // Comment: Recover gracefully from weekly summary digest generation errors
        }
    }

    /**
     * R8.4: Motivational nudges. Check if the user has done any reviews today.
     * If not, send an encouraging push notification to keep the streak alive.
     */
    async handleDailyNudge(): Promise<void> {
        try {
            const result = (await chrome.storage.local.get(['fsrsActivity', 'notificationSettings'])) as StorageData & {
                notificationSettings?: NotificationSettings;
            };
            if (chrome.runtime.lastError) {
                Logger.error('Background', `Storage get error in handleDailyNudge: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
            }
            const settings: NotificationSettings = result.notificationSettings || {};
            if (settings.enabled === false) return;

            const activity = result.fsrsActivity || {};
            const today = new Date();
            const dateKey = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

            if (!activity[dateKey] || activity[dateKey] === 0) {
                // Determine if user has an active streak (activity yesterday)
                const yesterdayMs = today.getTime() - MS_PER_DAY;
                const yesterdayKey = new Date(yesterdayMs - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                const hasActiveStreak = !!(activity[yesterdayKey] && activity[yesterdayKey] > 0);

                const title = hasActiveStreak
                    ? '🔥 Keep Your Streak Alive!'
                    : '🚀 Start a New Streak Today!';
                const message = hasActiveStreak
                    ? "You haven't reviewed any patterns today. Just 5 minutes can keep your memory sharp!"
                    : "Every expert was once a beginner. Start fresh with just 5 minutes of review!";

                this.dispatchSystemNotification(
                    'algo-daily-nudge',
                    title,
                    message,
                    2,
                    settings.requireInteraction !== false
                );
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            Logger.error('Background', "Error generating daily nudge", { error, errorMessage });
            // Comment: Recover gracefully from daily nudge generation errors
        }
    }

    /**
     * Routes redirection actions when users click a native desktop tray notification.
     * @param {string} notificationId - The clicked notification ID.
     */
    handleNotificationClicked(notificationId: string): void {
        try {
            if (notificationId === 'pomodoro-complete') {
                chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/pomodoro/pomodoro.html') });
            } else if (notificationId === 'algo-weekly-summary') {
                chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/summary/summary.html') });
            } else {
                chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/popup/popup.html') });
            }
            chrome.notifications.clear(notificationId, () => {
                if (chrome.runtime.lastError) {
                    Logger.error('Background', `Notification clear error in handleNotificationClicked: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Error in handleNotificationClicked: ${errorMessage}`, { notificationId, err });
            // Comment: Non-fatal notification click handler catch
        }
    }

    // ========================================================================
    // Persistent Pomodoro Timer Logic
    // ========================================================================

    async resumePomodoroBackground(): Promise<void> {
        try {
            const result = (await chrome.storage.local.get(['pomodoroState'])) as { pomodoroState?: PomodoroState };
            if (chrome.runtime.lastError) {
                Logger.error('Background', `Storage get error in resumePomodoroBackground: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
            }
            if (result.pomodoroState && result.pomodoroState.state === 'running') {
                const now = Date.now();
                if (result.pomodoroState.targetEndTime <= now) {
                    // Service worker was sleeping when pomodoro ended
                    await this.handlePomodoroEnd();
                } else {
                    this.startPomodoroTick(result.pomodoroState);
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Failed to resume pomodoro background state: ${errorMessage}`, { err });
            // Comment: Catch storage read failure on service worker boot gracefully
        }
    }

    async handlePomodoroAction(payload: { command: string; state: PomodoroState }): Promise<void> {
        try {
            const { command, state } = payload;

            if (command === 'start' || command === 'resume') {
                this.startPomodoroTick(state);

                // Set alarm for exact end time to ensure we never miss it if SW sleeps
                const delayInMinutes = Math.max(0.1, (state.targetEndTime - Date.now()) / 60000);
                chrome.alarms.create('pomodoroEnd', { delayInMinutes });

            } else if (command === 'pause' || command === 'reset' || command === 'skip') {
                this.stopPomodoroTick();
                chrome.alarms.clear('pomodoroEnd');
                this._lastPomodoroTitle = null; // Clear title cache so it resets properly when starting again
                this._lastPomodoroBadge = null;
                this._lastPomodoroColor = null;

                if (command === 'reset' || command === 'skip') {
                    chrome.action.setBadgeText({ text: '' });
                    chrome.action.setTitle({ title: 'AlgoRecall Dashboard' });
                } else if (command === 'pause') {
                    chrome.action.setBadgeBackgroundColor({ color: '#95a5a6' });
                    chrome.action.setTitle({ title: 'AlgoRecall (Paused)' });
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Error handling pomodoro action ${payload?.command}: ${errorMessage}`, { payload, err });
            // Comment: Re-throwing error after logging so caller (e.g. handleMessage) receives failure signal
            throw err;
        }
    }

    startPomodoroTick(state: PomodoroState): void {
        this.stopPomodoroTick();

        const tick = () => {
            try {
                const timeRemaining = Math.max(0, Math.ceil((state.targetEndTime - Date.now()) / 1000));
                const minutes = Math.floor(timeRemaining / 60);
                const seconds = timeRemaining % 60;

                const badgeText = minutes > 0 ? `${minutes}m` : `${seconds}s`;
                const phaseTitle = state.phase === 'focus' ? 'Focus' : state.phase === 'shortBreak' ? 'Short Break' : 'Long Break';

                if (this._lastPomodoroBadge !== badgeText) {
                    chrome.action.setBadgeText({ text: badgeText });
                    this._lastPomodoroBadge = badgeText;
                }

                const badgeColor = state.phase === 'focus' ? '#e74c3c' : '#2ecc71';
                if (this._lastPomodoroColor !== badgeColor) {
                    chrome.action.setBadgeBackgroundColor({ color: badgeColor });
                    this._lastPomodoroColor = badgeColor;
                }

                const newTitle = `AlgoRecall: ${phaseTitle}`;
                if (this._lastPomodoroTitle !== newTitle) {
                    chrome.action.setTitle({ title: newTitle });
                    this._lastPomodoroTitle = newTitle;
                }

                if (timeRemaining <= 0) {
                    this.stopPomodoroTick();
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                Logger.error('Background', `Error during pomodoro tick: ${errorMessage}`, { err });
                // Comment: Stop tick interval if Chrome Extension action API fails
                this.stopPomodoroTick();
            }
        };

        tick(); // Immediate tick
        this.pomodoroIntervalId = setInterval(tick, 1000);
    }

    stopPomodoroTick(): void {
        try {
            if (this.pomodoroIntervalId) {
                clearInterval(this.pomodoroIntervalId);
                this.pomodoroIntervalId = null;
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Error stopping pomodoro tick interval: ${errorMessage}`, { err });
            // Comment: Non-fatal timer cleanup error catch
        }
    }

    async handlePomodoroEnd(): Promise<void> {
        try {
            const result = (await chrome.storage.local.get(['pomodoroState', 'pomodoroSettings', 'pomodoroStats', 'notificationSettings'])) as {
                pomodoroState?: PomodoroState;
                pomodoroSettings?: PomodoroSettings;
                pomodoroStats?: PomodoroStats;
                notificationSettings?: NotificationSettings;
            };
            if (chrome.runtime.lastError) {
                Logger.error('Background', `Storage get error in handlePomodoroEnd: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
            }
            const state: PomodoroState | undefined = result.pomodoroState;
            if (!state || state.state !== 'running') return;

            this.stopPomodoroTick();

            // Track stats
            const stats: PomodoroStats = result.pomodoroStats || { sessionsToday: 0, focusMinutesToday: 0, lastDate: new Date().toLocaleDateString() };
            if (stats.lastDate !== new Date().toLocaleDateString()) {
                stats.sessionsToday = 0;
                stats.focusMinutesToday = 0;
                stats.lastDate = new Date().toLocaleDateString();
            }

            if (state.phase === 'focus') {
                stats.sessionsToday++;
                const settings: PomodoroSettings = result.pomodoroSettings || { focusDuration: 25, sessionsBeforeLongBreak: 4, shortBreakDuration: 5, longBreakDuration: 15 };
                stats.focusMinutesToday += settings.focusDuration;
            }

            // Advance Phase
            const settings: PomodoroSettings = result.pomodoroSettings || { sessionsBeforeLongBreak: 4, focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15 };
            if (state.phase === 'focus') {
                if (state.currentSession >= settings.sessionsBeforeLongBreak) {
                    state.phase = 'longBreak';
                } else {
                    state.phase = 'shortBreak';
                }
            } else {
                if (state.phase === 'longBreak') {
                    state.currentSession = 1;
                } else {
                    state.currentSession++;
                }
                state.phase = 'focus';
            }

            state.state = 'idle';

            // Save to storage (UI will pick it up)
            await chrome.storage.local.set({ pomodoroState: state, pomodoroStats: stats });
            if (chrome.runtime.lastError) {
                Logger.error('Background', `Storage set error in handlePomodoroEnd: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
            }

            const settingsNotif: NotificationSettings = result.notificationSettings || {};

            // Notify user
            this.dispatchSystemNotification(
                'pomodoro-complete',
                '⏱️ Pomodoro Complete!',
                `Time is up! Ready for ${state.phase === 'focus' ? 'Focus Time' : 'a Break'}?`,
                2,
                settingsNotif.requireInteraction !== false
            );

            chrome.action.setBadgeText({ text: '' });
            chrome.action.setTitle({ title: 'AlgoRecall Dashboard' });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Background', `Error handling pomodoro end: ${errorMessage}`, { err });
            // Comment: Non-fatal error on pomodoro completion handler
        }
    }
}

try {
    new AlgoRecallBackground();
} catch (err) {
    // Comment: Safe recovery during top-level background worker instantiation
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('Background', `Failed to instantiate AlgoRecallBackground: ${errorMessage}`, { err });
}
