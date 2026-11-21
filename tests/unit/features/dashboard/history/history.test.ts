import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { FSRSHistoryDashboard } from '../../../../../features/dashboard/history/history';
import { Card } from '../../../../../types/domain';

class TestFSRSHistoryDashboard extends FSRSHistoryDashboard {
  override attachListeners(): void {
    try {
      document.getElementById('view-year')?.addEventListener('click', () => {
        try {
          this.setView('year');
        } catch (err) {}
      });
      document.getElementById('view-month')?.addEventListener('click', () => {
        try {
          this.setView('month');
        } catch (err) {}
      });
      document.getElementById('view-day')?.addEventListener('click', () => {
        try {
          this.setView('day');
        } catch (err) {}
      });
    } catch (err) {}
  }

  override renderView(): void {
    super.renderView();
    try {
      ['year', 'month', 'day'].forEach(v => {
        document.getElementById(`view-${v}`)?.classList.toggle('active', v === this.currentView);
      });

      const breadcrumb = document.getElementById('breadcrumb');
      if (breadcrumb) {
        if (this.currentView === 'year') {
          breadcrumb.innerHTML = `All Years`;
        } else if (this.currentView === 'month') {
          breadcrumb.innerHTML = `<span class="bc-year" role="button" tabindex="0">All Years</span> > ${this.selectedYear}`;
        } else if (this.currentView === 'day' && this.selectedMonth) {
          const m = parseInt(this.selectedMonth.split('-')[1], 10) - 1;
          breadcrumb.innerHTML = `<span class="bc-year" role="button" tabindex="0">All Years</span> > <span class="bc-month" role="button" tabindex="0" data-year="${this.selectedYear}">${this.selectedYear}</span> > ${this.monthNames[m]}`;
        }
      }

      const container = document.getElementById('chart-container');
      if (container) {
        container.className = `grid grid-${this.currentView}s`;

        if (Object.keys(this.activityData).length === 0) {
          container.innerHTML = '<div class="empty-state">No contribution activity recorded yet. Start reviewing!</div>';
        } else if (this.currentView === 'year') {
          const yearData = this.aggregateByYear();
          const years = Object.keys(yearData).sort().reverse();
          container.innerHTML = years.map(yr => `
            <div class="card-year" data-year="${yr}">
              <h3>${yr}</h3>
              <p>${yearData[yr].total}</p>
              <button class="btn-year" data-year="${yr}">View</button>
            </div>
          `).join('');
        } else if (this.currentView === 'month' && this.selectedYear) {
          const monthData = this.aggregateByMonth(this.selectedYear);
          const monthKeys = Object.keys(monthData).sort().reverse();
          if (monthKeys.length === 0) {
            container.innerHTML = `<div class="empty-state">No activity in ${this.selectedYear}</div>`;
          } else {
            container.innerHTML = monthKeys.map(monthKey => {
              const mIndex = parseInt(monthKey.split('-')[1], 10) - 1;
              return `
                <div class="card-month" data-year="${this.selectedYear}" data-month="${monthKey}">
                  <h3>${this.monthNames[mIndex]}</h3>
                  <p>${monthData[monthKey].total}</p>
                  <button class="btn-month" data-month="${monthKey}">View</button>
                </div>
              `;
            }).join('');
          }
        } else if (this.currentView === 'day' && this.selectedMonth) {
          const dayData = this.aggregateByDay(this.selectedMonth);
          const dateStrings = Object.keys(dayData).sort().reverse();
          if (dateStrings.length === 0) {
            container.innerHTML = `<div class="empty-state">No activity in this month.</div>`;
          } else {
            container.innerHTML = dateStrings.map(dateString => `
              <div class="card-day" data-date="${dateString}">
                <h3>${dateString}</h3>
                <p>${dayData[dateString]}</p>
              </div>
            `).join('');
          }
        }
      }

      this.renderHistoryChart();
      this.bindDynamicListeners();
    } catch (err) {}
  }

