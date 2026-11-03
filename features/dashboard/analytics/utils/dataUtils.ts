/**
 * @file features/dashboard/analytics/utils/dataUtils.ts
 * @description Central mathematical aggregation engine for the Analytics Dashboard SPA.
 * Calculates summary metrics, learning velocities, tag mastery, lapse/recovery rates,
 * review time patterns, exam readiness projections, and future memory decay simulations.
 *
 * Architecture Role: Analytics Statistical Modeling & Aggregation Engine.
 * Context: Extension Standalone Tab (`features/dashboard/analytics/analytics.html`).
 * Key Exports:
 * - {@link SummaryStats}: High-level inventory, due count, and retention KPI summary.
 * - {@link LearningVelocity}: Velocity trends and sparkline arrays (new cards, graduated, reviews).
 * - {@link TagStats}: Per-tag retention, stability, and difficulty breakdown.
 * - {@link PerformanceStats}: Lapsed vs successfully recovered card collections.
 * - {@link ReviewTimeInsights}: Time-of-day behavioral correlation with recall accuracy.
 * - {@link ExamReadinessStats}: Future date target readiness metrics and at-risk tag list.
 * - {@link FutureMemorySimulationStats}: Simulated memory decay projections over 30, 90, 180+ days.
 * - {@link DataUtils}: Core mathematical engine class consuming card histories and scheduler projections.
 */

import { Logger } from '@common/logger';
import { getLastReviewDate } from '../../../common/utils/cardUtils';
import { Card, ReviewLog } from '../../../../types/domain';
import { MS_PER_DAY, MS_PER_WEEK, RECOVERED_STABILITY_THRESHOLD, GRADUATED_STABILITY_THRESHOLD, RECALL_THRESHOLD_GOOD, RECALL_THRESHOLD_WARNING } from '../../../common/constants';
import AbstractScheduler from '../../../tracker/scheduler/scheduler';

/**
 * Top-level inventory and retrievability metrics summary.
 */
export interface SummaryStats {
    /** Total cards tracked across all categories. */
    totalCards: number;
    /** Number of cards that have been reviewed at least once (stability > 0). */
    reviewedCards: number;
    /** Lifetime total repetition reviews across all cards. */
    totalReps: number;
    /** Lifetime total lapses across all cards. */
    totalLapses: number;
    /** Raw repetition-based retention percentage `(reps - lapses) / reps * 100`. */
    retention: number;
    /** Model-derived FSRS retrievability retention percentage. */
    trueRetention: number;
    /** Average stability in days across reviewed cards. */
    avgStability: number;
    /** Total reviews logged in the `fsrsActivity` calendar map. */
    totalActivityReviews: number;
    /** Total cards currently due for review right now. */
    due: number;
    /** Cards scheduled to be due today or already overdue. */
    dueToday: number;
    /** Current consecutive active daily study streak. */
    streak: number;
}

/**
 * Velocity rates and 7-day sparkline trend data points for study momentum.
 */
export interface LearningVelocity {
    /** Average new cards introduced per day over the last 7 days. */
    newCardsPerDay: string;
    /** Percentage change in new card rate vs previous 7-day window. */
    newCardsTrend: number;
    /** Daily count of new cards introduced over the last 7 days. */
    sparklineNew: number[];
    /** Count of cards graduating to stability >= threshold in the last 7 days. */
    graduatedPerWeek: number;
    /** Percentage change in graduated card rate vs previous window. */
    graduatedTrend: number;
    /** Daily count of graduating cards over the last 7 days. */
    sparklineGrad: number[];
    /** Average reviews completed per day over the last 7 days. */
    reviewsPerDay: string;
    /** Percentage change in review volume vs previous 7-day window. */
    reviewsTrend: number;
    /** Daily review counts over the last 7 days. */
    sparklineRev: number[];
}

/**
 * Topic tag retention, stability, and workload metrics.
 */
