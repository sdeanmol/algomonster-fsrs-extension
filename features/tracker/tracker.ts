import { ensureCardIds, getCardsForUrl, generateCardId, cleanUrl } from '../common/utils/cardUtils';
import { Card, StorageData } from '../../types/domain';
import FsrsScheduler from './scheduler/fsrsScheduler';
import { Logger } from '@common/logger';

interface AlgoRecallState {
    cards: Card[];
    topicWeights: Record<string, number[]>;
    scheduler: FsrsScheduler;
}

interface DraftEntry {
    approach?: string;
    tags?: string;
    timeComplexity?: string;
    spaceComplexity?: string;
    [key: string]: unknown;
}

interface AppLogger {
    debug(category: string, message: string, data?: unknown): void;
    info(category: string, message: string, data?: unknown): void;
    warn(category: string, message: string, data?: unknown): void;
    error(category: string, message: string, data?: unknown): void;
}

interface AppUtils {
    getAutoTags(): string[];
    getExtractedProblemTitle(): string;
}

interface AlgoRecallGlobal {
    state: AlgoRecallState;
    Utils: AppUtils;
    Notifier: unknown;
    Tracker: typeof Tracker;
    orchestrator?: { applyThemeClass(): void };
}

function getAlgoRecallGlobal(): AlgoRecallGlobal {
    try {
        const win = window as unknown as { AlgoRecall: AlgoRecallGlobal };
        win.AlgoRecall = win.AlgoRecall || ({} as AlgoRecallGlobal);
        return win.AlgoRecall;
    } catch (err) {
        // Comment: Safe recovery fallback if window global access fails (e.g., non-DOM test environment)
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('Tracker', `Failed to access window in getAlgoRecallGlobal: ${errorMessage}`, { err });
        return {
            state: { cards: [], topicWeights: {}, scheduler: new FsrsScheduler() },
            Utils: { getAutoTags: () => [], getExtractedProblemTitle: () => '' },
            Notifier: null,
            Tracker
        };
    }
}

function getLogger(): AppLogger {
    return Logger;
}

function getRenderMarkdown(): ((text: string) => string) | undefined {
    try {
        return (window as unknown as { renderMarkdown?: (text: string) => string }).renderMarkdown;
    } catch (err) {
        // Comment: Safe recovery fallback if window is inaccessible when looking for markdown renderer
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.warn('Tracker', `Failed to access window in getRenderMarkdown: ${errorMessage}`, { err });
        return undefined;
    }
}

/**
 * @class FSRSTracker
 * @description Main Spaced Repetition floating widget interface injected inside target domains.
 * Provides controls for recording approaches, entering study card notes, assigning initial difficulty,
 * tagging, drag positioning toggles, and executing interactive revision card sessions with hotkeys.
 */
class Tracker {
    activeReviewFilter: string | null;
    reviewIndex: number;
    totalToReview: number;
    _reviewKeyHandler: ((e: KeyboardEvent) => void) | null;
    isListenersBound: boolean;
    cardStartTime?: number;
    activeCardId: string | null;

    constructor() {
        this.activeReviewFilter = null;
        this.reviewIndex = 0;
        this.totalToReview = 0;
        this._reviewKeyHandler = null;
        this.isListenersBound = false;
        this.activeCardId = null;

        // Bind functions to avoid lexical context issues
        this.saveDraft = this.saveDraft.bind(this);
    }

