import { TagsTab } from '../../features/dashboard/analytics/tags/tags.js';

// Mock dependencies
jest.mock('../../features/dashboard/analytics/tags/coverageTable.js', () => {
    return {
        CoverageTable: jest.fn().mockImplementation(() => {
            return { render: jest.fn() };
        })
    };
});

jest.mock('../../features/dashboard/analytics/tags/retentionBarChart.js', () => {
    return {
        RetentionBarChart: jest.fn().mockImplementation(() => {
            return { render: jest.fn(), setSortBy: jest.fn() };
        })
    };
});

describe('TagsTab', () => {
    let mockDataUtils;
    let container;

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

        const nextActionContainer = document.getElementById('tags-next-action-container');
        expect(nextActionContainer.innerHTML).toContain('warning');
        expect(nextActionContainer.innerHTML).toContain('Target Weak Tags');
        expect(nextActionContainer.innerHTML).toContain('Dynamic Programming');
    });

    it('displays success when tags are healthy', () => {
        mockDataUtils.getStatsByTag.mockReturnValue([
            { tag: 'Dynamic Programming', count: 10, trueRetention: 88 }, // Only 2% below global
            { tag: 'Array', count: 5, trueRetention: 95 }
        ]);
        mockDataUtils.getSummaryStats.mockReturnValue({ trueRetention: 90 });

        const tab = new TagsTab(mockDataUtils);
        tab.render('test-container');

        const nextActionContainer = document.getElementById('tags-next-action-container');
        expect(nextActionContainer.innerHTML).toContain('success');
        expect(nextActionContainer.innerHTML).toContain('Maintain Tag Balance');
    });
});
