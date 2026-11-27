/**
 * @file Tag Manager Page Controller
 * @module features/common/tags/tags
 * @context Standalone Options Page (`features/common/tags/tags.html`)
 * @description Renders all canonical tags from `tagRegistry` with per-tag card counts
 * and supports inline renaming, duplicate-name merging, and deletion.
 */

import { Logger } from '@common/logger';
import { CatchAndLog } from '../../../decorators';
import { Card, StorageData, TagEntry } from '../../../types/domain';
import { TagRegistry } from './tagRegistry';

export class TagManagerPage {
    private registry: TagEntry[] = [];
    private cards: Card[] = [];
    private searchQuery: string = '';
    private sortBy: 'name-asc' | 'name-desc' | 'count-desc' | 'count-asc' = 'name-asc';

    @CatchAndLog('TagManagerPage', 'Error initializing TagManagerPage')
    async init(): Promise<void> {
        const result = (await chrome.storage.local.get(['fsrsCards', 'tagRegistry'])) as StorageData;
        this.cards = Array.isArray(result.fsrsCards) ? result.fsrsCards : [];
        this.registry = Array.isArray(result.tagRegistry) ? result.tagRegistry : await TagRegistry.load();
        this.bindToolbarEvents();
        this.render();
    }

    private bindToolbarEvents(): void {
        const searchInput = document.getElementById('tags-search-input') as HTMLInputElement | null;
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.searchQuery = searchInput.value.trim().toLowerCase();
                this.render();
            });
        }

        const sortSelect = document.getElementById('tags-sort-select') as HTMLSelectElement | null;
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.sortBy = sortSelect.value as typeof this.sortBy;
                this.render();
            });
        }
    }

    private getCardCounts(): Map<string, number> {
        const counts = new Map<string, number>();
        for (const card of this.cards) {
            if (!Array.isArray(card.tags)) continue;
            for (const tagId of card.tags) {
                counts.set(tagId, (counts.get(tagId) || 0) + 1);
            }
        }
        return counts;
    }

    private showBanner(message: string, isError: boolean = false): void {
        const banner = document.getElementById('status-banner');
        if (!banner) return;
        banner.textContent = message;
        banner.className = `status-banner ${isError ? 'error' : 'success'}`;
        banner.style.display = 'block';
    }

    render(): void {
        const listEl = document.getElementById('tags-list');
        const summaryEl = document.getElementById('tags-summary');
        if (!listEl) return;

        const counts = this.getCardCounts();
        const filtered = this.registry.filter(
            (entry) => !this.searchQuery || entry.name.toLowerCase().includes(this.searchQuery)
        );
        const sorted = [...filtered].sort((a, b) => {
            if (this.sortBy === 'name-desc') return b.name.localeCompare(a.name);
            if (this.sortBy === 'count-desc') return (counts.get(b.id) || 0) - (counts.get(a.id) || 0) || a.name.localeCompare(b.name);
            if (this.sortBy === 'count-asc') return (counts.get(a.id) || 0) - (counts.get(b.id) || 0) || a.name.localeCompare(b.name);
            return a.name.localeCompare(b.name);
        });

        if (summaryEl) {
            const totalCount = this.registry.length;
            summaryEl.textContent = this.searchQuery
                ? `Showing ${sorted.length} of ${totalCount} tag${totalCount === 1 ? '' : 's'} · ${this.cards.length} card${this.cards.length === 1 ? '' : 's'}`
                : `${totalCount} tag${totalCount === 1 ? '' : 's'} across ${this.cards.length} card${this.cards.length === 1 ? '' : 's'}`;
        }

        listEl.innerHTML = '';
        if (sorted.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.textContent = this.searchQuery
                ? `No tags matching "${this.searchQuery}".`
                : 'No tags yet. Tags will appear here after your first review.';
            listEl.appendChild(empty);
            return;
        }

        for (const entry of sorted) {
            const count = counts.get(entry.id) || 0;
            const row = document.createElement('div');
            row.className = 'tag-row';
            row.dataset.tagId = entry.id;

            const main = document.createElement('div');
            main.className = 'tag-row-main';

            const tagIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            tagIcon.setAttribute('class', 'svg-icon tag-icon');
            tagIcon.setAttribute('viewBox', '0 0 24 24');
            tagIcon.setAttribute('aria-hidden', 'true');
            tagIcon.innerHTML = '<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>';

            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'tag-name-input';
            input.value = entry.name;
            input.setAttribute('aria-label', `Tag name for ${entry.name}`);

            const badge = document.createElement('a');
            badge.className = 'tag-count-badge';
            badge.href = `../data/data.html?tag=${encodeURIComponent(entry.id)}`;
            badge.title = `View ${count} card${count === 1 ? '' : 's'} with tag "${entry.name}" in Data Manager`;
            badge.setAttribute('aria-label', `View ${count} card${count === 1 ? '' : 's'} with tag ${entry.name} in Data Manager`);
            badge.textContent = `${count} card${count === 1 ? '' : 's'}`;

            const actions = document.createElement('div');
            actions.className = 'tag-row-actions';

            const renameBtn = document.createElement('button');
            renameBtn.type = 'button';
            renameBtn.className = 'btn btn-secondary btn-sm';
            renameBtn.textContent = 'Rename';

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn btn-danger btn-sm';
            deleteBtn.textContent = 'Delete';

            const errorBox = document.createElement('div');
            errorBox.className = 'tag-row-error';
            errorBox.style.display = 'none';

            const handleRename = async (): Promise<void> => {
                const newName = input.value.trim();
                errorBox.style.display = 'none';
                errorBox.innerHTML = '';

                if (!newName) {
                    errorBox.textContent = 'Tag name cannot be empty.';
                    errorBox.style.display = 'flex';
                    input.value = entry.name;
                    return;
                }

                if (newName === entry.name) return;

                const ok = await TagRegistry.rename(entry.id, newName, this.registry);
                if (ok) {
                    this.showBanner(`Renamed tag to "${newName}".`);
                    this.render();
                    return;
                }

                const existing = this.registry.find(
                    (t) => t.id !== entry.id && t.name.trim().toLowerCase() === newName.toLowerCase()
                );
                const msgSpan = document.createElement('span');
                msgSpan.textContent = 'A tag with this name already exists.';
                errorBox.appendChild(msgSpan);

                if (existing) {
                    const mergeBtn = document.createElement('button');
                    mergeBtn.type = 'button';
                    mergeBtn.className = 'btn btn-secondary btn-sm';
                    mergeBtn.textContent = `Merge into "${existing.name}"`;
                    mergeBtn.addEventListener('click', async () => {
                        if (confirm(`Merge "${entry.name}" into "${existing.name}"? All ${count} card(s) will use "${existing.name}".`)) {
                            await TagRegistry.merge(entry.id, existing.id, this.registry, this.cards);
                            this.showBanner(`Merged "${entry.name}" into "${existing.name}".`);
                            this.render();
                        }
                    });
                    errorBox.appendChild(mergeBtn);
                }
                errorBox.style.display = 'flex';
            };

            renameBtn.addEventListener('click', () => {
                handleRename().catch((err) => {
                    Logger.error('TagManagerPage', 'Rename failed', { err });
                });
            });

            input.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleRename().catch((err) => {
                        Logger.error('TagManagerPage', 'Rename on Enter failed', { err });
                    });
                }
            });

            deleteBtn.addEventListener('click', async () => {
                if (!confirm(`Delete tag "${entry.name}"? It will be removed from ${count} card(s).`)) {
                    return;
                }
                const affectedIds = await TagRegistry.delete(entry.id, this.registry, this.cards);
                if (affectedIds.length > 0) {
                    for (const card of this.cards) {
                        if (card.id && affectedIds.includes(card.id) && Array.isArray(card.tags)) {
                            card.tags = card.tags.filter((id) => id !== entry.id);
                        }
                    }
                    await chrome.storage.local.set({ fsrsCards: this.cards });
                }
                this.showBanner(`Deleted tag "${entry.name}".`);
                this.render();
            });

            actions.appendChild(renameBtn);
            actions.appendChild(deleteBtn);
            main.appendChild(tagIcon);
            main.appendChild(input);
            main.appendChild(badge);
            main.appendChild(actions);
            row.appendChild(main);
            row.appendChild(errorBox);
            listEl.appendChild(row);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const page = new TagManagerPage();
    page.init().catch((err) => {
        Logger.error('TagManagerPage', 'Failed to initialize TagManagerPage', { err });
    });
});
