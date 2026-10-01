/**
 * @file features/dashboard/popup/rating.ts
 * @description Manages feedback/rating prompts shown to users in the popup options dashboard.
 *
 * Browser-specific store names and review URLs are resolved from BROWSER_CONFIG, which is
 * populated at build time via webpack DefinePlugin. No runtime browser detection is used.
 */

import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { DashboardComponent, DashboardCoordinator } from './DashboardComponent';
import { StorageData } from '../../../types/domain';
import { BROWSER_CONFIG } from '../../common/browserConfig';

export class RatingComponent extends DashboardComponent {
    constructor(coordinator: DashboardCoordinator) {
        super(coordinator);
    }

    /**
     * Initializes CWS/AMO feedback banner elements, sets up action button hooks (snooze, rated),
     * and reads rating configurations from local storage.
     * Browser-specific store text and URLs are injected from BROWSER_CONFIG (build-time).
     */
    async load(): Promise<void> {
        try {
            const card = document.getElementById('rating-prompt-card');
            const promptState = document.getElementById('rating-prompt-state');
            const thanksState = document.getElementById('rating-thanks-state');
            const rateBtn = document.getElementById('rate-store-btn') as HTMLAnchorElement | null;
            const rateLabel = document.getElementById('rate-store-label');
            const ratingPromptText = document.getElementById('rating-prompt-text');
            const staticReviewLink = document.getElementById('static-review-link') as HTMLAnchorElement | null;

            if (!card) return;

            // Inject browser-specific store text and review URL from build-time config.
            // BROWSER_CONFIG.reviewUrl and BROWSER_CONFIG.ratingButtonLabel are set at bundle
            // time by webpack DefinePlugin — no runtime browser detection needed.
            const reviewUrl = BROWSER_CONFIG.reviewUrl;

            if (rateBtn) {
                // For Chrome, replace the placeholder extension ID with the actual runtime ID
                if (BROWSER_CONFIG.target === 'chrome') {
                    const extId = typeof chrome !== 'undefined' ? chrome.runtime?.id : undefined;
                    rateBtn.href = extId
                        ? reviewUrl.replace('YOUR_EXTENSION_ID', extId)
                        : reviewUrl;
                } else {
                    rateBtn.href = reviewUrl;
                }
            }

            if (rateLabel) {
                rateLabel.textContent = BROWSER_CONFIG.ratingButtonLabel;
            }

            if (ratingPromptText) {
                ratingPromptText.textContent = BROWSER_CONFIG.ratingPromptText;
            }

            if (staticReviewLink) {
                if (BROWSER_CONFIG.target === 'chrome') {
                    const extId = typeof chrome !== 'undefined' ? chrome.runtime?.id : undefined;
                    staticReviewLink.href = extId
                        ? reviewUrl.replace('YOUR_EXTENSION_ID', extId)
                        : reviewUrl;
                } else {
                    staticReviewLink.href = reviewUrl;
                }
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
            UIUtils.catchError('RatingComponent', 'Error loading rating prompt config', error);
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
            UIUtils.catchError('RatingComponent', 'Error saving snooze state', error);
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
            UIUtils.catchError('RatingComponent', 'Error setting already rated status', error);
        }
                });
            }

            if (editBtn) {
                editBtn.addEventListener('click', async () => {
                    try {
                        // Navigate to the appropriate store review page for this browser target
                        let url = BROWSER_CONFIG.reviewUrl;
                        if (BROWSER_CONFIG.target === 'chrome') {
                            const extId = typeof chrome !== 'undefined' ? chrome.runtime?.id : 'unknown';
                            url = url.replace('YOUR_EXTENSION_ID', extId);
                        }
                        chrome.tabs.create({ url });
                        
                        await chrome.storage.local.set({
                            ratingPromptState: { status: 'unrated', snoozedUntil: 0 }
                        });
                        promptState?.classList.remove('hide-panel');
                        thanksState?.classList.add('hide-panel');
                    } catch (error) {
            UIUtils.catchError('RatingComponent', 'Error resetting rating status', error);
        }
                });
            }
        } catch (err) {
            UIUtils.catchError('RatingComponent', 'Error binding rating events', err);
        }
    }
}
