/**
 * @file features/tracker/scheduler/fsrsOptimizer.worker.js
 * @description Web Worker to run FSRS WASM optimizations off the main UI thread.
 */

import FsrsOptimizer from './fsrsOptimizer.js';
import FsrsOptimizerFast from './fsrsOptimizerFast.js';

self.addEventListener('error', (event) => {
    // If it's a fatal worker error, we can't do much, but we try to communicate it.
    self.postMessage({ type: 'error', error: event.message || 'Unknown Worker Error' });
});

self.addEventListener('unhandledrejection', (event) => {
    self.postMessage({ action: 'trainWeightsResult', success: false, error: 'WASM Worker Error: ' + event.reason });
});

self.onmessage = async (e) => {
    try {
        const { action, payload } = e.data;
        if (action === 'trainWeights') {
            const { history, currentWeights, targetRetention } = payload;
            let optimizedWeights;

            try {
                // Try using the WASM optimizer first
                const optimizer = new FsrsOptimizer();
                optimizedWeights = await optimizer.trainWeights(history, currentWeights, targetRetention, (current, total) => {
                    self.postMessage({ action: 'progress', current, total });
                });
            } catch (wasmError) {
                console.warn("WASM Optimizer failed. Falling back to Fast JS Optimizer.", wasmError);
                // Fallback to the Fast JS heuristic optimizer
                const fastOptimizer = new FsrsOptimizerFast();
                optimizedWeights = await fastOptimizer.trainWeights(history, currentWeights, targetRetention, (current, total) => {
                    self.postMessage({ action: 'progress', current, total });
                });
            }

            self.postMessage({ action: 'trainWeightsResult', success: true, optimizedWeights });
        }
    } catch (err) {
        self.postMessage({ action: 'trainWeightsResult', success: false, error: err.message });
    }
};
