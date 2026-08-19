import { Logger } from '@common/logger';
import { UIUtils } from '../utils/uiUtils';

/**
 * @file features/common/help/help.ts
 * @description Controller for AlgoRecall interactive Help Center, tab navigation, and live search.
 */
export class HelpCenterSPA {
    currentTab: string;

    constructor() {
        this.currentTab = 'overview';
    }

    init(): void {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const tabParam = urlParams.get('tab');
            if (tabParam) {
                this.switchTab(tabParam);
            }
            this.bindTabNavigation();
            this.bindSearchFilter();
            this.bindCloseButton();
        } catch (err) {
            UIUtils.catchError('HelpCenter', 'Error initializing Help Center', err);
        }
    }

    /**
     * Tab switching logic
     */
    bindTabNavigation(): void {
        try {
            const tabButtons = document.querySelectorAll('.tab-btn');

            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    try {
                        const targetTab = button.getAttribute('data-tab');
                        if (targetTab) {
                            this.switchTab(targetTab);
                        }
                    } catch (err) {
                        UIUtils.catchError('HelpCenter', 'Error handling tab button click', err);
                    }
                });
            });
        } catch (err) {
            UIUtils.catchError('HelpCenter', 'Error binding tab navigation', err);
        }
    }

    switchTab(tabId: string): void {
        try {
            this.currentTab = tabId;
            const tabButtons = document.querySelectorAll('.tab-btn');
            const tabPanes = document.querySelectorAll('.tab-pane');
            const allCards = document.querySelectorAll('.card, .gamify-card, .strategy-card');

            // Reset card inline displays
            allCards.forEach((card: Element) => (card as HTMLElement).style.display = '');

            const searchInput = document.getElementById('help-search-input') as HTMLInputElement | null;
            if (searchInput) {
                searchInput.value = '';
            }

            tabButtons.forEach(btn => {
                const isTarget = btn.getAttribute('data-tab') === tabId;
                btn.classList.toggle('active', isTarget);
                btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
            });

            tabPanes.forEach(pane => {
                pane.classList.toggle('active', pane.id === `tab-${tabId}`);
            });
        } catch (err) {
            UIUtils.catchError('HelpCenter', `Error switching tab to '${tabId}'`, err, { tabId });
        }
    }

    /**
     * Live search filter across all cards and how-to guides
     */
    bindSearchFilter(): void {
        try {
            const searchInput = document.getElementById('help-search-input') as HTMLInputElement | null;
            if (!searchInput) return;

            searchInput.addEventListener('input', (e: Event) => {
                try {
                    const query = (e.target as HTMLInputElement).value.toLowerCase().trim();
                    this.filterContent(query);
                } catch (err) {
                    UIUtils.catchError('HelpCenter', 'Error in help search input handler', err);
                }
            });
        } catch (err) {
            UIUtils.catchError('HelpCenter', 'Error binding search filter', err);
        }
    }

    filterContent(query: string): void {
        try {
            const allCards = document.querySelectorAll('.card, .gamify-card, .strategy-card');
            const tabPanes = document.querySelectorAll('.tab-pane');
            const tabButtons = document.querySelectorAll('.tab-btn');

            if (!query) {
                // Restore normal tab mode
                allCards.forEach((card: Element) => (card as HTMLElement).style.display = '');
                tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === `tab-${this.currentTab}`));
                tabButtons.forEach(btn => {
                    const isTarget = btn.getAttribute('data-tab') === this.currentTab;
                    btn.classList.toggle('active', isTarget);
                    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
                });
                return;
            }

            // Search mode: show matching cards and reveal their tab panes
            let matchFound = false;

            tabPanes.forEach(pane => {
                let paneHasMatch = false;
                const cardsInPane = pane.querySelectorAll('.card, .gamify-card, .strategy-card');

                cardsInPane.forEach((card: Element) => {
                    const text = card.textContent?.toLowerCase() || '';
                    const isMatch = text.includes(query);
                    (card as HTMLElement).style.display = isMatch ? '' : 'none';
                    if (isMatch) paneHasMatch = true;
                });

                pane.classList.toggle('active', paneHasMatch);
                if (paneHasMatch) matchFound = true;
            });

            // Highlight tabs containing matches
            tabButtons.forEach(btn => {
                const tabId = btn.getAttribute('data-tab');
                const targetPane = document.getElementById(`tab-${tabId}`);
                const hasMatch = targetPane && targetPane.querySelectorAll('.card:not([style*="display: none"]), .gamify-card:not([style*="display: none"]), .strategy-card:not([style*="display: none"])').length > 0;
                btn.classList.toggle('active', !!hasMatch);
            });
        } catch (err) {
            UIUtils.catchError('HelpCenter', 'Error filtering help content', err, { query });
        }
    }

    /**
     * Close guide button
     */
    bindCloseButton(): void {
        try {
            const closeBtn = document.getElementById('close-help-btn');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    try {
                        window.close();
                    } catch (err) {
                        UIUtils.catchError('HelpCenter', 'Error closing Help Center window', err);
                    }
                });
            }
        } catch (err) {
            UIUtils.catchError('HelpCenter', 'Error binding close button', err);
        }
    }
}

function initHelpCenter(): void {
    try {
        const helpCenter = new HelpCenterSPA();
        helpCenter.init();
    } catch (err) {
        UIUtils.catchError('HelpCenter', 'Error instantiating HelpCenterSPA', err);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHelpCenter);
    } else {
        initHelpCenter();
    }
}
