/**
 * @file features/dashboard/popup/rating.tsx
 * @description Manages store review and feedback prompts shown to users in the popup options dashboard.
 * Dynamically resolves browser-specific Web Store / Add-on links (Chrome, Firefox AMO, Safari)
 * from build-time configuration, tracks snooze durations, and handles rating status persistence.
 * Migrated to Preact with TypeScript for modular feedback cards and thank-you states.
 *
 * Architecture Role: Popup Sub-View Component (Rating & Store Feedback).
 * Context: Extension Action Popup (`features/dashboard/popup/popup.html`).
 * Key Exports:
 * - `PopupRatingPromptCard`: Preact component rendering the prompt and thanks cards.
 * - `RatingComponent`: Sub-view component class managing the store review prompt card.
 */

import { h, VNode } from 'preact';
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { DashboardComponent, DashboardCoordinator } from './DashboardComponent';
import { StorageData } from '../../../types/domain';
import { BROWSER_CONFIG } from '../../common/browserConfig';

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface PopupRatingPromptCardProps {
    status: 'unrated' | 'snoozed' | 'rated';
    promptText: string;
    buttonLabel: string;
    reviewUrl: string;
    onSnooze: () => void;
    onAlreadyRated: () => void;
    onEdit: () => void;
}

/**
 * Preact component rendering the store feedback card with prompt and thanks states.
 */
export function PopupRatingPromptCard({
    status,
    promptText,
    buttonLabel,
    reviewUrl,
    onSnooze,
    onAlreadyRated,
    onEdit
}: PopupRatingPromptCardProps): VNode {
    const isHidden = status === 'snoozed';
    const isRated = status === 'rated';

    return (
        <div
            id="rating-prompt-card"
            className={`rating-card ${isHidden ? 'hide-panel' : ''}`}
        >
            <div
                id="rating-prompt-state"
                className={`rating-state-content ${isRated ? 'hide-panel' : ''}`}
            >
                <p id="rating-prompt-text">{promptText}</p>
                <div className="rating-actions">
                    <a
                        id="rate-store-btn"
                        href={reviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                    >
                        <span id="rate-store-label">{buttonLabel}</span>
                    </a>
                    <button
                        id="already-rated-btn"
                        className="btn btn-secondary btn-sm"
                        onClick={onAlreadyRated}
                    >
                        Already Rated
                    </button>
                    <button
                        id="snooze-rate-btn"
                        className="btn btn-link btn-sm"
                        onClick={onSnooze}
                    >
                        Maybe Later
                    </button>
                </div>
            </div>

            <div
                id="rating-thanks-state"
                className={`rating-state-content ${!isRated ? 'hide-panel' : ''}`}
            >
                <p>Thank you for supporting AlgoRecall!</p>
                <button
                    id="edit-rating-btn"
                    className="btn btn-secondary btn-sm"
                    onClick={onEdit}
                >
                    Update Review
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// RATING CONTROLLER COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sub-component for the popup dashboard that manages extension store rating prompts,
 * snooze timers, and review links targeted to the user's specific browser runtime.
 */
export class RatingComponent extends DashboardComponent {
    /**
     * Initializes the rating component with a coordinator reference.
     * @param coordinator - Parent dashboard coordinator.
     */
    constructor(coordinator: DashboardCoordinator) {
        super(coordinator);
    }

    /**
     * Initializes CWS/AMO feedback banner elements, sets up action button hooks (snooze, rated),
     * and reads rating configurations from local storage.
     * Browser-specific store text and URLs are injected from BROWSER_CONFIG (build-time).
     * @async
     * @returns Promise resolving when rating state has been loaded and UI updated.
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
            const reviewUrl = BROWSER_CONFIG.reviewUrl;

            if (rateBtn) {
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

            // Consolidate store review CTAs — hide static review banner when prompt card is visible
            const staticBanner = document.querySelector('.static-review-banner') as HTMLElement | null;
            if (staticBanner) {
                staticBanner.style.display = card.classList.contains('hide-panel') ? 'block' : 'none';
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

            const updateStaticBanner = (show: boolean) => {
                const staticBanner = document.querySelector('.static-review-banner') as HTMLElement | null;
                if (staticBanner) staticBanner.style.display = show ? 'block' : 'none';
            };

            if (snoozeBtn) {
                snoozeBtn.addEventListener('click', async () => {
                    const snoozedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000; // Snooze for 7 days
                    try {
                        await chrome.storage.local.set({
                            ratingPromptState: { status: 'snoozed', snoozedUntil }
                        });
                        card.classList.add('hide-panel');
                        updateStaticBanner(true);
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
                        updateStaticBanner(false);
                        this.showStatus("Thank you for your rating!");
                    } catch (error) {
            UIUtils.catchError('RatingComponent', 'Error setting already rated status', error);
        }
                });
            }

            if (editBtn) {
                editBtn.addEventListener('click', async () => {
                    try {
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

if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).RatingComponent = RatingComponent;
    (module.exports as any).PopupRatingPromptCard = PopupRatingPromptCard;
}

