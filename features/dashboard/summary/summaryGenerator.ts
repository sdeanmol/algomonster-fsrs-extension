/**
 * @file features/dashboard/summary/summaryGenerator.ts
 * @description Pure dynamic summary generator for Weekly and Monthly FSRS performance reports.
 * Calculates stats on-the-fly without database or backup persistence.
 */

import { Card } from '../../../types/domain';

export interface TopicMastery {
    tag: string;
    totalReviews: number;
    successReviews: number;
    retentionRate: number;
}

export interface SummaryInsight {
    type: 'positive' | 'warning' | 'info';
    icon: string;
    title: string;
    description: string;
}

export interface DailyActivityPoint {
    dateStr: string;
    fullDate: string;
    count: number;
}

export interface SummaryReport {
    period: 'weekly' | 'monthly';
    periodLabel: string;
    startDateStr: string;
    endDateStr: string;

    // Primary KPIs
    totalReviews: number;
    prevPeriodReviews: number;
    reviewsChangePct: number;

    retentionRate: number;
    prevRetentionRate: number;
    retentionChangeDiff: number;

    newCardsLearned: number;
    activeDays: number;
    totalDaysInPeriod: number;
    longestStreakInPeriod: number;
    leechCount: number;
    avgStability: number;

    // Detailed Breakdown
    dailyActivity: DailyActivityPoint[];
    topTopics: TopicMastery[];
    weakestTopics: TopicMastery[];
    insights: SummaryInsight[];
}

/**
 * Formats a Date instance as YYYY-MM-DD string using local timezone
 */
function toLocalDateString(d: Date): string {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Generates an on-the-fly SummaryReport for either 'weekly' (last 7 days) or 'monthly' (last 30 days).
 * 
 * @param cards Collection of saved FSRS cards
 * @param fsrsActivity Daily activity counts recorded by extension
 * @param period 'weekly' | 'monthly'
 * @param nowMs Optional timestamp representing current time
 */
export function generateSummaryReport(
    cards: Card[],
    fsrsActivity: { [date: string]: number } = {},
    period: 'weekly' | 'monthly' = 'weekly',
    nowMs: number = Date.now()
): SummaryReport {
    const daysInPeriod = period === 'weekly' ? 7 : 30;
    const endDate = new Date(nowMs);
    
    const startDate = new Date(nowMs);
    startDate.setDate(startDate.getDate() - (daysInPeriod - 1));
    
    const prevStartDate = new Date(nowMs);
    prevStartDate.setDate(prevStartDate.getDate() - (daysInPeriod * 2 - 1));

    const startTimestamp = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const endTimestamp = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).getTime();
    const prevStartTimestamp = new Date(prevStartDate.getFullYear(), prevStartDate.getMonth(), prevStartDate.getDate()).getTime();

    // 1. Gather all review logs within current & previous windows
    const stats = calculateReviewStats(cards, startTimestamp, endTimestamp, prevStartTimestamp);

    // 2. Compute Retention Rates
    const retentionRate = calculatePercentage(stats.currentSuccessReviews, stats.currentTotalReviews);
    const prevRetentionRate = calculatePercentage(stats.prevSuccessReviews, stats.prevTotalReviews);
    const retentionChangeDiff = retentionRate - prevRetentionRate;

    // 3. Compute Review Velocity Change Percentage
    const reviewsChangePct = calculatePercentage(
        stats.currentTotalReviews - stats.prevTotalReviews, 
        stats.prevTotalReviews, 
        stats.currentTotalReviews > 0 ? 100 : 0
    );

    // 4 & 5. Compute Daily Activity breakdown and active days & Streaks
    const activityStats = calculateDailyActivity(fsrsActivity, daysInPeriod, nowMs);

    // 6. Topic Mastery Lists
    const mastery = calculateTopicMastery(stats.topicStats);

    // 7. Dynamic Actionable Insights
    const insights = generateInsights({
        retentionRate,
        reviewsChangePct,
        currentTotalReviews: stats.currentTotalReviews,
        prevTotalReviews: stats.prevTotalReviews,
        weakestTopics: mastery.weakestTopics,
        leechCount: stats.leechCount,
        activeDays: activityStats.activeDays,
        daysInPeriod,
        period
    });

    const avgStability = stats.stabilityCardCount > 0 ? parseFloat((stats.totalStability / stats.stabilityCardCount).toFixed(1)) : 0;

    const periodLabel = period === 'weekly' ? 'Weekly Digest' : 'Monthly Digest';
    const startDateStr = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const endDateStr = endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    return {
        period,
        periodLabel,
        startDateStr,
        endDateStr,
        totalReviews: stats.currentTotalReviews,
        prevPeriodReviews: stats.prevTotalReviews,
        reviewsChangePct,
        retentionRate,
        prevRetentionRate,
        retentionChangeDiff,
        newCardsLearned: stats.newCardsLearned,
        activeDays: activityStats.activeDays,
        totalDaysInPeriod: daysInPeriod,
        longestStreakInPeriod: activityStats.longestStreakInPeriod,
        leechCount: stats.leechCount,
        avgStability,
        dailyActivity: activityStats.dailyActivity,
        topTopics: mastery.topTopics,
        weakestTopics: mastery.weakestTopics,
        insights
    };
}

