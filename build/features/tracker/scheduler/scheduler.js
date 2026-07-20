/**
 * @file features/tracker/scheduler/scheduler.js
 * @description Abstract base class defining the standard interface for scheduling algorithms.
 * Any scheduling algorithm (e.g., FSRS, SM-2, Leitner) must extend this class to be fully
 * pluggable within the extension architecture.
 */

class Scheduler {
    constructor() {
        if (new.target === Scheduler) {
            throw new TypeError("Cannot construct Scheduler instances directly.");
        }
    }

    /**
     * Initializes a new flashcard schema with default scheduling parameters.
     * @param {string} problemTitle - The title of the problem.
     * @param {string} problemUrl - The canonical URL of the problem.
     * @param {string} textRead - Saved notes context.
     * @param {string} approach - Textual description of the problem-solving approach.
     * @param {string[]} [tags=[]] - Category tags associated with this card.
     * @returns {Object} Newly initialized card schema.
     */
    createCard(problemTitle, problemUrl, textRead, approach, tags = []) {
        throw new Error("Method 'createCard()' must be implemented.");
    }

    /**
     * Transition card parameters based on review rating.
     * @param {Object} card - The active flashcard.
     * @param {number} rating - Review quality (1=Again, 2=Hard, 3=Good, 4=Easy).
     * @param {number[]|null} [customWeights=null] - Optional override weights.
     * @param {number} [now=Date.now()] - Custom baseline timestamp.
     * @returns {Object} A copy of the card with updated scheduling metrics.
     */
    reviewCard(card, rating, customWeights = null, now = Date.now()) {
        throw new Error("Method 'reviewCard()' must be implemented.");
    }

    /**
     * Computes the mathematical retrievability probability (0.0 to 1.0) of a card.
     * @param {Object} card - The active flashcard.
     * @param {number} [now=Date.now()] - Evaluation timestamp.
     * @returns {number} Retrievability percentage representation.
     */
    getRetrievability(card, now = Date.now()) {
        throw new Error("Method 'getRetrievability()' must be implemented.");
    }

    /**
     * Computes projected retrievability over a future time span based on current stability.
     * @param {number} stability - The card or average stability metric.
     * @param {number} elapsedDays - Future evaluation point in days.
     * @returns {number} Projected retrievability probability (0.0 to 1.0).
     */
    getProjectedRetrievability(stability, elapsedDays) {
        throw new Error("Method 'getProjectedRetrievability()' must be implemented.");
    }

    /**
     * Retrieves the baseline target memory retention rate for the scheduling algorithm.
     * @returns {number} Default request retention target (e.g., 0.90 for 90%).
     */
    getDefaultRequestRetention() {
        throw new Error("Method 'getDefaultRequestRetention()' must be implemented.");
    }

    /**
     * Determines whether the card is considered to have a highly difficult rating
     * based on the algorithm's specific difficulty scale.
     * @param {Object} card - The active flashcard.
     * @returns {boolean} True if the card difficulty is strictly 'high'.
     */
    isHighDifficulty(card) {
        throw new Error("Method 'isHighDifficulty()' must be implemented.");
    }

    /**
     * Evaluates whether a card has passed the learning phase into 'graduated' review.
     * @param {Object} card - The active flashcard.
     * @returns {boolean} True if graduated.
     */
    isGraduated(card) {
        throw new Error("Method 'isGraduated()' must be implemented.");
    }

    /**
     * Determines whether the current scheduler implementation supports personalized optimization.
     * @returns {boolean} True if optimization is supported.
     */
    supportsOptimization() {
        return false;
    }

    /**
     * Trains and applies optimized scheduling parameters based on historical review data.
     * @param {Object[]} reviewHistory - Historical review log data.
     * @returns {Promise<Object>} The optimization results and metadata.
     */
    async optimize(reviewHistory) {
        throw new Error("Method 'optimize()' is not supported by this scheduler.");
    }

    /**
     * Resets the scheduling parameters to their algorithmic defaults.
     */
    resetConfiguration() {
        throw new Error("Method 'resetConfiguration()' is not supported by this scheduler.");
    }

    /**
     * Exports the current scheduling parameters.
     * @returns {Object} Current configuration parameters.
     */
    exportConfiguration() {
        throw new Error("Method 'exportConfiguration()' is not supported by this scheduler.");
    }

    /**
     * Imports and applies scheduling parameters.
     * @param {Object} config - Configuration parameters.
     */
    importConfiguration(config) {
        throw new Error("Method 'importConfiguration()' is not supported by this scheduler.");
    }

    /**
     * Helper to export to CommonJS if running in Node environment for testing.
     */
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Scheduler;
}
