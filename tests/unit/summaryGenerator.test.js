import { generateSummaryReport } from '../../features/dashboard/summary/summaryGenerator';

describe('summaryGenerator Utility', () => {
    const fixedNow = new Date('2026-08-03T12:00:00Z').getTime();

    const sampleCards = [
        {
            id: 'card-1',
            problemTitle: 'Two Sum',
            problemUrl: 'https://leetcode.com/problems/two-sum',
            due: fixedNow + 86400000,
            stability: 5.5,
            difficulty: 4.2,
            elapsed_days: 2,
            scheduled_days: 5,
            learning_steps: 0,
            reps: 4,
            lapses: 0,
            state: 2,
            tags: ['Array', 'Hash Table'],
            historyLog: [
                { date: fixedNow - 2 * 86400000, rating: 3 }, // 2 days ago
                { date: fixedNow - 5 * 86400000, rating: 3 }, // 5 days ago
                { date: fixedNow - 10 * 86400000, rating: 4 } // 10 days ago (prev period for weekly)
            ]
        },
        {
            id: 'card-2',
            problemTitle: 'Course Schedule',
            problemUrl: 'https://leetcode.com/problems/course-schedule',
            due: fixedNow - 3600000,
            stability: 1.2,
            difficulty: 8.1,
            elapsed_days: 1,
            scheduled_days: 1,
            learning_steps: 0,
            reps: 5,
            lapses: 3, // Leech card
            state: 3,
            tags: ['Graph', 'BFS'],
            historyLog: [
                { date: fixedNow - 1 * 86400000, rating: 1 }, // 1 day ago (failed)
                { date: fixedNow - 3 * 86400000, rating: 2 }  // 3 days ago
            ]
        }
    ];

    const sampleActivity = {
        '2026-08-03': 1,
        '2026-08-02': 2,
        '2026-08-01': 1,
        '2026-07-30': 1
    };

    it('generates weekly summary report accurately', () => {
        const report = generateSummaryReport(sampleCards, sampleActivity, 'weekly', fixedNow);

        expect(report.period).toBe('weekly');
        expect(report.periodLabel).toBe('Weekly Digest');
        expect(report.totalDaysInPeriod).toBe(7);

        // Card 1 has 2 reviews in past 7 days (2 & 5 days ago), Card 2 has 2 reviews (1 & 3 days ago)
        expect(report.totalReviews).toBe(4);
        // Card 2 failed 1 review (rating 1), Card 1 passed 2, Card 2 passed 1 -> 3 passed out of 4 = 75%
        expect(report.retentionRate).toBe(75);
        expect(report.leechCount).toBe(1);

        // Check top topics & weakest topics
        expect(report.weakestTopics.length).toBeGreaterThan(0);
        const graphTopic = report.weakestTopics.find(t => t.tag === 'Graph');
        expect(graphTopic).toBeDefined();
        expect(graphTopic.retentionRate).toBe(50); // 1 success, 1 fail
    });

    it('generates monthly summary report accurately', () => {
        const report = generateSummaryReport(sampleCards, sampleActivity, 'monthly', fixedNow);

        expect(report.period).toBe('monthly');
        expect(report.periodLabel).toBe('Monthly Digest');
        expect(report.totalDaysInPeriod).toBe(30);

        // Card 1 has 3 reviews total, Card 2 has 2 -> total 5 reviews in past 30 days
        expect(report.totalReviews).toBe(5);
        expect(report.activeDays).toBeGreaterThan(0);
    });

    it('handles empty cards and empty activity gracefully', () => {
        const report = generateSummaryReport([], {}, 'weekly', fixedNow);

        expect(report.totalReviews).toBe(0);
        expect(report.retentionRate).toBe(100);
        expect(report.leechCount).toBe(0);
        expect(report.newCardsLearned).toBe(0);
        expect(report.insights.some(i => i.title === 'Quiet Study Period')).toBe(true);
    });
});
