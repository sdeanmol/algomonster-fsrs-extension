/**
 * @file features/tracker/scheduler/fsrsScheduler.ts
 * @description Concrete implementation of the Free Spaced Repetition Scheduler (FSRS) algorithm.
 * Extends the abstract Scheduler base class to provide mathematically precise card
 * stability, difficulty, retrievability, and scheduled review intervals using ts-fsrs.
 */

import { fsrs, createEmptyCard, Rating, State, Card as TsFsrsCard, Grade } from 'ts-fsrs';
import { getLastReviewDate } from '../../common/utils/cardUtils';
import { Card, FSRSParameters } from '../../../types/domain';
import {
    DEFAULT_FSRS_W,
    DEFAULT_FSRS_DECAY,
    DEFAULT_FSRS_FACTOR,
    DEFAULT_FSRS_REQUEST_RETENTION,
    HIGH_DIFFICULTY_THRESHOLD,
    GRADUATED_STABILITY_THRESHOLD
} from '../../common/constants';
import AbstractScheduler from './scheduler';

interface AppLogger {
    debug(category: string, message: string, data?: unknown): void;
    info(category: string, message: string, data?: unknown): void;
    error(category: string, message: string, data?: unknown): void;
}

function getLogger(): AppLogger | undefined {
    if (typeof window !== 'undefined') {
        return (window as unknown as { Logger?: AppLogger }).Logger;
    }
    return undefined;
}

export class FsrsScheduler extends AbstractScheduler {
    public w: number[];
    public decay: number;
    public factor: number;
    public requestRetention: number;

    /**
     * Initializes the FSRS scheduler with standard FSRS-4.5 weights and constants.
     */
    constructor(params: Partial<FSRSParameters> | null = null) {
        super();
        this.w = [...DEFAULT_FSRS_W];
        this.decay = DEFAULT_FSRS_DECAY;
        this.factor = DEFAULT_FSRS_FACTOR;
        this.requestRetention = DEFAULT_FSRS_REQUEST_RETENTION; // Target memory retention rate

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

    createCard(problemTitle: string = '', problemUrl: string = '', textRead: string = '', approach: string = '', tags: string[] = []): Card {
        const logger = getLogger();
        if (logger) {
            logger.debug('FSRS', 'Creating new card', { problemTitle, problemUrl });
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

    reviewCard(card?: Card, rating: Rating | number = Rating.Good, customWeights: number[] | null = null, now: number = Date.now(), timeTaken: number | null = null): Card {
        if (!card) {
            throw new Error("Card is required for reviewCard");
        }
        const logger = getLogger();
        if (logger) {
            logger.debug('FSRS', `Reviewing card: ${card.problemTitle} with rating ${rating}`);
        }
        const newCard: Card = { ...card };

        newCard.previousDue = card.due;
        newCard.historyLog = newCard.historyLog ? [...newCard.historyLog] : [];

        const logEntry: { rating: Rating | number; date: number; duration?: number } = { rating, date: now };
        if (timeTaken !== null) {
            logEntry.duration = timeTaken;
        }
        newCard.historyLog.push(logEntry);

        const lastReview = getLastReviewDate(card);

        const w = (customWeights && customWeights.length === 17) ? customWeights : this.w;

        // Initialize ts-fsrs scheduler with standard or custom weights
        const scheduler = fsrs({
            w: w,
            request_retention: this.requestRetention
        });

        const cardExt = newCard as Card & { elapsedDays?: number; scheduledDays?: number; learningSteps?: number };
        const tsCard: TsFsrsCard = {
            due: new Date(newCard.due),
            stability: newCard.stability,
            difficulty: newCard.difficulty,
            elapsed_days: newCard.elapsed_days !== undefined ? newCard.elapsed_days : (cardExt.elapsedDays || 0),
            scheduled_days: newCard.scheduled_days !== undefined ? newCard.scheduled_days : (cardExt.scheduledDays || 0),
            learning_steps: newCard.learning_steps !== undefined ? newCard.learning_steps : (cardExt.learningSteps || 0),
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

    getRetrievability(card?: Card, now: number = Date.now()): number {
        if (!card) return 0;
        const lastReview = getLastReviewDate(card);

        if (card.stability <= 0 || !lastReview) {
            return 0;
        }

        const cardExt = card as Card & { elapsedDays?: number; scheduledDays?: number; learningSteps?: number };
        const tsCard: TsFsrsCard = {
            due: new Date(card.due),
            stability: card.stability,
            difficulty: card.difficulty,
            elapsed_days: card.elapsed_days !== undefined ? card.elapsed_days : (cardExt.elapsedDays || 0),
            scheduled_days: card.scheduled_days !== undefined ? card.scheduled_days : (cardExt.scheduledDays || 0),
            learning_steps: card.learning_steps !== undefined ? card.learning_steps : (cardExt.learningSteps || 0),
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

    getProjectedRetrievability(stability: number = 0, elapsedDays: number = 0): number {
        if (stability <= 0) return 0;
        return Math.pow(1 + (this.factor * elapsedDays) / stability, this.decay);
    }

    getDefaultRequestRetention(): number {
        return this.requestRetention;
    }

    isHighDifficulty(card?: Card): boolean {
        if (!card) return false;
        return card.difficulty >= HIGH_DIFFICULTY_THRESHOLD;
    }

    isGraduated(card?: Card): boolean {
        if (!card) return false;
        return card.state === State.Review && card.stability > GRADUATED_STABILITY_THRESHOLD;
    }

    resetConfiguration(): void {
        this.w = [...DEFAULT_FSRS_W];
        this.decay = DEFAULT_FSRS_DECAY;
        this.factor = DEFAULT_FSRS_FACTOR;
        this.requestRetention = DEFAULT_FSRS_REQUEST_RETENTION;
    }

    exportConfiguration(): FSRSParameters {
        return {
            w: [...this.w],
            decay: this.decay,
            factor: this.factor,
            requestRetention: this.requestRetention
        };
    }

    importConfiguration(config?: Partial<FSRSParameters>): void {
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

if (typeof window !== 'undefined') {
    (window as unknown as { FsrsScheduler?: typeof FsrsScheduler }).FsrsScheduler = FsrsScheduler;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FsrsScheduler;
}
