import { h, Fragment, render, VNode } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Logger } from '@common/logger';
import { UIUtils } from '../utils/uiUtils';
import { ensureCardIds } from '../utils/cardUtils';
import { TagInputControl } from '../utils/tagInput';
import { Card, StorageData, UserSettings } from '../../../types/domain';
import { PLATFORM_NAMES, MONTH_NAMES } from '../constants';

/**
 * @file Full Problem Pattern Database Table and Management Dashboard
 * @module features/common/data/data
 * @context Extension Dashboard Page (features/common/data/data.html)
 * @description Manages database tables listing saved problem patterns and cards.
 * Supports keyword search, multi-factor filtering (status, tag, platform, FSRS memory state),
 * column sorting, bulk actions (delete, retag, reschedule), inline card modal editing,
 * card deletion with undo toasts, and visual memory retention/state distribution analytics.
 * Migrated to Preact with TypeScript for modular, accessible table components.
 */

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface CardsTableEmptyStateProps {
    isFilterActive: boolean;
    onClearFilters?: () => void;
}

/**
 * Preact component for the empty state placeholder when no cards match filters.
 */
export function CardsTableEmptyState({
    isFilterActive,
    onClearFilters
}: CardsTableEmptyStateProps): VNode {
    const message = isFilterActive
        ? 'No problem patterns match your selected filters.'
        : 'No problem patterns tracked yet. Solve problems on LeetCode or AlgoMonster to build your spaced repetition deck!';

    return (
        <div
            className="empty-state-card"
            style={{
                textAlign: 'center',
                padding: '48px 24px',
                background: 'var(--md-surface)',
                border: '1px dashed var(--md-border)',
                borderRadius: '12px',
                margin: '20px 0'
            }}
        >
            <svg
                className="svg-icon"
                viewBox="0 0 24 24"
                style={{ width: '48px', height: '48px', stroke: 'var(--md-text-subtle)', marginBottom: '12px' }}
                aria-hidden="true"
            >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <h4 style={{ margin: '0 0 8px 0', color: 'var(--md-text-high)', fontSize: '16px' }}>
                {isFilterActive ? 'No Matching Patterns' : 'No Patterns Found'}
            </h4>
            <p style={{ margin: '0 auto', color: 'var(--md-text-med)', fontSize: '13px', maxWidth: '400px' }}>
                {message}
            </p>
            {isFilterActive && onClearFilters && (
                <button
                    id="empty-clear-filters-btn"
                    className="btn btn-secondary"
                    style={{ marginTop: '12px', cursor: 'pointer' }}
                    onClick={onClearFilters}
                >
                    Clear Filters
                </button>
            )}
        </div>
    );
}

export interface CardsTableRowProps {
    card: Card;
    isChecked: boolean;
    showLapses?: boolean;
    stateLabel: string;
    onToggleCheck?: (cardId: string, checked: boolean) => void;
    onEdit?: (cardId: string) => void;
    onDelete?: (cardId: string) => void;
}

/**
 * Preact component for an individual problem card table row.
 */
export function CardsTableRow({
    card,
    isChecked,
    showLapses = true,
    stateLabel,
    onToggleCheck,
    onEdit,
    onDelete
}: CardsTableRowProps): VNode {
    const now = Date.now();
    const isPastDue = card.due <= now;
    const reps = card.reps || 0;
    const lapses = card.lapses || 0;
    const state = card.state || 0;
    const isLeech = lapses >= 3;
    const stabilityFormatted = card.stability > 0 ? `${card.stability.toFixed(1)}d` : 'New';
    const difficultyFormatted = card.difficulty > 0 ? `${card.difficulty.toFixed(1)}/10` : 'N/A';
    const stateClass = `state-${state}`;

    return (
        <tr className={`${isChecked ? 'row-selected' : ''} ${isLeech ? 'row-leech' : ''}`}>
            <td className="td-checkbox">
                <input
                    type="checkbox"
                    className="card-checkbox row-checkbox"
                    data-id={card.id || ''}
                    checked={isChecked}
                    onChange={(e) => {
                        if (card.id && onToggleCheck) {
                            onToggleCheck(card.id, (e.target as HTMLInputElement).checked);
                        }
                    }}
                />
            </td>
            <td style={{ whiteSpace: 'normal', wordWrap: 'break-word', maxWidth: '220px' }}>
                <a href={card.problemUrl || '#'} target="_blank" rel="noopener noreferrer">
                    {card.problemTitle || 'Untitled'}
                </a>
            </td>
            <td className="td-tags" style={{ whiteSpace: 'normal', wordWrap: 'break-word', maxWidth: '140px' }}>
                {(card.tags || []).map((t) => (
                    <span key={t} className="tag">{t}</span>
                ))}
            </td>
            <td>
                {isPastDue ? (
                    <span className="badge badge-due">Due Now</span>
                ) : (
                    <span className="badge badge-safe">{new Date(card.due).toLocaleDateString()}</span>
                )}
            </td>
            <td>
                <span className={`badge badge-state ${stateClass}`}>
                    {stateLabel}{isLeech ? ' (Leech)' : ''}
                </span>
            </td>
            <td className="td-reviews">{reps}</td>
            <td>{stabilityFormatted}</td>
            <td>{difficultyFormatted}</td>
            {showLapses && (
                <td className="td-lapses">
                    {lapses >= 3 ? (
                        <span className="badge badge-leech" title="Leech Card: Forgotten 3+ times. Consider rewriting your solution approach note!">
                            ⚡ {lapses} (Leech)
                        </span>
                    ) : lapses > 0 ? (
                        <span className="badge badge-lapsed" title={`${lapses} lapse(s) recorded`}>
                            ⚠️ {lapses}
                        </span>
                    ) : (
                        <span className="text-subtle">&mdash;</span>
                    )}
                </td>
            )}
            <td className="td-actions">
                <div className="actions-wrapper">
                    <button
                        className="edit-card-btn"
                        data-id={card.id || ''}
                        title="Edit Card"
                        aria-label="Edit Card"
                        onClick={() => {
                            if (card.id && onEdit) onEdit(card.id);
                        }}
                    >
                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor' }}>
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button
                        className="delete-card-btn"
                        data-id={card.id || ''}
                        title="Remove Card from Reviews"
                        aria-label="Remove Card from Reviews"
                        onClick={() => {
                            if (card.id && onDelete) onDelete(card.id);
                        }}
                    >
                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', stroke: 'currentColor' }}>
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
    );
}

export interface CardsTableProps {
    cards: Card[];
    selectedCardIds: Set<string>;
    showLapses?: boolean;
    isFilterActive?: boolean;
    getStateLabel: (state: number) => string;
    onToggleSelectAll?: (checked: boolean) => void;
    onToggleCard?: (cardId: string, checked: boolean) => void;
    onEditCard?: (cardId: string) => void;
    onDeleteCard?: (cardId: string) => void;
    onClearFilters?: () => void;
}

