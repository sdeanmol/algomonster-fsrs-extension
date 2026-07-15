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

        // Reset defaults
        document.getElementById('reset-defaults-btn').addEventListener('click', () => this.restoreDefaults());

        // Add tag profile
        document.getElementById('add-tag-profile-btn').addEventListener('click', () => this.handleAddTagProfile());
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
     * Restores global parameters to algorithmic baseline defaults.
     */
    restoreDefaults() {
        if (confirm("Restore all FSRS parameters and coefficients to standard default values?")) {
            const newParams = {
                w: [...this.defaultWeights],
                decay: this.defaultDecay,
                factor: this.defaultFactor,
                requestRetention: this.defaultRetention
            };

            chrome.storage.local.set({ fsrsGlobalParams: newParams }, () => {
                this.loadFSRSConfig();
                this.showToast("Restored standard FSRS defaults.");
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
