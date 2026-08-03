import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import FsrsOptimizerFast from '../../features/tracker/scheduler/fsrsOptimizerFast';
import { Card } from '../../types/domain';

describe('FsrsOptimizerFast', () => {
  let optimizer: FsrsOptimizerFast;

  beforeEach(() => {
    optimizer = new FsrsOptimizerFast();
  });

  describe('computeEligibility', () => {
    it('returns ineligible for null or empty history', () => {
      expect(optimizer.computeEligibility(null as any)).toEqual({ eligible: false, count: 0, threshold: 1000 });
      expect(optimizer.computeEligibility([])).toEqual({ eligible: false, count: 0, uniqueCards: 0, threshold: 1000 });
    });

    it('calculates eligibility based on review history log count', () => {
      const mockHistory = [
        { id: '1', historyLog: [{ date: 1 }, { date: 2 }, { date: 3 }] }, // 2 reviews
        { id: '2', historyLog: [{ date: 1 }] } // 0 reviews (creation only)
      ] as Card[];

      const res = optimizer.computeEligibility(mockHistory, 2);
      expect(res.eligible).toBe(true);
      expect(res.count).toBe(2);
      expect(res.uniqueCards).toBe(1);
    });
  });

  describe('trainWeights', () => {
    it('returns current weights if history has 0 total reps', async () => {
      const initialWeights = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
      const result = await optimizer.trainWeights([], initialWeights);
      expect(result).toEqual(initialWeights);
    });

    it('executes gradient descent iterations and invokes progress callback', async () => {
      const initialWeights = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
      const mockCards = [
        { id: '1', reps: 10, lapses: 1, historyLog: [{ date: 1 }, { date: 2 }] },
        { id: '2', reps: 5, lapses: 0, historyLog: [{ date: 1 }, { date: 2 }] }
      ] as Card[];

      const progressFn = jest.fn();
      optimizer.epochs = 5;

      const trained = await optimizer.trainWeights(mockCards, initialWeights, 0.90, progressFn);

      expect(progressFn).toHaveBeenCalledTimes(5);
      expect(trained.length).toBe(17);
      expect(trained[0]).not.toBe(initialWeights[0]);
    });

    it('handles optimization errors gracefully by re-throwing', async () => {
      const initialWeights = [0.4];
      const invalidCards = [
        {
          get reps() {
            throw new Error('Reps error');
          }
        }
      ] as any;

      await expect(optimizer.trainWeights(invalidCards, initialWeights)).rejects.toThrow('Reps error');
    });
  });
});