export interface TagStats {
    /** Problem topic tag name. */
    tag: string;
    /** Total cards tagged with this label. */
    count: number;
    /** Historic raw retention percentage `(reps - lapses) / reps * 100`. */
    retention: number;
    /** FSRS computed retrievability retention percentage. */
    trueRetention: number;
    /** Mean stability in days for this tag. */
    avgStability: number;
    /** Cumulative lapses logged across cards with this tag. */
    lapses: number;
    /** Number of cards currently due under this tag. */
    due: number;
}

/**
 * Categorized collections of cards requiring attention or successfully rehabilitated.
 */
export interface PerformanceStats {
    /** Cards that have lapsed (lapses >= 1). */
    lapsed: Card[];
    /** Cards that previously lapsed but regained stability >= threshold. */
    recovered: Card[];
}

/**
 * Time-of-day behavioral study patterns correlating hour/time buckets with recall accuracy.
 */
export interface ReviewTimeInsights {
    /** Whether card review logs contain valid timestamp data. */
    hasTimeData: boolean;
    /** Array of time bucket metrics (e.g. morning, afternoon, evening, night). */
    data: Array<{
        /** Time bucket name string. */
        bucket: string;
        /** Total reviews performed during this time period. */
        reviews: number;
        /** Retention accuracy percentage for reviews in this bucket. */
        retention: number;
        /** Mean duration spent per card in milliseconds, or null if untracked. */
        avgDurationMs: number | null;
    }>;
}

/**
 * Topic breakdown for targeted exam readiness predictions.
 */
export interface ExamReadinessTagResult {
    /** Topic tag name. */
    tag: string;
    /** Total cards with this tag. */
    count: number;
    /** Cards reviewed under this tag. */
    reviewedCount: number;
    /** Projected retention rate on the target exam date. */
    expectedRecall: number;
    /** Mean stability in days. */
    avgStability: number;
    /** Textual readiness assessment ('Ready', 'Needs Work', 'At Risk'). */
    status: string;
    /** CSS class styling the status badge. */
    statusClass: string;
}

/**
 * Composite readiness metrics projecting recall probabilities for a target exam date.
 */
export interface ExamReadinessStats {
    /** Number of calendar days ahead being evaluated. */
    daysAhead: number;
    /** Target exam date object. */
    targetDate: Date;
    /** Projected overall inventory recall percentage on target date. */
    overallRecall: number;
    /** Total cards in inventory. */
    totalCards: number;
    /** Number of cards reviewed at least once. */
    reviewedCards: number;
    /** Count of cards projected to fall below acceptable retrievability. */
    atRiskCount: number;
    /** Topic-by-topic readiness breakdowns. */
    tags: ExamReadinessTagResult[];
}

/**
 * Single day projection point on the simulated memory decay curve.
 */
export interface SimulationCurvePoint {
    /** Day offset index from today (0 to 180+). */
    day: number;
    /** Estimated recall probability percentage on this day without reviews. */
    retention: number;
}

/**
 * Forecast simulation modeling memory decay if all reviews were stopped.
 */
export interface FutureMemorySimulationStats {
    /** Estimated overall retention today. */
    today: number;
    /** Projected retention in 30 days without reviews. */
    d30: number;
    /** Projected retention in 90 days without reviews. */
    d90: number;
    /** Projected retention in 180 days without reviews. */
    d180: number;
    /** Custom duration evaluation metrics. */
    custom: {
        /** Evaluated custom day offset. */
        days: number;
        /** Projected retention on custom day. */
        retention: number;
        /** Projected number of forgotten cards on custom day. */
        forgottenCount: number;
        /** Total cards evaluated. */
        totalCards: number;
    };
    /** Plotted data points along the simulated forgetting curve. */
    curvePoints: SimulationCurvePoint[];
    /** Total card count evaluated. */
    totalCards: number;
    /** Number of reviewed cards included in the simulation. */
    reviewedCards: number;
}

/**
 * Central statistical aggregator and mathematical projection engine for extension analytics.
 */
