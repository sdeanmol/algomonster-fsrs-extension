/**
 * @file features/tracker/scheduler/fsrsOptimizer.js
 * @description Lightweight JavaScript optimizer for personalized FSRS weights.
 */

import { computeParameters, FSRSBindingItem, FSRSBindingReview } from '@open-spaced-repetition/binding';

class FsrsOptimizer {
    constructor() {
        this.epochs = 50; // Kept for compatibility, but official optimizer handles iterations internally
    }

    /**
     * Checks if there's enough history to optimize.
     */
    computeEligibility(history, threshold = 1000) {
        if (!history || !Array.isArray(history)) return { eligible: false, count: 0, threshold };
        
        let reviewCount = 0;
        let uniqueCards = new Set();
        
        history.forEach(card => {
            if (card.historyLog && card.historyLog.length > 1) {
                // Count actual reviews, excluding the creation event
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

    /**
     * Uses the official @open-spaced-repetition/binding WebAssembly implementation 
     * to perform true log-loss gradient descent across the review history time-series.
     */
    async trainWeights(history, currentWeights, targetRetention = 0.90) {
        if (!history || history.length === 0) return currentWeights;

        const trainSet = [];

        history.forEach(card => {
            if (card.historyLog && card.historyLog.length > 0) {
                const reviews = [];
                let firstLog = card.historyLog[0];
                let firstDate = typeof firstLog === 'object' ? firstLog.date : firstLog;
                
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
                        // Legacy support for pure timestamp arrays
                        logDate = log;
                    }
                    
                    let deltaT = 0;
                    if (index > 0) {
                        let prevLog = card.historyLog[index - 1];
                        let prevDate = typeof prevLog === 'object' ? prevLog.date : prevLog;
                        deltaT = Math.round((logDate - prevDate) / (1000 * 60 * 60 * 24));
                    }

                    
                    reviews.push(new FSRSBindingReview(ratingNum, deltaT));
                });
                
                trainSet.push(new FSRSBindingItem(reviews));
            }
        });

        if (trainSet.length === 0) return currentWeights;

        try {
            console.log(`[FSRS Optimizer] Training on ${trainSet.length} cards...`);
            // Run the official WASM optimizer
            const optimizedWeights = await computeParameters(trainSet, {
                enableShortTerm: false,
                timeout: 30000 // 30 sec timeout for huge histories
            });
            
            console.log(`[FSRS Optimizer] Success. New weights:`, optimizedWeights);
            return optimizedWeights;
        } catch (e) {
            console.error(`[FSRS Optimizer] Training failed. Falling back to current weights. Error:`, e);
            return currentWeights;
        }
    }
}

// Export for webpack and tests
export default FsrsOptimizer;
if (typeof window !== 'undefined') {
    window.FsrsOptimizer = FsrsOptimizer;
}
