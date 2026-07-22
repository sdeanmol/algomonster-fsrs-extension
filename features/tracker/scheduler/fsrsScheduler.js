/**
 * @file features/tracker/scheduler/fsrsScheduler.js
 * @description Concrete implementation of the Free Spaced Repetition Scheduler (FSRS) algorithm.
 * Extends the abstract Scheduler base class to provide mathematically precise card
 * stability, difficulty, retrievability, and scheduled review intervals using ts-fsrs.
 */

import { fsrs, createEmptyCard, Rating, State } from 'ts-fsrs';
import { getLastReviewDate } from '../../common/utils/cardUtils.js';

// Priority to require() so Webpack bundles the local scheduler.js instead of picking up Chrome's native window.Scheduler API.
const BaseScheduler = typeof require !== 'undefined' ? require('./scheduler.js') : AbstractScheduler;

class FsrsScheduler extends BaseScheduler {
    /**
     * Initializes the FSRS scheduler with standard FSRS-4.5 weights and constants.
     * @param {Object|null} [params=null] - Configuration overrides.
     */
    constructor(params = null) {
        super();
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
        const now = new Date();

        // ts-fsrs provides createEmptyCard() which scaffolds the standard FSRS structure
        const emptyCard = createEmptyCard(now);

        return {
            id: Date.now().toString(),
            problemTitle,
            problemUrl,
            textRead,
            approach,
            tags,
            historyLog: [{ rating: Rating.Manual, date: now.getTime() }], // Track exactly when this was created/reviewed

            // FSRS standardized schema fields:
            due: emptyCard.due.getTime(),
            stability: emptyCard.stability,
            difficulty: emptyCard.difficulty,
            elapsed_days: emptyCard.elapsed_days,
            scheduled_days: emptyCard.scheduled_days,
            reps: emptyCard.reps,
            lapses: emptyCard.lapses,
            state: emptyCard.state,
            last_review: emptyCard.last_review ? emptyCard.last_review.getTime() : null
        };
    }

    reviewCard(card, rating, customWeights = null, now = Date.now(), timeTaken = null) {
        if (typeof window !== 'undefined' && window.Logger) window.Logger.debug('FSRS', `Reviewing card: ${card.problemTitle} with rating ${rating}`);
        let newCard = { ...card };

        newCard.previousDue = card.due;
        newCard.historyLog = newCard.historyLog || [];
        
        const logEntry = { rating, date: now };
        if (timeTaken !== null) {
            logEntry.duration = timeTaken;
        }
        newCard.historyLog.push(logEntry);

        let lastReview = getLastReviewDate(card);

        const w = (customWeights && customWeights.length === 17) ? customWeights : this.w;

        // Initialize ts-fsrs scheduler with standard or custom weights
        const scheduler = fsrs({
            w: w,
            request_retention: this.requestRetention
        });

        // Convert plain object back to ts-fsrs Card interface format
        const tsCard = {
            due: new Date(newCard.due),
            stability: newCard.stability,
            difficulty: newCard.difficulty,
            elapsed_days: newCard.elapsed_days !== undefined ? newCard.elapsed_days : (newCard.elapsedDays || 0),
            scheduled_days: newCard.scheduled_days !== undefined ? newCard.scheduled_days : (newCard.scheduledDays || 0),
            reps: newCard.reps,
            lapses: newCard.lapses,
            state: newCard.state,
            last_review: lastReview ? new Date(lastReview) : undefined
        };

        // ts-fsrs ratings are: 1=Again, 2=Hard, 3=Good, 4=Easy
        const result = scheduler.next(tsCard, new Date(now), rating);

        // Map back to JSON-serializable structure
        newCard.due = result.card.due.getTime();
        newCard.stability = result.card.stability;
        newCard.difficulty = result.card.difficulty;
        newCard.elapsed_days = result.card.elapsed_days;
        newCard.scheduled_days = result.card.scheduled_days;
        newCard.reps = result.card.reps;
        newCard.lapses = result.card.lapses;
        newCard.state = result.card.state;
        newCard.last_review = result.card.last_review ? result.card.last_review.getTime() : null;

        return newCard;
    }

    getRetrievability(card, now = Date.now()) {
        let lastReview = getLastReviewDate(card);

        if (card.stability <= 0 || !lastReview) {
            return 0;
        }

        const tsCard = {
            due: new Date(card.due),
            stability: card.stability,
            difficulty: card.difficulty,
            elapsed_days: card.elapsed_days !== undefined ? card.elapsed_days : (card.elapsedDays || 0),
            scheduled_days: card.scheduled_days !== undefined ? card.scheduled_days : (card.scheduledDays || 0),
            reps: card.reps,
            lapses: card.lapses,
            state: card.state,
            last_review: new Date(lastReview)
        };

        // ts-fsrs native retrievability computation
        const scheduler = fsrs({
            w: this.w,
            request_retention: this.requestRetention
        });

        // get_retrievability takes the card state and current date, returns probability (0.0 to 1.0)
        return scheduler.get_retrievability(tsCard, new Date(now), false) || 0;
    }

    getProjectedRetrievability(stability, elapsedDays) {
        if (stability <= 0) return 0;
        return Math.pow(1 + (this.factor * elapsedDays) / stability, this.decay);
    }

    getDefaultRequestRetention() {
        return this.requestRetention;
    }

    isHighDifficulty(card) {
        // In FSRS, difficulty scales from 1 (easiest) to 10 (hardest).
        return card.difficulty >= 7;
    }

    isGraduated(card) {
        // FSRS graduated criteria: state is Review (2) and stability indicates long-term retention.
        return card.state === State.Review && card.stability > 7;
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
}
if (typeof window !== 'undefined') {
    window.FsrsScheduler = FsrsScheduler;
}
