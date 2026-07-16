/**
 * @file background/background.js
 * @description Extension background service worker (Manifest V3) implemented as an OOP class.
 * Manages background alarms for checking scheduled card due times, schedules/delivers OS notifications,
 * handles custom whitelisted website routing messages, reacts to SPA client-side history state updates,
 * and sends weekly summary digest notifications (R3.6).
 */
import '../features/common/logger.js';
const Logger = globalThis.Logger;

self.onerror = function(message, source, lineno, colno, error) {
    Logger.error('Background', 'Unhandled runtime error', { message, source, lineno, colno, error });
    return false;
};

self.onunhandledrejection = function(event) {
    Logger.error('Background', 'Unhandled promise rejection', event.reason);
};

class AlgoRecallBackground {
    constructor() {
        this.init();
    }

    /**
     * Initializes the service worker listeners and settings.
     */
    async init() {
        Logger.info('Background', 'Initializing background service worker...');
        Logger.time('Background', 'Startup');
        this.bindEvents();
        this.resumePomodoroBackground();
        Logger.timeEnd('Background', 'Startup');
    }

    /**
     * Binds all Chrome API event listeners.
     */
    bindEvents() {
        chrome.runtime.onInstalled.addListener(this.handleInstalled.bind(this));
        chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
        chrome.webNavigation.onHistoryStateUpdated.addListener(this.handleHistoryStateUpdated.bind(this));
        chrome.storage.onChanged.addListener(this.handleStorageChanged.bind(this));
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
        chrome.notifications.onClicked.addListener(this.handleNotificationClicked.bind(this));
    }

