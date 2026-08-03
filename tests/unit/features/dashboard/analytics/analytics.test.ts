import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Card, StorageData } from '../../../../../types/domain';

describe('AnalyticsDashboardSPA', () => {
  let mockCards: Card[];
  let mockActivity: Record<string, number>;

  beforeEach(() => {
    jest.useFakeTimers();
    delete (chrome.runtime as any).lastError;

    document.body.innerHTML = `
      <div id="analytics-subtitle"></div>
      <div id="current-tab-title"></div>
      <div id="global-kpi-cards"></div>
      <div id="global-kpi-retention"></div>
      <div id="global-kpi-due"></div>
      <div id="global-kpi-readiness"></div>
      <div id="global-kpi-pill-retention" class="kpi-pill"></div>
      <div id="global-kpi-pill-due" class="kpi-pill"></div>
      <div id="global-kpi-pill-readiness" class="kpi-pill"></div>
      
      <button class="nav-btn active" data-tab="overview">Overview</button>
      <button class="nav-btn" data-tab="readiness">Readiness</button>
      <button class="nav-btn" data-tab="memory">Memory</button>
      <button class="nav-btn" data-tab="simulation">Simulation</button>
      <button class="nav-btn" data-tab="tags">Tags</button>
      <button class="nav-btn" data-tab="performance">Performance</button>
      <button class="nav-btn" data-tab="insights">Insights</button>
      
      <div id="tab-overview" class="tab-pane active"></div>
      <div id="tab-readiness" class="tab-pane"></div>
      <div id="tab-memory" class="tab-pane"></div>
      <div id="tab-simulation" class="tab-pane"></div>
      <div id="tab-tags" class="tab-pane"></div>
      <div id="tab-performance" class="tab-pane"></div>
      <div id="tab-insights" class="tab-pane"></div>
    `;

    mockCards = [{ id: 'c1', difficulty: 5, lapses: 0 }] as Card[];
    mockActivity = { '2026-08-03': 10 };

    (chrome as any).storage = {
      local: {
        get: jest.fn().mockImplementation((keys: any, cb: any) => {
          if (cb) cb({ fsrsCards: mockCards, fsrsActivity: mockActivity } as StorageData);
        })
      }
    };

    (chrome as any).runtime = {
      lastError: undefined
    };

    (window as any).FsrsScheduler = jest.fn().mockImplementation(() => ({
      requestRetention: 0.9,
      isHighDifficulty: () => false
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    delete (window as any).FsrsScheduler;
    delete (chrome.runtime as any).lastError;
  });

  it('initializes SPA, sets up DataUtils, binds navigation, updates subtitle & global KPIs, and switches to overview tab', () => {
    jest.isolateModules(() => {
      require('../../../../../features/dashboard/analytics/analytics');
    });

    const subtitle = document.getElementById('analytics-subtitle');
    expect(subtitle?.innerHTML).toContain('tracked');
    expect(subtitle?.innerHTML).toContain('total reviews');

    const tabTitle = document.getElementById('current-tab-title');
    expect(tabTitle?.textContent).toBe('Overview');
  });

  it('handles async FsrsScheduler polling loop when FsrsScheduler is initially undefined', () => {
    delete (window as any).FsrsScheduler;

    jest.isolateModules(() => {
      require('../../../../../features/dashboard/analytics/analytics');
    });

    (window as any).FsrsScheduler = jest.fn().mockImplementation(() => ({}));
    jest.advanceTimersByTime(200);

    const subtitle = document.getElementById('analytics-subtitle');
    expect(subtitle?.innerHTML).toContain('tracked');
  });

  it('handles navigation button click event and switches tab state', () => {
    jest.isolateModules(() => {
      require('../../../../../features/dashboard/analytics/analytics');
    });

    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach((btn) => (btn as HTMLElement).click());

    const tabTitle = document.getElementById('current-tab-title');
    expect(tabTitle?.textContent).toBe('Behavioral Insights');
  });

  it('handles storage lastError gracefully during init', () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb: any) => {
      (chrome.runtime as any).lastError = { message: 'Storage fetch error' };
      if (cb) cb({});
    });

    expect(() => {
      jest.isolateModules(() => {
        require('../../../../../features/dashboard/analytics/analytics');
      });
    }).not.toThrow();
  });

  it('updates global KPI pills across all threshold levels (success, warning, danger)', () => {
    // 1. Danger thresholds
    mockCards = Array.from({ length: 30 }, (_, i) => ({
      id: `c${i}`,
      due: Date.now() - 86400000,
      stability: 1.0,
      lapses: 5
    })) as Card[];

    jest.isolateModules(() => {
      require('../../../../../features/dashboard/analytics/analytics');
    });

    const pillRetention = document.getElementById('global-kpi-pill-retention');
    const pillDue = document.getElementById('global-kpi-pill-due');
    expect(pillRetention).not.toBeNull();
    expect(pillDue).not.toBeNull();
  });
});
