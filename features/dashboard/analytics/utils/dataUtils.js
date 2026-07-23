/**
 * @file features/dashboard/analytics/utils/dataUtils.js
 * @description Shared utilities for aggregating and calculating FSRS data.
 */

import { getLastReviewDate } from '../../../common/utils/cardUtils.js';

export class DataUtils {
    constructor(cards, activity, scheduler) {
        this.cards = cards || [];
        
        // Ensure consistent camelCase properties for analytics calculations
        this.cards.forEach(card => {
            card.lastReview = getLastReviewDate(card);
            
            if (card.elapsedDays === undefined) card.elapsedDays = card.elapsed_days || 0;
            if (card.scheduledDays === undefined) card.scheduledDays = card.scheduled_days || 0;
        });

        this.activity = activity || {};
        this.scheduler = scheduler;
        this.today = new Date();
        this.todayStart = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());
    }

    /**
     * Get basic summary statistics
     */
    getSummaryStats() {
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

        let dueCount = 0; // Due exactly right now
        let dueTodayCount = 0; // Due anytime today or past due
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        let totalRetrievability = 0;
        let retrievabilityCount = 0;

        this.cards.forEach(card => {
            const dueDate = new Date(card.due);
            const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            const diffDays = Math.floor((dueDay - todayStart) / (1000 * 60 * 60 * 24));
            
            // Cards due at this exact millisecond
            if (dueDate <= now) {
                dueCount++;
            }
            
            // Cards due anytime today
            if (diffDays <= 0) {
                dueTodayCount++;
            }

            if (card.stability > 0 && card.lastReview && this.scheduler) {
                const r = this.scheduler.getRetrievability(card, now);
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
            retention, // Historic log retention
            trueRetention, // FSRS Current Retrievability
            avgStability,
            totalActivityReviews,
            due: dueCount,
            dueToday: dueTodayCount,
            streak: this.calculateCurrentStreak()
        };
    }

    /**
     * Get learning velocity metrics
     */
    getLearningVelocity() {
        const now = Date.now();
        const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);
        
        let newCardsLastWeek = 0;
        let newCardsPrevWeek = 0;
        let graduatedLastWeek = 0;
        let graduatedPrevWeek = 0;
        
        this.cards.forEach(card => {
            let firstReview = card.lastReview;
            if (card.historyLog && card.historyLog.length > 0) {
                firstReview = card.historyLog[0].date;
            }
            
            if (firstReview) {
                if (firstReview > oneWeekAgo) {
                    newCardsLastWeek++;
                } else if (firstReview > twoWeeksAgo && firstReview <= oneWeekAgo) {
                    newCardsPrevWeek++;
                }
            }
            
            if (card.stability > 7 && card.lastReview) {
                if (card.lastReview > oneWeekAgo) {
                    graduatedLastWeek++;
                } else if (card.lastReview > twoWeeksAgo && card.lastReview <= oneWeekAgo) {
                    graduatedPrevWeek++;
                }
            }
        });
        
        let reviewsLastWeek = 0;
        let reviewsPrevWeek = 0;
        
        let dailyNew = [0, 0, 0, 0, 0, 0, 0];
        let dailyGrad = [0, 0, 0, 0, 0, 0, 0];
        let dailyRev = [0, 0, 0, 0, 0, 0, 0];

        // We will need to map timestamp to the correct bin 0-6 (0 is 6 days ago, 6 is today)
        this.cards.forEach(card => {
            let firstReview = card.lastReview;
            if (card.historyLog && card.historyLog.length > 0) {
                firstReview = card.historyLog[0].date;
            }
            if (firstReview && firstReview > oneWeekAgo) {
                const dayIndex = 6 - Math.floor((now - firstReview) / (1000 * 60 * 60 * 24));
                if (dayIndex >= 0 && dayIndex < 7) dailyNew[dayIndex]++;
            }
            
            if (card.stability > 7 && card.lastReview && card.lastReview > oneWeekAgo) {
                const dayIndex = 6 - Math.floor((now - card.lastReview) / (1000 * 60 * 60 * 24));
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
                dailyRev[6 - i] = val; // i=0 is today (index 6), i=6 is 6 days ago (index 0)
            } else {
                reviewsPrevWeek += val;
            }
        }

        const calcTrend = (current, previous) => {
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
    }

    /**
     * Group cards by tag and calculate stats
     */
    getStatsByTag() {
        const tags = {};
        
        this.cards.forEach(card => {
            const cardTags = (card.tags && card.tags.length > 0) ? card.tags : ['Untagged'];
            cardTags.forEach(tag => {
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

                if (card.stability > 0 && card.lastReview && this.scheduler) {
                    const r = this.scheduler.getRetrievability(card, Date.now());
                    tags[tag].totalRetrievability += r;
                    tags[tag].retrievabilityCount++;
                }
            });
        });
        
        const result = [];
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
    }
    
    /**
     * Get lapse leaderboard / recovery stats
     */
    getPerformanceStats() {
        const lapsed = [];
        const recovered = [];
        
        this.cards.forEach(card => {
            if ((card.lapses || 0) > 0) {
                if (card.lapses >= 2 && card.stability > 14) {
                    recovered.push(card);
                } else if (card.stability <= 14) {
                    lapsed.push(card);
                }
            }
        });
        
        return {
            lapsed: lapsed.sort((a, b) => (b.lapses || 0) - (a.lapses || 0)),
            recovered: recovered.sort((a, b) => b.stability - a.stability)
        };
    }

    /**
     * Format date to YYYY-MM-DD
     */
    formatDateKey(date) {
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
    
    calculateCurrentStreak() {
        let streak = 0;
        const checkDate = new Date(this.today);

        for (let i = 0; i < 365; i++) {
            const dateStr = this.formatDateKey(checkDate);
            if (this.activity[dateStr] && this.activity[dateStr] > 0) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                if (i === 0) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    continue;
                }
                break;
            }
        }
        return streak;
    }
    
    getReviewTimeInsights() {
        const times = {
            morning: { reviews: 0, reps: 0, lapses: 0, duration: 0, durationCount: 0 },   // 5AM - 12PM
            afternoon: { reviews: 0, reps: 0, lapses: 0, duration: 0, durationCount: 0 }, // 12PM - 5PM
            evening: { reviews: 0, reps: 0, lapses: 0, duration: 0, durationCount: 0 },   // 5PM - 9PM
            night: { reviews: 0, reps: 0, lapses: 0, duration: 0, durationCount: 0 }      // 9PM - 5AM
        };
        
        let hasTimeData = false;
        
        this.cards.forEach(card => {
            if (card.historyLog && card.historyLog.length > 0) {
                card.historyLog.forEach((log, index) => {
                    if (log.date) {
                        hasTimeData = true;
                        const d = new Date(log.date);
                        const h = d.getHours();
                        let bucket = 'night';
                        if (h >= 5 && h < 12) bucket = 'morning';
                        else if (h >= 12 && h < 17) bucket = 'afternoon';
                        else if (h >= 17 && h < 21) bucket = 'evening';
                        
                        if (log.rating > 0) {
                            times[bucket].reviews++;
                            times[bucket].reps++;
                            if (log.rating === 1) { 
                                times[bucket].lapses++;
                            }
                            
                            if (log.duration !== undefined) {
                                times[bucket].duration += log.duration;
                                times[bucket].durationCount++;
                            }
                        }
                    }
                });
            }
        });
        
        const result = [];
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
    }

    /**
     * Calculates projected Exam Readiness recall rates per tag and overall deck
     * based on FSRS memory decay for a target exam date N days ahead.
     * @param {number} daysAhead Number of days until the exam (e.g. 12)
     * @returns {Object} Exam readiness projections and subject breakdown
     */
    getExamReadinessStats(daysAhead = 12) {
        const numDays = Math.max(0, parseInt(daysAhead, 10) || 0);
        const now = Date.now();
        const targetTime = now + (numDays * 24 * 60 * 60 * 1000);
        
        const tags = {};
        let totalProjectedRetrievability = 0;
        let totalReviewedCards = 0;

        this.cards.forEach(card => {
            const cardTags = (card.tags && card.tags.length > 0) ? card.tags : ['Untagged'];
            
            let projectedR = 0;
            const hasReviewHistory = card.stability > 0 && (card.lastReview || card.last_review);
            
            if (hasReviewHistory && this.scheduler) {
                // Determine projected retrievability using FSRS scheduler for targetTime
                projectedR = this.scheduler.getRetrievability(card, targetTime);
                totalProjectedRetrievability += projectedR;
                totalReviewedCards++;
            }

            cardTags.forEach(tag => {
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
        const tagResults = [];

        for (const [tag, data] of Object.entries(tags)) {
            const expectedRecall = data.reviewedCount > 0 
                ? Math.round((data.totalProjectedR / data.reviewedCount) * 100) 
                : 0;
            
            const avgStability = data.reviewedCount > 0 
                ? Math.round((data.totalStability / data.reviewedCount) * 10) / 10 
                : 0;

            let status = 'Ready';
            let statusClass = 'ready-high';
            
            if (expectedRecall < 75) {
                status = 'At Risk';
                statusClass = 'ready-critical';
                atRiskCount++;
            } else if (expectedRecall < 90) {
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

        // Sort tags by lowest expected recall first (prioritize subjects needing attention)
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
    }

    /**
     * Calculates Future Memory Simulation data predicting decay if user stops studying.
     * Evaluates FSRS retrievability at Today (0d), 30d, 90d, 180d and custom days.
     * @param {number} customDays Number of days for the interactive slider (e.g. 45)
     * @returns {Object} Memory simulation retention percentages and decay curve points
     */
    getFutureMemorySimulation(customDays = 45) {
        const sliderDays = Math.max(0, parseInt(customDays, 10) || 0);
        const now = Date.now();
        
        const intervals = [0, 30, 90, 180];
        const retentionByInterval = { 0: 0, 30: 0, 90: 0, 180: 0 };
        let customRetention = 0;
        let forgottenCount = 0;
        let reviewedCardsCount = 0;

        const curveDays = [0, 15, 30, 45, 60, 90, 120, 150, 180];
        const curveSum = {};
        curveDays.forEach(d => curveSum[d] = 0);

        this.cards.forEach(card => {
            const hasReviewHistory = card.stability > 0 && (card.lastReview || card.last_review);
            if (hasReviewHistory && this.scheduler) {
                reviewedCardsCount++;

                // Compute retrievability for key milestone intervals
                intervals.forEach(day => {
                    const targetTime = now + (day * 24 * 60 * 60 * 1000);
                    const r = this.scheduler.getRetrievability(card, targetTime);
                    retentionByInterval[day] += r;
                });

                // Compute retrievability for custom slider days
                const customTime = now + (sliderDays * 24 * 60 * 60 * 1000);
                const rCustom = this.scheduler.getRetrievability(card, customTime);
                customRetention += rCustom;

                if (rCustom < 0.70) {
                    forgottenCount++;
                }

                // Compute points for curve graph
                curveDays.forEach(day => {
                    const targetTime = now + (day * 24 * 60 * 60 * 1000);
                    curveSum[day] += this.scheduler.getRetrievability(card, targetTime);
                });
            }
        });

        const calcAvgPercent = (sum) => reviewedCardsCount > 0 ? Math.round((sum / reviewedCardsCount) * 100) : 0;

        const todayRetention = calcAvgPercent(retentionByInterval[0]);
        const d30Retention = calcAvgPercent(retentionByInterval[30]);
        const d90Retention = calcAvgPercent(retentionByInterval[90]);
        const d180Retention = calcAvgPercent(retentionByInterval[180]);
        const customRetentionPercent = calcAvgPercent(customRetention);

        const curvePoints = curveDays.map(day => ({
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
    }
}
