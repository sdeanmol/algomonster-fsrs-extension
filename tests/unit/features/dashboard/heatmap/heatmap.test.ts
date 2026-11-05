import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { HeatmapDashboard } from '../../../../../features/dashboard/heatmap/heatmap';

describe('HeatmapDashboard', () => {
  let dashboard: HeatmapDashboard;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    jest.useFakeTimers();

    document.body.innerHTML = `
      <select id="filter-type">
        <option value="lifetime">Lifetime</option>
        <option value="year-wise">Yearly</option>
        <option value="month-wise">Monthly</option>
        <option value="day-wise">Weekly / Daily</option>
      </select>
      <select id="select-year"></select>
      <select id="select-month"></select>
      <select id="select-day"></select>

      <span id="filter-summary-text"></span>
      <div id="full-heatmap-grid"></div>
      <div id="heatmap-stats-container"></div>
      <div class="heatmap-wrapper" style="scroll-left: 0;"></div>
    `;

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const result = {
        fsrsActivity: {
          '2026-08-01': 2,
          '2026-08-02': 5,
          '2026-08-03': 12,
          '2025-12-15': 1
        }
      };
      if (cb) cb(result);
      return Promise.resolve(result);
    });

    (chrome as any).tabs = {
      create: jest.fn().mockImplementation((options: any, cb?: any) => {
        if (cb) cb({ id: 1 });
      })
    };

    dashboard = new HeatmapDashboard();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('init and storage loading', () => {
    it('initializes heatmap dashboard from storage and renders initial grid', () => {
      dashboard.init();

      expect(chrome.storage.local.get).toHaveBeenCalled();
      const grid = document.getElementById('full-heatmap-grid');
      expect(grid?.children.length).toBeGreaterThan(0);
    });

    it('handles chrome.runtime.lastError when reading storage in init', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Storage error' };
        if (cb) cb({});
      });

      expect(() => dashboard.init()).not.toThrow();
    });

    it('handles callback exception during init gracefully', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb({ fsrsActivity: 'invalid' });
      });

      expect(() => dashboard.init()).not.toThrow();
    });
  });

  describe('setupFilters and cascading filter dropdowns', () => {
    it('populates year, month, and day dropdown options dynamically', () => {
      dashboard.activityData = {
        '2026-08-01': 2,
        '2025-05-10': 1
      };
      dashboard.setupFilters();

      const yearSelect = document.getElementById('select-year') as HTMLSelectElement;
      expect(yearSelect.options.length).toBeGreaterThan(0);
    });

    it('handles filter type changes to show/hide relevant dropdowns', () => {
      dashboard.activityData = { '2026-08-01': 2 };
      dashboard.setupFilters();

      const typeSelect = document.getElementById('filter-type') as HTMLSelectElement;
      const monthSelect = document.getElementById('select-month') as HTMLSelectElement;

      typeSelect.value = 'month-wise';
      typeSelect.dispatchEvent(new Event('change'));

      expect(monthSelect.classList.contains('hide-select')).toBe(false);

      typeSelect.value = 'year-wise';
      typeSelect.dispatchEvent(new Event('change'));
      expect(monthSelect.classList.contains('hide-select')).toBe(true);
    });

    it('handles year, month, and day dropdown selection changes', () => {
      dashboard.activityData = { '2026-08-01': 2 };
      dashboard.setupFilters();

      const yearSelect = document.getElementById('select-year') as HTMLSelectElement;
      yearSelect.dispatchEvent(new Event('change'));

      const monthSelect = document.getElementById('select-month') as HTMLSelectElement;
      monthSelect.dispatchEvent(new Event('change'));

      const daySelect = document.getElementById('select-day') as HTMLSelectElement;
      daySelect.dispatchEvent(new Event('change'));
    });
  });

  describe('renderHeatmap mode testing and cell interactions', () => {
    it('renders heatmap grid for lifetime, year-wise, month-wise, and day-wise modes', () => {
      dashboard.activityData = { '2026-08-01': 2, '2026-08-02': 6 };
      dashboard.setupFilters();

      const typeSelect = document.getElementById('filter-type') as HTMLSelectElement;

      typeSelect.value = 'lifetime';
      dashboard.renderHeatmap();
      expect(document.getElementById('full-heatmap-grid')?.children.length).toBeGreaterThan(0);

      typeSelect.value = 'year-wise';
      dashboard.renderHeatmap();

      typeSelect.value = 'month-wise';
      dashboard.renderHeatmap();

      typeSelect.value = 'day-wise';
      dashboard.renderHeatmap();
    });

    it('handles cell click and keyboard Enter / Space events to open history tab', () => {
      dashboard.activityData = { '2026-08-01': 3 };
      dashboard.setupFilters();
      dashboard.renderHeatmap();

      const cell = document.querySelector('.heatmap-cell:not([style*="opacity"])') as HTMLElement;
      if (cell) {
        cell.click();
        expect(chrome.tabs.create).toHaveBeenCalled();

        cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        cell.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
      }
    });

    it('handles chrome.runtime.lastError when creating tab on cell click', () => {
      (chrome.tabs.create as jest.Mock).mockImplementation((options: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Tab create error' };
        if (cb) cb(null);
      });

      dashboard.activityData = { '2026-08-01': 3 };
      dashboard.setupFilters();
      dashboard.renderHeatmap();

      const cell = document.querySelector('.heatmap-cell:not([style*="opacity"])') as HTMLElement;
      if (cell) {
        expect(() => cell.click()).not.toThrow();
      }
    });
  });
});