export class DataUtils {
    /** Card collection loaded from storage. */
    cards: Card[];
    /** Daily review activity map from storage. */
    activity: Record<string, number>;
    /** Optional active FSRS scheduler instance for retrievability calculations. */
    scheduler: AbstractScheduler | null;
    /** Reference current date timestamp. */
    today: Date;
    /** Midnight timestamp of the current date for day boundary comparisons. */
    todayStart: Date;

    /**
     * Initializes DataUtils with cards, activity history, and optional scheduler engine.
     * @param cards - Collection of FSRS cards.
     * @param activity - Daily activity review counts.
     * @param scheduler - Active scheduler instance for retrievability projection.
     */
    constructor(cards: Card[], activity: Record<string, number>, scheduler: AbstractScheduler | null) {
        try {
            this.cards = cards || [];
            
            this.cards.forEach((card: Card & { elapsedDays?: number; scheduledDays?: number }) => {
                try {
                    card.last_review = getLastReviewDate(card);
                    
                    if (card.elapsedDays === undefined) card.elapsedDays = card.elapsed_days || 0;
                    if (card.scheduledDays === undefined) card.scheduledDays = card.scheduled_days || 0;
                } catch (cErr) {
                    const errorMessage = cErr instanceof Error ? cErr.message : String(cErr);
                    Logger.error('DataUtils', `Error initializing individual card review date: ${errorMessage}`, { card, cErr });
                }
            });

            this.activity = activity || {};
            this.scheduler = scheduler;
            this.today = new Date();
            this.todayStart = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataUtils', `Error in DataUtils constructor: ${errorMessage}`, { err });
            this.cards = [];
            this.activity = {};
            this.scheduler = null;
            this.today = new Date();
            this.todayStart = new Date();
        }
    }

