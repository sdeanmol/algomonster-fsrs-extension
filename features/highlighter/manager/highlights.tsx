/**
 * @file features/highlighter/manager/highlights.tsx (Preact)
 * @description Manages the highlights repository dashboard interface.
 * Provides full-text search, color filtering, page-level sorting, clipboard copy,
 * highlight deletion, and Markdown export features for persisted text annotations.
 * 
 * Context: Standalone highlights dashboard tab (`highlights.html`) within the Chrome extension.
 * 
 * Key Exports:
 * - `ColorFilterBubbles`: Preact component for color filter swatches.
 * - `HighlightCardView`: Preact component for an individual highlight item.
 * - `HighlightsListView`: Preact component for the filtered highlights stream.
 * - `HighlightsManager`: Controller managing highlight display, search filtering, deletion, and exports.
 */

import { h, render, Fragment, JSX } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { flushSync } from 'preact/compat';
import { Logger } from '@common/logger';
import { HighlightsHelpers } from './highlights-helpers';
import { HighlightMark, BookmarkItem, StorageData } from '../../../types/domain';
import { BROWSER_CONFIG } from '../../common/browserConfig';
import { ActionService } from '@common/services/actionService';
import { MultiSelect, MultiSelectOption } from '../../common/ui/components/MultiSelect';

function safeFlushSync(fn: () => void): void {
    try {
        flushSync(fn);
    } catch (_) {
        fn();
    }
}

try {
    window.AlgoRecall = window.AlgoRecall || {};
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('HighlightsManager', `Error initializing window.AlgoRecall: ${errorMessage}`, { err });
}

/**
 * Props for the ColorFilterBubbles component.
 */
export interface ColorFilterBubblesProps {
    /** Distinct list of hex colors found in the loaded highlights */
    colors: string[];
    /** Currently active filter color, or null if all colors are shown */
    activeColor: string | null;
    /** Callback when a color bubble is toggled */
    onToggleColor: (color: string) => void;
}

/**
 * Preact component for color filter swatches.
 *
 * @param props - Colors list, active filter, and toggle handler.
 * @returns JSX rendered color bubble filter bar.
 */
