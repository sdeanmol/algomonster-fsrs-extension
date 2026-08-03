import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { OverviewTab } from '../../features/dashboard/analytics/overview/overview';

jest.mock('../../features/dashboard/analytics/overview/memoryHealth', () => {
  return { MemoryHealth: jest.fn().mockImplementation(() => ({ render: jest.fn() })) };
});
jest.mock('../../features/dashboard/analytics/overview/learningVelocity', () => {
  return { LearningVelocity: jest.fn().mockImplementation(() => ({ render: jest.fn() })) };
});
jest.mock('../../features/dashboard/analytics/overview/miniForecast', () => {
  return { MiniForecast: jest.fn().mockImplementation(() => ({ render: jest.fn() })) };
});

describe('OverviewTab', () => {
  let mockDataUtils: any;
  let container: HTMLElement;

  beforeEach(() => {
    mockDataUtils = {
      getSummaryStats: jest.fn()
    };

    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  it('renders overview structure correctly', () => {
    mockDataUtils.getSummaryStats.mockReturnValue({ due: 0, trueRetention: 90, totalCards: 20 });
    const tab = new OverviewTab(mockDataUtils);
    tab.render('test-container');

    expect(document.getElementById('overview-next-action-container')).not.toBeNull();
    expect(document.getElementById('memory-health-container')).not.toBeNull();
    expect(document.getElementById('learning-velocity-container')).not.toBeNull();
    expect(document.getElementById('mini-forecast-container')).not.toBeNull();
  });

  it('shows warning when cards are due', () => {
    mockDataUtils.getSummaryStats.mockReturnValue({ due: 5, trueRetention: 90, totalCards: 20 });
    const tab = new OverviewTab(mockDataUtils);
    tab.render('test-container');

    const nextAction = document.getElementById('overview-next-action-container')!;
    expect(nextAction.innerHTML).toContain('warning');
    expect(nextAction.innerHTML).toContain('Reviews Pending');
  });

  it('shows warning when memory health is low', () => {
    mockDataUtils.getSummaryStats.mockReturnValue({ due: 0, trueRetention: 60, totalCards: 20 });
    const tab = new OverviewTab(mockDataUtils);
    tab.render('test-container');

    const nextAction = document.getElementById('overview-next-action-container')!;
    expect(nextAction.innerHTML).toContain('warning');
    expect(nextAction.innerHTML).toContain('Memory Health Dropping');
  });

  it('shows success when everything is fine', () => {
    mockDataUtils.getSummaryStats.mockReturnValue({ due: 0, trueRetention: 90, totalCards: 20 });
    const tab = new OverviewTab(mockDataUtils);
    tab.render('test-container');

    const nextAction = document.getElementById('overview-next-action-container')!;
    expect(nextAction.innerHTML).toContain('success');
    expect(nextAction.innerHTML).toContain('all caught up');
  });

  it('does nothing when container does not exist', () => {
    mockDataUtils.getSummaryStats.mockReturnValue({ due: 0, trueRetention: 90, totalCards: 20 });
    const tab = new OverviewTab(mockDataUtils);
    expect(() => tab.render('nonexistent')).not.toThrow();
  });

  it('does nothing on renderNextAction with missing container', () => {
    mockDataUtils.getSummaryStats.mockReturnValue({ due: 0, trueRetention: 90, totalCards: 20 });
    const tab = new OverviewTab(mockDataUtils);
    expect(() => tab.renderNextAction('nonexistent')).not.toThrow();
  });

  it('does not re-render structure when already rendered', () => {
    mockDataUtils.getSummaryStats.mockReturnValue({ due: 0, trueRetention: 90, totalCards: 20 });
    const tab = new OverviewTab(mockDataUtils);
    tab.render('test-container');
    const firstHTML = container.innerHTML;
    tab.render('test-container');
    expect(container.querySelector('#overview-next-action-container')).not.toBeNull();
  });

  it('uses retention fallback when trueRetention is 0', () => {
    mockDataUtils.getSummaryStats.mockReturnValue({ due: 0, trueRetention: 0, retention: 60, totalCards: 20 });
    const tab = new OverviewTab(mockDataUtils);
    tab.render('test-container');

    const nextAction = document.getElementById('overview-next-action-container')!;
    expect(nextAction.innerHTML).toContain('Memory Health Dropping');
  });

  it('uses custom target retention from scheduler', () => {
    mockDataUtils.getSummaryStats.mockReturnValue({ due: 0, trueRetention: 95, totalCards: 20 });
    mockDataUtils.scheduler = { requestRetention: 0.95 };
    const tab = new OverviewTab(mockDataUtils);
    tab.render('test-container');

    const nextAction = document.getElementById('overview-next-action-container')!;
    expect(nextAction.innerHTML).toContain('success');
  });
});