    /**
     * Computes top-level inventory counters, raw/FSRS retrievability retention,
     * due counts, and active daily study streaks.
     * @returns {@link SummaryStats} object containing overall deck metrics.
     */
    getSummaryStats(): SummaryStats {
        try {
            let totalReps = 0;
            let totalLapses = 0;
            let totalStability = 0;
            let reviewedCards = 0;
            let totalActivityReviews = 0;

            this.cards.forEach(card => {
                totalReps += card.reps || 0;
                totalLapses += card.lapses || 0;
                if (card.stability > 0) {
                    totalStability += card.stability;
                    reviewedCards++;
                }
            });

            Object.values(this.activity).forEach(c => totalActivityReviews += c);

            const retention = totalReps > 0 ? Math.round(((totalReps - totalLapses) / totalReps) * 100) : 0;
            const avgStability = reviewedCards > 0 ? (totalStability / reviewedCards) : 0;

            let dueCount = 0;
            let dueTodayCount = 0;
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            let totalRetrievability = 0;
            let retrievabilityCount = 0;

            this.cards.forEach(card => {
                const dueDate = new Date(card.due);
                const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                const diffDays = Math.floor((dueDay.getTime() - todayStart.getTime()) / MS_PER_DAY);
                
                if (dueDate <= now) {
                    dueCount++;
                }
                
                if (diffDays <= 0) {
                    dueTodayCount++;
                }

                if (card.stability > 0 && card.last_review && this.scheduler) {
                    const r = this.scheduler.getRetrievability(card, now.getTime());
                    totalRetrievability += r;
                    retrievabilityCount++;
                }
            });
            
            const trueRetention = retrievabilityCount > 0 ? Math.round((totalRetrievability / retrievabilityCount) * 100) : retention;

            return {
                totalCards: this.cards.length,
                reviewedCards,
                totalReps,
                totalLapses,
                retention,
                trueRetention,
                avgStability,
                totalActivityReviews,
                due: dueCount,
                dueToday: dueTodayCount,
                streak: this.calculateCurrentStreak()
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataUtils', `Error computing summary stats: ${errorMessage}`, { err });
            return {
                totalCards: this.cards ? this.cards.length : 0,
                reviewedCards: 0,
                totalReps: 0,
                totalLapses: 0,
                retention: 0,
                trueRetention: 0,
                avgStability: 0,
                totalActivityReviews: 0,
                due: 0,
                dueToday: 0,
                streak: 0
            };
        }
    }

    /**
     * Calculates 7-day study momentum, new card introduction rate, card graduation velocities,
     * and percentage trends vs the prior 7-day window.
     * @returns {@link LearningVelocity} object containing velocity averages, trends, and sparkline arrays.
     */
    getLearningVelocity(): LearningVelocity {
        try {
            const now = Date.now();
            const oneWeekAgo = now - MS_PER_WEEK;
            const twoWeeksAgo = now - (2 * MS_PER_WEEK);
            
            let newCardsLastWeek = 0;
            let newCardsPrevWeek = 0;
            let graduatedLastWeek = 0;
            let graduatedPrevWeek = 0;
            
            this.cards.forEach(card => {
                let firstReview: number | null | undefined = card.last_review;
                if (card.historyLog && card.historyLog.length > 0) {
                    const firstLog = card.historyLog[0] as ReviewLog | number;
                    firstReview = typeof firstLog === 'object' && firstLog !== null ? firstLog.date : firstLog;
                }
                
                if (firstReview) {
                    if (firstReview > oneWeekAgo) {
                        newCardsLastWeek++;
                    } else if (firstReview > twoWeeksAgo && firstReview <= oneWeekAgo) {
                        newCardsPrevWeek++;
                    }
                }
                
                if (card.stability > GRADUATED_STABILITY_THRESHOLD && card.last_review) {
                    if (card.last_review > oneWeekAgo) {
                        graduatedLastWeek++;
                    } else if (card.last_review > twoWeeksAgo && card.last_review <= oneWeekAgo) {
                        graduatedPrevWeek++;
                    }
                }
            });
            
            let reviewsLastWeek = 0;
            let reviewsPrevWeek = 0;
            
            const dailyNew = [0, 0, 0, 0, 0, 0, 0];
            const dailyGrad = [0, 0, 0, 0, 0, 0, 0];
            const dailyRev = [0, 0, 0, 0, 0, 0, 0];

            this.cards.forEach(card => {
                let firstReview: number | null | undefined = card.last_review;
                if (card.historyLog && card.historyLog.length > 0) {
                    const firstLog = card.historyLog[0] as ReviewLog | number;
                    firstReview = typeof firstLog === 'object' && firstLog !== null ? firstLog.date : firstLog;
                }
                if (firstReview && firstReview > oneWeekAgo) {
                    const dayIndex = 6 - Math.floor((now - firstReview) / MS_PER_DAY);
                    if (dayIndex >= 0 && dayIndex < 7) dailyNew[dayIndex]++;
                }
                
                if (card.stability > GRADUATED_STABILITY_THRESHOLD && card.last_review && card.last_review > oneWeekAgo) {
                    const dayIndex = 6 - Math.floor((now - card.last_review) / MS_PER_DAY);
                    if (dayIndex >= 0 && dayIndex < 7) dailyGrad[dayIndex]++;
                }
            });
            
            for (let i = 0; i < 14; i++) {
                const d = new Date(this.today);
                d.setDate(d.getDate() - i);
                const key = this.formatDateKey(d);
                const val = this.activity[key] || 0;
                if (i < 7) {
                    reviewsLastWeek += val;
                    dailyRev[6 - i] = val;
                } else {
                    reviewsPrevWeek += val;
                }
            }

            const calcTrend = (current: number, previous: number) => {
                if (previous === 0) return current > 0 ? 100 : 0;
                return Math.round(((current - previous) / previous) * 100);
            };

            return {
                newCardsPerDay: (newCardsLastWeek / 7).toFixed(1),
                newCardsTrend: calcTrend(newCardsLastWeek, newCardsPrevWeek),
                sparklineNew: dailyNew,
                graduatedPerWeek: graduatedLastWeek,
                graduatedTrend: calcTrend(graduatedLastWeek, graduatedPrevWeek),
                sparklineGrad: dailyGrad,
                reviewsPerDay: (reviewsLastWeek / 7).toFixed(1),
                reviewsTrend: calcTrend(reviewsLastWeek, reviewsPrevWeek),
                sparklineRev: dailyRev
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataUtils', `Error calculating learning velocity: ${errorMessage}`, { err });
            return {
                newCardsPerDay: '0.0',
                newCardsTrend: 0,
                sparklineNew: [0, 0, 0, 0, 0, 0, 0],
                graduatedPerWeek: 0,
                graduatedTrend: 0,
                sparklineGrad: [0, 0, 0, 0, 0, 0, 0],
                reviewsPerDay: '0.0',
                reviewsTrend: 0,
                sparklineRev: [0, 0, 0, 0, 0, 0, 0]
            };
        }
    }

    /**
     * Groups cards by topic tag and computes tag-specific retention, true retrievability,
     * stability, lapse frequency, and active due counts.
     * @returns Array of {@link TagStats} sorted descending by card count.
     */
    getStatsByTag(): TagStats[] {
        try {
            const tags: Record<string, { count: number; totalReps: number; totalLapses: number; totalStability: number; reviewed: number; due: number; totalRetrievability: number; retrievabilityCount: number }> = {};
            
            this.cards.forEach(card => {
                const cardTags = (card.tags && card.tags.length > 0) ? card.tags : ['Untagged'];
                cardTags.forEach((tag: string) => {
                    if (!tags[tag]) {
                        tags[tag] = { count: 0, totalReps: 0, totalLapses: 0, totalStability: 0, reviewed: 0, due: 0, totalRetrievability: 0, retrievabilityCount: 0 };
                    }
                    tags[tag].count++;
                    tags[tag].totalReps += (card.reps || 0);
                    tags[tag].totalLapses += (card.lapses || 0);
                    
                    if (card.stability > 0) {
                        tags[tag].totalStability += card.stability;
                        tags[tag].reviewed++;
                    }
                    
                    if (card.due && card.due <= Date.now()) {
                        tags[tag].due++;
                    }

                    if (card.stability > 0 && card.last_review && this.scheduler) {
                        const r = this.scheduler.getRetrievability(card, Date.now());
                        tags[tag].totalRetrievability += r;
                        tags[tag].retrievabilityCount++;
                    }
                });
            });
            
            const result: TagStats[] = [];
            for (const [tag, data] of Object.entries(tags)) {
                const retention = data.totalReps > 0 ? ((data.totalReps - data.totalLapses) / data.totalReps) * 100 : 0;
                const trueRetention = data.retrievabilityCount > 0 ? (data.totalRetrievability / data.retrievabilityCount) * 100 : retention;
                const avgStability = data.reviewed > 0 ? data.totalStability / data.reviewed : 0;
                result.push({
                    tag,
                    count: data.count,
                    retention: Math.round(retention),
                    trueRetention: Math.round(trueRetention),
                    avgStability,
                    lapses: data.totalLapses,
                    due: data.due
                });
            }
            
            return result.sort((a, b) => b.count - a.count);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataUtils', `Error getting stats by tag: ${errorMessage}`, { err });
            return [];
        }
    }
    
    /**
     * Segregates cards into lapsed patterns requiring remediation and recovered cards
     * that successfully regained high stability after lapses.
     * @returns {@link PerformanceStats} containing arrays of lapsed and recovered cards.
     */
    getPerformanceStats(): PerformanceStats {
        try {
            const lapsed: Card[] = [];
            const recovered: Card[] = [];
            
            this.cards.forEach(card => {
                if ((card.lapses || 0) > 0) {
                    if (card.lapses >= 2 && card.stability > RECOVERED_STABILITY_THRESHOLD) {
                        recovered.push(card);
                    } else if (card.stability <= RECOVERED_STABILITY_THRESHOLD) {
                        lapsed.push(card);
                    }
                }
            });
            
            return {
                lapsed: lapsed.sort((a, b) => (b.lapses || 0) - (a.lapses || 0)),
                recovered: recovered.sort((a, b) => b.stability - a.stability)
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataUtils', `Error computing performance stats: ${errorMessage}`, { err });
            return { lapsed: [], recovered: [] };
        }
    }

    /**
     * Formats a Date instance as an ISO `YYYY-MM-DD` string in local timezone.
     * @param date - Date to convert.
     * @returns `YYYY-MM-DD` date key string.
     */
    formatDateKey(date: Date): string {
        try {
            return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataUtils', `Error formatting date key: ${errorMessage}`, { date, err });
            return new Date().toISOString().split('T')[0];
        }
    }
    
    /**
     * Calculates the active consecutive daily study streak from activity records.
     * @returns Number of consecutive days reviewed up to today/yesterday.
     */
    calculateCurrentStreak(): number {
        try {
            let streak = 0;
            const checkDate = new Date(this.today);
            const activeDates = Object.keys(this.activity).filter(d => this.activity[d] > 0).sort();
            if (activeDates.length === 0) return 0;

            const oldestDateParts = activeDates[0].split('-').map(Number);
            const oldestTimestamp = new Date(oldestDateParts[0], oldestDateParts[1] - 1, oldestDateParts[2]).getTime();

            let dayCount = 0;
            while (checkDate.getTime() >= oldestTimestamp - MS_PER_DAY) {
                const dateStr = this.formatDateKey(checkDate);
                if (this.activity[dateStr] && this.activity[dateStr] > 0) {
                    streak++;
                    checkDate.setDate(checkDate.getDate() - 1);
                } else {
                    if (dayCount === 0) {
                        checkDate.setDate(checkDate.getDate() - 1);
                        dayCount++;
                        continue;
                    }
                    break;
                }
                dayCount++;
            }
            return streak;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataUtils', `Error calculating current streak: ${errorMessage}`, { err });
            return 0;
        }
    }
    
    /**
     * Correlates historical review timestamps across 4 time-of-day buckets (morning, afternoon,
     * evening, night) with grading performance and duration.
     * @returns {@link ReviewTimeInsights} object containing time bucket breakdown.
     */
    getReviewTimeInsights(): ReviewTimeInsights {
        try {
            const times: Record<string, { reviews: number; reps: number; lapses: number; duration: number; durationCount: number }> = {
                morning: { reviews: 0, reps: 0, lapses: 0, duration: 0, durationCount: 0 },
                afternoon: { reviews: 0, reps: 0, lapses: 0, duration: 0, durationCount: 0 },
                evening: { reviews: 0, reps: 0, lapses: 0, duration: 0, durationCount: 0 },
                night: { reviews: 0, reps: 0, lapses: 0, duration: 0, durationCount: 0 }
            };
            
            let hasTimeData = false;
            
            this.cards.forEach(card => {
                if (card.historyLog && card.historyLog.length > 0) {
                    card.historyLog.forEach((log: ReviewLog | number) => {
                        const logObj = (typeof log === 'object' && log !== null) ? log : { date: log, rating: 0 };
                        if (logObj.date) {
                            hasTimeData = true;
                            const d = new Date(logObj.date);
                            const h = d.getHours();
                            let bucket = 'night';
                            if (h >= 5 && h < 12) bucket = 'morning';
                            else if (h >= 12 && h < 17) bucket = 'afternoon';
                            else if (h >= 17 && h < 21) bucket = 'evening';
                            
                            const ratingNum = typeof logObj.rating === 'number' ? logObj.rating : Number(logObj.rating);
                            if (ratingNum > 0) {
                                times[bucket].reviews++;
                                times[bucket].reps++;
                                if (ratingNum === 1) { 
                                    times[bucket].lapses++;
                                }
                                
                                if (logObj.duration !== undefined) {
                                    times[bucket].duration += logObj.duration;
                                    times[bucket].durationCount++;
                                }
                            }
                        }
                    });
                }
            });
            
            const result: Array<{ bucket: string; reviews: number; retention: number; avgDurationMs: number | null }> = [];
            for (const [bucket, data] of Object.entries(times)) {
                const retention = data.reps > 0 ? ((data.reps - data.lapses) / data.reps) * 100 : 0;
                const avgDurationMs = data.durationCount > 0 ? (data.duration / data.durationCount) : null;
                result.push({
                    bucket,
                    reviews: data.reviews,
                    retention: Math.round(retention),
                    avgDurationMs
                });
            }
            
            return {
                hasTimeData,
                data: result
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataUtils', `Error gathering review time insights: ${errorMessage}`, { err });
            return {
                hasTimeData: false,
                data: []
            };
        }
    }

    /**
     * Calculates projected Exam Readiness recall rates per tag and overall deck
     * based on FSRS memory decay for a target exam date N days ahead.
     * @param [daysAhead=12] - Number of days into the future to project recall.
     * @returns {@link ExamReadinessStats} composite readiness predictions.
     */
    getExamReadinessStats(daysAhead: number = 12): ExamReadinessStats {
        try {
            const numDays = Math.max(0, parseInt(String(daysAhead), 10) || 0);
            const now = Date.now();
            const targetTime = now + (numDays * MS_PER_DAY);
            
            const tags: Record<string, { count: number; reviewedCount: number; totalStability: number; totalProjectedR: number }> = {};
            let totalProjectedRetrievability = 0;
            let totalReviewedCards = 0;

            this.cards.forEach(card => {
                const cardTags = (card.tags && card.tags.length > 0) ? card.tags : ['Untagged'];
                
                let projectedR = 0;
                const hasReviewHistory = card.stability > 0 && (card.last_review);
                
                if (hasReviewHistory && this.scheduler) {
                    projectedR = this.scheduler.getRetrievability(card, targetTime);
                    totalProjectedRetrievability += projectedR;
                    totalReviewedCards++;
                }

                cardTags.forEach((tag: string) => {
                    if (!tags[tag]) {
                        tags[tag] = {
                            count: 0,
                            reviewedCount: 0,
                            totalStability: 0,
                            totalProjectedR: 0
                        };
                    }

                    tags[tag].count++;
                    if (hasReviewHistory) {
                        tags[tag].reviewedCount++;
                        tags[tag].totalStability += card.stability;
                        tags[tag].totalProjectedR += projectedR;
                    }
                });
            });

            const overallRecall = totalReviewedCards > 0 
                ? Math.round((totalProjectedRetrievability / totalReviewedCards) * 100) 
                : 0;

            let atRiskCount = 0;
            const tagResults: ExamReadinessTagResult[] = [];

            for (const [tag, data] of Object.entries(tags)) {
                const expectedRecall = data.reviewedCount > 0 
                    ? Math.round((data.totalProjectedR / data.reviewedCount) * 100) 
                    : 0;
                
                const avgStability = data.reviewedCount > 0 
                    ? Math.round((data.totalStability / data.reviewedCount) * 10) / 10 
                    : 0;

                let status = 'Ready';
                let statusClass = 'ready-high';
                
                if (expectedRecall < RECALL_THRESHOLD_WARNING) {
                    status = 'At Risk';
                    statusClass = 'ready-critical';
                    atRiskCount++;
                } else if (expectedRecall < RECALL_THRESHOLD_GOOD) {
                    status = 'Moderate';
                    statusClass = 'ready-medium';
                }

                tagResults.push({
                    tag,
                    count: data.count,
                    reviewedCount: data.reviewedCount,
                    expectedRecall,
                    avgStability,
                    status,
                    statusClass
                });
            }

            tagResults.sort((a, b) => a.expectedRecall - b.expectedRecall);

            return {
                daysAhead: numDays,
                targetDate: new Date(targetTime),
                overallRecall,
                totalCards: this.cards.length,
                reviewedCards: totalReviewedCards,
                atRiskCount,
                tags: tagResults
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataUtils', `Error computing exam readiness stats: ${errorMessage}`, { daysAhead, err });
            return {
                daysAhead: Math.max(0, parseInt(String(daysAhead), 10) || 0),
                targetDate: new Date(),
                overallRecall: 0,
                totalCards: this.cards ? this.cards.length : 0,
                reviewedCards: 0,
                atRiskCount: 0,
                tags: []
            };
        }
    }

    /**
     * Calculates Future Memory Simulation data predicting decay if user stops studying.
     * Evaluates fixed intervals (30, 90, 180 days) plus a user-controlled slider day target.
     * @param [customDays=45] - Specific day offset requested by the simulation slider.
     * @returns {@link FutureMemorySimulationStats} containing retention decay benchmarks and curve coordinates.
     */
    getFutureMemorySimulation(customDays: number = 45): FutureMemorySimulationStats {
        try {
            const sliderDays = Math.max(0, parseInt(String(customDays), 10) || 0);
            const now = Date.now();
            
            const intervals = [0, 30, 90, 180];
            const retentionByInterval: Record<number, number> = { 0: 0, 30: 0, 90: 0, 180: 0 };
            let customRetention = 0;
            let forgottenCount = 0;
            let reviewedCardsCount = 0;

            const curveDays = [0, 15, 30, 45, 60, 90, 120, 150, 180];
            const curveSum: Record<number, number> = {};
            curveDays.forEach(d => curveSum[d] = 0);

            const sched = this.scheduler;
            if (!sched) {
                return {
                    today: 0, d30: 0, d90: 0, d180: 0,
                    custom: { days: sliderDays, retention: 0, forgottenCount: 0, totalCards: this.cards.length },
                    curvePoints: [], totalCards: this.cards.length, reviewedCards: 0
                };
            }

            this.cards.forEach(card => {
                const hasReviewHistory = card.stability > 0 && (card.last_review);
                if (hasReviewHistory) {
                    reviewedCardsCount++;

                    intervals.forEach(day => {
                        const targetTime = now + (day * MS_PER_DAY);
                        const r = sched.getRetrievability(card, targetTime);
                        retentionByInterval[day] += r;
                    });

                    const customTime = now + (sliderDays * MS_PER_DAY);
                    const rCustom = sched.getRetrievability(card, customTime);
                    customRetention += rCustom;

                    if (rCustom < 0.70) {
                        forgottenCount++;
                    }

                    curveDays.forEach(day => {
                        const targetTime = now + (day * MS_PER_DAY);
                        curveSum[day] += sched.getRetrievability(card, targetTime);
                    });
                }
            });

            const calcAvgPercent = (sum: number) => reviewedCardsCount > 0 ? Math.round((sum / reviewedCardsCount) * 100) : 0;

            const todayRetention = calcAvgPercent(retentionByInterval[0]);
            const d30Retention = calcAvgPercent(retentionByInterval[30]);
            const d90Retention = calcAvgPercent(retentionByInterval[90]);
            const d180Retention = calcAvgPercent(retentionByInterval[180]);
            const customRetentionPercent = calcAvgPercent(customRetention);

            const curvePoints: SimulationCurvePoint[] = curveDays.map(day => ({
                day,
                retention: calcAvgPercent(curveSum[day])
            }));

            return {
                today: todayRetention,
                d30: d30Retention,
                d90: d90Retention,
                d180: d180Retention,
                custom: {
                    days: sliderDays,
                    retention: customRetentionPercent,
                    forgottenCount,
                    totalCards: this.cards.length
                },
                curvePoints,
                totalCards: this.cards.length,
                reviewedCards: reviewedCardsCount
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('DataUtils', `Error computing future memory simulation: ${errorMessage}`, { customDays, err });
            return {
                today: 0,
                d30: 0,
                d90: 0,
                d180: 0,
                custom: { days: Math.max(0, parseInt(String(customDays), 10) || 0), retention: 0, forgottenCount: 0, totalCards: this.cards ? this.cards.length : 0 },
                curvePoints: [],
                totalCards: this.cards ? this.cards.length : 0,
                reviewedCards: 0
            };
        }
    }
}
