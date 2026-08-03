import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DataUtils } from '../../../../../../features/dashboard/analytics/utils/dataUtils';
import { Card } from '../../../../../../types/domain';

describe('DataUtils', () => {
    let mockScheduler: any;
    let mockCards: Card[];
    let mockActivity: Record<string, number>;

    beforeEach(() => {
        mockScheduler = {
            getRetrievability: jest.fn(() => 0.85)
        };

        const now = Date.now();
        mockCards = [
            {
                id: '1',
                reps: 5,
                lapses: 1,
                stability: 10,
                last_review: now - 100000,
                due: now - 50000, // Past due
                tags: ['Array', 'Dynamic Programming'],
                historyLog: [
                    { date: now - 86400000 * 2, rating: 3, duration: 2000 },
                    { date: now - 86400000 * 1, rating: 1, duration: 5000 }
                ]
            } as any,
            {
                id: '2',
                reps: 1,
                lapses: 0,
                stability: 0, // New card
                last_review: now,
                due: now + 86400000, // Due tomorrow
                tags: [], // Will fall back to Untagged
                historyLog: []
            } as any
        ];

        const todayKey = new Date().toISOString().split('T')[0];
        const yesterdayKey = new Date(now - 86400000).toISOString().split('T')[0];

        mockActivity = {
            [todayKey]: 5,
            [yesterdayKey]: 2
        };
    });

    it('calculates summary statistics correctly', () => {
        const utils = new DataUtils(mockCards, mockActivity, mockScheduler);
        const stats = utils.getSummaryStats();
        
        expect(stats.totalCards).toBe(2);
        expect(stats.reviewedCards).toBe(1);
        expect(stats.totalReps).toBe(6);
        expect(stats.totalLapses).toBe(1);
        expect(stats.retention).toBe(83);
        expect(stats.due).toBe(1);
        expect(stats.streak).toBe(2);
    });

    it('handles null/empty constructor inputs and catch block safely', () => {
        const utils = new DataUtils(null as any, null as any, null);
        expect(utils.cards).toEqual([]);
        expect(utils.activity).toEqual({});

        const stats = utils.getSummaryStats();
        expect(stats.totalCards).toBe(0);
        expect(stats.retention).toBe(0);
        expect(stats.streak).toBe(0);
    });

    it('calculates stats by tag correctly, including Untagged fallback', () => {
        const utils = new DataUtils(mockCards, mockActivity, mockScheduler);
        const tags = utils.getStatsByTag();
        
        expect(tags.length).toBe(3); // Array, Dynamic Programming, Untagged
        
        const arrayTag = tags.find(t => t.tag === 'Array');
        expect(arrayTag?.count).toBe(1);
        expect(arrayTag?.lapses).toBe(1);

        const untaggedTag = tags.find(t => t.tag === 'Untagged');
        expect(untaggedTag?.count).toBe(1);
    });

    it('calculates learning velocity metrics and trends correctly', () => {
        const now = Date.now();
        const oneDayMs = 86400000;

        const velocityCards: Card[] = [
            {
                id: '1',
                stability: 25, // Graduated
                last_review: now - (oneDayMs * 2),
                historyLog: [{ date: now - (oneDayMs * 2), rating: 3 }]
            } as any,
            {
                id: '2',
                stability: 30, // Graduated
                last_review: now - (oneDayMs * 10), // Prev week
                historyLog: [{ date: now - (oneDayMs * 10), rating: 3 }]
            } as any
        ];

        const utils = new DataUtils(velocityCards, mockActivity, mockScheduler);
        const velocity = utils.getLearningVelocity();

        expect(velocity.newCardsPerDay).toBeDefined();
        expect(velocity.graduatedPerWeek).toBe(1);
        expect(velocity.sparklineNew).toHaveLength(7);
        expect(velocity.sparklineGrad).toHaveLength(7);
        expect(velocity.sparklineRev).toHaveLength(7);
    });

    it('calculates performance stats (lapsed vs recovered)', () => {
        const now = Date.now();
        const cards: Card[] = [
            {
                id: '1',
                lapses: 3,
                stability: 25, // Recovered (> RECOVERED_STABILITY_THRESHOLD 21)
                last_review: now
            } as any,
            {
                id: '2',
                lapses: 2,
                stability: 5, // Lapsed (<= RECOVERED_STABILITY_THRESHOLD 21)
                last_review: now
            } as any
        ];

        const utils = new DataUtils(cards, {}, mockScheduler);
        const perf = utils.getPerformanceStats();

        expect(perf.recovered).toHaveLength(1);
        expect(perf.recovered[0].id).toBe('1');
        expect(perf.lapsed).toHaveLength(1);
        expect(perf.lapsed[0].id).toBe('2');
    });

    it('calculates review time insights across all hour buckets (morning, afternoon, evening, night)', () => {
        const createHourLogCard = (hour: number, rating: number = 3) => {
            const d = new Date();
            d.setHours(hour, 0, 0, 0);
            return {
                historyLog: [{ date: d.getTime(), rating, duration: 1500 }]
            } as any;
        };

        const cards = [
            createHourLogCard(7),  // Morning (5..11)
            createHourLogCard(14), // Afternoon (12..16)
            createHourLogCard(19), // Evening (17..20)
            createHourLogCard(23, 1) // Night (21..4) + Lapse (rating=1)
        ];

        const utils = new DataUtils(cards, {}, mockScheduler);
        const insights = utils.getReviewTimeInsights();

        expect(insights.hasTimeData).toBe(true);
        expect(insights.data).toHaveLength(4);

        const nightBucket = insights.data.find(b => b.bucket === 'night');
        expect(nightBucket?.reviews).toBe(1);
        expect(nightBucket?.retention).toBe(0); // rating 1 = lapse -> retention 0%
    });

    it('calculates exam readiness predictions and status classes (Ready, Moderate, At Risk)', () => {
        // Mock low retrievability for At Risk test
        mockScheduler.getRetrievability = jest.fn(() => 0.50); // 50% < 70% warning -> At Risk

        const utils = new DataUtils(mockCards, mockActivity, mockScheduler);
        const readiness = utils.getExamReadinessStats(12);

        expect(readiness.daysAhead).toBe(12);
        expect(readiness.atRiskCount).toBeGreaterThan(0);

        const atRiskTag = readiness.tags.find(t => t.status === 'At Risk');
        expect(atRiskTag?.statusClass).toBe('ready-critical');

        // Test Moderate recall (e.g. 75%)
        mockScheduler.getRetrievability = jest.fn(() => 0.75);
        const modReadiness = utils.getExamReadinessStats(12);
        const modTag = modReadiness.tags.find(t => t.status === 'Moderate');
        expect(modTag?.statusClass).toBe('ready-medium');
    });

    it('calculates future memory simulation with null scheduler fallback', () => {
        const utilsNoSched = new DataUtils(mockCards, mockActivity, null);
        const simNoSched = utilsNoSched.getFutureMemorySimulation(45);

        expect(simNoSched.today).toBe(0);
        expect(simNoSched.custom.retention).toBe(0);

        // Test with scheduler and forgotten count threshold (< 0.70)
        mockScheduler.getRetrievability = jest.fn(() => 0.65);
        const utils = new DataUtils(mockCards, mockActivity, mockScheduler);
        const sim = utils.getFutureMemorySimulation(45);

        expect(sim.custom.forgottenCount).toBe(1);
    });

    it('handles unexpected errors gracefully in catch blocks', () => {
        const utils = new DataUtils(mockCards, mockActivity, mockScheduler);

        // Force error in getSummaryStats
        jest.spyOn(utils.cards, 'forEach').mockImplementationOnce(() => {
            throw new Error('Iter error');
        });
        const errStats = utils.getSummaryStats();
        expect(errStats.totalCards).toBe(2);
        expect(errStats.retention).toBe(0);

        // Force error in formatDateKey
        const errKey = utils.formatDateKey(null as any);
        expect(errKey).toBeDefined();

        // Force error in calculateCurrentStreak
        (utils as any).activity = null;
        expect(utils.calculateCurrentStreak()).toBe(0);
    });
});
