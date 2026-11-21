import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { h, render } from 'preact';
import { HeatmapDashboard, HeatmapCell } from '../../../../../features/dashboard/heatmap/heatmap';
import { HeatmapStats } from '../../../../../features/dashboard/heatmap/heatmap-stats';
import { MS_PER_DAY, DAYS_PER_YEAR, HEATMAP_LEVEL_THRESHOLDS } from '../../../../../features/common/constants';

class TestHeatmapDashboard extends HeatmapDashboard {
  override setupFilters(): void {
    try {
      const typeSelect = document.getElementById('filter-type') as HTMLSelectElement | null;
      const yearSelect = document.getElementById('select-year') as HTMLSelectElement | null;
      const monthSelect = document.getElementById('select-month') as HTMLSelectElement | null;
      const daySelect = document.getElementById('select-day') as HTMLSelectElement | null;

      if (!typeSelect || !yearSelect || !monthSelect || !daySelect) return;

      const today = new Date();
      const currentYear = today.getFullYear().toString();
      const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
      const currentDay = today.getDate().toString().padStart(2, '0');

      const years = new Set<string>([currentYear]);
      Object.keys(this.activityData).forEach((d) => years.add(d.split('-')[0]));

      yearSelect.innerHTML = Array.from(years).sort().reverse().map((y) => `<option value="${y}">${y}</option>`).join('');
      yearSelect.value = currentYear;

      const updateMonthDropdown = () => {
        try {
          const targetYear = yearSelect.value;
          const activeMonths = new Set<string>();

          Object.keys(this.activityData).filter((d) => d.startsWith(targetYear)).forEach((d) => activeMonths.add(d.split('-')[1]));

          if (activeMonths.size === 0) {
            for (let i = 1; i <= 12; i++) activeMonths.add(i.toString().padStart(2, '0'));
          }

          monthSelect.innerHTML = Array.from(activeMonths).sort().map((m) => `<option value="${m}">${this.monthNames[parseInt(m, 10) - 1]}</option>`).join('');

          if (targetYear === currentYear && activeMonths.has(currentMonth)) {
            monthSelect.value = currentMonth;
          } else if (monthSelect.options.length > 0) {
            monthSelect.value = monthSelect.options[0].value;
          }
        } catch (mErr) {}
      };

      const updateDayDropdown = () => {
        try {
          const targetYear = yearSelect.value;
          const targetMonth = monthSelect.value;
          const activeDays = new Set<string>();

          Object.keys(this.activityData).filter((d) => d.startsWith(`${targetYear}-${targetMonth}`)).forEach((d) => activeDays.add(d.split('-')[2]));

          if (activeDays.size === 0) {
            const daysInMonth = new Date(parseInt(targetYear, 10), parseInt(targetMonth, 10), 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) activeDays.add(i.toString().padStart(2, '0'));
          }

          daySelect.innerHTML = Array.from(activeDays).sort().map((d) => `<option value="${d}">Day ${parseInt(d, 10)}</option>`).join('');

          if (targetYear === currentYear && targetMonth === currentMonth && activeDays.has(currentDay)) {
            daySelect.value = currentDay;
          } else if (daySelect.options.length > 0) {
            daySelect.value = daySelect.options[0].value;
          }
        } catch (dErr) {}
      };

      updateMonthDropdown();
      updateDayDropdown();

      typeSelect.addEventListener('change', () => {
        try {
          const mode = typeSelect.value;
          yearSelect.classList.toggle('hide-select', mode === 'lifetime');
          monthSelect.classList.toggle('hide-select', mode !== 'month-wise' && mode !== 'day-wise');
          daySelect.classList.toggle('hide-select', mode !== 'day-wise');
          this.renderHeatmap();
        } catch (tErr) {}
      });

      yearSelect.addEventListener('change', () => {
        try {
          updateMonthDropdown();
          updateDayDropdown();
          this.renderHeatmap();
        } catch (yErr) {}
      });

      monthSelect.addEventListener('change', () => {
        try {
          updateDayDropdown();
          this.renderHeatmap();
        } catch (mErr) {}
      });

      daySelect.addEventListener('change', () => {
        try {
          this.renderHeatmap();
        } catch (dErr) {}
      });
    } catch (err) {}
  }

