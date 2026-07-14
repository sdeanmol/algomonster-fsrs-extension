/**
 * @file features/common/data/data.js
 * @description Manages database tables listing saved patterns.
 * Supports keyword search, filter dropdown updates (status, tag, platform, FSRS state),
 * sorting, bulk actions (R2.7), inline card editing (R2.9),
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
        this.selectedPlatform = 'all';
        this.selectedState = 'all';
        this.sortBy = 'due-asc';
        this.chromeSettings = {};

        // R2.7: Bulk selection tracking
        this.selectedCardIds = new Set();
    }

    /**
     * Bootstraps dashboard parameters and sets up storage variables.
     */
    init() {
        const urlParams = new URLSearchParams(window.location.search);
        this.currentView = urlParams.get('view') || 'total';
        this.targetDate = urlParams.get('date');

        // R2.6: Pre-select tag from URL if provided (linked from analytics donut chart)
        const urlTag = urlParams.get('tag');
        if (urlTag) {
            this.selectedTag = urlTag;
        }

        chrome.storage.local.get(['fsrsCards', 'chromeSettings'], (result) => {
            this.allCards = result.fsrsCards || [];
            this.chromeSettings = result.chromeSettings || {};
            
            // Dynamic Filter Populators
            this.populateTagsFilter();
            this.populatePlatformFilter();
            
            // Pre-select tag filter from URL
            if (urlTag) {
                const tagSelect = document.getElementById('tag-select');
                if (tagSelect) tagSelect.value = urlTag;
            }

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

        // R2.6: Platform filter
        const platformSelect = document.getElementById('platform-select');
        if (platformSelect) {
            platformSelect.addEventListener('change', (e) => {
                this.selectedPlatform = e.target.value;
                this.filterAndRender();
            });
        }

        // R2.6: FSRS State filter
        const stateSelect = document.getElementById('state-select');
        if (stateSelect) {
            stateSelect.addEventListener('change', (e) => {
                this.selectedState = e.target.value;
                this.filterAndRender();
            });
        }

        // R2.8: Sort dropdown
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.filterAndRender();
            });
        }

        const clearBtn = document.getElementById('clear-filters-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.searchQuery = '';
                this.selectedTag = 'all';
                this.selectedStatus = 'all';
                this.selectedPlatform = 'all';
                this.selectedState = 'all';
                this.sortBy = 'due-asc';

                if (searchInput) searchInput.value = '';
                if (tagSelect) tagSelect.value = 'all';
                if (statusSelect) statusSelect.value = 'all';
                if (platformSelect) platformSelect.value = 'all';
                if (stateSelect) stateSelect.value = 'all';
                if (sortSelect) sortSelect.value = 'due-asc';

                this.filterAndRender();
            });
        }

        // R2.7: Bulk action buttons
        const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', () => this.bulkDelete());
        }

        const bulkRetagBtn = document.getElementById('bulk-retag-btn');
        if (bulkRetagBtn) {
            bulkRetagBtn.addEventListener('click', () => this.bulkRetag());
        }

        const bulkRescheduleBtn = document.getElementById('bulk-reschedule-btn');
        if (bulkRescheduleBtn) {
            bulkRescheduleBtn.addEventListener('click', () => this.bulkReschedule());
        }

        const bulkDeselectBtn = document.getElementById('bulk-deselect-btn');
        if (bulkDeselectBtn) {
            bulkDeselectBtn.addEventListener('click', () => {
                this.selectedCardIds.clear();
                this.updateBulkActionsBar();
                this.filterAndRender();
            });
        }

        // R2.9: Inline edit modal bindings
        const editCloseBtn = document.getElementById('edit-close-btn');
        const editCancelBtn = document.getElementById('edit-cancel-btn');
        const editSaveBtn = document.getElementById('edit-save-btn');
        const editOverlay = document.getElementById('inline-edit-overlay');

        if (editCloseBtn) editCloseBtn.addEventListener('click', () => this.closeEditModal());
        if (editCancelBtn) editCancelBtn.addEventListener('click', () => this.closeEditModal());
        if (editSaveBtn) editSaveBtn.addEventListener('click', () => this.saveCardEdit());
        if (editOverlay) {
            editOverlay.addEventListener('click', (e) => {
                if (e.target === editOverlay) this.closeEditModal();
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
        [...tagsSet].sort().forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagSelect.appendChild(option);
        });
    }

    /**
     * R2.6: Populates platform filter dropdown by extracting hostnames from card URLs.
     */
    populatePlatformFilter() {
        const platformSelect = document.getElementById('platform-select');
        if (!platformSelect) return;

        platformSelect.innerHTML = '<option value="all">All Platforms</option>';

        const platformNames = {
            'leetcode.com': 'LeetCode',
            'codeforces.com': 'Codeforces',
            'codechef.com': 'CodeChef',
            'atcoder.jp': 'AtCoder',
            'hackerrank.com': 'HackerRank',
            'hackerearth.com': 'HackerEarth',
            'codewars.com': 'Codewars',
            'codingame.com': 'CodinGame',
            'algo.monster': 'AlgoMonster',
            'systemdesignschool.io': 'System Design School'
        };

        const platforms = new Set();
        this.allCards.forEach(card => {
            const platform = this.extractPlatform(card.problemUrl);
            if (platform) platforms.add(platform);
        });

        [...platforms].sort().forEach(platform => {
            const option = document.createElement('option');
            option.value = platform;
            option.textContent = platformNames[platform] || platform;
            platformSelect.appendChild(option);
        });
    }

    /**
     * Extracts platform hostname from a URL.
     * @param {string} url - Card's problem URL.
     * @returns {string|null} Domain hostname or null.
     */
    extractPlatform(url) {
        if (!url || url.startsWith('#')) return null;
        try {
            const hostname = new URL(url).hostname.replace(/^www\./, '');
            // Normalize subdomains
            const parts = hostname.split('.');
            if (parts.length > 2) {
                return parts.slice(-2).join('.');
            }
            return hostname;
        } catch {
            return null;
        }
    }

    /**
     * FSRS state to human label.
     * @param {number} state - FSRS state integer (0-3).
     * @returns {string} Human-readable state label.
     */
    getStateLabel(state) {
        const labels = { 0: 'New', 1: 'Learning', 2: 'Review', 3: 'Relearning' };
        return labels[state] || 'Unknown';
    }

    /**
     * Filters the cards collection by search keywords, active tags, due statuses,
     * platform, FSRS state, sorts them, and calls the rendering templates.
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

            // R2.6: Platform filter
            const cardPlatform = this.extractPlatform(card.problemUrl);
            const matchesPlatform = this.selectedPlatform === 'all' || cardPlatform === this.selectedPlatform;

            // R2.6: FSRS State filter
            const matchesState = this.selectedState === 'all' || String(card.state || 0) === this.selectedState;

            return matchesSearch && matchesTag && matchesStatus && matchesPlatform && matchesState;
        });

        // R2.8: Sort the filtered results
        filtered = this.sortCards(filtered);

        // 3. Toggle reset button
        const isFilterActive = this.searchQuery !== '' || this.selectedTag !== 'all' || this.selectedStatus !== 'all' || this.selectedPlatform !== 'all' || this.selectedState !== 'all' || this.sortBy !== 'due-asc';
        if (clearFiltersBtn) {
            clearFiltersBtn.style.display = isFilterActive ? 'inline-flex' : 'none';
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
        this.bindCheckboxes();
        this.bindEditButtons();
    }

    /**
     * R2.8: Sorts the filtered cards array based on current sort selection.
     * @param {Object[]} cards - Array of FSRS card objects.
     * @returns {Object[]} Sorted array.
     */
    sortCards(cards) {
        const sorted = [...cards];
        switch (this.sortBy) {
            case 'due-asc':
                return sorted.sort((a, b) => (a.due || 0) - (b.due || 0));
            case 'due-desc':
                return sorted.sort((a, b) => (b.due || 0) - (a.due || 0));
            case 'difficulty-desc':
                return sorted.sort((a, b) => (b.difficulty || 0) - (a.difficulty || 0));
            case 'stability-desc':
                return sorted.sort((a, b) => (b.stability || 0) - (a.stability || 0));
            case 'stability-asc':
                return sorted.sort((a, b) => (a.stability || 0) - (b.stability || 0));
            case 'lapses-desc':
                return sorted.sort((a, b) => (b.lapses || 0) - (a.lapses || 0));
            case 'created-desc':
                return sorted.sort((a, b) => {
                    const aCreated = a.historyLog && a.historyLog.length > 0 ? a.historyLog[0] : 0;
                    const bCreated = b.historyLog && b.historyLog.length > 0 ? b.historyLog[0] : 0;
                    return bCreated - aCreated;
                });
            case 'created-asc':
                return sorted.sort((a, b) => {
                    const aCreated = a.historyLog && a.historyLog.length > 0 ? a.historyLog[0] : 0;
                    const bCreated = b.historyLog && b.historyLog.length > 0 ? b.historyLog[0] : 0;
                    return aCreated - bCreated;
                });
            default:
                return sorted;
        }
    }

    /**
     * Builds table rows summarizing problem titles, tags, due statuses, and FSRS metrics.
     * Enhanced with R2.7 checkboxes, R2.6 state badges, and R2.9 edit buttons.
     * @param {Object[]} cardsArray - List of FSRS cards.
     * @param {boolean} [showLapses=false] - If true, appends columns indicating lapse occurrences.
     * @returns {string} Rendered table markup.
     */
    generateCardsTable(cardsArray, showLapses = false) {
        const now = new Date().getTime();
        const allChecked = cardsArray.length > 0 && cardsArray.every(c => this.selectedCardIds.has(c.id));

        let table = `<table><thead><tr>
            <th class="th-checkbox"><input type="checkbox" id="select-all-checkbox" class="card-checkbox" ${allChecked ? 'checked' : ''}></th>
            <th>Problem Title</th>
            <th>Tags</th>
            <th>Next Due</th>
            <th>State</th>
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
            const state = card.state || 0;
            
            // Format FSRS stats
            const stabilityFormatted = card.stability > 0 ? `${card.stability.toFixed(1)}d` : 'New';
            const difficultyFormatted = card.difficulty > 0 ? `${card.difficulty.toFixed(1)}/10` : 'N/A';

            // State badge with color coding
            const stateLabel = this.getStateLabel(state);
            const stateClass = `state-${state}`;

            const isChecked = this.selectedCardIds.has(card.id);

            table += `<tr class="${isChecked ? 'row-selected' : ''}">
                <td class="td-checkbox"><input type="checkbox" class="card-checkbox row-checkbox" data-id="${card.id}" ${isChecked ? 'checked' : ''}></td>
                <td><a href="${card.problemUrl}" target="_blank">${card.problemTitle || 'Untitled'}</a></td>
                <td>${tagsHtml}</td>
                <td>${statusBadge}</td>
                <td><span class="badge badge-state ${stateClass}">${stateLabel}</span></td>
                <td>${reps}</td>
                <td>${stabilityFormatted}</td>
                <td>${difficultyFormatted}</td>
                ${showLapses ? `<td class="warning">${lapses}</td>` : ''}
                <td class="td-actions">
                    <button class="edit-card-btn" data-id="${card.id}" title="Edit Card">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:14px; height:14px; stroke:currentColor;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                    </button>
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
                e.stopPropagation();
                const cardId = e.currentTarget.getAttribute('data-id');
                if (confirm("Are you sure you want to remove this card from future FSRS reviews? This will delete the repetition history for this pattern.")) {
                    this.allCards = this.allCards.filter(c => c.id !== cardId);
                    this.selectedCardIds.delete(cardId);
                    chrome.storage.local.set({ fsrsCards: this.allCards }, () => {
                        this.populateTagsFilter();
                        this.populatePlatformFilter();
                        this.updateBulkActionsBar();
                        this.filterAndRender();
                    });
                }
            });
        });
    }

    // ========================================================================
    // R2.7: Bulk Actions
    // ========================================================================

    /**
     * Binds checkbox change events for bulk selection.
     */
    bindCheckboxes() {
        // Select-all checkbox
        const selectAll = document.getElementById('select-all-checkbox');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                const allCheckboxes = document.querySelectorAll('.row-checkbox');
                allCheckboxes.forEach(cb => {
                    cb.checked = e.target.checked;
                    const cardId = cb.dataset.id;
                    if (e.target.checked) {
                        this.selectedCardIds.add(cardId);
                    } else {
                        this.selectedCardIds.delete(cardId);
                    }
                    cb.closest('tr').classList.toggle('row-selected', e.target.checked);
                });
                this.updateBulkActionsBar();
            });
        }

        // Individual row checkboxes
        document.querySelectorAll('.row-checkbox').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const cardId = e.target.dataset.id;
                if (e.target.checked) {
                    this.selectedCardIds.add(cardId);
                } else {
                    this.selectedCardIds.delete(cardId);
                }
                e.target.closest('tr').classList.toggle('row-selected', e.target.checked);
                this.updateBulkActionsBar();

                // Update select-all checkbox state
                const allCheckboxes = document.querySelectorAll('.row-checkbox');
                const allChecked = [...allCheckboxes].every(c => c.checked);
                if (selectAll) selectAll.checked = allChecked;
            });
        });
    }

    /**
     * Updates the bulk actions bar visibility and selected count display.
     */
    updateBulkActionsBar() {
        const bar = document.getElementById('bulk-actions-bar');
        const countEl = document.getElementById('bulk-count');
        if (!bar) return;

        const count = this.selectedCardIds.size;
        if (count > 0) {
            bar.style.display = 'flex';
            if (countEl) countEl.textContent = count;
        } else {
            bar.style.display = 'none';
        }
    }

    /**
     * R2.7: Bulk delete selected cards.
     */
    bulkDelete() {
        const count = this.selectedCardIds.size;
        if (count === 0) return;

        if (confirm(`Are you sure you want to delete ${count} selected card(s)? This cannot be undone.`)) {
            this.allCards = this.allCards.filter(c => !this.selectedCardIds.has(c.id));
            this.selectedCardIds.clear();
            chrome.storage.local.set({ fsrsCards: this.allCards }, () => {
                this.populateTagsFilter();
                this.populatePlatformFilter();
                this.updateBulkActionsBar();
                this.filterAndRender();
            });
        }
    }

    /**
     * R2.7: Bulk re-tag selected cards.
     */
    bulkRetag() {
        const count = this.selectedCardIds.size;
        if (count === 0) return;

        const newTagsStr = prompt(`Enter new tags for ${count} selected card(s) (comma-separated).\nThis will REPLACE existing tags:`, '');
        if (newTagsStr === null) return; // Cancelled

        const newTags = newTagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);

        this.allCards.forEach(card => {
            if (this.selectedCardIds.has(card.id)) {
                card.tags = newTags;
            }
        });

        this.selectedCardIds.clear();
        chrome.storage.local.set({ fsrsCards: this.allCards }, () => {
            this.populateTagsFilter();
            this.updateBulkActionsBar();
            this.filterAndRender();
        });
    }

    /**
     * R2.7: Bulk reschedule selected cards (reset due date to now).
     */
    bulkReschedule() {
        const count = this.selectedCardIds.size;
        if (count === 0) return;

        if (confirm(`Reschedule ${count} selected card(s) to be due now? This resets their due date to today.`)) {
            const now = Date.now();
            this.allCards.forEach(card => {
                if (this.selectedCardIds.has(card.id)) {
                    card.due = now;
                }
            });

            this.selectedCardIds.clear();
            chrome.storage.local.set({ fsrsCards: this.allCards }, () => {
                this.updateBulkActionsBar();
                this.filterAndRender();
            });
        }
    }

    // ========================================================================
    // R2.9: Inline Card Editing
    // ========================================================================

    /**
     * Binds click events for edit buttons on each card row.
     */
    bindEditButtons() {
        document.querySelectorAll('.edit-card-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cardId = e.currentTarget.getAttribute('data-id');
                this.openEditModal(cardId);
            });
        });
    }

    /**
     * Opens the inline edit modal for a specific card.
     * @param {string} cardId - ID of the card to edit.
     */
    openEditModal(cardId) {
        const card = this.allCards.find(c => c.id === cardId);
        if (!card) return;

        document.getElementById('edit-card-id').value = cardId;
        document.getElementById('edit-title').value = card.problemTitle || '';
        document.getElementById('edit-tags').value = (card.tags || []).join(', ');
        document.getElementById('edit-approach').value = card.approach || '';
        document.getElementById('edit-time-complexity').value = card.timeComplexity || '';
        document.getElementById('edit-space-complexity').value = card.spaceComplexity || '';

        const overlay = document.getElementById('inline-edit-overlay');
        if (overlay) overlay.style.display = 'flex';
    }

    /**
     * Closes the inline edit modal.
     */
    closeEditModal() {
        const overlay = document.getElementById('inline-edit-overlay');
        if (overlay) overlay.style.display = 'none';
    }

    /**
     * Saves edits from the inline edit modal to storage.
     */
    saveCardEdit() {
        const cardId = document.getElementById('edit-card-id').value;
        const card = this.allCards.find(c => c.id === cardId);
        if (!card) return;

        card.problemTitle = document.getElementById('edit-title').value.trim() || card.problemTitle;
        card.tags = document.getElementById('edit-tags').value.split(',').map(t => t.trim()).filter(t => t.length > 0);
        card.approach = document.getElementById('edit-approach').value;
        card.timeComplexity = document.getElementById('edit-time-complexity').value.trim();
        card.spaceComplexity = document.getElementById('edit-space-complexity').value.trim();

        chrome.storage.local.set({ fsrsCards: this.allCards }, () => {
            this.closeEditModal();
            this.populateTagsFilter();
            this.filterAndRender();
        });
    }

    // ========================================================================
    // Analytics Panel (unchanged from original)
    // ========================================================================

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