/**
 * Scans through a user's entire card collection to aggregate review activity, stability, 
 * and tag mastery for both the current and previous period.
 * 
 * @param cards Collection of all FSRS cards
 * @param startMs Start timestamp of the current period
 * @param endMs End timestamp of the current period
 * @param prevStartMs Start timestamp of the previous period (for comparison)
 * @returns Aggregated statistics for the period
 */
function calculateReviewStats(cards: Card[], startMs: number, endMs: number, prevStartMs: number) {
    const stats = {
        currentTotalReviews: 0,
        currentSuccessReviews: 0,
        prevTotalReviews: 0,
        prevSuccessReviews: 0,
        newCardsLearned: 0,
        leechCount: 0,
        totalStability: 0,
        stabilityCardCount: 0,
        topicStats: {} as Record<string, { total: number; success: number }>
    };

    cards.forEach(card => {
        if ((card.lapses || 0) >= 3) stats.leechCount++;
        if (card.stability > 0) {
            stats.totalStability += card.stability;
            stats.stabilityCardCount++;
        }

        const history = card.historyLog || [];
        history.forEach((logEntry) => {
            const dateMs = typeof logEntry === 'object' && logEntry !== null && 'date' in logEntry
                ? Number(logEntry.date) : typeof logEntry === 'number' ? logEntry : 0;

            if (!dateMs) return;

            const rating = typeof logEntry === 'object' && logEntry !== null && 'rating' in logEntry
                ? Number(logEntry.rating) : 3;

            const isSuccess = rating > 1;

            if (dateMs >= startMs && dateMs <= endMs) {
                stats.currentTotalReviews++;
                if (isSuccess) stats.currentSuccessReviews++;

                // Track Topic Mastery
                if (card.tags && Array.isArray(card.tags)) {
                    card.tags.forEach(tag => {
                        if (!stats.topicStats[tag]) stats.topicStats[tag] = { total: 0, success: 0 };
                        stats.topicStats[tag].total++;
                        if (isSuccess) stats.topicStats[tag].success++;
                    });
                }
            } else if (dateMs >= prevStartMs && dateMs < startMs) {
                stats.prevTotalReviews++;
                if (isSuccess) stats.prevSuccessReviews++;
            }
        });

        // Determine if card was created/learned in this period
        const firstReviewMs = history.length > 0
            ? (typeof history[0] === 'object' && history[0] !== null && 'date' in history[0] ? Number(history[0].date) : Number(history[0]))
            : 0;

        if (firstReviewMs >= startMs && firstReviewMs <= endMs) {
            stats.newCardsLearned++;
        }
    });

    return stats;
}

/**
 * Helper to safely calculate a percentage without dividing by zero.
 * 
 * @param part The numerator
 * @param total The denominator
 * @param defaultVal Default value if denominator is 0 (defaults to 100)
 */
function calculatePercentage(part: number, total: number, defaultVal: number = 100): number {
    return total > 0 ? Math.round((part / total) * 100) : defaultVal;
}

/**
 * Computes daily review activity points and tracks consecutive active days (streaks) 
 * over the specified period.
 * 
 * @param fsrsActivity Map of date strings (YYYY-MM-DD) to review counts
 * @param daysInPeriod The number of days in the current period (e.g. 7 or 30)
 * @param nowMs The timestamp of the current day
 */
function calculateDailyActivity(fsrsActivity: { [date: string]: number }, daysInPeriod: number, nowMs: number) {
    const dailyActivity: DailyActivityPoint[] = [];
    let activeDays = 0;
    let currentStreakInPeriod = 0;
    let longestStreakInPeriod = 0;

    for (let i = daysInPeriod - 1; i >= 0; i--) {
        const d = new Date(nowMs);
        d.setDate(d.getDate() - i);
        
        const dateStr = toLocalDateString(d);
        const count = fsrsActivity[dateStr] || 0;

        if (count > 0) {
            activeDays++;
            currentStreakInPeriod++;
            if (currentStreakInPeriod > longestStreakInPeriod) longestStreakInPeriod = currentStreakInPeriod;
        } else {
            currentStreakInPeriod = 0;
        }

        const shortDateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        dailyActivity.push({
            dateStr: shortDateStr,
            fullDate: dateStr,
            count
        });
    }

    return { dailyActivity, activeDays, longestStreakInPeriod };
}

