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

import { h, VNode, render } from 'preact';
import { flushSync } from 'preact/compat';
import { useState } from 'preact/hooks';
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { DashboardComponent, DashboardCoordinator } from './DashboardComponent';
import { StorageData } from '../../../types/domain';
import { BROWSER_CONFIG } from '../../common/browserConfig';

function safeFlushSync(fn: () => void): void {
    try {
        flushSync(fn);
    } catch (_) {
        fn();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface QuickRatingSectionProps {
    component?: RatingComponent;
    initialStatus?: 'unrated' | 'snoozed' | 'rated';
    cardsCount?: number;
    status?: 'unrated' | 'snoozed' | 'rated';
    onStatusChange?: (status: 'unrated' | 'snoozed' | 'rated') => void;
}

export function QuickRatingSection({
    component,
    initialStatus,
    cardsCount = 1,
    status: controlledStatus,
    onStatusChange
}: QuickRatingSectionProps = {}): VNode {
    const [status, setStatus] = useState<'unrated' | 'snoozed' | 'rated'>(controlledStatus || initialStatus || 'unrated');
    const currentStatus = controlledStatus !== undefined
        ? controlledStatus
        : (component ? component.status : (initialStatus !== undefined ? initialStatus : status));

    let reviewUrl = BROWSER_CONFIG.reviewUrl;
    if (BROWSER_CONFIG.target === 'chrome') {
        const extId = typeof chrome !== 'undefined' ? chrome.runtime?.id : undefined;
        if (extId) {
            reviewUrl = reviewUrl.replace('YOUR_EXTENSION_ID', extId);
        }
    }

    const buttonLabel = BROWSER_CONFIG.ratingButtonLabel || `Rate on ${BROWSER_CONFIG.storeName}`;
    const promptText = BROWSER_CONFIG.ratingPromptText || "Enjoying AlgoRecall? Rate us 5 stars to help us grow!";

    const handleSnooze = async () => {
        try {
            if (component) {
                component.status = 'snoozed';
            }
            safeFlushSync(() => {
                setStatus('snoozed');
                if (onStatusChange) onStatusChange('snoozed');
            });
            const snoozedUntil = Date.now() + 7 * 86400000;
            await chrome.storage.local.set({
                ratingPromptState: { status: 'snoozed', snoozedUntil }
            });
            if (component) {
                component.showStatus("Notification paused for 7 days!");
            }
        } catch (err) {
            UIUtils.catchError('RatingComponent', 'Error snoozing rating', err);
        }
    };

    const handleAlreadyRated = async () => {
        try {
            if (component) {
                component.status = 'rated';
            }
            safeFlushSync(() => {
                setStatus('rated');
                if (onStatusChange) onStatusChange('rated');
            });
            await chrome.storage.local.set({
                ratingPromptState: { status: 'rated', snoozedUntil: 0 }
            });
            if (component) {
                component.showStatus("Thank you for your rating!");
            }
        } catch (err) {
            UIUtils.catchError('RatingComponent', 'Error marking already rated', err);
        }
    };

    const handleEdit = async () => {
        try {
            if (component) {
                component.status = 'unrated';
            }
            safeFlushSync(() => {
                setStatus('unrated');
                if (onStatusChange) onStatusChange('unrated');
            });
            if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                chrome.tabs.create({ url: reviewUrl });
            }
            await chrome.storage.local.set({
                ratingPromptState: { status: 'unrated', snoozedUntil: 0 }
            });
        } catch (err) {
            UIUtils.catchError('RatingComponent', 'Error editing rating', err);
        }
    };

    const isHidden = currentStatus === 'snoozed' || cardsCount === 0;

    return (
        <div className="rating-section-wrapper">
            <PopupRatingPromptCard
                status={currentStatus}
                cardsCount={cardsCount}
                promptText={promptText}
                buttonLabel={buttonLabel}
                reviewUrl={reviewUrl}
                onSnooze={handleSnooze}
                onAlreadyRated={handleAlreadyRated}
                onEdit={handleEdit}
            />
            <div className="static-review-banner" style={{ display: isHidden ? 'block' : 'none' }}>
                <a id="static-review-link" href={reviewUrl}>Rate</a>
            </div>
        </div>
    );
}

export interface PopupRatingPromptCardProps {
    status: 'unrated' | 'snoozed' | 'rated';
    cardsCount?: number;
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
    cardsCount = 1,
    promptText,
    buttonLabel,
    reviewUrl,
    onSnooze,
    onAlreadyRated,
    onEdit
}: PopupRatingPromptCardProps): VNode {
    const isHidden = status === 'snoozed' || cardsCount === 0;
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
    /** Target container element for mounting Preact component. */
    container: HTMLElement | null;
    /** Current rating prompt status. */
    status: 'unrated' | 'snoozed' | 'rated';
    /** Number of cards loaded in extension. */
    cardsCount: number;

    /**
     * Initializes the rating component with a coordinator reference.
     * @param coordinator - Parent dashboard coordinator.
     * @param container - Optional container element for mounting Preact component.
     */
    constructor(coordinator: DashboardCoordinator, container?: HTMLElement | null) {
        super(coordinator);
        this.container = container || null;
        this.status = 'unrated';
        this.cardsCount = 0;
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
            const root = this.container || (typeof document !== 'undefined' ? document.getElementById('root') : null);
            if (!root) return;

            const result = (await chrome.storage.local.get(['ratingPromptState', 'fsrsCards'])) as StorageData & {
                ratingPromptState?: { status?: string; snoozedUntil?: number };
            };
            const rating = result.ratingPromptState || { status: 'unrated', snoozedUntil: 0 };
            this.cardsCount = (result.fsrsCards || []).length;

            // Check snooze expiration
            const now = Date.now();
            if (rating.status === 'snoozed' && rating.snoozedUntil && now >= rating.snoozedUntil) {
                rating.status = 'unrated';
                await chrome.storage.local.set({ ratingPromptState: rating });
            }

            this.status = (rating.status as 'unrated' | 'snoozed' | 'rated') || 'unrated';
            this.render(root);
        } catch (error) {
            UIUtils.catchError('RatingComponent', 'Error loading rating prompt config', error);
        }
    }

    /**
     * Renders QuickRatingSection into target root element.
     * @param [container] - Target container element.
     */
    render(container?: HTMLElement | null): void {
        const root = container || this.container || (typeof document !== 'undefined' ? document.getElementById('root') : null);
        if (!root) return;
        render(
            <QuickRatingSection
                component={this}
                initialStatus={this.status}
                cardsCount={this.cardsCount}
            />,
            root
        );
    }

    /**
     * Binds click events to snooze, feedback rating confirmation, and edits.
     * Kept for lifecycle interface conformance; events are bound declaratively in Preact JSX.
     */
    bindEvents(): void {
        try {
            const root = this.container || (typeof document !== 'undefined' ? document.getElementById('root') : null);
            if (root) {
                this.render(root);
            }
        } catch (err) {
            UIUtils.catchError('RatingComponent', 'Error binding rating events', err);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).RatingComponent = RatingComponent;
    (module.exports as any).QuickRatingSection = QuickRatingSection;
    (module.exports as any).PopupRatingPromptCard = PopupRatingPromptCard;
}

