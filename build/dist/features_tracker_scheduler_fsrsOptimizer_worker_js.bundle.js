/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./features/tracker/scheduler/fsrsOptimizer.js"
/*!*****************************************************!*\
  !*** ./features/tracker/scheduler/fsrsOptimizer.js ***!
  \*****************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/* harmony import */ var _open_spaced_repetition_binding_dynamic_wasi__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @open-spaced-repetition/binding/dynamic-wasi */ "./node_modules/@open-spaced-repetition/binding/dist/dynamic-wasi-browser.js");
/**
 * @file features/tracker/scheduler/fsrsOptimizer.js
 * @description Lightweight JavaScript optimizer for personalized FSRS weights.
 */



let _bindingInstance = null;
const wasmUrl = new URL(/* asset import */ __webpack_require__(/*! @open-spaced-repetition/binding-wasm32-wasi/fsrs-binding.wasm32-wasi.wasm */ "./node_modules/@open-spaced-repetition/binding-wasm32-wasi/fsrs-binding.wasm32-wasi.wasm"), __webpack_require__.b);

async function getBinding() {
    if (!_bindingInstance) {
        _bindingInstance = await (0,_open_spaced_repetition_binding_dynamic_wasi__WEBPACK_IMPORTED_MODULE_0__.initOptimizer)({
            wasm: wasmUrl,
            worker: () => new Worker(new URL(/* worker import */ __webpack_require__.p + __webpack_require__.u("node_modules_open-spaced-repetition_binding-wasm32-wasi_wasi-worker-browser_mjs"), __webpack_require__.b), { type: undefined })
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

    async trainWeights(history, currentWeights, targetRetention = 0.90) {
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
                        
                        let deltaT = 0;
                        if (index > 0) {
                            let prevLog = card.historyLog[index - 1];
                            let prevDate = typeof prevLog === 'object' ? prevLog.date : prevLog;
                            deltaT = Math.round((logDate - prevDate) / (1000 * 60 * 60 * 24));
                            if (deltaT > 0) hasValidDeltaT = true;
                        }

                        reviews.push(new binding.FSRSBindingReview(ratingNum, deltaT));
                    });
                    
                    if (hasValidDeltaT) {
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
                timeout: 900000 
            });
            
            console.log(`[FSRS Optimizer] Success. New weights:`, optimizedWeights);
            return optimizedWeights;
        } catch (e) {
            console.error(`[FSRS Optimizer] Training failed. Error:`, e);
            throw e;
        }
    }
}

// Export for webpack and tests
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FsrsOptimizer);
if (typeof window !== 'undefined') {
    window.FsrsOptimizer = FsrsOptimizer;
}


/***/ },

/***/ "./features/tracker/scheduler/fsrsOptimizer.worker.js"
/*!************************************************************!*\
  !*** ./features/tracker/scheduler/fsrsOptimizer.worker.js ***!
  \************************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony import */ var _fsrsOptimizer_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./fsrsOptimizer.js */ "./features/tracker/scheduler/fsrsOptimizer.js");
/* harmony import */ var _fsrsOptimizerFast_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./fsrsOptimizerFast.js */ "./features/tracker/scheduler/fsrsOptimizerFast.js");
/**
 * @file features/tracker/scheduler/fsrsOptimizer.worker.js
 * @description Web Worker to run FSRS WASM optimizations off the main UI thread.
 */




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
                const optimizer = new _fsrsOptimizer_js__WEBPACK_IMPORTED_MODULE_0__["default"]();
                optimizedWeights = await optimizer.trainWeights(history, currentWeights, targetRetention);
            } catch (wasmError) {
                console.warn("WASM Optimizer failed or panicked. Falling back to Fast JS Optimizer.", wasmError);
                // Fallback to the Fast JS heuristic optimizer
                const fastOptimizer = new _fsrsOptimizerFast_js__WEBPACK_IMPORTED_MODULE_1__["default"]();
                optimizedWeights = await fastOptimizer.trainWeights(history, currentWeights, targetRetention);
            }
            
            self.postMessage({ action: 'trainWeightsResult', success: true, optimizedWeights });
        }
    } catch (err) {
        self.postMessage({ action: 'trainWeightsResult', success: false, error: err.message });
    }
};


/***/ },

/***/ "./features/tracker/scheduler/fsrsOptimizerFast.js"
/*!*********************************************************!*\
  !*** ./features/tracker/scheduler/fsrsOptimizerFast.js ***!
  \*********************************************************/
(__unused_webpack_module, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
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
     * Used as a fallback because WASM binding for exact log-loss gradient descent can fail on certain MV3 environments.
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

// Export for webpack and tests
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (FsrsOptimizer);
if (typeof window !== 'undefined') {
    window.FsrsOptimizer = FsrsOptimizer;
}


/***/ },

/***/ "./node_modules/@open-spaced-repetition/binding-wasm32-wasi/fsrs-binding.wasm32-wasi.wasm"
/*!************************************************************************************************!*\
  !*** ./node_modules/@open-spaced-repetition/binding-wasm32-wasi/fsrs-binding.wasm32-wasi.wasm ***!
  \************************************************************************************************/
