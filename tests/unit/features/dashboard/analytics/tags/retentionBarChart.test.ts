import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { RetentionBarChart } from '../../../../../../features/dashboard/analytics/tags/retentionBarChart';
import { DataUtils } from '../../../../../../features/dashboard/analytics/utils/dataUtils';

describe('RetentionBarChart', () => {
  let mockDataUtils: DataUtils;
  let component: RetentionBarChart;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    document.body.innerHTML = '<div id="retention-chart-container"></div>';

    (chrome as any).runtime = {
      getURL: jest.fn().mockImplementation((path: any) => `chrome-extension://mock-id/${path}`),
      lastError: undefined
    };

    (chrome as any).tabs = {
      create: jest.fn().mockImplementation((options: any, cb?: any) => {
        if (cb) cb({ id: 2 });
      })
    };

    mockDataUtils = {
      getStatsByTag: jest.fn().mockReturnValue([
        { tag: 'Array', count: 10, due: 0, trueRetention: 95, avgStability: 40.0, lapses: 1 },
        { tag: 'DP', count: 5, due: 3, trueRetention: 80, avgStability: 15.0, lapses: 5 },
        { tag: 'Graph', count: 2, due: 15, trueRetention: 65, avgStability: 5.0, lapses: 10 }
      ])
    } as unknown as DataUtils;

    component = new RetentionBarChart(mockDataUtils);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('constructor and setSortBy', () => {
    it('initializes default sortBy to retention', () => {
      expect(component.sortBy).toBe('retention');
    });

    it('sets sortBy value correctly and handles empty fallbacks', () => {
      component.setSortBy('stability');
      expect(component.sortBy).toBe('stability');

      component.setSortBy('');
      expect(component.sortBy).toBe('retention');
    });

    it('handles exception inside setSortBy gracefully', () => {
      Object.defineProperty(component, 'sortBy', {
        set: () => { throw new Error('Setter error'); }
      });
      expect(() => component.setSortBy('cards')).not.toThrow();
    });
  });

  describe('render', () => {
    it('returns early if container element is missing', () => {
      document.body.innerHTML = '';
      expect(() => component.render('retention-chart-container')).not.toThrow();
    });

    it('sorts and renders bars for retention mode with fill-good, fill-warning, fill-danger', () => {
      component.setSortBy('retention');
      component.render('retention-chart-container');

      const container = document.getElementById('retention-chart-container');
      expect(container?.innerHTML).toContain('fill-good');
      expect(container?.innerHTML).toContain('fill-warning');
      expect(container?.innerHTML).toContain('fill-danger');
    });

    it('sorts and renders bars for stability mode', () => {
      component.setSortBy('stability');
      component.render('retention-chart-container');

      const container = document.getElementById('retention-chart-container');
      expect(container?.innerHTML).toContain('40.0d');
    });

    it('sorts and renders bars for cards mode', () => {
      component.setSortBy('cards');
      component.render('retention-chart-container');

      const container = document.getElementById('retention-chart-container');
      expect(container?.innerHTML).toContain('10');
    });

    it('sorts and renders bars for lapses mode', () => {
      component.setSortBy('lapses');
      component.render('retention-chart-container');

      const container = document.getElementById('retention-chart-container');
      expect(container?.innerHTML).toContain('10');
    });

    it('handles tag badge click event to open data tab', () => {
      component.render('retention-chart-container');

      const tagSpan = document.querySelector('.clickable-tag[data-tag="Array"]') as HTMLElement;
      expect(tagSpan).not.toBeNull();

      tagSpan.click();
      expect(chrome.tabs.create).toHaveBeenCalled();
    });

    it('handles chrome.runtime.lastError in tag click callback', () => {
      (chrome.tabs.create as jest.Mock).mockImplementation((options: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Tab creation error' };
        if (cb) cb(null);
      });

      component.render('retention-chart-container');
      const tagSpan = document.querySelector('.clickable-tag[data-tag="Array"]') as HTMLElement;
      expect(() => tagSpan.click()).not.toThrow();
    });

    it('handles exception during render gracefully', () => {
      (mockDataUtils.getStatsByTag as jest.Mock).mockImplementation(() => {
        throw new Error('Sort stats error');
      });

      expect(() => component.render('retention-chart-container')).not.toThrow();
    });
  });
});
