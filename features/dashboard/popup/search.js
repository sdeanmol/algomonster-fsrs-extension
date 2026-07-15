import { DashboardComponent } from './DashboardComponent.js';

/**
 * @class QuickSearchComponent
 * @extends DashboardComponent
 * @description Renders filtered card quick search items matching text query and topic tag fields.
 */
export class QuickSearchComponent extends DashboardComponent {
    constructor(coordinator) {
        super(coordinator);
        this.quickSearchCards = [];
        this.quickSearchDebounce = null;
    }

    /**
     * Initializes quick search input and tag selectors from the dashboard.
     */
    async load() {
        const searchInput = document.getElementById('popup-search-input');
        const tagFilter = document.getElementById('popup-tag-filter');
        const resultsContainer = document.getElementById('popup-search-results');

        if (!searchInput || !tagFilter || !resultsContainer) return;

        try {
            // Load cards and populate tag filter
            const result = await chrome.storage.local.get(['fsrsCards']);
            this.quickSearchCards = result.fsrsCards || [];

            // Populate tag dropdown (keep the 'All Tags' option)
            while (tagFilter.options.length > 1) {
                tagFilter.remove(1);
            }

            const tagsSet = new Set();
            this.quickSearchCards.forEach(card => {
                if (card.tags && Array.isArray(card.tags)) {
                    card.tags.forEach(t => tagsSet.add(t));
                }
            });
            [...tagsSet].sort().forEach(tag => {
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = tag;
                tagFilter.appendChild(option);
            });
        } catch (error) {
            console.error("Error loading quick search cards:", error);
        }
    }

    /**
     * Binds input and selection events for quick search filters.
     */
    bindEvents() {
        const searchInput = document.getElementById('popup-search-input');
        const tagFilter = document.getElementById('popup-tag-filter');

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this.quickSearchDebounce);
                this.quickSearchDebounce = setTimeout(() => this.renderQuickSearch(), 150);
            });
        }

        if (tagFilter) {
            tagFilter.addEventListener('change', () => this.renderQuickSearch());
        }
    }

    /**
     * Renders filtered card quick search items matching text query and topic tag fields.
     */
    renderQuickSearch() {
        const searchInput = document.getElementById('popup-search-input');
        const tagFilter = document.getElementById('popup-tag-filter');
        const resultsContainer = document.getElementById('popup-search-results');

        if (!searchInput || !resultsContainer) return;

        const query = searchInput.value.trim().toLowerCase();
        const selectedTag = tagFilter ? tagFilter.value : 'all';

        // Hide results if no query and no tag filter
        if (!query && selectedTag === 'all') {
            resultsContainer.innerHTML = '';
            resultsContainer.style.display = 'none';
            return;
        }

        const now = Date.now();
        let filtered = this.quickSearchCards.filter(card => {
            // Tag filter
            if (selectedTag !== 'all' && !(card.tags && card.tags.includes(selectedTag))) return false;

            // Search query
            if (query) {
                const titleMatch = card.problemTitle && card.problemTitle.toLowerCase().includes(query);
                const urlMatch = card.problemUrl && card.problemUrl.toLowerCase().includes(query);
                const tagMatch = card.tags && card.tags.some(t => t.toLowerCase().includes(query));
                if (!titleMatch && !urlMatch && !tagMatch) return false;
            }

            return true;
        });

        const totalMatches = filtered.length;
        const maxDisplay = 5;
        const displayCards = filtered.slice(0, maxDisplay);

        if (displayCards.length === 0) {
            resultsContainer.style.display = 'block';
            resultsContainer.innerHTML = `<div class="popup-search-empty">No matching patterns found.</div>`;
            return;
        }

        let html = displayCards.map(card => {
            const isDue = card.due <= now;
            const statusBadge = isDue
                ? '<span class="popup-badge popup-badge-due">Due</span>'
                : '<span class="popup-badge popup-badge-safe">Safe</span>';
            const tagsHtml = (card.tags || []).slice(0, 3).map(t => `<span class="popup-tag">${t}</span>`).join('');
            const title = card.problemTitle || 'Untitled';

            return `<a href="${card.problemUrl}" target="_blank" class="popup-search-item" title="${title}" aria-label="${title}">
                <div class="popup-search-item-top">
                    <span class="popup-search-title">${title}</span>
                    ${statusBadge}
                </div>
                <div class="popup-search-item-tags">${tagsHtml}</div>
            </a>`;
        }).join('');

        if (totalMatches > maxDisplay) {
            const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=total`);
            html += `<a href="${dataUrl}" target="_blank" class="popup-search-view-all">View all ${totalMatches} results →</a>`;
        }

        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = html;
    }
}