(module, __unused_webpack_exports, __webpack_require__) {

module.exports = __webpack_require__.p + "dist/3f8d1e11639f8958239f.wasm";

/***/ },

/***/ "./node_modules/@open-spaced-repetition/binding/dist/dynamic-wasi-browser.js"
/*!***********************************************************************************!*\
  !*** ./node_modules/@open-spaced-repetition/binding/dist/dynamic-wasi-browser.js ***!
  \***********************************************************************************/
(__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   initOptimizer: () => (/* binding */ initOptimizer)
/* harmony export */ });
/* harmony import */ var _napi_rs_wasm_runtime__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @napi-rs/wasm-runtime */ "./node_modules/@napi-rs/wasm-runtime/runtime.js");
/* eslint-disable */
/* prettier-ignore */

// Dynamic loader for browser — allows external wasm/worker resources.



async function _resolveWasm(wasm) {
  if (wasm instanceof ArrayBuffer || ArrayBuffer.isView(wasm)) {
    return wasm
  }
  if (typeof Response !== 'undefined' && wasm instanceof Response) {
    return wasm.arrayBuffer()
  }
  if (typeof wasm === 'string' || wasm instanceof URL) {
    const url = typeof wasm === 'string' ? wasm : wasm.href
    return fetch(url).then((r) => r.arrayBuffer())
  }
  throw new TypeError(
    'options.wasm must be a BufferSource, URL string, URL, or fetch Response'
  )
}

function _resolveWorker(worker, errorEvent) {
  let factory
  if (typeof worker === 'function') {
    factory = worker
  } else if (typeof worker === 'string' || worker instanceof URL) {
    const workerUrl = typeof worker === 'string' ? worker : worker.href
    factory = () => new Worker(workerUrl, { type: 'module' })
  } else {
    throw new TypeError(
      'options.worker must be a factory function, URL string, or URL'
    )
  }
  if (!errorEvent) return factory
  return () => {
    const w = factory()
    w.addEventListener('message', (event) => {
      if (
        event.data &&
        typeof event.data === 'object' &&
        event.data.type === 'error'
      ) {
        window.dispatchEvent(
          new CustomEvent('napi-rs-worker-error', { detail: event.data })
        )
      }
    })
    return w
  }
}

async function initOptimizer(options) {
  const wasmBinary = await _resolveWasm(options.wasm)
  const onCreateWorker = _resolveWorker(
    options.worker,
    options.errorEvent ?? false
  )

  // --- WASI setup ---
  const __wasi = new _napi_rs_wasm_runtime__WEBPACK_IMPORTED_MODULE_0__.WASI({
    version: 'preview1',
  })

  const __emnapiContext = (0,_napi_rs_wasm_runtime__WEBPACK_IMPORTED_MODULE_0__.getDefaultContext)()
  const __sharedMemory = new WebAssembly.Memory({
    initial: 4000,
    maximum: 65536,
    shared: true,
  })

  const { napiModule: __napiModule } = (0,_napi_rs_wasm_runtime__WEBPACK_IMPORTED_MODULE_0__.instantiateNapiModuleSync)(
    wasmBinary,
    {
      context: __emnapiContext,
      asyncWorkPoolSize: 4,
      wasi: __wasi,
      onCreateWorker,
      overwriteImports(importObject) {
        importObject.env = {
          ...importObject.env,
          ...importObject.napi,
          ...importObject.emnapi,
          memory: __sharedMemory,
        }
        return importObject
      },
      beforeInit({ instance }) {
        for (const name of Object.keys(instance.exports)) {
          if (name.startsWith('__napi_register__')) {
            instance.exports[name]()
          }
        }
      },
    }
  )

  return __napiModule.exports
}


