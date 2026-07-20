/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({});
/************************************************************************/
/******/ 	// The require scope
/******/ 	const __webpack_require__ = {};
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/get javascript chunk filename */
/******/ 	(() => {
/******/ 		// This function allow to reference async chunks
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
/******/ 	/* webpack/runtime/publicPath */
/******/ 	(() => {
/******/ 		__webpack_require__.p = "/";
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/jsonp chunk loading */
/******/ 	(() => {
/******/ 		__webpack_require__.b = (typeof document !== 'undefined' && document.baseURI) || self.location.href;
/******/ 		
/******/ 		// object to store loaded and loading chunks
/******/ 		// undefined = chunk not loaded, null = chunk preloaded/prefetched
/******/ 		// [resolve, reject, Promise] = chunk loading, 0 = chunk loaded
/******/ 		const installedChunks = {
/******/ 			"config": 0
/******/ 		};
/******/ 		
/******/ 		// no chunk on demand loading
/******/ 		
/******/ 		// no prefetching
/******/ 		
/******/ 		// no preloaded
/******/ 		
/******/ 		// no HMR
/******/ 		
/******/ 		// no HMR manifest
/******/ 		
/******/ 		// no on chunks loaded
/******/ 		
/******/ 		// no jsonp function
/******/ 	})();
/******/ 	
/************************************************************************/
/*!***********************************************!*\
  !*** ./features/tracker/config/fsrsConfig.js ***!
  \***********************************************/
/**
 * @file features/tracker/config/fsrsConfig.js
 * @description Manages configuration preferences for the Free Spaced Repetition Scheduler (FSRS).
 * Allows customized requests retention sliders, custom coefficients weights (17 parameters w0-w16),
 * and custom per-topic profiles mapped directly to tags.
 */


class FSRSConfigManager {
    constructor() {
        this.defaultWeights = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
        this.defaultDecay = -0.5;
        this.defaultFactor = 0.234567;
        this.defaultRetention = 0.90;
        this.optimizerWorker = null;

        this.weightsHelp = [
            "w0: Initial stability for Again rating",
            "w1: Initial stability for Hard rating",
            "w2: Initial stability for Good rating",
            "w3: Initial stability for Easy rating",
            "w4: Initial difficulty on first review",
            "w5: Difficulty scale step based on rating",
            "w6: Difficulty decrease multiplier",
            "w7: Difficulty fuzz stability modifier",
            "w8: Stability modifier for correct reviews",
            "w9: Stability modifier coefficient 2",
            "w10: Stability modifier coefficient 3",
            "w11: Stability modifier coefficient 4",
            "w12: Lapse (forgotten review) modifier 1",
            "w13: Lapse stability modifier 2",
            "w14: Lapse stability modifier 3",
            "w15: Easy bonus multiplier",
            "w16: Stability upper bound limit"
        ];
    }

    /**
     * Initializes elements and binds click listeners.
     */
    init() {
        this.loadFSRSConfig();
        this.bindEvents();
    }

    /**
     * Registers control listeners for UI inputs.
     */
    bindEvents() {
        // Close button
        document.getElementById('back-to-popup-btn').addEventListener('click', () => {
            window.close();
        });

        // Slider listener
        const slider = document.getElementById('retention-slider');
        const badge = document.getElementById('retention-val');
        slider.addEventListener('input', (e) => {
            badge.textContent = `${Math.round(e.target.value * 100)}%`;
        });

        // Save global parameters
        document.getElementById('save-global-btn').addEventListener('click', () => this.saveGlobalConfig());

        // Reset buttons
        document.getElementById('reset-global-btn').addEventListener('click', () => this.restoreGlobalParameters());
        const resetOptBtn = document.getElementById('reset-opt-btn');
        if (resetOptBtn) resetOptBtn.addEventListener('click', () => this.resetOptimization());
        document.getElementById('reset-weights-btn').addEventListener('click', () => this.restoreWeights());
        const resetAllBtn = document.getElementById('reset-all-btn');
        if (resetAllBtn) resetAllBtn.addEventListener('click', () => this.restoreDefaults());

        // Add tag profile
        document.getElementById('add-tag-profile-btn').addEventListener('click', () => this.handleAddTagProfile());

        // Optimization Listeners
        const thresholdInput = document.getElementById('opt-threshold-input');
        if (thresholdInput) {
            thresholdInput.addEventListener('change', () => {
                document.getElementById('opt-threshold-display').textContent = thresholdInput.value;
                this.checkOptimizationEligibility();
            });
        }

        const autoTrainBtn = document.getElementById('btn-auto-train');
        if (autoTrainBtn) {
            autoTrainBtn.addEventListener('click', () => this.handleAutoTrain());
        }

        const exportBtn = document.getElementById('btn-export-weights');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.handleExportWeights());
        }
    }

    /**
     * Checks history to see if enough reviews exist to unlock optimization.
     */
    async checkOptimizationEligibility() {

        const result = await new Promise(r => chrome.storage.local.get(['fsrsCards'], r));
        const historyArray = result.fsrsCards || [];

        const threshold = parseInt(document.getElementById('opt-threshold-input').value) || 1000;

        const thresholdWarning = document.getElementById('opt-threshold-warning');
        if (thresholdWarning) {
            thresholdWarning.style.display = threshold < 1000 ? 'flex' : 'none';
        }

        const eligibility = this.computeEligibility(historyArray, threshold);

        const progressFill = document.getElementById('opt-progress-fill');
        const progressText = document.getElementById('opt-progress-text');
        const statusMsg = document.getElementById('opt-status-msg');
        const actionsSection = document.getElementById('opt-actions-section');

        const percentage = Math.min(100, Math.round((eligibility.count / threshold) * 100));
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${eligibility.count} / ${threshold} Reviews`;

        if (eligibility.eligible) {
            progressFill.style.backgroundColor = 'var(--md-primary)';
            statusMsg.textContent = `Eligible! You have enough history to train personalized weights.`;
            statusMsg.style.color = 'var(--md-primary)';
            actionsSection.style.display = 'flex';
        } else {
            progressFill.style.backgroundColor = 'var(--md-primary-container)';
            statusMsg.textContent = `Keep reviewing to unlock personalized optimization.`;
            statusMsg.style.color = 'var(--md-text-low)';
            actionsSection.style.display = 'none';
        }
    }

    /**
     * Executes the Auto Train weights workflow.
     */
    async handleAutoTrain() {
        const btn = document.getElementById('btn-auto-train');
        const statusMsg = document.getElementById('opt-status-msg');

        // Setup simple CSS dots animation for the button
        btn.innerHTML = 'Training<span id="train-dots" style="display:inline-block; width:1.2em; text-align:left;">...</span>';
        btn.disabled = true;

        statusMsg.textContent = 'Training in progress... This can take up to 15 minutes for very large histories. Please keep this tab open.';
        statusMsg.style.color = 'var(--md-primary)';

        // Simple dot animation interval
        let dotCount = 0;
        const dotInterval = setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            const dots = document.getElementById('train-dots');
            if (dots) dots.textContent = '.'.repeat(dotCount);
        }, 500);

        try {
            const result = await new Promise(r => chrome.storage.local.get(['fsrsCards'], r));
            const historyArray = result.fsrsCards || [];

            // Get current weights and target retention
            let currentWeights = [];
            for (let i = 0; i < 17; i++) {
                currentWeights.push(parseFloat(document.getElementById(`weight-input-${i}`).value));
            }
            const targetRetention = parseFloat(document.getElementById('retention-slider').value) || 0.90;

            if (!this.optimizerWorker) {
                this.optimizerWorker = new Worker(new URL(/* worker import */ __webpack_require__.p + __webpack_require__.u("features_tracker_scheduler_fsrsOptimizer_worker_js"), __webpack_require__.b));
            }

            const optimizedWeights = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error("Training timed out after 1 minute. The dataset might be too large or the algorithm failed to converge."));
                }, 60000);

                this.optimizerWorker.onmessage = (e) => {
                    if (e.data.action === 'trainWeightsResult') {
                        clearTimeout(timeout);
                        if (e.data.success) {
                            resolve(e.data.optimizedWeights);
                        } else {
                            reject(new Error(e.data.error));
                        }
                    }
                };
                this.optimizerWorker.onerror = (err) => {
                    clearTimeout(timeout);
                    reject(err);
                };
                this.optimizerWorker.postMessage({
                    action: 'trainWeights',
                    payload: { history: historyArray, currentWeights, targetRetention }
                });
            });

            // Save newly trained weights globally
            this.injectWeightsInputs(optimizedWeights);
            this.saveGlobalConfig(true);

            this.showToast("Personal memory optimization successful!", false);

            statusMsg.textContent = "Scheduler optimized successfully using your personal history!";
            statusMsg.style.color = 'var(--md-primary)';

            if (chrome.notifications) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: '/icons/icon.png',
                    title: 'Optimization Complete',
                    message: 'Your personalized FSRS weights have been successfully trained in the background!'
                });
            }
        } catch (err) {
            console.error("Optimization failed:", err);
            this.showToast("Optimization failed. See console.", true);
            statusMsg.textContent = "Optimization failed.";
            statusMsg.style.color = 'var(--md-error)';
        } finally {
            clearInterval(dotInterval);
            btn.textContent = 'Auto Train Weights';
            btn.disabled = false;
        }
    }

    handleExportWeights() {
        const weights = [];
        for (let i = 0; i < 17; i++) {
            weights.push(parseFloat(document.getElementById(`weight-input-${i}`).value));
        }

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(weights));
        const anchor = document.createElement('a');
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", "fsrs_weights_export.json");
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    }

    /**
     * Loads current settings from local storage and initiates rendering of panels.
     */
    loadFSRSConfig() {
        chrome.storage.local.get(['fsrsGlobalParams', 'fsrsTopicWeights'], (result) => {
            const params = result.fsrsGlobalParams || {};
            const weights = params.w || [...this.defaultWeights];
            const decay = params.decay !== undefined ? params.decay : this.defaultDecay;
            const factor = params.factor !== undefined ? params.factor : this.defaultFactor;
            const retention = params.requestRetention !== undefined ? params.requestRetention : this.defaultRetention;

            // Set inputs
            document.getElementById('retention-slider').value = retention;
            document.getElementById('retention-val').textContent = `${Math.round(retention * 100)}%`;
            document.getElementById('decay-input').value = decay;
            document.getElementById('factor-input').value = factor;

            // Inject weights grid
            this.injectWeightsInputs(weights);

            // Render tag profiles
            this.renderTagProfiles(result.fsrsTopicWeights || {});

            // Check optimization eligibility
            this.checkOptimizationEligibility();
        });
    }

    /**
     * Dynamically builds HTML number input fields for the 17 mathematical w-weights.
     * @param {number[]} weightsArray - Array of current w-weights.
     */
    injectWeightsInputs(weightsArray) {
        const container = document.getElementById('weights-inputs-container');
        if (!container) return;
        container.innerHTML = '';

        for (let i = 0; i < 17; i++) {
            const val = weightsArray[i] !== undefined ? weightsArray[i] : this.defaultWeights[i];
            const helpText = this.weightsHelp[i];
            const div = document.createElement('div');
            div.className = 'weight-input-container';
            div.innerHTML = `
                <div class="weight-label-wrapper">
                    <span class="weight-index">w${i}</span>
                    <svg class="svg-icon" viewBox="0 0 24 24" title="${helpText}" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="16" x2="12" y2="12"></line>
                        <line x1="12" y1="8" x2="12.01" y2="8"></line>
                    </svg>
                </div>
                <input type="number" step="0.01" class="weight-num-input" id="weight-input-${i}" value="${val}">
            `;
            container.appendChild(div);
        }
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
     * Renders lists of active custom topic/tag FSRS weights overrides.
     * @param {Object} topicWeights - Key-value map of tag to weights coefficients array.
     */
    renderTagProfiles(topicWeights) {
        const list = document.getElementById('active-tag-profiles-list');
        if (!list) return;
        list.innerHTML = '';

        if (Object.keys(topicWeights).length === 0) {
            list.innerHTML = `<li style="justify-content: center; color: var(--md-text-low); font-style: italic;">No custom profiles saved yet.</li>`;
            return;
        }

        for (const [tag, weights] of Object.entries(topicWeights)) {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="profile-details">
                    <div>
                        <span class="profile-tag-badge">${tag}</span>
                    </div>
                    <span class="profile-weights-text">w: [${weights.join(', ')}]</span>
                </div>
                <button class="delete-profile-btn" data-tag="${tag}" title="Delete this tag weights profile" aria-label="Delete this tag weights profile">
                    <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            `;
            list.appendChild(li);
        }

        // Link delete buttons
        list.querySelectorAll('.delete-profile-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.currentTarget;
                const tag = button.getAttribute('data-tag');
                this.handleDeleteTagProfile(tag);
            });
        });
    }

    /**
     * Validates and saves global FSRS configuration parameters back to storage.
     */
    saveGlobalConfig() {
        const retention = parseFloat(document.getElementById('retention-slider').value);
        const decay = parseFloat(document.getElementById('decay-input').value);
        const factor = parseFloat(document.getElementById('factor-input').value);

        if (isNaN(decay) || isNaN(factor)) {
            this.showToast("Decay and Factor must be valid numbers.", true);
            return;
        }

        const weights = [];
        for (let i = 0; i < 17; i++) {
            const val = parseFloat(document.getElementById(`weight-input-${i}`).value);
            if (isNaN(val)) {
                this.showToast(`w${i} must be a valid number.`, true);
                return;
            }
            weights.push(val);
        }

        const newParams = {
            w: weights,
            decay,
            factor,
            requestRetention: retention
        };

        chrome.storage.local.set({ fsrsGlobalParams: newParams }, () => {
            this.showToast("FSRS global configurations saved!");
        });
    }

    /**
     * Restores all global parameters to algorithmic baseline defaults.
     */
    restoreDefaults() {
        if (confirm("Restore ALL parameters, optimization status, and coefficients to standard default values?")) {
            const newParams = {
                w: [...this.defaultWeights],
                decay: this.defaultDecay,
                factor: this.defaultFactor,
                requestRetention: this.defaultRetention
            };

            chrome.storage.local.set({ fsrsGlobalParams: newParams }, () => {
                const thresholdInput = document.getElementById('opt-threshold-input');
                if (thresholdInput) {
                    thresholdInput.value = 1000;
                    const display = document.getElementById('opt-threshold-display');
                    if (display) display.textContent = '1000';
                }

                this.loadFSRSConfig();
                this.showToast("Restored all FSRS defaults.");
            });
        }
    }

    /**
     * Restores only the global parameters (retention, decay, factor).
     */
    restoreGlobalParameters() {
        if (confirm("Reset Global Parameters to standard defaults?")) {
            chrome.storage.local.get(['fsrsGlobalParams'], (result) => {
                const params = result.fsrsGlobalParams || {};
                params.requestRetention = this.defaultRetention;
                params.decay = this.defaultDecay;
                params.factor = this.defaultFactor;
                chrome.storage.local.set({ fsrsGlobalParams: params }, () => {
                    this.loadFSRSConfig();
                    this.showToast("Global parameters reset.");
                });
            });
        }
    }

    /**
     * Resets optimization status (removes personalized tag and timestamp).
     */
    resetOptimization() {
        if (confirm("Reset Personal Memory Optimization status?")) {
            chrome.storage.local.get(['fsrsGlobalParams'], (result) => {
                const params = result.fsrsGlobalParams || {};
                delete params.version;
                delete params.timestamp;
                chrome.storage.local.set({ fsrsGlobalParams: params }, () => {
                    this.loadFSRSConfig();
                    this.showToast("Optimization status reset.");
                });
            });
        }
    }

    /**
     * Restores only the FSRS coefficients (w0-w16).
     */
    restoreWeights() {
        if (confirm("Reset FSRS Coefficients to default weights?")) {
            chrome.storage.local.get(['fsrsGlobalParams'], (result) => {
                const params = result.fsrsGlobalParams || {};
                params.w = [...this.defaultWeights];
                chrome.storage.local.set({ fsrsGlobalParams: params }, () => {
                    this.loadFSRSConfig();
                    this.showToast("FSRS coefficients reset.");
                });
            });
        }
    }

    /**
     * Validates inputs and binds a new 17-coefficient custom profile to a specific tag filter.
     */
    handleAddTagProfile() {
        const tagInput = document.getElementById('new-tag-name');
        const weightsInput = document.getElementById('new-tag-weights');

        const tag = tagInput.value.trim();
        const weightsStr = weightsInput.value.trim();

        if (!tag || !weightsStr) {
            this.showToast("Tag name and weights values are required.", true);
            return;
        }

        const weightsArray = weightsStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
        if (weightsArray.length !== 17) {
            this.showToast(`Weights must contain exactly 17 coefficients. Found ${weightsArray.length}.`, true);
            return;
        }

        chrome.storage.local.get(['fsrsTopicWeights'], (result) => {
            const topicWeights = result.fsrsTopicWeights || {};
            topicWeights[tag] = weightsArray;

            chrome.storage.local.set({ fsrsTopicWeights: topicWeights }, () => {
                tagInput.value = '';
                weightsInput.value = '';
                this.loadFSRSConfig();
                this.showToast(`Custom profile saved for tag: ${tag}`);
            });
        });
    }

    /**
     * Deletes custom tag profile bindings from database storage.
     * @param {string} tag - Target tag name.
     */
    handleDeleteTagProfile(tag) {
        chrome.storage.local.get(['fsrsTopicWeights'], (result) => {
            const topicWeights = result.fsrsTopicWeights || {};
            delete topicWeights[tag];

            chrome.storage.local.set({ fsrsTopicWeights: topicWeights }, () => {
                this.loadFSRSConfig();
                this.showToast(`Deleted FSRS profile for tag: ${tag}`);
            });
        });
    }

    /**
     * Triggers a status toast element.
     * @param {string} msg - Message.
     * @param {boolean} [isError=false] - Signals if the status indicates an error.
     */
    showToast(msg, isError = false) {
        const toast = document.getElementById('status-toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.className = 'toast show ' + (isError ? 'error' : 'success');
        setTimeout(() => {
            toast.className = 'toast';
        }, 2500);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const configManager = new FSRSConfigManager();
    configManager.init();
});

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,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aUI7QUFDakIsYUFBYTtBQUNiO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsMkNBQTJDLDBCQUEwQjtBQUNyRTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCLGFBQWE7QUFDYjtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSwyQ0FBMkMsMEJBQTBCO0FBQ3JFO0FBQ0E7QUFDQSxpQkFBaUI7QUFDakIsYUFBYTtBQUNiO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBLGtGQUFrRixvQkFBb0I7QUFDdEc7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUEsdUNBQXVDLGdDQUFnQztBQUN2RTtBQUNBO0FBQ0E7QUFDQSxnRUFBZ0UsSUFBSTtBQUNwRSxhQUFhO0FBQ2IsU0FBUztBQUNUOztBQUVBO0FBQ0E7QUFDQSxlQUFlLFFBQVE7QUFDdkI7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQSx1Q0FBdUMsZ0NBQWdDO0FBQ3ZFO0FBQ0EsZ0VBQWdFLElBQUk7QUFDcEUsYUFBYTtBQUNiLFNBQVM7QUFDVDs7QUFFQTtBQUNBO0FBQ0EsZUFBZSxRQUFRO0FBQ3ZCLGVBQWUsU0FBUztBQUN4QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsQ0FBQyIsInNvdXJjZXMiOlsid2VicGFjazovL2FsZ29tb25zdGVyLWZzcnMtZXh0ZW5zaW9uL3dlYnBhY2svYm9vdHN0cmFwIiwid2VicGFjazovL2FsZ29tb25zdGVyLWZzcnMtZXh0ZW5zaW9uL3dlYnBhY2svcnVudGltZS9nZXQgamF2YXNjcmlwdCBjaHVuayBmaWxlbmFtZSIsIndlYnBhY2s6Ly9hbGdvbW9uc3Rlci1mc3JzLWV4dGVuc2lvbi93ZWJwYWNrL3J1bnRpbWUvaGFzT3duUHJvcGVydHkgc2hvcnRoYW5kIiwid2VicGFjazovL2FsZ29tb25zdGVyLWZzcnMtZXh0ZW5zaW9uL3dlYnBhY2svcnVudGltZS9wdWJsaWNQYXRoIiwid2VicGFjazovL2FsZ29tb25zdGVyLWZzcnMtZXh0ZW5zaW9uL3dlYnBhY2svcnVudGltZS9qc29ucCBjaHVuayBsb2FkaW5nIiwid2VicGFjazovL2FsZ29tb25zdGVyLWZzcnMtZXh0ZW5zaW9uLy4vZmVhdHVyZXMvdHJhY2tlci9jb25maWcvZnNyc0NvbmZpZy5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIvLyBUaGUgcmVxdWlyZSBzY29wZVxuY29uc3QgX193ZWJwYWNrX3JlcXVpcmVfXyA9IHt9O1xuXG4vLyBleHBvc2UgdGhlIG1vZHVsZXMgb2JqZWN0IChfX3dlYnBhY2tfbW9kdWxlc19fKVxuX193ZWJwYWNrX3JlcXVpcmVfXy5tID0gX193ZWJwYWNrX21vZHVsZXNfXztcblxuIiwiLy8gVGhpcyBmdW5jdGlvbiBhbGxvdyB0byByZWZlcmVuY2UgYXN5bmMgY2h1bmtzXG5fX3dlYnBhY2tfcmVxdWlyZV9fLnUgPSAoY2h1bmtJZCkgPT4ge1xuXHQvLyByZXR1cm4gdXJsIGZvciBmaWxlbmFtZXMgYmFzZWQgb24gdGVtcGxhdGVcblx0cmV0dXJuIFwiZGlzdC9cIiArIGNodW5rSWQgKyBcIi5idW5kbGUuanNcIjtcbn07IiwiX193ZWJwYWNrX3JlcXVpcmVfXy5vID0gKG9iaiwgcHJvcCkgPT4gKE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHkuY2FsbChvYmosIHByb3ApKSIsIl9fd2VicGFja19yZXF1aXJlX18ucCA9IFwiL1wiOyIsIl9fd2VicGFja19yZXF1aXJlX18uYiA9ICh0eXBlb2YgZG9jdW1lbnQgIT09ICd1bmRlZmluZWQnICYmIGRvY3VtZW50LmJhc2VVUkkpIHx8IHNlbGYubG9jYXRpb24uaHJlZjtcblxuLy8gb2JqZWN0IHRvIHN0b3JlIGxvYWRlZCBhbmQgbG9hZGluZyBjaHVua3Ncbi8vIHVuZGVmaW5lZCA9IGNodW5rIG5vdCBsb2FkZWQsIG51bGwgPSBjaHVuayBwcmVsb2FkZWQvcHJlZmV0Y2hlZFxuLy8gW3Jlc29sdmUsIHJlamVjdCwgUHJvbWlzZV0gPSBjaHVuayBsb2FkaW5nLCAwID0gY2h1bmsgbG9hZGVkXG5jb25zdCBpbnN0YWxsZWRDaHVua3MgPSB7XG5cdFwiY29uZmlnXCI6IDBcbn07XG5cbi8vIG5vIGNodW5rIG9uIGRlbWFuZCBsb2FkaW5nXG5cbi8vIG5vIHByZWZldGNoaW5nXG5cbi8vIG5vIHByZWxvYWRlZFxuXG4vLyBubyBITVJcblxuLy8gbm8gSE1SIG1hbmlmZXN0XG5cbi8vIG5vIG9uIGNodW5rcyBsb2FkZWRcblxuLy8gbm8ganNvbnAgZnVuY3Rpb24iLCIvKipcbiAqIEBmaWxlIGZlYXR1cmVzL3RyYWNrZXIvY29uZmlnL2ZzcnNDb25maWcuanNcbiAqIEBkZXNjcmlwdGlvbiBNYW5hZ2VzIGNvbmZpZ3VyYXRpb24gcHJlZmVyZW5jZXMgZm9yIHRoZSBGcmVlIFNwYWNlZCBSZXBldGl0aW9uIFNjaGVkdWxlciAoRlNSUykuXG4gKiBBbGxvd3MgY3VzdG9taXplZCByZXF1ZXN0cyByZXRlbnRpb24gc2xpZGVycywgY3VzdG9tIGNvZWZmaWNpZW50cyB3ZWlnaHRzICgxNyBwYXJhbWV0ZXJzIHcwLXcxNiksXG4gKiBhbmQgY3VzdG9tIHBlci10b3BpYyBwcm9maWxlcyBtYXBwZWQgZGlyZWN0bHkgdG8gdGFncy5cbiAqL1xuXG5cbmNsYXNzIEZTUlNDb25maWdNYW5hZ2VyIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgdGhpcy5kZWZhdWx0V2VpZ2h0cyA9IFswLjQsIDAuNiwgMi40LCA1LjgsIDQuOTMsIDAuOTQsIDAuODYsIDAuMDEsIDEuNDksIDAuMTQsIDAuOTQsIDIuMTgsIDAuMDUsIDAuMzQsIDEuMjYsIDAuMjksIDIuNjFdO1xuICAgICAgICB0aGlzLmRlZmF1bHREZWNheSA9IC0wLjU7XG4gICAgICAgIHRoaXMuZGVmYXVsdEZhY3RvciA9IDAuMjM0NTY3O1xuICAgICAgICB0aGlzLmRlZmF1bHRSZXRlbnRpb24gPSAwLjkwO1xuICAgICAgICB0aGlzLm9wdGltaXplcldvcmtlciA9IG51bGw7XG5cbiAgICAgICAgdGhpcy53ZWlnaHRzSGVscCA9IFtcbiAgICAgICAgICAgIFwidzA6IEluaXRpYWwgc3RhYmlsaXR5IGZvciBBZ2FpbiByYXRpbmdcIixcbiAgICAgICAgICAgIFwidzE6IEluaXRpYWwgc3RhYmlsaXR5IGZvciBIYXJkIHJhdGluZ1wiLFxuICAgICAgICAgICAgXCJ3MjogSW5pdGlhbCBzdGFiaWxpdHkgZm9yIEdvb2QgcmF0aW5nXCIsXG4gICAgICAgICAgICBcInczOiBJbml0aWFsIHN0YWJpbGl0eSBmb3IgRWFzeSByYXRpbmdcIixcbiAgICAgICAgICAgIFwidzQ6IEluaXRpYWwgZGlmZmljdWx0eSBvbiBmaXJzdCByZXZpZXdcIixcbiAgICAgICAgICAgIFwidzU6IERpZmZpY3VsdHkgc2NhbGUgc3RlcCBiYXNlZCBvbiByYXRpbmdcIixcbiAgICAgICAgICAgIFwidzY6IERpZmZpY3VsdHkgZGVjcmVhc2UgbXVsdGlwbGllclwiLFxuICAgICAgICAgICAgXCJ3NzogRGlmZmljdWx0eSBmdXp6IHN0YWJpbGl0eSBtb2RpZmllclwiLFxuICAgICAgICAgICAgXCJ3ODogU3RhYmlsaXR5IG1vZGlmaWVyIGZvciBjb3JyZWN0IHJldmlld3NcIixcbiAgICAgICAgICAgIFwidzk6IFN0YWJpbGl0eSBtb2RpZmllciBjb2VmZmljaWVudCAyXCIsXG4gICAgICAgICAgICBcIncxMDogU3RhYmlsaXR5IG1vZGlmaWVyIGNvZWZmaWNpZW50IDNcIixcbiAgICAgICAgICAgIFwidzExOiBTdGFiaWxpdHkgbW9kaWZpZXIgY29lZmZpY2llbnQgNFwiLFxuICAgICAgICAgICAgXCJ3MTI6IExhcHNlIChmb3Jnb3R0ZW4gcmV2aWV3KSBtb2RpZmllciAxXCIsXG4gICAgICAgICAgICBcIncxMzogTGFwc2Ugc3RhYmlsaXR5IG1vZGlmaWVyIDJcIixcbiAgICAgICAgICAgIFwidzE0OiBMYXBzZSBzdGFiaWxpdHkgbW9kaWZpZXIgM1wiLFxuICAgICAgICAgICAgXCJ3MTU6IEVhc3kgYm9udXMgbXVsdGlwbGllclwiLFxuICAgICAgICAgICAgXCJ3MTY6IFN0YWJpbGl0eSB1cHBlciBib3VuZCBsaW1pdFwiXG4gICAgICAgIF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5pdGlhbGl6ZXMgZWxlbWVudHMgYW5kIGJpbmRzIGNsaWNrIGxpc3RlbmVycy5cbiAgICAgKi9cbiAgICBpbml0KCkge1xuICAgICAgICB0aGlzLmxvYWRGU1JTQ29uZmlnKCk7XG4gICAgICAgIHRoaXMuYmluZEV2ZW50cygpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVycyBjb250cm9sIGxpc3RlbmVycyBmb3IgVUkgaW5wdXRzLlxuICAgICAqL1xuICAgIGJpbmRFdmVudHMoKSB7XG4gICAgICAgIC8vIENsb3NlIGJ1dHRvblxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYmFjay10by1wb3B1cC1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHtcbiAgICAgICAgICAgIHdpbmRvdy5jbG9zZSgpO1xuICAgICAgICB9KTtcblxuICAgICAgICAvLyBTbGlkZXIgbGlzdGVuZXJcbiAgICAgICAgY29uc3Qgc2xpZGVyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JldGVudGlvbi1zbGlkZXInKTtcbiAgICAgICAgY29uc3QgYmFkZ2UgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmV0ZW50aW9uLXZhbCcpO1xuICAgICAgICBzbGlkZXIuYWRkRXZlbnRMaXN0ZW5lcignaW5wdXQnLCAoZSkgPT4ge1xuICAgICAgICAgICAgYmFkZ2UudGV4dENvbnRlbnQgPSBgJHtNYXRoLnJvdW5kKGUudGFyZ2V0LnZhbHVlICogMTAwKX0lYDtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgLy8gU2F2ZSBnbG9iYWwgcGFyYW1ldGVyc1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnc2F2ZS1nbG9iYWwtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLnNhdmVHbG9iYWxDb25maWcoKSk7XG5cbiAgICAgICAgLy8gUmVzZXQgYnV0dG9uc1xuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzZXQtZ2xvYmFsLWJ0bicpLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5yZXN0b3JlR2xvYmFsUGFyYW1ldGVycygpKTtcbiAgICAgICAgY29uc3QgcmVzZXRPcHRCdG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmVzZXQtb3B0LWJ0bicpO1xuICAgICAgICBpZiAocmVzZXRPcHRCdG4pIHJlc2V0T3B0QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5yZXNldE9wdGltaXphdGlvbigpKTtcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3Jlc2V0LXdlaWdodHMtYnRuJykuYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLnJlc3RvcmVXZWlnaHRzKCkpO1xuICAgICAgICBjb25zdCByZXNldEFsbEJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdyZXNldC1hbGwtYnRuJyk7XG4gICAgICAgIGlmIChyZXNldEFsbEJ0bikgcmVzZXRBbGxCdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLnJlc3RvcmVEZWZhdWx0cygpKTtcblxuICAgICAgICAvLyBBZGQgdGFnIHByb2ZpbGVcbiAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FkZC10YWctcHJvZmlsZS1idG4nKS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsICgpID0+IHRoaXMuaGFuZGxlQWRkVGFnUHJvZmlsZSgpKTtcblxuICAgICAgICAvLyBPcHRpbWl6YXRpb24gTGlzdGVuZXJzXG4gICAgICAgIGNvbnN0IHRocmVzaG9sZElucHV0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29wdC10aHJlc2hvbGQtaW5wdXQnKTtcbiAgICAgICAgaWYgKHRocmVzaG9sZElucHV0KSB7XG4gICAgICAgICAgICB0aHJlc2hvbGRJbnB1dC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29wdC10aHJlc2hvbGQtZGlzcGxheScpLnRleHRDb250ZW50ID0gdGhyZXNob2xkSW5wdXQudmFsdWU7XG4gICAgICAgICAgICAgICAgdGhpcy5jaGVja09wdGltaXphdGlvbkVsaWdpYmlsaXR5KCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGF1dG9UcmFpbkJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tYXV0by10cmFpbicpO1xuICAgICAgICBpZiAoYXV0b1RyYWluQnRuKSB7XG4gICAgICAgICAgICBhdXRvVHJhaW5CdG4uYWRkRXZlbnRMaXN0ZW5lcignY2xpY2snLCAoKSA9PiB0aGlzLmhhbmRsZUF1dG9UcmFpbigpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGV4cG9ydEJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tZXhwb3J0LXdlaWdodHMnKTtcbiAgICAgICAgaWYgKGV4cG9ydEJ0bikge1xuICAgICAgICAgICAgZXhwb3J0QnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKCkgPT4gdGhpcy5oYW5kbGVFeHBvcnRXZWlnaHRzKCkpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGhpc3RvcnkgdG8gc2VlIGlmIGVub3VnaCByZXZpZXdzIGV4aXN0IHRvIHVubG9jayBvcHRpbWl6YXRpb24uXG4gICAgICovXG4gICAgYXN5bmMgY2hlY2tPcHRpbWl6YXRpb25FbGlnaWJpbGl0eSgpIHtcblxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgUHJvbWlzZShyID0+IGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ2ZzcnNDYXJkcyddLCByKSk7XG4gICAgICAgIGNvbnN0IGhpc3RvcnlBcnJheSA9IHJlc3VsdC5mc3JzQ2FyZHMgfHwgW107XG5cbiAgICAgICAgY29uc3QgdGhyZXNob2xkID0gcGFyc2VJbnQoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29wdC10aHJlc2hvbGQtaW5wdXQnKS52YWx1ZSkgfHwgMTAwMDtcblxuICAgICAgICBjb25zdCB0aHJlc2hvbGRXYXJuaW5nID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29wdC10aHJlc2hvbGQtd2FybmluZycpO1xuICAgICAgICBpZiAodGhyZXNob2xkV2FybmluZykge1xuICAgICAgICAgICAgdGhyZXNob2xkV2FybmluZy5zdHlsZS5kaXNwbGF5ID0gdGhyZXNob2xkIDwgMTAwMCA/ICdmbGV4JyA6ICdub25lJztcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGVsaWdpYmlsaXR5ID0gdGhpcy5jb21wdXRlRWxpZ2liaWxpdHkoaGlzdG9yeUFycmF5LCB0aHJlc2hvbGQpO1xuXG4gICAgICAgIGNvbnN0IHByb2dyZXNzRmlsbCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdvcHQtcHJvZ3Jlc3MtZmlsbCcpO1xuICAgICAgICBjb25zdCBwcm9ncmVzc1RleHQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3B0LXByb2dyZXNzLXRleHQnKTtcbiAgICAgICAgY29uc3Qgc3RhdHVzTXNnID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29wdC1zdGF0dXMtbXNnJyk7XG4gICAgICAgIGNvbnN0IGFjdGlvbnNTZWN0aW9uID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ29wdC1hY3Rpb25zLXNlY3Rpb24nKTtcblxuICAgICAgICBjb25zdCBwZXJjZW50YWdlID0gTWF0aC5taW4oMTAwLCBNYXRoLnJvdW5kKChlbGlnaWJpbGl0eS5jb3VudCAvIHRocmVzaG9sZCkgKiAxMDApKTtcbiAgICAgICAgcHJvZ3Jlc3NGaWxsLnN0eWxlLndpZHRoID0gYCR7cGVyY2VudGFnZX0lYDtcbiAgICAgICAgcHJvZ3Jlc3NUZXh0LnRleHRDb250ZW50ID0gYCR7ZWxpZ2liaWxpdHkuY291bnR9IC8gJHt0aHJlc2hvbGR9IFJldmlld3NgO1xuXG4gICAgICAgIGlmIChlbGlnaWJpbGl0eS5lbGlnaWJsZSkge1xuICAgICAgICAgICAgcHJvZ3Jlc3NGaWxsLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICd2YXIoLS1tZC1wcmltYXJ5KSc7XG4gICAgICAgICAgICBzdGF0dXNNc2cudGV4dENvbnRlbnQgPSBgRWxpZ2libGUhIFlvdSBoYXZlIGVub3VnaCBoaXN0b3J5IHRvIHRyYWluIHBlcnNvbmFsaXplZCB3ZWlnaHRzLmA7XG4gICAgICAgICAgICBzdGF0dXNNc2cuc3R5bGUuY29sb3IgPSAndmFyKC0tbWQtcHJpbWFyeSknO1xuICAgICAgICAgICAgYWN0aW9uc1NlY3Rpb24uc3R5bGUuZGlzcGxheSA9ICdmbGV4JztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHByb2dyZXNzRmlsbC5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSAndmFyKC0tbWQtcHJpbWFyeS1jb250YWluZXIpJztcbiAgICAgICAgICAgIHN0YXR1c01zZy50ZXh0Q29udGVudCA9IGBLZWVwIHJldmlld2luZyB0byB1bmxvY2sgcGVyc29uYWxpemVkIG9wdGltaXphdGlvbi5gO1xuICAgICAgICAgICAgc3RhdHVzTXNnLnN0eWxlLmNvbG9yID0gJ3ZhcigtLW1kLXRleHQtbG93KSc7XG4gICAgICAgICAgICBhY3Rpb25zU2VjdGlvbi5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXhlY3V0ZXMgdGhlIEF1dG8gVHJhaW4gd2VpZ2h0cyB3b3JrZmxvdy5cbiAgICAgKi9cbiAgICBhc3luYyBoYW5kbGVBdXRvVHJhaW4oKSB7XG4gICAgICAgIGNvbnN0IGJ0biA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdidG4tYXV0by10cmFpbicpO1xuICAgICAgICBjb25zdCBzdGF0dXNNc2cgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3B0LXN0YXR1cy1tc2cnKTtcblxuICAgICAgICAvLyBTZXR1cCBzaW1wbGUgQ1NTIGRvdHMgYW5pbWF0aW9uIGZvciB0aGUgYnV0dG9uXG4gICAgICAgIGJ0bi5pbm5lckhUTUwgPSAnVHJhaW5pbmc8c3BhbiBpZD1cInRyYWluLWRvdHNcIiBzdHlsZT1cImRpc3BsYXk6aW5saW5lLWJsb2NrOyB3aWR0aDoxLjJlbTsgdGV4dC1hbGlnbjpsZWZ0O1wiPi4uLjwvc3Bhbj4nO1xuICAgICAgICBidG4uZGlzYWJsZWQgPSB0cnVlO1xuXG4gICAgICAgIHN0YXR1c01zZy50ZXh0Q29udGVudCA9ICdUcmFpbmluZyBpbiBwcm9ncmVzcy4uLiBUaGlzIGNhbiB0YWtlIHVwIHRvIDE1IG1pbnV0ZXMgZm9yIHZlcnkgbGFyZ2UgaGlzdG9yaWVzLiBQbGVhc2Uga2VlcCB0aGlzIHRhYiBvcGVuLic7XG4gICAgICAgIHN0YXR1c01zZy5zdHlsZS5jb2xvciA9ICd2YXIoLS1tZC1wcmltYXJ5KSc7XG5cbiAgICAgICAgLy8gU2ltcGxlIGRvdCBhbmltYXRpb24gaW50ZXJ2YWxcbiAgICAgICAgbGV0IGRvdENvdW50ID0gMDtcbiAgICAgICAgY29uc3QgZG90SW50ZXJ2YWwgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgICAgICBkb3RDb3VudCA9IChkb3RDb3VudCArIDEpICUgNDtcbiAgICAgICAgICAgIGNvbnN0IGRvdHMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndHJhaW4tZG90cycpO1xuICAgICAgICAgICAgaWYgKGRvdHMpIGRvdHMudGV4dENvbnRlbnQgPSAnLicucmVwZWF0KGRvdENvdW50KTtcbiAgICAgICAgfSwgNTAwKTtcblxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgbmV3IFByb21pc2UociA9PiBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoWydmc3JzQ2FyZHMnXSwgcikpO1xuICAgICAgICAgICAgY29uc3QgaGlzdG9yeUFycmF5ID0gcmVzdWx0LmZzcnNDYXJkcyB8fCBbXTtcblxuICAgICAgICAgICAgLy8gR2V0IGN1cnJlbnQgd2VpZ2h0cyBhbmQgdGFyZ2V0IHJldGVudGlvblxuICAgICAgICAgICAgbGV0IGN1cnJlbnRXZWlnaHRzID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gMDsgaSA8IDE3OyBpKyspIHtcbiAgICAgICAgICAgICAgICBjdXJyZW50V2VpZ2h0cy5wdXNoKHBhcnNlRmxvYXQoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYHdlaWdodC1pbnB1dC0ke2l9YCkudmFsdWUpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IHRhcmdldFJldGVudGlvbiA9IHBhcnNlRmxvYXQoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JldGVudGlvbi1zbGlkZXInKS52YWx1ZSkgfHwgMC45MDtcblxuICAgICAgICAgICAgaWYgKCF0aGlzLm9wdGltaXplcldvcmtlcikge1xuICAgICAgICAgICAgICAgIHRoaXMub3B0aW1pemVyV29ya2VyID0gbmV3IFdvcmtlcihuZXcgVVJMKCcuLi9zY2hlZHVsZXIvZnNyc09wdGltaXplci53b3JrZXIuanMnLCBpbXBvcnQubWV0YS51cmwpKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3Qgb3B0aW1pemVkV2VpZ2h0cyA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCB0aW1lb3V0ID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoXCJUcmFpbmluZyB0aW1lZCBvdXQgYWZ0ZXIgMSBtaW51dGUuIFRoZSBkYXRhc2V0IG1pZ2h0IGJlIHRvbyBsYXJnZSBvciB0aGUgYWxnb3JpdGhtIGZhaWxlZCB0byBjb252ZXJnZS5cIikpO1xuICAgICAgICAgICAgICAgIH0sIDYwMDAwKTtcblxuICAgICAgICAgICAgICAgIHRoaXMub3B0aW1pemVyV29ya2VyLm9ubWVzc2FnZSA9IChlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlLmRhdGEuYWN0aW9uID09PSAndHJhaW5XZWlnaHRzUmVzdWx0Jykge1xuICAgICAgICAgICAgICAgICAgICAgICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGUuZGF0YS5zdWNjZXNzKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZShlLmRhdGEub3B0aW1pemVkV2VpZ2h0cyk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlamVjdChuZXcgRXJyb3IoZS5kYXRhLmVycm9yKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9O1xuICAgICAgICAgICAgICAgIHRoaXMub3B0aW1pemVyV29ya2VyLm9uZXJyb3IgPSAoZXJyKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0KTtcbiAgICAgICAgICAgICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB0aGlzLm9wdGltaXplcldvcmtlci5wb3N0TWVzc2FnZSh7XG4gICAgICAgICAgICAgICAgICAgIGFjdGlvbjogJ3RyYWluV2VpZ2h0cycsXG4gICAgICAgICAgICAgICAgICAgIHBheWxvYWQ6IHsgaGlzdG9yeTogaGlzdG9yeUFycmF5LCBjdXJyZW50V2VpZ2h0cywgdGFyZ2V0UmV0ZW50aW9uIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAvLyBTYXZlIG5ld2x5IHRyYWluZWQgd2VpZ2h0cyBnbG9iYWxseVxuICAgICAgICAgICAgdGhpcy5pbmplY3RXZWlnaHRzSW5wdXRzKG9wdGltaXplZFdlaWdodHMpO1xuICAgICAgICAgICAgdGhpcy5zYXZlR2xvYmFsQ29uZmlnKHRydWUpO1xuXG4gICAgICAgICAgICB0aGlzLnNob3dUb2FzdChcIlBlcnNvbmFsIG1lbW9yeSBvcHRpbWl6YXRpb24gc3VjY2Vzc2Z1bCFcIiwgZmFsc2UpO1xuXG4gICAgICAgICAgICBzdGF0dXNNc2cudGV4dENvbnRlbnQgPSBcIlNjaGVkdWxlciBvcHRpbWl6ZWQgc3VjY2Vzc2Z1bGx5IHVzaW5nIHlvdXIgcGVyc29uYWwgaGlzdG9yeSFcIjtcbiAgICAgICAgICAgIHN0YXR1c01zZy5zdHlsZS5jb2xvciA9ICd2YXIoLS1tZC1wcmltYXJ5KSc7XG5cbiAgICAgICAgICAgIGlmIChjaHJvbWUubm90aWZpY2F0aW9ucykge1xuICAgICAgICAgICAgICAgIGNocm9tZS5ub3RpZmljYXRpb25zLmNyZWF0ZSh7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6ICdiYXNpYycsXG4gICAgICAgICAgICAgICAgICAgIGljb25Vcmw6ICcvaWNvbnMvaWNvbi5wbmcnLFxuICAgICAgICAgICAgICAgICAgICB0aXRsZTogJ09wdGltaXphdGlvbiBDb21wbGV0ZScsXG4gICAgICAgICAgICAgICAgICAgIG1lc3NhZ2U6ICdZb3VyIHBlcnNvbmFsaXplZCBGU1JTIHdlaWdodHMgaGF2ZSBiZWVuIHN1Y2Nlc3NmdWxseSB0cmFpbmVkIGluIHRoZSBiYWNrZ3JvdW5kISdcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKFwiT3B0aW1pemF0aW9uIGZhaWxlZDpcIiwgZXJyKTtcbiAgICAgICAgICAgIHRoaXMuc2hvd1RvYXN0KFwiT3B0aW1pemF0aW9uIGZhaWxlZC4gU2VlIGNvbnNvbGUuXCIsIHRydWUpO1xuICAgICAgICAgICAgc3RhdHVzTXNnLnRleHRDb250ZW50ID0gXCJPcHRpbWl6YXRpb24gZmFpbGVkLlwiO1xuICAgICAgICAgICAgc3RhdHVzTXNnLnN0eWxlLmNvbG9yID0gJ3ZhcigtLW1kLWVycm9yKSc7XG4gICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICBjbGVhckludGVydmFsKGRvdEludGVydmFsKTtcbiAgICAgICAgICAgIGJ0bi50ZXh0Q29udGVudCA9ICdBdXRvIFRyYWluIFdlaWdodHMnO1xuICAgICAgICAgICAgYnRuLmRpc2FibGVkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBoYW5kbGVFeHBvcnRXZWlnaHRzKCkge1xuICAgICAgICBjb25zdCB3ZWlnaHRzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTc7IGkrKykge1xuICAgICAgICAgICAgd2VpZ2h0cy5wdXNoKHBhcnNlRmxvYXQoZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoYHdlaWdodC1pbnB1dC0ke2l9YCkudmFsdWUpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IGRhdGFTdHIgPSBcImRhdGE6dGV4dC9qc29uO2NoYXJzZXQ9dXRmLTgsXCIgKyBlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkod2VpZ2h0cykpO1xuICAgICAgICBjb25zdCBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gICAgICAgIGFuY2hvci5zZXRBdHRyaWJ1dGUoXCJocmVmXCIsIGRhdGFTdHIpO1xuICAgICAgICBhbmNob3Iuc2V0QXR0cmlidXRlKFwiZG93bmxvYWRcIiwgXCJmc3JzX3dlaWdodHNfZXhwb3J0Lmpzb25cIik7XG4gICAgICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgICAgICAgYW5jaG9yLmNsaWNrKCk7XG4gICAgICAgIGFuY2hvci5yZW1vdmUoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBMb2FkcyBjdXJyZW50IHNldHRpbmdzIGZyb20gbG9jYWwgc3RvcmFnZSBhbmQgaW5pdGlhdGVzIHJlbmRlcmluZyBvZiBwYW5lbHMuXG4gICAgICovXG4gICAgbG9hZEZTUlNDb25maWcoKSB7XG4gICAgICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ2ZzcnNHbG9iYWxQYXJhbXMnLCAnZnNyc1RvcGljV2VpZ2h0cyddLCAocmVzdWx0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBwYXJhbXMgPSByZXN1bHQuZnNyc0dsb2JhbFBhcmFtcyB8fCB7fTtcbiAgICAgICAgICAgIGNvbnN0IHdlaWdodHMgPSBwYXJhbXMudyB8fCBbLi4udGhpcy5kZWZhdWx0V2VpZ2h0c107XG4gICAgICAgICAgICBjb25zdCBkZWNheSA9IHBhcmFtcy5kZWNheSAhPT0gdW5kZWZpbmVkID8gcGFyYW1zLmRlY2F5IDogdGhpcy5kZWZhdWx0RGVjYXk7XG4gICAgICAgICAgICBjb25zdCBmYWN0b3IgPSBwYXJhbXMuZmFjdG9yICE9PSB1bmRlZmluZWQgPyBwYXJhbXMuZmFjdG9yIDogdGhpcy5kZWZhdWx0RmFjdG9yO1xuICAgICAgICAgICAgY29uc3QgcmV0ZW50aW9uID0gcGFyYW1zLnJlcXVlc3RSZXRlbnRpb24gIT09IHVuZGVmaW5lZCA/IHBhcmFtcy5yZXF1ZXN0UmV0ZW50aW9uIDogdGhpcy5kZWZhdWx0UmV0ZW50aW9uO1xuXG4gICAgICAgICAgICAvLyBTZXQgaW5wdXRzXG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmV0ZW50aW9uLXNsaWRlcicpLnZhbHVlID0gcmV0ZW50aW9uO1xuICAgICAgICAgICAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3JldGVudGlvbi12YWwnKS50ZXh0Q29udGVudCA9IGAke01hdGgucm91bmQocmV0ZW50aW9uICogMTAwKX0lYDtcbiAgICAgICAgICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZWNheS1pbnB1dCcpLnZhbHVlID0gZGVjYXk7XG4gICAgICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmFjdG9yLWlucHV0JykudmFsdWUgPSBmYWN0b3I7XG5cbiAgICAgICAgICAgIC8vIEluamVjdCB3ZWlnaHRzIGdyaWRcbiAgICAgICAgICAgIHRoaXMuaW5qZWN0V2VpZ2h0c0lucHV0cyh3ZWlnaHRzKTtcblxuICAgICAgICAgICAgLy8gUmVuZGVyIHRhZyBwcm9maWxlc1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJUYWdQcm9maWxlcyhyZXN1bHQuZnNyc1RvcGljV2VpZ2h0cyB8fCB7fSk7XG5cbiAgICAgICAgICAgIC8vIENoZWNrIG9wdGltaXphdGlvbiBlbGlnaWJpbGl0eVxuICAgICAgICAgICAgdGhpcy5jaGVja09wdGltaXphdGlvbkVsaWdpYmlsaXR5KCk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIER5bmFtaWNhbGx5IGJ1aWxkcyBIVE1MIG51bWJlciBpbnB1dCBmaWVsZHMgZm9yIHRoZSAxNyBtYXRoZW1hdGljYWwgdy13ZWlnaHRzLlxuICAgICAqIEBwYXJhbSB7bnVtYmVyW119IHdlaWdodHNBcnJheSAtIEFycmF5IG9mIGN1cnJlbnQgdy13ZWlnaHRzLlxuICAgICAqL1xuICAgIGluamVjdFdlaWdodHNJbnB1dHMod2VpZ2h0c0FycmF5KSB7XG4gICAgICAgIGNvbnN0IGNvbnRhaW5lciA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCd3ZWlnaHRzLWlucHV0cy1jb250YWluZXInKTtcbiAgICAgICAgaWYgKCFjb250YWluZXIpIHJldHVybjtcbiAgICAgICAgY29udGFpbmVyLmlubmVySFRNTCA9ICcnO1xuXG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTc7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgdmFsID0gd2VpZ2h0c0FycmF5W2ldICE9PSB1bmRlZmluZWQgPyB3ZWlnaHRzQXJyYXlbaV0gOiB0aGlzLmRlZmF1bHRXZWlnaHRzW2ldO1xuICAgICAgICAgICAgY29uc3QgaGVscFRleHQgPSB0aGlzLndlaWdodHNIZWxwW2ldO1xuICAgICAgICAgICAgY29uc3QgZGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgICAgICAgICBkaXYuY2xhc3NOYW1lID0gJ3dlaWdodC1pbnB1dC1jb250YWluZXInO1xuICAgICAgICAgICAgZGl2LmlubmVySFRNTCA9IGBcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwid2VpZ2h0LWxhYmVsLXdyYXBwZXJcIj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJ3ZWlnaHQtaW5kZXhcIj53JHtpfTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPHN2ZyBjbGFzcz1cInN2Zy1pY29uXCIgdmlld0JveD1cIjAgMCAyNCAyNFwiIHRpdGxlPVwiJHtoZWxwVGV4dH1cIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxjaXJjbGUgY3g9XCIxMlwiIGN5PVwiMTJcIiByPVwiMTBcIj48L2NpcmNsZT5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxsaW5lIHgxPVwiMTJcIiB5MT1cIjE2XCIgeDI9XCIxMlwiIHkyPVwiMTJcIj48L2xpbmU+XG4gICAgICAgICAgICAgICAgICAgICAgICA8bGluZSB4MT1cIjEyXCIgeTE9XCI4XCIgeDI9XCIxMi4wMVwiIHkyPVwiOFwiPjwvbGluZT5cbiAgICAgICAgICAgICAgICAgICAgPC9zdmc+XG4gICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJudW1iZXJcIiBzdGVwPVwiMC4wMVwiIGNsYXNzPVwid2VpZ2h0LW51bS1pbnB1dFwiIGlkPVwid2VpZ2h0LWlucHV0LSR7aX1cIiB2YWx1ZT1cIiR7dmFsfVwiPlxuICAgICAgICAgICAgYDtcbiAgICAgICAgICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChkaXYpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQ2hlY2tzIGlmIHRoZXJlJ3MgZW5vdWdoIGhpc3RvcnkgdG8gb3B0aW1pemUuXG4gICAgICovXG4gICAgY29tcHV0ZUVsaWdpYmlsaXR5KGhpc3RvcnksIHRocmVzaG9sZCA9IDEwMDApIHtcbiAgICAgICAgaWYgKCFoaXN0b3J5IHx8ICFBcnJheS5pc0FycmF5KGhpc3RvcnkpKSByZXR1cm4geyBlbGlnaWJsZTogZmFsc2UsIGNvdW50OiAwLCB0aHJlc2hvbGQgfTtcblxuICAgICAgICBsZXQgcmV2aWV3Q291bnQgPSAwO1xuICAgICAgICBsZXQgdW5pcXVlQ2FyZHMgPSBuZXcgU2V0KCk7XG5cbiAgICAgICAgaGlzdG9yeS5mb3JFYWNoKGNhcmQgPT4ge1xuICAgICAgICAgICAgaWYgKGNhcmQuaGlzdG9yeUxvZyAmJiBjYXJkLmhpc3RvcnlMb2cubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIC8vIENvdW50IGFjdHVhbCByZXZpZXdzLCBleGNsdWRpbmcgdGhlIGNyZWF0aW9uIGV2ZW50XG4gICAgICAgICAgICAgICAgcmV2aWV3Q291bnQgKz0gKGNhcmQuaGlzdG9yeUxvZy5sZW5ndGggLSAxKTtcbiAgICAgICAgICAgICAgICB1bmlxdWVDYXJkcy5hZGQoY2FyZC5pZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICBlbGlnaWJsZTogcmV2aWV3Q291bnQgPj0gdGhyZXNob2xkLFxuICAgICAgICAgICAgY291bnQ6IHJldmlld0NvdW50LFxuICAgICAgICAgICAgdW5pcXVlQ2FyZHM6IHVuaXF1ZUNhcmRzLnNpemUsXG4gICAgICAgICAgICB0aHJlc2hvbGRcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW5kZXJzIGxpc3RzIG9mIGFjdGl2ZSBjdXN0b20gdG9waWMvdGFnIEZTUlMgd2VpZ2h0cyBvdmVycmlkZXMuXG4gICAgICogQHBhcmFtIHtPYmplY3R9IHRvcGljV2VpZ2h0cyAtIEtleS12YWx1ZSBtYXAgb2YgdGFnIHRvIHdlaWdodHMgY29lZmZpY2llbnRzIGFycmF5LlxuICAgICAqL1xuICAgIHJlbmRlclRhZ1Byb2ZpbGVzKHRvcGljV2VpZ2h0cykge1xuICAgICAgICBjb25zdCBsaXN0ID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2FjdGl2ZS10YWctcHJvZmlsZXMtbGlzdCcpO1xuICAgICAgICBpZiAoIWxpc3QpIHJldHVybjtcbiAgICAgICAgbGlzdC5pbm5lckhUTUwgPSAnJztcblxuICAgICAgICBpZiAoT2JqZWN0LmtleXModG9waWNXZWlnaHRzKS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgIGxpc3QuaW5uZXJIVE1MID0gYDxsaSBzdHlsZT1cImp1c3RpZnktY29udGVudDogY2VudGVyOyBjb2xvcjogdmFyKC0tbWQtdGV4dC1sb3cpOyBmb250LXN0eWxlOiBpdGFsaWM7XCI+Tm8gY3VzdG9tIHByb2ZpbGVzIHNhdmVkIHlldC48L2xpPmA7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGNvbnN0IFt0YWcsIHdlaWdodHNdIG9mIE9iamVjdC5lbnRyaWVzKHRvcGljV2VpZ2h0cykpIHtcbiAgICAgICAgICAgIGNvbnN0IGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnbGknKTtcbiAgICAgICAgICAgIGxpLmlubmVySFRNTCA9IGBcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwicHJvZmlsZS1kZXRhaWxzXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzcz1cInByb2ZpbGUtdGFnLWJhZGdlXCI+JHt0YWd9PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3M9XCJwcm9maWxlLXdlaWdodHMtdGV4dFwiPnc6IFske3dlaWdodHMuam9pbignLCAnKX1dPC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJkZWxldGUtcHJvZmlsZS1idG5cIiBkYXRhLXRhZz1cIiR7dGFnfVwiIHRpdGxlPVwiRGVsZXRlIHRoaXMgdGFnIHdlaWdodHMgcHJvZmlsZVwiIGFyaWEtbGFiZWw9XCJEZWxldGUgdGhpcyB0YWcgd2VpZ2h0cyBwcm9maWxlXCI+XG4gICAgICAgICAgICAgICAgICAgIDxzdmcgdmlld0JveD1cIjAgMCAyNCAyNFwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZS13aWR0aD1cIjJcIj48cG9seWxpbmUgcG9pbnRzPVwiMyA2IDUgNiAyMSA2XCI+PC9wb2x5bGluZT48cGF0aCBkPVwiTTE5IDZ2MTRhMiAyIDAgMCAxLTIgMkg3YTIgMiAwIDAgMS0yLTJWNm0zIDBWNGEyIDIgMCAwIDEgMi0yaDRhMiAyIDAgMCAxIDIgMnYyXCI+PC9wYXRoPjxsaW5lIHgxPVwiMTBcIiB5MT1cIjExXCIgeDI9XCIxMFwiIHkyPVwiMTdcIj48L2xpbmU+PGxpbmUgeDE9XCIxNFwiIHkxPVwiMTFcIiB4Mj1cIjE0XCIgeTI9XCIxN1wiPjwvbGluZT48L3N2Zz5cbiAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIGA7XG4gICAgICAgICAgICBsaXN0LmFwcGVuZENoaWxkKGxpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIExpbmsgZGVsZXRlIGJ1dHRvbnNcbiAgICAgICAgbGlzdC5xdWVyeVNlbGVjdG9yQWxsKCcuZGVsZXRlLXByb2ZpbGUtYnRuJykuZm9yRWFjaChidG4gPT4ge1xuICAgICAgICAgICAgYnRuLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgKGUpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBidXR0b24gPSBlLmN1cnJlbnRUYXJnZXQ7XG4gICAgICAgICAgICAgICAgY29uc3QgdGFnID0gYnV0dG9uLmdldEF0dHJpYnV0ZSgnZGF0YS10YWcnKTtcbiAgICAgICAgICAgICAgICB0aGlzLmhhbmRsZURlbGV0ZVRhZ1Byb2ZpbGUodGFnKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBWYWxpZGF0ZXMgYW5kIHNhdmVzIGdsb2JhbCBGU1JTIGNvbmZpZ3VyYXRpb24gcGFyYW1ldGVycyBiYWNrIHRvIHN0b3JhZ2UuXG4gICAgICovXG4gICAgc2F2ZUdsb2JhbENvbmZpZygpIHtcbiAgICAgICAgY29uc3QgcmV0ZW50aW9uID0gcGFyc2VGbG9hdChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgncmV0ZW50aW9uLXNsaWRlcicpLnZhbHVlKTtcbiAgICAgICAgY29uc3QgZGVjYXkgPSBwYXJzZUZsb2F0KGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdkZWNheS1pbnB1dCcpLnZhbHVlKTtcbiAgICAgICAgY29uc3QgZmFjdG9yID0gcGFyc2VGbG9hdChkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZmFjdG9yLWlucHV0JykudmFsdWUpO1xuXG4gICAgICAgIGlmIChpc05hTihkZWNheSkgfHwgaXNOYU4oZmFjdG9yKSkge1xuICAgICAgICAgICAgdGhpcy5zaG93VG9hc3QoXCJEZWNheSBhbmQgRmFjdG9yIG11c3QgYmUgdmFsaWQgbnVtYmVycy5cIiwgdHJ1ZSk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBjb25zdCB3ZWlnaHRzID0gW107XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgMTc7IGkrKykge1xuICAgICAgICAgICAgY29uc3QgdmFsID0gcGFyc2VGbG9hdChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChgd2VpZ2h0LWlucHV0LSR7aX1gKS52YWx1ZSk7XG4gICAgICAgICAgICBpZiAoaXNOYU4odmFsKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuc2hvd1RvYXN0KGB3JHtpfSBtdXN0IGJlIGEgdmFsaWQgbnVtYmVyLmAsIHRydWUpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHdlaWdodHMucHVzaCh2YWwpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3QgbmV3UGFyYW1zID0ge1xuICAgICAgICAgICAgdzogd2VpZ2h0cyxcbiAgICAgICAgICAgIGRlY2F5LFxuICAgICAgICAgICAgZmFjdG9yLFxuICAgICAgICAgICAgcmVxdWVzdFJldGVudGlvbjogcmV0ZW50aW9uXG4gICAgICAgIH07XG5cbiAgICAgICAgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHsgZnNyc0dsb2JhbFBhcmFtczogbmV3UGFyYW1zIH0sICgpID0+IHtcbiAgICAgICAgICAgIHRoaXMuc2hvd1RvYXN0KFwiRlNSUyBnbG9iYWwgY29uZmlndXJhdGlvbnMgc2F2ZWQhXCIpO1xuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN0b3JlcyBhbGwgZ2xvYmFsIHBhcmFtZXRlcnMgdG8gYWxnb3JpdGhtaWMgYmFzZWxpbmUgZGVmYXVsdHMuXG4gICAgICovXG4gICAgcmVzdG9yZURlZmF1bHRzKCkge1xuICAgICAgICBpZiAoY29uZmlybShcIlJlc3RvcmUgQUxMIHBhcmFtZXRlcnMsIG9wdGltaXphdGlvbiBzdGF0dXMsIGFuZCBjb2VmZmljaWVudHMgdG8gc3RhbmRhcmQgZGVmYXVsdCB2YWx1ZXM/XCIpKSB7XG4gICAgICAgICAgICBjb25zdCBuZXdQYXJhbXMgPSB7XG4gICAgICAgICAgICAgICAgdzogWy4uLnRoaXMuZGVmYXVsdFdlaWdodHNdLFxuICAgICAgICAgICAgICAgIGRlY2F5OiB0aGlzLmRlZmF1bHREZWNheSxcbiAgICAgICAgICAgICAgICBmYWN0b3I6IHRoaXMuZGVmYXVsdEZhY3RvcixcbiAgICAgICAgICAgICAgICByZXF1ZXN0UmV0ZW50aW9uOiB0aGlzLmRlZmF1bHRSZXRlbnRpb25cbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IGZzcnNHbG9iYWxQYXJhbXM6IG5ld1BhcmFtcyB9LCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgdGhyZXNob2xkSW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3B0LXRocmVzaG9sZC1pbnB1dCcpO1xuICAgICAgICAgICAgICAgIGlmICh0aHJlc2hvbGRJbnB1dCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJlc2hvbGRJbnB1dC52YWx1ZSA9IDEwMDA7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IGRpc3BsYXkgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnb3B0LXRocmVzaG9sZC1kaXNwbGF5Jyk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkaXNwbGF5KSBkaXNwbGF5LnRleHRDb250ZW50ID0gJzEwMDAnO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIHRoaXMubG9hZEZTUlNDb25maWcoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dUb2FzdChcIlJlc3RvcmVkIGFsbCBGU1JTIGRlZmF1bHRzLlwiKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVzdG9yZXMgb25seSB0aGUgZ2xvYmFsIHBhcmFtZXRlcnMgKHJldGVudGlvbiwgZGVjYXksIGZhY3RvcikuXG4gICAgICovXG4gICAgcmVzdG9yZUdsb2JhbFBhcmFtZXRlcnMoKSB7XG4gICAgICAgIGlmIChjb25maXJtKFwiUmVzZXQgR2xvYmFsIFBhcmFtZXRlcnMgdG8gc3RhbmRhcmQgZGVmYXVsdHM/XCIpKSB7XG4gICAgICAgICAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoWydmc3JzR2xvYmFsUGFyYW1zJ10sIChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJhbXMgPSByZXN1bHQuZnNyc0dsb2JhbFBhcmFtcyB8fCB7fTtcbiAgICAgICAgICAgICAgICBwYXJhbXMucmVxdWVzdFJldGVudGlvbiA9IHRoaXMuZGVmYXVsdFJldGVudGlvbjtcbiAgICAgICAgICAgICAgICBwYXJhbXMuZGVjYXkgPSB0aGlzLmRlZmF1bHREZWNheTtcbiAgICAgICAgICAgICAgICBwYXJhbXMuZmFjdG9yID0gdGhpcy5kZWZhdWx0RmFjdG9yO1xuICAgICAgICAgICAgICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLnNldCh7IGZzcnNHbG9iYWxQYXJhbXM6IHBhcmFtcyB9LCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubG9hZEZTUlNDb25maWcoKTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5zaG93VG9hc3QoXCJHbG9iYWwgcGFyYW1ldGVycyByZXNldC5cIik7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlc2V0cyBvcHRpbWl6YXRpb24gc3RhdHVzIChyZW1vdmVzIHBlcnNvbmFsaXplZCB0YWcgYW5kIHRpbWVzdGFtcCkuXG4gICAgICovXG4gICAgcmVzZXRPcHRpbWl6YXRpb24oKSB7XG4gICAgICAgIGlmIChjb25maXJtKFwiUmVzZXQgUGVyc29uYWwgTWVtb3J5IE9wdGltaXphdGlvbiBzdGF0dXM/XCIpKSB7XG4gICAgICAgICAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoWydmc3JzR2xvYmFsUGFyYW1zJ10sIChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJhbXMgPSByZXN1bHQuZnNyc0dsb2JhbFBhcmFtcyB8fCB7fTtcbiAgICAgICAgICAgICAgICBkZWxldGUgcGFyYW1zLnZlcnNpb247XG4gICAgICAgICAgICAgICAgZGVsZXRlIHBhcmFtcy50aW1lc3RhbXA7XG4gICAgICAgICAgICAgICAgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHsgZnNyc0dsb2JhbFBhcmFtczogcGFyYW1zIH0sICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5sb2FkRlNSU0NvbmZpZygpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLnNob3dUb2FzdChcIk9wdGltaXphdGlvbiBzdGF0dXMgcmVzZXQuXCIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXN0b3JlcyBvbmx5IHRoZSBGU1JTIGNvZWZmaWNpZW50cyAodzAtdzE2KS5cbiAgICAgKi9cbiAgICByZXN0b3JlV2VpZ2h0cygpIHtcbiAgICAgICAgaWYgKGNvbmZpcm0oXCJSZXNldCBGU1JTIENvZWZmaWNpZW50cyB0byBkZWZhdWx0IHdlaWdodHM/XCIpKSB7XG4gICAgICAgICAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5nZXQoWydmc3JzR2xvYmFsUGFyYW1zJ10sIChyZXN1bHQpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBwYXJhbXMgPSByZXN1bHQuZnNyc0dsb2JhbFBhcmFtcyB8fCB7fTtcbiAgICAgICAgICAgICAgICBwYXJhbXMudyA9IFsuLi50aGlzLmRlZmF1bHRXZWlnaHRzXTtcbiAgICAgICAgICAgICAgICBjaHJvbWUuc3RvcmFnZS5sb2NhbC5zZXQoeyBmc3JzR2xvYmFsUGFyYW1zOiBwYXJhbXMgfSwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLmxvYWRGU1JTQ29uZmlnKCk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuc2hvd1RvYXN0KFwiRlNSUyBjb2VmZmljaWVudHMgcmVzZXQuXCIpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBWYWxpZGF0ZXMgaW5wdXRzIGFuZCBiaW5kcyBhIG5ldyAxNy1jb2VmZmljaWVudCBjdXN0b20gcHJvZmlsZSB0byBhIHNwZWNpZmljIHRhZyBmaWx0ZXIuXG4gICAgICovXG4gICAgaGFuZGxlQWRkVGFnUHJvZmlsZSgpIHtcbiAgICAgICAgY29uc3QgdGFnSW5wdXQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbmV3LXRhZy1uYW1lJyk7XG4gICAgICAgIGNvbnN0IHdlaWdodHNJbnB1dCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCduZXctdGFnLXdlaWdodHMnKTtcblxuICAgICAgICBjb25zdCB0YWcgPSB0YWdJbnB1dC52YWx1ZS50cmltKCk7XG4gICAgICAgIGNvbnN0IHdlaWdodHNTdHIgPSB3ZWlnaHRzSW5wdXQudmFsdWUudHJpbSgpO1xuXG4gICAgICAgIGlmICghdGFnIHx8ICF3ZWlnaHRzU3RyKSB7XG4gICAgICAgICAgICB0aGlzLnNob3dUb2FzdChcIlRhZyBuYW1lIGFuZCB3ZWlnaHRzIHZhbHVlcyBhcmUgcmVxdWlyZWQuXCIsIHRydWUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd2VpZ2h0c0FycmF5ID0gd2VpZ2h0c1N0ci5zcGxpdCgnLCcpLm1hcCh2ID0+IHBhcnNlRmxvYXQodi50cmltKCkpKS5maWx0ZXIodiA9PiAhaXNOYU4odikpO1xuICAgICAgICBpZiAod2VpZ2h0c0FycmF5Lmxlbmd0aCAhPT0gMTcpIHtcbiAgICAgICAgICAgIHRoaXMuc2hvd1RvYXN0KGBXZWlnaHRzIG11c3QgY29udGFpbiBleGFjdGx5IDE3IGNvZWZmaWNpZW50cy4gRm91bmQgJHt3ZWlnaHRzQXJyYXkubGVuZ3RofS5gLCB0cnVlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNocm9tZS5zdG9yYWdlLmxvY2FsLmdldChbJ2ZzcnNUb3BpY1dlaWdodHMnXSwgKHJlc3VsdCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgdG9waWNXZWlnaHRzID0gcmVzdWx0LmZzcnNUb3BpY1dlaWdodHMgfHwge307XG4gICAgICAgICAgICB0b3BpY1dlaWdodHNbdGFnXSA9IHdlaWdodHNBcnJheTtcblxuICAgICAgICAgICAgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHsgZnNyc1RvcGljV2VpZ2h0czogdG9waWNXZWlnaHRzIH0sICgpID0+IHtcbiAgICAgICAgICAgICAgICB0YWdJbnB1dC52YWx1ZSA9ICcnO1xuICAgICAgICAgICAgICAgIHdlaWdodHNJbnB1dC52YWx1ZSA9ICcnO1xuICAgICAgICAgICAgICAgIHRoaXMubG9hZEZTUlNDb25maWcoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnNob3dUb2FzdChgQ3VzdG9tIHByb2ZpbGUgc2F2ZWQgZm9yIHRhZzogJHt0YWd9YCk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRGVsZXRlcyBjdXN0b20gdGFnIHByb2ZpbGUgYmluZGluZ3MgZnJvbSBkYXRhYmFzZSBzdG9yYWdlLlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0YWcgLSBUYXJnZXQgdGFnIG5hbWUuXG4gICAgICovXG4gICAgaGFuZGxlRGVsZXRlVGFnUHJvZmlsZSh0YWcpIHtcbiAgICAgICAgY2hyb21lLnN0b3JhZ2UubG9jYWwuZ2V0KFsnZnNyc1RvcGljV2VpZ2h0cyddLCAocmVzdWx0KSA9PiB7XG4gICAgICAgICAgICBjb25zdCB0b3BpY1dlaWdodHMgPSByZXN1bHQuZnNyc1RvcGljV2VpZ2h0cyB8fCB7fTtcbiAgICAgICAgICAgIGRlbGV0ZSB0b3BpY1dlaWdodHNbdGFnXTtcblxuICAgICAgICAgICAgY2hyb21lLnN0b3JhZ2UubG9jYWwuc2V0KHsgZnNyc1RvcGljV2VpZ2h0czogdG9waWNXZWlnaHRzIH0sICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLmxvYWRGU1JTQ29uZmlnKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5zaG93VG9hc3QoYERlbGV0ZWQgRlNSUyBwcm9maWxlIGZvciB0YWc6ICR7dGFnfWApO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyaWdnZXJzIGEgc3RhdHVzIHRvYXN0IGVsZW1lbnQuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG1zZyAtIE1lc3NhZ2UuXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbaXNFcnJvcj1mYWxzZV0gLSBTaWduYWxzIGlmIHRoZSBzdGF0dXMgaW5kaWNhdGVzIGFuIGVycm9yLlxuICAgICAqL1xuICAgIHNob3dUb2FzdChtc2csIGlzRXJyb3IgPSBmYWxzZSkge1xuICAgICAgICBjb25zdCB0b2FzdCA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdzdGF0dXMtdG9hc3QnKTtcbiAgICAgICAgaWYgKCF0b2FzdCkgcmV0dXJuO1xuICAgICAgICB0b2FzdC50ZXh0Q29udGVudCA9IG1zZztcbiAgICAgICAgdG9hc3QuY2xhc3NOYW1lID0gJ3RvYXN0IHNob3cgJyArIChpc0Vycm9yID8gJ2Vycm9yJyA6ICdzdWNjZXNzJyk7XG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgdG9hc3QuY2xhc3NOYW1lID0gJ3RvYXN0JztcbiAgICAgICAgfSwgMjUwMCk7XG4gICAgfVxufVxuXG5kb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdET01Db250ZW50TG9hZGVkJywgKCkgPT4ge1xuICAgIGNvbnN0IGNvbmZpZ01hbmFnZXIgPSBuZXcgRlNSU0NvbmZpZ01hbmFnZXIoKTtcbiAgICBjb25maWdNYW5hZ2VyLmluaXQoKTtcbn0pO1xuIl0sIm5hbWVzIjpbXSwic291cmNlUm9vdCI6IiJ9