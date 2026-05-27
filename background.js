chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create('checkFsrsReviews', { periodInMinutes: 60 });
    checkDueCards();
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'checkFsrsReviews') checkDueCards();
});

function checkDueCards() {
    chrome.storage.local.get(['fsrsCards'], (result) => {
        if (!result.fsrsCards || result.fsrsCards.length === 0) return;
        const now = new Date().getTime();
        const dueCards = result.fsrsCards.filter(c => c.due <= now);

        if (dueCards.length > 0) {
            chrome.notifications.create('algo-review-notification', {
                type: 'basic',
                iconUrl: 'icon.png',
                title: '🧠 AlgoMonster Reviews Due!',
                message: `You have ${dueCards.length} pattern(s) ready for review.`,
                priority: 2,
                requireInteraction: true
            });
        }
    });
}

chrome.notifications.onClicked.addListener((notificationId) => {
    if (notificationId === 'algo-review-notification') {
        chrome.tabs.create({ url: 'https://algo.monster' });
        chrome.notifications.clear(notificationId);
    }
});