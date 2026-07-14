/**
 * @file background/background.js
 * @description Extension background service worker (Manifest V3) implemented as an OOP class.
 * Manages background alarms for checking FSRS card due times, schedules/delivers OS notifications,
 * handles custom whitelisted website routing messages, reacts to SPA client-side history state updates,
 * and sends weekly summary digest notifications (R3.6).
 */
import { Logger } from '../features/common/logger.js';

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
        if (alarm.name === 'checkFsrsReviews' || alarm.name === 'snoozeFsrsReviews') {
            this.checkDueCards();
        } else if (alarm.name === 'weeklySummary') {
            this.handleWeeklySummary();
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
        const result = await chrome.storage.local.get(['notificationSettings']);
        const settings = result.notificationSettings || {
            enabled: true,
            frequency: '60',
            priority: '2',
            requireInteraction: true
        };

        await chrome.alarms.clear('checkFsrsReviews');
        await chrome.alarms.clear('snoozeFsrsReviews');

        if (settings.enabled) {
            const interval = parseInt(settings.frequency, 10) || 60;
            chrome.alarms.create('checkFsrsReviews', { periodInMinutes: interval });
            Logger.info('Background', `Scheduled checkFsrsReviews alarm every ${interval} minutes.`);
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
     * Watches for changes in settings to dynamically reschedule the alarm.
     * @param {Object} changes - Object describing key storage differences.
     * @param {string} areaName - The name of the storage area.
     */
    async handleStorageChanged(changes, areaName) {
        Logger.debug('Background', `Storage changed in ${areaName}`, Object.keys(changes));
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
     * Queries the list of FSRS cards in storage, filters due items, and prompts the user.
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

        if (!result.fsrsCards || result.fsrsCards.length === 0) return;
        const now = Date.now();
        const dueCards = result.fsrsCards.filter(c => c.due <= now);

        if (dueCards.length > 0) {
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
                                message: `You have ${dueCards.length} pattern(s) ready for review.`,
                                type: 'review',
                                count: dueCards.length
                            }, (response) => {
                                if (chrome.runtime.lastError || !response || !response.success) {
                                    this.createSystemReviewNotification(dueCards.length, settings);
                                }
                            });
                            handledInPage = true;
                        }
                    }
                }
                if (!handledInPage) {
                    this.createSystemReviewNotification(dueCards.length, settings);
                }
            });
        }
    }

    /**
     * Triggers a native system alert signaling due cards are waiting for study.
     * @param {number} dueCount - The number of cards currently due.
     * @param {Object} settings - Active notification configurations.
     */
    createSystemReviewNotification(dueCount, settings) {
        chrome.notifications.clear('algo-review-notification', () => {
            chrome.notifications.create('algo-review-notification', {
                type: 'basic',
                iconUrl: '../icons/icon.png',
                title: '🧠 AlgoRecall Reviews Due!',
                message: `You have ${dueCount} pattern(s) ready for review.`,
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
     * Routes redirection actions when users click a native desktop tray notification.
     * @param {string} notificationId - The clicked notification ID.
     */
    handleNotificationClicked(notificationId) {
        chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/popup/popup.html') });
        chrome.notifications.clear(notificationId);
    }
}

new AlgoRecallBackground();