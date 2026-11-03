/**
 * @file features/tracker/scheduler/fsrsOptimizer.ts
 * @description WebAssembly/WASI optimizer binding for training personalized FSRS parameters from card review history.
 * Utilizes `@open-spaced-repetition/binding` to compute optimized 17-parameter weights vectors.
 * 
 * Context: Runs in standalone options or web worker context during background weight optimization.
 * 
 * Key Exports:
 * - `WasmBinding`: Interface describing constructor and function signatures from the WASI binary.
 * - `EligibilityResult`: Metric interface representing review history volume and readiness.
 * - `FsrsOptimizer`: Optimizer class coordinating training set preparation, WASM worker execution, and progress reporting.
 */

import type { FSRSBindingReview, FSRSBindingItem, computeParameters } from '@open-spaced-repetition/binding';
import { initOptimizer } from '@open-spaced-repetition/binding/dynamic-wasi';
import { Rating } from 'ts-fsrs';
import { Card, ReviewLog } from '../../../types/domain';
import { MS_PER_DAY, OPTIMIZER_DEFAULT_THRESHOLD, OPTIMIZER_MAX_TRAINING_CARDS, DEFAULT_FSRS_REQUEST_RETENTION } from '../../common/constants';
import { Logger } from '@common/logger';

/**
 * Shape of the initialized WebAssembly WASI module binding.
 */
export interface WasmBinding {
    /** Constructor for individual review log items accepted by the WASM optimizer. */
    FSRSBindingReview: new (rating: number, deltaT: number) => FSRSBindingReview;
    /** Constructor for grouped card review sequences accepted by the WASM optimizer. */
    FSRSBindingItem: new (reviews: FSRSBindingReview[]) => FSRSBindingItem;
    /** Calculation method computing optimal weights from training items. */
    computeParameters: typeof computeParameters;
}

let _bindingInstance: WasmBinding | null = null;

const wasmUrl = new URL('@open-spaced-repetition/binding-wasm32-wasi/fsrs-binding.wasm32-wasi.wasm', import.meta.url);

/**
 * Lazily loads and instantiates the WebAssembly WASI optimizer worker.
 * 
 * @async
 * @returns {Promise<WasmBinding>} The initialized WASM binding instance.
 */
async function getBinding(): Promise<WasmBinding> {
    if (!_bindingInstance) {
        _bindingInstance = await initOptimizer({
            wasm: wasmUrl as unknown as string,
            worker: () => new Worker(new URL('@open-spaced-repetition/binding-wasm32-wasi/wasi-worker-browser.mjs', import.meta.url))
        }) as WasmBinding;
    }
    return _bindingInstance;
}

/**
 * Representation of history qualification status for weight training.
 */
export interface EligibilityResult {
    /** Whether review history volume qualifies for training. */
    eligible: boolean;
    /** Number of historical reviews recorded. */
    count: number;
    /** Minimum review threshold required. */
    threshold: number;
    /** Count of unique cards with multiple reviews. */
    uniqueCards?: number;
}

/**
 * WebAssembly-based parameter optimizer for personalized FSRS weights.
 */
export class FsrsOptimizer {
    /** Number of training epochs to run. */
    epochs: number;

    /**
     * Initializes default training hyper-parameters.
     */
    constructor() {
        this.epochs = 50;
    }

