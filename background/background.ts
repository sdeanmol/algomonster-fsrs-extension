/**
 * @file background/background.ts
 * @description Extension background service worker (Manifest V3) implemented as an OOP class.
 * Manages background alarms for checking scheduled card due times, schedules/delivers OS notifications,
 * handles custom whitelisted website routing messages, reacts to SPA client-side history state updates,
 * and sends weekly summary digest notifications (R3.6).
 */
import '../features/common/logger';

const Logger = (globalThis as any).Logger;

(self as any).onerror = function(message: any, source?: string, lineno?: number, colno?: number, error?: Error) {
    if (Logger) {
        Logger.error('Background', 'Unhandled runtime error', { message, source, lineno, colno, error });
    }
    return false;
};

(self as any).onunhandledrejection = function(event: PromiseRejectionEvent) {
    if (Logger) {
        Logger.error('Background', 'Unhandled promise rejection', event.reason);
    }
};

export interface NotificationSettings {
    enabled?: boolean;
    frequency?: string;
    priority?: string;
    requireInteraction?: boolean;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string;
    quietHoursEnd?: string;
}

export interface WhitelistedWebsite {
    domain: string;
}

export interface PomodoroState {
    state: 'idle' | 'running' | 'paused';
    phase: 'focus' | 'shortBreak' | 'longBreak';
    targetEndTime: number;
    currentSession: number;
}

export interface PomodoroSettings {
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    sessionsBeforeLongBreak: number;
}

export interface PomodoroStats {
    sessionsToday: number;
    focusMinutesToday: number;
    lastDate: string;
}

export class AlgoRecallBackground {
    private pomodoroIntervalId: any = null;
    private _lastPomodoroTitle: string | null = null;
    private _lastPomodoroBadge: string | null = null;
    private _lastPomodoroColor: string | null = null;

    constructor() {
        this.init();
    }

    /**
     * Initializes the service worker listeners and settings.
     */
    async init(): Promise<void> {
        if (Logger) {
            Logger.info('Background', 'Initializing background service worker...');
            Logger.time('Background', 'Startup');
        }
        this.bindEvents();
        await this.resumePomodoroBackground();
        if (Logger) {
            Logger.timeEnd('Background', 'Startup');
        }
    }

    /**
     * Binds all Chrome API event listeners.
     */
    bindEvents(): void {
        chrome.runtime.onInstalled.addListener(this.handleInstalled.bind(this));
        chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
        chrome.webNavigation.onHistoryStateUpdated.addListener(this.handleHistoryStateUpdated.bind(this));
        chrome.storage.onChanged.addListener(this.handleStorageChanged.bind(this));
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
        chrome.notifications.onClicked.addListener(this.handleNotificationClicked.bind(this));
    }

    /**
     * Handles extension installation event.
     * @param {chrome.runtime.InstalledDetails} details - Details of install event.
     */
    async handleInstalled(details?: chrome.runtime.InstalledDetails): Promise<void> {
        // Initialize default notification settings if they don't exist
        const result = await chrome.storage.local.get(['notificationSettings']);
        if (!result.notificationSettings) {
            await chrome.storage.local.set({
                notificationSettings: {
                    enabled: true,
                    frequency: '60',
                    priority: '2',
                    requireInteraction: true
                }
            });
        }

        await this.setupAlarm();
        await this.setupWeeklySummaryAlarm();
        await this.setupDailyNudgeAlarm();
        if (Logger) {
            Logger.debug('Background', `Extension installed/updated. Reason: ${details ? details.reason : 'unknown'}`);
        }
        
        // Redirect to Onboarding Welcome page on initial install (and update for debugging)
        if (details && (details.reason === 'install' || details.reason === 'update')) {
            chrome.tabs.create({ url: chrome.runtime.getURL('features/common/welcome/welcome.html') });
        } else {
            chrome.notifications.create('test-install', {
                type: 'basic',
                iconUrl: '../icons/icon.png', // Relative path from service worker
                title: 'AlgoRecall Active 🧠',
                message: 'Notifications are working! You will be alerted when reviews are due.',
                priority: 2
            }, (id) => {
                if (chrome.runtime.lastError) {
                    if (Logger) Logger.error('Background', "Notification failed to send", chrome.runtime.lastError.message);
                } else {
                    if (Logger) Logger.debug('Background', `Test install notification sent with ID: ${id}`);
                }
            });
        }

        await this.checkDueCards();
    }