    /**
     * Helper to retrieve state.
     */
    get state(): AlgoRecallState {
        try {
            return getAlgoRecallGlobal().state;
        } catch (err) {
            // Comment: Return safe fallback empty state if global state access fails
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to get AlgoRecall state: ${errorMessage}`, { err });
            return { cards: [], topicWeights: {}, scheduler: new FsrsScheduler() };
        }
    }

    /**
     * Helper to retrieve utils.
     */
    get utils(): AppUtils {
        try {
            return getAlgoRecallGlobal().Utils;
        } catch (err) {
            // Comment: Return safe fallback empty utils if global utils access fails
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to get AlgoRecall utils: ${errorMessage}`, { err });
            return { getAutoTags: () => [], getExtractedProblemTitle: () => '' };
        }
    }

    /**
     * Helper to retrieve notifier.
     */
    get notifier(): unknown {
        try {
            return getAlgoRecallGlobal().Notifier;
        } catch (err) {
            // Comment: Return safe fallback null notifier if global access fails
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to get AlgoRecall notifier: ${errorMessage}`, { err });
            return null;
        }
    }

    /**
     * Commits the current cards array to Chrome local storage sync.
     */
    saveCards(): void {
        const logger = getLogger();
        try {
            if (logger) logger.info('Tracker', `Saving ${this.state.cards.length} FSRS cards to storage`);
            chrome.storage.local.set({ fsrsCards: this.state.cards }, () => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('Tracker', `Chrome storage error saving FSRS cards: ${errorMessage}`, { error: chrome.runtime.lastError });
                    }
                } catch (callbackErr) {
                    // Comment: Safe recovery inside storage set callback
                    const errorMessage = callbackErr instanceof Error ? callbackErr.message : String(callbackErr);
                    Logger.error('Tracker', `Error in saveCards storage callback: ${errorMessage}`, { callbackErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (logger) logger.error('Tracker', `Failed to save FSRS cards to storage: ${errorMessage}`, { cardCount: this.state.cards?.length || 0, err });
            // Comment: Non-fatal storage write catch
        }
    }

    /**
     * Registers a revision event in review activity logs in storage.
     * Records counts grouped by calendar date string in user's timezone.
     */
    logReviewActivity(): void {
        const logger = getLogger();
        try {
            chrome.storage.local.get(['fsrsActivity'], (result: StorageData & { fsrsActivity?: Record<string, number> }) => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('Tracker', `Chrome storage error getting fsrsActivity: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    const activity = result.fsrsActivity || {};
                    const today = new Date();
                    const dateString = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                    activity[dateString] = (activity[dateString] || 0) + 1;
                    chrome.storage.local.set({ fsrsActivity: activity }, () => {
                        try {
                            if (chrome.runtime.lastError) {
                                const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                Logger.error('Tracker', `Chrome storage error setting fsrsActivity: ${errorMessage}`, { error: chrome.runtime.lastError });
                            }
                        } catch (setErr) {
                            // Comment: Safe recovery in nested storage set callback for activity logging
                            const errorMessage = setErr instanceof Error ? setErr.message : String(setErr);
                            Logger.error('Tracker', `Error setting activity log: ${errorMessage}`, { setErr });
                        }
                    });
                    if (logger) logger.debug('Tracker', `Logged review activity for ${dateString}: ${activity[dateString]} reviews`);
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    if (logger) logger.error('Tracker', `Error in logReviewActivity callback: ${errorMessage}`, { innerErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (logger) logger.error('Tracker', `Failed to fetch activity storage: ${errorMessage}`, { err });
        }
    }

    /**
     * Synchronizes the floating widget UI status to align with page states.
     * Re-reads active problem card status to toggle note-saving button modes or display rating metrics.
     */
    refreshWidgetState(): void {
        try {
            if (!chrome.runtime?.id) {
                const logger = getLogger();
                if (logger) {
                    logger.warn('Tracker', 'Extension context invalidated. Ignoring refresh.');
                    alert("Please refresh the page");
                }
                return;
            }
            const container = document.getElementById('algo-fsrs-container');
            if (!container) return;

            const logger = getLogger();
            if (logger) logger.debug('Tracker', 'Refreshing widget state...');

            // Reset to default view on SPA navigation
            const reviewUi = document.getElementById('fsrs-review-ui');
            if (reviewUi) {
                reviewUi.style.display = 'none';
                reviewUi.innerHTML = ''; // Clear review session completely
            }
            const fsrsBody = document.getElementById('fsrs-body');
            if (fsrsBody) fsrsBody.style.display = 'block';

            // Ensure every card has a unique ID
            ensureCardIds(this.state.cards);

            const targetCleanUrl = cleanUrl(window.location.href);
            const urlCards = getCardsForUrl(this.state.cards, targetCleanUrl);

            // Determine active card
            if (this.activeCardId === '__new__') {
                // Explicitly on "+ New Card" tab
            } else if (this.activeCardId) {
                const exists = urlCards.find(c => c.id === this.activeCardId);
                if (!exists) {
                    this.activeCardId = urlCards.length > 0 ? urlCards[0].id : null;
                }
            } else {
                this.activeCardId = urlCards.length > 0 ? urlCards[0].id : null;
            }

            // Render Navigation Links Bar inside container
            const navBar = document.getElementById('fsrs-nav-bar');
            if (navBar) {
                let navHtml = '';
                urlCards.forEach((c, idx) => {
                    const isActive = (c.id === this.activeCardId);
                    const tagLabel = (c.tags && c.tags.length > 0) ? ` (${c.tags.join(', ')})` : '';
                    const cardTitleText = `Card ${idx + 1}${tagLabel}`;
                    const btnStyle = isActive
                        ? 'background: #4CAF50; color: #fff; font-weight: bold; border: none; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; max-height: 4.5em; word-break: break-word; white-space: normal; max-width: 120px; flex-shrink: 0; line-height: 1.3;'
                        : 'background: rgba(255,255,255,0.1); color: #ccc; border: none; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; max-height: 4.5em; word-break: break-word; white-space: normal; max-width: 120px; flex-shrink: 0; line-height: 1.3;';
                    navHtml += `<button class="fsrs-card-tab-btn" data-card-id="${c.id}" title="${cardTitleText.replace(/"/g, '&quot;')}" style="${btnStyle}">${cardTitleText}</button>`;
                });

                const isNewActive = (this.activeCardId === '__new__');
                const newBtnStyle = isNewActive
                    ? 'background: #2196F3; color: #fff; font-weight: bold; border: none; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; flex-shrink: 0;'
                    : 'background: rgba(33,150,243,0.2); color: #64b5f6; border: 1px dashed #2196F3; border-radius: 4px; padding: 3px 8px; font-size: 11px; cursor: pointer; display: inline-flex; align-items: center; flex-shrink: 0;';
                navHtml += `<button class="fsrs-card-tab-btn" data-card-id="__new__" title="+ Add Card" style="${newBtnStyle}">+ Add Card</button>`;

                navBar.innerHTML = navHtml;

                // Bind tab click handlers
                navBar.querySelectorAll('.fsrs-card-tab-btn').forEach(btn => {
                    btn.addEventListener('click', (e: Event) => {
                        try {
                            const cid = (e.currentTarget as HTMLElement).getAttribute('data-card-id');
                            this.activeCardId = cid;
                            this.refreshWidgetState();
                        } catch (tabErr) {
                            // Comment: Recover from card tab click error to keep navigation working
                            const errorMessage = tabErr instanceof Error ? tabErr.message : String(tabErr);
                            Logger.error('Tracker', `Error switching card tab: ${errorMessage}`, { tabErr });
                        }
                    });
                });
            }

            const approachArea = document.getElementById('fsrs-approach') as HTMLTextAreaElement | null;
            const tagsInput = document.getElementById('fsrs-tags-input') as HTMLInputElement | null;
            const actionLabel = document.getElementById('fsrs-action-label');
            const saveRatingsContainer = document.getElementById('fsrs-save-ratings');
            const ratingBtns = saveRatingsContainer ? saveRatingsContainer.querySelectorAll('button') : [];
            const updateTextBtn = document.getElementById('fsrs-update-text-btn');
            const deleteCardBtn = document.getElementById('fsrs-delete-card-btn');

            const activeCard = (this.activeCardId && this.activeCardId !== '__new__')
                ? urlCards.find(c => c.id === this.activeCardId)
                : null;

            if (activeCard) {
                // Selected card exists: Load data
                if (approachArea && document.activeElement !== approachArea) {
                    approachArea.value = activeCard.approach || "";
                }
                if (tagsInput && document.activeElement !== tagsInput) {
                    tagsInput.value = (activeCard.tags || []).join(', ');
                }
                if (actionLabel) actionLabel.innerText = `Card ${urlCards.indexOf(activeCard) + 1} Exists. Review Early or Update Notes:`;
                if (updateTextBtn) updateTextBtn.style.display = "block";
                if (deleteCardBtn) deleteCardBtn.style.display = "block";
                if (saveRatingsContainer) saveRatingsContainer.setAttribute('data-existing-id', activeCard.id);

                // Highlight the previous rating
                ratingBtns.forEach(btn => {
                    const btnRating = parseInt(btn.getAttribute('data-rating') || '0', 10);
                    if ((activeCard as Card & { lastRating?: number }).lastRating === btnRating) {
                        btn.style.opacity = "1";
                        btn.style.boxShadow = "0 0 0 2px #fff inset";
                    } else {
                        btn.style.opacity = "0.4";
                        btn.style.boxShadow = "none";
                    }
                });
            } else {
                // New Card: Reset UI (check draft in storage)
                chrome.storage.local.get(['approachDrafts'], (res: { approachDrafts?: Record<string, DraftEntry | string> }) => {
                    try {
                        if (chrome.runtime.lastError) {
                            const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                            Logger.error('Tracker', `Chrome storage error getting approachDrafts: ${errorMessage}`, { error: chrome.runtime.lastError });
                            return;
                        }
                        const drafts = res.approachDrafts || {};
                        const draft = drafts[targetCleanUrl];

                        if (approachArea && document.activeElement !== approachArea) {
                            if (typeof draft === 'object' && draft !== null) {
                                approachArea.value = draft.approach || "";
                            } else {
                                approachArea.value = (draft as string) || "";
                            }
                        }
                        if (tagsInput && document.activeElement !== tagsInput) {
                            if (typeof draft === 'object' && draft !== null && draft.tags !== undefined) {
                                tagsInput.value = draft.tags;
                            } else if (this.utils && typeof this.utils.getAutoTags === 'function') {
                                tagsInput.value = this.utils.getAutoTags().join(', ');
                            }
                        }
                        if (actionLabel) actionLabel.innerText = "Save & Rate Initial Difficulty for New Card:";
                        if (updateTextBtn) updateTextBtn.style.display = "none";
                        if (deleteCardBtn) deleteCardBtn.style.display = "none";
                        if (saveRatingsContainer) saveRatingsContainer.removeAttribute('data-existing-id');

                        ratingBtns.forEach(btn => {
                            btn.style.opacity = "1";
                            btn.style.boxShadow = "none";
                        });
                    } catch (draftErr) {
                        // Comment: Safe recovery inside approachDrafts storage callback
                        const errorMessage = draftErr instanceof Error ? draftErr.message : String(draftErr);
                        Logger.error('Tracker', `Error in approachDrafts storage callback: ${errorMessage}`, { draftErr });
                    }
                });
            }
        } catch (err) {
            // Comment: Safe recovery for widget state refresh to avoid breaking host page UI
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to refresh widget state: ${errorMessage}`, { err });
        }
    }

    /**
     * Creates and injects the floating launcher icon and FSRS details container widget
     * inside the document body. Binds drag handlers, action events, and navigation click list hooks.
     */
    createUI(): void {
        try {
            if (document.getElementById('algo-fsrs-container')) return;

            // 1. CREATE LAUNCHER
            const launcher = document.createElement('div');
            launcher.id = 'algo-fsrs-launcher';
            launcher.setAttribute('role', 'button');
            launcher.setAttribute('aria-label', 'Open FSRS Tracker');
            launcher.setAttribute('tabindex', '0');
            launcher.innerHTML = `<svg class="launcher-svg" viewBox="0 0 24 24" style="width: 26px; height: 26px; stroke: currentColor; fill: none; stroke-width: 2;"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z"></path><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z"></path><path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2"></path></svg>`;
            launcher.title = "FSRS Tracker (Drag to move, Right-click to reset position)";
            document.body.appendChild(launcher);

            // 2. CREATE WIDGET CONTAINER
            const container = document.createElement('div');
            container.id = 'algo-fsrs-container';
            container.setAttribute('role', 'dialog');
            container.setAttribute('aria-label', 'FSRS Tracker');
            container.style.display = 'none';

            const autoTagsStr = (this.utils && typeof this.utils.getAutoTags === 'function') ? this.utils.getAutoTags().join(', ') : '';

            container.innerHTML = `
                <div id="fsrs-header">
                    <div class="fsrs-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                        <span>FSRS Tracker</span>
                    </div>
                    <div class="fsrs-controls">
                        <button id="fsrs-min-btn" class="fsrs-icon-btn" aria-label="Minimize" title="Minimize">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                        <button id="fsrs-close-btn" class="fsrs-icon-btn" aria-label="Close" title="Close">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>
                </div>
                <div id="fsrs-nav-bar" style="display: flex; align-items: center; gap: 4px; padding: 6px 12px; background: rgba(0,0,0,0.25); border-bottom: 1px solid rgba(255,255,255,0.08); overflow-x: auto;"></div>

                <div id="fsrs-body">
                    <div class="fsrs-tags-container">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                        <input type="text" id="fsrs-tags-input" class="fsrs-tags-input" placeholder="Add tags (comma separated)..." value="${autoTagsStr}">
                    </div>
                    
                    <div class="fsrs-approach-header">
                        <label>Your Approach:</label>
                        <div class="fsrs-header-buttons" style="display: flex; gap: 6px;">
                            <button id="fsrs-fullscreen-btn" class="fsrs-secondary-btn" title="Open in fullscreen new tab" aria-label="Open in fullscreen new tab">
                                <svg class="svg-icon" viewBox="0 0 24 24" style="width:11px; height:11px; display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                                Fullscreen
                            </button>
                            <button id="fsrs-delete-card-btn" class="fsrs-danger-btn" style="display:none;" title="Remove this card from future reviews" aria-label="Remove this card from future reviews">
                                <svg class="svg-icon" viewBox="0 0 24 24" style="width:11px; height:11px; display:inline-block; vertical-align:middle; margin-right:3px; stroke:currentColor;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                Remove
                            </button>
                            <button id="fsrs-update-text-btn" class="fsrs-secondary-btn" style="display:none;" title="Save edits without reviewing" aria-label="Save edits without reviewing">
                                <svg class="svg-icon" viewBox="0 0 24 24" style="width:11px; height:11px; display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                                Save Edit
                            </button>
                        </div>
                    </div>
                    <textarea id="fsrs-approach" class="fsrs-textarea" placeholder="How did you solve this pattern? Jot down your key insights..."></textarea>
                    
                    <div class="fsrs-rating-section">
                        <p id="fsrs-action-label" class="fsrs-rating-label">Save & Rate Initial Difficulty:</p>
                        <div class="fsrs-rating-buttons" id="fsrs-save-ratings">
                            <button data-rating="1" class="fsrs-btn-again" title="Hard to remember (Shortcut: 1)" aria-label="Hard to remember (Shortcut: 1)">Again</button>
                            <button data-rating="2" class="fsrs-btn-hard" title="Remembered with effort (Shortcut: 2)" aria-label="Remembered with effort (Shortcut: 2)">Hard</button>
                            <button data-rating="3" class="fsrs-btn-good" title="Remembered easily (Shortcut: 3)" aria-label="Remembered easily (Shortcut: 3)">Good</button>
                            <button data-rating="4" class="fsrs-btn-easy" title="Too easy (Shortcut: 4)" aria-label="Too easy (Shortcut: 4)">Easy</button>
                        </div>
                    </div>
                </div>
                <div id="fsrs-review-ui" style="display:none;"></div>
            `;

            document.body.appendChild(container);

            // 3. WIDGET TOGGLE CONTROLS
            let isDragging = false;
            const dragStart = { x: 0, y: 0 };
            const initialPos = { x: 0, y: 0 };

            const onMouseMove = (e: MouseEvent) => {
                try {
                    const dx = e.clientX - dragStart.x;
                    const dy = e.clientY - dragStart.y;

                    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                        isDragging = true;
                    }

                    if (isDragging) {
                        launcher.style.left = `${initialPos.x + dx}px`;
                        launcher.style.top = `${initialPos.y + dy}px`;
                        launcher.style.right = 'auto';
                        launcher.style.bottom = 'auto';
                        launcher.style.cursor = 'grabbing';
                    }
                } catch (err) {
                    // Comment: Safe recovery from mouse move calculation error during launcher drag
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error handling launcher mousemove: ${errorMessage}`, { err });
                }
            };

            const onMouseUp = () => {
                try {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    setTimeout(() => {
                        try {
                            launcher.style.cursor = 'pointer';
                        } catch (cursorErr) {
                            // Comment: Safe recovery in cursor timeout reset
                            const errorMessage = cursorErr instanceof Error ? cursorErr.message : String(cursorErr);
                            Logger.error('Tracker', `Error resetting launcher cursor on mouseup: ${errorMessage}`, { cursorErr });
                        }
                    }, 50);
                } catch (err) {
                    // Comment: Safe recovery during drag cleanup on mouseup
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error handling launcher mouseup: ${errorMessage}`, { err });
                }
            };

            launcher.addEventListener('mousedown', (e: MouseEvent) => {
                try {
                    isDragging = false;
                    dragStart.x = e.clientX;
                    dragStart.y = e.clientY;

                    const rect = launcher.getBoundingClientRect();
                    initialPos.x = rect.left;
                    initialPos.y = rect.top;

                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                } catch (err) {
                    // Comment: Safe recovery on launcher mousedown
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error on launcher mousedown: ${errorMessage}`, { err });
                }
            });

            launcher.addEventListener('click', (e: MouseEvent) => {
                try {
                    if (isDragging) {
                        e.preventDefault();
                        e.stopPropagation();
                        return;
                    }
                    launcher.style.display = 'none';
                    container.style.display = 'block';
                    this.refreshWidgetState();
                } catch (err) {
                    // Comment: Safe recovery on launcher click
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error on launcher click: ${errorMessage}`, { err });
                }
            });

            launcher.addEventListener('keydown', (e: KeyboardEvent) => {
                try {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        launcher.style.display = 'none';
                        container.style.display = 'block';
                        this.refreshWidgetState();
                    }
                } catch (err) {
                    // Comment: Safe recovery on launcher keydown
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error on launcher keydown: ${errorMessage}`, { err });
                }
            });

            launcher.addEventListener('contextmenu', (e: MouseEvent) => {
                try {
                    e.preventDefault();
                    launcher.style.left = '';
                    launcher.style.top = '';
                    launcher.style.right = '';
                    launcher.style.bottom = '';
                } catch (err) {
                    // Comment: Safe recovery on launcher contextmenu reset
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error resetting launcher position via contextmenu: ${errorMessage}`, { err });
                }
            });

            document.getElementById('fsrs-min-btn')?.addEventListener('click', () => {
                try {
                    container.style.display = 'none';
                    launcher.style.display = 'flex';
                } catch (err) {
                    // Comment: Safe recovery on minimize button click
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error on minimize button click: ${errorMessage}`, { err });
                }
            });

            document.getElementById('fsrs-close-btn')?.addEventListener('click', () => {
                try {
                    container.style.display = 'none';
                    launcher.style.display = 'none';
                } catch (err) {
                    // Comment: Safe recovery on close button click
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error on close button click: ${errorMessage}`, { err });
                }
            });

            // 4. FSRS APP LOGIC LISTENERS
            document.getElementById('fsrs-fullscreen-btn')?.addEventListener('click', () => {
                try {
                    const targetCleanUrl = cleanUrl(window.location.href);
                    const currentText = (document.getElementById('fsrs-approach') as HTMLTextAreaElement)?.value || '';
                    const currentTagsText = (document.getElementById('fsrs-tags-input') as HTMLInputElement)?.value || '';
                    const existingId = document.getElementById('fsrs-save-ratings')?.getAttribute('data-existing-id');

                    if (existingId) {
                        const index = this.state.cards.findIndex((c: Card) => c.id === existingId);
                        if (index > -1) {
                            this.state.cards[index].approach = currentText;
                            this.state.cards[index].tags = currentTagsText.split(',').map(t => t.trim()).filter(t => t.length > 0);
                            this.saveCards();
                        }
                        chrome.runtime.sendMessage({
                            action: "open_fullscreen_editor",
                            url: targetCleanUrl,
                            cardId: existingId
                        }, () => {
                            if (chrome.runtime.lastError) {
                                const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                Logger.error('Tracker', `Chrome runtime error sending open_fullscreen_editor message: ${errorMessage}`, { error: chrome.runtime.lastError });
                            }
                        });
                    } else {
                        chrome.storage.local.get(['approachDrafts'], (res: { approachDrafts?: Record<string, DraftEntry | string> }) => {
                            try {
                                if (chrome.runtime.lastError) {
                                    const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                    Logger.error('Tracker', `Chrome storage error fetching drafts for fullscreen editor: ${errorMessage}`, { error: chrome.runtime.lastError });
                                    return;
                                }
                                const drafts = res.approachDrafts || {};
                                drafts[targetCleanUrl] = { approach: currentText, tags: currentTagsText };
                                chrome.storage.local.set({ approachDrafts: drafts }, () => {
                                    try {
                                        if (chrome.runtime.lastError) {
                                            const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                            Logger.error('Tracker', `Chrome storage error saving draft for fullscreen editor: ${errorMessage}`, { error: chrome.runtime.lastError });
                                        }
                                        chrome.runtime.sendMessage({
                                            action: "open_fullscreen_editor",
                                            url: targetCleanUrl
                                        }, () => {
                                            if (chrome.runtime.lastError) {
                                                const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                                Logger.error('Tracker', `Chrome runtime error sending open_fullscreen_editor message: ${errorMessage}`, { error: chrome.runtime.lastError });
                                            }
                                        });
                                    } catch (msgErr) {
                                        // Comment: Safe recovery sending open_fullscreen_editor message
                                        const errorMessage = msgErr instanceof Error ? msgErr.message : String(msgErr);
                                        Logger.error('Tracker', `Error sending open_fullscreen_editor message: ${errorMessage}`, { msgErr });
                                    }
                                });
                            } catch (draftErr) {
                                // Comment: Safe recovery in draft callback for fullscreen button
                                const errorMessage = draftErr instanceof Error ? draftErr.message : String(draftErr);
                                Logger.error('Tracker', `Error handling draft for fullscreen editor: ${errorMessage}`, { draftErr });
                            }
                        });
                    }
                } catch (err) {
                    // Comment: Safe recovery when clicking fullscreen button
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error in fullscreen button click handler: ${errorMessage}`, { err });
                }
            });

            document.getElementById('fsrs-approach')?.addEventListener('input', this.saveDraft);
            document.getElementById('fsrs-tags-input')?.addEventListener('input', this.saveDraft);

            document.getElementById('fsrs-delete-card-btn')?.addEventListener('click', () => {
                try {
                    const existingId = document.getElementById('fsrs-save-ratings')?.getAttribute('data-existing-id');
                    if (existingId) {
                        if (confirm("Remove this card from future reviews? This will delete the card and its repetition history.")) {
                            this.state.cards = this.state.cards.filter((c: Card) => c.id !== existingId);
                            this.activeCardId = null;
                            this.saveCards();
                            this.refreshWidgetState();
                        }
                    }
                } catch (err) {
                    // Comment: Safe recovery during card deletion
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error deleting card: ${errorMessage}`, { err });
                }
            });

            document.getElementById('fsrs-update-text-btn')?.addEventListener('click', (e: Event) => {
                try {
                    const existingId = document.getElementById('fsrs-save-ratings')?.getAttribute('data-existing-id');
                    if (existingId) {
                        const index = this.state.cards.findIndex((c: Card) => c.id === existingId);
                        if (index > -1) {
                            this.state.cards[index].approach = (document.getElementById('fsrs-approach') as HTMLTextAreaElement)?.value || '';
                            const tagsVal = (document.getElementById('fsrs-tags-input') as HTMLInputElement)?.value || '';
                            this.state.cards[index].tags = tagsVal.split(',').map(t => t.trim()).filter(t => t.length > 0);
                            this.saveCards();

                            const targetBtn = e.target as HTMLElement;
                            const originalText = targetBtn.innerText;
                            targetBtn.innerText = "Saved ✓";
                            targetBtn.style.background = "#2ecc71";
                            setTimeout(() => {
                                try {
                                    targetBtn.innerText = originalText;
                                    targetBtn.style.background = "#555";
                                } catch (timerErr) {
                                    // Comment: Safe recovery in update button style reset timer
                                    const errorMessage = timerErr instanceof Error ? timerErr.message : String(timerErr);
                                    Logger.error('Tracker', `Error resetting update button text: ${errorMessage}`, { timerErr });
                                }
                            }, 1500);
                        }
                    }
                } catch (err) {
                    // Comment: Safe recovery when updating card text
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error updating card text: ${errorMessage}`, { err });
                }
            });

            document.getElementById('fsrs-save-ratings')?.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', (e: Event) => {
                    try {
                        const approach = (document.getElementById('fsrs-approach') as HTMLTextAreaElement)?.value || '';
                        if (!approach) return alert("Please enter your approach.");

                        const tagsVal = (document.getElementById('fsrs-tags-input') as HTMLInputElement)?.value || '';
                        const parsedTags = tagsVal.split(',').map(t => t.trim()).filter(t => t.length > 0);

                        const target = e.target as HTMLElement;
                        const rating = parseInt(target.getAttribute('data-rating') || '1', 10);
                        const existingId = document.getElementById('fsrs-save-ratings')?.getAttribute('data-existing-id');
                        const targetCleanUrl = cleanUrl(window.location.href);
                        const problemTitle = (this.utils && typeof this.utils.getExtractedProblemTitle === 'function') ? this.utils.getExtractedProblemTitle() : document.title;

                        // Dynamic Topic Weights mapping
                        let customWeights: number[] | null = null;
                        if (this.state.topicWeights && parsedTags && parsedTags.length > 0) {
                            for (const tag of parsedTags) {
                                if (this.state.topicWeights[tag]) {
                                    customWeights = this.state.topicWeights[tag];
                                    break;
                                }
                            }
                        }

                        if (existingId) {
                            const index = this.state.cards.findIndex((c: Card) => c.id === existingId);
                            if (index > -1) {
                                this.state.cards[index].approach = approach;
                                this.state.cards[index].tags = parsedTags;
                                this.state.cards[index] = this.state.scheduler.reviewCard(this.state.cards[index], rating, customWeights);
                                (this.state.cards[index] as Card & { lastRating?: number }).lastRating = rating;
                                this.activeCardId = existingId;
                            }
                        } else {
                            let newCard = this.state.scheduler.createCard(problemTitle, targetCleanUrl, "", approach, parsedTags);
                            newCard.id = generateCardId();
                            newCard = this.state.scheduler.reviewCard(newCard, rating, customWeights);
                            (newCard as Card & { lastRating?: number }).lastRating = rating;
                            this.state.cards.push(newCard);
                            this.activeCardId = newCard.id;
                        }

                        this.saveCards();

                        // Clear draft if it exists
                        chrome.storage.local.get(['approachDrafts'], (res: { approachDrafts?: Record<string, DraftEntry | string> }) => {
                            try {
                                if (chrome.runtime.lastError) {
                                    const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                    Logger.error('Tracker', `Chrome storage error fetching drafts on save-rating: ${errorMessage}`, { error: chrome.runtime.lastError });
                                    return;
                                }
                                const drafts = res.approachDrafts || {};
                                if (drafts[targetCleanUrl]) {
                                    delete drafts[targetCleanUrl];
                                    chrome.storage.local.set({ approachDrafts: drafts }, () => {
                                        if (chrome.runtime.lastError) {
                                            const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                            Logger.error('Tracker', `Chrome storage error deleting draft: ${errorMessage}`, { error: chrome.runtime.lastError });
                                        }
                                    });
                                }
                            } catch (draftErr) {
                                // Comment: Recover from draft cleanup error without failing the rating operation
                                const errorMessage = draftErr instanceof Error ? draftErr.message : String(draftErr);
                                Logger.error('Tracker', `Error deleting draft after rating save: ${errorMessage}`, { draftErr });
                            }
                        });

                        this.logReviewActivity();
                        this.refreshWidgetState();

                        const originalText = target.innerText;
                        target.innerText = "Saved ✓";
                        setTimeout(() => {
                            try {
                                target.innerText = originalText;
                            } catch (timerErr) {
                                // Comment: Safe recovery resetting rating button text
                                const errorMessage = timerErr instanceof Error ? timerErr.message : String(timerErr);
                                Logger.error('Tracker', `Error resetting save-rating button text: ${errorMessage}`, { timerErr });
                            }
                        }, 1500);
                    } catch (err) {
                        // Comment: Safe recovery during save-rating click operation
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Tracker', `Error saving card rating: ${errorMessage}`, { err });
                    }
                });
            });

            try {
                const globalAlgo = getAlgoRecallGlobal();
                if (globalAlgo.orchestrator) {
                    globalAlgo.orchestrator.applyThemeClass();
                }
            } catch (themeErr) {
                // Comment: Safe recovery applying theme class
                const errorMessage = themeErr instanceof Error ? themeErr.message : String(themeErr);
                Logger.error('Tracker', `Failed to apply theme class: ${errorMessage}`, { themeErr });
            }
        } catch (err) {
            // Comment: Safe recovery during UI initialization to prevent unhandled exception breaking host DOM
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to create UI elements: ${errorMessage}`, { err });
        }
    }

    /**
     * Saves a draft copy of the active editor contents (approach notes + tags)
     * to local storage, ensuring content is retained during inadvertent navigation.
     */
    saveDraft(): void {
        try {
            const targetCleanUrl = cleanUrl(window.location.href);
            const existingId = document.getElementById('fsrs-save-ratings')?.getAttribute('data-existing-id');

            const approachTextEl = document.getElementById('fsrs-approach') as HTMLTextAreaElement | null;
            const tagsInputEl = document.getElementById('fsrs-tags-input') as HTMLInputElement | null;
            if (!approachTextEl || !tagsInputEl) return;

            const text = approachTextEl.value;
            const tagsText = tagsInputEl.value;

            if (existingId) {
                const card = this.state.cards.find((c: Card) => c.id === existingId);
                if (card) {
                    card.approach = text;
                    card.tags = tagsText.split(',').map(t => t.trim()).filter(t => t.length > 0);
                    this.saveCards();
                }
            } else {
                chrome.storage.local.get(['approachDrafts'], (res: { approachDrafts?: Record<string, DraftEntry | string> }) => {
                    try {
                        if (chrome.runtime.lastError) {
                            const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                            Logger.error('Tracker', `Chrome storage error fetching drafts in saveDraft: ${errorMessage}`, { error: chrome.runtime.lastError });
                            return;
                        }
                        const drafts = res.approachDrafts || {};
                        drafts[targetCleanUrl] = { approach: text, tags: tagsText };
                        chrome.storage.local.set({ approachDrafts: drafts }, () => {
                            if (chrome.runtime.lastError) {
                                const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                Logger.error('Tracker', `Chrome storage error setting approachDrafts in saveDraft: ${errorMessage}`, { error: chrome.runtime.lastError });
                            }
                        });
                    } catch (draftErr) {
                        // Comment: Safe recovery inside saveDraft storage callback
                        const errorMessage = draftErr instanceof Error ? draftErr.message : String(draftErr);
                        Logger.error('Tracker', `Error in saveDraft storage callback: ${errorMessage}`, { draftErr });
                    }
                });
            }
        } catch (err) {
            // Comment: Non-fatal draft auto-saving catch to ensure typing is never interrupted
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to save draft: ${errorMessage}`, { err });
        }
    }

    /**
     * Returns a sorted list of due study cards based on the scheduled FSRS timestamp.
     */
    getDueCards(filterTag?: string | null): Card[] {
        try {
            const now = new Date().getTime();
            let due = (this.state.cards || []).filter((c: Card) => c && c.due <= now);
            if (filterTag && filterTag !== '__all__') {
                due = due.filter((c: Card) => c.tags && c.tags.includes(filterTag));
            }
            return due.sort((a: Card, b: Card) => a.due - b.due);
        } catch (err) {
            // Comment: Return empty array fallback on error to prevent breaking callers iterating over due cards
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to compute due cards: ${errorMessage}`, { filterTag, err });
            return [];
        }
    }

    /**
     * Initiates the revision session sequence. Collects unique tags from due cards
     * and prompts users with a tag-based topics picker menu if multiple topics are due.
     */
    startReview(): void {
        try {
            const allDue = this.getDueCards();
            if (allDue.length === 0) {
                alert("No cards due right now!");
                return;
            }

            // Collect unique tags from due cards
            const tagSet = new Set<string>();
            allDue.forEach((c: Card) => { if (c.tags) c.tags.forEach((t: string) => tagSet.add(t)); });
            const uniqueTags = [...tagSet].sort();

            // If only one tag (or none), skip picker and go straight to review
            if (uniqueTags.length <= 1) {
                this.activeReviewFilter = null;
                this._startReviewSession();
                return;
            }

            // Show tag picker UI
            const reviewUi = document.getElementById('fsrs-review-ui');
            const fsrsBody = document.getElementById('fsrs-body');
            if (!reviewUi || !fsrsBody) return;

            fsrsBody.style.display = 'none';
            reviewUi.style.display = 'block';

            const tagChipsHtml = uniqueTags.map(tag => {
                const count = allDue.filter((c: Card) => c.tags && c.tags.includes(tag)).length;
                return `<button class="fsrs-tag-chip" data-tag="${tag}">${tag} <span class="fsrs-tag-count">${count}</span></button>`;
            }).join('');

            reviewUi.innerHTML = `
                <div class="fsrs-tag-picker">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h4 style="margin:0; font-size: 13px;">Select Topics to Review</h4>
                        <button id="fsrs-picker-back-btn" title="Go Back" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 4px;" aria-label="Go Back">
                            <svg class="svg-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                            Back
                        </button>
                    </div>
                    <div class="fsrs-tag-chips-container">
                        <button class="fsrs-tag-chip fsrs-tag-chip-active" data-tag="__all__">All Topics <span class="fsrs-tag-count">${allDue.length}</span></button>
                        ${tagChipsHtml}
                    </div>
                    <button id="fsrs-start-filtered-btn" class="fsrs-primary-btn" style="margin-top: 14px;">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width: 14px; height: 14px; stroke: currentColor;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                        Start Review
                    </button>
                </div>
            `;

            // Tag chip selection logic
            const chips = reviewUi.querySelectorAll('.fsrs-tag-chip');
            chips.forEach(chip => {
                chip.addEventListener('click', () => {
                    try {
                        chips.forEach(c => c.classList.remove('fsrs-tag-chip-active'));
                        chip.classList.add('fsrs-tag-chip-active');
                    } catch (err) {
                        // Comment: Safe recovery on tag chip click
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Tracker', `Error selecting tag chip: ${errorMessage}`, { err });
                    }
                });
            });

            // Back button
            document.getElementById('fsrs-picker-back-btn')?.addEventListener('click', () => {
                try {
                    reviewUi.style.display = 'none';
                    reviewUi.innerHTML = '';
                    fsrsBody.style.display = 'block';
                    this.refreshWidgetState();
                } catch (err) {
                    // Comment: Safe recovery on picker back button
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error on picker back button click: ${errorMessage}`, { err });
                }
            });

            // Start button
            document.getElementById('fsrs-start-filtered-btn')?.addEventListener('click', () => {
                try {
                    const activeChip = reviewUi.querySelector('.fsrs-tag-chip-active');
                    this.activeReviewFilter = activeChip ? activeChip.getAttribute('data-tag') : null;
                    if (this.activeReviewFilter === '__all__') this.activeReviewFilter = null;
                    this._startReviewSession();
                } catch (err) {
                    // Comment: Safe recovery starting filtered review session
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error on start filtered review click: ${errorMessage}`, { err });
                }
            });
        } catch (err) {
            // Comment: Safe recovery for startReview workflow
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to start review workflow: ${errorMessage}`, { err });
        }
    }

    /**
     * Launches the review queue display sequence, looping cards in the due stack.
     */
    private _startReviewSession(): void {
        try {
            const dueCards = this.getDueCards(this.activeReviewFilter);
            if (dueCards.length === 0) {
                alert("No cards due for this filter!");
                this.activeReviewFilter = null;
                return;
            }

            this.totalToReview = dueCards.length;
            this.reviewIndex = 0;

            this.showCard();
        } catch (err) {
            // Comment: Safe recovery launching review session
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to start review session: ${errorMessage}`, { err });
        }
    }

    /**
     * Renders the next due card details, binding ratings listeners and key navigation hooks.
     */
    showCard(): void {
        try {
            const remaining = this.getDueCards(this.activeReviewFilter);
            const reviewUi = document.getElementById('fsrs-review-ui');
            const fsrsBody = document.getElementById('fsrs-body');
            if (!reviewUi || !fsrsBody) return;

            if (remaining.length === 0) {
                this._cleanupReviewKeyboard();
                reviewUi.style.display = 'none';
                reviewUi.innerHTML = '';
                fsrsBody.style.display = 'block';
                this.activeReviewFilter = null;
                this.refreshWidgetState();
                return;
            }

            this.reviewIndex++;
            const currentCard = remaining[0];
            this.cardStartTime = Date.now();
            fsrsBody.style.display = 'none';
            reviewUi.style.display = 'block';

            const tagsHtml = currentCard.tags?.length ? `<div style="font-size: 11px; color: #888; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
                <svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #888; width: 13px; height: 13px;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                <span>${currentCard.tags.join(', ')}</span>
            </div>` : '';

            const filterBadge = this.activeReviewFilter
                ? `<div class="fsrs-filter-badge">
                    <svg class="svg-icon" viewBox="0 0 24 24" style="width: 11px; height: 11px;"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                    ${this.activeReviewFilter}
                   </div>`
                : '';

            const progressPct = Math.round((this.reviewIndex / this.totalToReview) * 100);

            // Render approach with Markdown
            const renderFn = getRenderMarkdown();
            const approachHtml = typeof renderFn === 'function'
                ? renderFn(currentCard.approach || '')
                : (currentCard.approach || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

            reviewUi.innerHTML = `
                <div class="fsrs-review-header">
                    <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
                        <h4 style="margin:0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${currentCard.problemTitle}</h4>
                        ${filterBadge}
                    </div>
                    <button id="fsrs-back-btn" title="Go Back" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 4px; flex-shrink: 0;" aria-label="Go Back">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        Back
                    </button>
                </div>
                <div class="fsrs-progress-bar">
                    <div class="fsrs-progress-fill" style="width: ${progressPct}%;"></div>
                </div>
                <div class="fsrs-review-meta">
                    <span class="fsrs-progress-text">${this.reviewIndex} of ${this.totalToReview}</span>
                </div>
                ${tagsHtml}
                <p style="margin-bottom: 15px;">
                    <a href="${currentCard.problemUrl}" target="_blank" style="color: #4CAF50; text-decoration: none; font-weight: bold; border-bottom: 1px solid #4CAF50; display: inline-flex; align-items: center; gap: 4px;">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #4CAF50; width: 13px; height: 13px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        Open Problem Page
                    </a>
                </p>
                <div id="fsrs-approach-answer" style="display:none;">
                    <div class="fsrs-markdown"><strong>Your Approach:</strong>${approachHtml}</div>
                    <div class="fsrs-rating-buttons">
                        <div class="fsrs-rating-btn-wrapper">
                            <button data-rating="1" style="background:#e74c3c;">Again</button>
                            <kbd class="fsrs-kbd-hint">1</kbd>
                        </div>
                        <div class="fsrs-rating-btn-wrapper">
                            <button data-rating="2" style="background:#e67e22;">Hard</button>
                            <kbd class="fsrs-kbd-hint">2</kbd>
                        </div>
                        <div class="fsrs-rating-btn-wrapper">
                            <button data-rating="3" style="background:#2ecc71;">Good</button>
                            <kbd class="fsrs-kbd-hint">3</kbd>
                        </div>
                        <div class="fsrs-rating-btn-wrapper">
                            <button data-rating="4" style="background:#3498db;">Easy</button>
                            <kbd class="fsrs-kbd-hint">4</kbd>
                        </div>
                    </div>
                </div>
                <button id="fsrs-show-answer-btn" class="fsrs-primary-btn">
                    <span>Show Approach</span>
                    <kbd class="fsrs-kbd-hint" style="margin-left: 8px;">Space</kbd>
                </button>
            `;

            // Handle Back Button Click
            document.getElementById('fsrs-back-btn')?.addEventListener('click', () => {
                try {
                    this._cleanupReviewKeyboard();
                    reviewUi.style.display = 'none';
                    reviewUi.innerHTML = '';
                    fsrsBody.style.display = 'block';
                    this.activeReviewFilter = null;
                    this.refreshWidgetState();
                } catch (err) {
                    // Comment: Safe recovery on review back button click
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error on review back button click: ${errorMessage}`, { err });
                }
            });

            document.getElementById('fsrs-show-answer-btn')?.addEventListener('click', (e: Event) => {
                try {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                    const answerDiv = document.getElementById('fsrs-approach-answer');
                    if (answerDiv) answerDiv.style.display = 'block';
                } catch (err) {
                    // Comment: Safe recovery showing approach answer
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error showing approach answer: ${errorMessage}`, { err });
                }
            });

            // Rating button click handlers
            reviewUi.querySelectorAll('.fsrs-rating-buttons button[data-rating]').forEach(btn => {
                btn.addEventListener('click', (e: Event) => {
                    try {
                        const target = e.currentTarget as HTMLElement;
                        const timeTaken = this.cardStartTime ? Date.now() - this.cardStartTime : 0;
                        this.handleRating(currentCard, parseInt(target.getAttribute('data-rating') || '1', 10), timeTaken);
                        this.showCard();
                    } catch (err) {
                        // Comment: Safe recovery on rating card click
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Tracker', `Error handling rating button click in review: ${errorMessage}`, { err });
                    }
                });
            });

            // Keyboard shortcuts
            this._cleanupReviewKeyboard();
            this._reviewKeyHandler = (e: KeyboardEvent) => {
                try {
                    // Don't intercept if user is typing in an input/textarea
                    const active = document.activeElement as HTMLElement | null;
                    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

                    const showBtn = document.getElementById('fsrs-show-answer-btn');
                    const answerDiv = document.getElementById('fsrs-approach-answer');

                    // Space or Enter to show answer
                    if ((e.code === 'Space' || e.code === 'Enter') && showBtn && showBtn.style.display !== 'none') {
                        e.preventDefault();
                        showBtn.style.display = 'none';
                        if (answerDiv) answerDiv.style.display = 'block';
                        return;
                    }

                    // 1-4 for ratings (only when answer is visible)
                    if (answerDiv && answerDiv.style.display !== 'none') {
                        const ratingMap: { [key: string]: number } = { 'Digit1': 1, 'Digit2': 2, 'Digit3': 3, 'Digit4': 4, 'Numpad1': 1, 'Numpad2': 2, 'Numpad3': 3, 'Numpad4': 4 };
                        const rating = ratingMap[e.code];
                        if (rating) {
                            e.preventDefault();
                            const timeTaken = this.cardStartTime ? Date.now() - this.cardStartTime : 0;
                            this.handleRating(currentCard, rating, timeTaken);
                            this.showCard();
                        }
                    }
                } catch (err) {
                    // Comment: Safe recovery in keyboard shortcut handler to prevent input interruptions
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('Tracker', `Error in review keyboard shortcut handler: ${errorMessage}`, { err });
                }
            };
            document.addEventListener('keydown', this._reviewKeyHandler);
        } catch (err) {
            // Comment: Safe recovery rendering showCard UI
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to show card: ${errorMessage}`, { err });
        }
    }

    /**
     * Applies the review rating to a target card, calculates new FSRS scheduler values,
     * updates storage databases, and logs activity increments.
     */
    handleRating(card: Card, rating: number, timeTaken: number = 0): void {
        try {
            const index = this.state.cards.findIndex((c: Card) => c.id === card.id);
            if (index === -1) return;

            // Determine if this card has a tag that matches a custom weight profile
            let customWeightsToApply: number[] | null = null;
            if (card.tags && card.tags.length > 0) {
                for (const tag of card.tags) {
                    if (this.state.topicWeights[tag]) {
                        customWeightsToApply = this.state.topicWeights[tag];
                        break;
                    }
                }
            }

            this.state.cards[index] = this.state.scheduler.reviewCard(card, rating, customWeightsToApply, Date.now(), timeTaken);
            (this.state.cards[index] as Card & { lastRating?: number }).lastRating = rating;

            this.saveCards();
            this.logReviewActivity();
        } catch (err) {
            // Comment: Safe recovery handling card rating calculation to avoid corrupting session state
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Failed to handle card rating: ${errorMessage}`, { cardId: card.id, rating, err });
        }
    }

    /**
     * Removes global document event listeners for hotkeys bound during card reviews.
     */
    private _cleanupReviewKeyboard(): void {
        try {
            if (this._reviewKeyHandler) {
                document.removeEventListener('keydown', this._reviewKeyHandler);
                this._reviewKeyHandler = null;
            }
        } catch (err) {
            // Comment: Non-fatal keyboard listener cleanup error catch
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Tracker', `Error during review keyboard cleanup: ${errorMessage}`, { err });
        }
    }
}

if (typeof window !== 'undefined') {
    try {
        const win = window as unknown as { AlgoRecall: { Tracker: typeof Tracker } };
        win.AlgoRecall = win.AlgoRecall || {};
        win.AlgoRecall.Tracker = Tracker;
    } catch (err) {
        // Comment: Safe recovery during global scope registration
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('Tracker', `Failed to register Tracker on window global scope: ${errorMessage}`, { err });
    }
}

export default Tracker;
