/**
 * @file features/tracker/scheduler/scheduler.ts
 * @description Abstract base class defining the standard interface for spaced repetition scheduling algorithms.
 * Any scheduling algorithm (e.g., FSRS, SM-2, Leitner) must extend this class to be fully
 * pluggable within the extension architecture.
 * 
 * Context: Shared scheduling module used across background workers, content scripts, and dashboard UI.
 * 
 * Key Exports:
 * - `AbstractScheduler`: Base abstract class enforcing spaced repetition card creation, transitions, and calculations.
 */

import { Logger } from '../../common/logger';
import { Card, Rating, FSRSParameters } from '../../../types/domain';

/**
 * Base abstract class defining the contract for spaced repetition algorithms.
 */
export class AbstractScheduler {
    /**
     * Constructs the abstract scheduler, throwing if instantiated directly.
     * @throws {TypeError} If instantiated directly rather than via a subclass.
     */
    constructor() {
        if (new.target === AbstractScheduler) {
            throw new TypeError("Cannot construct AbstractScheduler instances directly.");
        }
    }

    /**
     * Initializes a new flashcard schema with default scheduling parameters.
     * 
     * @param {string} [problemTitle] - Problem name or title string.
     * @param {string} [problemUrl] - Canonical URL of the problem.
     * @param {string} [textRead] - Optional extracted problem description or text snippet.
     * @param {string} [approach] - User's initial solution approach or markdown notes.
     * @param {string[]} [tags=[]] - Topic tags associated with the problem.
     * @returns {Card} Newly initialized card object.
     * @throws {Error} If not implemented by subclass.
     */
    createCard(problemTitle?: string, problemUrl?: string, textRead?: string, approach?: string, tags: string[] = []): Card {
        throw new Error("Method 'createCard()' must be implemented.");
    }

    /**
     * Transitions card parameters based on user review rating and updates review logs.
     * 
     * @param {Card} [card] - Target card to update.
     * @param {Rating | number} [rating] - User recall quality score (1: Again, 2: Hard, 3: Good, 4: Easy).
     * @param {number[] | null} [customWeights=null] - Optional per-topic custom weight coefficient overrides.
     * @param {number} [now=Date.now()] - Timestamp of the review occurrence.
     * @returns {Card} Updated card instance with recalculate intervals and stability.
     * @throws {Error} If not implemented by subclass.
     */
    reviewCard(card?: Card, rating?: Rating | number, customWeights: number[] | null = null, now: number = Date.now()): Card {
        throw new Error("Method 'reviewCard()' must be implemented.");
    }

    /**
     * Computes the mathematical retrievability probability (0.0 to 1.0) of a card at a given timestamp.
     * 
     * @param {Card} [card] - Target card to evaluate.
     * @param {number} [now=Date.now()] - Current timestamp for evaluation.
     * @returns {number} Probability of recall (0.0 to 1.0).
     * @throws {Error} If not implemented by subclass.
     */
    getRetrievability(card?: Card, now: number = Date.now()): number {
        throw new Error("Method 'getRetrievability()' must be implemented.");
    }

    /**
     * Computes projected retrievability over a future elapsed time span based on current stability.
     * 
     * @param {number} [stability] - Current memory stability in days.
     * @param {number} [elapsedDays] - Number of elapsed days since last review.
     * @returns {number} Projected retrievability probability (0.0 to 1.0).
     * @throws {Error} If not implemented by subclass.
     */
    getProjectedRetrievability(stability?: number, elapsedDays?: number): number {
        throw new Error("Method 'getProjectedRetrievability()' must be implemented.");
    }

    /**
     * Retrieves the baseline target memory retention rate for the scheduling algorithm (e.g. 0.90 for 90%).
     * 
     * @returns {number} Target memory retention decimal.
     * @throws {Error} If not implemented by subclass.
     */
    getDefaultRequestRetention(): number {
        throw new Error("Method 'getDefaultRequestRetention()' must be implemented.");
    }

    /**
     * Determines whether the card is considered to have a highly difficult rating
     * based on the algorithm's specific difficulty scale.
     * 
     * @param {Card} [card] - Target card to evaluate.
     * @returns {boolean} True if card exceeds high difficulty threshold.
     * @throws {Error} If not implemented by subclass.
     */
    isHighDifficulty(card?: Card): boolean {
        throw new Error("Method 'isHighDifficulty()' must be implemented.");
    }

    /**
     * Evaluates whether a card has passed the initial learning phase into 'graduated' review status.
     * 
     * @param {Card} [card] - Target card to evaluate.
     * @returns {boolean} True if the card is graduated.
     * @throws {Error} If not implemented by subclass.
     */
    isGraduated(card?: Card): boolean {
        throw new Error("Method 'isGraduated()' must be implemented.");
    }

    /**
     * Determines whether the current scheduler implementation supports personalized optimization.
     * 
     * @returns {boolean} True if parameter optimization is supported.
     */
    supportsOptimization(): boolean {
        return false;
    }

    /**
     * Trains and applies optimized scheduling parameters based on historical review data.
     * 
     * @async
     * @param {Card[]} [reviewHistory] - Array of historical cards with review logs.
     * @returns {Promise<number[]>} Trained parameter array.
     * @throws {Error} If not supported by scheduler subclass.
     */
    async optimize(reviewHistory?: Card[]): Promise<number[]> {
        throw new Error("Method 'optimize()' is not supported by this scheduler.");
    }

    /**
     * Resets the scheduling parameters to their algorithmic defaults.
     * 
     * @returns {void}
     * @throws {Error} If not supported by scheduler subclass.
     */
    resetConfiguration(): void {
        throw new Error("Method 'resetConfiguration()' is not supported by this scheduler.");
    }

    /**
     * Exports the current scheduling parameters.
     * 
     * @returns {FSRSParameters} Exported parameter payload.
     * @throws {Error} If not supported by scheduler subclass.
     */
    exportConfiguration(): FSRSParameters {
        throw new Error("Method 'exportConfiguration()' is not supported by this scheduler.");
    }

    /**
     * Imports and applies scheduling parameters.
     * 
     * @param {Partial<FSRSParameters>} [config] - Parameters to import and apply.
     * @returns {void}
     * @throws {Error} If not supported by scheduler subclass.
     */
    importConfiguration(config?: Partial<FSRSParameters>): void {
        throw new Error("Method 'importConfiguration()' is not supported by this scheduler.");
    }
}

export default AbstractScheduler;

if (typeof window !== 'undefined') {
    try {
        (window as unknown as { AbstractScheduler?: typeof AbstractScheduler }).AbstractScheduler = AbstractScheduler;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.debug('Scheduler', `Safe recovery fallback for window global export: ${errorMessage}`, { err });
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AbstractScheduler;
    Object.assign(module.exports, { AbstractScheduler, default: AbstractScheduler });
}
