/**
 * @file features/tracker/scheduler/fsrsOptimizer.js
 * @description Lightweight JavaScript optimizer for personalized FSRS weights.
 */

import { initOptimizer } from '@open-spaced-repetition/binding/dynamic-wasi';

let _bindingInstance = null;
const wasmUrl = new URL('@open-spaced-repetition/binding-wasm32-wasi/fsrs-binding.wasm32-wasi.wasm', import.meta.url);

async function getBinding() {
    if (!_bindingInstance) {
        _bindingInstance = await initOptimizer({
            wasm: wasmUrl,
            worker: () => new Worker(new URL('@open-spaced-repetition/binding-wasm32-wasi/wasi-worker-browser.mjs', import.meta.url))
        });
    }
    return _bindingInstance;
}

class FsrsOptimizer {
    constructor() {
        this.epochs = 50;
    }

    computeEligibility(history, threshold = 1000) {
        if (!history || !Array.isArray(history)) return { eligible: false, count: 0, threshold };

        let reviewCount = 0;
        let uniqueCards = new Set();

        history.forEach(card => {
            if (card.historyLog && card.historyLog.length > 1) {
                reviewCount += (card.historyLog.length - 1);
                uniqueCards.add(card.id);
            }
        });

        return {
            eligible: reviewCount >= threshold,
            count: reviewCount,
            uniqueCards: uniqueCards.size,
            threshold
        };
    }

    async trainWeights(history, currentWeights, targetRetention = 0.90, onProgress = null) {
        if (!history || history.length === 0) return currentWeights;

        try {
            const binding = await getBinding();
            let trainSet = [];

            history.forEach(card => {
                if (card.historyLog && card.historyLog.length > 0) {
                    const reviews = [];
                    let firstLog = card.historyLog[0];
                    let firstDate = typeof firstLog === 'object' ? firstLog.date : firstLog;

                    let hasValidDeltaT = false;
                    card.historyLog.forEach((log, index) => {
                        let ratingNum = 3;
                        let logDate;

                        if (typeof log === 'object' && log !== null) {
                            if (log.rating === 'again') ratingNum = 1;
                            else if (log.rating === 'hard') ratingNum = 2;
                            else if (log.rating === 'good') ratingNum = 3;
                            else if (log.rating === 'easy') ratingNum = 4;
                            else if (typeof log.rating === 'number') ratingNum = log.rating;

                            logDate = log.date;
                        } else {
                            logDate = log;
                        }

                        // Only valid FSRS ratings (1-4) should be passed to the optimizer
                        if (ratingNum >= 1 && ratingNum <= 4) {
                            let deltaT = 0;
                            
                            // For FSRS, the first actual review MUST have delta_t = 0.
                            // Subsequent reviews calculate delta_t based on the previous log.
                            if (reviews.length > 0 && index > 0) {
                                let prevLog = card.historyLog[index - 1];
                                let prevDate = typeof prevLog === 'object' ? prevLog.date : prevLog;
                                deltaT = Math.round((logDate - prevDate) / (1000 * 60 * 60 * 24));
                                if (deltaT < 0) deltaT = 0;
                            }

                            if (deltaT > 0) hasValidDeltaT = true;
                            
                            reviews.push(new binding.FSRSBindingReview(ratingNum, deltaT));
                        }
                    });

                    // We only want to train on cards that have actually been reviewed more than once
                    // (i.e. they have at least one follow-up review with deltaT > 0)
                    if (hasValidDeltaT && reviews.length > 1) {
                        trainSet.push(new binding.FSRSBindingItem(reviews));
                    }
                }
            });

            if (trainSet.length === 0) return currentWeights;

            // Cap the trainSet to a maximum limit to prevent WASM OOM or extreme timeouts
            const MAX_TRAINING_CARDS = 2500;
            if (trainSet.length > MAX_TRAINING_CARDS) {
                console.log(`[FSRS Optimizer] Limiting train set from ${trainSet.length} to ${MAX_TRAINING_CARDS} cards to ensure stability.`);
                // Shuffle or just slice. We'll just slice the most recent ones or just take a slice.
                trainSet = trainSet.slice(0, MAX_TRAINING_CARDS);
            }

            console.log(`[FSRS Optimizer] Training on ${trainSet.length} cards...`);
            
            const optimizedWeights = await binding.computeParameters(trainSet, {
                enableShortTerm: false,
                timeout: 900000,
                progress: (current, total) => {
                    if (onProgress) onProgress(current, total);
                }
            });

            console.log(`[FSRS Optimizer] Success. New weights:`, optimizedWeights);
            return optimizedWeights;
        } catch (e) {
            console.error(`[FSRS Optimizer] Training failed. Falling back to faster optimizer Error:`, e);
            throw e;
        }
    }
}

// Export for webpack and tests
export default FsrsOptimizer;
if (typeof window !== 'undefined') {
    window.FsrsOptimizer = FsrsOptimizer;
}
