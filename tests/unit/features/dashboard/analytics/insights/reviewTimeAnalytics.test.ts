import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ReviewTimeAnalytics } from '../../../../../../features/dashboard/analytics/insights/reviewTimeAnalytics';
import { DataUtils } from '../../../../../../features/dashboard/analytics/utils/dataUtils';

describe('ReviewTimeAnalytics', () => {
  let mockDataUtils: DataUtils;
  let component: ReviewTimeAnalytics;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    document.body.innerHTML = '<div id="review-time-analytics-container"></div>';

    mockDataUtils = {
      getReviewTimeInsights: jest.fn().mockReturnValue({
        hasTimeData: true,
        data: [
          { bucket: 'morning', retention: 90, reviews: 15, avgDurationMs: 12000 },
          { bucket: 'afternoon', retention: 80, reviews: 10, avgDurationMs: 15000 },
          { bucket: 'evening', retention: 85, reviews: 20, avgDurationMs: 14000 },
          { bucket: 'night', retention: 70, reviews: 8, avgDurationMs: 18000 }
        ]
      })
    } as unknown as DataUtils;

    component = new ReviewTimeAnalytics(mockDataUtils);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('constructor', () => {
    it('initializes dataUtils property correctly', () => {
      expect(component.dataUtils).toBe(mockDataUtils);
    });

    it('handles constructor exception gracefully', () => {
      const faultyInit = () => new ReviewTimeAnalytics(null as any);
      expect(faultyInit).not.toThrow();
    });
  });

  describe('render', () => {
    it('returns early if container element does not exist', () => {
      document.body.innerHTML = '';
      expect(() => component.render('review-time-analytics-container')).not.toThrow();
    });

    it('renders empty message when hasTimeData is false or reviews are 0', () => {
      (mockDataUtils.getReviewTimeInsights as jest.Mock).mockReturnValue({
        hasTimeData: false,
        data: []
      });

      component.render('review-time-analytics-container');

      const container = document.getElementById('review-time-analytics-container');
      expect(container?.innerHTML).toContain('Not enough timestamp data available');
    });

    it('renders single best study time highlight text and SVG retention trend chart', () => {
      component.render('review-time-analytics-container');

      const container = document.getElementById('review-time-analytics-container');
      expect(container?.innerHTML).toContain('Morning');
      expect(container?.innerHTML).toContain('90% recall');
      expect(container?.innerHTML).toContain('<svg');
      expect(container?.innerHTML).toContain('<line');
      expect(container?.innerHTML).toContain('<circle');
    });

    it('renders multiple top study time highlight text when multiple buckets tie', () => {
      (mockDataUtils.getReviewTimeInsights as jest.Mock).mockReturnValue({
        hasTimeData: true,
        data: [
          { bucket: 'morning', retention: 90, reviews: 15, avgDurationMs: 12000 },
          { bucket: 'afternoon', retention: 90, reviews: 10, avgDurationMs: 15000 },
          { bucket: 'evening', retention: 85, reviews: 20, avgDurationMs: 14000 },
          { bucket: 'night', retention: 70, reviews: 8, avgDurationMs: 18000 }
        ]
      });

      component.render('review-time-analytics-container');

      const container = document.getElementById('review-time-analytics-container');
      expect(container?.innerHTML).toContain('Morning and Afternoon');
    });

    it('renders all-bucket tie highlight text when all 4 buckets have equal top retention', () => {
      (mockDataUtils.getReviewTimeInsights as jest.Mock).mockReturnValue({
        hasTimeData: true,
        data: [
          { bucket: 'morning', retention: 90, reviews: 15, avgDurationMs: 12000 },
          { bucket: 'afternoon', retention: 90, reviews: 10, avgDurationMs: 15000 },
          { bucket: 'evening', retention: 90, reviews: 20, avgDurationMs: 14000 },
          { bucket: 'night', retention: 90, reviews: 8, avgDurationMs: 18000 }
        ]
      });

      component.render('review-time-analytics-container');

      const container = document.getElementById('review-time-analytics-container');
      expect(container?.innerHTML).toContain('all times of day');
    });

    it('renders default highlight text when reviews in buckets are <= 5', () => {
      (mockDataUtils.getReviewTimeInsights as jest.Mock).mockReturnValue({
        hasTimeData: true,
        data: [
          { bucket: 'morning', retention: 90, reviews: 2, avgDurationMs: null },
          { bucket: 'afternoon', retention: 80, reviews: 1, avgDurationMs: null }
        ]
      });

      component.render('review-time-analytics-container');

      const container = document.getElementById('review-time-analytics-container');
      expect(container?.innerHTML).toContain('Keep reviewing to discover your optimal study time!');
      expect(container?.innerHTML).toContain('N/A');
    });

    it('handles exception in render gracefully', () => {
      (mockDataUtils.getReviewTimeInsights as jest.Mock).mockImplementation(() => {
        throw new Error('Review time stats error');
      });

      expect(() => component.render('review-time-analytics-container')).not.toThrow();
    });
  });
});
