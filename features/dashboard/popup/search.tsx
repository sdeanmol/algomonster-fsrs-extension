/**
 * @file features/dashboard/popup/search.tsx
 * @description Quick card search component within the popup dashboard.
 * Provides a debounced text search input and tag filter dropdown to quickly locate
 * tracked algorithms, view status badges (Due vs Safe), and launch problem URLs.
 * Migrated to Preact with TypeScript for modular search result cards and filter inputs.
 *
 * Architecture Role: Popup Sub-View Component (Quick Problem Search).
 * Context: Extension Action Popup (`features/dashboard/popup/popup.html`).
 * Key Exports:
 * - `PopupSearchResultItem`: Preact component rendering an individual search match card.
 * - `PopupSearchResultsList`: Preact component rendering the results dropdown list and pagination link.
 * - `QuickSearchComponent`: Sub-view component class managing the quick search input and result list.
 */

import { h, Fragment, VNode, render } from 'preact';
import { flushSync } from 'preact/compat';
import { useState, useMemo } from 'preact/hooks';
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { DashboardComponent, DashboardCoordinator } from './DashboardComponent';
import { Card, StorageData } from '../../../types/domain';
import { SEARCH_DEBOUNCE_MS, SEARCH_MAX_RESULTS } from '../../common/constants';

