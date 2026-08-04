import { Logger } from '@common/logger';
import { ensureCardIds } from '../utils/cardUtils';
import { TagInputControl } from '../utils/tagInput';
import { Card, StorageData, UserSettings } from '../../../types/domain';

/**
 * @file features/common/data/data.ts
 * @description Manages database tables listing saved patterns.
 * Supports keyword search, filter dropdown updates (status, tag, platform, FSRS state),
 * sorting, bulk actions (R2.7), inline card editing (R2.9),
 * overall memory retention rates calculations, stacked distribution bars, and card deletion events.
 */
export class FSRSDataDashboard {
    allCards: Card[];
    currentView: string;
    targetDate: string | null;

    searchQuery: string;
    selectedTag: string;
    selectedStatus: string;
    selectedPlatform: string;
    selectedState: string;
    sortBy: string;
    chromeSettings: UserSettings & { showCharts?: boolean };

    selectedCardIds: Set<string>;

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

        // Bulk selection tracking
        this.selectedCardIds = new Set();
    }

    /**
     * Bootstraps dashboard parameters and sets up storage variables.
     */
    init(): void {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            this.currentView = urlParams.get('view') || 'total';
            this.targetDate = urlParams.get('date');

            const urlSearch = urlParams.get('search') || urlParams.get('q') || urlParams.get('query');
            if (urlSearch) {
                this.searchQuery = urlSearch;
            }

            const urlTag = urlParams.get('tag');
            if (urlTag) {
                this.selectedTag = urlTag;
            }

            chrome.storage.local.get(['fsrsCards', 'chromeSettings'], (result: StorageData) => {
                try {
                    if (chrome.runtime?.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('DataDashboard', `Storage error in init: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    this.allCards = ensureCardIds(result.fsrsCards || []);
                    this.chromeSettings = (result.chromeSettings || {}) as UserSettings & { showCharts?: boolean };

                    // Dynamic Filter Populators
                    this.populateTagsFilter();
                    this.populatePlatformFilter();

                    // Pre-select search input & tag filter from URL
                    if (urlSearch) {
                        const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
                        if (searchInput) searchInput.value = urlSearch;
                    }
                    if (urlTag) {
                        const tagSelect = document.getElementById('tag-select') as HTMLSelectElement | null;
                        if (tagSelect) tagSelect.value = urlTag;
                    }

                    // Register Listeners
                    this.bindEvents();

                    // Run initial render
                    this.filterAndRender();
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('DataDashboard', `Error rendering data dashboard: ${errorMessage}`, { innerErr });
                    // Comment: Non-fatal dashboard render catch
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Failed storage get in DataDashboard init: ${errorMessage}`, { err });
            // Comment: Catch storage retrieval failure gracefully
        }
    }

    /**
     * Registers control elements click and input listener bindings.
     */
    bindEvents(): void {
        try {
            const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
            if (searchInput) {
                searchInput.addEventListener('input', (e: Event) => {
                    try {
                        this.searchQuery = (e.target as HTMLInputElement).value.trim();
                        this.filterAndRender();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error in search input handler: ${errorMessage}`, { err });
                    }
                });
            }

            const tagSelect = document.getElementById('tag-select') as HTMLSelectElement | null;
            if (tagSelect) {
                tagSelect.addEventListener('change', (e: Event) => {
                    try {
                        this.selectedTag = (e.target as HTMLSelectElement).value;
                        this.filterAndRender();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error in tag select handler: ${errorMessage}`, { err });
                    }
                });
            }

            const statusSelect = document.getElementById('status-select') as HTMLSelectElement | null;
            if (statusSelect) {
                statusSelect.addEventListener('change', (e: Event) => {
                    try {
                        this.selectedStatus = (e.target as HTMLSelectElement).value;
                        this.filterAndRender();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error in status select handler: ${errorMessage}`, { err });
                    }
                });
            }

            const platformSelect = document.getElementById('platform-select') as HTMLSelectElement | null;
            if (platformSelect) {
                platformSelect.addEventListener('change', (e: Event) => {
                    try {
                        this.selectedPlatform = (e.target as HTMLSelectElement).value;
                        this.filterAndRender();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error in platform select handler: ${errorMessage}`, { err });
                    }
                });
            }

            const stateSelect = document.getElementById('state-select') as HTMLSelectElement | null;
            if (stateSelect) {
                stateSelect.addEventListener('change', (e: Event) => {
                    try {
                        this.selectedState = (e.target as HTMLSelectElement).value;
                        this.filterAndRender();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error in state select handler: ${errorMessage}`, { err });
                    }
                });
            }

            const sortSelect = document.getElementById('sort-select') as HTMLSelectElement | null;
            if (sortSelect) {
                sortSelect.addEventListener('change', (e: Event) => {
                    try {
                        this.sortBy = (e.target as HTMLSelectElement).value;
                        this.filterAndRender();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error in sort select handler: ${errorMessage}`, { err });
                    }
                });
            }

            const clearBtn = document.getElementById('clear-filters-btn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    try {
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
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error clearing filters: ${errorMessage}`, { err });
                    }
                });
            }

            const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
            if (bulkDeleteBtn) {
                bulkDeleteBtn.addEventListener('click', () => {
                    try {
                        this.bulkDelete();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error in bulk delete click handler: ${errorMessage}`, { err });
                    }
                });
            }

            const bulkRetagBtn = document.getElementById('bulk-retag-btn');
            if (bulkRetagBtn) {
                bulkRetagBtn.addEventListener('click', () => {
                    try {
                        this.bulkRetag();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error in bulk retag click handler: ${errorMessage}`, { err });
                    }
                });
            }

            const bulkRescheduleBtn = document.getElementById('bulk-reschedule-btn');
            if (bulkRescheduleBtn) {
                bulkRescheduleBtn.addEventListener('click', () => {
                    try {
                        this.bulkReschedule();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error in bulk reschedule click handler: ${errorMessage}`, { err });
                    }
                });
            }

            const bulkDeselectBtn = document.getElementById('bulk-deselect-btn');
            if (bulkDeselectBtn) {
                bulkDeselectBtn.addEventListener('click', () => {
                    try {
                        this.selectedCardIds.clear();
                        this.updateBulkActionsBar();
                        this.filterAndRender();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error deselecting bulk cards: ${errorMessage}`, { err });
                    }
                });
            }

            const editCloseBtn = document.getElementById('edit-close-btn');
            const editCancelBtn = document.getElementById('edit-cancel-btn');
            const editSaveBtn = document.getElementById('edit-save-btn');
            const editOverlay = document.getElementById('inline-edit-overlay');

            if (editCloseBtn) editCloseBtn.addEventListener('click', () => this.closeEditModal());
            if (editCancelBtn) editCancelBtn.addEventListener('click', () => this.closeEditModal());
            if (editSaveBtn) editSaveBtn.addEventListener('click', () => this.saveCardEdit());
            if (editOverlay) {
                editOverlay.addEventListener('click', (e: Event) => {
                    if (e.target === editOverlay) this.closeEditModal();
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error binding dashboard events: ${errorMessage}`, { err });
            // Comment: Non-fatal event binding error
        }
    }

    /**
     * Searches the collection of card objects and populates tag select options dynamically.
     */
    populateTagsFilter(): void {
        try {
            const tagSelect = document.getElementById('tag-select');
            if (!tagSelect) return;

            tagSelect.innerHTML = '<option value="all">All Tags</option>';

            const tagsSet = new Set<string>();
            this.allCards.forEach((card: Card) => {
                if (card.tags && Array.isArray(card.tags)) {
                    card.tags.forEach((t: string) => tagsSet.add(t));
                }
            });

            [...tagsSet].sort().forEach(tag => {
                const option = document.createElement('option');
                option.value = tag;
                option.textContent = tag;
                tagSelect.appendChild(option);
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error populating tags filter: ${errorMessage}`, { err });
            // Comment: Non-fatal tag filter population error
        }
    }

    /**
     * Populates platform filter dropdown by extracting hostnames from card URLs.
     */
    populatePlatformFilter(): void {
        try {
            const platformSelect = document.getElementById('platform-select');
            if (!platformSelect) return;

            platformSelect.innerHTML = '<option value="all">All Platforms</option>';

            const platformNames: Record<string, string> = {
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

            const platforms = new Set<string>();
            this.allCards.forEach((card: Card) => {
                const platform = this.extractPlatform(card.problemUrl);
                if (platform) platforms.add(platform);
            });

            [...platforms].sort().forEach(platform => {
                const option = document.createElement('option');
                option.value = platform;
                option.textContent = platformNames[platform] || platform;
                platformSelect.appendChild(option);
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error populating platform filter: ${errorMessage}`, { err });
            // Comment: Non-fatal platform filter population error
        }
    }

    /**
     * Extracts platform hostname from a URL.
     */
    extractPlatform(url?: string): string | null {
        if (!url || url.startsWith('#')) return null;
        try {
            const hostname = new URL(url).hostname.replace(/^www\./, '');
            const parts = hostname.split('.');
            if (parts.length > 2) {
                return parts.slice(-2).join('.');
            }
            return hostname;
        } catch {
            // Comment: Return null on invalid URL parsing
            return null;
        }
    }

    /**
     * FSRS state to human label.
     */
    getStateLabel(state: number): string {
        try {
            const labels: Record<number, string> = { 0: 'New', 1: 'Learning', 2: 'Review', 3: 'Relearning' };
            return labels[state] || 'Unknown';
        } catch {
            return 'Unknown';
        }
    }

    /**
     * Filters the cards collection by search keywords, active tags, due statuses,
     * platform, FSRS state, sorts them, and calls the rendering templates.
     */
    filterAndRender(): void {
        try {
            const titleEl = document.getElementById('page-title');
            const subtitleEl = document.getElementById('page-subtitle');
            const contentEl = document.getElementById('data-content');
            const clearFiltersBtn = document.getElementById('clear-filters-btn');
            const now = new Date().getTime();

            let baseCards: Card[] = [];

            if (this.currentView === 'total') {
                if (titleEl) titleEl.innerText = 'Total Saved Patterns';
                baseCards = [...this.allCards];
            }
            else if (this.currentView === 'due') {
                baseCards = this.allCards.filter((c: Card) => c.due <= now).sort((a: Card, b: Card) => a.due - b.due);
                if (titleEl) titleEl.innerText = 'Patterns Due Today';
            }
            else if (this.currentView === 'retention') {
                baseCards = this.allCards.filter((c: Card) => (c.lapses || 0) > 0).sort((a: Card, b: Card) => (b.lapses || 0) - (a.lapses || 0));
                if (titleEl) titleEl.innerText = 'Retention';
            }
            else if (this.currentView === 'history' && this.targetDate) {
                const filteredCards = this.allCards.filter((c: Card & { historyLog?: (number | { date: number })[] }) => {
                    if (!c.historyLog) return false;
                    return c.historyLog.some((logEntry) => {
                        const timestamp = (typeof logEntry === 'object' && logEntry !== null) ? logEntry.date : logEntry;
                        const dateObj = new Date(timestamp);
                        const localDateStr = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                        return localDateStr.startsWith(this.targetDate!);
                    });
                });
                baseCards = [...new Set(filteredCards)];
                let dateDisplay = this.targetDate;
                if (this.targetDate.length === 7) {
                    const [y, m] = this.targetDate.split('-');
                    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
                    dateDisplay = `${monthNames[parseInt(m, 10) - 1]} ${y}`;
                } else if (this.targetDate.length === 10) {
                    const [y, m, d] = this.targetDate.split('-');
                    const localDate = new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
                    dateDisplay = localDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                }
                if (titleEl) titleEl.innerText = `Activity for ${dateDisplay}`;
            }
            else if (this.currentView === 'forecast' && this.targetDate) {
                const urlParams = new URLSearchParams(window.location.search);
                const dayOffset = parseInt(urlParams.get('offset') || '0', 10);

                const targetParts = this.targetDate.split('-');
                const targetDayStart = new Date(parseInt(targetParts[0], 10), parseInt(targetParts[1], 10) - 1, parseInt(targetParts[2], 10));
                const targetDayEnd = new Date(targetDayStart);
                targetDayEnd.setDate(targetDayEnd.getDate() + 1);

                const targetStartTime = targetDayStart.getTime();
                const targetEndTime = targetDayEnd.getTime();

                if (dayOffset === 0) {
                    baseCards = this.allCards.filter((c: Card) => c.due < targetEndTime);
                } else {
                    baseCards = this.allCards.filter((c: Card) => c.due >= targetStartTime && c.due < targetEndTime);
                }

                baseCards.sort((a: Card, b: Card) => a.due - b.due);

                const dateDisplay = new Date(this.targetDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                if (titleEl) titleEl.innerText = `Cards Due — ${dateDisplay}`;
            }

            let filtered = baseCards.filter((card: Card) => {
                const titleMatch = card.problemTitle && card.problemTitle.toLowerCase().includes(this.searchQuery.toLowerCase());
                const urlMatch = card.problemUrl && card.problemUrl.toLowerCase().includes(this.searchQuery.toLowerCase());
                const tagMatch = card.tags && card.tags.some((t: string) => t.toLowerCase().includes(this.searchQuery.toLowerCase()));
                const approachMatch = card.approach && card.approach.toLowerCase().includes(this.searchQuery.toLowerCase());

                const matchesSearch = !this.searchQuery || titleMatch || urlMatch || tagMatch || approachMatch;
                const matchesTag = this.selectedTag === 'all' || (card.tags && card.tags.includes(this.selectedTag));
                const isCardDue = card.due <= now;
                const matchesStatus = this.selectedStatus === 'all' ||
                    (this.selectedStatus === 'due' && isCardDue) ||
                    (this.selectedStatus === 'safe' && !isCardDue);

                const cardPlatform = this.extractPlatform(card.problemUrl);
                const matchesPlatform = this.selectedPlatform === 'all' || cardPlatform === this.selectedPlatform;

                let matchesState = true;
                if (this.selectedState === 'leech') {
                    matchesState = (card.lapses || 0) >= 3;
                } else if (this.selectedState !== 'all') {
                    matchesState = String(card.state || 0) === this.selectedState;
                }

                return matchesSearch && matchesTag && matchesStatus && matchesPlatform && matchesState;
            });

            filtered = this.sortCards(filtered);

            const isFilterActive = this.searchQuery !== '' || this.selectedTag !== 'all' || this.selectedStatus !== 'all' || this.selectedPlatform !== 'all' || this.selectedState !== 'all' || this.sortBy !== 'due-asc';
            if (clearFiltersBtn) {
                clearFiltersBtn.style.display = isFilterActive ? 'inline-flex' : 'none';
            }

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
                    subtitleEl.innerText = isFilterActive
                        ? `Showing ${filtered.length} matching pattern(s).`
                        : `Showing all patterns with at least 1 lapse.`;
                } else if (this.currentView === 'history') {
                    subtitleEl.innerText = `Showing ${filtered.length} unique pattern(s) reviewed on this date. (Note: The dashboard activity count includes multiple reviews per pattern).`;
                } else if (this.currentView === 'forecast') {
                    subtitleEl.innerText = isFilterActive
                        ? `Showing ${filtered.length} matching pattern(s) out of ${baseCards.length} due on this date.`
                        : `${baseCards.length} pattern(s) scheduled for review on this date.`;
                }
            }

            this.renderAnalyticsPanel(this.allCards);

            if (contentEl) {
                contentEl.innerHTML = this.generateCardsTable(filtered, true);
            }

            this.bindCheckboxes();
            this.bindDeleteButtons();
            this.bindEditButtons();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error in filterAndRender: ${errorMessage}`, { err });
            // Comment: Catch filtering or rendering error to prevent breaking page
        }
    }

    /**
     * Renders a table of FSRS card items.
     */
    generateCardsTable(cardsArray: Card[], showLapses: boolean = true): string {
        try {
            const now = new Date().getTime();
            const allChecked = cardsArray.length > 0 && cardsArray.every((c: Card) => Boolean(c.id && this.selectedCardIds.has(c.id)));

            let table = `<div class="table-responsive"><table><thead><tr>
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

            cardsArray.forEach((card: Card) => {
                const isPastDue = card.due <= now;
                const statusBadge = isPastDue
                    ? '<span class="badge badge-due">Due Now</span>'
                    : `<span class="badge badge-safe">${new Date(card.due).toLocaleDateString()}</span>`;

                const tagsHtml = (card.tags || []).map((t: string) => `<span class="tag">${t}</span>`).join('');
                const reps = card.reps || 0;
                const lapses = card.lapses || 0;
                const state = card.state || 0;

                const stabilityFormatted = card.stability > 0 ? `${card.stability.toFixed(1)}d` : 'New';
                const difficultyFormatted = card.difficulty > 0 ? `${card.difficulty.toFixed(1)}/10` : 'N/A';

                const stateLabel = this.getStateLabel(state);
                const stateClass = `state-${state}`;

                let lapsesBadge = `<span class="text-subtle">&mdash;</span>`;
                if (lapses >= 3) {
                    lapsesBadge = `<span class="badge badge-leech" title="Leech Card: Forgotten 3+ times. Consider rewriting your solution approach note!">⚡ ${lapses} (Leech)</span>`;
                } else if (lapses > 0) {
                    lapsesBadge = `<span class="badge badge-lapsed" title="${lapses} lapse(s) recorded">⚠️ ${lapses}</span>`;
                }

                const isChecked = Boolean(card.id && this.selectedCardIds.has(card.id));
                const isLeech = lapses >= 3;

                table += `<tr class="${isChecked ? 'row-selected' : ''} ${isLeech ? 'row-leech' : ''}">
                    <td class="td-checkbox"><input type="checkbox" class="card-checkbox row-checkbox" data-id="${card.id || ''}" ${isChecked ? 'checked' : ''}></td>
                    <td style="white-space: normal; word-wrap: break-word; max-width: 250px;"><a href="${card.problemUrl || '#'}" target="_blank">${card.problemTitle || 'Untitled'}</a></td>
                    <td style="white-space: normal; word-wrap: break-word; max-width: 200px;">${tagsHtml}</td>
                    <td>${statusBadge}</td>
                    <td><span class="badge badge-state ${stateClass}">${stateLabel}${isLeech ? ' (Leech)' : ''}</span></td>
                    <td>${reps}</td>
                    <td>${stabilityFormatted}</td>
                    <td>${difficultyFormatted}</td>
                    ${showLapses ? `<td>${lapsesBadge}</td>` : ''}
                    <td class="td-actions">
                        <div class="actions-wrapper">
                            <button class="edit-card-btn" data-id="${card.id || ''}" title="Edit Card" aria-label="Edit Card">
                                <svg class="svg-icon" viewBox="0 0 24 24" style="width:14px; height:14px; stroke:currentColor;"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                            </button>
                            <button class="delete-card-btn" data-id="${card.id || ''}" title="Remove Card from Reviews" aria-label="Remove Card from Reviews">
                                <svg class="svg-icon" viewBox="0 0 24 24" style="width:14px; height:14px; stroke:currentColor;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                            </button>
                        </div>
                    </td>
                </tr>`;
            });

            return table + `</tbody></table></div>`;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error generating cards table: ${errorMessage}`, { err });
            // Comment: Return empty table on rendering failure
            return '<div class="empty-state">Error loading table</div>';
        }
    }

    /**
     * Sorts the filtered cards array based on current sort selection.
     */
    sortCards(cards: Card[]): Card[] {
        try {
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
                        const aLog = (a as Card & { historyLog?: (number | { date: number })[] }).historyLog;
                        const bLog = (b as Card & { historyLog?: (number | { date: number })[] }).historyLog;
                        const aCreated = aLog && aLog.length > 0 ? (typeof aLog[0] === 'number' ? aLog[0] : aLog[0].date) : 0;
                        const bCreated = bLog && bLog.length > 0 ? (typeof bLog[0] === 'number' ? bLog[0] : bLog[0].date) : 0;
                        return bCreated - aCreated;
                    });
                case 'created-asc':
                    return sorted.sort((a, b) => {
                        const aLog = (a as Card & { historyLog?: (number | { date: number })[] }).historyLog;
                        const bLog = (b as Card & { historyLog?: (number | { date: number })[] }).historyLog;
                        const aCreated = aLog && aLog.length > 0 ? (typeof aLog[0] === 'number' ? aLog[0] : aLog[0].date) : 0;
                        const bCreated = bLog && bLog.length > 0 ? (typeof bLog[0] === 'number' ? bLog[0] : bLog[0].date) : 0;
                        return aCreated - bCreated;
                    });
                default:
                    return sorted;
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error sorting cards: ${errorMessage}`, { sortBy: this.sortBy, err });
            // Comment: Return original array on sort exception
            return cards;
        }
    }

    /**
     * Binds click listener events to table delete buttons to remove cards.
     */
    bindDeleteButtons(): void {
        try {
            document.querySelectorAll('.delete-card-btn').forEach(btn => {
                btn.addEventListener('click', (e: Event) => {
                    try {
                        e.stopPropagation();
                        const cardId = (e.currentTarget as HTMLElement).getAttribute('data-id');
                        if (cardId && confirm("Are you sure you want to remove this card from future FSRS reviews? This will delete the repetition history for this pattern.")) {
                            this.allCards = this.allCards.filter(c => c.id !== cardId);
                            this.selectedCardIds.delete(cardId);
                            chrome.storage.local.set({ fsrsCards: this.allCards }, () => {
                                try {
                                    if (chrome.runtime?.lastError) {
                                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                        Logger.error('DataDashboard', `Error deleting card from storage: ${errorMessage}`, { cardId, error: chrome.runtime.lastError });
                                        return;
                                    }
                                    this.populateTagsFilter();
                                    this.populatePlatformFilter();
                                    this.updateBulkActionsBar();
                                    this.filterAndRender();
                                } catch (callbackErr) {
                                    const errorMessage = callbackErr instanceof Error ? callbackErr.message : String(callbackErr);
                                    Logger.error('DataDashboard', `Error in delete card callback: ${errorMessage}`, { cardId, callbackErr });
                                }
                            });
                        }
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error in delete button click listener: ${errorMessage}`, { err });
                    }
                });
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error binding delete buttons: ${errorMessage}`, { err });
        }
    }

    /**
     * Binds checkbox change events for bulk selection.
     */
    bindCheckboxes(): void {
        try {
            const selectAll = document.getElementById('select-all-checkbox') as HTMLInputElement | null;
            if (selectAll) {
                selectAll.addEventListener('change', (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const allCheckboxes = document.querySelectorAll('.row-checkbox');
                        allCheckboxes.forEach((cb: Element) => {
                            const checkbox = cb as HTMLInputElement;
                            checkbox.checked = target.checked;
                            const cardId = checkbox.dataset.id;
                            if (cardId) {
                                if (target.checked) {
                                    this.selectedCardIds.add(cardId);
                                } else {
                                    this.selectedCardIds.delete(cardId);
                                }
                            }
                            checkbox.closest('tr')?.classList.toggle('row-selected', target.checked);
                        });
                        this.updateBulkActionsBar();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error in select all checkbox handler: ${errorMessage}`, { err });
                    }
                });
            }

            document.querySelectorAll('.row-checkbox').forEach((cb: Element) => {
                cb.addEventListener('change', (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const cardId = target.dataset.id;
                        if (cardId) {
                            if (target.checked) {
                                this.selectedCardIds.add(cardId);
                            } else {
                                this.selectedCardIds.delete(cardId);
                            }
                        }
                        target.closest('tr')?.classList.toggle('row-selected', target.checked);
                        this.updateBulkActionsBar();

                        const allCheckboxes = document.querySelectorAll('.row-checkbox');
                        const allChecked = [...allCheckboxes].every((c: Element) => (c as HTMLInputElement).checked);
                        if (selectAll) selectAll.checked = allChecked;
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error in row checkbox handler: ${errorMessage}`, { err });
                    }
                });
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error binding checkboxes: ${errorMessage}`, { err });
        }
    }

    /**
     * Updates the bulk actions bar visibility and selected count display.
     */
    updateBulkActionsBar(): void {
        try {
            const bar = document.getElementById('bulk-actions-bar');
            const countEl = document.getElementById('bulk-count');
            if (!bar) return;

            const count = this.selectedCardIds.size;
            if (count > 0) {
                bar.style.display = 'flex';
                if (countEl) countEl.textContent = String(count);
            } else {
                bar.style.display = 'none';
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error updating bulk actions bar: ${errorMessage}`, { err });
        }
    }

    /**
     * Bulk delete selected cards.
     */
    bulkDelete(): void {
        try {
            const count = this.selectedCardIds.size;
            if (count === 0) return;

            if (confirm(`Are you sure you want to delete ${count} selected card(s)? This cannot be undone.`)) {
                this.allCards = this.allCards.filter(c => Boolean(c.id && !this.selectedCardIds.has(c.id)));
                this.selectedCardIds.clear();
                chrome.storage.local.set({ fsrsCards: this.allCards }, () => {
                    try {
                        if (chrome.runtime?.lastError) {
                            const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                            Logger.error('DataDashboard', `Error in bulk delete storage set: ${errorMessage}`, { error: chrome.runtime.lastError });
                            return;
                        }
                        this.populateTagsFilter();
                        this.populatePlatformFilter();
                        this.updateBulkActionsBar();
                        this.filterAndRender();
                    } catch (callbackErr) {
                        const errorMessage = callbackErr instanceof Error ? callbackErr.message : String(callbackErr);
                        Logger.error('DataDashboard', `Error in bulk delete callback: ${errorMessage}`, { callbackErr });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error in bulkDelete: ${errorMessage}`, { err });
        }
    }

    /**
     * Bulk re-tag selected cards.
     */
    bulkRetag(): void {
        try {
            const count = this.selectedCardIds.size;
            if (count === 0) return;

            const newTagsStr = prompt(`Enter new tags for ${count} selected card(s) (comma-separated).\nThis will REPLACE existing tags:`, '');
            if (newTagsStr === null) return;

            const newTags = newTagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);

            this.allCards.forEach(card => {
                if (card.id && this.selectedCardIds.has(card.id)) {
                    card.tags = newTags;
                }
            });

            this.selectedCardIds.clear();
            chrome.storage.local.set({ fsrsCards: this.allCards }, () => {
                try {
                    if (chrome.runtime?.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('DataDashboard', `Error in bulk retag storage set: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    this.populateTagsFilter();
                    this.updateBulkActionsBar();
                    this.filterAndRender();
                } catch (callbackErr) {
                    const errorMessage = callbackErr instanceof Error ? callbackErr.message : String(callbackErr);
                    Logger.error('DataDashboard', `Error in bulk retag callback: ${errorMessage}`, { callbackErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error in bulkRetag: ${errorMessage}`, { err });
        }
    }

    /**
     * Bulk reschedule selected cards (reset due date to now).
     */
    bulkReschedule(): void {
        try {
            const count = this.selectedCardIds.size;
            if (count === 0) return;

            if (confirm(`Reschedule ${count} selected card(s) to be due now? This resets their due date to today.`)) {
                const now = Date.now();
                this.allCards.forEach(card => {
                    if (card.id && this.selectedCardIds.has(card.id)) {
                        card.due = now;
                    }
                });

                this.selectedCardIds.clear();
                chrome.storage.local.set({ fsrsCards: this.allCards }, () => {
                    try {
                        if (chrome.runtime?.lastError) {
                            const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                            Logger.error('DataDashboard', `Error in bulk reschedule storage set: ${errorMessage}`, { error: chrome.runtime.lastError });
                            return;
                        }
                        this.updateBulkActionsBar();
                        this.filterAndRender();
                    } catch (callbackErr) {
                        const errorMessage = callbackErr instanceof Error ? callbackErr.message : String(callbackErr);
                        Logger.error('DataDashboard', `Error in bulk reschedule callback: ${errorMessage}`, { callbackErr });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error in bulkReschedule: ${errorMessage}`, { err });
        }
    }

    /**
     * Binds click events for edit buttons on each card row.
     */
    bindEditButtons(): void {
        try {
            document.querySelectorAll('.edit-card-btn').forEach(btn => {
                btn.addEventListener('click', (e: Event) => {
                    try {
                        e.stopPropagation();
                        const cardId = (e.currentTarget as HTMLElement).getAttribute('data-id');
                        if (cardId) this.openEditModal(cardId);
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('DataDashboard', `Error in edit button click listener: ${errorMessage}`, { err });
                    }
                });
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error binding edit buttons: ${errorMessage}`, { err });
        }
    }

    getDatabaseTags(): string[] {
        const tagsSet = new Set<string>();
        (this.allCards || []).forEach((c: Card) => {
            if (c.tags && Array.isArray(c.tags)) {
                c.tags.forEach(t => tagsSet.add(t));
            }
        });
        return Array.from(tagsSet).sort();
    }

    /**
     * Opens the inline edit modal for a specific card.
     */
    openEditModal(cardId: string): void {
        try {
            const card = this.allCards.find(c => c.id === cardId);
            if (!card) return;

            (document.getElementById('edit-card-id') as HTMLInputElement).value = cardId;
            (document.getElementById('edit-title') as HTMLInputElement).value = card.problemTitle || '';
            const editTagsInput = document.getElementById('edit-tags') as HTMLInputElement | null;
            if (editTagsInput) {
                TagInputControl.attach(editTagsInput, {
                    getSuggestions: () => this.getDatabaseTags()
                });
                editTagsInput.value = (card.tags || []).join(', ');
            }
            (document.getElementById('edit-approach') as HTMLTextAreaElement).value = card.approach || '';
            (document.getElementById('edit-time-complexity') as HTMLInputElement).value = card.timeComplexity || '';
            (document.getElementById('edit-space-complexity') as HTMLInputElement).value = card.spaceComplexity || '';

            const overlay = document.getElementById('inline-edit-overlay');
            if (overlay) overlay.style.display = 'flex';
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error opening edit modal: ${errorMessage}`, { cardId, err });
        }
    }

    /**
     * Closes the inline edit modal.
     */
    closeEditModal(): void {
        try {
            const overlay = document.getElementById('inline-edit-overlay');
            if (overlay) overlay.style.display = 'none';
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error closing edit modal: ${errorMessage}`, { err });
        }
    }

    /**
     * Saves edits from the inline edit modal to storage.
     */
    saveCardEdit(): void {
        try {
            const cardId = (document.getElementById('edit-card-id') as HTMLInputElement).value;
            const card = this.allCards.find(c => c.id === cardId);
            if (!card) return;

            card.problemTitle = (document.getElementById('edit-title') as HTMLInputElement).value.trim() || card.problemTitle;
            card.tags = (document.getElementById('edit-tags') as HTMLInputElement).value.split(',').map(t => t.trim()).filter(t => t.length > 0);
            card.approach = (document.getElementById('edit-approach') as HTMLTextAreaElement).value;
            card.timeComplexity = (document.getElementById('edit-time-complexity') as HTMLInputElement).value.trim();
            card.spaceComplexity = (document.getElementById('edit-space-complexity') as HTMLInputElement).value.trim();

            chrome.storage.local.set({ fsrsCards: this.allCards }, () => {
                try {
                    if (chrome.runtime?.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('DataDashboard', `Error saving card edit to storage: ${errorMessage}`, { cardId, error: chrome.runtime.lastError });
                        return;
                    }
                    this.closeEditModal();
                    this.populateTagsFilter();
                    this.filterAndRender();
                } catch (callbackErr) {
                    const errorMessage = callbackErr instanceof Error ? callbackErr.message : String(callbackErr);
                    Logger.error('DataDashboard', `Error in save card edit callback: ${errorMessage}`, { cardId, callbackErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error saving card edit: ${errorMessage}`, { err });
        }
    }

    /**
     * Renders statistical cards and distributions of card states.
     */
    renderAnalyticsPanel(cards: Card[]): void {
        try {
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

            let newCount = 0;
            let learningCount = 0;
            let reviewCount = 0;
            let lapsedCount = 0;

            cards.forEach((c: Card) => {
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

            const tagCounts: Record<string, number> = {};
            cards.forEach((c: Card) => {
                if (c.tags && Array.isArray(c.tags)) {
                    c.tags.forEach((t: string) => {
                        tagCounts[t] = (tagCounts[t] || 0) + 1;
                    });
                }
            });

            const sortedTags = Object.entries(tagCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4);

            const maxTagCount = sortedTags.length > 0 ? sortedTags[0][1] : 1;

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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataDashboard', `Error rendering analytics panel: ${errorMessage}`, { err });
            // Comment: Non-fatal analytics panel render error
        }
    }
}

function initDataDashboard(): void {
    try {
        const dashboard = new FSRSDataDashboard();
        dashboard.init();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('DataDashboard', `Error instantiating FSRSDataDashboard: ${errorMessage}`, { err });
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDataDashboard);
    } else {
        initDataDashboard();
    }
}
