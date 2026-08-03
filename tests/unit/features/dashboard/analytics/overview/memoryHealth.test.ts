import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MemoryHealth } from '../../../../../../features/dashboard/analytics/overview/memoryHealth';
import { DataUtils } from '../../../../../../features/dashboard/analytics/utils/dataUtils';

describe('MemoryHealth', () => {
  let mockDataUtils: DataUtils;
  let component: MemoryHealth;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    document.body.innerHTML = '<div id="memory-health-container"></div>';

    mockDataUtils = {
      scheduler: { requestRetention: 0.9 },
      getSummaryStats: jest.fn().mockReturnValue({
        totalCards: 20,
        dueToday: 3,
        trueRetention: 88,
        retention: 85,
        totalLapses: 4,
        avgStability: 15.2,
        streak: 5
      })
    } as unknown as DataUtils;

    component = new MemoryHealth(mockDataUtils);
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
      const faultyInit = () => new MemoryHealth(null as any);
      expect(faultyInit).not.toThrow();
    });
  });

  describe('render', () => {
    it('returns early if container element does not exist', () => {
      document.body.innerHTML = '';
      expect(() => component.render('memory-health-container')).not.toThrow();
    });

    it('renders Memory Health card with Excellent status and streak trend for high retention and streak >= 3', () => {
      component.render('memory-health-container');

      const container = document.getElementById('memory-health-container');
      expect(container?.innerHTML).toContain('Memory Health Score');
      expect(container?.innerHTML).toContain('health-excellent');
      expect(container?.innerHTML).toContain('▲ Consistent');
    });

    it('renders Needs Attention status when healthScore < targetRetention - 7', () => {
      (mockDataUtils.getSummaryStats as jest.Mock).mockReturnValue({
        totalCards: 20,
        dueToday: 5,
        trueRetention: 75, // < 90 - 7 (83)
        retention: 75,
        totalLapses: 10,
        avgStability: 5.0,
        streak: 1
      });

      component.render('memory-health-container');

      const container = document.getElementById('memory-health-container');
      expect(container?.innerHTML).toContain('Needs Attention');
      expect(container?.innerHTML).toContain('health-warning');
      expect(container?.innerHTML).toContain('▶ Active');
    });

    it('renders Good status when targetRetention - 7 <= healthScore < targetRetention - 2', () => {
      (mockDataUtils.getSummaryStats as jest.Mock).mockReturnValue({
        totalCards: 20,
        dueToday: 0,
        trueRetention: 85, // between 83 and 88
        retention: 85,
        totalLapses: 2,
        avgStability: 12.0,
        streak: 0
      });

      component.render('memory-health-container');

      const container = document.getElementById('memory-health-container');
      expect(container?.innerHTML).toContain('Good');
      expect(container?.innerHTML).toContain('health-good');
      expect(container?.innerHTML).toContain('▼ Needs Review');
    });

    it('renders Need Data status when healthScore is 0', () => {
      (mockDataUtils.getSummaryStats as jest.Mock).mockReturnValue({
        totalCards: 0,
        dueToday: 0,
        trueRetention: 0,
        retention: 0,
        totalLapses: 0,
        avgStability: 0,
        streak: 0
      });

      component.render('memory-health-container');

      const container = document.getElementById('memory-health-container');
      expect(container?.innerHTML).toContain('Need Data');
      expect(container?.innerHTML).toContain('health-nodata');
    });

    it('handles exception in render gracefully', () => {
      (mockDataUtils.getSummaryStats as jest.Mock).mockImplementation(() => {
        throw new Error('Summary stats failure');
      });

      expect(() => component.render('memory-health-container')).not.toThrow();
    });
  });
});
