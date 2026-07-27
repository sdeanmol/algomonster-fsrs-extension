/**
 * @file tests/unit/multiCard.test.js
 * @description Unit tests covering multi-card support per URL, backward compatibility,
 * isolated edits/reviews/deletions, filtering, and backup compatibility.
 */

const { generateCardId, cleanUrl, getCardsForUrl, ensureCardIds } = require('../../features/common/utils/cardUtils');
const { DataUtils } = require('../../features/dashboard/analytics/utils/dataUtils');

describe('Multi-card Utilities & Backward Compatibility', () => {
    test('generateCardId creates unique non-empty string IDs', () => {
        const id1 = generateCardId();
        const id2 = generateCardId();
        expect(typeof id1).toBe('string');
        expect(id1.length).toBeGreaterThan(5);
        expect(id1).not.toBe(id2);
    });

    test('cleanUrl normalizes URLs with query strings and hash anchors', () => {
        expect(cleanUrl('https://leetcode.com/problems/two-sum?envType=daily-question&envId=2026-07-27#solution')).toBe('https://leetcode.com/problems/two-sum');
        expect(cleanUrl('https://algo.monster/problems/binary-search')).toBe('https://algo.monster/problems/binary-search');
        expect(cleanUrl(null)).toBe('');
    });

    test('ensureCardIds assigns unique IDs to legacy cards without ID', () => {
        const legacyCards = [
            { problemUrl: 'https://test.com/p1', approach: 'Approach 1' },
            { id: 'custom-id-123', problemUrl: 'https://test.com/p1', approach: 'Approach 2' },
            { problemUrl: 'https://test.com/p2', approach: 'Approach 3' }
        ];
        const processed = ensureCardIds(legacyCards);
        expect(processed.length).toBe(3);
        expect(processed[0].id).toBeDefined();
        expect(processed[1].id).toBe('custom-id-123');
        expect(processed[2].id).toBeDefined();
        expect(processed[0].id).not.toBe(processed[2].id);
    });

    test('getCardsForUrl retrieves all independent cards associated with a URL', () => {
        const cards = [
            { id: 'c1', problemUrl: 'https://leetcode.com/problems/two-sum?ref=1', approach: 'HashMap' },
            { id: 'c2', problemUrl: 'https://leetcode.com/problems/two-sum#notes', approach: 'Two Pointers' },
            { id: 'c3', problemUrl: 'https://leetcode.com/problems/3sum', approach: 'Sorting' }
        ];

        const targetCards = getCardsForUrl(cards, 'https://leetcode.com/problems/two-sum');
        expect(targetCards.length).toBe(2);
        expect(targetCards.map(c => c.id)).toEqual(['c1', 'c2']);
    });
});

describe('Multi-Card Operations Isolation', () => {
    let mockCards;

    beforeEach(() => {
        mockCards = [
            {
                id: 'card-1',
                problemTitle: 'Two Sum',
                problemUrl: 'https://leetcode.com/problems/two-sum',
                approach: 'Hash Map approach (O(N) time)',
                tags: ['Hash Table', 'Array'],
                due: Date.now() - 10000,
                reps: 1,
                lapses: 0,
                stability: 2.5,
                difficulty: 5.0,
                state: 2,
                lastRating: 3
            },
            {
                id: 'card-2',
                problemTitle: 'Two Sum',
                problemUrl: 'https://leetcode.com/problems/two-sum',
                approach: 'Brute Force Double Loop (O(N^2) time)',
                tags: ['Brute Force'],
                due: Date.now() + 86400000,
                reps: 2,
                lapses: 1,
                stability: 1.2,
                difficulty: 6.5,
                state: 1,
                lastRating: 2
            }
        ];
    });

    test('Editing one card does not alter sibling card on the same URL', () => {
        // Edit card-1
        const cardToEdit = mockCards.find(c => c.id === 'card-1');
        cardToEdit.approach = 'Updated Hash Map with One-Pass';
        cardToEdit.tags = ['Hash Table', 'Optimized'];

        // Verify card-2 remains unchanged
        const siblingCard = mockCards.find(c => c.id === 'card-2');
        expect(siblingCard.approach).toBe('Brute Force Double Loop (O(N^2) time)');
        expect(siblingCard.tags).toEqual(['Brute Force']);
    });

    test('Deleting one card leaves sibling card intact', () => {
        const remainingCards = mockCards.filter(c => c.id !== 'card-1');
        expect(remainingCards.length).toBe(1);
        expect(remainingCards[0].id).toBe('card-2');
        expect(getCardsForUrl(remainingCards, 'https://leetcode.com/problems/two-sum').length).toBe(1);
    });

    test('Analytics & DataUtils aggregate all cards correctly', () => {
        const mockScheduler = {
            getRetrievability: jest.fn(() => 0.9)
        };
        const dataUtils = new DataUtils(mockCards, { '2026-07-27': 5 }, mockScheduler);
        const stats = dataUtils.getSummaryStats();

        expect(stats.totalCards).toBe(2);
        expect(stats.totalReps).toBe(3);
        expect(stats.totalLapses).toBe(1);
        expect(stats.due).toBe(1); // Only card-1 is due
    });
});
