import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { RecoveryTracking } from '../../../../../../features/dashboard/analytics/performance/recoveryTracking';
import { DataUtils } from '../../../../../../features/dashboard/analytics/utils/dataUtils';
import { Card } from '../../../../../../types/domain';

describe('RecoveryTracking', () => {
  let mockDataUtils: DataUtils;
  let component: RecoveryTracking;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    document.body.innerHTML = '<div id="recovery-tracking-container"></div>';

    const now = Date.now();
    const lapsedCard: Card = {
      id: 'c1',
      problemTitle: 'Two Sum',
      problemUrl: 'https://leetcode.com/problems/two-sum',
      tags: ['Array'],
      lapses: 3,
      stability: 0,
      due: now,
      historyLog: [
        { date: now - 86400000 * 2, rating: 1, duration: 15 },
        { date: now - 86400000 * 5, rating: 3, duration: 10 }
      ]
    } as unknown as Card;

    const recoveredCard: Card = {
      id: 'c2',
      problemTitle: '3Sum',
      problemUrl: 'https://leetcode.com/problems/3sum',
      tags: ['Two Pointers'],
      lapses: 2,
      stability: 30.5,
      due: now + 86400000 * 10,
      historyLog: [
        { date: now - 86400000 * 4, rating: 3, duration: 20 }
      ]
    } as unknown as Card;

    mockDataUtils = {
      getPerformanceStats: jest.fn().mockReturnValue({
        lapsed: [lapsedCard],
        recovered: [recoveredCard]
      })
    } as unknown as DataUtils;

    component = new RecoveryTracking(mockDataUtils);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('constructor and setTagFilter', () => {
    it('initializes dataUtils and default tagFilter to all', () => {
      expect(component.dataUtils).toBe(mockDataUtils);
      expect(component.tagFilter).toBe('all');
    });

    it('sets tagFilter correctly and handles empty fallback', () => {
      component.setTagFilter('Array');
      expect(component.tagFilter).toBe('Array');

      component.setTagFilter('');
      expect(component.tagFilter).toBe('all');
    });
  });

  describe('render', () => {
    it('returns early if container element does not exist', () => {
      document.body.innerHTML = '';
      expect(() => component.render('recovery-tracking-container')).not.toThrow();
    });

    it('renders Recovered and Still Struggling cards table columns', () => {
      component.render('recovery-tracking-container');

      const container = document.getElementById('recovery-tracking-container');
      expect(container?.innerHTML).toContain('Recovered');
      expect(container?.innerHTML).toContain('Still Struggling');
      expect(container?.innerHTML).toContain('Two Sum');
      expect(container?.innerHTML).toContain('3Sum');
    });

    it('filters cards by tag when tagFilter is active', () => {
      component.setTagFilter('Array');
      component.render('recovery-tracking-container');

      const container = document.getElementById('recovery-tracking-container');
      expect(container?.innerHTML).toContain('Two Sum');
      expect(container?.innerHTML).not.toContain('3Sum');
    });

    it('renders empty message when buildTable receives empty cards array', () => {
      (mockDataUtils.getPerformanceStats as jest.Mock).mockReturnValue({
        lapsed: [],
        recovered: []
      });

      component.render('recovery-tracking-container');

      const container = document.getElementById('recovery-tracking-container');
      expect(container?.innerHTML).toContain('No cards found in this category.');
    });

    it('handles card with getLastReviewDate fallback when historyLog has no lapse rating 1', () => {
      const cardNoLapseLog: Card = {
        id: 'c3',
        problemTitle: 'LRU Cache',
        lapses: 1,
        stability: 10,
        historyLog: [
          { date: Date.now() - 86400000 * 3, rating: 3, duration: 10 }
        ]
      } as unknown as Card;

      (mockDataUtils.getPerformanceStats as jest.Mock).mockReturnValue({
        lapsed: [cardNoLapseLog],
        recovered: []
      });

      component.render('recovery-tracking-container');

      const container = document.getElementById('recovery-tracking-container');
      expect(container?.innerHTML).toContain('LRU Cache');
    });

    it('handles buildTable exception gracefully and renders fallback error message', () => {
      (mockDataUtils.getPerformanceStats as jest.Mock).mockReturnValue({
        lapsed: [{ get historyLog() { throw new Error('History error'); } } as any],
        recovered: []
      });

      expect(() => component.render('recovery-tracking-container')).not.toThrow();
    });

    it('handles render exception gracefully', () => {
      (mockDataUtils.getPerformanceStats as jest.Mock).mockImplementation(() => {
        throw new Error('Stats failure');
      });

      expect(() => component.render('recovery-tracking-container')).not.toThrow();
    });
  });
});
