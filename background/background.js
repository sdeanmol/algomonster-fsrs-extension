chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('checkFsrsReviews', { periodInMinutes: 60 });
    
    chrome.notifications.create('test-install', {
        type: 'basic',
        iconUrl: '../icons/icon.png', // Updated Path
        title: 'FSRS Tracker Active 🧠',
        message: 'Notifications are working! You will be alerted when reviews are due.',
        priority: 2
    }, (id) => {
        if (chrome.runtime.lastError) {
            console.error("Notification failed to send:", chrome.runtime.lastError.message);
        }
    });

    checkDueCards();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkFsrsReviews') checkDueCards();
});

// Handle SPA Client-Side Routing for Highlighter
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    chrome.tabs.sendMessage(details.tabId, { 
        action: "spa_url_changed", 
        url: details.url 
    }).catch(() => {});
});

function checkDueCards() {
    chrome.storage.local.get(['fsrsCards'], (result) => {
        if (!result.fsrsCards || result.fsrsCards.length === 0) return;
        const now = new Date().getTime();
        const dueCards = result.fsrsCards.filter(c => c.due <= now);

        if (dueCards.length > 0) {
            chrome.notifications.clear('algo-review-notification', () => {
                chrome.notifications.create('algo-review-notification', {
                    type: 'basic',
                    iconUrl: '../icons/icon.png', // Updated Path
                    title: '🧠 AlgoMonster Reviews Due!',
                    message: `You have ${dueCards.length} pattern(s) ready for review.`,
                    priority: 2,
                    requireInteraction: true 
                }, (id) => {
                    if (chrome.runtime.lastError) {
                        console.error("Notification Error:", chrome.runtime.lastError.message);
                    }
                });
            });
        }
    });
}

chrome.notifications.onClicked.addListener((notificationId) => {
    chrome.tabs.create({ url: 'https://algo.monster' });
    chrome.notifications.clear(notificationId);
});