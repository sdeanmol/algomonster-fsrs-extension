chrome.runtime.onInstalled.addListener(async (details) => {
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

    // Initialize default gamification stats if they don't exist
    const gamifyRes = await chrome.storage.local.get(['fsrsGamification']);
    if (!gamifyRes.fsrsGamification) {
        await chrome.storage.local.set({
            fsrsGamification: {
                character: {
                    level: 1,
                    xp: 0,
                    hp: 50,
                    maxHp: 50,
                    gold: 10,
                    class: null,
                    statPoints: 0,
                    stats: { str: 0, int: 0, con: 0, per: 0 },
                    equipment: {
                        weapon: null,
                        armor: null,
                        head: null
                    }
                },
                inventory: {
                    eggs: [],
                    potions: [],
                    food: []
                },
                pets: [],
                mounts: [],
                activeCompanion: null,
                customRewards: [],
                lastCronCheck: Date.now()
            }
        });
    }

    await setupAlarm();
    
    // Redirect to Onboarding Welcome page on initial install
    if (details && details.reason === 'install') {
        chrome.tabs.create({ url: chrome.runtime.getURL('pages/welcome/welcome.html') });
    } else {
        chrome.notifications.create('test-install', {
            type: 'basic',
            iconUrl: '../icons/icon.png', // Relative path from service worker
            title: 'AlgoRecall Active 🧠',
            message: 'Notifications are working! You will be alerted when reviews are due.',
            priority: 2
        }, (id) => {
            if (chrome.runtime.lastError) {
                console.error("Notification failed to send:", chrome.runtime.lastError.message);
            }
        });
    }

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
    // Check gamification cron first
    await checkDailyGamifyUpdate();

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
                                createSystemReviewNotification(dueCards.length, settings);
                            }
                        });
                        handledInPage = true;
                    }
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
            title: '🧠 AlgoRecall Reviews Due!',
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
    chrome.tabs.create({ url: chrome.runtime.getURL('popup/popup.html') });
    chrome.notifications.clear(notificationId);
});

async function checkDailyGamifyUpdate() {
    const res = await chrome.storage.local.get(['fsrsGamification', 'fsrsCards']);
    const gamify = res.fsrsGamification;
    if (!gamify || !gamify.character) return;

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const lastCheck = gamify.lastCronCheck || now;

    // Check if the calendar day has changed
    const lastCheckDay = Math.floor(lastCheck / oneDayMs);
    const currentDay = Math.floor(now / oneDayMs);

    if (currentDay > lastCheckDay) {
        const cards = res.fsrsCards || [];
        // Due cards are those whose due timestamp is strictly in the past (before start of today)
        const startOfToday = currentDay * oneDayMs;
        const overdueCards = cards.filter(c => c.due < startOfToday);

        if (overdueCards.length > 0) {
            const baseDamage = overdueCards.length * 2;
            const con = (gamify.character.stats && gamify.character.stats.con) || 0;
            const netDamage = Math.max(1, baseDamage - Math.floor(con / 2));

            gamify.character.hp = Math.max(0, gamify.character.hp - netDamage);

            if (gamify.character.hp <= 0) {
                // Death penalty sequence
                gamify.character.level = Math.max(1, gamify.character.level - 1);
                gamify.character.xp = 0;
                gamify.character.hp = 50;
                gamify.character.gold = 0;

                // Strip random equipment item
                const eq = gamify.character.equipment || {};
                const activeEqKeys = Object.keys(eq).filter(k => eq[k] !== null);
                if (activeEqKeys.length > 0) {
                    const dropKey = activeEqKeys[Math.floor(Math.random() * activeEqKeys.length)];
                    eq[dropKey] = null;
                }

                // Trigger Death Notification
                chrome.notifications.create('gamify-death', {
                    type: 'basic',
                    iconUrl: '../icons/icon.png',
                    title: '💀 You Died in AlgoRecall!',
                    message: `Neglected spacing reviews cost your life! You lost 1 Level, all Gold, and a random gear item.`,
                    priority: 2
                });
            } else {
                // Warning notification
                chrome.notifications.create('gamify-damage', {
                    type: 'basic',
                    iconUrl: '../icons/icon.png',
                    title: '⚠️ AlgoRecall Spacing Damage!',
                    message: `You missed ${overdueCards.length} due review(s) yesterday and took ${netDamage} damage! HP is now ${gamify.character.hp}/${gamify.character.maxHp}.`,
                    priority: 1
                });
            }
        }

        gamify.lastCronCheck = now;
        await chrome.storage.local.set({ fsrsGamification: gamify });
    }
}