    /**
     * Handles extension installation event.
     * @param {Object} details - Details of install event.
     */
    async handleInstalled(details) {
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
        Logger.debug('Background', `Extension installed/updated. Reason: ${details ? details.reason : 'unknown'}`);
        
        // Redirect to Onboarding Welcome page on initial install
        if (details && details.reason === 'install') {
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
                    Logger.error('Background', "Notification failed to send", chrome.runtime.lastError.message);
                } else {
                    Logger.debug('Background', `Test install notification sent with ID: ${id}`);
                }
            });
        }

        await this.checkDueCards();
    }

    /**
     * Handles incoming background alarm trigger events.
     * @param {Object} alarm - Fired alarm details.
     */
    handleAlarm(alarm) {
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
     * @param {Object} details - Navigation history update details.
     */
    handleHistoryStateUpdated(details) {
        Logger.debug('Background', `History state updated for tab ${details.tabId}`, { url: details.url });
        chrome.tabs.sendMessage(details.tabId, { 
            action: "spa_url_changed", 
            url: details.url 
        }).catch((e) => {
            Logger.debug('Background', `Failed to send spa_url_changed to tab ${details.tabId} (it might not be a whitelisted site or script not injected yet).`);
        });
    }

    /**
     * Reads user configurations from storage and schedules/reschedules the review check alarms.
     */
    async setupAlarm() {
        const result = await chrome.storage.local.get(['notificationSettings', 'fsrsActivity']);
        const settings = result.notificationSettings || {
            enabled: true,
            frequency: '60',
            priority: '2',
            requireInteraction: true
        };

        await chrome.alarms.clear('checkFsrsReviews');
        await chrome.alarms.clear('snoozeFsrsReviews');
        await chrome.alarms.clear('smartReviewSchedule');

        if (settings.enabled) {
            const interval = parseInt(settings.frequency, 10);
            if (!isNaN(interval) && interval > 0) {
                chrome.alarms.create('checkFsrsReviews', { periodInMinutes: interval });
                Logger.info('Background', `Scheduled checkFsrsReviews alarm every ${interval} minutes.`);
            } else {
                // If frequency is invalid (or set to 'smart' if we had one), fall back to 1 hour
                chrome.alarms.create('checkFsrsReviews', { periodInMinutes: 60 });
                Logger.info('Background', `Scheduled checkFsrsReviews alarm every 60 minutes (fallback).`);
            }
            
            // R8.1 Smart Scheduling: Also schedule a daily check at their most active study hour
            const activity = result.fsrsActivity || {};
            const hourCounts = new Array(24).fill(0);
            let hasActivity = false;
            // fsrsActivity structure is { 'YYYY-MM-DD': count }. Wait, we don't have hour data in fsrsActivity!
            // If we don't have hour data, we can just default to 5 PM for smart scheduling.
            // Let's schedule a smart review at 17:00 daily
            const now = new Date();
            const smartTarget = new Date(now);
            smartTarget.setHours(17, 0, 0, 0);
            if (smartTarget <= now) smartTarget.setDate(smartTarget.getDate() + 1);
            
            const delayInMinutes = Math.max(1, Math.ceil((smartTarget.getTime() - now.getTime()) / 60000));
            chrome.alarms.create('smartReviewSchedule', { delayInMinutes, periodInMinutes: 1440 });
            Logger.info('Background', `Scheduled smartReviewSchedule alarm daily at 17:00.`);
            
        } else {
            Logger.info('Background', `Notifications are disabled, cleared review alarms.`);
        }
    }

    /**
     * R3.6: Sets up the weekly summary alarm.
     * Fires every Monday at 9:00 AM local time (approximately).
     */
    async setupWeeklySummaryAlarm() {
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
    async setupDailyNudgeAlarm() {
        await chrome.alarms.clear('dailyNudge');
        const now = new Date();
        const target = new Date(now);
        target.setHours(20, 0, 0, 0);
        if (target <= now) {
            target.setDate(target.getDate() + 1);
        }
        const delayInMinutes = Math.max(1, Math.ceil((target.getTime() - now.getTime()) / 60000));
        chrome.alarms.create('dailyNudge', { delayInMinutes, periodInMinutes: 1440 });
        Logger.info('Background', `Scheduled dailyNudge alarm at 20:00.`);
    }

    /**
     * Watches for changes in settings to dynamically reschedule the alarm.
     * @param {Object} changes - Object describing key storage differences.
     * @param {string} areaName - The name of the storage area.
     */
    async handleStorageChanged(changes, areaName) {
        // Logger.debug('Background', `Storage changed in ${areaName}`, Object.keys(changes));
        if (areaName === 'local' && changes.notificationSettings) {
            await this.setupAlarm();
        }
        if (areaName === 'local' && changes.weeklySummaryEnabled) {
            await this.setupWeeklySummaryAlarm();
        }
    }

    /**
     * Coordinates background script runtime communication channels.
     * @param {Object} message - Received payload object.
     * @param {Object} sender - Messaging sender metadata.
     * @param {Function} sendResponse - Callback for routing replies.
     */
    handleMessage(message, sender, sendResponse) {
        Logger.debug('Background', `Received message: ${message.action}`, { senderId: sender.id, tabId: sender.tab?.id });
        if (message.action === 'test_notification') {
            (async () => {
                try {
                    await this.showTestNotification();
                    sendResponse({ success: true });
                } catch (err) {
                    Logger.error('Background', `Error in test_notification`, err);
                    sendResponse({ success: false, error: err.message });
                }
            })();
            return true; // Keep message channel open for async response
        }
        if (message.action === 'open_fullscreen_editor') {
            chrome.tabs.create({ url: chrome.runtime.getURL('features/tracker/editor/editor.html?url=' + encodeURIComponent(message.url)) });
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
    async showTestNotification() {
        const result = await chrome.storage.local.get(['notificationSettings']);
        const settings = result.notificationSettings || {
            enabled: true,
            frequency: '60',
            priority: '2',
            requireInteraction: true
        };

        return new Promise((resolve) => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                let handledInPage = false;
                if (tabs && tabs[0] && tabs[0].id) {
                    const tab = tabs[0];
                    const isMatching = tab.url && (tab.url.includes('algo.monster') || tab.url.includes('systemdesignschool.io'));
                    if (isMatching) {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'show_custom_notification',
                            title: '🔔 Notification Test',
                            message: `This is a test. Reviews check every ${settings.frequency} minutes.`,
                            type: 'test'
                        }, (response) => {
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
     * @param {Object} settings - Active notification configurations.
     */
    createSystemTestNotification(settings) {
        chrome.notifications.clear('algo-test-notification', () => {
            chrome.notifications.create('algo-test-notification', {
                type: 'basic',
                iconUrl: '../icons/icon.png',
                title: '🔔 Notification Test',
                message: `This is a test. Reviews will check every ${settings.frequency} minutes.`,
                priority: parseInt(settings.priority, 10) || 2,
                requireInteraction: settings.requireInteraction !== false
            }, (id) => {
                if (chrome.runtime.lastError) {
                    Logger.error('Background', "Test Notification Error", chrome.runtime.lastError.message);
                } else {
                    Logger.debug('Background', `System test notification sent with ID: ${id}`);
                }
            });
        });
    }

    /**
     * Queries the list of scheduled cards in storage, filters due items, and prompts the user.
     * Delivers alerts either through an in-page notification frame or a native system notification.
     */
    async checkDueCards() {
        const result = await chrome.storage.local.get(['fsrsCards', 'notificationSettings', 'whitelistedWebsites']);
        const settings = result.notificationSettings || {
            enabled: true,
            frequency: '60',
            priority: '2',
            requireInteraction: true
        };
        const whitelistedWebsites = result.whitelistedWebsites || [
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
        const dueCards = result.fsrsCards.filter(c => c.due <= now);

        if (dueCards.length > 0) {
            // R8.2: Notification grouping by tags
            const tagCounts = {};
            dueCards.forEach(c => {
                if (c.tags && c.tags.length > 0) {
                    c.tags.forEach(t => {
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

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                let handledInPage = false;
                if (tabs && tabs[0] && tabs[0].id) {
                    const tab = tabs[0];
                    const url = tab.url;
                    if (url) {
                        const isMatching = whitelistedWebsites.some(site => url.includes(site.domain));
                        if (isMatching) {
                            chrome.tabs.sendMessage(tab.id, {
                                action: 'show_custom_notification',
                                title: '🧠 AlgoRecall Reviews Due!',
                                message: groupMessage,
                                type: 'review',
                                count: dueCards.length
                            }, (response) => {
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
     * @param {Object} settings - Active notification configurations.
     * @param {string} message - The message string.
     */
    createSystemReviewNotification(dueCount, settings, message) {
        chrome.notifications.clear('algo-review-notification', () => {
            chrome.notifications.create('algo-review-notification', {
                type: 'basic',
                iconUrl: '../icons/icon.png',
                title: '🧠 AlgoRecall Reviews Due!',
                message: message || `You have ${dueCount} pattern(s) ready for review.`,
                priority: parseInt(settings.priority, 10) || 2,
                requireInteraction: settings.requireInteraction !== false
            }, (id) => {
                if (chrome.runtime.lastError) {
                    Logger.error('Background', "Review Notification Error", chrome.runtime.lastError.message);
                } else {
                    Logger.debug('Background', `System review notification sent with ID: ${id}`);
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
    async handleWeeklySummary() {
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
            const upcomingDue = cards.filter(c => c.due > now && c.due <= nextWeekEnd).length;
            const currentlyDue = cards.filter(c => c.due <= now).length;

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
                    Logger.error('Background', "Weekly Summary Notification Error", chrome.runtime.lastError.message);
                } else {
                    Logger.debug('Background', `Weekly summary notification sent with ID: ${id}`);
                }
            });

        } catch (error) {
            Logger.error('Background', "Error generating weekly summary", error);
        }
    }

    /**
     * R8.4: Motivational nudges. Check if the user has done any reviews today.
     * If not, send an encouraging push notification to keep the streak alive.
     */
    async handleDailyNudge() {
        try {
            const result = await chrome.storage.local.get(['fsrsActivity', 'notificationSettings']);
            const settings = result.notificationSettings || {};
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
                        Logger.error('Background', "Daily Nudge Notification Error", chrome.runtime.lastError.message);
                    } else {
                        Logger.debug('Background', `Daily nudge notification sent with ID: ${id}`);
                    }
                });
            }
        } catch (error) {
            Logger.error('Background', "Error generating daily nudge", error);
        }
    }

    /**
     * Routes redirection actions when users click a native desktop tray notification.
     * @param {string} notificationId - The clicked notification ID.
     */
    handleNotificationClicked(notificationId) {
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

    async resumePomodoroBackground() {
        const result = await chrome.storage.local.get(['pomodoroState']);
        if (result.pomodoroState && result.pomodoroState.state === 'running') {
            this.startPomodoroTick(result.pomodoroState);
        }
    }

    async handlePomodoroAction(payload) {
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

    startPomodoroTick(state) {
        this.stopPomodoroTick();
        
        const tick = () => {
            const timeRemaining = Math.max(0, Math.ceil((state.targetEndTime - Date.now()) / 1000));
            const minutes = Math.floor(timeRemaining / 60);
            const seconds = timeRemaining % 60;
            const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
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
            
            // Do not update the title with the time, otherwise Chrome resets the hover delay every second
            // and the tooltip will never appear!
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

    stopPomodoroTick() {
        if (this.pomodoroIntervalId) {
            clearInterval(this.pomodoroIntervalId);
            this.pomodoroIntervalId = null;
        }
    }

    async handlePomodoroEnd() {
        const result = await chrome.storage.local.get(['pomodoroState', 'pomodoroSettings', 'pomodoroStats']);
        const state = result.pomodoroState;
        if (!state || state.state !== 'running') return;
        
        this.stopPomodoroTick();
        
        // Track stats
        const stats = result.pomodoroStats || { sessionsToday: 0, focusMinutesToday: 0, lastDate: new Date().toLocaleDateString() };
        if (stats.lastDate !== new Date().toLocaleDateString()) {
            stats.sessionsToday = 0;
            stats.focusMinutesToday = 0;
            stats.lastDate = new Date().toLocaleDateString();
        }
        
        if (state.phase === 'focus') {
            stats.sessionsToday++;
            const settings = result.pomodoroSettings || { focusDuration: 25, sessionsBeforeLongBreak: 4 };
            stats.focusMinutesToday += settings.focusDuration;
        }

        // Advance Phase
        const settings = result.pomodoroSettings || { sessionsBeforeLongBreak: 4, focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15 };
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