import { describe, it, expect } from '@jest/globals';
import {
    calculatePersonalRecords,
    evaluateAchievements,
    renderPersonalRecords,
    renderAchievementsList,
    renderAchievementsModalContent,
    ACHIEVEMENT_DEFINITIONS
} from '../../../../../features/dashboard/popup/achievements';
import { Card } from '../../../../../types/domain';

describe('Achievements and Personal Records Module', () => {
    const mockCards: Card[] = [
        { id: '1', reps: 5, stability: 10, difficulty: 5 } as Card,
        { id: '2', reps: 10, stability: 20, difficulty: 3 } as Card
    ];

    describe('calculatePersonalRecords', () => {
        it('calculates total reviews, max single day reviews, streaks, and card counts', () => {
            const activity = {
                '2026-11-18': 4,
                '2026-11-19': 12,
                '2026-11-20': 3
            };

            const records = calculatePersonalRecords(activity, mockCards, 3, 5);

            expect(records.totalReviews).toBe(19);
            expect(records.maxDailyReviews).toBe(12);
            expect(records.currentStreak).toBe(3);
            expect(records.longestStreak).toBe(5);
            expect(records.totalCards).toBe(2);
        });

        it('falls back to card reps when activity log is empty', () => {
            const records = calculatePersonalRecords({}, mockCards, 0, 0);

            expect(records.totalReviews).toBe(15);
            expect(records.maxDailyReviews).toBe(0);
            expect(records.totalCards).toBe(2);
        });

        it('updates longest streak if current streak exceeds previous longest', () => {
            const records = calculatePersonalRecords({ '2026-11-20': 5 }, mockCards, 10, 7);

            expect(records.longestStreak).toBe(10);
        });
    });

    describe('evaluateAchievements', () => {
        it('unlocks "First Step" when user completes their first review', () => {
            const res = evaluateAchievements({
                cards: mockCards,
                activity: { '2026-11-20': 1 },
                dailyGoalTarget: 10,
                currentStreak: 1,
                longestStreak: 1,
                completedToday: 1,
                unlockedIds: []
            });

            const firstStep = res.achievements.find(a => a.id === 'first_review');
            expect(firstStep?.unlocked).toBe(true);
            expect(res.newUnlocks.some(u => u.id === 'first_review')).toBe(true);
            expect(res.allUnlockedIds).toContain('first_review');
        });

        it('does not re-emit an achievement as new if already in unlockedIds', () => {
            const res = evaluateAchievements({
                cards: mockCards,
                activity: { '2026-11-20': 1 },
                dailyGoalTarget: 10,
                currentStreak: 1,
                longestStreak: 1,
                completedToday: 1,
                unlockedIds: ['first_review']
            });

            const firstStep = res.achievements.find(a => a.id === 'first_review');
            expect(firstStep?.unlocked).toBe(true);
            expect(res.newUnlocks.some(u => u.id === 'first_review')).toBe(false);
            expect(res.allUnlockedIds).toContain('first_review');
        });

        it('evaluates streak milestones: 3-day, 7-day, 30-day', () => {
            const res3 = evaluateAchievements({
                cards: mockCards,
                activity: { '2026-11-18': 2, '2026-11-19': 2, '2026-11-20': 2 },
                dailyGoalTarget: 10,
                currentStreak: 3,
                longestStreak: 3,
                completedToday: 2,
                unlockedIds: []
            });

            expect(res3.achievements.find(a => a.id === 'streak_3')?.unlocked).toBe(true);
            expect(res3.achievements.find(a => a.id === 'streak_7')?.unlocked).toBe(false);

            const res7 = evaluateAchievements({
                cards: mockCards,
                activity: {},
                dailyGoalTarget: 10,
                currentStreak: 7,
                longestStreak: 7,
                completedToday: 1,
                unlockedIds: []
            });

            expect(res7.achievements.find(a => a.id === 'streak_7')?.unlocked).toBe(true);
            expect(res7.achievements.find(a => a.id === 'streak_30')?.unlocked).toBe(false);
        });

        it('unlocks "Knowledge Builder" when 25 or more cards exist', () => {
            const cards25 = Array.from({ length: 25 }, (_, i) => ({ id: `card_${i}` })) as Card[];

            const res = evaluateAchievements({
                cards: cards25,
                activity: {},
                dailyGoalTarget: 10,
                currentStreak: 0,
                longestStreak: 0,
                completedToday: 0,
                unlockedIds: []
            });

            expect(res.achievements.find(a => a.id === 'cards_25')?.unlocked).toBe(true);
        });

        it('unlocks "Goal Crusher" when today completed meets or exceeds daily goal', () => {
            const res = evaluateAchievements({
                cards: mockCards,
                activity: { '2026-11-20': 10 },
                dailyGoalTarget: 10,
                currentStreak: 1,
                longestStreak: 1,
                completedToday: 10,
                unlockedIds: []
            });

            expect(res.achievements.find(a => a.id === 'goal_reached')?.unlocked).toBe(true);
        });

        it('unlocks Century Club and Review Master at 100 and 500 reviews', () => {
            const res100 = evaluateAchievements({
                cards: mockCards,
                activity: { '2026-11-20': 100 },
                dailyGoalTarget: 10,
                currentStreak: 1,
                longestStreak: 1,
                completedToday: 10,
                unlockedIds: []
            });

            expect(res100.achievements.find(a => a.id === 'reviews_100')?.unlocked).toBe(true);
            expect(res100.achievements.find(a => a.id === 'reviews_500')?.unlocked).toBe(false);

            const res500 = evaluateAchievements({
                cards: mockCards,
                activity: { '2026-11-20': 550 },
                dailyGoalTarget: 10,
                currentStreak: 1,
                longestStreak: 1,
                completedToday: 10,
                unlockedIds: []
            });

            expect(res500.achievements.find(a => a.id === 'reviews_500')?.unlocked).toBe(true);
        });
    });

    describe('Rendering HTML templates', () => {
        it('renders personal records HTML with all 4 metrics', () => {
            const records = {
                currentStreak: 5,
                longestStreak: 12,
                maxDailyReviews: 24,
                totalReviews: 180,
                totalCards: 32
            };

            const html = renderPersonalRecords(records);
            expect(html).toContain('Personal Records');
            expect(html).toContain('5d');
            expect(html).toContain('12d');
            expect(html).toContain('24');
            expect(html).toContain('180');
        });

        it('renders achievements list with both unlocked and in-progress items', () => {
            const res = evaluateAchievements({
                cards: mockCards,
                activity: { '2026-11-20': 5 },
                dailyGoalTarget: 10,
                currentStreak: 1,
                longestStreak: 1,
                completedToday: 5,
                unlockedIds: []
            });

            const html = renderAchievementsList(res.achievements);
            expect(html).toContain('Milestones');
            expect(html).toContain('First Step');
            expect(html).toContain('✓ Unlocked');
            expect(html).toContain('in-progress');
            expect(html).toContain('1 / 3 days');
        });

        it('renders modal content combining records and milestones', () => {
            const res = evaluateAchievements({
                cards: mockCards,
                activity: { '2026-11-20': 5 },
                dailyGoalTarget: 10,
                currentStreak: 1,
                longestStreak: 1,
                completedToday: 5,
                unlockedIds: []
            });

            const html = renderAchievementsModalContent(res.achievements, res.records);
            expect(html).toContain('Personal Records');
            expect(html).toContain('Milestones');
        });
    });
});
