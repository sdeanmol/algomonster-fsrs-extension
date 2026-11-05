import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { ReadinessTab } from '../../../../../../features/dashboard/analytics/readiness/readiness';

describe('ReadinessTab', () => {
  let mockDataUtils: any;

  beforeEach(() => {
    document.body.innerHTML = '<div id="tab-readiness"></div>';

    mockDataUtils = {
      getExamReadinessStats: jest.fn((days: number) => ({
        daysAhead: days,
        targetDate: new Date('2026-08-04T00:00:00Z'),
        overallRecall: 82,
        totalCards: 10,
        reviewedCards: 8,
        atRiskCount: 1,
        tags: [
          {
            tag: 'Physics',
            count: 4,
            reviewedCount: 4,
            expectedRecall: 96,
            avgStability: 15.4,
            status: 'Ready',
            statusClass: 'ready-high'
          },
          {
            tag: 'Math',
            count: 3,
            reviewedCount: 3,
            expectedRecall: 88,
            avgStability: 10.2,
            status: 'Moderate',
            statusClass: 'ready-medium'
          },
          {
            tag: 'Chemistry',
            count: 2,
            reviewedCount: 2,
            expectedRecall: 74,
            avgStability: 6.5,
            status: 'At Risk',
            statusClass: 'ready-critical'
          }
        ]
      }))
    };
  });

  it('renders Exam Readiness structure and subject predictions correctly', () => {
    const tab = new ReadinessTab(mockDataUtils);
    tab.render('tab-readiness');

    const container = document.getElementById('tab-readiness')!;
    expect(container.innerHTML).toContain('Exam Readiness Forecast');
    expect(container.innerHTML).toContain('Suppose exam is in');
    expect(container.innerHTML).toContain('Physics');
    expect(container.innerHTML).toContain('96%');
    expect(container.innerHTML).toContain('Chemistry');
    expect(container.innerHTML).toContain('74%');
    expect(container.innerHTML).toContain('Math');
    expect(container.innerHTML).toContain('88%');
  });

  it('updates predictions when input days change', () => {
    const tab = new ReadinessTab(mockDataUtils);
    tab.render('tab-readiness');

    const daysInput = document.getElementById('readiness-days-input') as HTMLInputElement;
    daysInput.value = '30';
    daysInput.dispatchEvent(new Event('input'));

    expect(mockDataUtils.getExamReadinessStats).toHaveBeenCalledWith(30);
  });

  it('updates predictions when preset chip is clicked', () => {
    const tab = new ReadinessTab(mockDataUtils);
    tab.render('tab-readiness');

    const chip60 = document.querySelector('.preset-chip[data-days="60"]') as HTMLElement;
    chip60.click();

    expect(mockDataUtils.getExamReadinessStats).toHaveBeenCalledWith(60);
  });

  it('does not throw when container does not exist', () => {
    const tab = new ReadinessTab(mockDataUtils);
    expect(() => tab.render('nonexistent')).not.toThrow();
  });

  it('renders empty state when no tags available', () => {
    mockDataUtils.getExamReadinessStats.mockReturnValue({
      daysAhead: 12,
      targetDate: new Date('2026-08-04T00:00:00Z'),
      overallRecall: 0,
      totalCards: 0,
      reviewedCards: 0,
      atRiskCount: 0,
      tags: []
    });

    const tab = new ReadinessTab(mockDataUtils);
    tab.render('tab-readiness');

    const container = document.getElementById('tab-readiness')!;
    expect(container.innerHTML).toContain('No Card History Available');
  });

  it('escapes HTML special characters in tag names', () => {
    const tab = new ReadinessTab(mockDataUtils);
    expect(tab.escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(tab.escapeHtml('a&b')).toBe('a&amp;b');
    expect(tab.escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    expect(tab.escapeHtml('')).toBe('');
  });

  it('ignores invalid days input values', () => {
    const tab = new ReadinessTab(mockDataUtils);
    tab.render('tab-readiness');

    const daysInput = document.getElementById('readiness-days-input') as HTMLInputElement;
    daysInput.value = 'abc';
    daysInput.dispatchEvent(new Event('input'));

    // Should not re-render with NaN
    expect(tab.daysAhead).toBe(12);
  });
});
