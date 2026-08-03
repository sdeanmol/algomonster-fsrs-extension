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
    const msPerDay = 86400000;

    const endDate = new Date(nowMs);
    const startDate = new Date(nowMs - (daysInPeriod - 1) * msPerDay);
    const prevStartDate = new Date(nowMs - (daysInPeriod * 2 - 1) * msPerDay);

    const startTimestamp = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const endTimestamp = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).getTime();
    const prevStartTimestamp = new Date(prevStartDate.getFullYear(), prevStartDate.getMonth(), prevStartDate.getDate()).getTime();

    // 1. Gather all review logs within current & previous windows
    let currentTotalReviews = 0;
    let currentSuccessReviews = 0;
    let prevTotalReviews = 0;
    let prevSuccessReviews = 0;

    let newCardsLearned = 0;

    const topicStats: Record<string, { total: number; success: number }> = {};
    let totalStability = 0;
    let stabilityCardCount = 0;
    let leechCount = 0;

    cards.forEach(card => {
        if ((card.lapses || 0) >= 3) {
            leechCount++;
        }
        if (card.stability > 0) {
            totalStability += card.stability;
            stabilityCardCount++;
        }

        const history = card.historyLog || [];
        history.forEach((logEntry) => {
            const dateMs = typeof logEntry === 'object' && logEntry !== null && 'date' in logEntry
                ? Number(logEntry.date)
                : typeof logEntry === 'number'
                    ? logEntry
                    : 0;

            if (!dateMs) return;

            const rating = typeof logEntry === 'object' && logEntry !== null && 'rating' in logEntry
                ? Number(logEntry.rating)
                : 3; // Default Good if unrecorded

            const isSuccess = rating > 1;

            if (dateMs >= startTimestamp && dateMs <= endTimestamp) {
                currentTotalReviews++;
                if (isSuccess) currentSuccessReviews++;

                // Track Topic Mastery
                if (card.tags && Array.isArray(card.tags)) {
                    card.tags.forEach(tag => {
                        if (!topicStats[tag]) topicStats[tag] = { total: 0, success: 0 };
                        topicStats[tag].total++;
                        if (isSuccess) topicStats[tag].success++;
                    });
                }
            } else if (dateMs >= prevStartTimestamp && dateMs < startTimestamp) {
                prevTotalReviews++;
                if (isSuccess) prevSuccessReviews++;
            }
        });

        // Determine if card was created/learned in this period
        const firstReviewMs = history.length > 0
            ? (typeof history[0] === 'object' && history[0] !== null && 'date' in history[0] ? Number(history[0].date) : Number(history[0]))
            : 0;

        if (firstReviewMs >= startTimestamp && firstReviewMs <= endTimestamp) {
            newCardsLearned++;
        }
    });

    // 2. Compute Retention Rates
    const retentionRate = currentTotalReviews > 0
        ? Math.round((currentSuccessReviews / currentTotalReviews) * 100)
        : 100;

    const prevRetentionRate = prevTotalReviews > 0
        ? Math.round((prevSuccessReviews / prevTotalReviews) * 100)
        : 100;

    const retentionChangeDiff = retentionRate - prevRetentionRate;

    // 3. Compute Review Velocity Change Percentage
    let reviewsChangePct = 0;
    if (prevTotalReviews > 0) {
        reviewsChangePct = Math.round(((currentTotalReviews - prevTotalReviews) / prevTotalReviews) * 100);
    } else if (currentTotalReviews > 0) {
        reviewsChangePct = 100;
    }

    // 4. Compute Daily Activity breakdown and active days
    const dailyActivity: DailyActivityPoint[] = [];
    let activeDays = 0;

    for (let i = daysInPeriod - 1; i >= 0; i--) {
        const d = new Date(nowMs - i * msPerDay);
        const dateStr = toLocalDateString(d);
        const count = fsrsActivity[dateStr] || 0;

        if (count > 0) activeDays++;

        const shortDateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        dailyActivity.push({
            dateStr: shortDateStr,
            fullDate: dateStr,
            count
        });
    }

    // 5. Calculate Streaks in Period
    let currentStreakInPeriod = 0;
    let longestStreakInPeriod = 0;
    dailyActivity.forEach(pt => {
        if (pt.count > 0) {
            currentStreakInPeriod++;
            if (currentStreakInPeriod > longestStreakInPeriod) {
                longestStreakInPeriod = currentStreakInPeriod;
            }
        } else {
            currentStreakInPeriod = 0;
        }
    });

    // 6. Topic Mastery Lists
    const allTopics: TopicMastery[] = Object.keys(topicStats).map(tag => {
        const t = topicStats[tag];
        const rate = t.total > 0 ? Math.round((t.success / t.total) * 100) : 100;
        return {
            tag,
            totalReviews: t.total,
            successReviews: t.success,
            retentionRate: rate
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

    // 7. Dynamic Actionable Insights
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

    const avgStability = stabilityCardCount > 0 ? parseFloat((totalStability / stabilityCardCount).toFixed(1)) : 0;

    const periodLabel = period === 'weekly' ? 'Weekly Digest' : 'Monthly Digest';
    const startDateStr = startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    const endDateStr = endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

    return {
        period,
        periodLabel,
        startDateStr,
        endDateStr,

        totalReviews: currentTotalReviews,
        prevPeriodReviews: prevTotalReviews,
        reviewsChangePct,

        retentionRate,
        prevRetentionRate,
        retentionChangeDiff,

        newCardsLearned,
        activeDays,
        totalDaysInPeriod: daysInPeriod,
        longestStreakInPeriod,
        leechCount,
        avgStability,

        dailyActivity,
        topTopics,
        weakestTopics,
        insights
    };
}