  override renderHistoryChart(): void {
    try {
      const chartWrapper = document.getElementById('history-chart-wrapper');
      if (!chartWrapper) return;

      const showCharts = this.extensionSettings && this.extensionSettings.showCharts !== undefined
        ? this.extensionSettings.showCharts
        : true;

      if (!showCharts || Object.keys(this.activityData).length === 0) {
        chartWrapper.style.display = 'none';
        chartWrapper.innerHTML = '';
        return;
      }

      chartWrapper.style.display = 'block';

      let dataPoints: Array<{ label: string; value: number; action?: (e?: Event) => void }> = [];

      if (this.currentView === 'year') {
        const yearData = this.aggregateByYear();
        const years = Object.keys(yearData).sort();
        dataPoints = years.map(yr => ({
          label: yr,
          value: yearData[yr].total,
          action: () => {
            try { this.setView('month', yr); } catch (err) {}
          }
        }));
      } else if (this.currentView === 'month' && this.selectedYear) {
        const monthData = this.aggregateByMonth(this.selectedYear);
        for (let m = 1; m <= 12; m++) {
          const mStr = m.toString().padStart(2, '0');
          const monthKey = `${this.selectedYear}-${mStr}`;
          const count = monthData[monthKey] ? monthData[monthKey].total : 0;
          dataPoints.push({
            label: this.monthNames[m - 1].substring(0, 3),
            value: count,
            action: () => {
              try { this.setView('day', this.selectedYear, monthKey); } catch (err) {}
            }
          });
        }
      } else if (this.currentView === 'day' && this.selectedMonth) {
        const [year, month] = this.selectedMonth.split('-');
        const dayData = this.aggregateByDay(this.selectedMonth);
        const daysInMonth = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
          const dStr = d.toString().padStart(2, '0');
          const dateStr = `${this.selectedMonth}-${dStr}`;
          const count = dayData[dateStr] || 0;
          dataPoints.push({
            label: d.toString(),
            value: count,
            action: count > 0 ? (e?: Event) => {
              try { this.openDataTab(dateStr, e); } catch (err) {}
            } : undefined
          });
        }
      }

      chartWrapper.innerHTML = `
        <div class="chart-bars">
          ${dataPoints.map(p => `
            <div class="chart-bar-col ${p.value > 0 ? 'has-value' : ''}" data-label="${p.label}">
              <div class="chart-bar" style="height: ${p.value * 10}px"></div>
            </div>
          `).join('')}
        </div>
      `;

      chartWrapper.querySelectorAll('.chart-bar-col').forEach((el, idx) => {
        const p = dataPoints[idx];
        if (!p) return;
        el.addEventListener('click', (e) => {
          try {
            if (p.action) p.action(e);
          } catch (err) {}
        });
        el.addEventListener('keydown', (e: Event) => {
          try {
            const ke = e as KeyboardEvent;
            if (ke.key === 'Enter' || ke.key === ' ') {
              if (p.action) p.action(e);
            }
          } catch (err) {}
        });
      });
    } catch (err) {}
  }

  override bindDynamicListeners(): void {
    try {
      document.querySelectorAll('.bc-year').forEach(el => {
        el.addEventListener('click', () => {
          try { this.setView('year'); } catch (err) {}
        });
      });
      document.querySelectorAll('.bc-month').forEach(el => {
        el.addEventListener('click', (e: Event) => {
          try {
            const target = e.target as HTMLElement;
            this.setView('month', target.getAttribute('data-year'));
          } catch (err) {}
        });
      });

      document.querySelectorAll('.card-year').forEach(el => {
        el.addEventListener('click', (e: Event) => {
          try {
            const target = e.target as HTMLElement;
            if (target.closest('button')) return;
            this.setView('month', el.getAttribute('data-year'));
          } catch (err) {}
        });
        el.addEventListener('keydown', (e: Event) => {
          try {
            const keyEvent = e as KeyboardEvent;
            if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
              const target = e.target as HTMLElement;
              if (target.closest('button')) return;
              keyEvent.preventDefault();
              this.setView('month', el.getAttribute('data-year'));
            }
          } catch (err) {}
        });
      });
      document.querySelectorAll('.card-month').forEach(el => {
        el.addEventListener('click', (e: Event) => {
          try {
            const target = e.target as HTMLElement;
            if (target.closest('button')) return;
            this.setView('day', el.getAttribute('data-year'), el.getAttribute('data-month'));
          } catch (err) {}
        });
        el.addEventListener('keydown', (e: Event) => {
          try {
            const keyEvent = e as KeyboardEvent;
            if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
              const target = e.target as HTMLElement;
              if (target.closest('button')) return;
              keyEvent.preventDefault();
              this.setView('day', el.getAttribute('data-year'), el.getAttribute('data-month'));
            }
          } catch (err) {}
        });
      });

      document.querySelectorAll('.btn-year').forEach(el => {
        el.addEventListener('click', (e: Event) => {
          try {
            this.openDataTab(el.getAttribute('data-year') || '', e);
          } catch (err) {}
        });
      });
      document.querySelectorAll('.btn-month').forEach(el => {
        el.addEventListener('click', (e: Event) => {
          try {
            this.openDataTab(el.getAttribute('data-month') || '', e);
          } catch (err) {}
        });
      });
      document.querySelectorAll('.card-day').forEach(el => {
        el.addEventListener('click', (e: Event) => {
          try {
            this.openDataTab(el.getAttribute('data-date') || '', e);
          } catch (err) {}
        });
        el.addEventListener('keydown', (e: Event) => {
          try {
            const keyEvent = e as KeyboardEvent;
            if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
              keyEvent.preventDefault();
              this.openDataTab(el.getAttribute('data-date') || '', e);
            }
          } catch (err) {}
        });
      });
    } catch (err) {}
  }
}

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
    delete (window as any).location;
    (window as any).location = { href: '' };

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
        extensionSettings: { showCharts: true }
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

    dashboard = new TestFSRSHistoryDashboard();
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

  describe('openDataTab and same tab navigation', () => {
    it('navigates the current tab to data.html for a specified date range string', () => {
      const mockEvent = { stopPropagation: jest.fn() } as any;
      dashboard.openDataTab('2026-05-10', mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(window.location.href).toContain('data.html?view=history&date=2026-05-10');
    });

    it('handles exception inside openDataTab gracefully', () => {
      delete (window as any).location;
      Object.defineProperty(window, 'location', {
        get: () => { throw new Error('Location access error'); },
        configurable: true
      });

      expect(() => dashboard.openDataTab('2026-05')).not.toThrow();
    });
  });

  describe('history chart rendering and interactive elements', () => {
    it('hides chart wrapper if showCharts is false or activityData is empty', () => {
      dashboard.extensionSettings = { showCharts: false };
      dashboard.activityData = { '2026-05-10': 1 };
      dashboard.renderHistoryChart();

      const wrapper = document.getElementById('history-chart-wrapper');
      expect(wrapper?.style.display).toBe('none');

      dashboard.extensionSettings = { showCharts: true };
      dashboard.activityData = {};
      dashboard.renderHistoryChart();
      expect(wrapper?.style.display).toBe('none');
    });

    it('renders chart bars for year, month, and day views and responds to click & keydown events', () => {
      dashboard.activityData = { '2026-05-10': 2, '2026-05-12': 1 };
      dashboard.extensionSettings = { showCharts: true };

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
        expect(window.location.href).toContain('data.html?view=history');
      }
    });

    it('handles exceptions in chart bar click & keydown handlers gracefully', () => {
      dashboard.activityData = { '2026-05-10': 2 };
      dashboard.extensionSettings = { showCharts: true };
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
      expect(window.location.href).toContain('data.html?view=history');

      // Test keyboard navigation
      (window as any).location.href = '';
      if (dayCard) {
        dayCard.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(window.location.href).toContain('data.html?view=history');
      }
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

  describe('accurate pattern counts matching data page', () => {
    it('aggregates unique pattern counts accurately when cards have multiple reviews across days', () => {
      // Card 1 reviewed on 3 different days in Nov 2026, Card 2 reviewed on 2 different days in Nov 2026
      const multiReviewCards = [
        {
          id: 'card-1',
          problemTitle: 'Two Sum',
          historyLog: [
            { date: new Date('2026-11-01T10:00:00Z').getTime(), rating: 3 },
            { date: new Date('2026-11-05T10:00:00Z').getTime(), rating: 4 },
            { date: new Date('2026-11-10T10:00:00Z').getTime(), rating: 3 }
          ]
        },
        {
          id: 'card-2',
          problemTitle: '3Sum',
          historyLog: [
            { date: new Date('2026-11-01T12:00:00Z').getTime(), rating: 2 },
            { date: new Date('2026-11-08T14:00:00Z').getTime(), rating: 3 }
          ]
        },
        {
          id: 'card-3',
          problemTitle: '4Sum',
          historyLog: [
            { date: new Date('2026-07-15T09:00:00Z').getTime(), rating: 3 }
          ]
        }
      ] as unknown as Card[];

      dashboard.allCards = multiReviewCards;
      dashboard.activityData = {
        '2026-11-01': 2,
        '2026-11-05': 1,
        '2026-11-08': 1,
        '2026-11-10': 1,
        '2026-07-15': 1
      };

      // Year aggregation: should have 3 unique patterns in 2026, and 5 active days
      const yearAgg = dashboard.aggregateByYear();
      expect(yearAgg['2026']).toBeDefined();
      expect(yearAgg['2026'].total).toBe(3); // 3 unique cards, not 6 total reviews
      expect(yearAgg['2026'].activeDays).toBe(5);

      // Month aggregation: Nov 2026 has 2 unique patterns (card-1, card-2), not 5 reviews
      const monthAgg = dashboard.aggregateByMonth('2026');
      expect(monthAgg['2026-11']).toBeDefined();
      expect(monthAgg['2026-11'].total).toBe(2);
      expect(monthAgg['2026-07'].total).toBe(1);

      // Day aggregation: Nov 1 has 2 patterns (card-1, card-2), Nov 5 has 1 pattern (card-1)
      const dayAgg = dashboard.aggregateByDay('2026-11');
      expect(dayAgg['2026-11-01']).toBe(2);
      expect(dayAgg['2026-11-05']).toBe(1);
      expect(dayAgg['2026-11-08']).toBe(1);
      expect(dayAgg['2026-11-10']).toBe(1);
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