    /**
     * Evaluates card collection history to determine if enough multi-review items exist to train weights.
     * 
     * @param {Card[]} history - Array of study cards to evaluate.
     * @param {number} [threshold=OPTIMIZER_DEFAULT_THRESHOLD] - Target review threshold.
     * @returns {EligibilityResult} Eligibility metrics and card count.
     */
    computeEligibility(history: Card[], threshold: number = OPTIMIZER_DEFAULT_THRESHOLD): EligibilityResult {
        if (!history || !Array.isArray(history)) return { eligible: false, count: 0, threshold };

        let reviewCount = 0;
        const uniqueCards = new Set<string>();

        history.forEach((card: Card) => {
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

    /**
     * Prepares review logs and executes the WebAssembly optimizer to calculate personalized weights.
     * 
     * @async
     * @param {Card[]} history - Full array of user cards containing review logs.
     * @param {number[]} currentWeights - Current 17-parameter weights baseline.
     * @param {number} [targetRetention=DEFAULT_FSRS_REQUEST_RETENTION] - Target memory retention probability.
     * @param {((current: number, total: number) => void) | null} [onProgress=null] - Optional progress notification callback.
     * @returns {Promise<number[]>} Array of 17 optimized weights.
     * @throws {Error} If WASM compilation or optimization times out or fails.
     */
    async trainWeights(
        history: Card[],
        currentWeights: number[],
        targetRetention: number = DEFAULT_FSRS_REQUEST_RETENTION,
        onProgress: ((current: number, total: number) => void) | null = null
    ): Promise<number[]> {
        if (!history || history.length === 0) return currentWeights;

        try {
            const binding = await getBinding();
            Logger.debug('FSRS', 'WASM optimizer binding initialized successfully');
            let trainSet: FSRSBindingItem[] = [];

            history.forEach((card: Card) => {
                if (card.historyLog && card.historyLog.length > 0) {
                    const reviews: FSRSBindingReview[] = [];

                    let hasValidDeltaT = false;
                    card.historyLog.forEach((log: ReviewLog | number | { rating?: unknown; date?: unknown }, index: number) => {
                        let ratingNum: number = Rating.Good;
                        let logDate: number;

                        if (typeof log === 'object' && log !== null) {
                            const rawLog = log as Record<string, unknown>;
                            if (rawLog.rating === 'again') ratingNum = Rating.Again;
                            else if (rawLog.rating === 'hard') ratingNum = Rating.Hard;
                            else if (rawLog.rating === 'good') ratingNum = Rating.Good;
                            else if (rawLog.rating === 'easy') ratingNum = Rating.Easy;
                            else if (typeof rawLog.rating === 'number') ratingNum = rawLog.rating;

                            logDate = typeof rawLog.date === 'number' ? rawLog.date : Date.now();
                        } else {
                            logDate = typeof log === 'number' ? log : Date.now();
                        }

                        // Only valid FSRS ratings (1-4) should be passed to the optimizer
                        if (ratingNum >= Rating.Again && ratingNum <= Rating.Easy) {
                            let deltaT = 0;

                            // For FSRS, the first actual review MUST have delta_t = 0.
                            // Subsequent reviews calculate delta_t based on the previous log.
                            if (reviews.length > 0 && index > 0 && card.historyLog) {
                                const prevLog = card.historyLog[index - 1];
                                const prevDate = (typeof prevLog === 'object' && prevLog !== null && 'date' in prevLog && typeof prevLog.date === 'number')
                                    ? prevLog.date
                                    : (typeof prevLog === 'number' ? prevLog : Date.now());
                                deltaT = Math.round((logDate - prevDate) / MS_PER_DAY);
                                if (deltaT < 0) deltaT = 0;
                            }

                            if (deltaT > 0) hasValidDeltaT = true;

                            reviews.push(new binding.FSRSBindingReview(ratingNum, deltaT) as FSRSBindingReview);
                        }
                    });

                    // We only want to train on cards that have actually been reviewed more than once
                    // (i.e. they have at least one follow-up review with deltaT > 0)
                    if (hasValidDeltaT && reviews.length > 1) {
                        trainSet.push(new binding.FSRSBindingItem(reviews) as FSRSBindingItem);
                    }
                }
            });

            if (trainSet.length === 0) {
                Logger.warn('FSRS', 'Skipping WASM optimization because trainSet is empty (requires cards with deltaT > 0).');
                return currentWeights;
            }

            // Cap the trainSet to a maximum limit to prevent WASM OOM or extreme timeouts
            if (trainSet.length > OPTIMIZER_MAX_TRAINING_CARDS) {
                Logger.info('FSRS', `Limiting train set from ${trainSet.length} to ${OPTIMIZER_MAX_TRAINING_CARDS} cards for stability.`);
                trainSet = trainSet.slice(0, OPTIMIZER_MAX_TRAINING_CARDS);
            }

            Logger.info('FSRS', `Training WASM optimizer on ${trainSet.length} cards...`);

            const optimizedWeights = await binding.computeParameters(trainSet, {
                enableShortTerm: false,
                timeout: 60000,
                progress: (current: number, total: number) => {
                    if (onProgress) onProgress(current, total);
                }
            });

            Logger.info('FSRS', 'WASM Optimizer success. New weights:', optimizedWeights);
            return optimizedWeights;
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            Logger.error('FSRS', `WASM training failed: ${errorMessage}`, { error: e });
            // Comment: Re-throw error so caller can trigger fallback fast optimizer
            throw e;
        }
    }
}

export default FsrsOptimizer;

if (typeof window !== 'undefined') {
    (window as unknown as { FsrsOptimizer?: typeof FsrsOptimizer }).FsrsOptimizer = FsrsOptimizer;
}
