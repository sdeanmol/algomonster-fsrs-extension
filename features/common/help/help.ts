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
        this.bindTabNavigation();
        this.bindSearchFilter();
        this.bindCloseButton();
    }

    /**
     * Tab switching logic
     */
    bindTabNavigation(): void {
        const tabButtons = document.querySelectorAll('.tab-btn');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                if (targetTab) {
                    this.switchTab(targetTab);
                }
            });
        });
    }

    switchTab(tabId: string): void {
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
    }

    /**
     * Live search filter across all cards and how-to guides
     */
    bindSearchFilter(): void {
        const searchInput = document.getElementById('help-search-input') as HTMLInputElement | null;
        if (!searchInput) return;

        searchInput.addEventListener('input', (e: Event) => {
            const query = (e.target as HTMLInputElement).value.toLowerCase().trim();
            this.filterContent(query);
        });
    }

    filterContent(query: string): void {
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
    }

    /**
     * Close guide button
     */
    bindCloseButton(): void {
        const closeBtn = document.getElementById('close-help-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                window.close();
            });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const helpCenter = new HelpCenterSPA();
    helpCenter.init();
});
