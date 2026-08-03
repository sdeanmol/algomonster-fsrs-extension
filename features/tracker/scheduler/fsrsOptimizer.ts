/**
 * @file features/tracker/scheduler/fsrsOptimizer.ts
 * @description Lightweight JavaScript optimizer for personalized FSRS weights using WASM binding.
 */

import type { FSRSBindingReview, FSRSBindingItem, computeParameters } from '@open-spaced-repetition/binding';
import { initOptimizer } from '@open-spaced-repetition/binding/dynamic-wasi';
import { Rating } from 'ts-fsrs';
import { Card, ReviewLog } from '../../../types/domain';
import { MS_PER_DAY, OPTIMIZER_DEFAULT_THRESHOLD, OPTIMIZER_MAX_TRAINING_CARDS, DEFAULT_FSRS_REQUEST_RETENTION } from '../../common/constants';
import { Logger } from '@common/logger';

export interface WasmBinding {
    FSRSBindingReview: new (rating: number, deltaT: number) => FSRSBindingReview;
    FSRSBindingItem: new (reviews: FSRSBindingReview[]) => FSRSBindingItem;
    computeParameters: typeof computeParameters;
}

let _bindingInstance: WasmBinding | null = null;
const metaUrl = (typeof globalThis !== 'undefined' && (globalThis as any).__WASM_BASE_URL__) || 'http://localhost';
const wasmUrl = new URL('@open-spaced-repetition/binding-wasm32-wasi/fsrs-binding.wasm32-wasi.wasm', metaUrl);

async function getBinding(): Promise<WasmBinding> {
    if (!_bindingInstance) {
        _bindingInstance = await initOptimizer({
            wasm: wasmUrl as any,
            worker: () => new Worker(new URL('@open-spaced-repetition/binding-wasm32-wasi/wasi-worker-browser.mjs', metaUrl))
        }) as WasmBinding;
    }
    return _bindingInstance;
}

export interface EligibilityResult {
    eligible: boolean;
    count: number;
    threshold: number;
    uniqueCards?: number;
}

export class FsrsOptimizer {
    epochs: number;

    constructor() {
        this.epochs = 50;
    }

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

    async trainWeights(
        history: Card[],
        currentWeights: number[],
        targetRetention: number = DEFAULT_FSRS_REQUEST_RETENTION,
        onProgress: ((current: number, total: number) => void) | null = null
    ): Promise<number[]> {
        if (!history || history.length === 0) return currentWeights;

        try {
            const binding = await getBinding();
            console.log(binding)
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
    (window as unknown as { FsrsOptimizer: typeof FsrsOptimizer }).FsrsOptimizer = FsrsOptimizer;
}