/***/ }

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	const __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		const cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		const module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		if (!(moduleId in __webpack_modules__)) {
/******/ 			delete __webpack_module_cache__[moduleId];
/******/ 			const e = new Error("Cannot find module '" + moduleId + "'");
/******/ 			e.code = 'MODULE_NOT_FOUND';
/******/ 			throw e;
/******/ 		}
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/******/ 	// the startup function
/******/ 	__webpack_require__.x = () => {
/******/ 		// Load entry module and return exports
/******/ 		// This entry module depends on other loaded chunks and execution need to be delayed
/******/ 		let __webpack_exports__ = __webpack_require__.O(undefined, ["vendors-node_modules_napi-rs_wasm-runtime_runtime_js"], () => (__webpack_require__("./features/tracker/scheduler/fsrsOptimizer.worker.js")))
/******/ 		__webpack_exports__ = __webpack_require__.O(__webpack_exports__);
/******/ 		return __webpack_exports__;
/******/ 	};
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/chunk loaded */
/******/ 	(() => {
/******/ 		const deferred = [];
/******/ 		__webpack_require__.O = (result, chunkIds, fn, priority) => {
/******/ 			if(chunkIds) {
/******/ 				priority = priority || 0;
/******/ 				for(var i = deferred.length; i > 0 && deferred[i - 1][2] > priority; i--) deferred[i] = deferred[i - 1];
/******/ 				deferred[i] = [chunkIds, fn, priority];
/******/ 				return;
/******/ 			}
/******/ 			let notFulfilled = Infinity;
/******/ 			for (var i = 0; i < deferred.length; i++) {
/******/ 				let [chunkIds, fn, priority] = deferred[i];
/******/ 				let fulfilled = true;
/******/ 				for (var j = 0; j < chunkIds.length; j++) {
/******/ 					if ((priority & 1 === 0 || notFulfilled >= priority) && Object.keys(__webpack_require__.O).every((key) => (__webpack_require__.O[key](chunkIds[j])))) {
/******/ 						chunkIds.splice(j--, 1);
/******/ 					} else {
/******/ 						fulfilled = false;
/******/ 						if(priority < notFulfilled) notFulfilled = priority;
/******/ 					}
/******/ 				}
/******/ 				if(fulfilled) {
/******/ 					deferred.splice(i--, 1)
/******/ 					const r = fn();
/******/ 					if (r !== undefined) result = r;
/******/ 				}
/******/ 			}
/******/ 			return result;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter/value functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			if(Array.isArray(definition)) {
/******/ 				var i = 0;
/******/ 				while(i < definition.length) {
/******/ 					var key = definition[i++];
/******/ 					var binding = definition[i++];
/******/ 					if(!__webpack_require__.o(exports, key)) {
/******/ 						if(binding === 0) {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, value: definition[i++] });
/******/ 						} else {
/******/ 							Object.defineProperty(exports, key, { enumerable: true, get: binding });
/******/ 						}
/******/ 					} else if(binding === 0) { i++; }
/******/ 				}
/******/ 			} else {
/******/ 				for(var key in definition) {
/******/ 					if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 						Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 					}
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/ensure chunk */
/******/ 	(() => {
/******/ 		__webpack_require__.f = {};
/******/ 		// This file contains only the entry chunk.
/******/ 		// The chunk loading function for additional chunks
/******/ 		__webpack_require__.e = (chunkId) => {
/******/ 			return Promise.all(Object.keys(__webpack_require__.f).reduce((promises, key) => {
/******/ 				__webpack_require__.f[key](chunkId, promises);
/******/ 				return promises;
/******/ 			}, []));
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks and chunks that the entrypoint depends on
/******/ 		__webpack_require__.u = (chunkId) => {
/******/ 			// return url for filenames based on template
/******/ 			return "dist/" + chunkId + ".bundle.js";
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		__webpack_require__.p = "/";
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/importScripts chunk loading */
/******/ 	(() => {
/******/ 		__webpack_require__.b = self.location + "/../../";
/******/ 		
/******/ 		// object to store loaded chunks
/******/ 		// "1" means "already loaded"
/******/ 		var installedChunks = {
/******/ 			"features_tracker_scheduler_fsrsOptimizer_worker_js": 1
/******/ 		};
/******/ 		
/******/ 		// importScripts chunk loading
/******/ 		var installChunk = (data) => {
/******/ 			let [chunkIds, moreModules, runtime] = data;
/******/ 			for(var moduleId in moreModules) {
/******/ 				if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 					__webpack_require__.m[moduleId] = moreModules[moduleId];
/******/ 				}
/******/ 			}
/******/ 			if(runtime) runtime(__webpack_require__);
/******/ 			while(chunkIds.length)
/******/ 				installedChunks[chunkIds.pop()] = 1;
/******/ 			parentChunkLoadingFunction(data);
/******/ 		};
/******/ 		__webpack_require__.f.i = (chunkId, promises) => {
/******/ 			// "1" is the signal for "already loaded"
/******/ 			if(!installedChunks[chunkId]) {
/******/ 				if(true) { // all chunks have JS
/******/ 					importScripts(__webpack_require__.p + __webpack_require__.u(chunkId));
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 		
/******/ 		var chunkLoadingGlobal = self["webpackChunkalgomonster_fsrs_extension"] = self["webpackChunkalgomonster_fsrs_extension"] || [];
/******/ 		var parentChunkLoadingFunction = chunkLoadingGlobal.push.bind(chunkLoadingGlobal);
/******/ 		chunkLoadingGlobal.push = installChunk;
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/startup chunk dependencies */
/******/ 	(() => {
/******/ 		const next = __webpack_require__.x;
/******/ 		__webpack_require__.x = () => {
/******/ 			return __webpack_require__.e("vendors-node_modules_napi-rs_wasm-runtime_runtime_js").then(next);
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// run startup
/******/ 	var __webpack_exports__ = __webpack_require__.x();
/******/ 	
/******/ })()
;
//# sourceMappingURL=features_tracker_scheduler_fsrsOptimizer_worker_js.bundle.js.map