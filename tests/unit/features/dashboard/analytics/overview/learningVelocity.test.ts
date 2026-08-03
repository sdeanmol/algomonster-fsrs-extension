import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { LearningVelocity } from '../../../../../../features/dashboard/analytics/overview/learningVelocity';
import { DataUtils } from '../../../../../../features/dashboard/analytics/utils/dataUtils';

describe('LearningVelocity', () => {
  let mockDataUtils: DataUtils;
  let component: LearningVelocity;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    document.body.innerHTML = '<div id="learning-velocity-container"></div>';

    mockDataUtils = {
      getLearningVelocity: jest.fn().mockReturnValue({
        newCardsPerDay: 5,
        newCardsTrend: 10,
        graduatedPerWeek: 12,
        graduatedTrend: -5,
        reviewsPerDay: 45,
        reviewsTrend: 0,
        sparklineNew: [1, 2, 3, 5, 5],
        sparklineGrad: [2, 4, 6, 8, 12],
        sparklineRev: [20, 30, 40, 45, 45]
      })
    } as unknown as DataUtils;

    component = new LearningVelocity(mockDataUtils);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('constructor', () => {
    it('initializes dataUtils correctly', () => {
      expect(component.dataUtils).toBe(mockDataUtils);
    });

    it('handles exception inside constructor gracefully', () => {
      const faultyInit = () => new LearningVelocity(null as any);
      expect(faultyInit).not.toThrow();
    });
  });

  describe('render', () => {
    it('returns early if container element does not exist', () => {
      document.body.innerHTML = '';
      expect(() => component.render('learning-velocity-container')).not.toThrow();
    });

    it('renders velocity KPI cards and trend indicators for positive, negative, and zero trends', () => {
      component.render('learning-velocity-container');

      const container = document.getElementById('learning-velocity-container');
      expect(container?.innerHTML).toContain('Learning Velocity');
      expect(container?.innerHTML).toContain('trend-up'); // +10%
      expect(container?.innerHTML).toContain('trend-down'); // -5%
      expect(container?.innerHTML).toContain('0%'); // 0%
    });

    it('handles exception in render gracefully', () => {
      (mockDataUtils.getLearningVelocity as jest.Mock).mockImplementation(() => {
        throw new Error('Velocity error');
      });

      expect(() => component.render('learning-velocity-container')).not.toThrow();
    });
  });

  describe('generateSparkline', () => {
    it('returns empty string when data array is empty or null', () => {
      expect(component.generateSparkline('#fff', [])).toBe('');
      expect(component.generateSparkline('#fff', null as any)).toBe('');
    });

    it('generates SVG sparkline polyline for valid numeric data', () => {
      const svg = component.generateSparkline('#a8c7fa', [10, 20, 30]);
      expect(svg).toContain('<svg');
      expect(svg).toContain('polyline');
      expect(svg).toContain('stroke="#a8c7fa"');
    });

    it('handles exception in generateSparkline gracefully', () => {
      const faultyData = {
        get length(): number { throw new Error('Array length error'); }
      } as any;

      expect(component.generateSparkline('#fff', faultyData)).toBe('');
    });
  });
});
