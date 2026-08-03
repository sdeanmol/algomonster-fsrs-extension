import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { ForecastDashboard } from '../../../../../features/dashboard/forecast/forecast';
import { Card } from '../../../../../types/domain';

describe('ForecastDashboard', () => {
  let dashboard: ForecastDashboard;

  const now = Date.now();
  const getFreshCards = (): Card[] => [
    {
      id: 'c1',
      problemTitle: 'New Card',
      state: 0, // Should be ignored
      due: now,
      stability: 1,
      difficulty: 1,
      historyLog: []
    },
    {
      id: 'c2',
      problemTitle: 'Overdue Card',
      state: 2,
      due: now - 86400000 * 3, // Past due (offset < 0)
      stability: 2,
      difficulty: 5,
      historyLog: []
    },
    {
      id: 'c3',
      problemTitle: 'Due Today',
      state: 2,
      due: now, // Offset 0
      stability: 3,
      difficulty: 4,
      historyLog: []
    },
    {
      id: 'c4',
      problemTitle: 'Due Day 2 (Level 1)',
      state: 2,
      due: now + 86400000 * 2,
      stability: 4,
      difficulty: 3,
      historyLog: []
    },
    {
      id: 'c5',
      problemTitle: 'Due Day 5 (Level 2)',
      state: 2,
      due: now + 86400000 * 5,
      stability: 5,
      difficulty: 3,
      historyLog: []
    },
    {
      id: 'c6',
      problemTitle: 'Due Day 10 (Level 3)',
      state: 2,
      due: now + 86400000 * 10,
      stability: 5,
      difficulty: 3,
      historyLog: []
    },
    {
      id: 'c7',
      problemTitle: 'Due Day 15 (Level 4)',
      state: 2,
      due: now + 86400000 * 15,
      stability: 5,
      difficulty: 3,
      historyLog: []
    }
  ] as unknown as Card[];

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;

    document.body.innerHTML = `
      <span id="forecast-total"></span>
      <span id="forecast-avg"></span>
      <span id="forecast-peak"></span>
      <span id="forecast-today"></span>
      <span id="forecast-subtitle"></span>

      <div id="forecast-chart-wrapper"></div>
      <div id="calendar-parent">
        <div id="forecast-calendar"></div>
      </div>
    `;

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const result = {
        fsrsCards: getFreshCards(),
        chromeSettings: { showCharts: true }
      };
      if (cb) cb(result);
      return Promise.resolve(result);
    });

    (chrome as any).runtime = {
      getURL: jest.fn().mockImplementation((path: any) => `chrome-extension://mock-id/${path}`),
      lastError: undefined
    };

    (chrome as any).tabs = {
      create: jest.fn().mockImplementation((options: any, cb?: any) => {
        if (cb) cb({ id: 99 });
      })
    };

    dashboard = new ForecastDashboard();
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('init and storage loading', () => {
    it('initializes dashboard and fetches cards and settings from storage', () => {
      dashboard.init();

      expect(chrome.storage.local.get).toHaveBeenCalled();
      const totalEl = document.getElementById('forecast-total');
      expect(totalEl?.textContent).toBeDefined();
    });

    it('handles chrome.runtime.lastError when loading storage in init', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Storage quota error' };
        if (cb) cb({});
      });

      expect(() => dashboard.init()).not.toThrow();
    });

    it('handles inner exception in storage get callback gracefully', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb({ fsrsCards: 'invalid_cards_payload' });
      });

      expect(() => dashboard.init()).not.toThrow();
    });

    it('handles DOM exception during init gracefully', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI Error'); };

      expect(() => dashboard.init()).not.toThrow();

      document.getElementById = origGEBI;
    });
  });

  describe('formatDate helper methods', () => {
    it('formats short, full, and date key strings correctly', () => {
      const testDate = new Date('2026-08-15T12:00:00Z');
      expect(dashboard.formatDateShort(testDate)).toBeDefined();
      expect(dashboard.formatDateFull(testDate)).toBeDefined();
      expect(dashboard.formatDateKey(testDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('handles exceptions in date formatters and returns fallback strings', () => {
      const invalidDate = { toLocaleDateString: () => { throw new Error('Locale error'); }, toDateString: () => 'Fallback Date' } as any;
      expect(dashboard.formatDateShort(invalidDate)).toBe('Fallback Date');
      expect(dashboard.formatDateFull(invalidDate)).toBe('Fallback Date');

      const invalidKeyDate = { getTime: () => { throw new Error('Time error'); } } as any;
      expect(dashboard.formatDateKey(invalidKeyDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('renderForecast and calendar cell interactions', () => {
    it('calculates workload stats and populates DOM elements', () => {
      const cards = getFreshCards();
      dashboard.renderForecast(cards);

      const totalEl = document.getElementById('forecast-total');
      expect(parseInt(totalEl?.textContent || '0', 10)).toBeGreaterThan(0);

      const subtitleEl = document.getElementById('forecast-subtitle');
      expect(subtitleEl?.textContent).toContain('total cards');
    });

    it('returns early if forecast-calendar element is missing', () => {
      document.getElementById('forecast-calendar')?.remove();
      expect(() => dashboard.renderForecast(getFreshCards())).not.toThrow();
    });

    it('handles calendar cell click actions for days with scheduled cards', () => {
      dashboard.renderForecast(getFreshCards());

      const cells = document.querySelectorAll('.cal-cell:not(.cal-empty)');
      expect(cells.length).toBeGreaterThan(0);

      // Click cell with cards > 0
      const activeCell = Array.from(cells).find(c => (c as HTMLElement).querySelector('.cal-count')?.textContent !== '');
      if (activeCell) {
        (activeCell as HTMLElement).click();
        expect(chrome.tabs.create).toHaveBeenCalled();
      }
    });

    it('handles cell click when count is 0 (does not open tab)', () => {
      dashboard.renderForecast(getFreshCards());

      const cells = document.querySelectorAll('.cal-cell:not(.cal-empty)');
      const emptyCell = Array.from(cells).find(c => (c as HTMLElement).querySelector('.cal-count')?.textContent === '');
      if (emptyCell) {
        (emptyCell as HTMLElement).click();
        expect(chrome.tabs.create).not.toHaveBeenCalled();
      }
    });

    it('handles chrome.runtime.lastError when creating tab on cell click', () => {
      (chrome.tabs.create as jest.Mock).mockImplementation((options: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Tab create error' };
        if (cb) cb(null);
      });

      dashboard.renderForecast(getFreshCards());
      const cells = document.querySelectorAll('.cal-cell:not(.cal-empty)');
      const activeCell = Array.from(cells).find(c => (c as HTMLElement).querySelector('.cal-count')?.textContent !== '');
      if (activeCell) {
        expect(() => (activeCell as HTMLElement).click()).not.toThrow();
      }
    });
  });

  describe('renderForecastChart and chart interactions', () => {
    it('returns early if forecast-chart-wrapper is missing', () => {
      document.getElementById('forecast-chart-wrapper')?.remove();
      expect(() => dashboard.renderForecastChart({}, new Date(), 30)).not.toThrow();
    });

    it('hides chart wrapper if showCharts setting is false', () => {
      dashboard.chromeSettings = { showCharts: false };
      dashboard.renderForecastChart({}, new Date(), 30);

      const wrapper = document.getElementById('forecast-chart-wrapper');
      expect(wrapper?.style.display).toBe('none');
    });

    it('renders workload forecast chart columns and triggers tab creation on click', () => {
      dashboard.chromeSettings = { showCharts: true };
      const cards = getFreshCards();
      dashboard.renderForecast(cards);

      const chartWrapper = document.getElementById('forecast-chart-wrapper');
      expect(chartWrapper?.style.display).toBe('block');

      const barCols = chartWrapper?.querySelectorAll('.chart-bar-col.has-value');
      expect(barCols?.length).toBeGreaterThan(0);

      if (barCols && barCols[0]) {
        (barCols[0] as HTMLElement).click();
        expect(chrome.tabs.create).toHaveBeenCalled();
      }
    });

    it('handles chrome.runtime.lastError when creating tab on chart bar click', () => {
      (chrome.tabs.create as jest.Mock).mockImplementation((options: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Tab create error on bar click' };
        if (cb) cb(null);
      });

      dashboard.chromeSettings = { showCharts: true };
      dashboard.renderForecast(getFreshCards());

      const barCols = document.querySelectorAll('.chart-bar-col.has-value');
      if (barCols && barCols[0]) {
        expect(() => (barCols[0] as HTMLElement).click()).not.toThrow();
      }
    });
  });
});
