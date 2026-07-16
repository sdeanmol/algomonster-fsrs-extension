/**
 * @file features/tracker/scheduler/fsrsScheduler.js
 * @description Concrete implementation of the Free Spaced Repetition Scheduler (FSRS) algorithm.
 * Extends the abstract Scheduler base class to provide mathematically precise card
 * stability, difficulty, retrievability, and scheduled review intervals.
 */

const BaseScheduler = typeof Scheduler !== 'undefined' ? Scheduler : (typeof require !== 'undefined' ? require('./scheduler.js') : class {});

class FsrsScheduler extends BaseScheduler {
    /**
     * Initializes the FSRS scheduler with standard FSRS-4.5 weights and constants.
     * @param {Object|null} [params=null] - Configuration overrides.
     */
    constructor(params = null) {
        super();
        // Standard FSRS-4.5 default weight parameters for algorithm stability
        this.w = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
        this.decay = -0.5;
        this.factor = 19 / 81;
        this.requestRetention = 0.90; // Target memory retention rate

        if (params) {
            if (params.w && Array.isArray(params.w) && params.w.length === 17) {
                this.w = params.w;
            }
            if (params.decay !== undefined && !isNaN(params.decay)) {
                this.decay = parseFloat(params.decay);
            }
            if (params.factor !== undefined && !isNaN(params.factor)) {
                this.factor = parseFloat(params.factor);
            }
            if (params.requestRetention !== undefined && !isNaN(params.requestRetention)) {
                this.requestRetention = parseFloat(params.requestRetention);
            }
        }
    }

    createCard(problemTitle, problemUrl, textRead, approach, tags = []) {
        if (typeof window !== 'undefined' && window.Logger) window.Logger.debug('FSRS', 'Creating new card', { problemTitle, problemUrl });
        const now = Date.now();
        return {
            id: now.toString(),
            problemTitle,
            problemUrl,
            textRead,
            approach,
            tags,
            due: now,
            stability: 0,
            difficulty: 0,
            elapsed_days: 0,
            scheduled_days: 0,
            reps: 0,
            lapses: 0,
            state: 0, // 0 (New), 1 (Learning), 2 (Review), 3 (Relearning)
            historyLog: [now] // Track exactly when this was created/reviewed
        };
    }

    /**
     * Applies standard interval fuzzing/jitter to prevent study review clustering.
     * @param {number} interval - Calculated scheduled interval in days.
     * @returns {number} Fuzzed interval in days.
     */
    applyFuzz(interval) {
        if (interval < 2.5) return Math.round(interval);
        let fuzzRange;
        if (interval < 7) fuzzRange = 1;
        else if (interval < 20) fuzzRange = 2;
        else if (interval < 45) fuzzRange = 3;
        else fuzzRange = Math.max(4, Math.round(interval * 0.05));
        
        const fuzz = Math.floor(Math.random() * (fuzzRange * 2 + 1)) - fuzzRange;
        return Math.max(1, Math.round(interval + fuzz));
    }

    reviewCard(card, rating, customWeights = null, now = Date.now()) {
        if (typeof window !== 'undefined' && window.Logger) window.Logger.debug('FSRS', `Reviewing card: ${card.problemTitle} with rating ${rating}`);
        let newCard = { ...card };
        
        newCard.previousDue = card.due;
        newCard.historyLog = newCard.historyLog || [];
        newCard.historyLog.push(now);

        const w = (customWeights && customWeights.length === 17) ? customWeights : this.w;

        // FSRS State Transitions & Stability Math
        if (newCard.state === 0) {
            newCard.difficulty = Math.max(1, Math.min(10, w[4] + (rating - 3) * w[5]));
            newCard.stability = w[rating - 1];
            newCard.state = rating === 1 ? 1 : 2;
        } else {
            const retrievability = Math.exp(this.decay * newCard.elapsed_days / newCard.stability);
            newCard.difficulty = Math.max(1, Math.min(10, newCard.difficulty + w[6] * (rating - 3)));

            if (rating === 1) {
                newCard.stability = w[11] * Math.pow(newCard.difficulty, -w[12]) * Math.pow(newCard.stability, w[13]) * Math.exp((1 - retrievability) * w[14]);
                newCard.lapses += 1;
                newCard.state = 3; // Relearning
            } else {
                newCard.stability = newCard.stability * (1 + Math.exp(w[8]) * (11 - newCard.difficulty) * Math.pow(newCard.stability, -w[9]) * (Math.exp((1 - retrievability) * w[10]) - 1));
                newCard.state = 2; // Review
            }
        }

        newCard.reps += 1;
        const intervalModifier = 9 * (Math.pow(this.requestRetention, 1 / this.decay) - 1);
        let rawInterval = newCard.stability * intervalModifier;
        
        newCard.scheduled_days = this.applyFuzz(rawInterval);
        newCard.due = now + (newCard.scheduled_days * 24 * 60 * 60 * 1000);
        return newCard;
    }

    getRetrievability(card, now = Date.now()) {
        if (card.stability <= 0 || !card.lastReview) {
            return 0;
        }
        const elapsedDays = (now - new Date(card.lastReview).getTime()) / (1000 * 60 * 60 * 24);
        return this.getProjectedRetrievability(card.stability, Math.max(0, elapsedDays));
    }

    getProjectedRetrievability(stability, elapsedDays) {
        if (stability <= 0) return 0;
        return Math.exp(this.decay * elapsedDays / stability);
    }

    getDefaultRequestRetention() {
        return this.requestRetention;
    }

    isHighDifficulty(card) {
        // In FSRS, difficulty scales from 1 (easiest) to 10 (hardest).
        return card.difficulty >= 7;
    }

    isGraduated(card) {
        // FSRS graduated criteria: state is Review and stability indicates long-term retention.
        return card.state === 2 && card.stability > 7;
    }

    supportsOptimization() {
        return true;
    }

    async optimize(reviewHistory) {
        let OptimizerClass;
        if (typeof FsrsOptimizer !== 'undefined') {
            OptimizerClass = FsrsOptimizer;
        } else if (typeof require !== 'undefined') {
            OptimizerClass = require('./fsrsOptimizer.js');
        } else if (typeof window !== 'undefined' && window.FsrsOptimizer) {
            OptimizerClass = window.FsrsOptimizer;
        }

        if (!OptimizerClass) throw new Error("FsrsOptimizer class not found.");
        
        const optimizer = new OptimizerClass();
        const optimizedWeights = await optimizer.trainWeights(reviewHistory, this.w, this.requestRetention);
        
        this.w = optimizedWeights;
        
        return {
            status: 'success',
            newWeights: optimizedWeights,
            timestamp: Date.now(),
            version: '1.0.0-personalized'
        };
    }

    resetConfiguration() {
        this.w = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
        this.decay = -0.5;
        this.factor = 19 / 81;
        this.requestRetention = 0.90;
    }

    exportConfiguration() {
        return {
            w: [...this.w],
            decay: this.decay,
            factor: this.factor,
            requestRetention: this.requestRetention
        };
    }

    importConfiguration(config) {
        if (!config) return;
        if (config.w && Array.isArray(config.w) && config.w.length === 17) {
            this.w = config.w;
        }
        if (config.decay !== undefined) this.decay = parseFloat(config.decay);
        if (config.factor !== undefined) this.factor = parseFloat(config.factor);
        if (config.requestRetention !== undefined) this.requestRetention = parseFloat(config.requestRetention);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FsrsScheduler;
} else if (typeof window !== 'undefined') {
    window.FsrsScheduler = FsrsScheduler;
}
