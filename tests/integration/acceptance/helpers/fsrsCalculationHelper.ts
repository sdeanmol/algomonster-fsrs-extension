/**
 * @file fsrsCalculationHelper.ts
 * @description Canonical mathematical verifier for FSRS retrievability, due counts,
 * gamification level, study streak, and unlocked achievements.
 */

import { fsrs, Card as TsFsrsCard } from 'ts-fsrs';
import { Card, FSRSParameters } from '../../../../types/domain';
import { getLastReviewDate } from '@common/utils/cardUtils';

export interface AchievementCheckParams {
    totalReviews: number;
    longestStreak: number;
    totalCards: number;
    completedToday: number;
    dailyGoal: number;
}

/**
 * Calculates due cards count at evaluation timestamp.
 */
export function calculateExpectedDueCount(cards: Card[], nowMs: number): number {
    return cards.filter(c => typeof c.due === 'number' && c.due <= nowMs).length;
}

/**
 * Calculates model-derived FSRS retrievability retention percentage across cards.
 */
export function calculateExpectedRetention(
    cards: Card[],
    fsrsParams: FSRSParameters,
    nowMs: number
): { retentionPercent: number; countEvaluated: number } {
    const f = fsrs({
        w: fsrsParams.w,
        request_retention: fsrsParams.requestRetention
    });

    const now = new Date(nowMs);
    let totalRetrievability = 0;
    let countEvaluated = 0;

    for (const card of cards) {
        if (card.stability > 0) {
            const lastReview = getLastReviewDate(card);
            if (lastReview) {
                const tsCard: TsFsrsCard = {
                    due: new Date(card.due),
                    stability: card.stability,
                    difficulty: card.difficulty,
                    elapsed_days: card.elapsed_days || 0,
                    scheduled_days: card.scheduled_days || 0,
                    learning_steps: card.learning_steps || 0,
                    reps: card.reps,
                    lapses: card.lapses,
                    state: card.state,
                    last_review: new Date(lastReview)
                };
                const r = f.get_retrievability(tsCard, now, false) || 0;
                totalRetrievability += r;
                countEvaluated++;
            }
        }
    }

    const retentionPercent = countEvaluated > 0
        ? Math.round((totalRetrievability / countEvaluated) * 100)
        : 0;

    return { retentionPercent, countEvaluated };
}

/**
 * Computes gamification level, next level threshold, and title from total reviews.
 */
export function calculateExpectedLevel(totalReviews: number): { level: number; reviewsToNext: number; title: string } {
    const level = Math.max(1, Math.floor(1 + 0.6 * Math.sqrt(totalReviews)));
    const nextLevelReviews = Math.ceil(Math.pow(level / 0.6, 2));
    const reviewsToNext = Math.max(0, nextLevelReviews - totalReviews);

    let title = 'Novice';
    if (level >= 20) title = 'Grandmaster';
    else if (level >= 15) title = 'Master';
    else if (level >= 10) title = 'Expert';
    else if (level >= 5) title = 'Apprentice';

    return { level, reviewsToNext, title };
}

/**
 * Evaluates the 8 standard milestone achievements against user study metrics.
 */
export function calculateExpectedAchievements(params: AchievementCheckParams): { unlockedIds: string[]; totalUnlocked: number } {
    const unlockedIds: string[] = [];

    if (params.totalReviews >= 1) unlockedIds.push('first_review');
    if (params.longestStreak >= 3) unlockedIds.push('streak_3');
    if (params.longestStreak >= 7) unlockedIds.push('streak_7');
    if (params.longestStreak >= 30) unlockedIds.push('streak_30');
    if (params.totalCards >= 25) unlockedIds.push('cards_25');
    if (params.totalReviews >= 100) unlockedIds.push('reviews_100');
    if (params.totalReviews >= 500) unlockedIds.push('reviews_500');
    if (params.dailyGoal > 0 && params.completedToday >= params.dailyGoal) unlockedIds.push('goal_reached');

    return {
        unlockedIds,
        totalUnlocked: unlockedIds.length
    };
}
