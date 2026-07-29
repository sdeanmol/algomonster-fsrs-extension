/**
 * @file features/tracker/scheduler/fsrsOptimizerFast.ts
 * @description Lightweight JavaScript optimizer for personalized FSRS weights.
 */

import { Card } from '../../../types/domain';
import { Logger } from '@common/logger';
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

export interface EligibilityResult {
    eligible: boolean;
    count: number;
    threshold: number;
    uniqueCards?: number;
}

export class FsrsOptimizerFast {
    learningRate: number;
    epochs: number;

    constructor() {
        this.learningRate = OPTIMIZER_DEFAULT_LEARNING_RATE;
        this.epochs = OPTIMIZER_DEFAULT_EPOCHS;
    }

    /**
     * Checks if there's enough history to optimize.
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
    window.FsrsOptimizer = FsrsOptimizerFast;
    window.FsrsOptimizerFast = FsrsOptimizerFast;
}
