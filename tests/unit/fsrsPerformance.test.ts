import { describe, it, expect, beforeEach } from '@jest/globals';
import FsrsOptimizerFast from '../../features/tracker/scheduler/fsrsOptimizerFast';

describe('FsrsOptimizerFast Performance & Fallback Scenario', () => {
  let fastOptimizer: FsrsOptimizerFast;
  const defaultWeights = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];

  beforeEach(() => {
    fastOptimizer = new FsrsOptimizerFast();
  });

  function generateMockHistory(numRecords: number) {
    const history: any[] = [];
    const baseDate = new Date('2024-01-01').getTime();

    for (let i = 0; i < numRecords; i++) {
      const numReviews = Math.floor(Math.random() * 9) + 2;
      const historyLog: any[] = [];

      let currentDate = baseDate;
      let lapses = 0;

      for (let j = 0; j < numReviews; j++) {
        let rating = Math.random() > 0.8 ? (Math.random() > 0.5 ? 4 : 1) : 3;
        if (rating === 1) lapses++;

        historyLog.push({ rating, date: currentDate });
        const interval = Math.floor(Math.random() * 14) + 1;
        currentDate += interval * 24 * 60 * 60 * 1000;
      }

      history.push({
        id: `mock_card_${i}`,
        reps: numReviews,
        lapses: lapses,
        historyLog: historyLog
      });
    }
    return history;
  }

  it('should process 2500 mocked records efficiently and output execution time', async () => {
    const numRecords = 2500;
    const mockHistory = generateMockHistory(numRecords);

    expect(mockHistory).toHaveLength(numRecords);

    const startTime = performance.now();
    const newWeights = await fastOptimizer.trainWeights(mockHistory, defaultWeights, 0.90);
    const endTime = performance.now();

    expect(newWeights).toBeDefined();
    expect(newWeights).toHaveLength(17);
    expect(endTime - startTime).toBeLessThan(1500);
  });
});
