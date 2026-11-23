import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { act } from 'preact/test-utils';
import { Card, StorageData } from '../../../../../types/domain';

describe('AnalyticsDashboardSPA (Branch Coverage)', () => {
  let mockCards: Card[];
  let mockActivity: Record<string, number>;

  beforeEach(() => {
    jest.useFakeTimers();
    delete (chrome.runtime as any).lastError;

    document.body.innerHTML = '<div id="root"></div>';

    mockCards = [{ id: 'c1', difficulty: 5, lapses: 0, due: Date.now() + 86400000, stability: 10 }] as Card[];
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

  it('initializes SPA, sets subtitle, binds nav, and renders initial overview tab', () => {
    act(() => {
      jest.isolateModules(() => {
        require('../../../../../features/dashboard/analytics/analytics');
      });
      jest.runAllTimers();
    });

    const subtitle = document.getElementById('analytics-subtitle');
    expect(subtitle?.innerHTML).toContain('tracked');
    expect(subtitle?.innerHTML).toContain('total reviews');

    const tabTitle = document.getElementById('current-tab-title');
    expect(tabTitle?.textContent).toBe('Overview');
  });

  it('navigates through all 7 valid tab buttons and updates active class states', () => {
    act(() => {
      jest.isolateModules(() => {
        require('../../../../../features/dashboard/analytics/analytics');
      });
    });

    const tabsToTest = ['readiness', 'memory', 'simulation', 'tags', 'performance', 'insights', 'overview'];
    for (const tabKey of tabsToTest) {
      const btn = document.querySelector(`.nav-btn[data-tab="${tabKey}"]`) as HTMLElement;
      expect(btn).not.toBeNull();
      act(() => {
        btn.click();
        jest.runAllTimers();
      });

      const pane = document.getElementById(`tab-${tabKey}`);
      expect(pane?.classList.contains('active')).toBe(true);
    }
  });

  it('handles navigation click on button gracefully', () => {
    act(() => {
      jest.isolateModules(() => {
        require('../../../../../features/dashboard/analytics/analytics');
      });
    });

    const anyBtn = document.querySelector('.nav-btn') as HTMLElement;
    expect(anyBtn).not.toBeNull();
    expect(() => {
      act(() => {
        anyBtn.click();
      });
    }).not.toThrow();
  });

  it('updates global KPI pills across all retention, due count, and readiness thresholds', () => {
    // 1. Success thresholds
    mockCards = [{ id: 'c1', stability: 30, lapses: 0, due: Date.now() + 86400000, lastReview: Date.now() - 3600000 }] as unknown as Card[];
    document.body.innerHTML = '<div id="root"></div>';
    act(() => {
      jest.isolateModules(() => {
        require('../../../../../features/dashboard/analytics/analytics');
      });
    });

    const pillRetention = document.getElementById('global-kpi-pill-retention');
    const pillDue = document.getElementById('global-kpi-pill-due');
    expect(pillRetention).not.toBeNull();
    expect(pillDue).not.toBeNull();

    // 2. Warning due (<=20)
    mockCards = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`,
      due: Date.now() - 86400000,
      stability: 3.0,
      lapses: 1
    })) as Card[];

    document.body.innerHTML = '<div id="root"></div>';
    act(() => {
      jest.isolateModules(() => {
        require('../../../../../features/dashboard/analytics/analytics');
      });
      jest.runAllTimers();
    });
    const pillDueWarning = document.getElementById('global-kpi-pill-due');
    expect(pillDueWarning?.classList.contains('warning')).toBe(true);

    // 3. Danger due (>20)
    mockCards = Array.from({ length: 25 }, (_, i) => ({
      id: `c${i}`,
      due: Date.now() - 86400000,
      stability: 0.1,
      lapses: 8
    })) as Card[];

    document.body.innerHTML = '<div id="root"></div>';
    act(() => {
      jest.isolateModules(() => {
        require('../../../../../features/dashboard/analytics/analytics');
      });
      jest.runAllTimers();
    });
    const pillDueDanger = document.getElementById('global-kpi-pill-due');
    expect(pillDueDanger?.classList.contains('danger')).toBe(true);
  });

  it('handles missing KPI DOM elements gracefully without throwing', () => {
    document.body.innerHTML = '';

    expect(() => {
      act(() => {
        jest.isolateModules(() => {
          require('../../../../../features/dashboard/analytics/analytics');
        });
      });
    }).not.toThrow();
  });

  it('handles async FsrsScheduler polling retries when window.FsrsScheduler is loaded after delay', () => {
    delete (window as any).FsrsScheduler;

    act(() => {
      jest.isolateModules(() => {
        require('../../../../../features/dashboard/analytics/analytics');
      });
    });

    act(() => {
      jest.advanceTimersByTime(200);
      (window as any).FsrsScheduler = jest.fn().mockImplementation(() => ({}));
      jest.advanceTimersByTime(200);
    });

    const subtitle = document.getElementById('analytics-subtitle');
    expect(subtitle?.innerHTML).toContain('tracked');
  });

  it('handles polling retry timeout after 50 retries when FsrsScheduler never loads', () => {
    delete (window as any).FsrsScheduler;

    act(() => {
      jest.isolateModules(() => {
        require('../../../../../features/dashboard/analytics/analytics');
      });
    });

    act(() => {
      jest.advanceTimersByTime(5200);
      jest.runAllTimers();
    });

    const subtitle = document.getElementById('analytics-subtitle');
    expect(subtitle?.innerHTML).toContain('tracked');
  });

  it('handles storage lastError gracefully during init callback', () => {
    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb: any) => {
      (chrome.runtime as any).lastError = { message: 'Storage error' };
      if (cb) cb({});
    });

    expect(() => {
      jest.isolateModules(() => {
        require('../../../../../features/dashboard/analytics/analytics');
      });
    }).not.toThrow();
  });

  it('UX-012: analytics sidebar footer links to data dashboard instead of popup', () => {
    const fs = require('fs');
    const path = require('path');
    const htmlPath = path.resolve(__dirname, '../../../../../features/dashboard/analytics/analytics.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    expect(html).toContain('id="root"');

    const { h, render } = require('preact');
    const { AnalyticsSidebar } = require('../../../../../features/dashboard/analytics/analytics');
    const testDiv = document.createElement('div');
    render(h(AnalyticsSidebar, { currentTab: 'overview', onSelectTab: () => {} }), testDiv);

    expect(testDiv.innerHTML).not.toContain('View All Patterns');
    render(null, testDiv);
    testDiv.remove();
  });
});
