/**
 * @file features/dashboard/analytics/utils/dataUtils.ts
 * @description Shared utilities for aggregating and calculating FSRS data.
 */

import { Logger } from '@common/logger';
import { getLastReviewDate } from '../../../common/utils/cardUtils';
import { Card, ReviewLog } from '../../../../types/domain';
import { MS_PER_DAY, MS_PER_WEEK, RECOVERED_STABILITY_THRESHOLD, GRADUATED_STABILITY_THRESHOLD, RECALL_THRESHOLD_GOOD, RECALL_THRESHOLD_WARNING } from '../../../common/constants';
import AbstractScheduler from '../../../tracker/scheduler/scheduler';

export interface SummaryStats {
    totalCards: number;
    reviewedCards: number;
    totalReps: number;
    totalLapses: number;
    retention: number;
    trueRetention: number;
    avgStability: number;
    totalActivityReviews: number;
    due: number;
    dueToday: number;
    streak: number;
}

export interface LearningVelocity {
    newCardsPerDay: string;
    newCardsTrend: number;
    sparklineNew: number[];
    graduatedPerWeek: number;
    graduatedTrend: number;
    sparklineGrad: number[];
    reviewsPerDay: string;
    reviewsTrend: number;
    sparklineRev: number[];
}

export interface TagStats {
    tag: string;
    count: number;
    retention: number;
    trueRetention: number;
    avgStability: number;
    lapses: number;
    due: number;
}

export interface PerformanceStats {
    lapsed: Card[];
    recovered: Card[];
}

export interface ReviewTimeInsights {
    hasTimeData: boolean;
    data: Array<{
        bucket: string;
        reviews: number;
        retention: number;
        avgDurationMs: number | null;
    }>;
}

export interface ExamReadinessTagResult {
    tag: string;
    count: number;
    reviewedCount: number;
    expectedRecall: number;
    avgStability: number;
    status: string;
    statusClass: string;
}

export interface ExamReadinessStats {
    daysAhead: number;
    targetDate: Date;
    overallRecall: number;
    totalCards: number;
    reviewedCards: number;
    atRiskCount: number;
    tags: ExamReadinessTagResult[];
}

export interface SimulationCurvePoint {
    day: number;
    retention: number;
}

export interface FutureMemorySimulationStats {
    today: number;
    d30: number;
    d90: number;
    d180: number;
    custom: {
        days: number;
        retention: number;
        forgottenCount: number;
        totalCards: number;
    };
    curvePoints: SimulationCurvePoint[];
    totalCards: number;
    reviewedCards: number;
}

export class DataUtils {
    cards: Card[];
    activity: Record<string, number>;
    scheduler: AbstractScheduler | null;
    today: Date;
    todayStart: Date;

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
     * Get basic summary statistics
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
     * Get learning velocity metrics
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
     * Group cards by tag and calculate stats
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
     * Get lapse leaderboard / recovery stats
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
     * Format date to YYYY-MM-DD
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
