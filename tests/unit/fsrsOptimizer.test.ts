import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import FsrsOptimizer from '../../features/tracker/scheduler/fsrsOptimizer';
import { Card } from '../../types/domain';

// Mock the WASM dynamic binding module
jest.mock('@open-spaced-repetition/binding/dynamic-wasi', () => ({
  initOptimizer: jest.fn(async () => ({
    FSRSBindingReview: class MockReview {
      rating: number;
      deltaT: number;
      constructor(rating: number, deltaT: number) {
        this.rating = rating;
        this.deltaT = deltaT;
      }
    },
    FSRSBindingItem: class MockItem {
      reviews: any[];
      constructor(reviews: any[]) {
        this.reviews = reviews;
      }
    },
    computeParameters: jest.fn(async (items: any[], options: any) => {
      if (options?.progress) {
        options.progress(50, 50);
      }
      return [0.5, 0.7, 2.5, 6.0, 5.0, 1.0, 0.9, 0.02, 1.5, 0.15, 1.0, 2.2, 0.06, 0.35, 1.3, 0.3, 2.7];
    })
  }))
}));

describe('FsrsOptimizer (WASM)', () => {
  let optimizer: FsrsOptimizer;

  beforeEach(() => {
    optimizer = new FsrsOptimizer();
  });

  describe('computeEligibility', () => {
    it('returns ineligible for null or empty cards array', () => {
      expect(optimizer.computeEligibility(null as any)).toEqual({ eligible: false, count: 0, threshold: 1000 });
      expect(optimizer.computeEligibility([])).toEqual({ eligible: false, count: 0, uniqueCards: 0, threshold: 1000 });
    });

    it('computes eligible review count across card history logs', () => {
      const cards = [
        { id: 'c1', historyLog: [{ date: 100 }, { date: 200 }, { date: 300 }] }, // 2 reviews
        { id: 'c2', historyLog: [{ date: 100 }] } // 0 reviews
      ] as Card[];

      const res = optimizer.computeEligibility(cards, 2);
      expect(res.eligible).toBe(true);
      expect(res.count).toBe(2);
      expect(res.uniqueCards).toBe(1);
    });
  });

  describe('trainWeights', () => {
    it('returns current weights when history is empty', async () => {
      const weights = [0.4, 0.6];
      const res = await optimizer.trainWeights([], weights);
      expect(res).toBe(weights);
    });

    it('returns current weights when trainSet has no valid deltaT > 0 reviews', async () => {
      const weights = [0.4, 0.6];
      const cards = [
        { id: 'c1', historyLog: [{ rating: 3, date: 100 }] } // only creation event
      ] as Card[];

      const res = await optimizer.trainWeights(cards, weights);
      expect(res).toBe(weights);
    });

    it('trains WASM parameters when valid review logs exist', async () => {
      const weights = Array(17).fill(0.1);
      const now = Date.now();
      const oneDayMs = 86400000;

      const cards = [
        {
          id: 'c1',
          historyLog: [
            { rating: 'again', date: now - (oneDayMs * 10) },
            { rating: 'good', date: now - (oneDayMs * 5) },
            { rating: 'easy', date: now }
          ]
        }
      ] as unknown as Card[];

      const progressFn = jest.fn();
      const trained = await optimizer.trainWeights(cards, weights, 0.90, progressFn);

      expect(trained.length).toBe(17);
      expect(trained[0]).toBe(0.5);
      expect(progressFn).toHaveBeenCalledWith(50, 50);
    });

    it('caps training set at OPTIMIZER_MAX_TRAINING_CARDS limit', async () => {
      const weights = Array(17).fill(0.1);
      const now = Date.now();
      const oneDayMs = 86400000;

      const card = {
        id: 'c1',
        historyLog: [
          { rating: 3, date: now - oneDayMs },
          { rating: 3, date: now }
        ]
      } as Card;

      // Create 1005 cards (exceeding OPTIMIZER_MAX_TRAINING_CARDS = 1000)
      const manyCards = Array(1005).fill(card);

      const trained = await optimizer.trainWeights(manyCards, weights);
      expect(trained).toBeDefined();
    });
  });
});
