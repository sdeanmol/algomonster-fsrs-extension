/**
 * @file Tag Manager Page Controller & Preact UI
 * @module features/common/tags/tags
 * @context Standalone Options Page (`features/common/tags/tags.html`)
 * @description Renders all canonical tags from `tagRegistry` with per-tag card counts
 * and supports searching, sorting, inline renaming, duplicate-name merging, and deletion.
 */

import { h, render, JSX } from 'preact';
import { useState, useEffect, useMemo, useCallback } from 'preact/hooks';
import { Logger } from '@common/logger';
import { Card, StorageData, TagEntry } from '../../../types/domain';
import { TagRegistry } from './tagRegistry';

export type TagSortOption = 'name-asc' | 'name-desc' | 'count-desc' | 'count-asc';

interface TagRowProps {
    entry: TagEntry;
    count: number;
    registry: TagEntry[];
    onRename: (entry: TagEntry, newName: string) => Promise<{ ok: boolean; duplicate?: TagEntry }>;
    onMerge: (src: TagEntry, dst: TagEntry, count: number) => Promise<void>;
    onDelete: (entry: TagEntry, count: number) => Promise<void>;
}

function TagRow({ entry, count, onRename, onMerge, onDelete }: TagRowProps): JSX.Element {
    const [draftName, setDraftName] = useState(entry.name);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [duplicateTarget, setDuplicateTarget] = useState<TagEntry | null>(null);

    useEffect(() => {
        setDraftName(entry.name);
        setErrorMsg(null);
        setDuplicateTarget(null);
    }, [entry.id, entry.name]);

    const handleRename = async () => {
        const trimmed = draftName.trim();
        setErrorMsg(null);
        setDuplicateTarget(null);

        if (!trimmed) {
            setErrorMsg('Tag name cannot be empty.');
            setDraftName(entry.name);
            return;
        }
        if (trimmed === entry.name) return;

        try {
            const res = await onRename(entry, trimmed);
            if (!res.ok) {
                setErrorMsg('A tag with this name already exists.');
                setDuplicateTarget(res.duplicate || null);
            }
        } catch (err) {
            Logger.error('TagManagerPage', 'Rename failed', { err });
        }
    };

    return (
        <div className="tag-row" data-tag-id={entry.id}>
            <div className="tag-row-main">
                <svg className="svg-icon tag-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                <input
                    type="text"
                    className="tag-name-input"
                    value={draftName}
                    aria-label={`Tag name for ${entry.name}`}
                    onInput={(e: Event) => setDraftName((e.target as HTMLInputElement).value)}
                    onKeyDown={(e: KeyboardEvent) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            handleRename();
                        }
                    }}
                />
                <a
                    className="tag-count-badge"
                    href={`../data/data.html?tag=${encodeURIComponent(entry.id)}`}
                    title={`View ${count} card${count === 1 ? '' : 's'} with tag "${entry.name}" in Data Manager`}
                    aria-label={`View ${count} card${count === 1 ? '' : 's'} with tag ${entry.name} in Data Manager`}
                >
                    {count} card{count === 1 ? '' : 's'}
                </a>
                <div className="tag-row-actions">
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleRename}
                    >
                        Rename
                    </button>
                    <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => onDelete(entry, count)}
                    >
                        Delete
                    </button>
                </div>
            </div>
            {errorMsg && (
                <div className="tag-row-error">
                    <span>{errorMsg}</span>
                    {duplicateTarget && (
                        <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onMerge(entry, duplicateTarget, count)}
                        >
                            Merge into "{duplicateTarget.name}"
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export function TagManagerApp(): JSX.Element {
    const [registry, setRegistry] = useState<TagEntry[]>([]);
    const [cards, setCards] = useState<Card[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [sortBy, setSortBy] = useState<TagSortOption>('name-asc');
    const [banner, setBanner] = useState<{ message: string; isError: boolean } | null>(null);

    const loadData = useCallback(async () => {
        try {
            const result = (await chrome.storage.local.get(['fsrsCards', 'tagRegistry'])) as StorageData;
            const loadedCards = Array.isArray(result.fsrsCards) ? result.fsrsCards : [];
            const loadedRegistry = Array.isArray(result.tagRegistry) ? result.tagRegistry : await TagRegistry.load();
            setCards(loadedCards);
            setRegistry(loadedRegistry);
        } catch (err) {
            Logger.error('TagManagerPage', 'Error initializing TagManagerApp', { err });
            setBanner({ message: 'Failed to load tags.', isError: true });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const cardCounts = useMemo(() => {
        const counts = new Map<string, number>();
        for (const card of cards) {
            if (!Array.isArray(card.tags)) continue;
            for (const tagId of card.tags) {
                counts.set(tagId, (counts.get(tagId) || 0) + 1);
            }
        }
        return counts;
    }, [cards]);

    const sortedTags = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        const filtered = registry.filter((entry) => !q || entry.name.toLowerCase().includes(q));
        return [...filtered].sort((a, b) => {
            if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
            if (sortBy === 'count-desc') return (cardCounts.get(b.id) || 0) - (cardCounts.get(a.id) || 0) || a.name.localeCompare(b.name);
            if (sortBy === 'count-asc') return (cardCounts.get(a.id) || 0) - (cardCounts.get(b.id) || 0) || a.name.localeCompare(b.name);
            return a.name.localeCompare(b.name);
        });
    }, [registry, searchQuery, sortBy, cardCounts]);

    const handleRename = useCallback(async (entry: TagEntry, newName: string) => {
        const nextRegistry = registry.map((t) => ({ ...t }));
        const ok = await TagRegistry.rename(entry.id, newName, nextRegistry);
        if (ok) {
            setRegistry(nextRegistry);
            setBanner({ message: `Renamed tag to "${newName}".`, isError: false });
            return { ok: true };
        }
        const duplicate = nextRegistry.find(
            (t) => t.id !== entry.id && t.name.trim().toLowerCase() === newName.toLowerCase()
        );
        return { ok: false, duplicate };
    }, [registry]);

    const handleMerge = useCallback(async (src: TagEntry, dst: TagEntry, count: number) => {
        if (!confirm(`Merge "${src.name}" into "${dst.name}"? All ${count} card(s) will use "${dst.name}".`)) {
            return;
        }
        const nextRegistry = registry.map((t) => ({ ...t }));
        const nextCards = cards.map((c) => ({ ...c, tags: c.tags ? [...c.tags] : [] }));
        await TagRegistry.merge(src.id, dst.id, nextRegistry, nextCards);
        setRegistry(nextRegistry);
        setCards(nextCards);
        setBanner({ message: `Merged "${src.name}" into "${dst.name}".`, isError: false });
    }, [registry, cards]);

    const handleDelete = useCallback(async (entry: TagEntry, count: number) => {
        if (!confirm(`Delete tag "${entry.name}"? It will be removed from ${count} card(s).`)) {
            return;
        }
        const nextRegistry = registry.map((t) => ({ ...t }));
        const nextCards = cards.map((c) => ({ ...c, tags: c.tags ? [...c.tags] : [] }));
        const affectedIds = await TagRegistry.delete(entry.id, nextRegistry, nextCards);
        if (affectedIds.length > 0) {
            for (const card of nextCards) {
                if (card.id && affectedIds.includes(card.id) && Array.isArray(card.tags)) {
                    card.tags = card.tags.filter((id) => id !== entry.id);
                }
            }
            await chrome.storage.local.set({ fsrsCards: nextCards });
        }
        setRegistry(nextRegistry);
        setCards(nextCards);
        setBanner({ message: `Deleted tag "${entry.name}".`, isError: false });
    }, [registry, cards]);

    const totalCount = registry.length;
    const summaryText = loading
        ? 'Loading tags...'
        : searchQuery.trim()
            ? `Showing ${sortedTags.length} of ${totalCount} tag${totalCount === 1 ? '' : 's'} · ${cards.length} card${cards.length === 1 ? '' : 's'}`
            : `${totalCount} tag${totalCount === 1 ? '' : 's'} across ${cards.length} card${cards.length === 1 ? '' : 's'}`;

    return (
        <div className="container">
            <div className="header">
                <div className="header-main">
                    <div className="algorecall-brand-badge">
                        <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1 1-2 1-3.5 0-2.5 2-5 5.5-6z" />
                            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                            <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                        </svg>
                        <span className="algorecall-brand-name">AlgoRecall</span>
                    </div>
                    <h1 id="page-title">Tag Manager</h1>
                    <p id="page-subtitle" className="subtitle">Rename, merge, or delete tags across all your saved patterns.</p>
                </div>
                <div className="header-actions">
                    <a href="../data/data.html" className="btn btn-secondary">
                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ marginRight: '6px' }} aria-hidden="true">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Data Manager
                    </a>
                    <a href="../../dashboard/analytics/analytics.html" className="btn btn-secondary">
                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ marginRight: '6px' }} aria-hidden="true">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                        Analytics
                    </a>
                </div>
            </div>

            {banner && (
                <div
                    id="status-banner"
                    className={`status-banner ${banner.isError ? 'error' : 'success'}`}
                    role="status"
                    aria-live="polite"
                >
                    {banner.message}
                </div>
            )}

            <div className="filters-panel">
                <div className="search-box-wrapper">
                    <svg className="svg-icon search-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        id="tags-search-input"
                        className="input-field search-input"
                        placeholder="Search tags by name..."
                        aria-label="Search tags by name"
                        value={searchQuery}
                        onInput={(e: Event) => setSearchQuery((e.target as HTMLInputElement).value)}
                    />
                </div>
                <div className="toolbar-meta">
                    <span id="tags-summary" className="tags-summary">{summaryText}</span>
                    <div className="sort-wrapper">
                        <label htmlFor="tags-sort-select" className="sort-label">Sort</label>
                        <select
                            id="tags-sort-select"
                            className="select-field"
                            aria-label="Sort tags"
                            value={sortBy}
                            onChange={(e: Event) => setSortBy((e.target as HTMLSelectElement).value as TagSortOption)}
                        >
                            <option value="name-asc">Name (A–Z)</option>
                            <option value="name-desc">Name (Z–A)</option>
                            <option value="count-desc">Most Cards</option>
                            <option value="count-asc">Fewest Cards</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="tags-card">
                <div id="tags-list" className="tags-list">
                    {!loading && sortedTags.length === 0 ? (
                        <div className="empty-state">
                            {searchQuery.trim()
                                ? `No tags matching "${searchQuery.trim()}".`
                                : 'No tags yet. Tags will appear here after your first review.'}
                        </div>
                    ) : (
                        sortedTags.map((entry) => (
                            <TagRow
                                key={entry.id}
                                entry={entry}
                                count={cardCounts.get(entry.id) || 0}
                                registry={registry}
                                onRename={handleRename}
                                onMerge={handleMerge}
                                onDelete={handleDelete}
                            />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const root = document.getElementById('root');
        if (root) {
            render(<TagManagerApp />, root);
        }
    });
}
