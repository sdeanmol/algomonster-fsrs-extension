import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { TagsTab } from '../../features/dashboard/analytics/tags/tags';

jest.mock('../../features/dashboard/analytics/tags/coverageTable', () => {
  return {
    CoverageTable: jest.fn().mockImplementation(() => {
      return { render: jest.fn() };
    })
  };
});

jest.mock('../../features/dashboard/analytics/tags/retentionBarChart', () => {
  return {
    RetentionBarChart: jest.fn().mockImplementation(() => {
      return { render: jest.fn(), setSortBy: jest.fn() };
    })
  };
});

describe('TagsTab', () => {
  let mockDataUtils: any;
  let container: HTMLElement;

  beforeEach(() => {
    mockDataUtils = {
      getStatsByTag: jest.fn(() => []),
      getSummaryStats: jest.fn(() => ({ trueRetention: 90 }))
    };

    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('renders tags structure correctly on first call', () => {
    const tab = new TagsTab(mockDataUtils);
    tab.render('test-container');

    expect(document.getElementById('tags-next-action-container')).not.toBeNull();
    expect(document.getElementById('coverage-table-container')).not.toBeNull();
    expect(document.getElementById('retention-bar-chart-container')).not.toBeNull();
    expect(tab.rendered).toBe(true);
  });

  it('displays warning when a tag has low trueRetention', () => {
    mockDataUtils.getStatsByTag.mockReturnValue([
      { tag: 'Dynamic Programming', count: 10, trueRetention: 80 },
      { tag: 'Array', count: 5, trueRetention: 95 }
    ]);
    mockDataUtils.getSummaryStats.mockReturnValue({ trueRetention: 90 });

    const tab = new TagsTab(mockDataUtils);
    tab.render('test-container');

    const nextActionContainer = document.getElementById('tags-next-action-container')!;
    expect(nextActionContainer.innerHTML).toContain('warning');
    expect(nextActionContainer.innerHTML).toContain('Target Weak Tags');
    expect(nextActionContainer.innerHTML).toContain('Dynamic Programming');
  });

  it('displays success when tags are healthy', () => {
    mockDataUtils.getStatsByTag.mockReturnValue([
      { tag: 'Dynamic Programming', count: 10, trueRetention: 88 },
      { tag: 'Array', count: 5, trueRetention: 95 }
    ]);
    mockDataUtils.getSummaryStats.mockReturnValue({ trueRetention: 90 });

    const tab = new TagsTab(mockDataUtils);
    tab.render('test-container');

    const nextActionContainer = document.getElementById('tags-next-action-container')!;
    expect(nextActionContainer.innerHTML).toContain('success');
    expect(nextActionContainer.innerHTML).toContain('Maintain Tag Balance');
  });

  it('does nothing when container does not exist', () => {
    const tab = new TagsTab(mockDataUtils);
    expect(() => tab.render('nonexistent')).not.toThrow();
  });

  it('does not re-render structure on second call', () => {
    const tab = new TagsTab(mockDataUtils);
    tab.render('test-container');
    expect(tab.rendered).toBe(true);
    tab.render('test-container');
    // Just verify no error and rendered stays true
    expect(tab.rendered).toBe(true);
  });

  it('handles sort-by select change', () => {
    const tab = new TagsTab(mockDataUtils);
    tab.render('test-container');

    const sortSelect = document.getElementById('tag-sort-by') as HTMLSelectElement;
    expect(sortSelect).not.toBeNull();
    sortSelect.value = 'retention';
    sortSelect.dispatchEvent(new Event('change'));

    expect(tab.retentionBarChart.setSortBy).toHaveBeenCalledWith('retention');
    expect(tab.retentionBarChart.render).toHaveBeenCalledWith('retention-bar-chart-container');
  });

  it('does nothing on renderNextAction with missing container', () => {
    const tab = new TagsTab(mockDataUtils);
    expect(() => tab.renderNextAction('nonexistent')).not.toThrow();
  });

  it('treats low-count tags as healthy even if retention is poor', () => {
    mockDataUtils.getStatsByTag.mockReturnValue([
      { tag: 'DP', count: 2, trueRetention: 30 }, // count < 5, ignored
      { tag: 'Array', count: 5, trueRetention: 95 }
    ]);
    mockDataUtils.getSummaryStats.mockReturnValue({ trueRetention: 90 });

    const tab = new TagsTab(mockDataUtils);
    tab.render('test-container');

    const nextActionContainer = document.getElementById('tags-next-action-container')!;
    expect(nextActionContainer.innerHTML).toContain('success');
  });
});
