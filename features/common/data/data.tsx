import { h, Fragment, render, VNode } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Logger } from '@common/logger';
import { UIUtils } from '../utils/uiUtils';
import { ensureCardIds } from '../utils/cardUtils';
import { Card, StorageData, UserSettings, TagEntry } from '../../../types/domain';
import { TagRegistry } from '../tags/tagRegistry';
import { TagInput } from '../utils/tagInput';
import { MultiSelect, MultiSelectOption } from '../ui/components/MultiSelect';
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

/**
 * Props for the CardsTableEmptyState component.
 */
export interface CardsTableEmptyStateProps {
    /** Whether search query or filter tags are actively applied */
    isFilterActive: boolean;
    /** Optional callback to reset all active filters */
    onClearFilters?: () => void;
}

/**
 * Preact component for the empty state placeholder when no cards match filters.
 *
 * @param props - Filter status flag and reset callback.
 * @returns VNode rendered placeholder card.
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

/**
 * Props for the DataAnalyticsPanel component.
 */
export interface DataAnalyticsPanelProps {
    /** Collection of cards to compute analytics for */
    cards: Card[];
    /** Canonical tag registry for hydrating UUIDs to display names */
    tagRegistry?: TagEntry[];
}

/**
 * Preact component rendering analytical overview charts above the table,
 * including card state breakdowns (New, Learning, Review, Lapsed) and top tag frequency distribution bars.
 * Purely declarative with zero imperative DOM manipulation.
 *
 * @param props - Card collection.
 * @returns VNode rendered analytics grid.
 */
