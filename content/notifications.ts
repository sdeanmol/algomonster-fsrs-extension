import { Logger } from '@common/logger';
import { AlgoRecallState } from './state';
import { MessageResponse } from '../types/domain';
import { SNOOZE_DEFAULT_MINUTES } from '../features/common/constants';

interface AlgoRecallGlobal {
    state?: AlgoRecallState;
    Notifier?: typeof Notifier;
    orchestrator?: {
        tracker?: {
            refreshWidgetState(): void;
            startReview(): void;
        };
    };
}

function getAlgoRecallGlobal(): AlgoRecallGlobal {
    try {
        const win = window as unknown as { AlgoRecall?: AlgoRecallGlobal };
        win.AlgoRecall = win.AlgoRecall || {};
        return win.AlgoRecall;
    } catch (err) {
        // Comment: Safe recovery fallback if window global access fails
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('Notifier', `Failed to access window global in getAlgoRecallGlobal: ${errorMessage}`, { err });
        return {};
    }
}

/**
 * @class PageNotifier
 * @description Injects and manages interactive alerts and notifications directly inside the host page DOM.
 * Handles user actions such as dismissing, snoozing reviews for 15 minutes, or instantly expanding
 * the review widget panel on active tabs.
 */
export class Notifier {
    /**
     * Creates and appends an interactive custom floating notification popup card inside the current tab body.
     * Auto-dismisses standard alert flags after 6 seconds; review reminder flags remain sticky.
     * @param {string} title - The header title string of the notification.
     * @param {string} message - Descriptive text message.
     * @param {string} type - Notification type: 'review' (displays review options) or 'test'/other (simple alert).
     * @param {number} [count] - Optional counter indicating total due review items.
     */
    static showPageNotification(title: string, message: string, type: string, count?: number): void {
        try {
            // Prevent double notifications by removing the old one first
            const existing = document.getElementById('algo-custom-notification-el');
            if (existing) {
                existing.remove();
            }

            const notification = document.createElement('div');
            notification.id = 'algo-custom-notification-el';
            notification.className = 'algo-custom-notification';
            notification.setAttribute('role', 'alert');
            notification.setAttribute('aria-live', 'assertive');
            
            const state = getAlgoRecallGlobal().state;
            if (state && state.currentTheme === 'light') {
                notification.classList.add('light-theme');
            }
            
            const iconSymbol = type === 'review' 
                ? `<svg class="svg-icon" viewBox="0 0 24 24" style="stroke: var(--md-primary); width:18px; height:18px;"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z"></path><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z"></path><path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2"></path></svg>`
                : `<svg class="svg-icon" viewBox="0 0 24 24" style="stroke: var(--md-primary); width:18px; height:18px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
            const iconClass = type === 'review' ? 'algo-notif-icon review' : 'algo-notif-icon';
            
            let buttonsHtml = '';
            if (type === 'review') {
                buttonsHtml = `
                    <div class="algo-notif-buttons">
                        <button id="algo-notif-btn-review" class="algo-notif-btn algo-notif-btn-primary">Review Now</button>
                        <button id="algo-notif-btn-snooze" class="algo-notif-btn algo-notif-btn-secondary">Snooze (15m)</button>
                    </div>
                `;
            } else {
                buttonsHtml = `
                    <div class="algo-notif-buttons">
                        <button id="algo-notif-btn-dismiss" class="algo-notif-btn algo-notif-btn-secondary" style="width: 100%;">Dismiss</button>
                    </div>
                `;
            }

            notification.innerHTML = `
                <div class="algo-notif-header">
                    <div class="algo-notif-header-left">
                        <span class="${iconClass}">${iconSymbol}</span>
                        <span class="algo-notif-title">${title}</span>
                    </div>
                    <button id="algo-notif-btn-close" class="algo-notif-close" aria-label="Close" title="Close">&times;</button>
                </div>
                <p class="algo-notif-message">${message}</p>
                ${buttonsHtml}
            `;

            document.body.appendChild(notification);

            // Force style recalculation for smooth transition
            requestAnimationFrame(() => {
                try {
                    notification.classList.add('show');
                } catch (animErr) {
                    // Comment: Safe recovery in animation frame style update
                    const errorMessage = animErr instanceof Error ? animErr.message : String(animErr);
                    Logger.error('Notifier', `Error toggling notification show class: ${errorMessage}`, { animErr });
                }
            });

            // Helper to dismiss
            const dismissNotification = () => {
                try {
                    notification.classList.remove('show');
                    notification.addEventListener('transitionend', () => {
                        try {
                            notification.remove();
                        } catch {
                            // Comment: Ignore DOM removal error if element was already removed
                        }
                    }, { once: true });
                } catch (dismissErr) {
                    // Comment: Direct cleanup fallback if transition fails
                    const errorMessage = dismissErr instanceof Error ? dismissErr.message : String(dismissErr);
                    Logger.error('Notifier', `Error in dismissNotification helper: ${errorMessage}`, { dismissErr });
                    try { notification.remove(); } catch { /* Ignore */ }
                }
            };

            // Auto-dismiss after 6 seconds for test notifications, or keep review sticky if required
            let autoDismissTimer: ReturnType<typeof setTimeout> | null = null;
            if (type !== 'review') {
                autoDismissTimer = setTimeout(dismissNotification, 6000);
            }

            // Event Listeners
            const closeBtn = notification.querySelector('#algo-notif-btn-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    try {
                        if (autoDismissTimer) clearTimeout(autoDismissTimer);
                        dismissNotification();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Notifier', `Error closing notification: ${errorMessage}`, { err });
                    }
                });
            }

            const dismissBtn = notification.querySelector('#algo-notif-btn-dismiss');
            if (dismissBtn) {
                dismissBtn.addEventListener('click', () => {
                    try {
                        if (autoDismissTimer) clearTimeout(autoDismissTimer);
                        dismissNotification();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Notifier', `Error dismissing notification: ${errorMessage}`, { err });
                    }
                });
            }

            const snoozeBtn = notification.querySelector('#algo-notif-btn-snooze');
            if (snoozeBtn) {
                snoozeBtn.addEventListener('click', () => {
                    try {
                        if (autoDismissTimer) clearTimeout(autoDismissTimer);
                        dismissNotification();
                        if (typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.sendMessage === 'function') {
                            chrome.runtime.sendMessage({ action: 'snooze_notification', minutes: SNOOZE_DEFAULT_MINUTES }, (_response?: MessageResponse) => {
                                try {
                                    if (chrome.runtime.lastError) {
                                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                        Logger.error('Notifier', `Error sending snooze message: ${errorMessage}`, { error: chrome.runtime.lastError });
                                    }
                                } catch (msgErr) {
                                    const errorMessage = msgErr instanceof Error ? msgErr.message : String(msgErr);
                                    Logger.error('Notifier', `Error handling snooze response callback: ${errorMessage}`, { msgErr });
                                }
                            });
                        }
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Notifier', `Context invalidation on snooze message: ${errorMessage}`, { err });
                    }
                });
            }

            const reviewBtn = notification.querySelector('#algo-notif-btn-review');
            if (reviewBtn) {
                reviewBtn.addEventListener('click', () => {
                    try {
                        if (autoDismissTimer) clearTimeout(autoDismissTimer);
                        dismissNotification();
                        
                        // Open/Show the scheduler container and start the review flow!
                        const launcher = document.getElementById('algo-fsrs-launcher');
                        const container = document.getElementById('algo-fsrs-container');
                        
                        if (launcher) launcher.style.display = 'none';
                        if (container) {
                            container.style.display = 'block';
                            const orchestrator = getAlgoRecallGlobal().orchestrator;
                            if (orchestrator && orchestrator.tracker) {
                                orchestrator.tracker.refreshWidgetState();
                                orchestrator.tracker.startReview();
                            }
                        }
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Notifier', `Error initiating review session from notification: ${errorMessage}`, { err });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Notifier', `Failed to render page notification: ${errorMessage}`, { title, type, count, err });
            // Comment: Non-fatal page notification error, host page layout remains unaffected
        }
    }
}

try {
    getAlgoRecallGlobal().Notifier = Notifier;
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('Notifier', `Failed to assign Notifier on window global scope: ${errorMessage}`, { err });
    // Comment: Non-fatal global scope registration error
}
