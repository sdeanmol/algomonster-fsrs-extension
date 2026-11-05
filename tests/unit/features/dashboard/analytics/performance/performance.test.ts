import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { PerformanceTab } from '../../../../../../features/dashboard/analytics/performance/performance';
import { DataUtils } from '../../../../../../features/dashboard/analytics/utils/dataUtils';
import { Card } from '../../../../../../types/domain';

describe('PerformanceTab', () => {
  let mockDataUtils: DataUtils;
  let component: PerformanceTab;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    document.body.innerHTML = '<div id="performance-tab-container"></div>';

    mockDataUtils = {
      cards: [
        { id: 'c1', difficulty: 8, lapses: 2 },
        { id: 'c2', difficulty: 4, lapses: 0 }
      ] as Card[],
      scheduler: {
        isHighDifficulty: (c: Card) => (c.difficulty || 0) >= 7
      },
      getPerformanceStats: jest.fn().mockReturnValue({
        lapsed: [],
        recovered: []
      }),
      activity: { '2026-08-03': 5 },
      formatDateKey: (d: Date) => '2026-08-03'
    } as unknown as DataUtils;

    component = new PerformanceTab(mockDataUtils);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('constructor', () => {
    it('initializes sub-components and rendered flag correctly', () => {
      expect(component.dataUtils).toBe(mockDataUtils);
      expect(component.rendered).toBe(false);
      expect(component.reviewStats).toBeDefined();
      expect(component.recoveryTracking).toBeDefined();
    });

    it('handles constructor exception gracefully', () => {
      const faultyInit = () => new PerformanceTab(null as any);
      expect(faultyInit).not.toThrow();
    });
  });

  describe('render', () => {
    it('returns early if container element does not exist', () => {
      document.body.innerHTML = '';
      expect(() => component.render('performance-tab-container')).not.toThrow();
    });

    it('renders initial grid layout, wires select dropdown change listeners, and renders sub-panels', () => {
      component.render('performance-tab-container');

      const container = document.getElementById('performance-tab-container');
      expect(container?.innerHTML).toContain('performance-grid');
      expect(container?.innerHTML).toContain('Review Statistics');
      expect(container?.innerHTML).toContain('Trouble Spots &amp; Recovery');
      expect(component.rendered).toBe(true);
    });

    it('handles tag filter select change listener', () => {
      component.render('performance-tab-container');

      const tagFilter = document.getElementById('performance-filter-tag') as HTMLSelectElement;
      expect(tagFilter).not.toBeNull();

      const option = document.createElement('option');
      option.value = 'Array';
      option.textContent = 'Array';
      tagFilter.appendChild(option);

      tagFilter.value = 'Array';
      tagFilter.dispatchEvent(new Event('change'));

      expect(component.recoveryTracking.tagFilter).toBe('Array');
    });

    it('handles period select change listener', () => {
      component.render('performance-tab-container');

      const periodSelect = document.getElementById('review-period-select') as HTMLSelectElement;
      expect(periodSelect).not.toBeNull();

      periodSelect.value = 'weekly';
      periodSelect.dispatchEvent(new Event('change'));

      expect(component.reviewStats.period).toBe('weekly');
    });

    it('handles exception in tag filter and period select change listeners gracefully', () => {
      component.render('performance-tab-container');

      const tagFilter = document.getElementById('performance-filter-tag') as HTMLSelectElement;
      Object.defineProperty(tagFilter, 'value', {
        get: () => { throw new Error('Tag filter error'); }
      });
      expect(() => tagFilter.dispatchEvent(new Event('change'))).not.toThrow();

      const periodSelect = document.getElementById('review-period-select') as HTMLSelectElement;
      Object.defineProperty(periodSelect, 'value', {
        get: () => { throw new Error('Period select error'); }
      });
      expect(() => periodSelect.dispatchEvent(new Event('change'))).not.toThrow();
    });

    it('handles exception in render gracefully', () => {
      (component as any).reviewStats = {
        render: () => { throw new Error('Review stats render failure'); }
      };

      expect(() => component.render('performance-tab-container')).not.toThrow();
    });
  });

  describe('renderNextAction', () => {
    it('renders warning action banner when struggling cards count > 0', () => {
      component.renderNextAction('performance-tab-container');

      const container = document.getElementById('performance-tab-container');
      expect(container?.innerHTML).toContain('Next Action: Reformulate Problem Cards');
      expect(container?.innerHTML).toContain('1 cards');
    });

    it('renders success action banner when struggling cards count is 0', () => {
      mockDataUtils.cards.length = 0;
      component.renderNextAction('performance-tab-container');

      const container = document.getElementById('performance-tab-container');
      expect(container?.innerHTML).toContain('Next Action: Consistent Reviews');
    });

    it('handles card with difficulty fallback when scheduler is not present', () => {
      (mockDataUtils as any).scheduler = null;
      (mockDataUtils as any).cards = [{ difficulty: 8, lapses: 2 }];

      component.renderNextAction('performance-tab-container');

      const container = document.getElementById('performance-tab-container');
      expect(container?.innerHTML).toContain('Next Action: Reformulate Problem Cards');
    });

    it('handles exception in renderNextAction gracefully', () => {
      (mockDataUtils as any).cards = {
        forEach: () => { throw new Error('ForEach error'); }
      };

      expect(() => component.renderNextAction('performance-tab-container')).not.toThrow();
    });
  });
});
