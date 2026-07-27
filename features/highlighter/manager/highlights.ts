import { HighlightsHelpers } from './highlights-helpers';
import { HighlightMark, BookmarkItem, StorageData } from '../../../types/domain';

window.AlgoRecall = window.AlgoRecall || {};

export class HighlightsManager {
    loadedMarks: HighlightMark[];
    loadedBookmarks: BookmarkItem[];
    searchQuery: string;
    activeColorFilter: string | null;
    activePageFilter: string;
    sortOption: string;

    constructor() {
        this.loadedMarks = [];
        this.loadedBookmarks = [];
        
        this.searchQuery = '';
        this.activeColorFilter = null;
        this.activePageFilter = 'all';
        this.sortOption = 'newest';
    }

    get helpers(): typeof HighlightsHelpers {
        return window.AlgoRecall.HighlightsHelpers || HighlightsHelpers;
    }

    init(): void {
        this.loadHighlights();
        this.bindEvents();
    }

    bindEvents(): void {
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.loadHighlights();
            });
        }

        const exportBtn = document.getElementById('export-highlights-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportHighlightsToMarkdown();
            });
        }

        const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
        if (searchInput) {
            searchInput.addEventListener('input', (e: Event) => {
                const target = e.target as HTMLInputElement;
                this.searchQuery = target.value.trim();
                this.filterAndRender();
            });
        }

        const webpageSelect = document.getElementById('webpage-select') as HTMLSelectElement | null;
        if (webpageSelect) {
            webpageSelect.addEventListener('change', (e: Event) => {
                const target = e.target as HTMLSelectElement;
                this.activePageFilter = target.value;
                this.filterAndRender();
            });
        }

        const sortSelect = document.getElementById('sort-select') as HTMLSelectElement | null;
        if (sortSelect) {
            sortSelect.addEventListener('change', (e: Event) => {
                const target = e.target as HTMLSelectElement;
                this.sortOption = target.value;
                this.filterAndRender();
            });
        }

        const clearFiltersBtn = document.getElementById('clear-filters-btn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.searchQuery = '';
                this.activeColorFilter = null;
                this.activePageFilter = 'all';
                this.sortOption = 'newest';

                if (searchInput) searchInput.value = '';
                if (webpageSelect) webpageSelect.value = 'all';
                if (sortSelect) sortSelect.value = 'newest';

                this.renderColorFilters();
                this.filterAndRender();
            });
        }
    }

    loadHighlights(): void {
        chrome.storage.local.get(['marks', 'bookmarks'], (result: StorageData) => {
            this.loadedMarks = result.marks || [];
            this.loadedBookmarks = result.bookmarks || [];
            
            this.populateWebpageSelect();
            this.renderColorFilters();
            
            this.filterAndRender();
        });
    }

    populateWebpageSelect(): void {
        const select = document.getElementById('webpage-select') as HTMLSelectElement | null;
        if (!select) return;
        
        select.innerHTML = '<option value="all">All Pages</option>';

        const uniquePagesMap = new Map<string, string>();
        this.loadedMarks.forEach(mark => {
            const bookmark = this.loadedBookmarks.find(b => b.url === mark.url);
            const title = bookmark && bookmark.title ? bookmark.title : this.helpers.getCleanDisplayUrl(mark.url);
            uniquePagesMap.set(mark.url, title);
        });

        for (const [url, title] of uniquePagesMap.entries()) {
            const option = document.createElement('option');
            option.value = url;
            option.textContent = title.length > 50 ? title.substring(0, 50) + '...' : title;
            select.appendChild(option);
        }
        
        select.value = this.activePageFilter;
    }

    renderColorFilters(): void {
        const container = document.getElementById('color-filters-container');
        if (!container) return;
        container.innerHTML = '';

        const uniqueColors = [...new Set(this.loadedMarks.map(m => m.color).filter(Boolean))];

        if (uniqueColors.length === 0) {
            container.innerHTML = '<span style="font-size: 12px; color: #666;">No colors</span>';
            return;
        }

        uniqueColors.forEach(color => {
            const bubble = document.createElement('div');
            bubble.className = 'color-filter-bubble';
            bubble.style.backgroundColor = color;
            
            if (this.activeColorFilter === color) {
                bubble.classList.add('active');
            }

            bubble.addEventListener('click', () => {
                if (this.activeColorFilter === color) {
                    this.activeColorFilter = null;
                } else {
                    this.activeColorFilter = color;
                }
                this.renderColorFilters();
                this.filterAndRender();
            });

            container.appendChild(bubble);
        });
    }

    filterAndRender(): void {
        const container = document.getElementById('highlights-container');
        const subtitle = document.getElementById('highlight-subtitle');
        const clearFiltersBtn = document.getElementById('clear-filters-btn');
        if (!container) return;

        const filtered = this.loadedMarks.filter(mark => {
            const bookmark = this.loadedBookmarks.find(b => b.url === mark.url);
            const pageTitle = bookmark && bookmark.title ? bookmark.title.toLowerCase() : '';
            const markText = mark.text.toLowerCase();
            const markUrl = mark.url.toLowerCase();
            const markNote = (mark.note || '').toLowerCase();
            const markCategory = (mark.category || '').toLowerCase();
            const q = this.searchQuery.toLowerCase();

            const matchesQuery = !this.searchQuery || 
                                 markText.includes(q) || 
                                 pageTitle.includes(q) || 
                                 markUrl.includes(q) ||
                                 markNote.includes(q) ||
                                 markCategory.includes(q);

            const matchesColor = !this.activeColorFilter || mark.color === this.activeColorFilter;
            const matchesPage = this.activePageFilter === 'all' || mark.url === this.activePageFilter;

            return matchesQuery && matchesColor && matchesPage;
        });

        filtered.sort((a, b) => {
            if (this.sortOption === 'newest') {
                return b.createdAt - a.createdAt;
            } else if (this.sortOption === 'oldest') {
                return a.createdAt - b.createdAt;
            } else if (this.sortOption === 'longest') {
                return b.text.length - a.text.length;
            } else if (this.sortOption === 'shortest') {
                return a.text.length - b.text.length;
            } else if (this.sortOption === 'title') {
                const bookmarkA = this.loadedBookmarks.find(b => b.url === a.url);
                const bookmarkB = this.loadedBookmarks.find(b => b.url === b.url);
                const titleA = bookmarkA && bookmarkA.title ? bookmarkA.title.toLowerCase() : a.url.toLowerCase();
                const titleB = bookmarkB && bookmarkB.title ? bookmarkB.title.toLowerCase() : b.url.toLowerCase();
                return titleA.localeCompare(titleB);
            }
            return 0;
        });

        const isFilteredActive = this.searchQuery !== '' || this.activeColorFilter !== null || this.activePageFilter !== 'all';
        if (clearFiltersBtn) {
            clearFiltersBtn.style.display = isFilteredActive ? 'inline-block' : 'none';
        }

        if (subtitle) {
            if (isFilteredActive) {
                subtitle.innerText = `Found ${filtered.length} matching highlight(s) out of ${this.loadedMarks.length} total.`;
            } else {
                subtitle.innerText = `You have ${this.loadedMarks.length} saved highlight(s).`;
            }
        }

        container.innerHTML = '';
        if (filtered.length === 0) {
            container.innerHTML = `<div class="empty-state">No matching highlights found. Try adjusting your search or filters.</div>`;
            return;
        }

        filtered.forEach(mark => {
            const markId = mark.id || mark.createdAt.toString();
            const bookmark = this.loadedBookmarks.find(b => b.url === mark.url);
            const pageTitle = bookmark && bookmark.title ? bookmark.title : mark.url;

            const card = document.createElement('div');
            card.className = 'highlight-card';
            card.style.borderLeftColor = mark.color;

            const dateString = new Date(mark.createdAt).toLocaleDateString(undefined, {
                year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            const formattedSnippet = this.helpers.highlightSearchMatch(mark.text, this.searchQuery);
            
            const markType = mark.type || 'highlight';
            let typeIcon = '';
            if (markType === 'underline') {
                typeIcon = '<svg class="svg-icon" viewBox="0 0 24 24" style="width:12px; height:12px; margin-right:4px;"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path><line x1="4" y1="21" x2="20" y2="21"></line></svg> Underline';
            } else {
                typeIcon = '<svg class="svg-icon" viewBox="0 0 24 24" style="width:12px; height:12px; margin-right:4px;"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="6.5"></line></svg> Highlight';
            }

            card.innerHTML = `
                <div class="highlight-content">
                    <div style="font-size: 11px; text-transform: uppercase; color: var(--md-text-low); margin-bottom: 6px; display: flex; align-items: center;">
                        ${typeIcon}
                    </div>
                    <div class="highlight-text" style="${markType === 'underline' ? `text-decoration: underline; text-decoration-color: ${mark.color};` : ''}">"${formattedSnippet}"</div>
                    ${mark.note ? `<div class="highlight-note-preview"><svg class="svg-icon" viewBox="0 0 24 24" style="width:11px; height:11px; stroke: var(--md-text-low);"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> ${this.helpers.escapeHtml(mark.note)}</div>` : ''}
                    <div class="highlight-meta">
                        <a href="${mark.url}" target="_blank" class="highlight-url">
                            <svg class="svg-icon" viewBox="0 0 24 24" style="width:13px; height:13px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                            <span>${pageTitle}</span>
                        </a>
                        <span class="highlight-date">
                            <svg class="svg-icon" viewBox="0 0 24 24" style="width:13px; height:13px; stroke: var(--md-text-low);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            <span>${dateString}</span>
                        </span>
                    </div>
                </div>
                <div class="card-actions">
                    <button class="action-btn action-btn-copy" data-text="${this.helpers.escapeHtml(mark.text)}" title="Copy text to clipboard" aria-label="Copy text to clipboard">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:14px; height:14px; stroke:currentColor;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                    </button>
                    <button class="action-btn action-btn-delete" data-id="${markId}" title="Delete Highlight" aria-label="Delete Highlight">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:14px; height:14px; stroke:currentColor;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            `;

            container.appendChild(card);
        });

        container.querySelectorAll('.action-btn-copy').forEach(btn => {
            btn.addEventListener('click', (e: Event) => {
                const target = e.currentTarget as HTMLElement;
                const text = target.getAttribute('data-text') || '';
                this.helpers.copyToClipboard(text);
            });
        });

        container.querySelectorAll('.action-btn-delete').forEach(btn => {
            btn.addEventListener('click', (e: Event) => {
                const target = e.currentTarget as HTMLElement;
                const targetId = target.getAttribute('data-id');
                if (targetId) {
                    this.deleteHighlight(targetId);
                }
            });
        });
    }

    deleteHighlight(markId: string): void {
        if (confirm("Are you sure you want to delete this highlight?")) {
            chrome.storage.local.get(['marks'], (result: StorageData) => {
                let marks = result.marks || [];
                marks = marks.filter((m: HighlightMark) => (m.id || m.createdAt.toString()) !== markId);
                chrome.storage.local.set({ marks }, () => {
                    this.loadHighlights();
                });
            });
        }
    }

    exportHighlightsToMarkdown(): void {
        const filtered = this.loadedMarks.filter(mark => {
            const bookmark = this.loadedBookmarks.find(b => b.url === mark.url);
            const pageTitle = bookmark && bookmark.title ? bookmark.title.toLowerCase() : '';
            const markText = mark.text.toLowerCase();
            const markUrl = mark.url.toLowerCase();
            const markNote = (mark.note || '').toLowerCase();
            const markCategory = (mark.category || '').toLowerCase();
            const q = this.searchQuery.toLowerCase();

            const matchesQuery = !this.searchQuery || 
                                 markText.includes(q) || 
                                 pageTitle.includes(q) || 
                                 markUrl.includes(q) ||
                                 markNote.includes(q) ||
                                 markCategory.includes(q);

            const matchesColor = !this.activeColorFilter || mark.color === this.activeColorFilter;
            const matchesPage = this.activePageFilter === 'all' || mark.url === this.activePageFilter;

            return matchesQuery && matchesColor && matchesPage;
        });

        if (filtered.length === 0) {
            alert('No highlights to export!');
            return;
        }

        let markdownContent = `# AlgoRecall Highlights Export\n\n`;
        markdownContent += `*Exported on ${new Date().toLocaleString()}*\n\n---\n\n`;

        filtered.forEach(mark => {
            const bookmark = this.loadedBookmarks.find(b => b.url === mark.url);
            const pageTitle = bookmark && bookmark.title ? bookmark.title : mark.url;
            const categoryLabel = mark.category ? `**[${mark.category}]** ` : '';
            
            markdownContent += `### [${pageTitle}](${mark.url})\n\n`;
            markdownContent += `> ${categoryLabel}${mark.text}\n\n`;
            if (mark.note) {
                markdownContent += `*Note: ${mark.note}*\n\n`;
            }
            markdownContent += `---\n\n`;
        });

        const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        chrome.downloads.download({
            url: url,
            filename: `algorecall_highlights_${new Date().toISOString().split('T')[0]}.md`,
            saveAs: true
        });
    }
}

const win = window as unknown as { AlgoRecall: { HighlightsManager?: typeof HighlightsManager } };
win.AlgoRecall = win.AlgoRecall || {};
win.AlgoRecall.HighlightsManager = HighlightsManager;

document.addEventListener('DOMContentLoaded', () => {
    const manager = new HighlightsManager();
    manager.init();
});
