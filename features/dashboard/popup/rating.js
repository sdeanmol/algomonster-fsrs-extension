import { DashboardComponent } from './DashboardComponent.js';

/**
 * @class RatingComponent
 * @extends DashboardComponent
 * @description Manages feedback/rating prompts shown to users in the popup options dashboard.
 * Checks interaction milestones (at least 1 FSRS card exists), handles snooze states (delay for 7 days),
 * and dynamically swaps in Chrome Web Store rating links.
 */
export class RatingComponent extends DashboardComponent {
    constructor(coordinator) {
        super(coordinator);
    }

    /**
     * Initializes CWS feedback banner elements, sets up action button hooks (snooze, rated),
     * and reads rating configurations from local storage.
     */
    async load() {
        const card = document.getElementById('rating-prompt-card');
        const promptState = document.getElementById('rating-prompt-state');
        const thanksState = document.getElementById('rating-thanks-state');
        const rateBtn = document.getElementById('rate-store-btn');

        if (!card) return;

        // Fetch unique extension ID to replace YOUR_EXTENSION_ID in review links
        const extId = chrome.runtime.id;
        if (extId && rateBtn && rateBtn.href) {
            rateBtn.href = rateBtn.href.replace('YOUR_EXTENSION_ID', extId);
        }

        try {
            const result = await chrome.storage.local.get(['ratingPromptState', 'fsrsCards']);
            const rating = result.ratingPromptState || { status: 'unrated', snoozedUntil: 0 };
            const cardsCount = (result.fsrsCards || []).length;

            // Check snooze expiration
            const now = Date.now();
            if (rating.status === 'snoozed' && now >= rating.snoozedUntil) {
                rating.status = 'unrated';
                await chrome.storage.local.set({ ratingPromptState: rating });
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
        } catch (error) {
            console.error("Error loading rating prompt config:", error);
        }
    }

    /**
     * Binds click events to snooze, feedback rating confirmation, and edits.
     */
    bindEvents() {
        const card = document.getElementById('rating-prompt-card');
        const promptState = document.getElementById('rating-prompt-state');
        const thanksState = document.getElementById('rating-thanks-state');
        const snoozeBtn = document.getElementById('snooze-rate-btn');
        const alreadyBtn = document.getElementById('already-rated-btn');
        const editBtn = document.getElementById('edit-rating-btn');

        if (!card) return;

        if (snoozeBtn) {
            snoozeBtn.addEventListener('click', async () => {
                const snoozedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000; // Snooze for 7 days
                try {
                    await chrome.storage.local.set({
                        ratingPromptState: { status: 'snoozed', snoozedUntil }
                    });
                    card.classList.add('hide-panel');
                    this.showStatus("Notification paused for 7 days!");
                } catch (error) {
                    console.error("Error saving snooze state:", error);
                }
            });
        }

        if (alreadyBtn) {
            alreadyBtn.addEventListener('click', async () => {
                try {
                    await chrome.storage.local.set({
                        ratingPromptState: { status: 'rated', snoozedUntil: 0 }
                    });
                    promptState.classList.add('hide-panel');
                    thanksState.classList.remove('hide-panel');
                    this.showStatus("Thank you for your rating!");
                } catch (error) {
                    console.error("Error setting already rated status:", error);
                }
            });
        }

        if (editBtn) {
            editBtn.addEventListener('click', async () => {
                const extId = chrome.runtime.id;
                const url = `https://chromewebstore.google.com/detail/${extId}/reviews`;
                chrome.tabs.create({ url });
                
                try {
                    await chrome.storage.local.set({
                        ratingPromptState: { status: 'unrated', snoozedUntil: 0 }
                    });
                    promptState.classList.remove('hide-panel');
                    thanksState.classList.add('hide-panel');
                } catch (error) {
                    console.error("Error resetting rating status:", error);
                }
            });
        }
    }
}
