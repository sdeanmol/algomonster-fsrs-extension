import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { FSRSHistoryDashboard } from '../../../../../features/dashboard/history/history';
import { Card } from '../../../../../types/domain';

describe('FSRSHistoryDashboard', () => {
  let dashboard: FSRSHistoryDashboard;

  const getFreshCards = (): Card[] => [
    {
      id: 'c1',
      problemTitle: 'Two Sum',
      historyLog: [
        { date: new Date('2026-05-10T10:00:00Z').getTime(), rating: 3, duration: 12 },
        { date: new Date('2026-05-12T14:00:00Z').getTime(), rating: 4, duration: 8 }
      ]
    },
    {
      id: 'c2',
      problemTitle: '3Sum',
      historyLog: [
        { date: new Date('2025-11-20T09:00:00Z').getTime(), rating: 2, duration: 20 }
      ]
    }
  ] as unknown as Card[];

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;

    document.body.innerHTML = `
      <button id="view-year"></button>
      <button id="view-month"></button>
      <button id="view-day"></button>

      <div id="breadcrumb"></div>
      <div id="chart-container"></div>
      <div id="history-chart-wrapper"></div>
    `;

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const result = {
        fsrsActivity: { '2026-05-10': 1, '2026-05-12': 1, '2025-11-20': 1 },
        fsrsCards: getFreshCards(),
        chromeSettings: { showCharts: true }
      };
      if (cb) cb(result);
      return Promise.resolve(result);
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
      if (cb) cb();
      return Promise.resolve();
    });

    (chrome as any).tabs = {
      create: jest.fn().mockImplementation((options: any, cb?: any) => {
        if (cb) cb({ id: 100 });
      })
    };

    dashboard = new FSRSHistoryDashboard();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('init and storage synchronization', () => {
    it('initializes history dashboard and syncs card activity log dates', () => {
      dashboard.init();

      expect(chrome.storage.local.get).toHaveBeenCalled();
      const container = document.getElementById('chart-container');
      expect(container?.children.length).toBeGreaterThan(0);
    });

    it('triggers needsUpdate branch when activityData differs from cards expectedActivity', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb({
          fsrsActivity: { '2020-01-01': 5 }, // Stale out of sync activity data
          fsrsCards: getFreshCards()
        });
      });

      dashboard.init();
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ fsrsActivity: expect.anything() }),
        expect.any(Function)
      );
    });

    it('handles setError in fsrsActivity storage set callback', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Set activity error' };
        if (cb) cb();
      });

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb({
          fsrsActivity: { '2020-01-01': 5 },
          fsrsCards: getFreshCards()
        });
      });

      expect(() => dashboard.init()).not.toThrow();
    });

    it('handles chrome.runtime.lastError when loading storage in init', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Storage fetch failure' };
        if (cb) cb({});
      });

      expect(() => dashboard.init()).not.toThrow();
    });

    it('handles outer storage get error in init', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        throw new Error('Outer storage fetch error');
      });

      expect(() => dashboard.init()).not.toThrow();
    });
  });

  describe('view switching: year, month, day', () => {
    it('switches views and updates breadcrumbs and containers', () => {
      dashboard.activityData = { '2026-05-10': 1, '2026-05-12': 1, '2025-11-20': 1 };

      dashboard.setView('year');
      expect(dashboard.currentView).toBe('year');

      dashboard.setView('month', '2026');
      expect(dashboard.currentView).toBe('month');
      expect(dashboard.selectedYear).toBe('2026');

      dashboard.setView('day', '2026', '2026-05');
      expect(dashboard.currentView).toBe('day');
      expect(dashboard.selectedMonth).toBe('2026-05');
    });

    it('renders empty state when no activity data exists', () => {
      dashboard.activityData = {};
      dashboard.renderView();

      const container = document.getElementById('chart-container');
      expect(container?.innerHTML).toContain('No contribution activity recorded yet');
    });

    it('renders empty month or day state when specific month has no activity', () => {
      dashboard.activityData = { '2026-05-10': 1 };
      dashboard.setView('month', '2020');
      const container = document.getElementById('chart-container');
      expect(container?.innerHTML).toContain('No activity in 2020');

      dashboard.setView('day', '2020', '2020-01');
      expect(container?.innerHTML).toContain('No activity in this month');
    });

    it('gets most recent year and month accurately', () => {
      dashboard.activityData = { '2026-05-10': 1, '2025-11-20': 1 };
      expect(dashboard.getMostRecentYear()).toBe('2026');
      expect(dashboard.getMostRecentMonth('2026')).toBe('2026-05');
    });

    it('returns fallback current year and month on exceptions', () => {
      dashboard.aggregateByYear = () => { throw new Error('Aggregate year error'); };
      dashboard.aggregateByMonth = () => { throw new Error('Aggregate month error'); };

      expect(dashboard.getMostRecentYear()).toMatch(/^\d{4}$/);
      expect(dashboard.getMostRecentMonth('2026')).toBe('2026-01');
    });
  });

  describe('openDataTab and chrome tab creation', () => {
    it('opens data tab for a specified date range string', () => {
      const mockEvent = { stopPropagation: jest.fn() } as any;
      dashboard.openDataTab('2026-05-10', mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('date=2026-05-10') }),
        expect.any(Function)
      );
    });

    it('handles chrome.runtime.lastError in tab creation callback', () => {
      (chrome.tabs.create as jest.Mock).mockImplementation((options: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Tab open error' };
        if (cb) cb(null);
      });

      expect(() => dashboard.openDataTab('2026-05')).not.toThrow();
    });

    it('handles exception inside openDataTab catch block', () => {
      (chrome.tabs.create as jest.Mock).mockImplementation(() => {
        throw new Error('Tab create throw');
      });

      expect(() => dashboard.openDataTab('2026-05')).not.toThrow();
    });
  });

  describe('history chart rendering and interactive elements', () => {
    it('hides chart wrapper if showCharts is false or activityData is empty', () => {
      dashboard.chromeSettings = { showCharts: false };
      dashboard.activityData = { '2026-05-10': 1 };
      dashboard.renderHistoryChart();

      const wrapper = document.getElementById('history-chart-wrapper');
      expect(wrapper?.style.display).toBe('none');

      dashboard.chromeSettings = { showCharts: true };
      dashboard.activityData = {};
      dashboard.renderHistoryChart();
      expect(wrapper?.style.display).toBe('none');
    });

    it('renders chart bars for year, month, and day views and responds to click & keydown events', () => {
      dashboard.activityData = { '2026-05-10': 2, '2026-05-12': 1 };
      dashboard.chromeSettings = { showCharts: true };

      dashboard.setView('year');
      let barCol = document.querySelector('.chart-bar-col');
      if (barCol) {
        (barCol as HTMLElement).click();
        expect(dashboard.currentView).toBe('month');
      }

      dashboard.setView('month', '2026');
      barCol = document.querySelector('.chart-bar-col.has-value');
      if (barCol) {
        barCol.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(dashboard.currentView).toBe('day');
      }

      dashboard.setView('day', '2026', '2026-05');
      barCol = document.querySelector('.chart-bar-col.has-value');
      if (barCol) {
        barCol.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
        expect(chrome.tabs.create).toHaveBeenCalled();
      }
    });

    it('handles exceptions in chart bar click & keydown handlers gracefully', () => {
      dashboard.activityData = { '2026-05-10': 2 };
      dashboard.chromeSettings = { showCharts: true };
      dashboard.setView('year');

      dashboard.setView = () => { throw new Error('Chart action error'); };

      const barCol = document.querySelector('.chart-bar-col');
      if (barCol) {
        expect(() => (barCol as HTMLElement).click()).not.toThrow();
        expect(() => barCol.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))).not.toThrow();
      }
    });
  });

  describe('dynamic card, breadcrumb, and button click listeners', () => {
    it('handles card, breadcrumb, and button click events across views', () => {
      dashboard.activityData = { '2026-05-10': 1, '2025-11-20': 1 };

      dashboard.setView('day', '2026', '2026-05');

      const bcYear = document.querySelector('.bc-year') as HTMLElement;
      if (bcYear) bcYear.click();
      expect(dashboard.currentView).toBe('year');

      const yearCard = document.querySelector('.card-year') as HTMLElement;
      if (yearCard) yearCard.click();
      expect(dashboard.currentView).toBe('month');

      const bcMonth = document.querySelector('.bc-month') as HTMLElement;
      if (bcMonth) bcMonth.click();
      expect(dashboard.currentView).toBe('month');

      const monthCard = document.querySelector('.card-month') as HTMLElement;
      if (monthCard) monthCard.click();
      expect(dashboard.currentView).toBe('day');

      const btnYear = document.querySelector('.btn-year') as HTMLElement;
      if (btnYear) btnYear.click();

      const btnMonth = document.querySelector('.btn-month') as HTMLElement;
      if (btnMonth) btnMonth.click();

      dashboard.setView('day', '2026', '2026-05');
      const dayCard = document.querySelector('.card-day') as HTMLElement;
      if (dayCard) dayCard.click();
      expect(chrome.tabs.create).toHaveBeenCalled();
    });

    it('handles callback exceptions inside dynamic click listeners gracefully', () => {
      dashboard.activityData = { '2026-05-10': 1 };
      dashboard.setView('day', '2026', '2026-05');

      dashboard.openDataTab = () => { throw new Error('OpenDataTab error'); };
      dashboard.setView = () => { throw new Error('SetView error'); };

      document.querySelectorAll('.bc-year, .bc-month, .card-year, .card-month, .btn-year, .btn-month, .card-day').forEach(el => {
        expect(() => (el as HTMLElement).click()).not.toThrow();
      });
    });

    it('triggers view buttons via click handlers and handles callback exceptions', () => {
      dashboard.init();

      document.getElementById('view-month')?.click();
      expect(dashboard.currentView).toBe('month');

      document.getElementById('view-day')?.click();
      expect(dashboard.currentView).toBe('day');

      document.getElementById('view-year')?.click();
      expect(dashboard.currentView).toBe('year');

      // Trigger exception handlers
      dashboard.setView = () => { throw new Error('SetView error'); };
      expect(() => document.getElementById('view-month')?.click()).not.toThrow();
    });
  });

  describe('aggregation helpers exception handling', () => {
    it('returns empty objects when exceptions occur in aggregate helpers', () => {
      Object.defineProperty(dashboard, 'activityData', {
        get: () => { throw new Error('activityData getter error'); }
      });

      expect(dashboard.aggregateByYear()).toEqual({});
      expect(dashboard.aggregateByMonth('2026')).toEqual({});
      expect(dashboard.aggregateByDay('2026-05')).toEqual({});
    });
  });
});
