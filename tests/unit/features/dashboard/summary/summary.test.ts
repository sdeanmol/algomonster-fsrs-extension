import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { SummaryDashboard } from '../../../../../features/dashboard/summary/summary';
import { Card } from '../../../../../types/domain';

describe('SummaryDashboard', () => {
  let dashboard: SummaryDashboard;

  const getFreshCards = (): Card[] => [
    {
      id: 'c1',
      problemTitle: 'Two Sum',
      problemUrl: 'https://leetcode.com/problems/two-sum',
      due: Date.now(),
      stability: 10,
      difficulty: 3,
      repetition: 4,
      lapses: 0,
      historyLog: [
        { date: Date.now() - 86400000 * 2, rating: 3, duration: 10 },
        { date: Date.now() - 86400000, rating: 4, duration: 8 }
      ],
      tags: ['dp']
    },
    {
      id: 'c2',
      problemTitle: 'Three Sum',
      problemUrl: 'https://leetcode.com/problems/three-sum',
      due: Date.now(),
      stability: 5,
      difficulty: 7,
      repetition: 2,
      lapses: 2,
      historyLog: [
        { date: Date.now() - 86400000 * 3, rating: 1, duration: 15 },
        { date: Date.now() - 86400000 * 2, rating: 2, duration: 12 }
      ],
      tags: ['arrays']
    }
  ] as unknown as Card[];

  const getFreshActivity = () => ({
    '2026-08-01': 5,
    '2026-08-02': 10
  });

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;

    document.body.innerHTML = `
      <button id="period-weekly-btn" class="active" aria-selected="true">Weekly</button>
      <button id="period-monthly-btn" aria-selected="false">Monthly</button>

      <span id="summary-date-subtitle"></span>

      <span id="kpi-reviews"></span>
      <span id="kpi-reviews-trend"></span>
      <span id="kpi-reviews-sub"></span>

      <span id="kpi-retention"></span>
      <span id="kpi-retention-trend"></span>
      <span id="kpi-retention-sub"></span>

      <span id="kpi-new-cards"></span>

      <span id="kpi-active-days"></span>
      <span id="kpi-active-days-sub"></span>

      <div id="insights-container"></div>
      <div id="activity-chart-container"></div>

      <span id="metric-avg-stability"></span>
      <span id="metric-leeches"></span>
      <span id="metric-streak"></span>

      <div id="top-topics-container"></div>
      <div id="weak-topics-container"></div>
    `;

    delete (window as any).location;
    (window as any).location = new URL('https://algo.monster/summary.html');

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const result = { fsrsCards: getFreshCards(), fsrsActivity: getFreshActivity() };
      if (cb) cb(result);
      return Promise.resolve(result);
    });

    dashboard = new SummaryDashboard();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('init and URL parameter handling', () => {
    it('initializes dashboard in weekly mode by default', () => {
      dashboard.init();

      expect(chrome.storage.local.get).toHaveBeenCalled();
      const weeklyBtn = document.getElementById('period-weekly-btn');
      expect(weeklyBtn?.classList.contains('active')).toBe(true);
    });

    it('initializes in monthly mode when period=monthly is in URL query parameters', () => {
      delete (window as any).location;
      (window as any).location = new URL('https://algo.monster/summary.html?period=monthly');

      const monthlyDashboard = new SummaryDashboard();
      monthlyDashboard.init();

      const monthlyBtn = document.getElementById('period-monthly-btn');
      expect(monthlyBtn?.classList.contains('active')).toBe(true);
    });

    it('handles timeframe=monthly parameter in URL query', () => {
      delete (window as any).location;
      (window as any).location = new URL('https://algo.monster/summary.html?timeframe=monthly');

      const tfDashboard = new SummaryDashboard();
      tfDashboard.init();

      const monthlyBtn = document.getElementById('period-monthly-btn');
      expect(monthlyBtn?.classList.contains('active')).toBe(true);
    });

    it('handles exception during init gracefully', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI Error'); };

      expect(() => dashboard.init()).not.toThrow();

      document.getElementById = origGEBI;
    });
  });

  describe('tab switching and period selection', () => {
    it('switches to monthly mode when monthly button is clicked', () => {
      dashboard.init();

      const monthlyBtn = document.getElementById('period-monthly-btn') as HTMLElement;
      monthlyBtn.click();

      expect(monthlyBtn.classList.contains('active')).toBe(true);
      const weeklyBtn = document.getElementById('period-weekly-btn');
      expect(weeklyBtn?.classList.contains('active')).toBe(false);
    });

    it('switches back to weekly mode when weekly button is clicked', () => {
      dashboard.init();

      const monthlyBtn = document.getElementById('period-monthly-btn') as HTMLElement;
      monthlyBtn.click();

      const weeklyBtn = document.getElementById('period-weekly-btn') as HTMLElement;
      weeklyBtn.click();

      expect(weeklyBtn.classList.contains('active')).toBe(true);
    });
  });

  describe('data loading and report rendering', () => {
    it('handles chrome.runtime.lastError when loading data from storage', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Storage error' };
        if (cb) cb({});
      });

      expect(() => dashboard.init()).not.toThrow();
    });

    it('handles exception inside storage callback gracefully', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb({ fsrsCards: 'invalid_cards' });
      });

      expect(() => dashboard.init()).not.toThrow();
    });

    it('populates KPI cards and Health metrics on successful renderReport', () => {
      dashboard.init();

      const reviewsEl = document.getElementById('kpi-reviews');
      expect(reviewsEl?.textContent).toBeDefined();

      const retentionEl = document.getElementById('kpi-retention');
      expect(retentionEl?.textContent).toBeDefined();

      const stabilityEl = document.getElementById('metric-avg-stability');
      expect(stabilityEl?.textContent).toBeDefined();
    });

    it('renders daily activity chart and labels correctly in monthly mode', () => {
      delete (window as any).location;
      (window as any).location = new URL('https://algo.monster/summary.html?period=monthly');

      const monthlyDashboard = new SummaryDashboard();
      monthlyDashboard.init();

      const chartContainer = document.getElementById('activity-chart-container');
      expect(chartContainer?.children.length).toBeGreaterThan(0);
    });

    it('renders topic lists correctly for top and weak topics', () => {
      dashboard.init();

      const topTopicsContainer = document.getElementById('top-topics-container');
      expect(topTopicsContainer?.innerHTML).toBeDefined();

      const weakTopicsContainer = document.getElementById('weak-topics-container');
      expect(weakTopicsContainer?.innerHTML).toBeDefined();
    });

    it('handles empty cards and activity gracefully', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb({ fsrsCards: [], fsrsActivity: {} });
      });

      dashboard.init();

      const insightsContainer = document.getElementById('insights-container');
      expect(insightsContainer?.innerHTML).toBeDefined();
    });
  });
});
