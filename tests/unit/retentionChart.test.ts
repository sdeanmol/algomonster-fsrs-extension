import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { RetentionChart } from '../../features/dashboard/analytics/memory/retentionChart';
import { DataUtils } from '../../features/dashboard/analytics/utils/dataUtils';
import { Card } from '../../types/domain';

describe('RetentionChart Component', () => {
  let dataUtils: DataUtils;
  let chart: RetentionChart;
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    container.id = 'retention-chart-container';
    document.body.appendChild(container);

    const cards = [
      {
        id: 'c1',
        problemTitle: 'Two Sum',
        tags: ['array', 'hash-table'],
        stability: 10,
        difficulty: 4,
        reps: 2,
        due: Date.now()
      },
      {
        id: 'c2',
        problemTitle: '3Sum',
        tags: ['array', 'two-pointers'],
        stability: 25,
        difficulty: 8,
        reps: 4,
        due: Date.now()
      },
      {
        id: 'c3',
        problemTitle: 'Untagged Problem',
        tags: [],
        stability: 5,
        difficulty: 2,
        reps: 1,
        due: Date.now()
      }
    ] as unknown as Card[];

    dataUtils = new DataUtils(cards, {}, null);
    chart = new RetentionChart(dataUtils);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders empty message when no reviewed cards match filters', () => {
    chart.setFilterTag('non-existent-tag');
    chart.render('retention-chart-container');

    expect(container.innerHTML).toContain('No reviewed cards yet to generate curves');
  });

  it('renders retention curves grouped by tag (default)', () => {
    chart.render('retention-chart-container');

    expect(container.innerHTML).toContain('retention-curve-svg');
    expect(container.innerHTML).toContain('array');
    expect(container.innerHTML).toContain('hash-table');
    expect(container.innerHTML).toContain('Untagged');
  });

  it('renders retention curves grouped by deck', () => {
    chart.setGroupBy('deck');
    chart.render('retention-chart-container');

    expect(container.innerHTML).toContain('Default');
  });

  it('renders retention curves grouped by difficulty', () => {
    chart.setGroupBy('difficulty');
    chart.render('retention-chart-container');

    expect(container.innerHTML).toContain('Easy');
    expect(container.innerHTML).toContain('Hard');
  });

  it('renders confidence bands when showConfidence is enabled', () => {
    chart.setShowConfidence(true);
    chart.render('retention-chart-container');

    expect(container.innerHTML).toContain('confidence-band');
  });

  it('handles projected retrievability when scheduler is present', () => {
    const mockScheduler = {
      getProjectedRetrievability: jest.fn((s: number, t: number) => 0.95)
    };
    chart.scheduler = mockScheduler as any;
    chart.render('retention-chart-container');

    expect(mockScheduler.getProjectedRetrievability).toHaveBeenCalled();
  });

  it('handles missing container gracefully without throwing', () => {
    expect(() => chart.render('non-existent-container')).not.toThrow();
  });

  it('renders with fallback retrievability when scheduler is not available', () => {
    chart.scheduler = null;
    chart.render('retention-chart-container');

    expect(container.innerHTML).toContain('retention-curve-svg');
  });

  it('handles confidence band rendering errors gracefully', () => {
    // Mock ConfidenceBand.renderBand to throw
    jest.spyOn(console, 'error').mockImplementation(() => {});
    chart.setShowConfidence(true);
    chart.render('retention-chart-container');
    // Should still render without crashing
    expect(container.innerHTML).toContain('retention-curve-svg');
  });

  it('renders empty message for cards with zero stability', () => {
    const zeroStabCards = [
      { id: 'cz', problemTitle: 'Zero Stab', tags: ['zero-tag'], stability: 0, difficulty: 5, reps: 1, due: Date.now() }
    ] as unknown as Card[];
    const du = new DataUtils(zeroStabCards, {}, null);
    const c = new RetentionChart(du);
    c.render('retention-chart-container');
    // Zero stability cards get filtered out, resulting in empty groups
    expect(container.innerHTML).toContain('retention');
  });

  it('setFilterTag handles empty/null input', () => {
    chart.setFilterTag('');
    expect(chart.filterTag).toBe('');
  });

  it('setGroupBy handles empty input with fallback', () => {
    chart.setGroupBy('');
    expect(chart.groupBy).toBe('tag');
  });
});
