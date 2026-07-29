import { Logger } from '@common/logger';

/**
 * @file features/common/help/help.ts
 * @description Controller for AlgoRecall interactive Help Center, tab navigation, and live search.
 */
class HelpCenterSPA {
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
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HelpCenter', `Error initializing Help Center: ${errorMessage}`, { err });
            // Comment: Non-fatal Help Center setup catch
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
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HelpCenter', `Error handling tab button click: ${errorMessage}`, { err });
                    }
                });
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HelpCenter', `Error binding tab navigation: ${errorMessage}`, { err });
            // Comment: Non-fatal tab navigation binding catch
        }
    }

    switchTab(tabId: string): void {
        try {
            this.currentTab = tabId;
            const tabButtons = document.querySelectorAll('.tab-btn');
            const tabPanes = document.querySelectorAll('.tab-pane');

            tabButtons.forEach(btn => {
                const isTarget = btn.getAttribute('data-tab') === tabId;
                btn.classList.toggle('active', isTarget);
                btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
            });

            tabPanes.forEach(pane => {
                pane.classList.toggle('active', pane.id === `tab-${tabId}`);
            });

            // Reset search field if switching manually
            const searchInput = document.getElementById('help-search-input') as HTMLInputElement | null;
            if (searchInput && searchInput.value.trim() !== '') {
                searchInput.value = '';
                this.filterContent('');
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HelpCenter', `Error switching tab to '${tabId}': ${errorMessage}`, { tabId, err });
            // Comment: Catch tab display toggle error
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
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('HelpCenter', `Error in help search input handler: ${errorMessage}`, { err });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HelpCenter', `Error binding search filter: ${errorMessage}`, { err });
            // Comment: Catch search filter listener binding error
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
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HelpCenter', `Error filtering help content: ${errorMessage}`, { query, err });
            // Comment: Non-fatal content filter catch
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
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('HelpCenter', `Error closing Help Center window: ${errorMessage}`, { err });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HelpCenter', `Error binding close button: ${errorMessage}`, { err });
        }
    }
}

function initHelpCenter(): void {
    try {
        const helpCenter = new HelpCenterSPA();
        helpCenter.init();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('HelpCenter', `Error instantiating HelpCenterSPA: ${errorMessage}`, { err });
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHelpCenter);
    } else {
        initHelpCenter();
    }
}
