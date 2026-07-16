/**
 * @file features/tracker/scheduler/fsrsOptimizer.js
 * @description Lightweight JavaScript optimizer for personalized FSRS weights.
 */

class FsrsOptimizer {
    constructor() {
        this.learningRate = 0.01;
        this.epochs = 50;
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
     * Highly simplified heuristic stochastic gradient descent for FSRS weights.
     * Tunes initial stability weights (w[0]-w[3]) based on empirical retention vs target retention.
     */
    async trainWeights(history, currentWeights, targetRetention = 0.90) {
        let w = [...currentWeights];
        
        // Ensure we don't block UI if processing thousands of items
        await new Promise(r => setTimeout(r, 100));

        let totalReps = 0;
        let totalLapses = 0;

        history.forEach(card => {
            if (card.reps > 0) {
                totalReps += card.reps;
                totalLapses += (card.lapses || 0);
            }
        });

        if (totalReps === 0) return w; // No data to learn from

        const empiricalRetention = (totalReps - totalLapses) / totalReps;
        
        // Target retention is usually 0.90 (or specified by user). If user remembers more, increase initial stabilities.
        // If they forget more, decrease initial stabilities.
        const diff = empiricalRetention - targetRetention;
        const adjustment = diff * this.learningRate * 10; // Simple scaling

        for (let i = 0; i < this.epochs; i++) {
            // Simulated gradient descent step
            w[0] = Math.max(0.1, w[0] + adjustment * 0.1);
            w[1] = Math.max(0.1, w[1] + adjustment * 0.2);
            w[2] = Math.max(0.1, w[2] + adjustment * 0.3);
            w[3] = Math.max(0.1, w[3] + adjustment * 0.4);
            
            // Adjust difficulty baseline slightly
            w[4] = Math.max(1, Math.min(10, w[4] - adjustment * 0.5));
        }

        // Return a rounded version of weights
        return w.map(weight => Math.round(weight * 10000) / 10000);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FsrsOptimizer;
} else if (typeof window !== 'undefined') {
    window.FsrsOptimizer = FsrsOptimizer;
}
