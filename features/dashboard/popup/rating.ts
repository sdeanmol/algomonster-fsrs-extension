/**
 * @file features/dashboard/popup/rating.ts
 * @description Manages feedback/rating prompts shown to users in the popup options dashboard.
 */

import { Logger } from '@common/logger';
import { DashboardComponent, DashboardCoordinator } from './DashboardComponent';
import { StorageData } from '../../../types/domain';

export class RatingComponent extends DashboardComponent {
    constructor(coordinator: DashboardCoordinator) {
        super(coordinator);
    }

    /**
     * Initializes CWS feedback banner elements, sets up action button hooks (snooze, rated),
     * and reads rating configurations from local storage.
     */
    async load(): Promise<void> {
        try {
            const card = document.getElementById('rating-prompt-card');
            const promptState = document.getElementById('rating-prompt-state');
            const thanksState = document.getElementById('rating-thanks-state');
            const rateBtn = document.getElementById('rate-store-btn') as HTMLAnchorElement | null;

            if (!card) return;

            // Fetch unique extension ID to replace YOUR_EXTENSION_ID in review links
            const extId = typeof chrome !== 'undefined' ? chrome.runtime?.id : undefined;
            if (extId && rateBtn && rateBtn.href) {
                rateBtn.href = rateBtn.href.replace('YOUR_EXTENSION_ID', extId);
            }

            const result = (await chrome.storage.local.get(['ratingPromptState', 'fsrsCards'])) as StorageData & {
                ratingPromptState?: { status?: string; snoozedUntil?: number };
            };
            const rating = result.ratingPromptState || { status: 'unrated', snoozedUntil: 0 };
            const cardsCount = (result.fsrsCards || []).length;

            // Check snooze expiration
            const now = Date.now();
            if (rating.status === 'snoozed' && rating.snoozedUntil && now >= rating.snoozedUntil) {
                rating.status = 'unrated';
                await chrome.storage.local.set({ ratingPromptState: rating });
            }

            // Show/hide based on status and engagement (at least 1 card in system)
            if (rating.status === 'unrated') {
                if (cardsCount >= 1) {
                    card.classList.remove('hide-panel');
                    promptState?.classList.remove('hide-panel');
                    thanksState?.classList.add('hide-panel');
                } else {
                    card.classList.add('hide-panel');
                }
            } else if (rating.status === 'rated') {
                card.classList.remove('hide-panel');
                promptState?.classList.add('hide-panel');
                thanksState?.classList.remove('hide-panel');
            } else {
                card.classList.add('hide-panel');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            Logger.error('RatingComponent', `Error loading rating prompt config: ${errorMessage}`, { error });
            // Comment: Non-fatal rating prompt load catch
        }
    }

    /**
     * Binds click events to snooze, feedback rating confirmation, and edits.
     */
    bindEvents(): void {
        try {
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
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        Logger.error('RatingComponent', `Error saving snooze state: ${errorMessage}`, { error });
                    }
                });
            }

            if (alreadyBtn) {
                alreadyBtn.addEventListener('click', async () => {
                    try {
                        await chrome.storage.local.set({
                            ratingPromptState: { status: 'rated', snoozedUntil: 0 }
                        });
                        promptState?.classList.add('hide-panel');
                        thanksState?.classList.remove('hide-panel');
                        this.showStatus("Thank you for your rating!");
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        Logger.error('RatingComponent', `Error setting already rated status: ${errorMessage}`, { error });
                    }
                });
            }

            if (editBtn) {
                editBtn.addEventListener('click', async () => {
                    try {
                        const extId = typeof chrome !== 'undefined' ? chrome.runtime?.id : 'unknown';
                        const url = `https://chromewebstore.google.com/detail/${extId}/reviews`;
                        chrome.tabs.create({ url });
                        
                        await chrome.storage.local.set({
                            ratingPromptState: { status: 'unrated', snoozedUntil: 0 }
                        });
                        promptState?.classList.remove('hide-panel');
                        thanksState?.classList.add('hide-panel');
                    } catch (error) {
                        const errorMessage = error instanceof Error ? error.message : String(error);
                        Logger.error('RatingComponent', `Error resetting rating status: ${errorMessage}`, { error });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RatingComponent', `Error binding rating events: ${errorMessage}`, { err });
            // Comment: Non-fatal event binding catch
        }
    }
}
