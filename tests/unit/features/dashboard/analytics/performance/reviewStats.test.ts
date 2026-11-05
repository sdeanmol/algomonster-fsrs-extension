import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ReviewStats } from '../../../../../../features/dashboard/analytics/performance/reviewStats';
import { DataUtils } from '../../../../../../features/dashboard/analytics/utils/dataUtils';

describe('ReviewStats', () => {
  let mockDataUtils: DataUtils;
  let component: ReviewStats;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    document.body.innerHTML = '<div id="review-stats-container"></div>';

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    mockDataUtils = {
      activity: {
        [todayStr]: 10,
        '2026-08-01': 5,
        '2026-08-02': 8
      },
      formatDateKey: (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    } as unknown as DataUtils;

    component = new ReviewStats(mockDataUtils);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('constructor and setPeriod', () => {
    it('initializes dataUtils and default period to daily', () => {
      expect(component.dataUtils).toBe(mockDataUtils);
      expect(component.period).toBe('daily');
    });

    it('sets period correctly and handles empty fallback', () => {
      component.setPeriod('weekly');
      expect(component.period).toBe('weekly');

      component.setPeriod('');
      expect(component.period).toBe('daily');
    });
  });

  describe('render', () => {
    it('returns early if container element does not exist', () => {
      document.body.innerHTML = '';
      expect(() => component.render('review-stats-container')).not.toThrow();
    });

    it('renders empty message when activity object is empty', () => {
      (mockDataUtils as any).activity = {};
      component.render('review-stats-container');

      const container = document.getElementById('review-stats-container');
      expect(container?.innerHTML).toContain('No review activity recorded yet.');
    });

    it('renders daily review stats bars and summary mini cards', () => {
      component.setPeriod('daily');
      component.render('review-stats-container');

      const container = document.getElementById('review-stats-container');
      expect(container?.innerHTML).toContain('Total Reviews');
      expect(container?.innerHTML).toContain('Avg / Day');
      expect(container?.innerHTML).toContain('review-bars-container');
    });

    it('renders weekly review stats bars and summary mini cards', () => {
      component.setPeriod('weekly');
      component.render('review-stats-container');

      const container = document.getElementById('review-stats-container');
      expect(container?.innerHTML).toContain('Avg / Week');
      expect(container?.innerHTML).toContain('W12');
    });

    it('renders monthly review stats bars and summary mini cards', () => {
      component.setPeriod('monthly');
      component.render('review-stats-container');

      const container = document.getElementById('review-stats-container');
      expect(container?.innerHTML).toContain('Avg / Month');
      expect(container?.innerHTML).toContain('review-bars-container');
    });

    it('handles exception in render gracefully', () => {
      (mockDataUtils as any).activity = null;
      expect(() => component.render('review-stats-container')).not.toThrow();
    });
  });
});
