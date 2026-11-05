import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { MemoryTab } from '../../../../../../features/dashboard/analytics/memory/memory';
import { PredictionComparison } from '../../../../../../features/dashboard/analytics/memory/predictionComparison';
import { DataUtils } from '../../../../../../features/dashboard/analytics/utils/dataUtils';

describe('MemoryTab and PredictionComparison', () => {
  let dataUtils: DataUtils;
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'memory-tab-container';
    document.body.appendChild(container);

    dataUtils = new DataUtils([], {}, null);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('PredictionComparison', () => {
    it('renders comparison chart into container without scheduler', () => {
      const pred = new PredictionComparison(dataUtils);
      pred.render('memory-tab-container');

      expect(container.innerHTML).toContain('prediction-svg');
      expect(container.innerHTML).toContain('Predicted Retention');
      expect(container.innerHTML).toContain('Actual Recall');
    });

    it('renders comparison chart with custom scheduler getProjectedRetrievability', () => {
      const mockScheduler = {
        getProjectedRetrievability: jest.fn((s: number, t: number) => 0.95)
      };
      (dataUtils as any).scheduler = mockScheduler;

      const pred = new PredictionComparison(dataUtils);
      pred.render('memory-tab-container');

      expect(mockScheduler.getProjectedRetrievability).toHaveBeenCalled();
      expect(container.innerHTML).toContain('Actual recall is tracking closely to predictions!');
    });

    it('returns early when container does not exist', () => {
      const pred = new PredictionComparison(dataUtils);
      expect(() => pred.render('nonexistent-container')).not.toThrow();
    });
  });


  describe('MemoryTab', () => {
    it('renders memory tab grid, filters, and actionable insights', () => {
      const memoryTab = new MemoryTab(dataUtils);
      memoryTab.render('memory-tab-container');

      expect(container.innerHTML).toContain('Multiple Retention Curves');
      expect(container.innerHTML).toContain('Actual vs Predicted Recall');
    });

    it('handles controls change and input events (group by, tag filter, confidence band)', () => {
      const memoryTab = new MemoryTab(dataUtils);
      memoryTab.render('memory-tab-container');

      const groupBySelect = container.querySelector('#retention-group-by') as HTMLSelectElement;
      const tagFilterInput = container.querySelector('#retention-tag-filter') as HTMLInputElement;
      const confidenceToggle = container.querySelector('#toggle-confidence-bands') as HTMLInputElement;
      const tagFilterWrapper = container.querySelector('#tag-filter-wrapper') as HTMLElement;

      expect(groupBySelect).not.toBeNull();
      expect(tagFilterInput).not.toBeNull();
      expect(confidenceToggle).not.toBeNull();

      // Change group by to deck
      groupBySelect.value = 'deck';
      groupBySelect.dispatchEvent(new Event('change'));
      expect(memoryTab.retentionChart.groupBy).toBe('deck');
      expect(tagFilterWrapper.style.display).toBe('none');

      // Change group by back to tag
      groupBySelect.value = 'tag';
      groupBySelect.dispatchEvent(new Event('change'));
      expect(tagFilterWrapper.style.display).toBe('flex');

      // Input tag filter
      tagFilterInput.value = 'array';
      tagFilterInput.dispatchEvent(new Event('input'));
      expect(memoryTab.retentionChart.filterTag).toBe('array');

      // Toggle confidence band
      confidenceToggle.checked = true;
      confidenceToggle.dispatchEvent(new Event('change'));
      expect(memoryTab.retentionChart.showConfidence).toBe(true);
    });

    it('renders personal memory status with default parameters', () => {
      (global as any).chrome = {
        storage: {
          local: {
            get: jest.fn().mockImplementation((keys: any, cb?: any) => {
              const res = { fsrsGlobalParams: { version: 'default', timestamp: 1600000000000 } };
              if (cb) cb(res);
              return Promise.resolve(res);
            })
          }
        }
      };

      const memoryTab = new MemoryTab(dataUtils);
      memoryTab.renderPersonalMemoryStatus('memory-tab-container');
      expect(container.innerHTML).toContain('Default Weights');
      expect(container.innerHTML).toContain('Personal Memory Model');
    });

    it('renders personal memory status with personalized parameters', () => {
      (global as any).chrome = {
        storage: {
          local: {
            get: jest.fn().mockImplementation((keys: any, cb?: any) => {
              const res = { fsrsGlobalParams: { version: 'personalized_v1', timestamp: 1600000000000 } };
              if (cb) cb(res);
              return Promise.resolve(res);
            })
          }
        }
      };

      const memoryTab = new MemoryTab(dataUtils);
      memoryTab.renderPersonalMemoryStatus('memory-tab-container');
      expect(container.innerHTML).toContain('Optimized');
    });

    it('renders next action banner for overdue reviews', () => {
      const memoryTab = new MemoryTab(dataUtils);
      jest.spyOn(dataUtils, 'getSummaryStats').mockReturnValue({
        due: 3,
        retention: 75
      } as any);

      memoryTab.renderNextAction('memory-tab-container');
      expect(container.innerHTML).toContain('Clear Overdue Reviews');
    });

    it('renders next action banner for algorithm calibration requirement', () => {
      const memoryTab = new MemoryTab(dataUtils);
      jest.spyOn(dataUtils, 'getSummaryStats').mockReturnValue({
        due: 0,
        retention: 80 // requested is 90, drop is 10 > 5
      } as any);

      memoryTab.renderNextAction('memory-tab-container');
      expect(container.innerHTML).toContain('Calibrate Algorithm Parameters');
    });

    it('renders next action banner for good memory calibration', () => {
      const memoryTab = new MemoryTab(dataUtils);
      jest.spyOn(dataUtils, 'getSummaryStats').mockReturnValue({
        due: 0,
        retention: 88 // requested is 90, drop is 2 <= 5
      } as any);

      memoryTab.renderNextAction('memory-tab-container');
      expect(container.innerHTML).toContain('Keep up the Good Work');
    });

    it('handles non-existent container gracefully', () => {
      const memoryTab = new MemoryTab(dataUtils);
      expect(() => memoryTab.render('non-existent')).not.toThrow();
      expect(() => memoryTab.renderNextAction('non-existent')).not.toThrow();
      expect(() => memoryTab.renderPersonalMemoryStatus('non-existent')).not.toThrow();
    });

    it('handles constructor exception fallback gracefully', () => {
      const origRC = (dataUtils as any).RetentionChart;
      // Force RetentionChart constructor inside MemoryTab constructor to throw
      jest.mock('../../../../../../features/dashboard/analytics/memory/retentionChart', () => ({
        RetentionChart: jest.fn().mockImplementationOnce(() => {
          throw new Error('Constructor Error');
        })
      }));

      expect(() => new MemoryTab(dataUtils)).not.toThrow();
    });

    it('handles error catch blocks in event listeners and render methods', () => {
      const memoryTab = new MemoryTab(dataUtils);
      memoryTab.render('memory-tab-container');

      // 1. Group By listener exception
      jest.spyOn(memoryTab.retentionChart, 'setGroupBy').mockImplementationOnce(() => {
        throw new Error('GroupBy Error');
      });
      const groupBySelect = container.querySelector('#retention-group-by') as HTMLSelectElement;
      expect(() => groupBySelect.dispatchEvent(new Event('change'))).not.toThrow();

      // 2. Tag Filter listener exception
      jest.spyOn(memoryTab.retentionChart, 'setFilterTag').mockImplementationOnce(() => {
        throw new Error('TagFilter Error');
      });
      const tagFilterInput = container.querySelector('#retention-tag-filter') as HTMLInputElement;
      expect(() => tagFilterInput.dispatchEvent(new Event('input'))).not.toThrow();

      // 3. Confidence Toggle listener exception
      jest.spyOn(memoryTab.retentionChart, 'setShowConfidence').mockImplementationOnce(() => {
        throw new Error('Confidence Error');
      });
      const confidenceToggle = container.querySelector('#toggle-confidence-bands') as HTMLInputElement;
      expect(() => confidenceToggle.dispatchEvent(new Event('change'))).not.toThrow();

      // 4. Render exception
      jest.spyOn(memoryTab.retentionChart, 'render').mockImplementationOnce(() => {
        throw new Error('Render Error');
      });
      expect(() => memoryTab.render('memory-tab-container')).not.toThrow();

      // 5. Next action render exception
      jest.spyOn(dataUtils, 'getSummaryStats').mockImplementationOnce(() => {
        throw new Error('SummaryStats Error');
      });
      expect(() => memoryTab.renderNextAction('memory-tab-container')).not.toThrow();
    });

    it('handles chrome.runtime.lastError and storage callback exception in renderPersonalMemoryStatus', () => {
      (global as any).chrome = {
        runtime: { lastError: { message: 'Storage Error' } },
        storage: {
          local: {
            get: jest.fn().mockImplementation((keys: any, cb?: any) => {
              if (cb) cb(null);
              return Promise.resolve();
            })
          }
        }
      };

      const memoryTab = new MemoryTab(dataUtils);
      expect(() => memoryTab.renderPersonalMemoryStatus('memory-tab-container')).not.toThrow();

      // Outer method exception (e.g. document.getElementById throws)
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI error'); };

      expect(() => memoryTab.renderPersonalMemoryStatus('memory-tab-container')).not.toThrow();

      document.getElementById = origGEBI;
    });
  });
});