export function DataAnalyticsPanel({ cards, tagRegistry = [] }: DataAnalyticsPanelProps): VNode {
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
    const newPct = total > 0 ? Math.round((newCount / total) * 100) : 0;
    const learningPct = total > 0 ? Math.round((learningCount / total) * 100) : 0;
    const reviewPct = total > 0 ? Math.round((reviewCount / total) * 100) : 0;
    const lapsedPct = total > 0 ? Math.round((lapsedCount / total) * 100) : 0;

    const tagCounts: Record<string, number> = {};
    cards.forEach((c: Card) => {
        if (c.tags && Array.isArray(c.tags)) {
            const hydrated = tagRegistry.length > 0 ? TagRegistry.hydrate(c.tags, tagRegistry) : c.tags;
            hydrated.forEach((t: string) => {
                tagCounts[t] = (tagCounts[t] || 0) + 1;
            });
        }
    });

    const sortedTags = Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

    const maxTagCount = sortedTags.length > 0 ? sortedTags[0][1] : 1;

    return (
        <div id="analytics-panel" className="analytics-grid" style={{ marginBottom: '24px' }}>
            <div className="analytics-card">
                <h3 className="analytics-card-title">Card States Breakdown</h3>
                <div className="stacked-bar">
                    {newCount > 0 && (
                        <div
                            className="bar-segment seg-new"
                            style={{ width: `${newPct}%` }}
                            title={`New: ${newCount} cards (${newPct}%)`}
                        />
                    )}
                    {learningCount > 0 && (
                        <div
                            className="bar-segment seg-learning"
                            style={{ width: `${learningPct}%` }}
                            title={`Learning: ${learningCount} cards (${learningPct}%)`}
                        />
                    )}
                    {reviewCount > 0 && (
                        <div
                            className="bar-segment seg-review"
                            style={{ width: `${reviewPct}%` }}
                            title={`Review: ${reviewCount} cards (${reviewPct}%)`}
                        />
                    )}
                    {lapsedCount > 0 && (
                        <div
                            className="bar-segment seg-lapsed"
                            style={{ width: `${lapsedPct}%` }}
                            title={`Lapsed: ${lapsedCount} cards (${lapsedPct}%)`}
                        />
                    )}
                </div>
                <div className="analytics-legend">
                    <div className="legend-item">
                        <span className="legend-dot dot-new" /> New: <strong>{newCount}</strong>{' '}
                        <span className="legend-pct">({newPct}%)</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot dot-learning" /> Learning: <strong>{learningCount}</strong>{' '}
                        <span className="legend-pct">({learningPct}%)</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot dot-review" /> Review: <strong>{reviewCount}</strong>{' '}
                        <span className="legend-pct">({reviewPct}%)</span>
                    </div>
                    <div className="legend-item">
                        <span className="legend-dot dot-lapsed" /> Lapsed: <strong>{lapsedCount}</strong>{' '}
                        <span className="legend-pct">({lapsedPct}%)</span>
                    </div>
                </div>
            </div>

            <div className="analytics-card">
                <h3 className="analytics-card-title">Top Tag Distribution</h3>
                {sortedTags.length === 0 ? (
                    <div className="empty-analytics-msg">No tags added yet.</div>
                ) : (
                    <div className="tags-bars-container">
                        {sortedTags.map(([tag, count]) => {
                            const pct = Math.round((count / maxTagCount) * 100);
                            return (
                                <div key={tag} className="tag-bar-row">
                                    <span className="tag-bar-name" title={tag}>{tag}</span>
                                    <div className="tag-bar-track">
                                        <div className="tag-bar-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className="tag-bar-value">{count}</span>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Props for the CardsTableRow component.
 */
export interface CardsTableRowProps {
    /** Problem card domain entity */
    card: Card;
    /** Whether this row's selection checkbox is checked */
    isChecked: boolean;
    /** Whether the lapses count column is displayed */
    showLapses?: boolean;
    /** Human-readable FSRS state badge text (e.g., "New", "Learning", "Review") */
    stateLabel: string;
    /** Canonical tag registry for hydrating UUIDs */
    tagRegistry?: TagEntry[];
    /** Callback when row checkbox is toggled */
    onToggleCheck?: (cardId: string, checked: boolean) => void;
    /** Callback to open problem edit modal */
    onEdit?: (cardId: string) => void;
    /** Callback to delete card */
    onDelete?: (cardId: string) => void;
}

/**
 * Preact component for an individual problem card table row.
 *
 * @param props - Card data, selection state, column visibility, and action handlers.
 * @returns VNode rendered table row element.
 */
export function CardsTableRow({
    card,
    isChecked,
    showLapses = true,
    stateLabel,
    tagRegistry = [],
    onToggleCheck,
    onEdit,
    onDelete
}: CardsTableRowProps): VNode {
    const now = Date.now();
    const cardDue = typeof card.due === 'number' ? card.due : new Date(card.due).getTime();
    const isPastDue = !isNaN(cardDue) && cardDue <= now;
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
                {(tagRegistry.length > 0 ? TagRegistry.hydrate(card.tags || [], tagRegistry) : (card.tags || [])).map((t, idx) => (
                    <span key={`${t}-${idx}`} className="tag">{t}</span>
                ))}
            </td>
            <td>
                {isPastDue ? (
                    <span className="badge badge-due">Due Now</span>
                ) : (
                    <span className="badge badge-safe">{!isNaN(cardDue) ? new Date(cardDue).toLocaleDateString() : 'N/A'}</span>
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

/**
 * Props for the CardsTable component.
 */
export interface CardsTableProps {
    /** Filtered array of problem cards to render in the table */
    cards: Card[];
    /** Set of currently selected card IDs */
    selectedCardIds: Set<string>;
    /** Whether the lapses count column is displayed */
    showLapses?: boolean;
    /** Whether search query or filter tags are actively applied */
    isFilterActive?: boolean;
    /** Formatter returning human-readable FSRS state name from state enum */
    getStateLabel: (state: number) => string;
    /** Canonical tag registry for hydrating UUIDs */
    tagRegistry?: TagEntry[];
    /** Callback when master select-all checkbox is toggled */
    onToggleSelectAll?: (checked: boolean) => void;
    /** Callback when an individual card checkbox is toggled */
    onToggleCard?: (cardId: string, checked: boolean) => void;
    /** Callback to open card edit modal */
    onEditCard?: (cardId: string) => void;
    /** Callback to delete card */
    onDeleteCard?: (cardId: string) => void;
    /** Callback to reset active filters */
    onClearFilters?: () => void;
}

/**
 * Preact component rendering the responsive problem patterns table.
 *
 * @param props - Table dataset, selection state, column formatters, and event handlers.
 * @returns VNode rendered responsive table or empty state placeholder.
 */
export function CardsTable({
    cards,
    selectedCardIds,
    showLapses = true,
    isFilterActive = false,
    getStateLabel,
    tagRegistry = [],
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
                            tagRegistry={tagRegistry}
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

/**
 * Props for the BulkActionsBar component.
 */
export interface BulkActionsBarProps {
    /** Number of currently checked problem cards */
    selectedCount: number;
    /** Callback to delete all selected cards */
    onDelete: () => void;
    /** Callback to prompt bulk re-tagging */
    onRetag: () => void;
    /** Callback to prompt bulk interval rescheduling */
    onReschedule: () => void;
    /** Callback to clear selection */
    onDeselect: () => void;
}

/**
 * Preact component for the floating multi-selection bulk actions bar.
 *
 * @param props - Selected counter and action handlers (delete, retag, reschedule, deselect).
 * @returns VNode rendered floating action toolbar.
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

/**
 * Props for the root DataApp component.
 */
export interface DataAppProps {
    /** Optional controller instance passed during testing or legacy integration */
    dashboard?: FSRSDataDashboard;
}

/**
 * Root Preact component governing the full Data Dashboard application.
 *
 * Manages database table view of tracked problem patterns, full-text search,
 * multi-dimensional filtering, column sorting, card modal editing, bulk operations,
 * and memory health statistics.
 *
 * @param props - Component configuration containing optional test dashboard.
 * @returns VNode rendered full page data dashboard.
 */
export function DataApp({ dashboard: initialDashboard }: DataAppProps): VNode {
    const [dashboard] = useState(() => initialDashboard || new FSRSDataDashboard());
    const [cards, setCards] = useState<Card[]>(() => dashboard.filterAndRender());
    const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(dashboard.selectedCardIds || new Set());
    const [searchQuery, setSearchQuery] = useState<string>(dashboard.searchQuery || '');
    const [selectedTags, setSelectedTags] = useState<string[]>(dashboard.selectedTags || []);
    const [selectedStatuses, setSelectedStatuses] = useState<string[]>(dashboard.selectedStatuses || []);
    const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(dashboard.selectedPlatforms || []);
    const [selectedStates, setSelectedStates] = useState<string[]>(dashboard.selectedStates || []);
    const [sortBy, setSortBy] = useState<string>(dashboard.sortBy || 'due-asc');
    const [view, setView] = useState<string>(dashboard.currentView || 'total');

    // Edit modal states
    const [editingCard, setEditingCard] = useState<Card | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [editTagsList, setEditTagsList] = useState<string[]>([]);
    const [editTimeComplexity, setEditTimeComplexity] = useState('');
    const [editSpaceComplexity, setEditSpaceComplexity] = useState('');
    const [editApproach, setEditApproach] = useState('');

    const [, setRenderTrigger] = useState(0);

    const forceUpdate = () => setRenderTrigger(c => c + 1);

    const openCardEdit = (card: Card) => {
        setEditingCard(card);
        setEditTitle(card.problemTitle || '');
        const hydrated = dashboard.tagRegistry.length > 0
            ? TagRegistry.hydrate(card.tags || [], dashboard.tagRegistry)
            : (card.tags || []);
        setEditTagsList(hydrated);
        setEditTimeComplexity(card.timeComplexity || '');
        setEditSpaceComplexity(card.spaceComplexity || '');
        setEditApproach(card.approach || '');
    };

    const handleCloseEdit = () => {
        setEditingCard(null);
        dashboard.closeEditModal();
    };

    const handleSaveEdit = () => {
        if (!editingCard) return;
        const resolvedTagIds = dashboard.resolveTagIds(editTagsList);
        const updates: Partial<Card> = {
            problemTitle: editTitle.trim() || editingCard.problemTitle,
            tags: resolvedTagIds,
            timeComplexity: editTimeComplexity.trim(),
            spaceComplexity: editSpaceComplexity.trim(),
            approach: editApproach
        };
        dashboard.saveCardEdit(editingCard.id, updates);
        setEditingCard(null);
        setCards(dashboard.filterAndRender());
        forceUpdate();
    };

    const refreshData = () => {
        if (typeof chrome === 'undefined' || !chrome.storage?.local) {
            setCards(dashboard.filterAndRender());
            return;
        }
        chrome.storage.local.get(['fsrsCards', 'tagRegistry', 'extensionSettings'], (result: StorageData) => {
            const loaded = ensureCardIds(result.fsrsCards || []);
            dashboard.allCards = loaded;
            dashboard.tagRegistry = Array.isArray(result.tagRegistry) ? result.tagRegistry : [];
            dashboard.extensionSettings = (result.extensionSettings || {}) as UserSettings & { showCharts?: boolean };
            setCards(dashboard.filterAndRender());
            forceUpdate();
        });
    };

    useEffect(() => {
        dashboard.onEditCard = (card: Card) => {
            openCardEdit(card);
        };
        dashboard.onCloseEditModal = () => {
            setEditingCard(null);
        };
        dashboard.onUpdate = () => {
            setCards(dashboard.filterAndRender());
            setSelectedCardIds(new Set(dashboard.selectedCardIds));
            setSearchQuery(dashboard.searchQuery);
            setSelectedTags([...dashboard.selectedTags]);
            setSelectedStatuses([...dashboard.selectedStatuses]);
            setSelectedPlatforms([...dashboard.selectedPlatforms]);
            setSelectedStates([...dashboard.selectedStates]);
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
            const parsedTags = urlTag.split(',').map(t => t.trim()).filter(Boolean);
            dashboard.selectedTags = parsedTags;
            setSelectedTags(parsedTags);
        }

        refreshData();
    }, [dashboard]);

    // Tag options from tagRegistry (or fallback to card.tags)
    const tagOptions: MultiSelectOption[] = (() => {
        if (dashboard.tagRegistry && dashboard.tagRegistry.length > 0) {
            return [...dashboard.tagRegistry]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((entry) => ({ value: entry.id, label: entry.name }));
        }
        const allTags = new Set<string>();
        dashboard.allCards.forEach(c => {
            (c.tags || []).forEach(t => allTags.add(t));
        });
        return Array.from(allTags).sort().map(t => ({ value: t, label: t }));
    })();

    // Unique platforms
    const allPlatforms = new Set<string>();
    dashboard.allCards.forEach(c => {
        const p = dashboard.extractPlatform(c.problemUrl);
        if (p) allPlatforms.add(p);
    });
    const platformOptions: MultiSelectOption[] = Array.from(allPlatforms)
        .sort()
        .map(p => ({ value: p, label: PLATFORM_NAMES[p] || p }));

    const statusOptions: MultiSelectOption[] = [
        { value: 'due', label: 'Due for Review' },
        { value: 'safe', label: 'Safe (Caught Up)' }
    ];

    const stateOptions: MultiSelectOption[] = [
        { value: '0', label: 'New' },
        { value: '1', label: 'Learning' },
        { value: '2', label: 'Review' },
        { value: '3', label: 'Relearning (Lapsed)' },
        { value: 'leech', label: '⚡ Leeches (3+ Lapses)' }
    ];

    const isFilterActive = searchQuery !== '' || selectedTags.length > 0 || selectedStatuses.length > 0 || selectedPlatforms.length > 0 || selectedStates.length > 0 || sortBy !== 'due-asc';

    // Title & subtitle
    let pageTitle = 'Total Saved Patterns';
    let pageSubtitle = `You have saved ${cards.length} algorithmic patterns.`;
    if (view === 'due') {
        pageTitle = dashboard.targetDate ? `Patterns Due on ${dashboard.targetDate}` : 'Patterns Due Today';
        pageSubtitle = isFilterActive
            ? `Showing ${cards.length} matching due pattern(s).`
            : `You have ${cards.length} pattern(s) awaiting review.`;
    } else if (view === 'retention') {
        pageTitle = 'Retention';
        pageSubtitle = 'Showing all patterns with at least 1 lapse.';
    } else if (view === 'forecast' && dashboard.targetDate) {
        pageTitle = `Cards Due — ${dashboard.targetDate}`;
        pageSubtitle = `Cards scheduled for review on ${dashboard.targetDate}.`;
    }

    const showCharts = dashboard.extensionSettings?.showCharts !== false;
    const shouldShowAnalytics = showCharts && cards.length > 0 && (view === 'total' || !view);

    const handleClearFilters = () => {
        dashboard.resetFilters();
        setSearchQuery('');
        setSelectedTags([]);
        setSelectedStatuses([]);
        setSelectedPlatforms([]);
        setSelectedStates([]);
        setSortBy('due-asc');
        setCards(dashboard.filterAndRender());
        forceUpdate();
    };

    const handleSearch = (val: string) => {
        setSearchQuery(val);
        dashboard.searchQuery = val;
        setCards(dashboard.filterAndRender());
        forceUpdate();
    };

    const handleTagChange = (vals: string[]) => {
        setSelectedTags(vals);
        dashboard.selectedTags = vals;
        setCards(dashboard.filterAndRender());
        forceUpdate();
    };

    const handleStatusChange = (vals: string[]) => {
        setSelectedStatuses(vals);
        dashboard.selectedStatuses = vals;
        setCards(dashboard.filterAndRender());
        forceUpdate();
    };

    const handlePlatformChange = (vals: string[]) => {
        setSelectedPlatforms(vals);
        dashboard.selectedPlatforms = vals;
        setCards(dashboard.filterAndRender());
        forceUpdate();
    };

    const handleStateChange = (vals: string[]) => {
        setSelectedStates(vals);
        dashboard.selectedStates = vals;
        setCards(dashboard.filterAndRender());
        forceUpdate();
    };

    const handleSortChange = (val: string) => {
        setSortBy(val);
        dashboard.sortBy = val;
        setCards(dashboard.filterAndRender());
        forceUpdate();
    };

    const handleToggleCard = (cardId: string, checked: boolean) => {
        dashboard.toggleCardSelection(cardId, checked);
        setSelectedCardIds(new Set(dashboard.selectedCardIds));
    };

    const handleToggleSelectAll = (checked: boolean) => {
        dashboard.toggleSelectAll(checked, cards);
        setSelectedCardIds(new Set(dashboard.selectedCardIds));
    };

    const handleEditCard = (cardId: string) => {
        const card = dashboard.allCards.find(c => c.id === cardId);
        if (card) {
            openCardEdit(card);
        }
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
                    <a href="../../common/tags/tags.html" className="btn btn-secondary" style={{ marginRight: '8px' }}>
                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ marginRight: '6px' }} aria-hidden="true">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                            <line x1="7" y1="7" x2="7.01" y2="7" />
                        </svg>
                        Manage Tags
                    </a>
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
            {shouldShowAnalytics ? (
                <DataAnalyticsPanel cards={cards} tagRegistry={dashboard.tagRegistry} />
            ) : (
                <div id="analytics-panel" className="analytics-grid" style={{ display: 'none', marginBottom: '24px' }} />
            )}

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
                        <MultiSelect
                            id="tag-select"
                            options={tagOptions}
                            selectedValues={selectedTags}
                            placeholder="All Tags"
                            searchPlaceholder="Search tags..."
                            ariaLabel="Filter by Tag"
                            onChange={handleTagChange}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="status-select">Status</label>
                        <MultiSelect
                            id="status-select"
                            options={statusOptions}
                            selectedValues={selectedStatuses}
                            placeholder="All Patterns"
                            searchPlaceholder="Search status..."
                            ariaLabel="Filter by Status"
                            onChange={handleStatusChange}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="platform-select">Platform</label>
                        <MultiSelect
                            id="platform-select"
                            options={platformOptions}
                            selectedValues={selectedPlatforms}
                            placeholder="All Platforms"
                            searchPlaceholder="Search platforms..."
                            ariaLabel="Filter by Platform"
                            onChange={handlePlatformChange}
                        />
                    </div>

                    <div className="filter-group">
                        <label htmlFor="state-select">FSRS State</label>
                        <MultiSelect
                            id="state-select"
                            options={stateOptions}
                            selectedValues={selectedStates}
                            placeholder="All States"
                            searchPlaceholder="Search states..."
                            ariaLabel="Filter by FSRS State"
                            onChange={handleStateChange}
                        />
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
                    tagRegistry={dashboard.tagRegistry}
                    onToggleSelectAll={handleToggleSelectAll}
                    onToggleCard={handleToggleCard}
                    onEditCard={handleEditCard}
                    onDeleteCard={handleDeleteCard}
                    onClearFilters={handleClearFilters}
                />
            </div>

            {/* Inline Edit Modal Overlay */}
            <div
                id="inline-edit-overlay"
                className="edit-overlay"
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-modal-title"
                style={{ display: editingCard ? 'flex' : 'none' }}
                onClick={(e) => {
                    if (e.target === e.currentTarget) handleCloseEdit();
                }}
                onKeyDown={(e: KeyboardEvent) => {
                    if (e.key === 'Escape') {
                        handleCloseEdit();
                    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        handleSaveEdit();
                    }
                }}
            >
                <div className="edit-modal">
                    <div className="edit-modal-header">
                        <div className="edit-modal-title-group">
                            <span className="edit-modal-icon" aria-hidden="true">
                                <svg className="svg-icon" viewBox="0 0 24 24">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                            </span>
                            <div>
                                <h3 id="edit-modal-title">Edit Pattern Card</h3>
                                <p className="edit-modal-subtitle">Update title, tags, complexities, and approach notes</p>
                            </div>
                        </div>
                        <button id="edit-close-btn" className="edit-close-btn" aria-label="Close edit modal" onClick={handleCloseEdit}>
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>
                    <div className="edit-modal-body">
                        <input type="hidden" id="edit-card-id" value={editingCard ? editingCard.id : ''} />
                        <div className="edit-field">
                            <label htmlFor="edit-title">Problem Title</label>
                            <input
                                type="text"
                                id="edit-title"
                                className="input-field"
                                placeholder="Problem title..."
                                value={editTitle}
                                onInput={(e) => setEditTitle((e.target as HTMLInputElement).value)}
                            />
                        </div>
                        <div className="edit-field">
                            <div className="edit-field-label-row">
                                <label htmlFor="edit-tags">Tags</label>
                                <span className="edit-field-hint">Enter, Tab, or comma to add</span>
                            </div>
                            <TagInput
                                tags={editTagsList}
                                onChange={setEditTagsList}
                                getSuggestions={() => dashboard.getDatabaseTags()}
                                placeholder="Type to search or create a tag..."
                            />
                        </div>
                        <div className="edit-field-row">
                            <div className="edit-field">
                                <label htmlFor="edit-time-complexity">Time Complexity</label>
                                <input
                                    type="text"
                                    id="edit-time-complexity"
                                    className="input-field"
                                    placeholder="O(n log n)"
                                    value={editTimeComplexity}
                                    onInput={(e) => setEditTimeComplexity((e.target as HTMLInputElement).value)}
                                />
                            </div>
                            <div className="edit-field">
                                <label htmlFor="edit-space-complexity">Space Complexity</label>
                                <input
                                    type="text"
                                    id="edit-space-complexity"
                                    className="input-field"
                                    placeholder="O(n)"
                                    value={editSpaceComplexity}
                                    onInput={(e) => setEditSpaceComplexity((e.target as HTMLInputElement).value)}
                                />
                            </div>
                        </div>
                        <div className="edit-field">
                            <label htmlFor="edit-approach">Approach Notes</label>
                            <textarea
                                id="edit-approach"
                                className="input-field edit-textarea"
                                rows={8}
                                placeholder="Your approach notes..."
                                value={editApproach}
                                onInput={(e) => setEditApproach((e.target as HTMLTextAreaElement).value)}
                            />
                        </div>
                    </div>
                    <div className="edit-modal-footer">
                        <span className="edit-modal-shortcut">Esc to cancel &middot; Ctrl/Cmd + Enter to save</span>
                        <div className="edit-modal-footer-actions">
                            <button id="edit-cancel-btn" className="btn btn-secondary" onClick={handleCloseEdit}>
                                Cancel
                            </button>
                            <button id="edit-save-btn" className="btn btn-primary" onClick={handleSaveEdit}>
                                Save Changes
                            </button>
                        </div>
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
    /** Canonical tag registry mapping stable UUIDs to display names */
    tagRegistry: TagEntry[];
    /** Current view mode ('total' | 'due' | 'retention') */
    currentView: string;
    /** Optional calendar date filter parameter ("YYYY-MM-DD") */
    targetDate: string | null;

    /** Active search query string */
    searchQuery: string;
    /** Currently selected tag filter identifiers */
    selectedTags: string[];
    /** Currently selected due status filters */
    selectedStatuses: string[];
    /** Currently selected platform/domain filters */
    selectedPlatforms: string[];
    /** Currently selected FSRS state filters */
    selectedStates: string[];
    /** Active sorting key (e.g. 'due-asc', 'difficulty-desc') */
    sortBy: string;
    /** User extension settings cached from storage */
    extensionSettings: UserSettings & { showCharts?: boolean };

    /** Set of selected card IDs for bulk actions */
    selectedCardIds: Set<string>;
    /** Currently active editing card identifier */
    editingCardId: string | null = null;
    /** Timer reference for auto-dismissing deletion undo toast */
    undoTimer: ReturnType<typeof setTimeout> | null;
    /** Observer callback notifying root component of state updates */
    onUpdate?: () => void;
    /** Observer callback notifying of card editing request */
    onEditCard?: (card: Card) => void;
    /** Observer callback notifying of card edit cancellation/close */
    onCloseEditModal?: () => void;

    /**
     * Initializes default filter selections, views, and bulk selection state.
     */
    constructor() {
        this.allCards = [];
        this.tagRegistry = [];
        this.undoTimer = null;

        if (typeof window !== 'undefined' && window.location?.search) {
            const urlParams = new URLSearchParams(window.location.search);
            this.currentView = urlParams.get('view') || 'total';
            this.targetDate = urlParams.get('date');
            this.searchQuery = urlParams.get('search') || urlParams.get('q') || urlParams.get('query') || '';
            const urlTag = urlParams.get('tag');
            this.selectedTags = urlTag ? urlTag.split(',').map(t => t.trim()).filter(Boolean) : [];
        } else {
            this.currentView = 'total';
            this.targetDate = null;
            this.searchQuery = '';
            this.selectedTags = [];
        }

        this.selectedStatuses = [];
        this.selectedPlatforms = [];
        this.selectedStates = [];
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
     * Toggles selection state for tracked cards (or specific subset of cards).
     */
    toggleSelectAll(checked: boolean, cardsToToggle?: Card[]): void {
        const targetCards = cardsToToggle || this.allCards;
        targetCards.forEach(c => {
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
            const urlParams = new URLSearchParams(window.location.search);
            this.currentView = urlParams.get('view') || 'total';
            this.targetDate = urlParams.get('date');

            const urlSearch = urlParams.get('search') || urlParams.get('q') || urlParams.get('query');
            if (urlSearch) {
                this.searchQuery = urlSearch;
            }

            const urlTag = urlParams.get('tag');
            if (urlTag) {
                this.selectedTags = urlTag.split(',').map(t => t.trim()).filter(Boolean);
            }

            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.get(['fsrsCards', 'tagRegistry', 'extensionSettings'], (result: StorageData) => {
                    if (chrome.runtime?.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('DataDashboard', `Storage error in init: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    this.allCards = ensureCardIds(result.fsrsCards || []);
                    this.tagRegistry = Array.isArray(result.tagRegistry) ? result.tagRegistry : [];
                    this.extensionSettings = (result.extensionSettings || {}) as UserSettings & { showCharts?: boolean };
                    this.filterAndRender();
                });
            }
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Failed storage get in DataDashboard init', err);
        }
    }

    /**
     * Headless event binder stub.
     */
    bindEvents(): void {}

    /**
     * Headless tags filter population stub.
     */
    populateTagsFilter(): void {}

    /**
     * Headless platform filter population stub.
     */
    populatePlatformFilter(): void {}

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
     * target platform, and FSRS state, applies the selected sort order, and notifies observers.
     */
    filterAndRender(): Card[] {
        try {
            const now = new Date().getTime();
            let baseCards: Card[] = [];

            if (this.currentView === 'total') {
                baseCards = [...this.allCards];
            }
            else if (this.currentView === 'due') {
                if (this.targetDate) {
                    const targetParts = this.targetDate.split('-');
                    const targetDayStart = new Date(parseInt(targetParts[0], 10), parseInt(targetParts[1], 10) - 1, parseInt(targetParts[2], 10)).getTime();
                    const targetDayEnd = targetDayStart + 86400000;
                    baseCards = this.allCards.filter((c: Card) => {
                        const due = typeof c.due === 'number' ? c.due : new Date(c.due).getTime();
                        return !isNaN(due) && due >= targetDayStart && due < targetDayEnd;
                    });
                } else {
                    baseCards = this.allCards.filter((c: Card) => {
                        const due = typeof c.due === 'number' ? c.due : new Date(c.due).getTime();
                        return !isNaN(due) && due <= now;
                    });
                }
                baseCards.sort((a: Card, b: Card) => {
                    const dueA = typeof a.due === 'number' ? a.due : new Date(a.due).getTime();
                    const dueB = typeof b.due === 'number' ? b.due : new Date(b.due).getTime();
                    return dueA - dueB;
                });
            }
            else if (this.currentView === 'retention') {
                baseCards = this.allCards.filter((c: Card) => (c.lapses || 0) > 0).sort((a: Card, b: Card) => (b.lapses || 0) - (a.lapses || 0));
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
            }

            let filtered = baseCards.filter((card: Card) => {
                const titleMatch = card.problemTitle && card.problemTitle.toLowerCase().includes(this.searchQuery.toLowerCase());
                const urlMatch = card.problemUrl && card.problemUrl.toLowerCase().includes(this.searchQuery.toLowerCase());
                const hydratedTagNames = this.tagRegistry.length > 0
                    ? TagRegistry.hydrate(card.tags || [], this.tagRegistry)
                    : (card.tags || []);
                const tagMatch = hydratedTagNames.some((t: string) => t.toLowerCase().includes(this.searchQuery.toLowerCase()));
                const approachMatch = card.approach && card.approach.toLowerCase().includes(this.searchQuery.toLowerCase());

                const matchesSearch = !this.searchQuery || titleMatch || urlMatch || tagMatch || approachMatch;
                const matchesTag = this.selectedTags.length === 0 || (card.tags && card.tags.some((t: string) => this.selectedTags.includes(t)));
                const cardDue = typeof card.due === 'number' ? card.due : new Date(card.due).getTime();
                const isCardDue = !isNaN(cardDue) && cardDue <= now;
                const matchesStatus = this.selectedStatuses.length === 0 ||
                    (this.selectedStatuses.includes('due') && isCardDue) ||
                    (this.selectedStatuses.includes('safe') && !isCardDue);

                const cardPlatform = this.extractPlatform(card.problemUrl);
                const matchesPlatform = this.selectedPlatforms.length === 0 || Boolean(cardPlatform && this.selectedPlatforms.includes(cardPlatform));

                let matchesState = true;
                if (this.selectedStates.length > 0) {
                    const isLeechSelected = this.selectedStates.includes('leech') && (card.lapses || 0) >= 3;
                    const isStateSelected = this.selectedStates.includes(String(card.state || 0));
                    matchesState = isLeechSelected || isStateSelected;
                }

                return matchesSearch && matchesTag && matchesStatus && matchesPlatform && matchesState;
            });

            const sorted = this.sortCards(filtered);

            return sorted;
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error in filterAndRender', err);
            return [];
        }
    }

    /**
     * Resets all search queries and filter dropdown values to their default states (empty / 'due-asc')
     * and triggers a re-render.
     */
    resetFilters(): void {
        this.searchQuery = '';
        this.selectedTags = [];
        this.selectedStatuses = [];
        this.selectedPlatforms = [];
        this.selectedStates = [];
        this.sortBy = 'due-asc';

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
                const isFilterActive = this.searchQuery !== '' || this.selectedTags.length > 0 || this.selectedStatuses.length > 0 || this.selectedPlatforms.length > 0 || this.selectedStates.length > 0;
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

                const hydratedTags = this.tagRegistry.length > 0
                    ? TagRegistry.hydrate(card.tags || [], this.tagRegistry)
                    : (card.tags || []);
                const tagsHtml = hydratedTags.map((t: string) => `<span class="tag">${t}</span>`).join('');
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
     * Dispatches custom event for undo notification.
     * @param message - Text to show in the toast.
     * @param onUndo - Callback executed if the user clicks Undo.
     */
    showUndoToast(message: string, onUndo?: () => void): void {
        window.dispatchEvent(new CustomEvent('algorecall-undo-toast', { detail: { message, onUndo } }));
    }

    /** Headless stubs */
    bindDeleteButtons(): void {}
    bindCheckboxes(): void {}
    updateBulkActionsBar(): void {
        if (this.onUpdate) this.onUpdate();
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
     * Resolves comma-separated tag names or an array of tag names into stable UUIDs
     * from `tagRegistry`, creating new registry entries when needed.
     */
    resolveTagIds(tagsInput: string | string[]): string[] {
        const names = Array.isArray(tagsInput)
            ? tagsInput.map(t => t.trim()).filter(t => t.length > 0)
            : tagsInput.split(',').map(t => t.trim()).filter(t => t.length > 0);
        if (!Array.isArray(this.tagRegistry)) {
            this.tagRegistry = [];
        }
        const ids: string[] = [];
        for (const name of names) {
            const { id } = TagRegistry.getOrCreateSync(name, this.tagRegistry);
            if (!ids.includes(id)) ids.push(id);
        }
        return ids;
    }

    bulkRetag(): void {
        try {
            const count = this.selectedCardIds.size;
            if (count === 0) return;

            const newTagsStr = typeof window !== 'undefined' ? prompt(`Enter new tags:`, '') : '';
            if (newTagsStr === null) return;

            const newTags = this.resolveTagIds(newTagsStr);
            this.allCards.forEach(card => {
                if (card.id && this.selectedCardIds.has(card.id)) {
                    card.tags = newTags;
                }
            });

            this.selectedCardIds.clear();
            chrome.storage.local.set({ fsrsCards: this.allCards, tagRegistry: this.tagRegistry }, () => {
                this.updateBulkActionsBar();
                this.filterAndRender();
            });
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error during bulk retag', err);
        }
    }

    bulkReschedule(): void {
        try {
            const count = this.selectedCardIds.size;
            if (count === 0) return;

            const now = Date.now();
            this.allCards.forEach(card => {
                if (card.id && this.selectedCardIds.has(card.id)) {
                    card.due = now;
                }
            });

            this.selectedCardIds.clear();
            chrome.storage.local.set({ fsrsCards: this.allCards }, () => {
                this.updateBulkActionsBar();
                this.filterAndRender();
            });
        } catch (err) {
            UIUtils.catchError('DataDashboard', 'Error in bulkReschedule', err);
        }
    }

    bindEditButtons(): void {}

    /**
     * Gathers and returns a sorted array of all unique tag display names in the registry
     * (falling back to card tags if the registry is empty).
     * @returns Sorted array of unique tag display names.
     */
    getDatabaseTags(): string[] {
        try {
            if (this.tagRegistry && this.tagRegistry.length > 0) {
                return this.tagRegistry.map(entry => entry.name).sort();
            }
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
        const card = this.allCards.find(c => c.id === cardId);
        if (!card) return;
        this.editingCardId = cardId;
        if (this.onEditCard) this.onEditCard(card);
        const overlay = document.getElementById('inline-edit-overlay');
        if (overlay) overlay.style.display = 'flex';
        const titleInput = document.getElementById('edit-title') as HTMLInputElement | null;
        if (titleInput) titleInput.value = card.problemTitle || '';
        const tagsInput = document.getElementById('edit-tags') as HTMLInputElement | null;
        if (tagsInput) {
            const hydrated = this.tagRegistry.length > 0
                ? TagRegistry.hydrate(card.tags || [], this.tagRegistry)
                : (card.tags || []);
            tagsInput.value = hydrated.join(', ');
        }
        const tcInput = document.getElementById('edit-time-complexity') as HTMLInputElement | null;
        if (tcInput) tcInput.value = card.timeComplexity || '';
        const scInput = document.getElementById('edit-space-complexity') as HTMLInputElement | null;
        if (scInput) scInput.value = card.spaceComplexity || '';
        const appInput = document.getElementById('edit-approach') as HTMLTextAreaElement | null;
        if (appInput) appInput.value = card.approach || '';
        const cardIdInput = document.getElementById('edit-card-id') as HTMLInputElement | null;
        if (cardIdInput) cardIdInput.value = card.id;
        if (this.onUpdate) this.onUpdate();
    }

    closeEditModal(): void {
        this.editingCardId = null;
        const overlay = document.getElementById('inline-edit-overlay');
        if (overlay) overlay.style.display = 'none';
        if (this.onCloseEditModal) this.onCloseEditModal();
        if (this.onUpdate) this.onUpdate();
    }

    saveCardEdit(cardId?: string, updates?: Partial<Card>): void {
        const targetId = cardId || (document.getElementById('edit-card-id') as HTMLInputElement | null)?.value || this.editingCardId || (this.allCards[0] ? this.allCards[0].id : '');
        const card = this.allCards.find(c => c.id === targetId);
        if (card) {
            if (updates) {
                Object.assign(card, updates);
            } else {
                const titleInput = document.getElementById('edit-title') as HTMLInputElement | null;
                const tagsInput = document.getElementById('edit-tags') as HTMLInputElement | null;
                const tcInput = document.getElementById('edit-time-complexity') as HTMLInputElement | null;
                const scInput = document.getElementById('edit-space-complexity') as HTMLInputElement | null;
                const appInput = document.getElementById('edit-approach') as HTMLTextAreaElement | null;
                if (titleInput) card.problemTitle = titleInput.value;
                if (tagsInput) card.tags = this.resolveTagIds(tagsInput.value);
                if (tcInput) card.timeComplexity = tcInput.value;
                if (scInput) card.spaceComplexity = scInput.value;
                if (appInput) card.approach = appInput.value;
            }
            chrome.storage.local.set({ fsrsCards: this.allCards, tagRegistry: this.tagRegistry });
        }
        this.closeEditModal();
    }

    renderAnalyticsPanel(cards?: Card[]): void {}
}

/**
 * Bootstrap entry function creating and initializing the data dashboard instance on DOM readiness.
 */
export function initDataDashboard(): void {
    try {
        const root = document.getElementById('root');
        if (root) {
            render(<DataApp />, root);
        }
    } catch (err) {
        UIUtils.catchError('DataDashboard', 'Error instantiating Data Dashboard UI', err);
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
