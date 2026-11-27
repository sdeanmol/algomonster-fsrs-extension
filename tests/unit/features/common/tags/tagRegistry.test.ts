import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { TagRegistry } from '../../../../../features/common/tags/tagRegistry';
import { Card, TagEntry } from '../../../../../types/domain';

describe('TagRegistry', () => {
    let storageState: Record<string, unknown>;

    beforeEach(() => {
        storageState = {};
        (globalThis as unknown as { chrome: unknown }).chrome = {
            runtime: { lastError: undefined },
            storage: {
                local: {
                    get: jest.fn(async (keys: string | string[]) => {
                        const keyList = Array.isArray(keys) ? keys : [keys];
                        const result: Record<string, unknown> = {};
                        for (const k of keyList) {
                            if (k in storageState) result[k] = storageState[k];
                        }
                        return result;
                    }),
                    set: jest.fn(async (items: Record<string, unknown>) => {
                        Object.assign(storageState, items);
                    })
                }
            }
        };
    });

    it('loads empty array when tagRegistry is absent and saves to storage', async () => {
        const empty = await TagRegistry.load();
        expect(empty).toEqual([]);

        const sample: TagEntry[] = [{ id: 'id-1', name: 'Arrays' }];
        await TagRegistry.save(sample);
        expect(storageState.tagRegistry).toEqual(sample);

        const loaded = await TagRegistry.load();
        expect(loaded).toEqual(sample);
    });

    it('hydrates UUIDs to display names and returns "(deleted)" for unknown UUIDs', () => {
        const registry: TagEntry[] = [
            { id: 'uuid-1', name: 'Binary Search' },
            { id: 'uuid-2', name: 'Two Pointers' }
        ];
        expect(TagRegistry.hydrate(['uuid-1', 'missing-uuid', 'uuid-2'], registry)).toEqual([
            'Binary Search',
            '(deleted)',
            'Two Pointers'
        ]);
        expect(TagRegistry.hydrate([], registry)).toEqual([]);
    });

    it('getOrCreate returns same id on case-insensitive match and creates new entry otherwise', async () => {
        const registry: TagEntry[] = [];
        const id1 = await TagRegistry.getOrCreate('Binary Search', registry);
        expect(id1).toBeTruthy();
        expect(registry).toHaveLength(1);
        expect(registry[0]).toEqual({ id: id1, name: 'Binary Search' });

        const id2 = await TagRegistry.getOrCreate('  binary search ', registry);
        expect(id2).toBe(id1);
        expect(registry).toHaveLength(1);

        const id3 = await TagRegistry.getOrCreate('Graphs', registry);
        expect(id3).not.toBe(id1);
        expect(registry).toHaveLength(2);
    });

    it('rename updates entry name when unique and returns false on duplicate', async () => {
        const registry: TagEntry[] = [
            { id: 'id-1', name: 'Linked List' },
            { id: 'id-2', name: 'Linked Lists' }
        ];

        const dupResult = await TagRegistry.rename('id-2', 'linked list', registry);
        expect(dupResult).toBe(false);
        expect(registry[1].name).toBe('Linked Lists');

        const okResult = await TagRegistry.rename('id-1', 'Singly Linked List', registry);
        expect(okResult).toBe(true);
        expect(registry[0].name).toBe('Singly Linked List');
        expect(storageState.tagRegistry).toEqual(registry);
    });

    it('delete removes entry from registry and returns affected card ids', async () => {
        const registry: TagEntry[] = [
            { id: 't1', name: 'Arrays' },
            { id: 't2', name: 'Strings' }
        ];
        const cards = [
            { id: 'c1', tags: ['t1', 't2'] },
            { id: 'c2', tags: ['t2'] },
            { id: 'c3', tags: ['t1'] }
        ] as unknown as Card[];

        const affected = await TagRegistry.delete('t1', registry, cards);
        expect(affected).toEqual(['c1', 'c3']);
        expect(registry).toEqual([{ id: 't2', name: 'Strings' }]);
    });

    it('merge replaces srcId with dstId across cards without duplicating dstId and deletes srcId', async () => {
        const registry: TagEntry[] = [
            { id: 'src', name: 'Linked Lists' },
            { id: 'dst', name: 'Linked List' }
        ];
        const cards = [
            { id: 'c1', tags: ['src'] },
            { id: 'c2', tags: ['src', 'dst'] },
            { id: 'c3', tags: ['dst'] }
        ] as unknown as Card[];

        await TagRegistry.merge('src', 'dst', registry, cards);

        expect(cards[0].tags).toEqual(['dst']);
        expect(cards[1].tags).toEqual(['dst']);
        expect(cards[2].tags).toEqual(['dst']);
        expect(registry).toEqual([{ id: 'dst', name: 'Linked List' }]);
        expect(storageState.fsrsCards).toEqual(cards);
        expect(storageState.tagRegistry).toEqual(registry);
    });
});
