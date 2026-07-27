/**
 * @file features/tracker/scheduler/fsrsScheduler.ts
 * @description Concrete implementation of the Free Spaced Repetition Scheduler (FSRS) algorithm.
 * Extends the abstract Scheduler base class to provide mathematically precise card
 * stability, difficulty, retrievability, and scheduled review intervals using ts-fsrs.
 */

import { fsrs, createEmptyCard, Rating, State, Card as TsFsrsCard, Grade } from 'ts-fsrs';
import { getLastReviewDate } from '../../common/utils/cardUtils';

import AbstractScheduler from './scheduler';

const BaseScheduler: any = AbstractScheduler || (typeof window !== 'undefined' && (window as any).AbstractScheduler) || class {};

export class FsrsScheduler extends BaseScheduler {
    public w: number[];
    public decay: number;
    public factor: number;
    public requestRetention: number;

    /**
     * Initializes the FSRS scheduler with standard FSRS-4.5 weights and constants.
     */
    constructor(params: { w?: number[]; decay?: number | string; factor?: number | string; requestRetention?: number | string } | null = null) {
        super();
        this.w = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
        this.decay = -0.5;
        this.factor = 19 / 81;
        this.requestRetention = 0.90; // Target memory retention rate

        if (params) {
            if (params.w && Array.isArray(params.w) && params.w.length === 17) {
                this.w = params.w;
            }
            if (params.decay !== undefined && !isNaN(Number(params.decay))) {
                this.decay = parseFloat(String(params.decay));
            }
            if (params.factor !== undefined && !isNaN(Number(params.factor))) {
                this.factor = parseFloat(String(params.factor));
            }
            if (params.requestRetention !== undefined && !isNaN(Number(params.requestRetention))) {
                this.requestRetention = parseFloat(String(params.requestRetention));
            }
        }
    }

    createCard(problemTitle: string, problemUrl: string, textRead: string, approach: string, tags: string[] = []): any {
        if (typeof window !== 'undefined' && (window as any).Logger) {
            (window as any).Logger.debug('FSRS', 'Creating new card', { problemTitle, problemUrl });
        }
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
            historyLog: [{ rating: Rating.Manual, date: now.getTime() }],

            // FSRS standardized schema fields:
            due: emptyCard.due.getTime(),
            stability: emptyCard.stability,
            difficulty: emptyCard.difficulty,
            elapsed_days: emptyCard.elapsed_days,
            scheduled_days: emptyCard.scheduled_days,
            learning_steps: emptyCard.learning_steps ?? 0,
            reps: emptyCard.reps,
            lapses: emptyCard.lapses,
            state: emptyCard.state,
            last_review: emptyCard.last_review ? emptyCard.last_review.getTime() : null
        };
    }

    reviewCard(card: any, rating: Rating | number, customWeights: number[] | null = null, now: number = Date.now(), timeTaken: number | null = null): any {
        if (typeof window !== 'undefined' && (window as any).Logger) {
            (window as any).Logger.debug('FSRS', `Reviewing card: ${card.problemTitle} with rating ${rating}`);
        }
        let newCard: any = { ...card };

        newCard.previousDue = card.due;
        newCard.historyLog = newCard.historyLog || [];

        const logEntry: { rating: Rating | number; date: number; duration?: number } = { rating, date: now };
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
        const tsCard: TsFsrsCard = {
            due: new Date(newCard.due),
            stability: newCard.stability,
            difficulty: newCard.difficulty,
            elapsed_days: newCard.elapsed_days !== undefined ? newCard.elapsed_days : (newCard.elapsedDays || 0),
            scheduled_days: newCard.scheduled_days !== undefined ? newCard.scheduled_days : (newCard.scheduledDays || 0),
            learning_steps: newCard.learning_steps !== undefined ? newCard.learning_steps : (newCard.learningSteps || 0),
            reps: newCard.reps,
            lapses: newCard.lapses,
            state: newCard.state,
            last_review: lastReview ? new Date(lastReview) : undefined
        };

        // ts-fsrs ratings are: 1=Again, 2=Hard, 3=Good, 4=Easy
        const result = scheduler.next(tsCard, new Date(now), rating as Grade);

        // Map back to JSON-serializable structure
        newCard.due = result.card.due.getTime();
        newCard.stability = result.card.stability;
        newCard.difficulty = result.card.difficulty;
        newCard.elapsed_days = result.card.elapsed_days;
        newCard.scheduled_days = result.card.scheduled_days;
        newCard.learning_steps = result.card.learning_steps;
        newCard.reps = result.card.reps;
        newCard.lapses = result.card.lapses;
        newCard.state = result.card.state;
        newCard.last_review = result.card.last_review ? result.card.last_review.getTime() : null;

        return newCard;
    }

    getRetrievability(card: any, now: number = Date.now()): number {
        let lastReview = getLastReviewDate(card);

        if (card.stability <= 0 || !lastReview) {
            return 0;
        }

        const tsCard: TsFsrsCard = {
            due: new Date(card.due),
            stability: card.stability,
            difficulty: card.difficulty,
            elapsed_days: card.elapsed_days !== undefined ? card.elapsed_days : (card.elapsedDays || 0),
            scheduled_days: card.scheduled_days !== undefined ? card.scheduled_days : (card.scheduledDays || 0),
            learning_steps: card.learning_steps !== undefined ? card.learning_steps : (card.learningSteps || 0),
            reps: card.reps,
            lapses: card.lapses,
            state: card.state,
            last_review: new Date(lastReview)
        };

        const scheduler = fsrs({
            w: this.w,
            request_retention: this.requestRetention
        });

        return scheduler.get_retrievability(tsCard, new Date(now), false) || 0;
    }

    getProjectedRetrievability(stability: number, elapsedDays: number): number {
        if (stability <= 0) return 0;
        return Math.pow(1 + (this.factor * elapsedDays) / stability, this.decay);
    }

    getDefaultRequestRetention(): number {
        return this.requestRetention;
    }

    isHighDifficulty(card: any): boolean {
        return card.difficulty >= 7;
    }

    isGraduated(card: any): boolean {
        return card.state === State.Review && card.stability > 7;
    }

    resetConfiguration(): void {
        this.w = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
        this.decay = -0.5;
        this.factor = 19 / 81;
        this.requestRetention = 0.90;
    }

    exportConfiguration(): { w: number[]; decay: number; factor: number; requestRetention: number } {
        return {
            w: [...this.w],
            decay: this.decay,
            factor: this.factor,
            requestRetention: this.requestRetention
        };
    }

    importConfiguration(config?: any): void {
        if (!config) return;
        if (config.w && Array.isArray(config.w) && config.w.length === 17) {
            this.w = config.w;
        }
        if (config.decay !== undefined && !isNaN(Number(config.decay))) this.decay = parseFloat(String(config.decay));
        if (config.factor !== undefined && !isNaN(Number(config.factor))) this.factor = parseFloat(String(config.factor));
        if (config.requestRetention !== undefined && !isNaN(Number(config.requestRetention))) this.requestRetention = parseFloat(String(config.requestRetention));
    }
}

export default FsrsScheduler;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FsrsScheduler;
}
if (typeof window !== 'undefined') {
    (window as any).FsrsScheduler = FsrsScheduler;
}
