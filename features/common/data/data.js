/**
 * @file features/common/data/data.js
 * @description Manages database tables listing saved patterns.
 * Supports keyword search, filter dropdown updates (status, tag categories),
 * overall memory retention rates calculations, stacked distribution bars, and card deletion events.
 */
class FSRSDataDashboard {
    constructor() {
        this.allCards = [];
        this.currentView = 'total';
        this.targetDate = null;
        
        this.searchQuery = '';
        this.selectedTag = 'all';
        this.selectedStatus = 'all';
        this.chromeSettings = {};
    }

    /**
     * Bootstraps dashboard parameters and sets up storage variables.
     */
    init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.currentView = urlParams.get('view') || 'total';
        this.targetDate = urlParams.get('date');

        chrome.storage.local.get(['fsrsCards', 'chromeSettings'], (result) => {
            this.allCards = result.fsrsCards || [];
            this.chromeSettings = result.chromeSettings || {};
            
            // Dynamic Filter Populators
            this.populateTagsFilter();
            
            // Register Listeners
            this.bindEvents();

            // Run initial render
            this.filterAndRender();
        });
    }

    /**
     * Registers control elements click and input listener bindings.
     */
    bindEvents() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.trim();
                this.filterAndRender();
            });
        }

        const tagSelect = document.getElementById('tag-select');
        if (tagSelect) {
            tagSelect.addEventListener('change', (e) => {
                this.selectedTag = e.target.value;
                this.filterAndRender();
            });
        }

        const statusSelect = document.getElementById('status-select');
        if (statusSelect) {
            statusSelect.addEventListener('change', (e) => {
                this.selectedStatus = e.target.value;
                this.filterAndRender();
            });
        }

        const clearBtn = document.getElementById('clear-filters-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.searchQuery = '';
                this.selectedTag = 'all';
                this.selectedStatus = 'all';

                if (searchInput) searchInput.value = '';
                if (tagSelect) tagSelect.value = 'all';
                if (statusSelect) statusSelect.value = 'all';

                this.filterAndRender();
            });
        }
    }

    /**
     * Searches the collection of card objects and populates tag select options dynamically.
     */
    populateTagsFilter() {
        const tagSelect = document.getElementById('tag-select');
        if (!tagSelect) return;

        // Reset but keep first option (all)
        tagSelect.innerHTML = '<option value="all">All Tags</option>';

        // Collect all unique tags
        const tagsSet = new Set();
        this.allCards.forEach(card => {
            if (card.tags && Array.isArray(card.tags)) {
                card.tags.forEach(t => tagsSet.add(t));
            }
        });

        // Populate select
        tagsSet.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagSelect.appendChild(option);
        });
    }

    /**
     * Filters the cards collection by search keywords, active tags, and due statuses,
     * and calls the rendering templates.
     */
    filterAndRender() {
        const titleEl = document.getElementById('page-title');
        const subtitleEl = document.getElementById('page-subtitle');
        const contentEl = document.getElementById('data-content');
        const clearFiltersBtn = document.getElementById('clear-filters-btn');
        const now = new Date().getTime();

        // 1. Build Base Dataset according to view
        let baseCards = [];
        let isRetention = false;

        if (this.currentView === 'total') {
            if (titleEl) titleEl.innerText = 'Total Saved Patterns';
            baseCards = [...this.allCards];
        } 
        else if (this.currentView === 'due') {
            baseCards = this.allCards.filter(c => c.due <= now).sort((a, b) => a.due - b.due);
            if (titleEl) titleEl.innerText = 'Patterns Due Today';
        } 
        else if (this.currentView === 'retention') {
            isRetention = true;
            baseCards = this.allCards.filter(c => c.lapses > 0).sort((a, b) => b.lapses - a.lapses);
            if (titleEl) titleEl.innerText = 'Retention & Analytics';
        }
        else if (this.currentView === 'history' && this.targetDate) {
            const filteredCards = this.allCards.filter(c => {
                if (!c.historyLog) return false;
                return c.historyLog.some(timestamp => {
                    const dateObj = new Date(timestamp);
                    const localDateStr = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                    return localDateStr.startsWith(this.targetDate);
                });
            });
            baseCards = [...new Set(filteredCards)]; // Deduplicate
            
            let dateDisplay = this.targetDate;
            if (this.targetDate.length === 7) {
                const [y, m] = this.targetDate.split('-');
                const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                dateDisplay = `${monthNames[parseInt(m)-1]} ${y}`;
            } else if (this.targetDate.length === 10) {
                dateDisplay = new Date(this.targetDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            }
            if (titleEl) titleEl.innerText = `Activity for ${dateDisplay}`;
        }
        else if (this.currentView === 'forecast' && this.targetDate) {
            const urlParams = new URLSearchParams(window.location.search);
            const dayOffset = parseInt(urlParams.get('offset') || '0');

            // Build day boundaries for the target date
            const targetParts = this.targetDate.split('-');
            const targetDayStart = new Date(parseInt(targetParts[0]), parseInt(targetParts[1]) - 1, parseInt(targetParts[2]));
            const targetDayEnd = new Date(targetDayStart);
            targetDayEnd.setDate(targetDayEnd.getDate() + 1);

            const targetStartTime = targetDayStart.getTime();
            const targetEndTime = targetDayEnd.getTime();

            if (dayOffset === 0) {
                // Today: cards due now (due <= end of today) — includes past-due
                baseCards = this.allCards.filter(c => c.due < targetEndTime);
            } else {
                // Future day: cards due within [dayStart, dayEnd)
                baseCards = this.allCards.filter(c => c.due >= targetStartTime && c.due < targetEndTime);
            }

            baseCards.sort((a, b) => a.due - b.due);

            const dateDisplay = new Date(this.targetDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
            if (titleEl) titleEl.innerText = `Cards Due — ${dateDisplay}`;
        }

        // 2. Filter base dataset
        let filtered = baseCards.filter(card => {
            const titleMatch = card.problemTitle && card.problemTitle.toLowerCase().includes(this.searchQuery.toLowerCase());
            const urlMatch = card.problemUrl && card.problemUrl.toLowerCase().includes(this.searchQuery.toLowerCase());
            const tagMatch = card.tags && card.tags.some(t => t.toLowerCase().includes(this.searchQuery.toLowerCase()));
            
            const matchesSearch = !this.searchQuery || titleMatch || urlMatch || tagMatch;
            const matchesTag = this.selectedTag === 'all' || (card.tags && card.tags.includes(this.selectedTag));
            const isCardDue = card.due <= now;
            const matchesStatus = this.selectedStatus === 'all' || 
                                  (this.selectedStatus === 'due' && isCardDue) || 
                                  (this.selectedStatus === 'safe' && !isCardDue);

            return matchesSearch && matchesTag && matchesStatus;
        });

        // 3. Toggle reset button
        const isFilterActive = this.searchQuery !== '' || this.selectedTag !== 'all' || this.selectedStatus !== 'all';
        if (clearFiltersBtn) {
            clearFiltersBtn.style.display = isFilterActive ? 'inline-block' : 'none';
        }

        // 4. Subtitle Stats
        if (subtitleEl) {
            if (this.currentView === 'total') {
                subtitleEl.innerText = isFilterActive 
                    ? `Showing ${filtered.length} matching pattern(s) out of ${this.allCards.length} total.`
                    : `You have saved ${this.allCards.length} algorithmic patterns.`;
            } else if (this.currentView === 'due') {
                subtitleEl.innerText = isFilterActive
                    ? `Showing ${filtered.length} matching due pattern(s) out of ${baseCards.length} due today.`
                    : `You have ${baseCards.length} pattern(s) awaiting review.`;
            } else if (this.currentView === 'retention') {
                let totalReps = 0; let totalLapses = 0;
                this.allCards.forEach(c => { totalReps += c.reps || 0; totalLapses += c.lapses || 0; });
                const retentionRate = totalReps > 0 ? Math.round(((totalReps - totalLapses) / totalReps) * 100) : 0;
                subtitleEl.innerText = `Overall Memory Retention: ${retentionRate}% (${totalReps} total reviews, ${totalLapses} forgotten patterns).`;
            } else if (this.currentView === 'history') {
                subtitleEl.innerText = `You reviewed ${filtered.length} unique pattern(s) during this period.`;
            } else if (this.currentView === 'forecast') {
                subtitleEl.innerText = isFilterActive
                    ? `Showing ${filtered.length} matching pattern(s) out of ${baseCards.length} due on this date.`
                    : `${baseCards.length} pattern(s) scheduled for review on this date.`;
            }
        }

        // 5. Render Analytics Panel
        this.renderAnalyticsPanel(this.allCards);

        // 6. Render
        if (!contentEl) return;
        contentEl.innerHTML = '';
        
        if (this.currentView === 'retention' && baseCards.length > 0) {
            const titleHeader = document.createElement('h3');
            titleHeader.textContent = "Most Forgotten Patterns";
            contentEl.appendChild(titleHeader);
        }

        if (filtered.length === 0) {
            contentEl.innerHTML += `<div class="empty-state">No matching patterns found. Try adjusting your filters.</div>`;
            return;
        }

        contentEl.innerHTML += this.generateCardsTable(filtered, isRetention);
        this.bindDeleteButtons();
    }

    /**
     * Builds table rows summarizing problem titles, tags, due statuses, and FSRS metrics.
     * @param {Object[]} cardsArray - List of FSRS cards.
     * @param {boolean} [showLapses=false] - If true, appends columns indicating lapse occurrences.
     * @returns {string} Rendered table markup.
     */
    generateCardsTable(cardsArray, showLapses = false) {
        const now = new Date().getTime();
        let table = `<table><thead><tr>
            <th>Problem Title</th>
            <th>Tags</th>
            <th>Next Due</th>
            <th>Reviews</th>
            <th>Stability</th>
            <th>Difficulty</th>
            ${showLapses ? '<th>Lapses</th>' : ''}
            <th>Actions</th>
        </tr></thead><tbody>`;

        cardsArray.forEach(card => {
            const isPastDue = card.due <= now;
            const statusBadge = isPastDue 
                ? '<span class="badge badge-due">Due Now</span>' 
                : `<span class="badge badge-safe">${new Date(card.due).toLocaleDateString()}</span>`;
                
            const tagsHtml = (card.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
            const reps = card.reps || 0;
            const lapses = card.lapses || 0;
            
            // Format FSRS stats beautifully
            const stabilityFormatted = card.stability > 0 ? `${card.stability.toFixed(1)}d` : 'New';
            const difficultyFormatted = card.difficulty > 0 ? `${card.difficulty.toFixed(1)}/10` : 'N/A';

            table += `<tr>
                <td><a href="${card.problemUrl}" target="_blank">${card.problemTitle}</a></td>
                <td>${tagsHtml}</td>
                <td>${statusBadge}</td>
                <td>${reps}</td>
                <td>${stabilityFormatted}</td>
                <td>${difficultyFormatted}</td>
                ${showLapses ? `<td class="warning">${lapses}</td>` : ''}
                <td>
                    <button class="delete-card-btn" data-id="${card.id}" title="Remove Card from Reviews">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:14px; height:14px; stroke:currentColor;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </td>
            </tr>`;
        });
        
        return table + `</tbody></table>`;
    }

    /**
     * Binds click listener events to table delete buttons to remove cards.
     */
    bindDeleteButtons() {
        document.querySelectorAll('.delete-card-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const cardId = e.currentTarget.getAttribute('data-id');
                if (confirm("Are you sure you want to remove this card from future FSRS reviews? This will delete the repetition history for this pattern.")) {
                    this.allCards = this.allCards.filter(c => c.id !== cardId);
                    chrome.storage.local.set({ fsrsCards: this.allCards }, () => {
                        this.populateTagsFilter();
                        this.filterAndRender();
                    });
                }
            });
        });
    }

    /**
     * Renders statistical cards and distributions of card states.
     * @param {Object[]} cards - Saved cards database array.
     */
    renderAnalyticsPanel(cards) {
        const panel = document.getElementById('analytics-panel');
        if (!panel) return;

        const showCharts = this.chromeSettings && this.chromeSettings.showCharts !== undefined
            ? this.chromeSettings.showCharts
            : true;

        if (this.currentView !== 'total' || cards.length === 0 || !showCharts) {
            panel.style.display = 'none';
            return;
        }

        panel.style.display = 'grid';
        panel.innerHTML = '';

        // Calculate card states
        let newCount = 0;      // reps === 0
        let learningCount = 0; // reps > 0 && stability < 3
        let reviewCount = 0;   // reps > 0 && stability >= 3
        let lapsedCount = 0;   // lapses > 0

        cards.forEach(c => {
            const reps = c.reps || 0;
            const stability = c.stability || 0;
            const lapses = c.lapses || 0;

            if (lapses > 0) lapsedCount++;
            else if (reps === 0) newCount++;
            else if (reps > 0 && stability < 3) learningCount++;
            else if (reps > 0 && stability >= 3) reviewCount++;
        });

        const total = cards.length;
        const newPct = Math.round((newCount / total) * 100) || 0;
        const learningPct = Math.round((learningCount / total) * 100) || 0;
        const reviewPct = Math.round((reviewCount / total) * 100) || 0;
        const lapsedPct = Math.round((lapsedCount / total) * 100) || 0;

        // Calculate top tags
        const tagCounts = {};
        cards.forEach(c => {
            if (c.tags && Array.isArray(c.tags)) {
                c.tags.forEach(t => {
                    tagCounts[t] = (tagCounts[t] || 0) + 1;
                });
            }
        });

        const sortedTags = Object.entries(tagCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4); // top 4 tags

        const maxTagCount = sortedTags.length > 0 ? sortedTags[0][1] : 1;

        // Left Card: Card States Distribution
        const stateCard = document.createElement('div');
        stateCard.className = 'analytics-card';
        stateCard.innerHTML = `
            <h3 class="analytics-card-title">Card States Breakdown</h3>
            <div class="stacked-bar">
                ${newCount > 0 ? `<div class="bar-segment seg-new" style="width: ${newPct}%;" title="New: ${newCount} cards (${newPct}%)"></div>` : ''}
                ${learningCount > 0 ? `<div class="bar-segment seg-learning" style="width: ${learningPct}%;" title="Learning: ${learningCount} cards (${learningPct}%)"></div>` : ''}
                ${reviewCount > 0 ? `<div class="bar-segment seg-review" style="width: ${reviewPct}%;" title="Review: ${reviewCount} cards (${reviewPct}%)"></div>` : ''}
                ${lapsedCount > 0 ? `<div class="bar-segment seg-lapsed" style="width: ${lapsedPct}%;" title="Lapsed: ${lapsedCount} cards (${lapsedPct}%)"></div>` : ''}
            </div>
            <div class="analytics-legend">
                <div class="legend-item"><span class="legend-dot dot-new"></span> New: <strong>${newCount}</strong> <span class="legend-pct">(${newPct}%)</span></div>
                <div class="legend-item"><span class="legend-dot dot-learning"></span> Learning: <strong>${learningCount}</strong> <span class="legend-pct">(${learningPct}%)</span></div>
                <div class="legend-item"><span class="legend-dot dot-review"></span> Review: <strong>${reviewCount}</strong> <span class="legend-pct">(${reviewPct}%)</span></div>
                <div class="legend-item"><span class="legend-dot dot-lapsed"></span> Lapsed: <strong>${lapsedCount}</strong> <span class="legend-pct">(${lapsedPct}%)</span></div>
            </div>
        `;

        // Right Card: Top Tags Breakdown
        const tagsCard = document.createElement('div');
        tagsCard.className = 'analytics-card';
        
        let tagsHtml = '';
        if (sortedTags.length === 0) {
            tagsHtml = '<div class="empty-analytics-msg">No tags added yet.</div>';
        } else {
            tagsHtml = '<div class="tags-bars-container">';
            sortedTags.forEach(([tag, count]) => {
                const pct = Math.round((count / maxTagCount) * 100);
                tagsHtml += `
                    <div class="tag-bar-row">
                        <span class="tag-bar-name" title="${tag}">${tag}</span>
                        <div class="tag-bar-track">
                            <div class="tag-bar-fill" style="width: ${pct}%;"></div>
                        </div>
                        <span class="tag-bar-value">${count}</span>
                    </div>
                `;
            });
            tagsHtml += '</div>';
        }

        tagsCard.innerHTML = `
            <h3 class="analytics-card-title">Top Tag Distribution</h3>
            ${tagsHtml}
        `;

        panel.appendChild(stateCard);
        panel.appendChild(tagsCard);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new FSRSDataDashboard();
    dashboard.init();
});