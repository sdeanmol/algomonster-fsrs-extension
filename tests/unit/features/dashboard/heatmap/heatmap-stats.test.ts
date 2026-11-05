import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { HeatmapStats } from '../../../../../features/dashboard/heatmap/heatmap-stats';

describe('HeatmapStats', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="heatmap-stats-container"></div>
    `;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('renderStatsDashboard', () => {
    it('returns early if container element does not exist', () => {
      document.body.innerHTML = '';
      expect(() => HeatmapStats.renderStatsDashboard({})).not.toThrow();
    });

    it('renders streak stat cards for given activity data', () => {
      const activityData = {
        '2026-08-01': 5,
        '2026-08-02': 10
      };

      HeatmapStats.renderStatsDashboard(activityData);

      const container = document.getElementById('heatmap-stats-container');
      expect(container?.innerHTML).toContain('Current Streak');
      expect(container?.innerHTML).toContain('Longest Streak');
      expect(container?.innerHTML).toContain('Active Days');
      expect(container?.innerHTML).toContain('Max Reviews');
    });

    it('handles exception in renderStatsDashboard gracefully', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('DOM Error'); };

      expect(() => HeatmapStats.renderStatsDashboard({})).not.toThrow();
      document.getElementById = origGEBI;
    });
  });

  describe('getStreakStats', () => {
    it('returns zero stats when activity data is empty', () => {
      const stats = HeatmapStats.getStreakStats({});
      expect(stats).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        activeDays: 0,
        maxReviews: 0
      });
    });

    it('calculates streaks, active days, and max reviews accurately for continuous activity', () => {
      const today = new Date();
      const todayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

      const yesterday = new Date(today.getTime() - 86400000);
      const yesterdayStr = new Date(yesterday.getTime() - (yesterday.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

      const dayBefore = new Date(today.getTime() - 86400000 * 2);
      const dayBeforeStr = new Date(dayBefore.getTime() - (dayBefore.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

      const activityData = {
        [dayBeforeStr]: 3,
        [yesterdayStr]: 7,
        [todayStr]: 15
      };

      const stats = HeatmapStats.getStreakStats(activityData);

      expect(stats.activeDays).toBe(3);
      expect(stats.maxReviews).toBe(15);
      expect(stats.currentStreak).toBe(3);
      expect(stats.longestStreak).toBe(3);
    });

    it('calculates streaks with gaps correctly', () => {
      const activityData = {
        '2026-01-01': 5,
        '2026-01-02': 4,
        '2026-01-03': 6,
        '2026-01-10': 2, // gap
        '2026-01-11': 8
      };

      const stats = HeatmapStats.getStreakStats(activityData);

      expect(stats.activeDays).toBe(5);
      expect(stats.maxReviews).toBe(8);
      expect(stats.longestStreak).toBe(3);
      expect(stats.currentStreak).toBe(0); // since Jan 2026 is in past relative to today
    });

    it('handles exception in getStreakStats and returns default zero object', () => {
      const invalidData = {
        get '2026-01-01'(): number { throw new Error('Property getter error'); }
      } as any;

      const stats = HeatmapStats.getStreakStats(invalidData);
      expect(stats).toEqual({
        currentStreak: 0,
        longestStreak: 0,
        activeDays: 0,
        maxReviews: 0
      });
    });
  });
});