/**
 * Sorts and filters the user's tags to identify their strongest and weakest topics
 * based on retention rates and review volume.
 * 
 * @param topicStats Dictionary of tag names to review success metrics
 * @returns The top 5 and weakest 5 topics
 */
function calculateTopicMastery(topicStats: Record<string, { total: number; success: number }>) {
    const allTopics: TopicMastery[] = Object.keys(topicStats).map(tag => {
        const t = topicStats[tag];
        return {
            tag,
            totalReviews: t.total,
            successReviews: t.success,
            retentionRate: calculatePercentage(t.success, t.total)
        };
    });

    // Sort top topics by highest retention and count
    const topTopics = [...allTopics]
        .sort((a, b) => b.retentionRate - a.retentionRate || b.totalReviews - a.totalReviews)
        .slice(0, 5);

    // Sort weakest topics by lowest retention rate (min 1 review)
    const weakestTopics = [...allTopics]
        .filter(t => t.totalReviews >= 1)
        .sort((a, b) => a.retentionRate - b.retentionRate || b.totalReviews - a.totalReviews)
        .slice(0, 5);

    return { topTopics, weakestTopics };
}

interface InsightsConfig {
    retentionRate: number;
    reviewsChangePct: number;
    currentTotalReviews: number;
    prevTotalReviews: number;
    weakestTopics: TopicMastery[];
    leechCount: number;
    activeDays: number;
    daysInPeriod: number;
    period: string;
}

/**
 * Generates dynamic, actionable insights based on the user's recent performance metrics.
 * Provides encouragement for positive trends and warnings/tips for negative trends.
 * 
 * @param config Contextual metrics for the current and previous periods
 * @returns An array of generated insights
 */
function generateInsights(config: InsightsConfig): SummaryInsight[] {
    const { retentionRate, reviewsChangePct, currentTotalReviews, prevTotalReviews, weakestTopics, leechCount, activeDays, daysInPeriod, period } = config;
    const insights: SummaryInsight[] = [];

    // Retention Insight
    if (retentionRate >= 85) {
        insights.push({
            type: 'positive',
            icon: '🎯',
            title: 'High Retention Mastery',
            description: `Outstanding work! You achieved a ${retentionRate}% recall rate during this ${period} period.`
        });
    } else if (retentionRate < 70 && currentTotalReviews > 0) {
        insights.push({
            type: 'warning',
            icon: '⚡',
            title: 'Retention Warning',
            description: `Recall rate dropped to ${retentionRate}%. Consider shortening your review intervals or checking difficult cards.`
        });
    }

    // Velocity / Review Volume Insight
    if (reviewsChangePct > 20 && prevTotalReviews > 0) {
        insights.push({
            type: 'positive',
            icon: '📈',
            title: 'Study Momentum Boost',
            description: `Review activity jumped by +${reviewsChangePct}% compared to the previous ${period} period!`
        });
    } else if (currentTotalReviews === 0) {
        insights.push({
            type: 'info',
            icon: '🔔',
            title: 'Quiet Study Period',
            description: `No review logs were recorded for this ${period} timeframe. Keep up daily practice!`
        });
    }

    // Weak Topic Insight
    if (weakestTopics.length > 0 && weakestTopics[0].retentionRate < 75) {
        insights.push({
            type: 'warning',
            icon: '🔍',
            title: `Focus Needed: ${weakestTopics[0].tag}`,
            description: `The tag "${weakestTopics[0].tag}" has a ${weakestTopics[0].retentionRate}% retention rate across ${weakestTopics[0].totalReviews} reviews. Focus on this tag in your next session.`
        });
    }

    // Leech Alert Insight
    if (leechCount > 0) {
        insights.push({
            type: 'warning',
            icon: '⚠️',
            title: `${leechCount} Leech Pattern${leechCount > 1 ? 's' : ''} Detected`,
            description: `${leechCount} pattern(s) have lapsed 3+ times. Try re-reading the solution approach and breaking down key sub-problems.`
        });
    }

    // Consistency / Active Days Insight
    const activePct = Math.round((activeDays / daysInPeriod) * 100);
    if (activePct >= 70) {
        insights.push({
            type: 'positive',
            icon: '🔥',
            title: 'Consistency Star',
            description: `You logged study activity on ${activeDays} out of ${daysInPeriod} days (${activePct}% consistency)!`
        });
    }

    return insights;
}
