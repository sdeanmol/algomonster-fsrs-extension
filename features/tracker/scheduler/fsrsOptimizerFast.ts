/**
 * @file features/tracker/scheduler/fsrsOptimizerFast.ts
 * @description Lightweight pure JavaScript fallback optimizer for personalized FSRS weights.
 * Applies heuristic gradient descent on initial stability parameters (w[0]-w[3]) when
 * WebAssembly/WASI bindings are unavailable or encounter runtime errors.
 * 
 * Context: Standalone configuration tab (`fsrsConfig.html`) or background fallback worker.
 * 
 * Key Exports:
 * - `EligibilityResult`: Metric interface representing review history volume and readiness.
 * - `FsrsOptimizerFast`: Fast heuristic stochastic gradient descent optimizer.
 */

import { Card } from '../../../types/domain';
import { Logger } from '../../common/logger';
import {
    OPTIMIZER_DEFAULT_THRESHOLD,
    OPTIMIZER_DEFAULT_EPOCHS,
    OPTIMIZER_DEFAULT_LEARNING_RATE,
    DEFAULT_FSRS_REQUEST_RETENTION
} from '../../common/constants';

declare global {
    interface Window {
        FsrsOptimizer?: typeof FsrsOptimizerFast;
        FsrsOptimizerFast?: typeof FsrsOptimizerFast;
    }
}

/**
 * Historical review qualification metrics for fallback optimization.
 */
export interface EligibilityResult {
    /** Whether review count meets the threshold. */
    eligible: boolean;
    /** Total recorded review count. */
    count: number;
    /** Qualification threshold required. */
    threshold: number;
    /** Unique cards reviewed multiple times. */
    uniqueCards?: number;
}

/**
 * Pure JavaScript heuristic optimizer for tuning initial FSRS stabilities and difficulty anchors.
 */
export class FsrsOptimizerFast {
    /** Learning rate scaling step size during gradient updates. */
    learningRate: number;
    /** Total number of optimization iterations. */
    epochs: number;

    /**
     * Initializes default learning rate and epoch count.
     */
    constructor() {
        this.learningRate = OPTIMIZER_DEFAULT_LEARNING_RATE;
        this.epochs = OPTIMIZER_DEFAULT_EPOCHS;
    }

    /**
     * Evaluates history to confirm if enough multi-review cards exist to run optimization.
     * 
     * @param {Card[]} history - Array of study cards.
     * @param {number} [threshold=OPTIMIZER_DEFAULT_THRESHOLD] - Required review count threshold.
     * @returns {EligibilityResult} Eligibility result metrics.
     */
    computeEligibility(history: Card[], threshold: number = OPTIMIZER_DEFAULT_THRESHOLD): EligibilityResult {
        if (!history || !Array.isArray(history)) return { eligible: false, count: 0, threshold };

        let reviewCount = 0;
        const uniqueCards = new Set<string>();

        history.forEach((card: Card) => {
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
     * Used as a fallback because WASM binding for exact log-loss gradient descent can fail on certain MV3 environments.
     * 
     * @async
     * @param {Card[]} history - Array of cards with review histories.
     * @param {number[]} currentWeights - Starting 17-parameter weights baseline.
     * @param {number} [targetRetention=DEFAULT_FSRS_REQUEST_RETENTION] - Target memory retention rate.
     * @param {((current: number, total: number) => void) | null} [onProgress=null] - Optional progress notification callback.
     * @returns {Promise<number[]>} Array of updated weights.
     * @throws {Error} If optimization calculations throw.
     */
    async trainWeights(
        history: Card[],
        currentWeights: number[],
        targetRetention: number = DEFAULT_FSRS_REQUEST_RETENTION,
        onProgress: ((current: number, total: number) => void) | null = null
    ): Promise<number[]> {
        try {
            const w = [...currentWeights];

            let totalReps = 0;
            let totalLapses = 0;

            history.forEach((card: Card) => {
                if (card.reps > 0) {
                    totalReps += card.reps;
                    totalLapses += (card.lapses || 0);
                }
            });

            if (totalReps === 0) {
                Logger.warn('FSRS', 'Skipping optimization because there are 0 total reps across all cards.');
                return w;
            }

            const empiricalRetention = (totalReps - totalLapses) / totalReps;

            // Target retention is usually 0.90 (or specified by user). If user remembers more, increase initial stabilities.
            // If they forget more, decrease initial stabilities.
            const diff = empiricalRetention - targetRetention;
            const adjustment = diff * this.learningRate * 10;

            for (let i = 0; i < this.epochs; i++) {
                // Simulated gradient descent step
                w[0] = Math.max(0.1, w[0] + adjustment * 0.1);
                w[1] = Math.max(0.1, w[1] + adjustment * 0.2);
                w[2] = Math.max(0.1, w[2] + adjustment * 0.3);
                w[3] = Math.max(0.1, w[3] + adjustment * 0.4);

                // Adjust difficulty baseline slightly
                w[4] = Math.max(1, Math.min(10, w[4] - adjustment * 0.5));

                if (onProgress) {
                    onProgress(i + 1, this.epochs);
                    // Yield to event loop to allow UI to paint the progress update
                    await new Promise(r => setTimeout(r, 0));
                }
            }
            const optimizedWeights = w.map(weight => Math.round(weight * 10000) / 10000);
            Logger.info('FSRS', `Fast Optimizer success. New weights:`, optimizedWeights);
            return optimizedWeights;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRS', `Error during fast FSRS optimization: ${errorMessage}`, { err });
            // Comment: Re-throw error because caller expects optimizer failure to abort weight saving
            throw err;
        }
    }
}

export default FsrsOptimizerFast;

if (typeof window !== 'undefined') {
    try {
        window.FsrsOptimizer = FsrsOptimizerFast;
        window.FsrsOptimizerFast = FsrsOptimizerFast;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.debug('FSRSOptimizerFast', `Safe recovery fallback for window global export: ${errorMessage}`, { err });
    }
}
