/**
 * @file features/tracker/scheduler/fsrsOptimizer.worker.js
 * @description Web Worker to run FSRS WASM optimizations off the main UI thread.
 */

import FsrsOptimizer from './fsrsOptimizer.js';

self.addEventListener('error', (event) => {
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
            const optimizer = new FsrsOptimizer();
            const optimizedWeights = await optimizer.trainWeights(history, currentWeights, targetRetention);
            self.postMessage({ action: 'trainWeightsResult', success: true, optimizedWeights });
        }
    } catch (err) {
        self.postMessage({ action: 'trainWeightsResult', success: false, error: err.message });
    }
};
