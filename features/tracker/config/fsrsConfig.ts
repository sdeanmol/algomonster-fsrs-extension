/**
 * @file features/tracker/config/fsrsConfig.ts
 * @description Manages configuration preferences for the Free Spaced Repetition Scheduler (FSRS).
 * Allows customized requests retention sliders, custom coefficients weights (17 parameters w0-w16),
 * and custom per-topic profiles mapped directly to tags.
 */

import FsrsOptimizer from '../scheduler/fsrsOptimizer';
import FsrsOptimizerFast from '../scheduler/fsrsOptimizerFast';
import { Card, FSRSParameters, StorageData } from '../../../types/domain';
import { Logger } from '@common/logger';

export interface WeightHelpDetail {
    title: string;
    purpose: string;
    significance: string;
}

export interface EligibilityResult {
    eligible: boolean;
    count: number;
    uniqueCards?: number;
    threshold: number;
}

export class FSRSConfigManager {
    public defaultWeights: number[];
    public defaultDecay: number;
    public defaultFactor: number;
    public defaultRetention: number;
    public weightsHelpDetails: WeightHelpDetail[];
    public weightsHelp: string[];

    constructor() {
        this.defaultWeights = [0.4, 0.6, 2.4, 5.8, 4.93, 0.94, 0.86, 0.01, 1.49, 0.14, 0.94, 2.18, 0.05, 0.34, 1.26, 0.29, 2.61];
        this.defaultDecay = -0.5;
        this.defaultFactor = 0.234567;
        this.defaultRetention = 0.90;

        this.weightsHelpDetails = [
            {
                title: "Initial Stability (Again)",
                purpose: "Sets the initial memory stability (in days) when a brand-new card is rated 'Again' (1).",
                significance: "Determines how soon a new card must be re-tested after a failed first attempt. Smaller values schedule near-immediate reviews."
            },
            {
                title: "Initial Stability (Hard)",
                purpose: "Sets the initial memory stability (in days) when a brand-new card is rated 'Hard' (2).",
                significance: "Establishes the starting interval for new material that was difficult to recall. Higher values increase initial spacing."
            },
            {
                title: "Initial Stability (Good)",
                purpose: "Sets the initial memory stability (in days) when a brand-new card is rated 'Good' (3).",
                significance: "Defines the standard baseline interval for successful first-time reviews of average difficulty material."
            },
            {
                title: "Initial Stability (Easy)",
                purpose: "Sets the initial memory stability (in days) when a brand-new card is rated 'Easy' (4).",
                significance: "Gives effortless new cards a larger initial review gap, preventing unnecessary early over-testing."
            },
            {
                title: "Initial Difficulty (Baseline)",
                purpose: "Sets the baseline difficulty score (on a 1-10 scale) assigned to new cards upon first review.",
                significance: "Serves as the difficulty anchor; higher baseline difficulty slows down future stability gains across subsequent reviews."
            },
            {
                title: "Difficulty Rating Step",
                purpose: "Scales how much card difficulty increases or decreases based on user performance ratings.",
                significance: "Controls sensitivity to review ratings. Higher values cause difficulty to react more aggressively to 'Again' or 'Hard' ratings."
            },
            {
                title: "Difficulty Mean Reversion",
                purpose: "Applies mean reversion to gradually pull card difficulty back toward average over time.",
                significance: "Prevents card difficulty from getting permanently stuck at extreme values (1 or 10) after temporary performance spikes or lapses."
            },
            {
                title: "Difficulty Fuzz / Modifier",
                purpose: "Modifies the interaction between card difficulty and stability growth during successful recalls.",
                significance: "Fine-tunes interval growth rates specifically for moderately hard versus moderately easy cards."
            },
            {
                title: "Recall Stability Base Multiplier",
                purpose: "Controls the base exponential growth factor of memory stability upon successful recall.",
                significance: "Main engine for interval expansion. Higher values cause review intervals to lengthen much faster after successful reviews."
            },
            {
                title: "Recall Stability Retrievability Sensitivity",
                purpose: "Adjusts stability increase based on retrievability (recall probability) at the moment of review.",
                significance: "Rewards 'desirable difficulty': reviewing a card just before forgetting yields a substantially higher stability boost."
            },
            {
                title: "Recall Stability Difficulty Dampening",
                purpose: "Dampens stability expansion for high-difficulty cards during successful recalls.",
                significance: "Ensures inherently difficult material maintains shorter intervals than easy material even when successfully recalled."
            },
            {
                title: "Recall Stability Delay Bonus",
                purpose: "Modifies stability gains when a card is successfully recalled past its scheduled due date.",
                significance: "Grants extra stability credit for overdue reviews, recognizing successful long-term retention under delay."
            },
            {
                title: "Lapse Stability Base Penalty",
                purpose: "Controls the initial post-lapse stability reduction multiplier when a card is forgotten ('Again').",
                significance: "Determines how sharply interval lengths collapse after a lapse. Lower values cause larger drops in stability."
            },
            {
                title: "Lapse Stability Difficulty Scaling",
                purpose: "Scales post-lapse stability reduction based on the card's current difficulty rating.",
                significance: "Harder cards suffer a harsher stability penalty when forgotten, requiring more frequent reviews to rebuild stability."
            },
            {
                title: "Lapse Stability Memory Trace",
                purpose: "Accounts for prior stability strength when recalculating stability after a lapse.",
                significance: "Cards forgotten after achieving high historical stability recover faster than cards forgotten early in their lifecycle."
            },
            {
                title: "Easy Rating Stability Bonus",
                purpose: "Applies an additional multiplicative stability boost when rating a review card 'Easy' (4).",
                significance: "Directly expands the next interval length when material is rated effortless, reducing workload for mastered concepts."
            },
            {
                title: "Hard Rating Stability Damping",
                purpose: "Applies a stability damping factor when rating a review card 'Hard' (2).",
                significance: "Restricts interval growth on difficult reviews, ensuring struggling cards reappear sooner for reinforcement."
            }
        ];

        this.weightsHelp = this.weightsHelpDetails.map((detail, i) => `w${i}: ${detail.title} - ${detail.purpose}`);
    }