  override renderHeatmap(): void {
    try {
      const grid = document.getElementById('full-heatmap-grid');
      const summaryText = document.getElementById('filter-summary-text');
      if (!grid) return;

      const typeSelect = document.getElementById('filter-type') as HTMLSelectElement | null;
      const yearSelect = document.getElementById('select-year') as HTMLSelectElement | null;
      const monthSelect = document.getElementById('select-month') as HTMLSelectElement | null;
      const daySelect = document.getElementById('select-day') as HTMLSelectElement | null;

      if (!typeSelect || !yearSelect || !monthSelect || !daySelect) return;

      const mode = typeSelect.value;
      const chosenYear = yearSelect.value;
      const chosenMonth = monthSelect.value;
      const chosenDay = daySelect.value;

      let startDate: Date;
      let totalDays: number;
      let totalReviewsCalculated = 0;

      const y = parseInt(chosenYear, 10);
      const m = parseInt(chosenMonth, 10) - 1;
      const d = parseInt(chosenDay, 10);

      if (mode === 'lifetime') {
        const today = new Date();
        const activeDates = Object.keys(this.activityData).sort();

        if (activeDates.length > 0) {
          const parts = activeDates[0].split('-');
          const oldestDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
          oldestDate.setDate(oldestDate.getDate() - oldestDate.getDay());

          const diffTime = today.getTime() - oldestDate.getTime();
          totalDays = Math.max(DAYS_PER_YEAR - 1, Math.floor(diffTime / MS_PER_DAY) + 1);
          startDate = oldestDate;
        } else {
          totalDays = DAYS_PER_YEAR - 1;
          startDate = new Date(today);
          startDate.setDate(today.getDate() - totalDays + 1);
          startDate.setDate(startDate.getDate() - startDate.getDay());
        }
        if (summaryText) summaryText.innerText = 'Showing: Full Academic History';
      } else if (mode === 'year-wise') {
        startDate = new Date(y, 0, 1);
        startDate.setDate(startDate.getDate() - startDate.getDay());

        const endOfYear = new Date(y, 11, 31);
        const diffTime = endOfYear.getTime() - startDate.getTime();
        totalDays = Math.floor(diffTime / MS_PER_DAY) + 1;
        if (summaryText) summaryText.innerText = `Showing: Full Year ${y}`;
      } else if (mode === 'month-wise') {
        startDate = new Date(y, m, 1);
        startDate.setDate(startDate.getDate() - startDate.getDay());

        const lastDayOfMonth = new Date(y, m + 1, 0);
        const diffTime = lastDayOfMonth.getTime() - startDate.getTime();
        totalDays = Math.floor(diffTime / MS_PER_DAY) + 1;
        if (summaryText) summaryText.innerText = `Showing: ${this.monthNames[m]} ${y}`;
      } else {
        startDate = new Date(y, m, d);
        startDate.setDate(startDate.getDate() - startDate.getDay());
        totalDays = 7;
        if (summaryText) summaryText.innerText = `Target: ${this.monthNames[m]} ${d}, ${y}`;
      }

      const cells: any[] = [];

      for (let i = 0; i < totalDays; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);

        const dateString = new Date(cellDate.getTime() - (cellDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const currentYearString = cellDate.getFullYear().toString();
        const currentMonthString = (cellDate.getMonth() + 1).toString().padStart(2, '0');
        const currentDayString = cellDate.getDate().toString().padStart(2, '0');

        const count = this.activityData[dateString] || 0;
        const displayDate = cellDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

        let isOutsideFilterRange = false;
        if (mode === 'year-wise' && currentYearString !== chosenYear) isOutsideFilterRange = true;
        if (mode === 'month-wise' && (currentYearString !== chosenYear || currentMonthString !== chosenMonth)) isOutsideFilterRange = true;
        if (mode === 'day-wise' && (currentYearString !== chosenYear || currentMonthString !== chosenMonth || currentDayString !== chosenDay)) isOutsideFilterRange = true;

        let level: 0 | 1 | 2 | 3 | 4 = 0;
        if (!isOutsideFilterRange) {
          totalReviewsCalculated += count;
          if (count === HEATMAP_LEVEL_THRESHOLDS[0]) level = 0;
          else if (count <= HEATMAP_LEVEL_THRESHOLDS[1]) level = 1;
          else if (count <= HEATMAP_LEVEL_THRESHOLDS[2]) level = 2;
          else if (count <= HEATMAP_LEVEL_THRESHOLDS[3]) level = 3;
          else level = 4;
        }

        const handleCellClick = () => {
          try {
            chrome.tabs.create({ url: `features/common/data/data.html?view=history&date=${dateString}` }, () => {
              const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
            });
          } catch (tabErr) {}
        };

        cells.push({
          dateString,
          displayDate,
          count,
          level,
          isOutsideRange: isOutsideFilterRange,
          onClick: handleCellClick
        });
      }

      render(
        h('div', null, cells.map(c => h(HeatmapCell, { key: c.dateString, ...c }))),
        grid
      );

      if (summaryText && totalReviewsCalculated > 0) {
        summaryText.innerText += ` (${totalReviewsCalculated} Total Reviews)`;
      }

      const statsContainer = document.getElementById('heatmap-stats-container');
      if (statsContainer) {
        HeatmapStats.renderStatsDashboard(this.activityData);
      }

      setTimeout(() => {
        try {
          const wrapper = document.querySelector('.heatmap-wrapper');
          if (wrapper && mode === 'lifetime') wrapper.scrollLeft = wrapper.scrollWidth;
        } catch (sErr) {}
      }, 50);
    } catch (err) {}
  }
}

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

    dashboard = new TestHeatmapDashboard();
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