export function ColorFilterBubbles({
    colors,
    activeColor,
    onToggleColor
}: ColorFilterBubblesProps): JSX.Element {
    if (colors.length === 0) {
        return <span style={{ fontSize: '12px', color: '#666' }}>No colors</span>;
    }
    return (
        <Fragment>
            {colors.map((color) => {
                const isActive = activeColor === color;
                return (
                    <div
                        key={color}
                        className={`color-filter-bubble ${isActive ? 'active' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => onToggleColor(color)}
                    />
                );
            })}
        </Fragment>
    );
}

/**
 * Props for the HighlightCardView component.
 */
export interface HighlightCardViewProps {
    /** Text highlight mark domain entity */
    mark: HighlightMark;
    /** Title or URL of the host problem page */
    pageTitle: string;
    /** Optional favicon URL of the problem page */
    favIconUrl?: string;
    /** Current active search query for keyword highlighting */
    searchQuery: string;
    /** Callback to copy snippet text to clipboard */
    onCopy: (text: string) => void;
    /** Callback to delete this highlight mark */
    onDelete: (id: string) => void;
}

/**
 * Preact component for an individual highlight card.
 *
 * @param props - Mark details, page title, search term, and action handlers.
 * @returns JSX rendered highlight card with copy/delete actions.
 */
export function HighlightCardView({
    mark,
    pageTitle,
    favIconUrl,
    searchQuery,
    onCopy,
    onDelete
}: HighlightCardViewProps): JSX.Element {
    const markId = mark.id || mark.createdAt.toString();
    const dateString = new Date(mark.createdAt).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    const markType = mark.type || 'highlight';
    const formattedSnippet = HighlightsHelpers.highlightSearchMatch(mark.text, searchQuery);
    const [faviconFailed, setFaviconFailed] = useState(false);
    const showFavicon = Boolean(favIconUrl && !faviconFailed);

    return (
        <div className="highlight-card" style={{ borderLeftColor: mark.color }}>
            <div className="highlight-content">
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--md-text-low)', marginBottom: '6px', display: 'flex', alignItems: 'center' }}>
                    {markType === 'underline' ? (
                        <Fragment>
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '12px', height: '12px', marginRight: '4px' }}>
                                <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3" />
                                <line x1="4" y1="21" x2="20" y2="21" />
                            </svg>
                            {' '}Underline
                        </Fragment>
                    ) : (
                        <Fragment>
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '12px', height: '12px', marginRight: '4px' }}>
                                <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
                                <line x1="16" y1="8" x2="2" y2="22" />
                                <line x1="17.5" y1="15" x2="9" y2="6.5" />
                            </svg>
                            {' '}Highlight
                        </Fragment>
                    )}
                </div>
                <div
                    className="highlight-text"
                    style={markType === 'underline' ? { textDecoration: 'underline', textDecorationColor: mark.color } : undefined}
                    dangerouslySetInnerHTML={{ __html: `"${formattedSnippet}"` }}
                />
                {mark.note && (
                    <div className="highlight-note-preview">
                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '11px', height: '11px', stroke: 'var(--md-text-low)' }}>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                        {' '}{mark.note}
                    </div>
                )}
                <div className="highlight-meta">
                    <a href={mark.url} target="_blank" rel="noreferrer" className="highlight-url" title={pageTitle}>
                        {showFavicon ? (
                            <img
                                src={favIconUrl}
                                className="highlight-favicon"
                                style={{ width: '14px', height: '14px', borderRadius: '2px', verticalAlign: 'middle', display: 'inline-block' }}
                                alt=""
                                onError={() => setFaviconFailed(true)}
                            />
                        ) : (
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '13px', height: '13px' }}>
                                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                            </svg>
                        )}
                        <span>{pageTitle}</span>
                    </a>
                    <span className="highlight-date">
                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '13px', height: '13px', stroke: 'var(--md-text-low)' }}>
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>{dateString}</span>
                    </span>
                </div>
            </div>
            <div className="card-actions">
                <button
                    className="action-btn action-btn-copy"
                    data-text={mark.text}
                    title="Copy text to clipboard"
                    aria-label="Copy text to clipboard"
                    onClick={() => onCopy(mark.text)}
                >
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor' }}>
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    </svg>
                </button>
                <button
                    className="action-btn action-btn-delete"
                    data-id={markId}
                    title="Delete Highlight"
                    aria-label="Delete Highlight"
                    onClick={() => onDelete(markId)}
                >
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor' }}>
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                </button>
            </div>
        </div>
    );
}

/**
 * Props for the HighlightsListView component.
 */
export interface HighlightsListViewProps {
    /** Filtered array of highlight marks to display */
    marks: HighlightMark[];
    /** Array of page bookmarks used to correlate URLs with problem titles */
    bookmarks: BookmarkItem[];
    /** Active keyword search string */
    searchQuery: string;
    /** Callback to copy snippet text to clipboard */
    onCopy: (text: string) => void;
    /** Callback to delete an individual highlight mark */
    onDelete: (id: string) => void;
}

/**
 * Preact component rendering the filtered highlights list or empty state.
 *
 * @param props - Filtered marks, bookmarks, query, and event handlers.
 * @returns JSX rendered list of highlight cards or empty state message.
 */
export function HighlightsListView({
    marks,
    bookmarks,
    searchQuery,
    onCopy,
    onDelete
}: HighlightsListViewProps): JSX.Element {
    if (marks.length === 0) {
        return <div className="empty-state">No matching highlights found. Try adjusting your search or filters.</div>;
    }
    return (
        <Fragment>
            {marks.map((mark) => {
                const bookmark = bookmarks.find(b => b.url === mark.url);
                const title = bookmark && bookmark.title ? bookmark.title : mark.url;
                const favIconUrl = (bookmark && bookmark.meta && (bookmark.meta as { favIconUrl?: string }).favIconUrl)
                    ? (bookmark.meta as { favIconUrl?: string }).favIconUrl
                    : undefined;
                const markId = mark.id || mark.createdAt.toString();
                return (
                    <HighlightCardView
                        key={markId}
                        mark={mark}
                        pageTitle={title}
                        favIconUrl={favIconUrl}
                        searchQuery={searchQuery}
                        onCopy={onCopy}
                        onDelete={onDelete}
                    />
                );
            })}
        </Fragment>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PREACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the root HighlightsManagerApp component.
 */
export interface HighlightsManagerAppProps {
    /** Optional controller instance passed during testing or legacy integration */
    manager?: HighlightsManager;
}

export type HighlightsAppProps = HighlightsManagerAppProps;

/**
 * Root Preact component governing the full Highlights Manager dashboard.
 *
 * Provides full-text search, multi-color filtering, domain grouping, date sorting,
 * clipboard replication, deletion, and Markdown export for saved text highlights.
 *
 * @param props - Component configuration containing optional test manager.
 * @returns JSX rendered highlights manager application view.
 */
export function HighlightsManagerApp({ manager: initialManager }: HighlightsManagerAppProps): JSX.Element {
    const [manager] = useState(() => initialManager || new HighlightsManager());
    const [marks, setMarks] = useState<HighlightMark[]>(() => manager.loadedMarks || []);
    const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => manager.loadedBookmarks || []);
    const [searchQuery, setSearchQuery] = useState<string>(() => manager.searchQuery || '');
    const [activeColorFilter, setActiveColorFilter] = useState<string | null>(() => manager.activeColorFilter);
    const [activePageFilters, setActivePageFilters] = useState<string[]>(() => manager.activePageFilters || []);
    const [sortOption, setSortOption] = useState<string>(() => manager.sortOption || 'newest');
    const [isLoading, setIsLoading] = useState<boolean>(() => !manager.loadedMarks || manager.loadedMarks.length === 0);
    const [toastMessage, setToastMessage] = useState<string>('');
    const [toastVisible, setToastVisible] = useState<boolean>(false);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showToast = useCallback((msg: string) => {
        safeFlushSync(() => {
            setToastMessage(msg);
            setToastVisible(true);
        });
        if (manager.onToast) {
            manager.onToast(msg);
        }
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
            safeFlushSync(() => {
                setToastVisible(false);
            });
        }, 2000);
    }, [manager]);

    HighlightsHelpers.onToast = showToast;
    useEffect(() => {
        HighlightsHelpers.onToast = showToast;
        return () => {
            if (HighlightsHelpers.onToast === showToast) {
                HighlightsHelpers.onToast = undefined;
            }
        };
    }, [showToast]);

    const refreshData = () => {
        manager.loadHighlights();
    };

    manager.onUpdate = () => {
        safeFlushSync(() => {
            setMarks([...manager.loadedMarks]);
            setBookmarks([...manager.loadedBookmarks]);
            setSearchQuery(manager.searchQuery || '');
            setActiveColorFilter(manager.activeColorFilter);
            setActivePageFilters(manager.activePageFilters || []);
            setSortOption(manager.sortOption || 'newest');
            setIsLoading(false);
        });
    };

    useEffect(() => {
        if (!initialManager && (!manager.loadedMarks || manager.loadedMarks.length === 0)) {
            refreshData();
        }
    }, [manager, initialManager]);

    // Unique colors for filtering
    const uniqueColors = [...new Set(marks.map(m => m.color).filter(Boolean))];

    // Unique pages map for dropdown
    const uniquePagesMap = new Map<string, string>();
    marks.forEach(mark => {
        const bookmark = bookmarks.find(b => b.url === mark.url);
        const title = bookmark && bookmark.title ? bookmark.title : HighlightsHelpers.getCleanDisplayUrl(mark.url);
        uniquePagesMap.set(mark.url, title);
    });

    // Filtering
    const filtered = marks.filter(mark => {
        const bookmark = bookmarks.find(b => b.url === mark.url);
        const pageTitle = bookmark && bookmark.title ? bookmark.title.toLowerCase() : '';
        const markText = mark.text.toLowerCase();
        const markUrl = mark.url.toLowerCase();
        const markNote = (mark.note || '').toLowerCase();
        const markCategory = (mark.category || '').toLowerCase();
        const q = searchQuery.toLowerCase();

        const matchesQuery = !searchQuery ||
            markText.includes(q) ||
            pageTitle.includes(q) ||
            markUrl.includes(q) ||
            markNote.includes(q) ||
            markCategory.includes(q);

        const matchesColor = !activeColorFilter || mark.color === activeColorFilter;
        const matchesPage = activePageFilters.length === 0 || activePageFilters.includes(mark.url);

        return matchesQuery && matchesColor && matchesPage;
    });

    // Sorting
    filtered.sort((a, b) => {
        if (sortOption === 'newest') {
            return b.createdAt - a.createdAt;
        } else if (sortOption === 'oldest') {
            return a.createdAt - b.createdAt;
        } else if (sortOption === 'longest') {
            return b.text.length - a.text.length;
        } else if (sortOption === 'shortest') {
            return a.text.length - b.text.length;
        } else if (sortOption === 'title') {
            const bookmarkA = bookmarks.find(b => b.url === a.url);
            const bookmarkB = bookmarks.find(b => b.url === b.url);
            const titleA = bookmarkA && bookmarkA.title ? bookmarkA.title.toLowerCase() : a.url.toLowerCase();
            const titleB = bookmarkB && bookmarkB.title ? bookmarkB.title.toLowerCase() : b.url.toLowerCase();
            return titleA.localeCompare(titleB);
        }
        return 0;
    });

    const isFilteredActive = searchQuery !== '' || activeColorFilter !== null || activePageFilters.length > 0;

    const handleClearFilters = () => {
        manager.searchQuery = '';
        manager.activeColorFilter = null;
        manager.activePageFilters = [];
        manager.sortOption = 'newest';
        safeFlushSync(() => {
            setSearchQuery('');
            setActiveColorFilter(null);
            setActivePageFilters([]);
            setSortOption('newest');
        });
    };

    const handleCopy = (text: string) => {
        manager.helpers.copyToClipboard(text);
    };

    const handleDelete = (id: string) => {
        manager.deleteHighlight(id);
    };

    const handleExport = () => {
        manager.exportHighlightsToMarkdown();
    };

    let subtitleText = 'Loading highlights...';
    if (!isLoading) {
        if (isFilteredActive) {
            subtitleText = `Found ${filtered.length} matching highlight(s) out of ${marks.length} total.`;
        } else {
            subtitleText = `You have ${marks.length} saved highlight(s).`;
        }
    }

    return (
        <div className="container">
            {/* Header: Brand badge, title, Markdown export, and storage refresh */}
            <div className="header">
                <div>
                    <div className="algorecall-brand-badge">
                        <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                            <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                        </svg>
                        <span className="algorecall-brand-name">AlgoRecall</span>
                    </div>
                    <h1>
                        <svg className="svg-icon page-header-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        Highlighted Snippets
                    </h1>
                    <p id="highlight-subtitle" className="subtitle">{subtitleText}</p>
                </div>
                <div className="header-actions">
                    <button id="export-highlights-btn" className="btn btn-secondary" onClick={handleExport}>
                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', marginRight: '4px' }} aria-hidden="true">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                            <polyline points="17 21 17 13 7 13 7 21" />
                            <polyline points="7 3 7 8 15 8" />
                        </svg>
                        Export (MD)
                    </button>
                    <button id="refresh-btn" className="btn btn-secondary" onClick={refreshData}>
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <polyline points="23 4 23 10 17 10" />
                            <polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                        </svg>
                        Refresh
                    </button>
                </div>
            </div>

            {/* Search and Filters Panel */}
            <div className="filters-panel">
                <div className="search-box-wrapper">
                    <svg className="svg-icon search-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        id="search-input"
                        className="input-field search-input"
                        placeholder="Search in highlights or webpage titles..."
                        value={searchQuery}
                        onInput={(e) => {
                            try {
                                const val = (e.target as HTMLInputElement).value;
                                manager.searchQuery = val;
                                safeFlushSync(() => {
                                    setSearchQuery(val);
                                });
                            } catch (err) {
                                const errorMessage = err instanceof Error ? err.message : String(err);
                                Logger.error('HighlightsManager', `Error handling search input: ${errorMessage}`, { err });
                            }
                        }}
                    />
                </div>

                <div className="filters-row">
                    <div className="filter-group">
                        <label htmlFor="webpage-select">Source Page</label>
                        <MultiSelect
                            id="webpage-select"
                            options={Array.from(uniquePagesMap.entries()).map(([url, title]): MultiSelectOption => ({
                                value: url,
                                label: title.length > 50 ? title.substring(0, 50) + '...' : title
                            }))}
                            selectedValues={activePageFilters}
                            placeholder="All Pages"
                            searchPlaceholder="Search pages..."
                            ariaLabel="Filter by source page"
                            onChange={(values) => {
                                try {
                                    manager.activePageFilters = values;
                                    safeFlushSync(() => {
                                        setActivePageFilters(values);
                                    });
                                } catch (err) {
                                    const errorMessage = err instanceof Error ? err.message : String(err);
                                    Logger.error('HighlightsManager', `Error handling page filter change: ${errorMessage}`, { err });
                                }
                            }}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="sort-select">Sort By</label>
                        <select
                            id="sort-select"
                            className="input-field select-field"
                            value={sortOption}
                            onChange={(e) => {
                                try {
                                    const val = (e.target as HTMLSelectElement).value;
                                    manager.sortOption = val;
                                    safeFlushSync(() => {
                                        setSortOption(val);
                                    });
                                } catch (err) {
                                    const errorMessage = err instanceof Error ? err.message : String(err);
                                    Logger.error('HighlightsManager', `Error handling sort option change: ${errorMessage}`, { err });
                                }
                            }}
                        >
                            <option value="newest">Newest First</option>
                            <option value="oldest">Oldest First</option>
                            <option value="longest">Longest Snippet</option>
                            <option value="shortest">Shortest Snippet</option>
                            <option value="title">Webpage Title (A-Z)</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label>Filter by Color</label>
                        <div id="color-filters-container" className="color-filters">
                            <ColorFilterBubbles
                                colors={uniqueColors}
                                activeColor={activeColorFilter}
                                onToggleColor={(col) => {
                                    const nextCol = activeColorFilter === col ? null : col;
                                    manager.activeColorFilter = nextCol;
                                    safeFlushSync(() => {
                                        setActiveColorFilter(nextCol);
                                    });
                                }}
                            />
                        </div>
                    </div>

                    <div className="filter-group reset-group">
                        <button
                            id="clear-filters-btn"
                            className="btn btn-text"
                            style={{ display: isFilteredActive ? 'inline-block' : 'none' }}
                            onClick={handleClearFilters}
                        >
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '12px', height: '12px', marginRight: '4px' }} aria-hidden="true">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Highlights List */}
            <div id="highlights-container" className="highlights-list">
                <HighlightsListView
                    marks={filtered}
                    bookmarks={bookmarks}
                    searchQuery={searchQuery}
                    onCopy={handleCopy}
                    onDelete={handleDelete}
                />
            </div>

            {/* Status Toast */}
            <div id="status-toast" className={`toast${toastVisible ? ' show visible' : ''}`}>
                {toastMessage}
            </div>
        </div>
    );
}

export const HighlightsApp = HighlightsManagerApp;

// ─────────────────────────────────────────────────────────────────────────────
// HIGHLIGHTS MANAGER CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Controller for the highlights management and export dashboard.
 */
export class HighlightsManager {
    /** Cached collection of all highlight marks loaded from storage. */
    loadedMarks: HighlightMark[];
    /** Cached collection of all bookmarks used for page title resolution. */
    loadedBookmarks: BookmarkItem[];
    /** Active search query string filtering annotations. */
    searchQuery: string;
    /** Active hex color string filtering annotations, or null for all colors. */
    activeColorFilter: string | null;
    /** Target page URL filters (empty array for all web pages). */
    activePageFilters: string[];
    /** Current sort criterion ('newest' | 'oldest' | 'longest' | 'shortest' | 'title'). */
    sortOption: string;
    /** Observer callback notifying root component of state updates. */
    onUpdate?: () => void;
    /** Delegate callback notifying of toast feedback messages. */
    onToast?: (message: string) => void;

    /**
     * Initializes default filter, search, and sorting states.
     */
    constructor() {
        this.loadedMarks = [];
        this.loadedBookmarks = [];
        
        this.searchQuery = '';
        this.activeColorFilter = null;
        this.activePageFilters = [];
        this.sortOption = 'newest';
    }

    /**
     * Accessor returning the helper utility class.
     */
    get helpers(): typeof HighlightsHelpers {
        return window.AlgoRecall.HighlightsHelpers || HighlightsHelpers;
    }

    /**
     * Initializes the highlights manager, loading storage items and attaching DOM listeners.
     */
    init(): void {
        try {
            const root = (typeof document !== 'undefined' ? document.getElementById('root') : null) || (typeof document !== 'undefined' ? document.body : null);
            if (root) {
                safeFlushSync(() => {
                    render(<HighlightsManagerApp manager={this} />, root);
                });
            }

            this.loadHighlights();
            this.bindEvents();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightsManager', `Error initializing HighlightsManager: ${errorMessage}`, { err });
        }
    }

    /**
     * Registers UI event listeners. Redundant listeners are deprecated since JSX handles events declaratively.
     */
    bindEvents(): void {}

    /**
     * Retrieves saved highlight marks and bookmarks from `chrome.storage.local` and triggers view rendering.
     */
    loadHighlights(): void {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) {
                Logger.warn('HighlightsManager', 'Browser storage API unavailable in loadHighlights.');
                return;
            }
            chrome.storage.local.get(['marks', 'bookmarks'], (result: StorageData) => {
                try {
                    if (chrome.runtime?.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('HighlightsManager', `Storage error fetching marks: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    this.loadedMarks = result.marks || [];
                    this.loadedBookmarks = result.bookmarks || [];
                    if (this.onUpdate) {
                        this.onUpdate();
                    } else if (typeof document !== 'undefined') {
                        const root = document.getElementById('root') || document.body;
                        if (root) {
                            safeFlushSync(() => {
                                render(<HighlightsManagerApp manager={this} />, root);
                            });
                        }
                    }
                    
                    this.populateWebpageSelect();
                    this.renderColorFilters();
                    this.filterAndRender();
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('HighlightsManager', `Error rendering highlights manager: ${errorMessage}`, { innerErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightsManager', `Failed to fetch highlights storage: ${errorMessage}`, { err });
        }
    }

    /**
     * Builds and populates the web page filter `<select>` dropdown with unique URLs and titles.
     */
    populateWebpageSelect(): void {
        try {
            if (this.onUpdate) {
                this.onUpdate();
            } else if (typeof document !== 'undefined') {
                const root = document.getElementById('root') || document.body;
                if (root) {
                    safeFlushSync(() => {
                        render(<HighlightsManagerApp manager={this} />, root);
                    });
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightsManager', `Error populating webpage select: ${errorMessage}`, { err });
        }
    }

    /**
     * Renders clickable color swatch filter bubbles via Preact.
     */
    renderColorFilters(): void {
        try {
            if (this.onUpdate) {
                this.onUpdate();
            } else if (typeof document !== 'undefined') {
                const root = document.getElementById('root') || document.body;
                if (root) {
                    safeFlushSync(() => {
                        render(<HighlightsManagerApp manager={this} />, root);
                    });
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightsManager', `Error rendering color filters: ${errorMessage}`, { err });
        }
    }

    /**
     * Filters the full list of marks against current search query, color filter, and target URL constraints.
     */
    getFilteredMarks(): HighlightMark[] {
        return this.loadedMarks.filter(mark => {
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
            const matchesPage = this.activePageFilters.length === 0 || this.activePageFilters.includes(mark.url);

            return matchesQuery && matchesColor && matchesPage;
        });
    }

    /**
     * Applies active filters and sorting order, generating highlight card DOM elements with actions via Preact.
     */
    filterAndRender(): void {
        try {
            if (this.onUpdate) {
                this.onUpdate();
            } else if (typeof document !== 'undefined') {
                const root = document.getElementById('root') || document.body;
                if (root) {
                    safeFlushSync(() => {
                        render(<HighlightsManagerApp manager={this} />, root);
                    });
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightsManager', `Error filtering and rendering highlights: ${errorMessage}`, { err });
        }
    }

    /**
     * Prompts for user confirmation and removes the specified highlight mark from `chrome.storage.local`.
     */
    deleteHighlight(markId: string): void {
        try {
            if (confirm("Are you sure you want to delete this highlight?")) {
                chrome.storage.local.get(['marks'], (result: StorageData) => {
                    try {
                        if (chrome.runtime.lastError) {
                            const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                            Logger.error('HighlightsManager', `Storage error fetching marks for delete: ${errorMessage}`, { markId, error: chrome.runtime.lastError });
                            return;
                        }
                        let marks = result.marks || [];
                        marks = marks.filter((m: HighlightMark) => (m.id || m.createdAt.toString()) !== markId);
                        chrome.storage.local.set({ marks }, () => {
                            try {
                                if (chrome.runtime.lastError) {
                                    const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                                    Logger.error('HighlightsManager', `Storage error saving marks after delete: ${errorMessage}`, { markId, error: chrome.runtime.lastError });
                                    return;
                                }
                                this.loadHighlights();
                            } catch (setErr) {
                                const errorMessage = setErr instanceof Error ? setErr.message : String(setErr);
                                Logger.error('HighlightsManager', `Error in storage set callback for delete mark: ${errorMessage}`, { setErr });
                            }
                        });
                    } catch (getErr) {
                        const errorMessage = getErr instanceof Error ? getErr.message : String(getErr);
                        Logger.error('HighlightsManager', `Error in storage get callback for delete mark: ${errorMessage}`, { getErr });
                    }
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightsManager', `Error deleting mark '${markId}': ${errorMessage}`, { markId, err });
        }
    }

    /**
     * Compiles all currently filtered highlights into a formatted Markdown document and initiates file download.
     */
    exportHighlightsToMarkdown(): void {
        try {
            const filtered = this.getFilteredMarks();

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
            const filename = `algorecall_highlights_${new Date().toISOString().split('T')[0]}.md`;

            // Safari does not support chrome.downloads — use ActionService anchor-click fallback.
            if (BROWSER_CONFIG.supportsDownloads) {
                chrome.downloads.download({
                    url: url,
                    filename,
                    saveAs: true
                }, () => {
                    try {
                        URL.revokeObjectURL(url);
                    } catch (revokeErr) {
                        const errorMessage = revokeErr instanceof Error ? revokeErr.message : String(revokeErr);
                        Logger.debug('HighlightsManager', `Ignore revokeObjectURL error if URL was already revoked: ${errorMessage}`, { revokeErr });
                    }
                    if (chrome.runtime?.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('HighlightsManager', `Error downloading exported Markdown: ${errorMessage}`, { error: chrome.runtime.lastError });
                    }
                });
            } else {
                ActionService.triggerDomDownload(url, filename);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightsManager', `Error exporting highlights to Markdown: ${errorMessage}`, { err });
        }
    }
}

try {
    const win = window as unknown as { AlgoRecall: { HighlightsManager?: typeof HighlightsManager } };
    win.AlgoRecall = win.AlgoRecall || {};
    win.AlgoRecall.HighlightsManager = HighlightsManager;
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('HighlightsManager', `Error attaching HighlightsManager to window.AlgoRecall: ${errorMessage}`, { err });
}

function initHighlightsManager(): void {
    try {
        const manager = new HighlightsManager();
        manager.init();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('HighlightsManager', `Initialization failed: ${errorMessage}`, { err });
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHighlightsManager);
    } else {
        initHighlightsManager();
    }
}

