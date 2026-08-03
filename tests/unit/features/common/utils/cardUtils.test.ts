import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { getLastReviewDate, generateCardId, cleanUrl, getCardsForUrl, ensureCardIds } from '../../../../../features/common/utils/cardUtils';
import { Card } from '../../../../../types/domain';

describe('cardUtils', () => {
  let originalNow: () => number;

  beforeEach(() => {
    originalNow = Date.now;
  });

  afterEach(() => {
    Date.now = originalNow;
    jest.restoreAllMocks();
  });

  describe('getLastReviewDate', () => {
    it('returns null for null, undefined, or empty card', () => {
      expect(getLastReviewDate(null)).toBeNull();
      expect(getLastReviewDate(undefined)).toBeNull();
      expect(getLastReviewDate({})).toBeNull();
    });

    it('returns timestamp when lastReview is a number', () => {
      const now = Date.now();
      expect(getLastReviewDate({ lastReview: now })).toBe(now);
    });

    it('returns timestamp when last_review is a number', () => {
      const now = Date.now();
      expect(getLastReviewDate({ last_review: now })).toBe(now);
    });

    it('parses valid string dates for lastReview or last_review', () => {
      const iso = '2026-08-01T12:00:00.000Z';
      const timestamp = Date.parse(iso);
      expect(getLastReviewDate({ lastReview: iso })).toBe(timestamp);
      expect(getLastReviewDate({ last_review: iso })).toBe(timestamp);
    });

    it('returns null for invalid string dates', () => {
      expect(getLastReviewDate({ lastReview: 'invalid-date-string' })).toBeNull();
    });

    it('handles Date instances', () => {
      const d = new Date(1700000000000);
      expect(getLastReviewDate({ lastReview: d })).toBe(1700000000000);
    });

    it('extracts date from historyLog if lastReview/last_review is absent', () => {
      const logTs = 1690000000000;
      expect(getLastReviewDate({ historyLog: [{ date: logTs }] })).toBe(logTs);
      expect(getLastReviewDate({ historyLog: [logTs] })).toBe(logTs);
      expect(getLastReviewDate({ historyLog: [{ date: '2026-08-01T00:00:00Z' }] })).toBe(Date.parse('2026-08-01T00:00:00Z'));
    });

    it('returns null when historyLog is empty or contains no valid date', () => {
      expect(getLastReviewDate({ historyLog: [] })).toBeNull();
      expect(getLastReviewDate({ historyLog: [{ date: 'bad-date' }] })).toBeNull();
    });

    it('catches exceptions and returns null safely', () => {
      const invalidCard = {
        get lastReview() {
          throw new Error('Access error');
        }
      };
      expect(getLastReviewDate(invalidCard as any)).toBeNull();
    });
  });

  describe('generateCardId', () => {
    it('generates a non-empty unique string ID', () => {
      const id1 = generateCardId();
      const id2 = generateCardId();
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(5);
      expect(id1).not.toBe(id2);
    });

    it('falls back to random string on error', () => {
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        if (callCount === 1) throw new Error('Date error');
        return 1700000000000;
      }) as any;

      const fallbackId = generateCardId();
      expect(fallbackId).toBeDefined();
      expect(typeof fallbackId).toBe('string');
    });
  });

  describe('cleanUrl', () => {
    it('returns empty string for null, undefined, or empty url', () => {
      expect(cleanUrl(null)).toBe('');
      expect(cleanUrl(undefined)).toBe('');
      expect(cleanUrl('')).toBe('');
    });

    it('removes query parameters and hash anchors', () => {
      expect(cleanUrl('https://leetcode.com/problems/two-sum/?envType=daily-question#description')).toBe('https://leetcode.com/problems/two-sum/');
      expect(cleanUrl('https://algomonster.com/problems/two_sum?lang=python')).toBe('https://algomonster.com/problems/two_sum');
      expect(cleanUrl('https://algomonster.com/problems/two_sum#solution')).toBe('https://algomonster.com/problems/two_sum');
    });

    it('returns URL unchanged if no query params or hash present', () => {
      expect(cleanUrl('https://leetcode.com/problems/two-sum/')).toBe('https://leetcode.com/problems/two-sum/');
    });

    it('handles unexpected non-string inputs via fallback', () => {
      expect(cleanUrl(12345 as any)).toBe('12345');
    });
  });

  describe('getCardsForUrl', () => {
    it('returns empty array for invalid inputs', () => {
      expect(getCardsForUrl(null as any, 'https://test.com')).toEqual([]);
      expect(getCardsForUrl([], '')).toEqual([]);
      expect(getCardsForUrl(undefined as any, 'https://test.com')).toEqual([]);
    });

    it('filters cards by clean URL', () => {
      const mockCards = [
        { id: '1', problemUrl: 'https://leetcode.com/problems/two-sum?foo=1' },
        { id: '2', problemUrl: 'https://leetcode.com/problems/two-sum#bar' },
        { id: '3', problemUrl: 'https://leetcode.com/problems/3sum' }
      ] as Card[];

      const result = getCardsForUrl(mockCards, 'https://leetcode.com/problems/two-sum');
      expect(result).toHaveLength(2);
      expect(result.map(c => c.id)).toEqual(['1', '2']);
    });

    it('handles exceptions gracefully', () => {
      const mockCards = [null] as any;
      expect(getCardsForUrl(mockCards, 'https://test.com')).toEqual([]);
    });
  });

  describe('ensureCardIds', () => {
    it('returns empty array for non-array input', () => {
      expect(ensureCardIds(null as any)).toEqual([]);
    });

    it('preserves existing card IDs', () => {
      const cards = [{ id: 'existing_1' }, { id: 'existing_2' }] as Card[];
      const result = ensureCardIds(cards);
      expect(result[0].id).toBe('existing_1');
      expect(result[1].id).toBe('existing_2');
    });

    it('generates IDs for cards missing an ID', () => {
      const cards = [{ problemTitle: 'No ID Card 1' }, { id: 'existing_1' }, { problemTitle: 'No ID Card 2' }] as unknown as Card[];
      const result = ensureCardIds(cards);
      expect(result[0].id).toBeDefined();
      expect(result[2].id).toBeDefined();
      expect(result[0].id).not.toBe(result[2].id);
      expect(result[1].id).toBe('existing_1');
    });

    it('handles unexpected errors gracefully', () => {
      const invalidCards = [
        {
          get id() {
            throw new Error('Property error');
          }
        }
      ] as any;
      expect(() => ensureCardIds(invalidCards)).not.toThrow();
    });
  });
});