function safeFlushSync(fn: () => void): void {
    try {
        flushSync(fn);
    } catch (_) {
        fn();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchFilterBarProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    onClear?: () => void;
    selectedTag: string;
    onTagSelect: (tag: string) => void;
    availableTags?: string[];
}

export function SearchFilterBar({
    searchQuery,
    onSearchChange,
    onClear,
    selectedTag,
    onTagSelect,
    availableTags = []
}: SearchFilterBarProps): VNode {
    return (
        <div className="search-compact">
            <div className="search-input-wrapper">
                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                    type="text"
                    id="search-input"
                    className="search-input"
                    placeholder="Search patterns..."
                    value={searchQuery}
                    onInput={(e) => onSearchChange((e.target as HTMLInputElement).value)}
                />
                <input
                    type="hidden"
                    id="popup-search-input"
                    value={searchQuery}
                />
                {searchQuery && (
                    <button
                        id="search-clear-btn"
                        className="search-clear-btn"
                        title="Clear search"
                        onClick={onClear}
                    >
                        ×
                    </button>
                )}
            </div>
            <select
                id="popup-tag-filter"
                className="tag-filter-select"
                aria-label="Filter by tag"
                value={selectedTag}
                onChange={(e) => onTagSelect((e.target as HTMLSelectElement).value)}
            >
                <option value="all">All Tags</option>
                {availableTags.map((t) => (
                    <option key={t} value={t}>{t}</option>
                ))}
            </select>
            <div id="tag-pills-container" className="tag-pills-container">
                {availableTags.slice(0, 5).map((t) => (
                    <button
                        key={t}
                        className={`tag-pill ${selectedTag === t ? 'active' : ''}`}
                        onClick={() => onTagSelect(selectedTag === t ? 'all' : t)}
                    >
                        {t}
                    </button>
                ))}
            </div>
        </div>
    );
}

export interface QuickSearchSectionProps {
    cards: Card[];
    searchQuery?: string;
    selectedTag?: string;
}

export function QuickSearchSection({
    cards,
    searchQuery: controlledQuery,
    selectedTag: controlledTag
}: QuickSearchSectionProps): VNode {
    const [query, setQuery] = useState(controlledQuery || '');
    const [tag, setTag] = useState(controlledTag || 'all');

    const activeQuery = controlledQuery !== undefined ? controlledQuery : query;
    const activeTag = controlledTag !== undefined ? controlledTag : tag;

    const availableTags = useMemo(() => {
        const set = new Set<string>();
        for (const c of cards) {
            if (c.tags) {
                for (const t of c.tags) set.add(t);
            }
        }
        return Array.from(set).sort();
    }, [cards]);

    const filteredCards = useMemo(() => {
        if (!activeQuery.trim() && activeTag === 'all') return [];
        return cards.filter((c) => {
            const matchesQuery = !activeQuery.trim() ||
                (c.problemTitle && c.problemTitle.toLowerCase().includes(activeQuery.toLowerCase())) ||
                (c.tags && c.tags.some(t => t.toLowerCase().includes(activeQuery.toLowerCase())));
            const matchesTag = activeTag === 'all' || (c.tags && c.tags.includes(activeTag));
            return matchesQuery && matchesTag;
        });
    }, [cards, activeQuery, activeTag]);

    return (
        <div className="quick-search-section">
            <SearchFilterBar
                searchQuery={activeQuery}
                onSearchChange={setQuery}
                onClear={() => setQuery('')}
                selectedTag={activeTag}
                onTagSelect={setTag}
                availableTags={availableTags}
            />
            <div id="search-results">
                {activeQuery.trim() || activeTag !== 'all' ? (
                    <PopupSearchResultsList
                        cards={filteredCards.map(c => ({
                            id: c.id,
                            problemTitle: c.problemTitle,
                            problemUrl: c.problemUrl,
                            isDue: c.due <= Date.now(),
                            tags: c.tags || []
                        }))}
                        totalMatches={filteredCards.length}
                    />
                ) : null}
            </div>
        </div>
    );
}

export interface PopupSearchResultItemProps {
    problemTitle: string;
    problemUrl: string;
    isDue: boolean;
    tags: string[];
}

/**
 * Preact component rendering an individual card match in the quick search popup list.
 */
export function PopupSearchResultItem({
    problemTitle,
    problemUrl,
    isDue,
    tags
}: PopupSearchResultItemProps): VNode {
    const title = problemTitle || 'Untitled';
    const statusBadgeClass = isDue ? 'popup-badge-due' : 'popup-badge-safe';
    const statusText = isDue ? 'Due' : 'Safe';

    return (
        <a
            href={problemUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="popup-search-item"
            title={title}
            aria-label={title}
        >
            <div className="popup-search-item-top">
                <span className="popup-search-title">{title}</span>
                <span className={`popup-badge ${statusBadgeClass}`}>{statusText}</span>
            </div>
            <div className="popup-search-item-tags">
                {(tags || []).slice(0, 3).map((tag, idx) => (
                    <span key={idx} className="popup-tag">{tag}</span>
                ))}
            </div>
        </a>
    );
}

export interface PopupSearchResultsListProps {
    cards: Array<{
        id: string;
        problemTitle: string;
        problemUrl: string;
        isDue: boolean;
        tags: string[];
    }>;
    totalMatches: number;
    maxDisplay?: number;
    viewAllUrl?: string;
}

/**
 * Preact component rendering the complete list of search results.
 */
export function PopupSearchResultsList({
    cards,
    totalMatches,
    maxDisplay = SEARCH_MAX_RESULTS,
    viewAllUrl
}: PopupSearchResultsListProps): VNode {
    if (cards.length === 0) {
        return (
            <div id="popup-search-results" className="search-results-container popup-search-results" style={{ display: 'block' }}>
                <div className="popup-search-empty">No matching patterns found.</div>
            </div>
        );
    }

    return (
        <div id="popup-search-results" className="search-results-container popup-search-results" style={{ display: 'block' }}>
            {cards.slice(0, maxDisplay).map((card) => (
                <PopupSearchResultItem key={card.id} {...card} />
            ))}
            {totalMatches > maxDisplay && viewAllUrl && (
                <a
                    href={viewAllUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="popup-search-view-all"
                >
                    View all {totalMatches} results →
                </a>
            )}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH CONTROLLER COMPONENT & APP
// ─────────────────────────────────────────────────────────────────────────────

export interface QuickSearchAppProps {
    component: QuickSearchComponent;
}

/**
 * Declarative Preact component governing the Quick Search interactive view.
 */
export function QuickSearchApp({ component }: QuickSearchAppProps): VNode {
    const [query, setQuery] = useState<string>(component.searchQuery);
    const [tag, setTag] = useState<string>(component.selectedTag);

    component._setQuery = setQuery;
    component._setTag = setTag;

    const availableTags = useMemo(() => {
        const set = new Set<string>();
        for (const c of component.quickSearchCards) {
            if (c.tags && Array.isArray(c.tags)) {
                for (const t of c.tags) set.add(t);
            }
        }
        return Array.from(set).sort();
    }, [component.quickSearchCards]);

    const filteredCards = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q && tag === 'all') return [];
        return component.quickSearchCards.filter((c) => {
            if (tag !== 'all' && !(c.tags && c.tags.includes(tag))) return false;
            if (q) {
                const titleMatch = c.problemTitle && c.problemTitle.toLowerCase().includes(q);
                const urlMatch = c.problemUrl && c.problemUrl.toLowerCase().includes(q);
                const tagMatch = c.tags && c.tags.some((t: string) => t.toLowerCase().includes(q));
                const approachMatch = c.approach && c.approach.toLowerCase().includes(q);
                if (!titleMatch && !urlMatch && !tagMatch && !approachMatch) return false;
            }
            return true;
        });
    }, [component.quickSearchCards, query, tag]);

    const totalMatches = filteredCards.length;
    const now = Date.now();
    const displayCards = filteredCards.slice(0, SEARCH_MAX_RESULTS);

    const dataUrl = useMemo(() => {
        if (typeof chrome === 'undefined' || !chrome.runtime?.getURL) return '';
        const urlParams = new URLSearchParams();
        urlParams.append('view', 'total');
        if (query.trim()) urlParams.append('search', query.trim());
        if (tag && tag !== 'all') urlParams.append('tag', tag);
        return chrome.runtime.getURL(`features/common/data/data.html?${urlParams.toString()}`);
    }, [query, tag]);

    const handleSearchInput = (val: string) => {
        try {
            component.searchQuery = val;
            if (component.quickSearchDebounce) clearTimeout(component.quickSearchDebounce);
            component.quickSearchDebounce = setTimeout(() => {
                try {
                    safeFlushSync(() => {
                        setQuery(val);
                    });
                } catch (renderErr) {
                    UIUtils.catchError('QuickSearchComponent', 'Error in debounced quick search render', renderErr);
                }
            }, SEARCH_DEBOUNCE_MS);
        } catch (err) {
            UIUtils.catchError('QuickSearchComponent', 'Error in quick search input listener', err);
        }
    };

    const handleTagChange = (newTag: string) => {
        try {
            component.selectedTag = newTag;
            safeFlushSync(() => {
                setTag(newTag);
            });
        } catch (err) {
            UIUtils.catchError('QuickSearchComponent', 'Error in tag filter change listener', err);
        }
    };

    const hasActiveFilter = Boolean(query.trim() || tag !== 'all');

    return (
        <div className="quick-search-section">
            <div className="search-compact">
                <div className="search-input-wrapper">
                    <input
                        type="text"
                        id="popup-search-input"
                        className="search-input"
                        placeholder="Search patterns..."
                        value={query}
                        onInput={(e) => handleSearchInput((e.target as HTMLInputElement).value)}
                    />
                </div>
                <select
                    id="popup-tag-filter"
                    className="tag-filter-select"
                    aria-label="Filter by tag"
                    value={tag}
                    onChange={(e) => handleTagChange((e.target as HTMLSelectElement).value)}
                >
                    <option value="all">All Tags</option>
                    {availableTags.map((t) => (
                        <option key={t} value={t}>{t}</option>
                    ))}
                </select>
            </div>
            <div
                id="popup-search-results"
                className="popup-search-results"
                style={{ display: hasActiveFilter ? 'block' : 'none' }}
            >
                {hasActiveFilter && (
                    displayCards.length === 0 ? (
                        <div className="popup-search-empty">No matching patterns found.</div>
                    ) : (
                        <Fragment>
                            {displayCards.map((card) => (
                                <PopupSearchResultItem
                                    key={card.id}
                                    problemTitle={card.problemTitle}
                                    problemUrl={card.problemUrl}
                                    isDue={card.due <= now}
                                    tags={card.tags || []}
                                />
                            ))}
                            {totalMatches > SEARCH_MAX_RESULTS && (
                                <a
                                    href={dataUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="popup-search-view-all"
                                >
                                    View all {totalMatches} results →
                                </a>
                            )}
                        </Fragment>
                    )
                )}
            </div>
        </div>
    );
}

/**
 * Sub-component for the popup dashboard providing debounced problem search
 * with tag filtering and direct external link navigation.
 */
export class QuickSearchComponent extends DashboardComponent {
    /** In-memory cache of all tracked FSRS cards for instant query filtering. */
    quickSearchCards: Card[];
    /** Timeout handle for debouncing user input keystrokes. */
    quickSearchDebounce: ReturnType<typeof setTimeout> | null;
    /** Target container element for mounting Preact component. */
    container: HTMLElement | null;
    /** Current search query string. */
    searchQuery: string;
    /** Current selected topic tag filter. */
    selectedTag: string;
    /** Registered state dispatch hook for search query. */
    _setQuery?: (q: string) => void;
    /** Registered state dispatch hook for tag filter. */
    _setTag?: (t: string) => void;

    /**
     * Initializes the quick search component with a coordinator reference.
     * @param coordinator - Parent dashboard coordinator.
     * @param container - Optional container element for mounting Preact component.
     */
    constructor(coordinator: DashboardCoordinator, container?: HTMLElement | null) {
        super(coordinator);
        this.quickSearchCards = [];
        this.quickSearchDebounce = null;
        this.container = container || null;
        this.searchQuery = '';
        this.selectedTag = 'all';
    }

    /**
     * Initializes quick search input and tag selectors from the dashboard.
     * Loads cards from storage and renders the declarative Preact search app.
     * @async
     * @returns Promise resolving when cards and Preact components have loaded.
     */
    async load(): Promise<void> {
        try {
            const root = this.container || (typeof document !== 'undefined' ? document.getElementById('root') : null);
            if (!root) return;

            const result = (await chrome.storage.local.get(['fsrsCards'])) as StorageData;
            this.quickSearchCards = result?.fsrsCards || [];

            this.render(root);
        } catch (error) {
            UIUtils.catchError('QuickSearchComponent', 'Error loading quick search cards', error);
        }
    }

    /**
     * Mounts or updates the declarative QuickSearchApp inside target root.
     * @param [container] - Target container element.
     */
    render(container?: HTMLElement | null): void {
        const root = container || this.container || (typeof document !== 'undefined' ? document.getElementById('root') : null);
        if (!root) return;
        render(<QuickSearchApp component={this} />, root);
    }

    /**
     * Binds input and selection events for quick search filters.
     * Kept for lifecycle interface conformance; events are bound declaratively in Preact JSX.
     */
    bindEvents(): void {
        try {
            const root = this.container || (typeof document !== 'undefined' ? document.getElementById('root') : null);
            if (root && this.quickSearchCards.length > 0) {
                this.render(root);
            }
        } catch (err) {
            UIUtils.catchError('QuickSearchComponent', 'Error binding quick search events', err);
        }
    }

    /**
     * Renders filtered card quick search items matching text query and topic tag fields.
     */
    renderQuickSearch(): void {
        try {
            const root = this.container || (typeof document !== 'undefined' ? document.getElementById('root') : null);
            if (!root) return;
            safeFlushSync(() => {
                if (this._setQuery) {
                    this._setQuery(this.searchQuery);
                }
                if (this._setTag) {
                    this._setTag(this.selectedTag);
                }
            });
        } catch (err) {
            UIUtils.catchError('QuickSearchComponent', 'Error rendering quick search results', err);
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).QuickSearchComponent = QuickSearchComponent;
    (module.exports as any).QuickSearchApp = QuickSearchApp;
    (module.exports as any).PopupSearchResultItem = PopupSearchResultItem;
    (module.exports as any).PopupSearchResultsList = PopupSearchResultsList;
}

