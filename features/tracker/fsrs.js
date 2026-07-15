/**
 * @file features/tracker/fsrs.js
 * @description Core implementation of the Free Spaced Repetition Scheduler (FSRS) algorithm.
 * Responsible for mathematical calculations of card stability, difficulty, retrievability,
 * and scheduled review intervals, with optional fuzzing.
 * Upstream dependencies: None (Independent mathematical utility).
 * Downstream dependencies: content/state.js, content/content.js, features/tracker/tracker.js, features/dashboard/popup/stats.js, features/dashboard/forecast/forecast.js.
 */

/**
 * Free Spaced Repetition Scheduler (FSRS) mathematical controller.
 */
class FSRS {
    /**
     * Initializes the scheduler with default or custom parameters.
     * @param {Object|null} [params=null] - Configuration parameters.
     * @param {number[]} [params.w] - Custom FSRS 17-parameter weights array.
     * @param {number} [params.decay] - Stability decay rate (default: -0.5).
     * @param {number} [params.factor] - Retention rating factor (default: 19/81).
     * @param {number} [params.requestRetention] - Targeted probability of memory recall (default: 0.90).
     */
    constructor(params = null) {
        // Standard FSRS-4.5 default weight parameters
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

    /**
     * Creates and initializes a new FSRS card object schema.
     * @param {string} problemTitle - The title of the problem.
     * @param {string} problemUrl - The canonical URL of the problem.
     * @param {string} textRead - Saved notes context.
     * @param {string} approach - Textual description of the problem-solving approach.
     * @param {string[]} [tags=[]] - Category tags associated with this card.
     * @returns {Object} Newly initialized FSRS card schema.
     */
    createCard(problemTitle, problemUrl, textRead, approach, tags = []) {
        if (window.Logger) window.Logger.debug('FSRS', 'Creating new card', { problemTitle, problemUrl });
        const now = new Date().getTime();
        return {
            id: Date.now().toString(),
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
            state: 0, // State states: 0 (New), 1 (Learning), 2 (Review), 3 (Relearning)
            historyLog: [now], // Track exactly when this was created/reviewed
            timeComplexity: '',   // R1.8: e.g. "O(n log n)"
            spaceComplexity: '',  // R1.8: e.g. "O(n)"
            problemDifficulty: '' // R5.4: "Easy", "Medium", "Hard", or CF rating number
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

    /**
     * R1.11: Previews what the next review interval would be for a given rating without modifying the card.
     * @param {Object} card - The active FSRS card.
     * @param {number} rating - Review quality: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy).
     * @returns {{ scheduledDays: number, dueDate: Date }} Predicted scheduling result.
     */
    previewRating(card, rating) {
        const now = new Date().getTime();
        let tempCard = { ...card };
        const w = this.w;

        if (tempCard.state === 0) {
            tempCard.difficulty = Math.max(1, Math.min(10, w[4] + (rating - 3) * w[5]));
            tempCard.stability = w[rating - 1];
        } else {
            const retrievability = Math.exp(this.decay * tempCard.elapsed_days / tempCard.stability);
            tempCard.difficulty = Math.max(1, Math.min(10, tempCard.difficulty + w[6] * (rating - 3)));

            if (rating === 1) {
                tempCard.stability = w[11] * Math.pow(tempCard.difficulty, -w[12]) * Math.pow(tempCard.stability, w[13]) * Math.exp((1 - retrievability) * w[14]);
            } else {
                tempCard.stability = tempCard.stability * (1 + Math.exp(w[8]) * (11 - tempCard.difficulty) * Math.pow(tempCard.stability, -w[9]) * (Math.exp((1 - retrievability) * w[10]) - 1));
            }
        }

        const intervalModifier = 9 * (Math.pow(this.requestRetention, 1 / this.decay) - 1);
        let rawInterval = tempCard.stability * intervalModifier;
        const scheduledDays = Math.max(1, Math.round(rawInterval));
        const dueDate = new Date(now + (scheduledDays * 24 * 60 * 60 * 1000));

        return { scheduledDays, dueDate };
    }

    /**
     * Transition card parameters (stability, difficulty, due date) based on review rating.
     * @param {Object} card - The active FSRS card.
     * @param {number} rating - Review quality: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy).
     * @param {number[]|null} [customWeights=null] - Optional override weights.
     * @param {number} [now=new Date().getTime()] - Custom baseline timestamp.
     * @returns {Object} A copy of the card with updated metrics.
     */
    reviewCard(card, rating, customWeights = null, now = new Date().getTime()) {
        if (window.Logger) window.Logger.debug('FSRS', `Reviewing card: ${card.problemTitle} with rating ${rating}`);
        let newCard = { ...card };
        
        // Store due date before this review to determine if it was due today
        newCard.previousDue = card.due;
        
        // Add this exact review timestamp to the card's history log
        newCard.historyLog = newCard.historyLog || [];
        newCard.historyLog.push(now);

        const w = (customWeights && customWeights.length === 17) ? customWeights : this.w;

        // FSRS State Transitions & Stability Math
        if (newCard.state === 0) {
            // First time review/learning transition
            newCard.difficulty = Math.max(1, Math.min(10, w[4] + (rating - 3) * w[5]));
            newCard.stability = w[rating - 1];
            newCard.state = rating === 1 ? 1 : 2;
        } else {
            // Calculate current retrievability based on time elapsed since stability baseline
            const retrievability = Math.exp(this.decay * newCard.elapsed_days / newCard.stability);
            newCard.difficulty = Math.max(1, Math.min(10, newCard.difficulty + w[6] * (rating - 3)));

            if (rating === 1) {
                // Again: lapse occurs, stability recalculation
                newCard.stability = w[11] * Math.pow(newCard.difficulty, -w[12]) * Math.pow(newCard.stability, w[13]) * Math.exp((1 - retrievability) * w[14]);
                newCard.lapses += 1;
                newCard.state = 3; // Relearning state
            } else {
                // Good/Hard/Easy reviews increase stability
                newCard.stability = newCard.stability * (1 + Math.exp(w[8]) * (11 - newCard.difficulty) * Math.pow(newCard.stability, -w[9]) * (Math.exp((1 - retrievability) * w[10]) - 1));
                newCard.state = 2; // Normal review state
            }
        }

        newCard.reps += 1;
        const intervalModifier = 9 * (Math.pow(this.requestRetention, 1 / this.decay) - 1);
        let rawInterval = newCard.stability * intervalModifier;
        
        newCard.scheduled_days = this.applyFuzz(rawInterval);
        newCard.due = now + (newCard.scheduled_days * 24 * 60 * 60 * 1000);
        return newCard;
    }
}