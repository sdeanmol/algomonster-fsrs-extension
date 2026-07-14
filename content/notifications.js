window.AlgoRecall = window.AlgoRecall || {};

/**
 * @class PageNotifier
 * @description Injects and manages interactive alerts and notifications directly inside the host page DOM.
 * Handles user actions such as dismissing, snoozing reviews for 15 minutes, or instantly expanding
 * the review widget panel on active tabs.
 */
window.AlgoRecall.Notifier = class Notifier {
    /**
     * Creates and appends an interactive custom floating notification popup card inside the current tab body.
     * Auto-dismisses standard alert flags after 6 seconds; review reminder flags remain sticky.
     * @param {string} title - The header title string of the notification.
     * @param {string} message - Descriptive text message.
     * @param {string} type - Notification type: 'review' (displays review options) or 'test'/other (simple alert).
     * @param {number} [count] - Optional counter indicating total due review items.
     */
    static showPageNotification(title, message, type, count) {
        // Prevent double notifications by removing the old one first
        const existing = document.getElementById('algo-custom-notification-el');
        if (existing) {
            existing.remove();
        }

        const notification = document.createElement('div');
        notification.id = 'algo-custom-notification-el';
        notification.className = 'algo-custom-notification';
        
        const state = window.AlgoRecall.state;
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
                <button id="algo-notif-btn-close" class="algo-notif-close" title="Close">&times;</button>
            </div>
            <p class="algo-notif-message">${message}</p>
            ${buttonsHtml}
        `;

        document.body.appendChild(notification);

        // Force style recalculation for smooth transition
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Helper to dismiss
        const dismissNotification = () => {
            notification.classList.remove('show');
            notification.addEventListener('transitionend', () => {
                notification.remove();
            }, { once: true });
        };

        // Auto-dismiss after 6 seconds for test notifications, or keep review sticky if required
        let autoDismissTimer = null;
        if (type !== 'review') {
            autoDismissTimer = setTimeout(dismissNotification, 6000);
        }

        // Event Listeners
        const closeBtn = notification.querySelector('#algo-notif-btn-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                if (autoDismissTimer) clearTimeout(autoDismissTimer);
                dismissNotification();
            });
        }

        const dismissBtn = notification.querySelector('#algo-notif-btn-dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                if (autoDismissTimer) clearTimeout(autoDismissTimer);
                dismissNotification();
            });
        }

        const snoozeBtn = notification.querySelector('#algo-notif-btn-snooze');
        if (snoozeBtn) {
            snoozeBtn.addEventListener('click', () => {
                if (autoDismissTimer) clearTimeout(autoDismissTimer);
                dismissNotification();
                chrome.runtime.sendMessage({ action: 'snooze_notification', minutes: 15 }, (response) => {
                    // Background handles scheduling snoozeFsrsReviews
                });
            });
        }

        const reviewBtn = notification.querySelector('#algo-notif-btn-review');
        if (reviewBtn) {
            reviewBtn.addEventListener('click', () => {
                if (autoDismissTimer) clearTimeout(autoDismissTimer);
                dismissNotification();
                
                // Open/Show the FSRS container and start the review flow!
                const launcher = document.getElementById('algo-fsrs-launcher');
                const container = document.getElementById('algo-fsrs-container');
                
                if (launcher) launcher.style.display = 'none';
                if (container) {
                    container.style.display = 'block';
                    const orchestrator = window.AlgoRecall.orchestrator;
                    if (orchestrator && orchestrator.tracker) {
                        orchestrator.tracker.refreshWidgetState();
                        orchestrator.tracker.startReview();
                    }
                }
            });
        }
    }
};
