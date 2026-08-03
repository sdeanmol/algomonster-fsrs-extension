import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { InsightsTab } from '../../../../../../features/dashboard/analytics/insights/insights';
import { DataUtils } from '../../../../../../features/dashboard/analytics/utils/dataUtils';

describe('InsightsTab', () => {
  let mockDataUtils: DataUtils;
  let component: InsightsTab;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    document.body.innerHTML = '<div id="insights-tab-container"></div>';

    mockDataUtils = {
      getReviewTimeInsights: jest.fn().mockReturnValue({
        hasTimeData: true,
        data: [
          { bucket: 'Morning', retention: 92, reviews: 10, avgDurationMs: 12000 },
          { bucket: 'Night', retention: 70, reviews: 8, avgDurationMs: 15000 }
        ]
      })
    } as unknown as DataUtils;

    component = new InsightsTab(mockDataUtils);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('constructor', () => {
    it('initializes sub-components and rendered flag correctly', () => {
      expect(component.dataUtils).toBe(mockDataUtils);
      expect(component.rendered).toBe(false);
      expect(component.reviewTimeAnalytics).toBeDefined();
    });

    it('handles constructor exception gracefully', () => {
      const faultyInit = () => new InsightsTab(null as any);
      expect(faultyInit).not.toThrow();
    });
  });

  describe('render', () => {
    it('returns early if container element does not exist', () => {
      document.body.innerHTML = '';
      expect(() => component.render('insights-tab-container')).not.toThrow();
    });

    it('renders initial insights grid and triggers sub-components render', () => {
      component.render('insights-tab-container');

      const container = document.getElementById('insights-tab-container');
      expect(container?.innerHTML).toContain('insights-grid');
      expect(container?.innerHTML).toContain('Review Time Analytics');
      expect(component.rendered).toBe(true);
    });

    it('handles exception in render gracefully', () => {
      (component as any).reviewTimeAnalytics = {
        render: () => { throw new Error('Analytics render error'); }
      };

      expect(() => component.render('insights-tab-container')).not.toThrow();
    });
  });

  describe('renderNextAction', () => {
    it('renders Keep Reviewing warning banner when no timestamp data exists or all reviews 0', () => {
      (mockDataUtils.getReviewTimeInsights as jest.Mock).mockReturnValue({
        hasTimeData: false,
        data: []
      });

      component.renderNextAction('insights-tab-container');

      const container = document.getElementById('insights-tab-container');
      expect(container?.innerHTML).toContain('Next Action: Keep Reviewing');
    });

    it('renders Optimize Your Schedule success banner when best bucket has > 5 reviews', () => {
      component.renderNextAction('insights-tab-container');

      const container = document.getElementById('insights-tab-container');
      expect(container?.innerHTML).toContain('Next Action: Optimize Your Schedule');
      expect(container?.innerHTML).toContain('Morning');
    });

    it('renders Collect More Data banner when top retention bucket has <= 5 reviews', () => {
      (mockDataUtils.getReviewTimeInsights as jest.Mock).mockReturnValue({
        hasTimeData: true,
        data: [
          { bucket: 'Morning', retention: 92, reviews: 2, avgDurationMs: 12000 }
        ]
      });

      component.renderNextAction('insights-tab-container');

      const container = document.getElementById('insights-tab-container');
      expect(container?.innerHTML).toContain('Next Action: Collect More Data');
    });

    it('handles exception in renderNextAction gracefully', () => {
      (mockDataUtils.getReviewTimeInsights as jest.Mock).mockImplementation(() => {
        throw new Error('Insights error');
      });

      expect(() => component.renderNextAction('insights-tab-container')).not.toThrow();
    });
  });
});