    /**
     * Initializes elements and binds click listeners.
     */
    init(): void {
        try {
            this.loadFSRSConfig();
            this.bindEvents();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to initialize FSRSConfigManager: ${errorMessage}`, { err });
            // Comment: Catch top-level init failure gracefully
        }
    }

    /**
     * Registers control listeners for UI inputs.
     */
    bindEvents(): void {
        try {
            const backBtn = document.getElementById('back-to-popup-btn');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    window.close();
                });
            }

            const slider = document.getElementById('retention-slider') as HTMLInputElement | null;
            const badge = document.getElementById('retention-val');
            if (slider && badge) {
                slider.addEventListener('input', (e: Event) => {
                    const target = e.target as HTMLInputElement;
                    badge.textContent = `${Math.round(parseFloat(target.value) * 100)}%`;
                });
            }

            const saveGlobalBtn = document.getElementById('save-global-btn');
            if (saveGlobalBtn) saveGlobalBtn.addEventListener('click', () => this.saveGlobalConfig());

            const resetGlobalBtn = document.getElementById('reset-global-btn');
            if (resetGlobalBtn) resetGlobalBtn.addEventListener('click', () => this.restoreGlobalParameters());

            const resetOptBtn = document.getElementById('reset-opt-btn');
            if (resetOptBtn) resetOptBtn.addEventListener('click', () => this.resetOptimization());

            const resetWeightsBtn = document.getElementById('reset-weights-btn');
            if (resetWeightsBtn) resetWeightsBtn.addEventListener('click', () => this.restoreWeights());

            const resetAllBtn = document.getElementById('reset-all-btn');
            if (resetAllBtn) resetAllBtn.addEventListener('click', () => this.restoreDefaults());

            const addTagProfileBtn = document.getElementById('add-tag-profile-btn');
            if (addTagProfileBtn) addTagProfileBtn.addEventListener('click', () => this.handleAddTagProfile());

            const thresholdInput = document.getElementById('opt-threshold-input') as HTMLInputElement | null;
            if (thresholdInput) {
                thresholdInput.addEventListener('change', () => {
                    const display = document.getElementById('opt-threshold-display');
                    if (display) display.textContent = thresholdInput.value;
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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to bind UI events: ${errorMessage}`, { err });
            // Comment: Catch DOM event listener attachment errors
        }
    }

    /**
     * Checks history to see if enough reviews exist to unlock optimization.
     */
    async checkOptimizationEligibility(): Promise<void> {
        try {
            const result: { fsrsCards?: Card[] } = await new Promise(r => chrome.storage.local.get(['fsrsCards'], r));
            const historyArray = result.fsrsCards || [];

            const thresholdInput = document.getElementById('opt-threshold-input') as HTMLInputElement | null;
            const threshold = parseInt(thresholdInput ? thresholdInput.value : '1000', 10) || 1000;

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
            if (progressFill) progressFill.style.width = `${percentage}%`;
            if (progressText) progressText.textContent = `${eligibility.count} / ${threshold} Reviews`;

            if (statusMsg && progressFill && actionsSection) {
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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error checking optimization eligibility: ${errorMessage}`, { err });
            // Comment: Non-fatal optimization check error
        }
    }

    /**
     * Executes the Auto Train weights workflow.
     */
    async handleAutoTrain(): Promise<void> {
        const btn = document.getElementById('btn-auto-train') as HTMLButtonElement | null;
        const statusMsg = document.getElementById('opt-status-msg');

        if (!btn || !statusMsg) return;

        btn.innerHTML = 'Training<span id="train-dots" style="display:inline-block; width:1.2em; text-align:left;">...</span>';
        btn.disabled = true;

        statusMsg.textContent = 'Training in progress... This can take up to 5 minutes for very large histories. Please keep this tab open.';
        statusMsg.style.color = 'var(--md-primary)';

        let dotCount = 0;
        const dotInterval = setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            const dots = document.getElementById('train-dots');
            if (dots) dots.textContent = '.'.repeat(dotCount);
        }, 500);

        try {
            const result: { fsrsCards?: Card[] } = await new Promise(r => chrome.storage.local.get(['fsrsCards'], r));
            const historyArray = result.fsrsCards || [];

            const currentWeights: number[] = [];
            for (let i = 0; i < 17; i++) {
                const input = document.getElementById(`weight-input-${i}`) as HTMLInputElement | null;
                currentWeights.push(input ? parseFloat(input.value) : this.defaultWeights[i]);
            }
            const retentionSlider = document.getElementById('retention-slider') as HTMLInputElement | null;
            const targetRetention = parseFloat(retentionSlider ? retentionSlider.value : '0.90') || 0.90;

            let optimizedWeights: number[];
            const onProgress = (current: number, total: number) => {
                Logger.debug('FSRS', `Progress callback fired: ${current}/${total}`, { current, total });
            };

            try {
                const optimizer = new FsrsOptimizer();
                optimizedWeights = await optimizer.trainWeights(historyArray, currentWeights, targetRetention, onProgress);
            } catch (wasmError) {
                const wasmErrMsg = wasmError instanceof Error ? wasmError.message : String(wasmError);
                Logger.warn("FSRS", `WASM Optimizer failed (${wasmErrMsg}). Falling back to Fast JS Optimizer.`, { wasmError });
                const fastOptimizer = new FsrsOptimizerFast();
                optimizedWeights = await fastOptimizer.trainWeights(historyArray, currentWeights, targetRetention, onProgress);
            }

            this.injectWeightsInputs(optimizedWeights);

            const newParams: FSRSParameters = {
                w: optimizedWeights,
                decay: parseFloat((document.getElementById('decay-input') as HTMLInputElement)?.value) || this.defaultDecay,
                factor: parseFloat((document.getElementById('factor-input') as HTMLInputElement)?.value) || this.defaultFactor,
                requestRetention: targetRetention,
                version: 'personalized',
                timestamp: Date.now()
            };

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                await new Promise<void>(r => chrome.storage.local.set({ fsrsGlobalParams: newParams }, () => r()));
            }

            this.showToast("Personal memory optimization successful!", false);

            statusMsg.textContent = "Scheduler optimized successfully using your personal history!";
            statusMsg.style.color = 'var(--md-primary)';

            if (typeof chrome !== 'undefined' && chrome.notifications) {
                chrome.notifications.create({
                    type: 'basic',
                    iconUrl: '/icons/icon.png',
                    title: 'Optimization Complete',
                    message: 'Your personalized FSRS weights have been successfully trained in the background!'
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error("FSRS", `Optimization failed: ${errorMessage}`, { err });
            this.showToast("Optimization failed. See console.", true);
            statusMsg.textContent = "Optimization failed.";
            statusMsg.style.color = 'var(--md-error)';
        } finally {
            // Comment: Always clear progress dots interval and restore button state
            clearInterval(dotInterval);
            btn.textContent = 'Auto Train Weights';
            btn.disabled = false;
        }
    }

    handleExportWeights(): void {
        try {
            const weights: number[] = [];
            for (let i = 0; i < 17; i++) {
                const input = document.getElementById(`weight-input-${i}`) as HTMLInputElement | null;
                weights.push(input ? parseFloat(input.value) : this.defaultWeights[i]);
            }

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(weights));
            const anchor = document.createElement('a');
            anchor.setAttribute("href", dataStr);
            anchor.setAttribute("download", "fsrs_weights_export.json");
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to export weights: ${errorMessage}`, { err });
            // Comment: Catch export failure gracefully
        }
    }

    /**
     * Loads current settings from local storage and initiates rendering of panels.
     */
    loadFSRSConfig(): void {
        try {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local) return;
            chrome.storage.local.get(['fsrsGlobalParams', 'fsrsTopicWeights'], (result: { fsrsGlobalParams?: FSRSParameters; fsrsTopicWeights?: Record<string, number[]> }) => {
                try {
                    const params = result.fsrsGlobalParams || { w: this.defaultWeights, decay: this.defaultDecay, factor: this.defaultFactor, requestRetention: this.defaultRetention };
                    const weights: number[] = params.w || [...this.defaultWeights];
                    const decay: number = params.decay !== undefined ? params.decay : this.defaultDecay;
                    const factor: number = params.factor !== undefined ? params.factor : this.defaultFactor;
                    const retention: number = params.requestRetention !== undefined ? params.requestRetention : this.defaultRetention;

                    const slider = document.getElementById('retention-slider') as HTMLInputElement | null;
                    const badge = document.getElementById('retention-val');
                    const decayInput = document.getElementById('decay-input') as HTMLInputElement | null;
                    const factorInput = document.getElementById('factor-input') as HTMLInputElement | null;

                    if (slider) slider.value = retention.toString();
                    if (badge) badge.textContent = `${Math.round(retention * 100)}%`;
                    if (decayInput) decayInput.value = decay.toString();
                    if (factorInput) factorInput.value = factor.toString();

                    this.injectWeightsInputs(weights);
                    this.renderTagProfiles(result.fsrsTopicWeights || {});
                    this.checkOptimizationEligibility();
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('FSRSConfig', `Error parsing loaded FSRS config: ${errorMessage}`, { innerErr });
                    // Comment: Non-fatal FSRS config panel rendering error
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to load FSRS config from storage: ${errorMessage}`, { err });
            // Comment: Catch storage retrieval failure gracefully
        }
    }

    /**
     * Dynamically builds HTML number input fields for the 17 mathematical w-weights.
     */
    injectWeightsInputs(weightsArray: number[]): void {
        try {
            const container = document.getElementById('weights-inputs-container');
            if (!container) return;
            container.innerHTML = '';

            for (let i = 0; i < 17; i++) {
                const val = weightsArray[i] !== undefined ? weightsArray[i] : this.defaultWeights[i];
                const detail = this.weightsHelpDetails[i] || {
                    title: `Weight w${i}`,
                    purpose: this.weightsHelp[i] || `Coefficient w${i}`,
                    significance: "Scales memory stability update."
                };
                const div = document.createElement('div');
                div.className = 'weight-input-container';
                div.innerHTML = `
                    <div class="weight-label-wrapper">
                        <span class="weight-index">w${i}</span>
                        <div class="weight-info-trigger-wrapper" tabindex="0" aria-label="Information for w${i}">
                            <svg class="svg-icon weight-info-trigger" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="16" x2="12"></line>
                                <line x1="12" y1="8" x2="12.01" y2="8"></line>
                            </svg>
                            <div class="weight-tooltip" role="tooltip">
                                <div class="weight-tooltip-header">
                                    <span class="weight-tooltip-badge">w${i}</span>
                                    <span class="weight-tooltip-title">${detail.title}</span>
                                </div>
                                <div class="weight-tooltip-body">
                                    <div class="weight-tooltip-section">
                                        <span class="weight-tooltip-label">🎯 Purpose</span>
                                        <p class="weight-tooltip-text">${detail.purpose}</p>
                                    </div>
                                    <div class="weight-tooltip-section">
                                        <span class="weight-tooltip-label">💡 Significance</span>
                                        <p class="weight-tooltip-text">${detail.significance}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <input type="number" step="0.01" class="weight-num-input" id="weight-input-${i}" value="${val}">
                `;
                container.appendChild(div);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to inject weight inputs: ${errorMessage}`, { err });
            // Comment: Catch DOM generation error gracefully
        }
    }

    /**
     * Checks if there's enough history to optimize.
     */
    computeEligibility(history: Card[], threshold: number = 1000): EligibilityResult {
        try {
            if (!history || !Array.isArray(history)) return { eligible: false, count: 0, threshold };

            let reviewCount = 0;
            const uniqueCards = new Set<string>();

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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error computing eligibility: ${errorMessage}`, { err });
            // Comment: Return safe ineligible fallback on error
            return { eligible: false, count: 0, threshold };
        }
    }

    /**
     * Renders lists of active custom topic/tag FSRS weights overrides.
     */
    renderTagProfiles(topicWeights: { [tag: string]: number[] }): void {
        try {
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

            list.querySelectorAll('.delete-profile-btn').forEach(btn => {
                btn.addEventListener('click', (e: Event) => {
                    const button = e.currentTarget as HTMLElement;
                    const tag = button.getAttribute('data-tag');
                    if (tag) this.handleDeleteTagProfile(tag);
                });
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to render tag profiles: ${errorMessage}`, { err });
            // Comment: Catch DOM tag profile list rendering error
        }
    }

    /**
     * Validates and saves global FSRS configuration parameters back to storage.
     */
    saveGlobalConfig(): void {
        try {
            const slider = document.getElementById('retention-slider') as HTMLInputElement | null;
            const decayInput = document.getElementById('decay-input') as HTMLInputElement | null;
            const factorInput = document.getElementById('factor-input') as HTMLInputElement | null;

            const retention = slider ? parseFloat(slider.value) : this.defaultRetention;
            const decay = decayInput ? parseFloat(decayInput.value) : this.defaultDecay;
            const factor = factorInput ? parseFloat(factorInput.value) : this.defaultFactor;

            if (isNaN(decay) || isNaN(factor)) {
                this.showToast("Decay and Factor must be valid numbers.", true);
                return;
            }

            const weights: number[] = [];
            for (let i = 0; i < 17; i++) {
                const input = document.getElementById(`weight-input-${i}`) as HTMLInputElement | null;
                const val = input ? parseFloat(input.value) : NaN;
                if (isNaN(val)) {
                    this.showToast(`w${i} must be a valid number.`, true);
                    return;
                }
                weights.push(val);
            }

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['fsrsGlobalParams'], (result: { fsrsGlobalParams?: FSRSParameters }) => {
                    if (chrome.runtime?.lastError) {
                        Logger.error('FSRSConfig', `Storage get error in saveGlobalConfig: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    const existing = result.fsrsGlobalParams || {};
                    const newParams: FSRSParameters = {
                        ...existing,
                        w: weights,
                        decay,
                        factor,
                        requestRetention: retention
                    };

                    chrome.storage.local.set({ fsrsGlobalParams: newParams }, () => {
                        if (chrome.runtime?.lastError) {
                            Logger.error('FSRSConfig', `Storage set error in saveGlobalConfig: ${chrome.runtime.lastError.message}`, { error: chrome.runtime.lastError });
                        }
                        this.showToast("FSRS global configurations saved!");
                    });
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to save global config: ${errorMessage}`, { err });
            // Comment: Recover gracefully by informing user via toast message
            this.showToast("Failed to save global config.", true);
        }
    }

    /**
     * Restores all global parameters to algorithmic baseline defaults.
     */
    restoreDefaults(): void {
        try {
            if (confirm("Restore ALL parameters, optimization status, and coefficients to standard default values?")) {
                const newParams: FSRSParameters = {
                    w: [...this.defaultWeights],
                    decay: this.defaultDecay,
                    factor: this.defaultFactor,
                    requestRetention: this.defaultRetention
                };

                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.set({ fsrsGlobalParams: newParams }, () => {
                        const thresholdInput = document.getElementById('opt-threshold-input') as HTMLInputElement | null;
                        if (thresholdInput) {
                            thresholdInput.value = '1000';
                            const display = document.getElementById('opt-threshold-display');
                            if (display) display.textContent = '1000';
                        }

                        this.loadFSRSConfig();
                        this.showToast("Restored all FSRS defaults.");
                    });
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error restoring defaults: ${errorMessage}`, { err });
            // Comment: Catch default restoration error gracefully
        }
    }

    /**
     * Restores only the global parameters (retention, decay, factor).
     */
    restoreGlobalParameters(): void {
        try {
            if (confirm("Reset Global Parameters to standard defaults?")) {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.get(['fsrsGlobalParams'], (result: { fsrsGlobalParams?: FSRSParameters }) => {
                        const params = result.fsrsGlobalParams || { w: [...this.defaultWeights], decay: this.defaultDecay, factor: this.defaultFactor, requestRetention: this.defaultRetention };
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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error restoring global parameters: ${errorMessage}`, { err });
            // Comment: Non-fatal error during global parameters reset
        }
    }

    /**
     * Resets optimization status (removes personalized tag and timestamp).
     */
    resetOptimization(): void {
        try {
            if (confirm("Reset Personal Memory Optimization status?")) {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.get(['fsrsGlobalParams'], (result: { fsrsGlobalParams?: FSRSParameters }) => {
                        const params: FSRSParameters = result.fsrsGlobalParams || { w: [...this.defaultWeights], decay: this.defaultDecay, factor: this.defaultFactor, requestRetention: this.defaultRetention };
                        delete params.version;
                        delete params.timestamp;
                        params.w = [...this.defaultWeights];
                        chrome.storage.local.set({ fsrsGlobalParams: params }, () => {
                            this.loadFSRSConfig();
                            this.showToast("Optimization status reset.");
                        });
                    });
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error resetting optimization: ${errorMessage}`, { err });
            // Comment: Non-fatal error resetting optimization status
        }
    }

    /**
     * Restores only the FSRS coefficients (w0-w16).
     */
    restoreWeights(): void {
        try {
            if (confirm("Reset FSRS Coefficients to default weights?")) {
                if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                    chrome.storage.local.get(['fsrsGlobalParams'], (result: { fsrsGlobalParams?: FSRSParameters }) => {
                        const params: FSRSParameters = result.fsrsGlobalParams || { w: [...this.defaultWeights], decay: this.defaultDecay, factor: this.defaultFactor, requestRetention: this.defaultRetention };
                        delete params.version;
                        delete params.timestamp;
                        params.w = [...this.defaultWeights];
                        chrome.storage.local.set({ fsrsGlobalParams: params }, () => {
                            this.loadFSRSConfig();
                            this.showToast("FSRS coefficients reset.");
                        });
                    });
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error restoring weights: ${errorMessage}`, { err });
            // Comment: Catch weights restoration failure gracefully
        }
    }

    /**
     * Validates inputs and binds a new 17-coefficient custom profile to a specific tag filter.
     */
    handleAddTagProfile(): void {
        try {
            const tagInput = document.getElementById('new-tag-name') as HTMLInputElement | null;
            const weightsInput = document.getElementById('new-tag-weights') as HTMLInputElement | null;

            if (!tagInput || !weightsInput) return;

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

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['fsrsTopicWeights'], (result: { fsrsTopicWeights?: Record<string, number[]> }) => {
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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Failed to add tag profile: ${errorMessage}`, { err });
            // Comment: Non-fatal error adding custom tag profile
        }
    }

    /**
     * Deletes custom tag profile bindings from database storage.
     */
    handleDeleteTagProfile(tag: string): void {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['fsrsTopicWeights'], (result: { fsrsTopicWeights?: Record<string, number[]> }) => {
                    const topicWeights = result.fsrsTopicWeights || {};
                    delete topicWeights[tag];

                    chrome.storage.local.set({ fsrsTopicWeights: topicWeights }, () => {
                        this.loadFSRSConfig();
                        this.showToast(`Deleted FSRS profile for tag: ${tag}`);
                    });
                });
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSConfig', `Error deleting tag profile for '${tag}': ${errorMessage}`, { tag, err });
            // Comment: Catch profile deletion failure gracefully
        }
    }

    /**
     * Triggers a status toast element.
     */
    showToast(msg: string, isError: boolean = false): void {
        try {
            const toast = document.getElementById('status-toast');
            if (!toast) return;
            toast.textContent = msg;
            toast.className = 'toast show ' + (isError ? 'error' : 'success');
            setTimeout(() => {
                toast.className = 'toast';
            }, 2500);
        } catch {
            // Comment: Ignore toast DOM display errors
        }
    }
}

function initFSRSConfig(): void {
    try {
        const configManager = new FSRSConfigManager();
        configManager.init();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('FSRSConfig', `Initialization failed: ${errorMessage}`, { err });
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFSRSConfig);
    } else {
        initFSRSConfig();
    }
}
