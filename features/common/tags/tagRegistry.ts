/**
 * @file Canonical UUID-Keyed Tag Registry Service
 * @module features/common/tags/tagRegistry
 * @context Shared across Tracker Overlay, Data Manager, Tag Manager, Settings, and Backup
 * @description Manages the canonical `tagRegistry` in `chrome.storage.local`, mapping stable
 * UUIDs to mutable display names so renaming or merging a tag propagates across all cards.
 */

import { Logger } from '@common/logger';
import { Card, StorageData, TagEntry } from '../../../types/domain';

const TAG_REGISTRY_STORAGE_KEY = 'tagRegistry';

function generateTagId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Service managing CRUD, hydration, and merging for the canonical tag registry.
 */
export class TagRegistry {
    /**
     * Loads the tag registry array from `chrome.storage.local`.
     * @returns Array of `TagEntry` objects (empty array if none saved yet).
     */
    static async load(): Promise<TagEntry[]> {
        try {
            const result = (await chrome.storage.local.get([TAG_REGISTRY_STORAGE_KEY])) as StorageData;
            return Array.isArray(result.tagRegistry) ? result.tagRegistry : [];
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            Logger.error('TagRegistry', `Failed to load tag registry: ${msg}`, { err });
            throw err;
        }
    }

    /**
     * Persists the tag registry array to `chrome.storage.local`.
     * @param registry - Registry array to save.
     */
    static async save(registry: TagEntry[]): Promise<void> {
        try {
            await chrome.storage.local.set({ [TAG_REGISTRY_STORAGE_KEY]: registry });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            Logger.error('TagRegistry', `Failed to save tag registry: ${msg}`, { err });
            throw err;
        }
    }

    /**
     * Resolves an array of tag UUIDs to human-readable display names.
     * Unknown UUIDs resolve to `"(deleted)"` without throwing.
     * @param ids - Array of tag UUIDs from a card.
     * @param registry - Active tag registry.
     * @returns Array of display names.
     */
    static hydrate(ids: string[], registry: TagEntry[]): string[] {
        if (!ids || ids.length === 0) return [];
        const map = new Map<string, string>();
        for (const entry of registry) {
            map.set(entry.id, entry.name);
        }
        return ids.map((id) => map.get(id) ?? '(deleted)');
    }

    /**
     * Synchronous variant of `getOrCreate`: finds an existing tag entry by name
     * (case-insensitive, trimmed) or appends a new one to `registry` in place.
     * Returns `{ id, created }` so callers can persist `registry` when `created` is `true`.
     */
    static getOrCreateSync(name: string, registry: TagEntry[]): { id: string; created: boolean } {
        const trimmed = name.trim();
        if (!trimmed) {
            throw new Error('Tag name cannot be empty.');
        }

        const normalized = trimmed.toLowerCase();
        const existing = registry.find((entry) => entry.name.trim().toLowerCase() === normalized);
        if (existing) {
            return { id: existing.id, created: false };
        }

        const newEntry: TagEntry = {
            id: generateTagId(),
            name: trimmed
        };
        registry.push(newEntry);
        return { id: newEntry.id, created: true };
    }

    /**
     * Finds an existing tag entry by name (case-insensitive, trimmed) or creates a new one.
     * Mutates `registry` in place and persists it when a new entry is added.
     * @param name - Tag display name.
     * @param registry - Active tag registry (mutated in place if created).
     * @returns Stable UUID of the existing or newly created tag entry.
     */
    static async getOrCreate(name: string, registry: TagEntry[]): Promise<string> {
        const { id, created } = TagRegistry.getOrCreateSync(name, registry);
        if (created) {
            await TagRegistry.save(registry);
        }
        return id;
    }

    /**
     * Renames an existing tag entry by ID.
     * Returns `false` if another tag already has `newName` (case-insensitive) or if `newName` is empty.
     * @param id - Tag UUID to rename.
     * @param newName - New display name.
     * @param registry - Active tag registry (mutated in place on success).
     * @returns `true` if renamed and saved, `false` if duplicate or invalid.
     */
    static async rename(id: string, newName: string, registry: TagEntry[]): Promise<boolean> {
        const trimmed = newName.trim();
        if (!trimmed) return false;

        const target = registry.find((entry) => entry.id === id);
        if (!target) return false;

        const normalized = trimmed.toLowerCase();
        const duplicate = registry.find(
            (entry) => entry.id !== id && entry.name.trim().toLowerCase() === normalized
        );
        if (duplicate) {
            return false;
        }

        target.name = trimmed;
        await TagRegistry.save(registry);
        return true;
    }

    /**
     * Deletes a tag entry from `registry` and persists the updated registry.
     * Returns the IDs of cards that referenced the deleted tag so the caller can clean them up.
     * @param id - Tag UUID to delete.
     * @param registry - Active tag registry (mutated in place).
     * @param cards - Current cards array to inspect for references.
     * @returns Array of affected card IDs.
     */
    static async delete(id: string, registry: TagEntry[], cards: Card[]): Promise<string[]> {
        const idx = registry.findIndex((entry) => entry.id === id);
        if (idx !== -1) {
            registry.splice(idx, 1);
            await TagRegistry.save(registry);
        }

        const affectedCardIds: string[] = [];
        for (const card of cards) {
            if (Array.isArray(card.tags) && card.tags.includes(id) && card.id) {
                affectedCardIds.push(card.id);
            }
        }
        return affectedCardIds;
    }

    /**
     * Merges `srcId` into `dstId`: replaces all `srcId` references in `cards` with `dstId`
     * (deduplicating), removes `srcId` from `registry`, and persists both `fsrsCards` and `tagRegistry`.
     * @param srcId - Source tag UUID to be removed.
     * @param dstId - Destination tag UUID to keep.
     * @param registry - Active tag registry (mutated in place).
     * @param cards - Cards collection (mutated in place).
     */
    static async merge(srcId: string, dstId: string, registry: TagEntry[], cards: Card[]): Promise<void> {
        if (srcId === dstId) return;

        for (const card of cards) {
            if (!Array.isArray(card.tags) || !card.tags.includes(srcId)) continue;
            const nextTags: string[] = [];
            for (const tagId of card.tags) {
                const resolved = tagId === srcId ? dstId : tagId;
                if (!nextTags.includes(resolved)) {
                    nextTags.push(resolved);
                }
            }
            card.tags = nextTags;
        }

        const idx = registry.findIndex((entry) => entry.id === srcId);
        if (idx !== -1) {
            registry.splice(idx, 1);
        }

        await chrome.storage.local.set({
            fsrsCards: cards,
            [TAG_REGISTRY_STORAGE_KEY]: registry
        });
    }
}
