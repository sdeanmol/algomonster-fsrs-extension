// features/dashboard/popup/rating.js - Rating prompts handling

function initRatingPrompt() {
    const card = document.getElementById('rating-prompt-card');
    const promptState = document.getElementById('rating-prompt-state');
    const thanksState = document.getElementById('rating-thanks-state');
    const rateBtn = document.getElementById('rate-store-btn');
    const snoozeBtn = document.getElementById('snooze-rate-btn');
    const alreadyBtn = document.getElementById('already-rated-btn');
    const editBtn = document.getElementById('edit-rating-btn');

    if (!card) return;

    // Fetch unique extension ID to replace YOUR_EXTENSION_ID in review links
    const extId = chrome.runtime.id;
    if (extId) {
        const links = [rateBtn];
        links.forEach(link => {
            if (link && link.href) {
                link.href = link.href.replace('YOUR_EXTENSION_ID', extId);
            }
        });
    }

    chrome.storage.local.get(['ratingPromptState', 'fsrsCards'], (result) => {
        const rating = result.ratingPromptState || { status: 'unrated', snoozedUntil: 0 };
        const cardsCount = (result.fsrsCards || []).length;

        // Check snooze expiration
        const now = Date.now();
        if (rating.status === 'snoozed' && now >= rating.snoozedUntil) {
            rating.status = 'unrated';
            chrome.storage.local.set({ ratingPromptState: rating });
        }

        // Show/hide based on status and engagement (at least 1 card in system)
        if (rating.status === 'unrated') {
            if (cardsCount >= 1) {
                card.classList.remove('hide-panel');
                promptState.classList.remove('hide-panel');
                thanksState.classList.add('hide-panel');
            } else {
                card.classList.add('hide-panel');
            }
        } else if (rating.status === 'rated') {
            card.classList.remove('hide-panel');
            promptState.classList.add('hide-panel');
            thanksState.classList.remove('hide-panel');
        } else {
            card.classList.add('hide-panel');
        }
    });

    snoozeBtn.addEventListener('click', () => {
        const snoozedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000; // Snooze for 7 days
        chrome.storage.local.set({
            ratingPromptState: { status: 'snoozed', snoozedUntil }
        }, () => {
            card.classList.add('hide-panel');
            showStatus("Notification paused for 7 days!");
        });
    });

    alreadyBtn.addEventListener('click', () => {
        chrome.storage.local.set({
            ratingPromptState: { status: 'rated', snoozedUntil: 0 }
        }, () => {
            promptState.classList.add('hide-panel');
            thanksState.classList.remove('hide-panel');
            showStatus("Thank you for your rating!");
        });
    });

    editBtn.addEventListener('click', () => {
        const url = `https://chromewebstore.google.com/detail/${extId}/reviews`;
        chrome.tabs.create({ url });
        
        chrome.storage.local.set({
            ratingPromptState: { status: 'unrated', snoozedUntil: 0 }
        }, () => {
            promptState.classList.remove('hide-panel');
            thanksState.classList.add('hide-panel');
        });
    });
}
