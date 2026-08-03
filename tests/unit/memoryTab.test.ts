import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MemoryTab } from '../../features/dashboard/analytics/memory/memory';
import { PredictionComparison } from '../../features/dashboard/analytics/memory/predictionComparison';
import { DataUtils } from '../../features/dashboard/analytics/utils/dataUtils';

describe('MemoryTab and PredictionComparison', () => {
  let dataUtils: DataUtils;
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'memory-tab-container';
    document.body.appendChild(container);

    dataUtils = new DataUtils([], {}, null);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('PredictionComparison', () => {
    it('renders comparison chart into container', () => {
      const pred = new PredictionComparison(dataUtils);
      pred.render('memory-tab-container');

      expect(container.innerHTML).toContain('prediction-svg');
      expect(container.innerHTML).toContain('Predicted Retention');
      expect(container.innerHTML).toContain('Actual Recall');
    });
  });

  describe('MemoryTab', () => {
    it('renders memory tab grid, filters, and actionable insights', () => {
      const memoryTab = new MemoryTab(dataUtils);
      memoryTab.render('memory-tab-container');

      expect(container.innerHTML).toContain('Multiple Retention Curves');
      expect(container.innerHTML).toContain('Actual vs Predicted Recall');

      // Test next action banners (Clear Overdue, Calibrate, Keep up)
      jest.spyOn(dataUtils, 'getSummaryStats').mockReturnValue({
        totalCards: 10,
        reviewedCards: 5,
        totalReps: 20,
        totalLapses: 2,
        retention: 75,
        trueRetention: 75,
        avgStability: 10,
        totalActivityReviews: 20,
        due: 3,
        dueToday: 3,
        streak: 5
      });

      memoryTab.renderNextAction('memory-tab-container');
      expect(container.innerHTML).toContain('Clear Overdue Reviews');
    });
  });
});