/**
 * Preact component rendering the responsive problem patterns table.
 */
export function CardsTable({
    cards,
    selectedCardIds,
    showLapses = true,
    isFilterActive = false,
    getStateLabel,
    onToggleSelectAll,
    onToggleCard,
    onEditCard,
    onDeleteCard,
    onClearFilters
}: CardsTableProps): VNode {
    if (cards.length === 0) {
        return <CardsTableEmptyState isFilterActive={isFilterActive} onClearFilters={onClearFilters} />;
    }

    const allChecked = cards.length > 0 && cards.every((c) => Boolean(c.id && selectedCardIds.has(c.id)));

    return (
        <div className="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th className="th-checkbox">
                            <input
                                type="checkbox"
                                id="select-all-checkbox"
                                className="card-checkbox"
                                checked={allChecked}
                                onChange={(e) => {
                                    if (onToggleSelectAll) {
                                        onToggleSelectAll((e.target as HTMLInputElement).checked);
                                    }
                                }}
                            />
                        </th>
                        <th>Problem Title</th>
                        <th className="th-tags">Tags</th>
                        <th>Next Due</th>
                        <th>State</th>
                        <th className="th-reviews">Reviews</th>
                        <th>Stability</th>
                        <th>Difficulty</th>
                        {showLapses && <th className="th-lapses">Lapses</th>}
                        <th className="th-actions">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {cards.map((card) => (
                        <CardsTableRow
                            key={card.id || card.problemUrl}
                            card={card}
                            isChecked={Boolean(card.id && selectedCardIds.has(card.id))}
                            showLapses={showLapses}
                            stateLabel={getStateLabel(card.state || 0)}
                            onToggleCheck={onToggleCard}
                            onEdit={onEditCard}
                            onDelete={onDeleteCard}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export interface BulkActionsBarProps {
    selectedCount: number;
    onDelete: () => void;
    onRetag: () => void;
    onReschedule: () => void;
    onDeselect: () => void;
}

/**
 * Preact component for the floating multi-selection bulk actions bar.
 */
export function BulkActionsBar({
    selectedCount,
    onDelete,
    onRetag,
    onReschedule,
    onDeselect
}: BulkActionsBarProps): VNode {
    return (
        <div id="bulk-actions-bar" className="bulk-actions-bar" style={{ display: selectedCount > 0 ? 'flex' : 'none' }}>
            <div className="bulk-info">
                <span id="bulk-count">{selectedCount}</span> card(s) selected
            </div>
            <div className="bulk-buttons">
                <button id="bulk-delete-btn" className="btn btn-danger btn-sm" onClick={onDelete}>
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '13px', height: '13px' }} aria-hidden="true">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    Delete Selected
                </button>
                <button id="bulk-retag-btn" className="btn btn-secondary btn-sm" onClick={onRetag}>
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '13px', height: '13px' }} aria-hidden="true">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                        <line x1="7" y1="7" x2="7.01" y2="7" />
                    </svg>
                    Re-tag Selected
                </button>
                <button id="bulk-reschedule-btn" className="btn btn-secondary btn-sm" onClick={onReschedule}>
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '13px', height: '13px' }} aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Reschedule
                </button>
                <button id="bulk-deselect-btn" className="btn btn-text btn-sm" onClick={onDeselect}>
                    Deselect All
                </button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PREACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface DataAppProps {
    dashboard?: FSRSDataDashboard;
}

/**
 * Root Preact component governing the full Data Dashboard application.
 */
export function DataApp({ dashboard: initialDashboard }: DataAppProps): VNode {
    const [dashboard] = useState(() => initialDashboard || new FSRSDataDashboard());
    const [cards, setCards] = useState<Card[]>(dashboard.allCards || []);
    const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(dashboard.selectedCardIds || new Set());
    const [searchQuery, setSearchQuery] = useState<string>(dashboard.searchQuery || '');
    const [selectedTag, setSelectedTag] = useState<string>(dashboard.selectedTag || 'all');
    const [selectedStatus, setSelectedStatus] = useState<string>(dashboard.selectedStatus || 'all');
    const [selectedPlatform, setSelectedPlatform] = useState<string>(dashboard.selectedPlatform || 'all');
    const [selectedState, setSelectedState] = useState<string>(dashboard.selectedState || 'all');
    const [sortBy, setSortBy] = useState<string>(dashboard.sortBy || 'due-asc');
    const [view, setView] = useState<string>(dashboard.currentView || 'total');
    const [, setRenderTrigger] = useState(0);

    const forceUpdate = () => setRenderTrigger(c => c + 1);

    const refreshData = () => {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) return;
        chrome.storage.local.get(['fsrsCards', 'extensionSettings'], (result: StorageData) => {
            const loaded = ensureCardIds(result.fsrsCards || []);
            dashboard.allCards = loaded;
            dashboard.extensionSettings = (result.extensionSettings || {}) as UserSettings & { showCharts?: boolean };
            setCards(loaded);
            forceUpdate();
        });
    };

    useEffect(() => {
        dashboard.onUpdate = () => {
            setCards([...dashboard.allCards]);
            setSelectedCardIds(new Set(dashboard.selectedCardIds));
            setSearchQuery(dashboard.searchQuery);
            setSelectedTag(dashboard.selectedTag);
            setSelectedStatus(dashboard.selectedStatus);
            setSelectedPlatform(dashboard.selectedPlatform);
            setSelectedState(dashboard.selectedState);
            setSortBy(dashboard.sortBy);
            setView(dashboard.currentView);
            forceUpdate();
        };

        const urlParams = new URLSearchParams(window.location.search);
        dashboard.currentView = urlParams.get('view') || 'total';
        dashboard.targetDate = urlParams.get('date');
        setView(dashboard.currentView);

        const urlSearch = urlParams.get('search') || urlParams.get('q') || urlParams.get('query');
        if (urlSearch) {
            dashboard.searchQuery = urlSearch;
            setSearchQuery(urlSearch);
        }
        const urlTag = urlParams.get('tag');
        if (urlTag) {
            dashboard.selectedTag = urlTag;
            setSelectedTag(urlTag);
        }

        refreshData();
    }, [dashboard]);

    // Unique tags
    const allTags = new Set<string>();
    cards.forEach(c => {
        (c.tags || []).forEach(t => allTags.add(t));
    });
    const sortedTags = Array.from(allTags).sort();

    // Unique platforms
    const allPlatforms = new Set<string>();
    cards.forEach(c => {
        try {
            const urlObj = new URL(c.problemUrl);
            allPlatforms.add(urlObj.hostname);
        } catch {
            // ignore
        }
    });
    const sortedPlatforms = Array.from(allPlatforms).sort();

    // Title & subtitle
    let pageTitle = 'Total Saved Patterns';
    let pageSubtitle = `You have saved ${cards.length} algorithmic patterns.`;
    if (view === 'due') {
        const now = Date.now();
        const dueCount = cards.filter(c => c.due <= now).length;
        pageTitle = 'Patterns Due Today';
        pageSubtitle = `You have ${dueCount} pattern(s) awaiting review.`;
    } else if (view === 'retention') {
        pageTitle = 'Retention';
        pageSubtitle = 'Showing all patterns with at least 1 lapse.';
    } else if (view === 'forecast' && dashboard.targetDate) {
        pageTitle = `Cards Due — ${dashboard.targetDate}`;
        pageSubtitle = `Cards scheduled for review on ${dashboard.targetDate}.`;
    }

    const isFilterActive = searchQuery !== '' || selectedTag !== 'all' || selectedStatus !== 'all' || selectedPlatform !== 'all' || selectedState !== 'all' || sortBy !== 'due-asc';

    const handleClearFilters = () => {
        dashboard.resetFilters();
    };

    const handleSearch = (val: string) => {
        setSearchQuery(val);
        dashboard.searchQuery = val;
        dashboard.filterAndRender();
        forceUpdate();
    };

    const handleTagChange = (val: string) => {
        setSelectedTag(val);
        dashboard.selectedTag = val;
        dashboard.filterAndRender();
        forceUpdate();
    };

    const handleStatusChange = (val: string) => {
        setSelectedStatus(val);
        dashboard.selectedStatus = val;
        dashboard.filterAndRender();
        forceUpdate();
    };

    const handlePlatformChange = (val: string) => {
        setSelectedPlatform(val);
        dashboard.selectedPlatform = val;
        dashboard.filterAndRender();
        forceUpdate();
    };

    const handleStateChange = (val: string) => {
        setSelectedState(val);
        dashboard.selectedState = val;
        dashboard.filterAndRender();
        forceUpdate();
    };

    const handleSortChange = (val: string) => {
        setSortBy(val);
        dashboard.sortBy = val;
        dashboard.filterAndRender();
        forceUpdate();
    };

    const handleToggleCard = (cardId: string, checked: boolean) => {
        dashboard.toggleCardSelection(cardId, checked);
        setSelectedCardIds(new Set(dashboard.selectedCardIds));
    };

    const handleToggleSelectAll = (checked: boolean) => {
        dashboard.toggleSelectAll(checked);
        setSelectedCardIds(new Set(dashboard.selectedCardIds));
    };

    const handleEditCard = (cardId: string) => {
        dashboard.openEditModal(cardId);
    };

    const handleDeleteCard = (cardId: string) => {
        dashboard.deleteCard(cardId);
    };

    const handleBulkDelete = () => {
        dashboard.bulkDelete();
    };

    const handleBulkRetag = () => {
        dashboard.bulkRetag();
    };

    const handleBulkReschedule = () => {
        dashboard.bulkReschedule();
    };

    const handleDeselectAll = () => {
        dashboard.toggleSelectAll(false);
        setSelectedCardIds(new Set());
    };

    return (
        <div className="container">
            {/* Header: Brand badge, title, subtitle, and navigation links */}
            <div className="header">
                <div className="header-main">
                    <div className="algorecall-brand-badge">
                        <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                            <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                        </svg>
                        <span className="algorecall-brand-name">AlgoRecall</span>
                    </div>
                    <h1 id="page-title">{pageTitle}</h1>
                    <p id="page-subtitle" className="subtitle">{pageSubtitle}</p>
                </div>
                <div className="header-actions">
                    <a href="../../dashboard/analytics/analytics.html" className="btn btn-secondary" style={{ marginRight: '8px' }}>
                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ marginRight: '6px' }} aria-hidden="true">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                        Analytics
                    </a>
                    <a href="../../dashboard/history/history.html" className="btn btn-secondary">
                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ marginRight: '6px' }} aria-hidden="true">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                        View History Map
                    </a>
                </div>
            </div>

            {/* Dynamic Analytics Graphs Panel */}
            <div id="analytics-panel" className="analytics-grid" style={{ display: 'none', marginBottom: '24px' }} />

            {/* Controls & Filters Panel */}
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
                        placeholder="Search pattern title, URL, or tags..."
                        value={searchQuery}
                        onInput={(e) => handleSearch((e.target as HTMLInputElement).value)}
                    />
                </div>

                <div className="filters-row">
                    <div className="filter-group">
                        <label htmlFor="tag-select">Filter by Tag</label>
                        <select
                            id="tag-select"
                            className="input-field select-field"
                            value={selectedTag}
                            onChange={(e) => handleTagChange((e.target as HTMLSelectElement).value)}
                        >
                            <option value="all">All Tags</option>
                            {sortedTags.map(t => (
                                <option key={t} value={t}>{t}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="status-select">Status</label>
                        <select
                            id="status-select"
                            className="input-field select-field"
                            value={selectedStatus}
                            onChange={(e) => handleStatusChange((e.target as HTMLSelectElement).value)}
                        >
                            <option value="all">All Patterns</option>
                            <option value="due">Due for Review</option>
                            <option value="safe">Safe (Caught Up)</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="platform-select">Platform</label>
                        <select
                            id="platform-select"
                            className="input-field select-field"
                            value={selectedPlatform}
                            onChange={(e) => handlePlatformChange((e.target as HTMLSelectElement).value)}
                        >
                            <option value="all">All Platforms</option>
                            {sortedPlatforms.map(p => (
                                <option key={p} value={p}>{p}</option>
                            ))}
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="state-select">FSRS State</label>
                        <select
                            id="state-select"
                            className="input-field select-field"
                            value={selectedState}
                            onChange={(e) => handleStateChange((e.target as HTMLSelectElement).value)}
                        >
                            <option value="all">All States</option>
                            <option value="0">New</option>
                            <option value="1">Learning</option>
                            <option value="2">Review</option>
                            <option value="3">Relearning (Lapsed)</option>
                            <option value="leech">⚡ Leeches (3+ Lapses)</option>
                        </select>
                    </div>

                    <div className="filter-group">
                        <label htmlFor="sort-select">Sort By</label>
                        <select
                            id="sort-select"
                            className="input-field select-field"
                            value={sortBy}
                            onChange={(e) => handleSortChange((e.target as HTMLSelectElement).value)}
                        >
                            <option value="due-asc">Due Date (Soonest)</option>
                            <option value="due-desc">Due Date (Latest)</option>
                            <option value="difficulty-desc">Difficulty (Hardest)</option>
                            <option value="stability-desc">Stability (Highest)</option>
                            <option value="stability-asc">Stability (Lowest)</option>
                            <option value="lapses-desc">Lapses (Most)</option>
                            <option value="created-desc">Created (Newest)</option>
                            <option value="created-asc">Created (Oldest)</option>
                        </select>
                    </div>

                    <div className="filter-group reset-group">
                        <button
                            id="clear-filters-btn"
                            className="btn btn-text"
                            style={{ display: isFilterActive ? 'inline-flex' : 'none' }}
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

            {/* Bulk Actions Floating Bar */}
            <BulkActionsBar
                selectedCount={selectedCardIds.size}
                onDelete={handleBulkDelete}
                onRetag={handleBulkRetag}
                onReschedule={handleBulkReschedule}
                onDeselect={handleDeselectAll}
            />

            {/* Data Content / Table */}
            <div id="data-content" className="data-table-container">
                <CardsTable
                    cards={cards}
                    selectedCardIds={selectedCardIds}
                    showLapses={true}
                    isFilterActive={isFilterActive}
                    getStateLabel={(s) => dashboard.getStateLabel(s)}
                    onToggleSelectAll={handleToggleSelectAll}
                    onToggleCard={handleToggleCard}
                    onEditCard={handleEditCard}
                    onDeleteCard={handleDeleteCard}
                    onClearFilters={handleClearFilters}
                />
            </div>

            {/* Inline Edit Modal Overlay */}
            <div id="inline-edit-overlay" className="edit-overlay" style={{ display: 'none' }}>
                <div className="edit-modal">
                    <div className="edit-modal-header">
                        <h3 style={{ padding: 0, margin: 0, background: 'none' }}>Edit Card</h3>
                        <button id="edit-close-btn" className="edit-close-btn" onClick={() => dashboard.closeEditModal()}>
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                    <div className="edit-modal-body">
                        <input type="hidden" id="edit-card-id" />
                        <div className="edit-field">
                            <label htmlFor="edit-title">Problem Title</label>
                            <input type="text" id="edit-title" className="input-field" placeholder="Problem title..." />
                        </div>
                        <div className="edit-field">
                            <label htmlFor="edit-tags">Tags (comma-separated)</label>
                            <input type="text" id="edit-tags" className="input-field" placeholder="Binary Search, DP, Graphs..." />
                        </div>
                        <div className="edit-field-row">
                            <div className="edit-field">
                                <label htmlFor="edit-time-complexity">Time Complexity</label>
                                <input type="text" id="edit-time-complexity" className="input-field" placeholder="O(n log n)" />
                            </div>
                            <div className="edit-field">
                                <label htmlFor="edit-space-complexity">Space Complexity</label>
                                <input type="text" id="edit-space-complexity" className="input-field" placeholder="O(n)" />
                            </div>
                        </div>
                        <div className="edit-field">
                            <label htmlFor="edit-approach">Approach Notes</label>
                            <textarea id="edit-approach" className="input-field edit-textarea" rows={8} placeholder="Your approach notes..." />
                        </div>
                    </div>
                    <div className="edit-modal-footer">
                        <button id="edit-cancel-btn" className="btn btn-secondary" onClick={() => dashboard.closeEditModal()}>
                            Cancel
                        </button>
                        <button id="edit-save-btn" className="btn btn-primary" onClick={() => dashboard.saveCardEdit()}>
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>

            {/* Notification Toast & Temporary Undo Toast */}
            <div id="status-toast" className="toast" />
            <div id="undo-toast" className="undo-toast" style={{ display: 'none' }}>
                <span id="undo-toast-text" />
                <button id="undo-action-btn" className="btn-undo">Undo</button>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA DASHBOARD CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class FSRSDataDashboard {
    /** In-memory cache of all FSRS cards retrieved from storage */
    allCards: Card[];
    /** Current view mode ('total' | 'due' | 'retention') */
    currentView: string;
    /** Optional calendar date filter parameter ("YYYY-MM-DD") */
    targetDate: string | null;

    /** Active search query string */
    searchQuery: string;
    /** Currently selected tag filter identifier */
    selectedTag: string;
    /** Currently selected due status filter */
    selectedStatus: string;
    /** Currently selected platform/domain filter */
    selectedPlatform: string;
    /** Currently selected FSRS state filter */
    selectedState: string;
    /** Active sorting key (e.g. 'due-asc', 'difficulty-desc') */
    sortBy: string;
    /** User extension settings cached from storage */
    extensionSettings: UserSettings & { showCharts?: boolean };

    /** Set of selected card IDs for bulk actions */
    selectedCardIds: Set<string>;
    /** Timer reference for auto-dismissing deletion undo toast */
    undoTimer: ReturnType<typeof setTimeout> | null;
    /** Observer callback notifying root component of state updates */
    onUpdate?: () => void;

    /**
     * Initializes default filter selections, views, and bulk selection state.
     */
    constructor() {
        this.allCards = [];
        this.currentView = 'total';
        this.targetDate = null;
        this.undoTimer = null;

        this.searchQuery = '';
        this.selectedTag = 'all';
        this.selectedStatus = 'all';
        this.selectedPlatform = 'all';
        this.selectedState = 'all';
        this.sortBy = 'due-asc';
        this.extensionSettings = {};

        // Bulk selection tracking
        this.selectedCardIds = new Set();
    }

    /**
     * Toggles selection state for an individual card.
     */
    toggleCardSelection(cardId: string, checked: boolean): void {
        if (checked) {
            this.selectedCardIds.add(cardId);
        } else {
            this.selectedCardIds.delete(cardId);
        }
        this.updateBulkActionsBar();
        if (this.onUpdate) this.onUpdate();
    }

    /**
     * Toggles selection state for all tracked cards.
     */
    toggleSelectAll(checked: boolean): void {
        this.allCards.forEach(c => {
            if (c.id) {
                if (checked) this.selectedCardIds.add(c.id);
                else this.selectedCardIds.delete(c.id);
            }
        });
        this.updateBulkActionsBar();
        if (this.onUpdate) this.onUpdate();
    }

    /**
     * Removes an individual card by ID with undo banner support.
     */
    deleteCard(cardId: string): void {
        const cardIndex = this.allCards.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return;

        const deletedCard = this.allCards[cardIndex];
        const problemTitle = deletedCard.problemTitle || 'Card';

        this.allCards.splice(cardIndex, 1);
        this.selectedCardIds.delete(cardId);
        this.updateBulkActionsBar();
        this.filterAndRender();

        chrome.storage.local.set({ fsrsCards: this.allCards });

        this.showUndoToast(`Deleted "${problemTitle}"`, () => {
            this.allCards.splice(cardIndex, 0, deletedCard);
            chrome.storage.local.set({ fsrsCards: this.allCards });
            this.populateTagsFilter();
            this.populatePlatformFilter();
            this.filterAndRender();
        });
    }

    /**
     * Bootstraps dashboard parameters from URL search parameters, retrieves cards and
     * settings from Chrome storage, populates filter dropdowns, and triggers the initial table render.
     * @fires chrome.storage.local.get
     */
    init(): void {
        try {
            const root = document.getElementById('root');
            if (root) {
                render(<DataApp dashboard={this} />, root);
                return;
            }

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

            chrome.storage.local.get(['fsrsCards', 'extensionSettings'], (result: StorageData) => {
                try {
                    if (chrome.runtime?.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('DataDashboard', `Storage error in init: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    this.allCards = ensureCardIds(result.fsrsCards || []);
                    this.extensionSettings = (result.extensionSettings || {}) as UserSettings & { showCharts?: boolean };

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
                    UIUtils.catchError('DataDashboard', 'Error rendering data dashboard', innerErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Failed storage get in DataDashboard init', err);
        }
    }

    /**
     * Registers DOM event listeners for search input changes, filter select dropdowns,
     * sorting controls, clear filter buttons, bulk action buttons, and edit modal controls.
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
                        UIUtils.catchError('DataDashboard', 'Error in search input handler', err);
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
                        UIUtils.catchError('DataDashboard', 'Error in tag select handler', err);
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
                        UIUtils.catchError('DataDashboard', 'Error in status select handler', err);
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
                        UIUtils.catchError('DataDashboard', 'Error in platform select handler', err);
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
                        UIUtils.catchError('DataDashboard', 'Error in state select handler', err);
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
                        UIUtils.catchError('DataDashboard', 'Error in sort select handler', err);
                    }
                });
            }

            const clearBtn = document.getElementById('clear-filters-btn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => {
                    try {
                        this.resetFilters();
                    } catch (err) {
                        UIUtils.catchError('DataDashboard', 'Error clearing filters', err);
                    }
                });
            }

            const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
            if (bulkDeleteBtn) {
                bulkDeleteBtn.addEventListener('click', () => {
                    try {
                        this.bulkDelete();
                    } catch (err) {
                        UIUtils.catchError('DataDashboard', 'Error in bulk delete click handler', err);
                    }
                });
            }

            const bulkRetagBtn = document.getElementById('bulk-retag-btn');
            if (bulkRetagBtn) {
                bulkRetagBtn.addEventListener('click', () => {
                    try {
                        this.bulkRetag();
                    } catch (err) {
                        UIUtils.catchError('DataDashboard', 'Error in bulk retag click handler', err);
                    }
                });
            }

            const bulkRescheduleBtn = document.getElementById('bulk-reschedule-btn');
            if (bulkRescheduleBtn) {
                bulkRescheduleBtn.addEventListener('click', () => {
                    try {
                        this.bulkReschedule();
                    } catch (err) {
                        UIUtils.catchError('DataDashboard', 'Error in bulk reschedule click handler', err);
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
                        UIUtils.catchError('DataDashboard', 'Error deselecting bulk cards', err);
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
            UIUtils.catchError('DataDashboard', 'Error binding dashboard events', err);
        }
    }

    /**
     * Inspects the cached `allCards` collection and dynamically populates unique tags into the `#tag-select` dropdown.
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
            UIUtils.catchError('DataDashboard', 'Error populating tags filter', err);
        }
    }

    /**
     * Extracts platform hostnames across all cards and populates the `#platform-select` dropdown.
     */
    populatePlatformFilter(): void {
        try {
            const platformSelect = document.getElementById('platform-select');
            if (!platformSelect) return;

            platformSelect.innerHTML = '<option value="all">All Platforms</option>';

            const platforms = new Set<string>();
            this.allCards.forEach((card: Card) => {
                const platform = this.extractPlatform(card.problemUrl);
                if (platform) platforms.add(platform);
            });

            [...platforms].sort().forEach(platform => {
                const option = document.createElement('option');
                option.value = platform;
                option.textContent = PLATFORM_NAMES[platform] || platform;
                platformSelect.appendChild(option);
            });
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error populating platform filter', err);
        }
    }

    /**
     * Extracts and normalizes the primary domain name (e.g. "leetcode.com") from a full URL.
     * @param url - Page URL to inspect.
     * @returns Normalized domain string or null if unparseable.
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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.debug('DataDashboard', `Return null on invalid URL parsing: ${errorMessage}`, { url, err });
            return null;
        }
    }

    /**
     * Converts an FSRS numeric state code into a human-readable display label.
     * @param state - Numeric State enum value (0=New, 1=Learning, 2=Review, 3=Relearning).
     * @returns Human-readable state name.
     */
    getStateLabel(state: number): string {
        try {
            const labels: Record<number, string> = { 0: 'New', 1: 'Learning', 2: 'Review', 3: 'Relearning' };
            return labels[state] || 'Unknown';
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.debug('DataDashboard', `Error getting state label for state ${state}: ${errorMessage}`, { state, err });
            return 'Unknown';
        }
    }

    /**
     * Filters the full collection of cards based on search query, active tags, review due status,
     * target platform, and FSRS state, applies the selected sort order, and updates DOM tables and analytics.
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
                    const monthNames = MONTH_NAMES;
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
                const emptyClearBtn = document.getElementById('empty-clear-filters-btn');
                if (emptyClearBtn) {
                    emptyClearBtn.addEventListener('click', () => {
                        this.resetFilters();
                    });
                }
            }

            this.bindCheckboxes();
            this.bindDeleteButtons();
            this.bindEditButtons();

            if (this.onUpdate) {
                this.onUpdate();
            }
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error in filterAndRender', err);
        }
    }

    /**
     * Resets all search queries and filter dropdown values to their default states ('all' / 'due-asc')
     * and triggers a re-render.
     */
    resetFilters(): void {
        this.searchQuery = '';
        this.selectedTag = 'all';
        this.selectedStatus = 'all';
        this.selectedPlatform = 'all';
        this.selectedState = 'all';
        this.sortBy = 'due-asc';

        const searchInput = document.getElementById('search-input') as HTMLInputElement | null;
        const tagSelect = document.getElementById('tag-select') as HTMLSelectElement | null;
        const statusSelect = document.getElementById('status-select') as HTMLSelectElement | null;
        const platformSelect = document.getElementById('platform-select') as HTMLSelectElement | null;
        const stateSelect = document.getElementById('state-select') as HTMLSelectElement | null;
        const sortSelect = document.getElementById('sort-select') as HTMLSelectElement | null;

        if (searchInput) searchInput.value = '';
        if (tagSelect) tagSelect.value = 'all';
        if (statusSelect) statusSelect.value = 'all';
        if (platformSelect) platformSelect.value = 'all';
        if (stateSelect) stateSelect.value = 'all';
        if (sortSelect) sortSelect.value = 'due-asc';

        this.filterAndRender();
    }

    /**
     * Generates responsive HTML markup for the problem cards table, including selection checkboxes,
     * status badges, stability and difficulty indicators, leech flags, and action buttons.
     * @param cardsArray - Filtered and sorted cards to display.
     * @param showLapses - Whether to render the lapses column.
     * @returns HTML string of the cards table.
     */
    generateCardsTable(cardsArray: Card[], showLapses: boolean = true): string {
        try {
            if (!Array.isArray(cardsArray)) {
                throw new Error('Invalid cards array provided');
            }

            if (cardsArray.length === 0) {
                const isFilterActive = this.searchQuery !== '' || this.selectedTag !== 'all' || this.selectedStatus !== 'all' || this.selectedPlatform !== 'all' || this.selectedState !== 'all';
                const message = isFilterActive 
                    ? 'No problem patterns match your selected filters.' 
                    : 'No problem patterns tracked yet. Solve problems on LeetCode or AlgoMonster to build your spaced repetition deck!';
                const actionButton = isFilterActive 
                    ? `<button id="empty-clear-filters-btn" class="btn btn-secondary" style="margin-top: 12px; cursor: pointer;">Clear Filters</button>` 
                    : '';
                return `
                    <div class="empty-state-card" style="text-align: center; padding: 48px 24px; background: var(--md-surface); border: 1px dashed var(--md-border); border-radius: 12px; margin: 20px 0;">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width: 48px; height: 48px; stroke: var(--md-text-subtle); margin-bottom: 12px;" aria-hidden="true">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <h4 style="margin: 0 0 8px 0; color: var(--md-text-high); font-size: 16px;">${isFilterActive ? 'No Matching Patterns' : 'No Patterns Found'}</h4>
                        <p style="margin: 0; color: var(--md-text-med); font-size: 13px; max-width: 400px; margin: 0 auto;">${message}</p>
                        ${actionButton}
                    </div>
                `;
            }

            const now = new Date().getTime();
            const allChecked = cardsArray.length > 0 && cardsArray.every((c: Card) => Boolean(c.id && this.selectedCardIds.has(c.id)));

            let table = `<div class="table-responsive"><table><thead><tr>
                <th class="th-checkbox"><input type="checkbox" id="select-all-checkbox" class="card-checkbox" ${allChecked ? 'checked' : ''}></th>
                <th>Problem Title</th>
                <th class="th-tags">Tags</th>
                <th>Next Due</th>
                <th>State</th>
                <th class="th-reviews">Reviews</th>
                <th>Stability</th>
                <th>Difficulty</th>
                ${showLapses ? '<th class="th-lapses">Lapses</th>' : ''}
                <th class="th-actions">Actions</th>
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
                    <td style="white-space: normal; word-wrap: break-word; max-width: 220px;"><a href="${card.problemUrl || '#'}" target="_blank">${card.problemTitle || 'Untitled'}</a></td>
                    <td class="td-tags" style="white-space: normal; word-wrap: break-word; max-width: 140px;">${tagsHtml}</td>
                    <td>${statusBadge}</td>
                    <td><span class="badge badge-state ${stateClass}">${stateLabel}${isLeech ? ' (Leech)' : ''}</span></td>
                    <td class="td-reviews">${reps}</td>
                    <td>${stabilityFormatted}</td>
                    <td>${difficultyFormatted}</td>
                    ${showLapses ? `<td class="td-lapses">${lapsesBadge}</td>` : ''}
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
            UIUtils.catchError('DataDashboard', 'Error generating cards table', err);
            return '<div class="empty-state">Error loading table</div>';
        }
    }

    /**
     * Sorts an array of cards based on the currently selected sort option (`sortBy`).
     * Supports sorting by due date, difficulty, stability, lapses, and creation date.
     * @param cards - Cards array to sort.
     * @returns A sorted shallow copy of the cards array.
     */
    sortCards(cards: Card[]): Card[] {
        try {
            const sorted = [...cards];
            switch (this.sortBy) {
                case 'due-asc':
                    return sorted.sort((a, b) => a.due - b.due);
                case 'due-desc':
                    return sorted.sort((a, b) => b.due - a.due);
                case 'difficulty-desc':
                    return sorted.sort((a, b) => (b.difficulty || 0) - (a.difficulty || 0));
                case 'difficulty-asc':
                    return sorted.sort((a, b) => (a.difficulty || 0) - (b.difficulty || 0));
                case 'stability-desc':
                    return sorted.sort((a, b) => (b.stability || 0) - (a.stability || 0));
                case 'stability-asc':
                    return sorted.sort((a, b) => (a.stability || 0) - (b.stability || 0));
                case 'lapses-desc':
                    return sorted.sort((a, b) => (b.lapses || 0) - (a.lapses || 0));
                case 'created-desc':
                    return sorted.sort((a, b) => {
                        const aCreated = a.createdAt || (a.historyLog && a.historyLog[0] && (typeof a.historyLog[0] === 'object' ? a.historyLog[0].date : a.historyLog[0])) || 0;
                        const bCreated = b.createdAt || (b.historyLog && b.historyLog[0] && (typeof b.historyLog[0] === 'object' ? b.historyLog[0].date : b.historyLog[0])) || 0;
                        return (bCreated as number) - (aCreated as number);
                    });
                default:
                    return sorted;
            }
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error sorting cards', err);
            return cards;
        }
    }

    /**
     * Displays a temporary toast notification with an Undo button for soft-deleting cards.
     * Automatically dismisses after 5 seconds if not clicked.
     * @param message - Text to show in the toast.
     * @param onUndo - Callback executed if the user clicks Undo.
     */
    showUndoToast(message: string, onUndo: () => void): void {
        try {
            const toast = document.getElementById('undo-toast');
            const textEl = document.getElementById('undo-toast-text');
            const undoBtn = document.getElementById('undo-action-btn');

            if (!toast || !textEl || !undoBtn) return;

            if (this.undoTimer) {
                clearTimeout(this.undoTimer);
                this.undoTimer = null;
            }

            textEl.textContent = message;
            toast.style.display = 'flex';

            const newUndoBtn = undoBtn.cloneNode(true) as HTMLElement;
            undoBtn.parentNode?.replaceChild(newUndoBtn, undoBtn);

            newUndoBtn.addEventListener('click', () => {
                try {
                    onUndo();
                    toast.style.display = 'none';
                    if (this.undoTimer) {
                        clearTimeout(this.undoTimer);
                        this.undoTimer = null;
                    }
                } catch (err) {
                    UIUtils.catchError('DataDashboard', 'Error in undo click handler', err);
                }
            });

            this.undoTimer = setTimeout(() => {
                try {
                    toast.style.display = 'none';
                    this.undoTimer = null;
                } catch (err) {
                    UIUtils.catchError('DataDashboard', 'Error dismissing undo toast', err);
                }
            }, 5000);
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error displaying undo toast', err);
        }
    }

    /**
     * Attaches click handlers to all inline card deletion buttons in the table.
     * Removes the card from local state and storage, and shows an undo toast.
     */
    bindDeleteButtons(): void {
        try {
            document.querySelectorAll('.delete-card-btn').forEach(btn => {
                btn.addEventListener('click', (e: Event) => {
                    try {
                        const target = e.currentTarget as HTMLElement;
                        const cardId = target.getAttribute('data-id');
                        if (!cardId) return;

                        const cardIndex = this.allCards.findIndex(c => c.id === cardId);
                        if (cardIndex === -1) return;

                        const deletedCard = this.allCards[cardIndex];
                        const problemTitle = deletedCard.problemTitle || 'Card';

                        this.allCards.splice(cardIndex, 1);
                        this.selectedCardIds.delete(cardId);
                        this.updateBulkActionsBar();
                        this.filterAndRender();

                        chrome.storage.local.set({ fsrsCards: this.allCards });

                        this.showUndoToast(`Deleted "${problemTitle}"`, () => {
                            this.allCards.splice(cardIndex, 0, deletedCard);
                            chrome.storage.local.set({ fsrsCards: this.allCards });
                            this.populateTagsFilter();
                            this.populatePlatformFilter();
                            this.filterAndRender();
                        });
                    } catch (err) {
                        UIUtils.catchError('DataDashboard', 'Error deleting single card', err);
                    }
                });
            });
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error binding delete buttons', err);
        }
    }

    /**
     * Binds event listeners to the select-all master checkbox and individual row checkboxes.
     * Synchronizes selection state with `selectedCardIds` and updates the bulk action bar.
     */
    bindCheckboxes(): void {
        try {
            const selectAll = document.getElementById('select-all-checkbox') as HTMLInputElement | null;
            if (selectAll) {
                selectAll.addEventListener('change', () => {
                    try {
                        const isChecked = selectAll.checked;
                        const rowCheckboxes = document.querySelectorAll('.row-checkbox') as NodeListOf<HTMLInputElement>;
                        rowCheckboxes.forEach(cb => {
                            cb.checked = isChecked;
                            const id = cb.getAttribute('data-id');
                            if (id) {
                                if (isChecked) {
                                    this.selectedCardIds.add(id);
                                } else {
                                    this.selectedCardIds.delete(id);
                                }
                            }
                            const row = cb.closest('tr');
                            if (row) {
                                row.classList.toggle('row-selected', isChecked);
                            }
                        });
                        this.updateBulkActionsBar();
                    } catch (err) {
                        UIUtils.catchError('DataDashboard', 'Error in select-all change handler', err);
                    }
                });
            }

            document.querySelectorAll('.row-checkbox').forEach(cb => {
                cb.addEventListener('change', (e: Event) => {
                    try {
                        const target = e.currentTarget as HTMLInputElement;
                        const id = target.getAttribute('data-id');
                        const row = target.closest('tr');

                        if (id) {
                            if (target.checked) {
                                this.selectedCardIds.add(id);
                            } else {
                                this.selectedCardIds.delete(id);
                            }
                        }

                        if (row) {
                            row.classList.toggle('row-selected', target.checked);
                        }

                        if (selectAll) {
                            const allRows = document.querySelectorAll('.row-checkbox') as NodeListOf<HTMLInputElement>;
                            selectAll.checked = allRows.length > 0 && Array.from(allRows).every(r => r.checked);
                        }

                        this.updateBulkActionsBar();
                    } catch (err) {
                        UIUtils.catchError('DataDashboard', 'Error in row checkbox change handler', err);
                    }
                });
            });
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error binding checkboxes', err);
        }
    }

    /**
     * Updates visibility and count display on the floating bulk actions toolbar.
     */
    updateBulkActionsBar(): void {
        try {
            const bar = document.getElementById('bulk-actions-bar');
            const countEl = document.getElementById('bulk-count');
            const count = this.selectedCardIds.size;

            if (bar && countEl) {
                countEl.textContent = String(count);
                bar.style.display = count > 0 ? 'flex' : 'none';
            }
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error updating bulk actions bar', err);
        }
    }

    /**
     * Prompts confirmation and deletes all currently selected cards from memory and storage.
     * Displays an undo toast allowing bulk restoration.
     */
    bulkDelete(): void {
        try {
            const count = this.selectedCardIds.size;
            if (count === 0) return;

            if (!confirm(`Are you sure you want to delete ${count} selected card(s)?`)) return;

            const deletedCards: { card: Card; originalIndex: number }[] = [];
            this.allCards.forEach((c, idx) => {
                if (c.id && this.selectedCardIds.has(c.id)) {
                    deletedCards.push({ card: c, originalIndex: idx });
                }
            });

            this.allCards = this.allCards.filter(c => !c.id || !this.selectedCardIds.has(c.id));
            this.selectedCardIds.clear();
            this.updateBulkActionsBar();
            this.filterAndRender();

            chrome.storage.local.set({ fsrsCards: this.allCards });

            this.showUndoToast(`Deleted ${count} card(s)`, () => {
                deletedCards.sort((a, b) => a.originalIndex - b.originalIndex);
                deletedCards.forEach(({ card, originalIndex }) => {
                    this.allCards.splice(originalIndex, 0, card);
                });
                chrome.storage.local.set({ fsrsCards: this.allCards });
                this.populateTagsFilter();
                this.populatePlatformFilter();
                this.filterAndRender();
            });
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error during bulk delete', err);
        }
    }

    /**
     * Prompts the user for comma-separated tags and appends them to all selected cards.
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
                    UIUtils.catchError('DataDashboard', 'Error in bulk retag callback', callbackErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error during bulk retag', err);
        }
    }

    /**
     * Reschedules all selected cards to be due now upon confirmation.
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
                        UIUtils.catchError('DataDashboard', 'Error in bulk reschedule callback', callbackErr);
                    }
                });
            }
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error in bulkReschedule', err);
        }
    }

    /**
     * Attaches click handlers to inline card edit buttons.
     */
    bindEditButtons(): void {
        try {
            document.querySelectorAll('.edit-card-btn').forEach(btn => {
                btn.addEventListener('click', (e: Event) => {
                    try {
                        const target = e.currentTarget as HTMLElement;
                        const cardId = target.getAttribute('data-id');
                        if (cardId) {
                            this.openEditModal(cardId);
                        }
                    } catch (err) {
                        UIUtils.catchError('DataDashboard', 'Error opening edit modal for card', err);
                    }
                });
            });
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error binding edit buttons', err);
        }
    }

    /**
     * Collects all unique tag strings present across the entire card database.
     * @returns Sorted array of unique tag names.
     */
    getDatabaseTags(): string[] {
        try {
            const tags = new Set<string>();
            this.allCards.forEach(c => {
                if (c.tags && Array.isArray(c.tags)) {
                    c.tags.forEach(t => tags.add(t));
                }
            });
            return Array.from(tags).sort();
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error getting database tags', err);
            return [];
        }
    }

    /**
     * Opens the inline card editor modal populated with the target card's data.
     * @param cardId - Unique identifier of the card to edit.
     */
    openEditModal(cardId: string): void {
        try {
            const card = this.allCards.find(c => c.id === cardId);
            if (!card) return;

            const overlay = document.getElementById('inline-edit-overlay');
            const idInput = document.getElementById('edit-card-id') as HTMLInputElement | null;
            const titleInput = document.getElementById('edit-title') as HTMLInputElement | null;
            const tagsInput = document.getElementById('edit-tags') as HTMLInputElement | null;
            const approachInput = document.getElementById('edit-approach') as HTMLTextAreaElement | null;
            const tcInput = document.getElementById('edit-time-complexity') as HTMLInputElement | null;
            const scInput = document.getElementById('edit-space-complexity') as HTMLInputElement | null;

            if (idInput) idInput.value = card.id || '';
            if (titleInput) titleInput.value = card.problemTitle || '';
            if (tagsInput) tagsInput.value = (card.tags || []).join(', ');
            if (approachInput) approachInput.value = card.approach || '';
            if (tcInput) tcInput.value = card.timeComplexity || '';
            if (scInput) scInput.value = card.spaceComplexity || '';

            if (overlay) overlay.style.display = 'flex';
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error opening edit modal', err);
        }
    }

    /**
     * Closes and hides the inline card editor modal overlay.
     */
    closeEditModal(): void {
        try {
            const overlay = document.getElementById('inline-edit-overlay');
            if (overlay) overlay.style.display = 'none';
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error closing edit modal', err);
        }
    }

    /**
     * Saves user modifications made in the inline editor modal back to the in-memory card and storage.
     */
    saveCardEdit(): void {
        try {
            const idInput = document.getElementById('edit-card-id') as HTMLInputElement | null;
            const titleInput = document.getElementById('edit-title') as HTMLInputElement | null;
            const tagsInput = document.getElementById('edit-tags') as HTMLInputElement | null;
            const approachInput = document.getElementById('edit-approach') as HTMLTextAreaElement | null;
            const tcInput = document.getElementById('edit-time-complexity') as HTMLInputElement | null;
            const scInput = document.getElementById('edit-space-complexity') as HTMLInputElement | null;

            const cardId = idInput?.value;
            if (!cardId) return;

            const card = this.allCards.find(c => c.id === cardId);
            if (!card) return;

            if (titleInput) card.problemTitle = titleInput.value.trim() || card.problemTitle;
            if (tagsInput) {
                card.tags = tagsInput.value.split(',')
                    .map(t => t.trim().toLowerCase())
                    .filter(t => t.length > 0);
            }
            if (approachInput) card.approach = approachInput.value;
            if (tcInput) card.timeComplexity = tcInput.value.trim();
            if (scInput) card.spaceComplexity = scInput.value.trim();

            chrome.storage.local.set({ fsrsCards: this.allCards }, () => {
                this.closeEditModal();
                this.populateTagsFilter();
                this.populatePlatformFilter();
                this.filterAndRender();
            });
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error saving card edit', err);
        }
    }

    /**
     * Computes memory retention statistics, FSRS state distributions, and top tags,
     * and renders visual distribution meters in the collapsible `#analytics-panel`.
     * @param cards - Collection of cards to summarize.
     */
    renderAnalyticsPanel(cards: Card[]): void {
        try {
            const panel = document.getElementById('analytics-panel');
            if (!panel) return;

            const total = cards.length;
            if (total === 0) {
                panel.innerHTML = '<p class="analytics-empty">Add cards to view retention metrics.</p>';
                return;
            }

            panel.innerHTML = '';

            const states = { New: 0, Learning: 0, Review: 0, Relearning: 0 };
            const tagCounts: Record<string, number> = {};

            cards.forEach(c => {
                const state = c.state || 0;
                if (state === 0) states.New++;
                else if (state === 1) states.Learning++;
                else if (state === 2) states.Review++;
                else if (state === 3) states.Relearning++;

                (c.tags || []).forEach(t => {
                    tagCounts[t] = (tagCounts[t] || 0) + 1;
                });
            });

            const stateCard = document.createElement('div');
            stateCard.className = 'analytics-card';
            stateCard.innerHTML = `
                <h3 class="analytics-card-title">FSRS Memory State Distribution</h3>
                <div class="distribution-bars">
                    <div class="dist-row">
                        <span class="dist-label">Review (Mature)</span>
                        <div class="dist-track"><div class="dist-fill fill-review" style="width: ${(states.Review / total * 100).toFixed(1)}%;"></div></div>
                        <span class="dist-val">${states.Review}</span>
                    </div>
                    <div class="dist-row">
                        <span class="dist-label">Learning</span>
                        <div class="dist-track"><div class="dist-fill fill-learning" style="width: ${(states.Learning / total * 100).toFixed(1)}%;"></div></div>
                        <span class="dist-val">${states.Learning}</span>
                    </div>
                    <div class="dist-row">
                        <span class="dist-label">Relearning (Lapsed)</span>
                        <div class="dist-track"><div class="dist-fill fill-relearning" style="width: ${(states.Relearning / total * 100).toFixed(1)}%;"></div></div>
                        <span class="dist-val">${states.Relearning}</span>
                    </div>
                    <div class="dist-row">
                        <span class="dist-label">New</span>
                        <div class="dist-track"><div class="dist-fill fill-new" style="width: ${(states.New / total * 100).toFixed(1)}%;"></div></div>
                        <span class="dist-val">${states.New}</span>
                    </div>
                </div>
            `;

            const tagsCard = document.createElement('div');
            tagsCard.className = 'analytics-card';

            const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
            let tagsHtml = '';

            if (sortedTags.length === 0) {
                tagsHtml = '<p class="text-subtle" style="font-size:12px; margin:0;">No tags assigned yet.</p>';
            } else {
                tagsHtml = '<div class="distribution-bars">';
                sortedTags.forEach(([tag, count]) => {
                    const pct = (count / total * 100).toFixed(1);
                    tagsHtml += `
                        <div class="dist-row">
                            <span class="dist-label">${tag}</span>
                            <div class="dist-track"><div class="dist-fill fill-tag" style="width: ${pct}%;"></div></div>
                            <span class="dist-val">${count}</span>
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
            UIUtils.catchError('DataDashboard', 'Error rendering analytics panel', err);
        }
    }
}

/**
 * Bootstrap entry function creating and initializing the data dashboard instance on DOM readiness.
 */
export function initDataDashboard(): void {
    try {
        const dashboard = new FSRSDataDashboard();
        dashboard.init();
    } catch (err) {
        UIUtils.catchError('DataDashboard', 'Error instantiating FSRSDataDashboard', err);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initDataDashboard);
    } else {
        initDataDashboard();
    }
}

// Augment CommonJS exports to preserve backward compatibility for tests and callers
if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).FSRSDataDashboard = FSRSDataDashboard;
    (module.exports as any).CardsTable = CardsTable;
    (module.exports as any).CardsTableRow = CardsTableRow;
    (module.exports as any).CardsTableEmptyState = CardsTableEmptyState;
    (module.exports as any).BulkActionsBar = BulkActionsBar;
}
