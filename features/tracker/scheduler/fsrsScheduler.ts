/**
 * @file features/tracker/scheduler/fsrsScheduler.ts
 * @description Concrete implementation of the Free Spaced Repetition Scheduler (FSRS) algorithm.
 * Extends the abstract Scheduler base class to provide mathematically precise card
 * stability, difficulty, retrievability, and scheduled review intervals using ts-fsrs.
 */

import { fsrs, createEmptyCard, Rating, State, Card as TsFsrsCard, Grade } from 'ts-fsrs';
import { getLastReviewDate } from '../../common/utils/cardUtils';
import { Card, FSRSParameters, ReviewLog } from '../../../types/domain';
import {
    DEFAULT_FSRS_W,
    DEFAULT_FSRS_DECAY,
    DEFAULT_FSRS_FACTOR,
    DEFAULT_FSRS_REQUEST_RETENTION,
    HIGH_DIFFICULTY_THRESHOLD,
    GRADUATED_STABILITY_THRESHOLD,
    ALGORITHMIC_DEBOUNCE_WINDOW_MS
} from '../../common/constants';
import AbstractScheduler from './scheduler';
import { Logger } from '@common/logger';

interface AppLogger {
    debug(category: string, message: string, data?: unknown): void;
    info(category: string, message: string, data?: unknown): void;
    error(category: string, message: string, data?: unknown): void;
}

