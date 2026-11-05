import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { CoverageTable } from '../../../../../../features/dashboard/analytics/tags/coverageTable';
import { DataUtils } from '../../../../../../features/dashboard/analytics/utils/dataUtils';
import { Card } from '../../../../../../types/domain';

describe('CoverageTable', () => {
  let mockDataUtils: DataUtils;
  let component: CoverageTable;

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    document.body.innerHTML = '<div id="coverage-table-container"></div>';

    (chrome as any).runtime = {
      getURL: jest.fn().mockImplementation((path: any) => `chrome-extension://mock-id/${path}`),
      lastError: undefined
    };

    (chrome as any).tabs = {
      create: jest.fn().mockImplementation((options: any, cb?: any) => {
        if (cb) cb({ id: 1 });
      })
    };

    mockDataUtils = {
      cards: [
        { id: 'c1', tags: ['Array'] },
        { id: 'c2', tags: ['Graph'] }
      ] as Card[],
      getStatsByTag: jest.fn().mockReturnValue([
        { tag: 'Array', count: 5, due: 0, trueRetention: 90, avgStability: 12.5, lapses: 0 },
        { tag: 'DP', count: 3, due: 4, trueRetention: 80, avgStability: 5.0, lapses: 2 },
        { tag: 'Graph', count: 8, due: 8, trueRetention: 75, avgStability: 4.2, lapses: 3 },
        { tag: 'Tree', count: 12, due: 15, trueRetention: 70, avgStability: 3.1, lapses: 5 },
        { tag: 'String', count: 20, due: 25, trueRetention: 60, avgStability: 2.0, lapses: 8 }
      ])
    } as unknown as DataUtils;

    component = new CoverageTable(mockDataUtils);
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('constructor', () => {
    it('initializes dataUtils property correctly', () => {
      expect(component.dataUtils).toBe(mockDataUtils);
    });

    it('handles exception inside constructor gracefully', () => {
      const faultyInit = () => new CoverageTable(null as any);
      expect(faultyInit).not.toThrow();
    });
  });

  describe('render', () => {
    it('returns early if container element does not exist', () => {
      document.body.innerHTML = '';
      expect(() => component.render('coverage-table-container')).not.toThrow();
    });

    it('renders empty message when getStatsByTag returns empty array', () => {
      (mockDataUtils.getStatsByTag as jest.Mock).mockReturnValue([]);
      component.render('coverage-table-container');

      const container = document.getElementById('coverage-table-container');
      expect(container?.innerHTML).toContain('No tags found.');
    });

    it('renders tag stats table with coverage bars and color classes across all due count thresholds', () => {
      component.render('coverage-table-container');

      const container = document.getElementById('coverage-table-container');
      expect(container?.innerHTML).toContain('coverage-table');
      expect(container?.innerHTML).toContain('Array');
      expect(container?.innerHTML).toContain('tag-color-4'); // due 0
      expect(container?.innerHTML).toContain('tag-color-2'); // due 4
      expect(container?.innerHTML).toContain('tag-color-5'); // due 8
      expect(container?.innerHTML).toContain('tag-color-1'); // due 15
      expect(container?.innerHTML).toContain('tag-color-6'); // due 25
    });

    it('handles tag badge click event to open data tab with tag query parameter', () => {
      component.render('coverage-table-container');

      const tagSpan = document.querySelector('.clickable-tag[data-tag="Array"]') as HTMLElement;
      expect(tagSpan).not.toBeNull();

      tagSpan.click();
      expect(chrome.tabs.create).toHaveBeenCalledWith(
        expect.objectContaining({ url: expect.stringContaining('tag=Array') }),
        expect.any(Function)
      );
    });

    it('handles chrome.runtime.lastError inside tag click callback', () => {
      (chrome.tabs.create as jest.Mock).mockImplementation((options: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Tab creation failed' };
        if (cb) cb(null);
      });

      component.render('coverage-table-container');
      const tagSpan = document.querySelector('.clickable-tag[data-tag="Array"]') as HTMLElement;
      expect(() => tagSpan.click()).not.toThrow();
    });

    it('handles exception in render gracefully', () => {
      (mockDataUtils.getStatsByTag as jest.Mock).mockImplementation(() => {
        throw new Error('Stats computation error');
      });

      expect(() => component.render('coverage-table-container')).not.toThrow();
    });
  });
});