    /**
     * Handles incoming background alarm trigger events.
     * @param {chrome.alarms.Alarm} alarm - Fired alarm details.
     */
    handleAlarm(alarm: chrome.alarms.Alarm): void {
        if (alarm.name === 'checkFsrsReviews' || alarm.name === 'snoozeFsrsReviews' || alarm.name === 'smartReviewSchedule') {
            this.checkDueCards();
        } else if (alarm.name === 'weeklySummary') {
            this.handleWeeklySummary();
        } else if (alarm.name === 'dailyNudge') {
            this.handleDailyNudge();
        } else if (alarm.name === 'pomodoroEnd') {
            this.handlePomodoroEnd();
        }
    }

    /**
     * Handles SPA Client-Side Routing for Highlighter updates.
     * @param {chrome.webNavigation.WebNavigationSourceCallbackDetails} details - Navigation history update details.
     */
    handleHistoryStateUpdated(details: chrome.webNavigation.WebNavigationSourceCallbackDetails): void {
        if (Logger) Logger.debug('Background', `History state updated for tab ${details.tabId}`, { url: details.url });
        chrome.tabs.sendMessage(details.tabId, { 
            action: "spa_url_changed", 
            url: details.url 
        }).catch((e) => {
            if (Logger) Logger.debug('Background', `Failed to send spa_url_changed to tab ${details.tabId} (it might not be a whitelisted site or script not injected yet).`);
        });
    }