function getLogger(): AppLogger {
    return Logger;
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

    /**
     * Primary entry point for reviewing a card. Coordinates rapid re-review debouncing,
     * historical logging with pre-state snapshots, and ts-fsrs mathematical calculation.
     */
    reviewCard(card?: Card, rating: Rating | number = Rating.Good, customWeights: number[] | null = null, now: number = Date.now(), timeTaken: number | null = null): Card {
        if (!card) {
            throw new Error("Card is required for reviewCard");
        }
        const logger = getLogger();
        if (logger) {
            logger.debug('FSRS', `Reviewing card: ${card.problemTitle} with rating ${rating}`);
        }

        // Step 1: Retrieve the timestamp of the last actual review (ignoring creation events)
        const lastReview = getLastReviewDate(card);

        // Step 2: Check for rapid re-review algorithmic debouncing (< 1 minute window).
        // If debounced or corrected within 1 minute, _handleAlgorithmicDebounce returns the updated card directly.
        const debouncedCard = this._handleAlgorithmicDebounce(card, rating, customWeights, now, timeTaken, lastReview);
        if (debouncedCard) {
            return debouncedCard;
        }

        // Step 3: Prepare a new card instance and record the review entry with pre-state metrics in historyLog
        const newCard: Card = { ...card };
        newCard.previousDue = card.due;
        newCard.historyLog = newCard.historyLog ? [...newCard.historyLog] : [];
        newCard.historyLog.push(this._createReviewLogEntry(card, rating, now, timeTaken));

        // Step 4: Compute next FSRS state metrics (stability, difficulty, reps, lapses, due date) using ts-fsrs
        try {
            const nextFsrsMetrics = this._computeNextFsrsState(card, rating, customWeights, now, lastReview);
            Object.assign(newCard, nextFsrsMetrics);
            return newCard;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (logger) logger.error('FSRS', `Error reviewing card ${card.id}: ${errorMessage}`, { cardId: card.id, rating, err });
            throw err;
        }
    }

    /**
     * Handles algorithmic debouncing if a card is reviewed repeatedly within the debounce window (< 1 min).
     * 
     * - Case 1 (Duplicate Rating): If the user submits the exact same rating within 1 minute (e.g. key mashing),
     *   the duplicate calculation is suppressed and historyLog length remains unchanged (duration is accumulated).
     * - Case 2 (Corrected Rating): If the user changes their rating within 1 minute (e.g. Good -> Again),
     *   the previous review log entry is popped, card state is restored from its preState snapshot, and FSRS is
     *   recalculated using the updated rating choice.
     * 
     * Returns a new Card instance if handled by debouncing, or null if standard review execution should continue.
     */
    private _handleAlgorithmicDebounce(
        card: Card,
        rating: Rating | number,
        customWeights: number[] | null,
        now: number,
        timeTaken: number | null,
        lastReview: number | null
    ): Card | null {
        // Step 2a: Bypass debouncing if card has never been reviewed or review occurred outside the 1-minute window
        if (lastReview === null || (now - lastReview) >= ALGORITHMIC_DEBOUNCE_WINDOW_MS) {
            return null;
        }

        if (!card.historyLog || card.historyLog.length === 0) {
            return null;
        }

        // Step 2b: Inspect the most recent history log entry
        const lastLog = card.historyLog[card.historyLog.length - 1];
        let lastRating: number | null = null;
        if (typeof lastLog === 'object' && lastLog !== null && 'rating' in lastLog) {
            lastRating = Number(lastLog.rating);
        } else if (typeof lastLog === 'number') {
            lastRating = lastLog;
        }

        // Step 2c: Ensure debouncing ONLY applies to actual reviews (ratings 1..4), NOT card creation (rating 0 / Rating.Manual)
        if (lastRating === null || lastRating < Rating.Again || lastRating > Rating.Easy) {
            return null;
        }

        const logger = getLogger();

        // Step 2d: Case 1 - Identical rating submitted within 1 minute (rapid button/key mashing).
        // Suppress duplicate FSRS state calculation and append timeTaken duration to existing log entry if applicable.
        if (lastRating === rating) {
            if (logger) {
                logger.debug('FSRS', `Algorithmic Debounce: Suppressing duplicate rapid review rating (${rating}) for card ${card.id}`);
            }
            if (timeTaken !== null && typeof lastLog === 'object' && lastLog !== null) {
                const updatedCard = { ...card };
                const updatedLog = { ...lastLog, duration: ((lastLog.duration as number) || 0) + timeTaken };
                updatedCard.historyLog = [...(card.historyLog.slice(0, -1)), updatedLog];
                return updatedCard;
            }
            return card;
        }

        // Step 2e: Case 2 - Corrected rating within 1 minute (e.g. user mis-clicked Good and changes to Again).
        // Remove the temporary review log entry, revert card metrics to preState, and re-run reviewCard with new rating.
        if (logger) {
            logger.debug('FSRS', `Algorithmic Debounce: Correcting rating from ${lastRating} to ${rating} for card ${card.id}`);
        }

        const historyLogWithoutLast = card.historyLog.slice(0, -1);
        const baseCard: Card = {
            ...card,
            historyLog: historyLogWithoutLast
        };

        // Restore exact preState snapshot metrics if available on the last log entry
        if (typeof lastLog === 'object' && lastLog !== null && 'preState' in lastLog && lastLog.preState) {
            const ps = lastLog.preState as Record<string, unknown>;
            if (typeof ps.stability === 'number') baseCard.stability = ps.stability;
            if (typeof ps.difficulty === 'number') baseCard.difficulty = ps.difficulty;
            if (typeof ps.reps === 'number') baseCard.reps = ps.reps;
            if (typeof ps.lapses === 'number') baseCard.lapses = ps.lapses;
            if (typeof ps.state === 'number') baseCard.state = ps.state;
            if (typeof ps.due === 'number') baseCard.due = ps.due;
            baseCard.last_review = typeof ps.last_review === 'number' ? ps.last_review : null;
            if (typeof ps.elapsed_days === 'number') baseCard.elapsed_days = ps.elapsed_days;
            if (typeof ps.scheduled_days === 'number') baseCard.scheduled_days = ps.scheduled_days;
            if (typeof ps.learning_steps === 'number') baseCard.learning_steps = ps.learning_steps;
        } else {
            // Fallback for legacy logs without preState: resolve last review date from previous history entry
            let priorReviewDate: number | null = null;
            if (historyLogWithoutLast.length > 0) {
                const priorLog = historyLogWithoutLast[historyLogWithoutLast.length - 1];
                priorReviewDate = typeof priorLog === 'object' && priorLog !== null ? (priorLog.date as number) : (typeof priorLog === 'number' ? priorLog : null);
            }
            baseCard.last_review = priorReviewDate;
        }

        // Re-execute reviewCard starting from restored baseCard state with the newly selected rating
        return this.reviewCard(baseCard, rating, customWeights, now, timeTaken);
    }

    /**
     * Constructs a review history log entry containing rating, date, duration, and preState snapshot.
     * Storing preState allows seamless rollbacks/corrections if a user changes their rating within 1 minute.
     */
    private _createReviewLogEntry(
        card: Card,
        rating: Rating | number,
        now: number,
        timeTaken: number | null
    ): ReviewLog {
        const logEntry: ReviewLog = {
            rating,
            date: now,
            preState: {
                stability: card.stability,
                difficulty: card.difficulty,
                reps: card.reps,
                lapses: card.lapses,
                state: card.state,
                due: card.due,
                last_review: card.last_review ?? null,
                elapsed_days: card.elapsed_days ?? 0,
                scheduled_days: card.scheduled_days ?? 0,
                learning_steps: card.learning_steps ?? 0
            }
        };
        if (timeTaken !== null) {
            logEntry.duration = timeTaken;
        }
        return logEntry;
    }

    /**
     * Executes ts-fsrs calculation to determine updated stability, difficulty, retrievability, and due date.
     */
    private _computeNextFsrsState(
        card: Card,
        rating: Rating | number,
        customWeights: number[] | null,
        now: number,
        lastReview: number | null
    ): Partial<Card> {
        // Use custom tag/topic weights if provided, otherwise default to scheduler weights
        const w = (customWeights && customWeights.length === 17) ? customWeights : this.w;
        const scheduler = fsrs({
            w: w,
            request_retention: this.requestRetention
        });

        // Convert stored card state into ts-fsrs TsFsrsCard interface
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
            last_review: lastReview ? new Date(lastReview) : undefined
        };

        // Invoke ts-fsrs next() algorithm
        const result = scheduler.next(tsCard, new Date(now), rating as Grade);

        // Map computed ts-fsrs output card metrics back to serializable partial Card fields
        return {
            due: result.card.due.getTime(),
            stability: result.card.stability,
            difficulty: result.card.difficulty,
            elapsed_days: result.card.elapsed_days,
            scheduled_days: result.card.scheduled_days,
            learning_steps: result.card.learning_steps,
            reps: result.card.reps,
            lapses: result.card.lapses,
            state: result.card.state,
            last_review: result.card.last_review ? result.card.last_review.getTime() : null
        };
    }



    getRetrievability(card?: Card, now: number = Date.now()): number {
        if (!card) return 0;
        const logger = getLogger();
        try {
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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (logger) logger.error('FSRS', `Error calculating retrievability for card ${card.id}: ${errorMessage}`, { cardId: card.id, err });
            // Comment: Non-fatal calculation failure, return 0 fallback retrievability
            return 0;
        }
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
