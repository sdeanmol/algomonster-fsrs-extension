import { OverviewTab } from '../../features/dashboard/analytics/overview/overview.js';

// Mock dependencies
jest.mock('../../features/dashboard/analytics/overview/memoryHealth.js', () => {
    return { MemoryHealth: jest.fn().mockImplementation(() => ({ render: jest.fn() })) };
});
jest.mock('../../features/dashboard/analytics/overview/learningVelocity.js', () => {
    return { LearningVelocity: jest.fn().mockImplementation(() => ({ render: jest.fn() })) };
});
jest.mock('../../features/dashboard/analytics/overview/miniForecast.js', () => {
    return { MiniForecast: jest.fn().mockImplementation(() => ({ render: jest.fn() })) };
});

describe('OverviewTab', () => {
    let mockDataUtils;
    let container;

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

        const nextAction = document.getElementById('overview-next-action-container');
        expect(nextAction.innerHTML).toContain('warning');
        expect(nextAction.innerHTML).toContain('Reviews Pending');
    });

    it('shows warning when memory health is low', () => {
        mockDataUtils.getSummaryStats.mockReturnValue({ due: 0, trueRetention: 60, totalCards: 20 });
        const tab = new OverviewTab(mockDataUtils);
        tab.render('test-container');

        const nextAction = document.getElementById('overview-next-action-container');
        expect(nextAction.innerHTML).toContain('warning');
        expect(nextAction.innerHTML).toContain('Memory Health Dropping');
    });

    it('shows success when everything is fine', () => {
        mockDataUtils.getSummaryStats.mockReturnValue({ due: 0, trueRetention: 90, totalCards: 20 });
        const tab = new OverviewTab(mockDataUtils);
        tab.render('test-container');

        const nextAction = document.getElementById('overview-next-action-container');
        expect(nextAction.innerHTML).toContain('success');
        expect(nextAction.innerHTML).toContain('all caught up');
    });
});