    /**
     * Reads user configurations from storage and schedules/reschedules the review check alarms.
     */
    async setupAlarm(): Promise<void> {
        const result = await chrome.storage.local.get(['notificationSettings', 'fsrsActivity']);
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
            const interval = parseInt(settings.frequency || '60', 10);
            if (!isNaN(interval) && interval > 0) {
                chrome.alarms.create('checkFsrsReviews', { periodInMinutes: interval });
                if (Logger) Logger.info('Background', `Scheduled checkFsrsReviews alarm every ${interval} minutes.`);
            } else {
                // If frequency is invalid (or set to 'smart' if we had one), fall back to 1 hour
                chrome.alarms.create('checkFsrsReviews', { periodInMinutes: 60 });
                if (Logger) Logger.info('Background', `Scheduled checkFsrsReviews alarm every 60 minutes (fallback).`);
            }
            
            // R8.1 Smart Scheduling: Also schedule a daily check at their most active study hour
            const now = new Date();
            const smartTarget = new Date(now);
            smartTarget.setHours(17, 0, 0, 0);
            if (smartTarget <= now) smartTarget.setDate(smartTarget.getDate() + 1);
            
            const delayInMinutes = Math.max(1, Math.ceil((smartTarget.getTime() - now.getTime()) / 60000));
            chrome.alarms.create('smartReviewSchedule', { delayInMinutes, periodInMinutes: 1440 });
            if (Logger) Logger.info('Background', `Scheduled smartReviewSchedule alarm daily at 17:00.`);
            
        } else {
            if (Logger) Logger.info('Background', `Notifications are disabled, cleared review alarms.`);
        }
    }

    /**
     * R3.6: Sets up the weekly summary alarm.
     * Fires every Monday at 9:00 AM local time (approximately).
     */
    async setupWeeklySummaryAlarm(): Promise<void> {
        const result = await chrome.storage.local.get(['weeklySummaryEnabled']);
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
            const delayMinutes = Math.max(1, Math.ceil(delayMs / (1000 * 60)));

            // Period: 7 days = 10080 minutes
            chrome.alarms.create('weeklySummary', {
                delayInMinutes: delayMinutes,
                periodInMinutes: 10080
            });
        }
    }

    /**
     * R8.4: Sets up the daily nudge alarm.
     * Fires every day at 8:00 PM (20:00).
     */
    async setupDailyNudgeAlarm(): Promise<void> {
        await chrome.alarms.clear('dailyNudge');
        const now = new Date();
        const target = new Date(now);
        target.setHours(20, 0, 0, 0);
        if (target <= now) {
            target.setDate(target.getDate() + 1);
        }
        const delayInMinutes = Math.max(1, Math.ceil((target.getTime() - now.getTime()) / 60000));
        chrome.alarms.create('dailyNudge', { delayInMinutes, periodInMinutes: 1440 });
        if (Logger) Logger.info('Background', `Scheduled dailyNudge alarm at 20:00.`);
    }

    /**
     * Watches for changes in settings to dynamically reschedule the alarm.
     * @param {{ [key: string]: chrome.storage.StorageChange }} changes - Object describing key storage differences.
     * @param {string} areaName - The name of the storage area.
     */
    async handleStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): Promise<void> {
        if (areaName === 'local' && changes.notificationSettings) {
            await this.setupAlarm();
        }
        if (areaName === 'local' && changes.weeklySummaryEnabled) {
            await this.setupWeeklySummaryAlarm();
        }
    }

    /**
     * Coordinates background script runtime communication channels.
     * @param {any} message - Received payload object.
     * @param {chrome.runtime.MessageSender} sender - Messaging sender metadata.
     * @param {(response?: any) => void} sendResponse - Callback for routing replies.
     */
    handleMessage(message: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void): boolean | void {
        if (Logger) Logger.debug('Background', `Received message: ${message.action}`, { senderId: sender.id, tabId: sender.tab?.id });
        if (message.action === 'test_notification') {
            (async () => {
                try {
                    await this.showTestNotification();
                    sendResponse({ success: true });
                } catch (err: any) {
                    if (Logger) Logger.error('Background', `Error in test_notification`, err);
                    sendResponse({ success: false, error: err.message });
                }
            })();
            return true; // Keep message channel open for async response
        }
        if (message.action === 'open_fullscreen_editor') {
            let targetUrl = 'features/tracker/editor/editor.html?url=' + encodeURIComponent(message.url);
            if (message.cardId) {
                targetUrl += '&cardId=' + encodeURIComponent(message.cardId);
            }
            chrome.tabs.create({ url: chrome.runtime.getURL(targetUrl) });
            sendResponse({ success: true });
            return true;
        }
        if (message.action === 'snooze_notification') {
            const minutes = message.minutes || 15;
            chrome.alarms.create('snoozeFsrsReviews', { delayInMinutes: minutes });
            sendResponse({ success: true });
            return true;
        }
        // R3.6: Toggle weekly summary alarm
        if (message.action === 'toggle_weekly_summary') {
            (async () => {
                await this.setupWeeklySummaryAlarm();
                sendResponse({ success: true });
            })();
            return true;
        }
        if (message.action === 'pomodoro_action') {
            this.handlePomodoroAction(message.payload);
            sendResponse({ success: true });
            return true;
        }
    }

    /**
     * Triggers a test notification. Attempts to deliver an in-page DOM alert inside the active tab
     * if it matches whitelisted coding domains; otherwise, triggers a standard system tray OS notification.
     */
    async showTestNotification(): Promise<void> {
        const result = await chrome.storage.local.get(['notificationSettings']);
        const settings: NotificationSettings = result.notificationSettings || {
            enabled: true,
            frequency: '60',
            priority: '2',
            requireInteraction: true
        };

        return new Promise<void>((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
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
                        }, (response: any) => {
                            if (chrome.runtime.lastError || !response || !response.success) {
                                this.createSystemTestNotification(settings);
                            }
                        });
                        handledInPage = true;
                    }
                }
                if (!handledInPage) {
                    this.createSystemTestNotification(settings);
                }
                resolve();
            });
        });
    }

    /**
     * Generates and triggers a standard Google Chrome system tray test notification.
     * @param {NotificationSettings} settings - Active notification configurations.
     */
    createSystemTestNotification(settings: NotificationSettings): void {
        chrome.notifications.clear('algo-test-notification', () => {
            chrome.notifications.create('algo-test-notification', {
                type: 'basic',
                iconUrl: '../icons/icon.png',
                title: '🔔 Notification Test',
                message: `This is a test. Reviews will check every ${settings.frequency} minutes.`,
                priority: parseInt(settings.priority || '2', 10) || 2,
                requireInteraction: settings.requireInteraction !== false
            }, (id) => {
                if (chrome.runtime.lastError) {
                    if (Logger) Logger.error('Background', "Test Notification Error", chrome.runtime.lastError.message);
                } else {
                    if (Logger) Logger.debug('Background', `System test notification sent with ID: ${id}`);
                }
            });
        });
    }

    /**
     * Queries the list of scheduled cards in storage, filters due items, and prompts the user.
     * Delivers alerts either through an in-page notification frame or a native system notification.
     */
    async checkDueCards(): Promise<void> {
        const result = await chrome.storage.local.get(['fsrsCards', 'notificationSettings', 'whitelistedWebsites']);
        const settings: NotificationSettings = result.notificationSettings || {
            enabled: true,
            frequency: '60',
            priority: '2',
            requireInteraction: true
        };
        const whitelistedWebsites: WhitelistedWebsite[] = result.whitelistedWebsites || [
            { domain: "algo.monster" },
            { domain: "systemdesignschool.io" },
            { domain: "codeforces.com" },
            { domain: "leetcode.com" },
            { domain: "codechef.com" },
            { domain: "atcoder.jp" },
            { domain: "hackerrank.com" },
            { domain: "hackerearth.com" },
            { domain: "codewars.com" },
            { domain: "codingame.com" }
        ];

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
                    if (Logger) Logger.debug('Background', 'Quiet hours active. Suppressing review notification.');
                    return;
                }
            } else {
                // Crosses midnight
                if (currentTotal >= startTotal || currentTotal < endTotal) {
                    if (Logger) Logger.debug('Background', 'Quiet hours active (crosses midnight). Suppressing review notification.');
                    return;
                }
            }
        }

        if (!result.fsrsCards || result.fsrsCards.length === 0) return;
        const now = Date.now();
        const dueCards = result.fsrsCards.filter((c: any) => c.due <= now);

        if (dueCards.length > 0) {
            // R8.2: Notification grouping by tags
            const tagCounts: { [tag: string]: number } = {};
            dueCards.forEach((c: any) => {
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

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
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
                                count: dueCards.length
                            }, (response: any) => {
                                if (chrome.runtime.lastError || !response || !response.success) {
                                    this.createSystemReviewNotification(dueCards.length, settings, groupMessage);
                                }
                            });
                            handledInPage = true;
                        }
                    }
                }
                if (!handledInPage) {
                    this.createSystemReviewNotification(dueCards.length, settings, groupMessage);
                }
            });
        }
    }

    /**
     * Triggers a native system alert signaling due cards are waiting for study.
     * @param {number} dueCount - The number of cards currently due.
     * @param {NotificationSettings} settings - Active notification configurations.
     * @param {string} message - The message string.
     */
    createSystemReviewNotification(dueCount: number, settings: NotificationSettings, message?: string): void {
        chrome.notifications.clear('algo-review-notification', () => {
            chrome.notifications.create('algo-review-notification', {
                type: 'basic',
                iconUrl: '../icons/icon.png',
                title: '🧠 AlgoRecall Reviews Due!',
                message: message || `You have ${dueCount} pattern(s) ready for review.`,
                priority: parseInt(settings.priority || '2', 10) || 2,
                requireInteraction: settings.requireInteraction !== false
            }, (id) => {
                if (chrome.runtime.lastError) {
                    if (Logger) Logger.error('Background', "Review Notification Error", chrome.runtime.lastError.message);
                } else {
                    if (Logger) Logger.debug('Background', `System review notification sent with ID: ${id}`);
                }
            });
        });
    }

    // ========================================================================
    // R3.6: Weekly Summary Notification
    // ========================================================================

    /**
     * Computes weekly review statistics and fires a digest notification.
     * Summarizes: reviews this week, active days, current streak, upcoming load.
     */
    async handleWeeklySummary(): Promise<void> {
        try {
            const result = await chrome.storage.local.get(['fsrsActivity', 'fsrsCards', 'weeklySummaryEnabled']);
            
            // Check if still enabled
            if (result.weeklySummaryEnabled === false) return;

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
            const nextWeekEnd = now + (7 * 24 * 60 * 60 * 1000);
            const upcomingDue = cards.filter((c: any) => c.due > now && c.due <= nextWeekEnd).length;
            const currentlyDue = cards.filter((c: any) => c.due <= now).length;

            // Build message
            const trend = weekReviews > prevWeekReviews ? '📈' : (weekReviews < prevWeekReviews ? '📉' : '➡️');
            const trendText = prevWeekReviews > 0
                ? ` ${trend} ${weekReviews > prevWeekReviews ? '+' : ''}${weekReviews - prevWeekReviews} vs last week.`
                : '';

            const message = `This week: ${weekReviews} reviews across ${activeDays} day(s).${trendText} Upcoming: ${upcomingDue} cards due next week${currentlyDue > 0 ? `, ${currentlyDue} overdue now` : ''}.`;

            chrome.notifications.create('algo-weekly-summary', {
                type: 'basic',
                iconUrl: '../icons/icon.png',
                title: '📊 AlgoRecall Weekly Summary',
                message: message,
                priority: 1,
                requireInteraction: false
            }, (id) => {
                if (chrome.runtime.lastError) {
                    if (Logger) Logger.error('Background', "Weekly Summary Notification Error", chrome.runtime.lastError.message);
                } else {
                    if (Logger) Logger.debug('Background', `Weekly summary notification sent with ID: ${id}`);
                }
            });

        } catch (error) {
            if (Logger) Logger.error('Background', "Error generating weekly summary", error);
        }
    }

    /**
     * R8.4: Motivational nudges. Check if the user has done any reviews today.
     * If not, send an encouraging push notification to keep the streak alive.
     */
    async handleDailyNudge(): Promise<void> {
        try {
            const result = await chrome.storage.local.get(['fsrsActivity', 'notificationSettings']);
            const settings: NotificationSettings = result.notificationSettings || {};
            if (settings.enabled === false) return;

            const activity = result.fsrsActivity || {};
            const today = new Date();
            const dateKey = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

            if (!activity[dateKey] || activity[dateKey] === 0) {
                chrome.notifications.create('algo-daily-nudge', {
                    type: 'basic',
                    iconUrl: '../icons/icon.png',
                    title: '🔥 Keep Your Streak Alive!',
                    message: "You haven't reviewed any patterns today. Just 5 minutes can keep your memory sharp!",
                    priority: 2,
                    requireInteraction: false
                }, (id) => {
                    if (chrome.runtime.lastError) {
                        if (Logger) Logger.error('Background', "Daily Nudge Notification Error", chrome.runtime.lastError.message);
                    } else {
                        if (Logger) Logger.debug('Background', `Daily nudge notification sent with ID: ${id}`);
                    }
                });
            }
        } catch (error) {
            if (Logger) Logger.error('Background', "Error generating daily nudge", error);
        }
    }

    /**
     * Routes redirection actions when users click a native desktop tray notification.
     * @param {string} notificationId - The clicked notification ID.
     */
    handleNotificationClicked(notificationId: string): void {
        if (notificationId === 'pomodoro-complete') {
            chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/pomodoro/pomodoro.html') });
        } else {
            chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/popup/popup.html') });
        }
        chrome.notifications.clear(notificationId);
    }

    // ========================================================================
    // Persistent Pomodoro Timer Logic
    // ========================================================================

    async resumePomodoroBackground(): Promise<void> {
        const result = await chrome.storage.local.get(['pomodoroState']);
        if (result.pomodoroState && result.pomodoroState.state === 'running') {
            this.startPomodoroTick(result.pomodoroState);
        }
    }

    async handlePomodoroAction(payload: any): Promise<void> {
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
    }

    startPomodoroTick(state: PomodoroState): void {
        this.stopPomodoroTick();
        
        const tick = () => {
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
        };
        
        tick(); // Immediate tick
        this.pomodoroIntervalId = setInterval(tick, 1000);
    }

    stopPomodoroTick(): void {
        if (this.pomodoroIntervalId) {
            clearInterval(this.pomodoroIntervalId);
            this.pomodoroIntervalId = null;
        }
    }

    async handlePomodoroEnd(): Promise<void> {
        const result = await chrome.storage.local.get(['pomodoroState', 'pomodoroSettings', 'pomodoroStats']);
        const state: PomodoroState = result.pomodoroState;
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
        
        // Notify user
        chrome.notifications.create('pomodoro-complete', {
            type: 'basic',
            iconUrl: '../icons/icon.png',
            title: '⏱️ Pomodoro Complete!',
            message: `Time is up! Ready for ${state.phase === 'focus' ? 'Focus Time' : 'a Break'}?`,
            priority: 2,
            requireInteraction: true
        });
        
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setTitle({ title: 'AlgoRecall Dashboard' });
    }
}

new AlgoRecallBackground();
