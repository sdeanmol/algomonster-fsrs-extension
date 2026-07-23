/**
 * @file features/common/help/help.js
 * @description Controller for AlgoRecall interactive Help Center, tab navigation, and live search.
 */
class HelpCenterSPA {
    constructor() {
        this.currentTab = 'overview';
    }

    init() {
        this.bindTabNavigation();
        this.bindSearchFilter();
        this.bindCloseButton();
    }

    /**
     * Tab switching logic
     */
    bindTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabPanes = document.querySelectorAll('.tab-pane');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');
                this.switchTab(targetTab);
            });
        });
    }

    switchTab(tabId) {
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
        const searchInput = document.getElementById('help-search-input');
        if (searchInput && searchInput.value.trim() !== '') {
            searchInput.value = '';
            this.filterContent('');
        }
    }

    /**
     * Live search filter across all cards and how-to guides
     */
    bindSearchFilter() {
        const searchInput = document.getElementById('help-search-input');
        if (!searchInput) return;

        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            this.filterContent(query);
        });
    }

    filterContent(query) {
        const allCards = document.querySelectorAll('.card, .gamify-card, .strategy-card');
        const tabPanes = document.querySelectorAll('.tab-pane');
        const tabButtons = document.querySelectorAll('.tab-btn');

        if (!query) {
            // Restore normal tab mode
            allCards.forEach(card => card.style.display = '');
            tabPanes.forEach(pane => pane.classList.toggle('active', pane.id === `tab-${this.currentTab}`));
            return;
        }

        // Search mode: show matching cards and reveal their tab panes
        let matchFound = false;

        tabPanes.forEach(pane => {
            let paneHasMatch = false;
            const cardsInPane = pane.querySelectorAll('.card, .gamify-card, .strategy-card');

            cardsInPane.forEach(card => {
                const text = card.textContent.toLowerCase();
                const isMatch = text.includes(query);
                card.style.display = isMatch ? '' : 'none';
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
            btn.classList.toggle('active', hasMatch);
        });
    }

    /**
     * Close guide button
     */
    bindCloseButton() {
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
