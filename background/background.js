chrome.runtime.onInstalled.addListener(async () => {
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

    await setupAlarm();
    
    chrome.notifications.create('test-install', {
        type: 'basic',
        iconUrl: '../icons/icon.png', // Relative path from service worker
        title: 'FSRS Tracker Active 🧠',
        message: 'Notifications are working! You will be alerted when reviews are due.',
        priority: 2
    }, (id) => {
        if (chrome.runtime.lastError) {
            console.error("Notification failed to send:", chrome.runtime.lastError.message);
        }
    });

    await checkDueCards();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkFsrsReviews' || alarm.name === 'snoozeFsrsReviews') checkDueCards();
});

// Handle SPA Client-Side Routing for Highlighter
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    chrome.tabs.sendMessage(details.tabId, { 
        action: "spa_url_changed", 
        url: details.url 
    }).catch(() => {});
});

async function setupAlarm() {
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
    }
}

// Watch for changes in settings to dynamically reschedule the alarm
chrome.storage.onChanged.addListener(async (changes, areaName) => {
    if (areaName === 'local' && changes.notificationSettings) {
        await setupAlarm();
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'test_notification') {
        (async () => {
            try {
                await showTestNotification();
                sendResponse({ success: true });
            } catch (err) {
                console.error(err);
                sendResponse({ success: false, error: err.message });
            }
        })();
        return true; // Keep message channel open for async response
    }
    if (message.action === 'open_fullscreen_editor') {
        chrome.tabs.create({ url: chrome.runtime.getURL('pages/editor/editor.html?url=' + encodeURIComponent(message.url)) });
        sendResponse({ success: true });
        return true;
    }
    if (message.action === 'snooze_notification') {
        const minutes = message.minutes || 15;
        chrome.alarms.create('snoozeFsrsReviews', { delayInMinutes: minutes });
        sendResponse({ success: true });
        return true;
    }
});

async function showTestNotification() {
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
                            createSystemTestNotification(settings);
                        }
                    });
                    handledInPage = true;
                }
            }
            if (!handledInPage) {
                createSystemTestNotification(settings);
            }
            resolve();
        });
    });
}

function createSystemTestNotification(settings) {
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
                console.error("Test Notification Error:", chrome.runtime.lastError.message);
            }
        });
    });
}

async function checkDueCards() {
    const result = await chrome.storage.local.get(['fsrsCards', 'notificationSettings']);
    const settings = result.notificationSettings || {
        enabled: true,
        frequency: '60',
        priority: '2',
        requireInteraction: true
    };

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
                const isMatching = tab.url && (tab.url.includes('algo.monster') || tab.url.includes('systemdesignschool.io'));
                if (isMatching) {
                    chrome.tabs.sendMessage(tab.id, {
                        action: 'show_custom_notification',
                        title: '🧠 AlgoMonster Reviews Due!',
                        message: `You have ${dueCards.length} pattern(s) ready for review.`,
                        type: 'review',
                        count: dueCards.length
                    }, (response) => {
                        if (chrome.runtime.lastError || !response || !response.success) {
                            createSystemReviewNotification(dueCards.length, settings);
                        }
                    });
                    handledInPage = true;
                }
            }
            if (!handledInPage) {
                createSystemReviewNotification(dueCards.length, settings);
            }
        });
    }
}

function createSystemReviewNotification(dueCount, settings) {
    chrome.notifications.clear('algo-review-notification', () => {
        chrome.notifications.create('algo-review-notification', {
            type: 'basic',
            iconUrl: '../icons/icon.png',
            title: '🧠 AlgoMonster Reviews Due!',
            message: `You have ${dueCount} pattern(s) ready for review.`,
            priority: parseInt(settings.priority, 10) || 2,
            requireInteraction: settings.requireInteraction !== false
        }, (id) => {
            if (chrome.runtime.lastError) {
                console.error("Notification Error:", chrome.runtime.lastError.message);
            }
        });
    });
}

chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.tabs.create({ url: 'https://algo.monster' });
    chrome.notifications.clear(notificationId);
});