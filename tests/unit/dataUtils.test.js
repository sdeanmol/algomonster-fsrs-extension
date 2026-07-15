const { DataUtils } = require('../../features/dashboard/analytics/utils/dataUtils.js');

describe('DataUtils', () => {
    let mockScheduler;
    let mockCards;
    let mockActivity;

    beforeEach(() => {
        mockScheduler = {
            getRetrievability: jest.fn(() => 0.85) // return mock retrievability of 85%
        };

        mockCards = [
            {
                id: '1',
                reps: 5,
                lapses: 1,
                stability: 10,
                lastReview: Date.now() - 100000,
                due: Date.now() - 50000, // Past due
                tags: ['Array', 'Dynamic Programming'],
                historyLog: [
                    { date: Date.now() - 86400000 * 2, rating: 3 }, // 2 days ago
                    { date: Date.now() - 86400000 * 1, rating: 1 }  // 1 day ago (lapse)
                ]
            },
            {
                id: '2',
                reps: 1,
                lapses: 0,
                stability: 0, // New card
                lastReview: Date.now(),
                due: Date.now() + 86400000, // Due tomorrow
                tags: ['Array'],
                historyLog: []
            }
        ];

        mockActivity = {
            [new Date().toISOString().split('T')[0]]: 5, // 5 reviews today
            [new Date(Date.now() - 86400000).toISOString().split('T')[0]]: 2 // 2 reviews yesterday
        };
    });

    it('calculates summary statistics correctly', () => {
        const utils = new DataUtils(mockCards, mockActivity, mockScheduler);
        const stats = utils.getSummaryStats();
        
        expect(stats.totalCards).toBe(2);
        expect(stats.reviewedCards).toBe(1); // only card 1 has stability > 0
        expect(stats.totalReps).toBe(6);
        expect(stats.totalLapses).toBe(1);
        expect(stats.retention).toBe(83); // Math.round((6 - 1) / 6 * 100)
        expect(stats.due).toBe(1); // card 1 is past due
        expect(stats.streak).toBe(2); // activity today and yesterday
    });

    it('calculates stats by tag correctly', () => {
        const utils = new DataUtils(mockCards, mockActivity, mockScheduler);
        const tags = utils.getStatsByTag();
        
        expect(tags.length).toBe(2);
        
        const arrayTag = tags.find(t => t.tag === 'Array');
        expect(arrayTag.count).toBe(2);
        expect(arrayTag.lapses).toBe(1);
        
        const dpTag = tags.find(t => t.tag === 'Dynamic Programming');
        expect(dpTag.count).toBe(1);
        expect(dpTag.lapses).toBe(1);
    });

    it('handles empty data safely', () => {
        const utils = new DataUtils([], {}, mockScheduler);
        const stats = utils.getSummaryStats();
        expect(stats.totalCards).toBe(0);
        expect(stats.retention).toBe(0);
        expect(stats.streak).toBe(0);
    });

    it('calculates review time insights correctly', () => {
        // Mock a specific hour
        const mockLogDate = new Date();
        mockLogDate.setHours(9, 0, 0, 0); // 9 AM (morning)

        const cards = [{
            historyLog: [{ date: mockLogDate.getTime(), rating: 3 }]
        }];
        
        const utils = new DataUtils(cards, {}, mockScheduler);
        const insights = utils.getReviewTimeInsights();
        
        expect(insights.hasTimeData).toBe(true);
        const morningData = insights.data.find(d => d.bucket === 'morning');
        expect(morningData.reviews).toBe(1);
    });
});
