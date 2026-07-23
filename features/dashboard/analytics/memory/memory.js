import { RetentionChart } from './retentionChart.js';
import { PredictionComparison } from './predictionComparison.js';
import { FutureMemorySimulation } from './futureMemorySimulation.js';

export class MemoryTab {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
        this.retentionChart = new RetentionChart(this.dataUtils);
        this.predictionComparison = new PredictionComparison(this.dataUtils);
        this.futureMemorySimulation = new FutureMemorySimulation(this.dataUtils);
        this.rendered = false;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (!this.rendered) {
            container.innerHTML = `
                <div class="memory-grid">
                    <div id="memory-next-action-container"></div>
                    <div id="personal-memory-status-container"></div>
                    <div class="memory-panel ana-panel-wide">
                        <div class="ana-panel-header">
                            <span class="ana-panel-title">
                                Multiple Retention Curves
                                <span class="help-icon" data-tooltip="Shows how your memory of a card decays over time. A flatter curve means better long-term memory.">?</span>
                            </span>
                            <div class="memory-controls" style="display:flex; align-items:center; gap:12px;">
                                <div id="tag-filter-wrapper" style="display:flex; align-items:center;">
                                    <input type="text" id="retention-tag-filter" class="modern-input" placeholder="Filter by tag..." style="width: 140px; padding: 6px 10px; font-size: 13px; height: 32px; border-radius: 6px; border: 1px solid var(--md-outline-variant);">
                                </div>
                                <select id="retention-group-by" class="modern-select" style="height: 32px; padding: 0 28px 0 10px; font-size: 13px; border-radius: 6px;">
                                    <option value="tag">By Tag</option>
                                    <option value="deck">By Deck</option>
                                    <option value="difficulty">By Difficulty</option>
                                </select>
                                <label class="checkbox-label" style="display:flex; align-items:center; gap:6px; font-size: 13px; cursor: pointer; margin: 0;">
                                    <input type="checkbox" id="toggle-confidence-bands" style="margin:0; cursor: pointer;">
                                    Show confidence band
                                </label>
                            </div>
                        </div>
                        <div id="retention-curves-container" class="ana-chart-area"></div>
                    </div>

                    <div class="memory-panel ana-panel-wide">
                        <div class="ana-panel-header">
                            <span class="ana-panel-title">
                                Actual vs Predicted Recall
                                <span class="help-icon" data-tooltip="Compares your real-world review performance against the scheduling mathematical prediction model. Large gaps mean the algorithm might need tuning.">?</span>
                            </span>
                        </div>
                        <div id="prediction-comparison-container" class="ana-chart-area"></div>
                    </div>
                    <div id="future-memory-simulation-container"></div>
                </div>
            `;

            // Bind events for the dropdowns and toggles
            const groupBySelect = container.querySelector('#retention-group-by');
            const confidenceToggle = container.querySelector('#toggle-confidence-bands');
            const tagFilterInput = container.querySelector('#retention-tag-filter');
            const tagFilterWrapper = container.querySelector('#tag-filter-wrapper');

            groupBySelect.addEventListener('change', (e) => {
                const groupBy = e.target.value;
                this.retentionChart.setGroupBy(groupBy);
                this.retentionChart.render('retention-curves-container');

                // Toggle visibility of the tag filter based on the group-by selection
                tagFilterWrapper.style.display = (groupBy === 'tag') ? 'flex' : 'none';
            });

            tagFilterInput.addEventListener('input', (e) => {
                this.retentionChart.setFilterTag(e.target.value);
                this.retentionChart.render('retention-curves-container');
            });

            confidenceToggle.addEventListener('change', (e) => {
                this.retentionChart.setShowConfidence(e.target.checked);
                this.retentionChart.render('retention-curves-container');
            });

            this.rendered = true;
        }

        this.futureMemorySimulation.render('future-memory-simulation-container');
        this.retentionChart.render('retention-curves-container');
        this.predictionComparison.render('prediction-comparison-container');
        this.renderNextAction('memory-next-action-container');
        this.renderPersonalMemoryStatus('personal-memory-status-container');
    }

    renderPersonalMemoryStatus(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        chrome.storage.local.get(['fsrsGlobalParams'], (result) => {
            const params = result.fsrsGlobalParams || {};
            const isPersonalized = params.version && params.version.includes('personalized');
            const timestamp = params.timestamp ? new Date(params.timestamp).toLocaleDateString() : 'Never';

            const stats = this.dataUtils.getSummaryStats();

            let statusBadge = '<span class="tag-badge" style="background:var(--md-surface-variant); color:var(--md-text-low);">Default Weights</span>';
            if (isPersonalized) {
                statusBadge = '<span class="tag-badge" style="background:var(--md-primary-container); color:var(--md-primary);">Optimized</span>';
            }

            container.innerHTML = `
                <div class="memory-panel ana-panel-wide" style="display:flex; justify-content:space-between; align-items:center; padding:16px;">
                    <div>
                        <h3 style="margin:0 0 4px 0; font-size:14px;">Personal Memory Model</h3>
                        <p style="margin:0; font-size:12px; color:var(--md-text-low);">Uses your history to predict forgetting.</p>
                    </div>
                    <div style="display:flex; gap:24px; align-items:center;">
                        <div style="text-align:right;">
                            <span style="font-size:11px; color:var(--md-text-low); display:block; text-transform:uppercase;">Source</span>
                            ${statusBadge}
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:11px; color:var(--md-text-low); display:block; text-transform:uppercase;">Last Trained</span>
                            <span style="font-size:14px; font-weight:600;">${timestamp}</span>
                        </div>
                        <a href="../../tracker/config/fsrsConfig.html" target="_blank" class="btn btn-secondary" style="padding:6px 12px; font-size:12px;">Configure</a>
                    </div>
                </div>
            `;
        });
    }

    renderNextAction(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const stats = this.dataUtils.getSummaryStats();

        // Fetch Requested Retention from active scheduler (default 90%)
        const requestedRetention = this.dataUtils.scheduler
            ? Math.round(this.dataUtils.scheduler.getDefaultRequestRetention() * 100)
            : 90;
        const actualRetention = stats.retention || 0;

        const retentionDrop = requestedRetention - actualRetention;

        if (stats.due > 0) {
            container.innerHTML = `
                <div class="actionable-insight-banner warning" style="margin-bottom:0;">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <div class="insight-content">
                        <h3>Next Action: Clear Overdue Reviews</h3>
                        <p>Your actual retention (${actualRetention}%) is affected by your <strong>${stats.due} overdue cards</strong>. The scheduling algorithm assumes you review cards exactly when they are due. Your next action is to <strong>clear your review queue</strong> to restore your memory stability!</p>
                    </div>
                </div>
            `;
        } else if (retentionDrop > 5 && actualRetention > 0) {
            container.innerHTML = `
                <div class="actionable-insight-banner warning" style="margin-bottom:0;">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
                    </svg>
                    <div class="insight-content">
                        <h3>Next Action: Calibrate Algorithm Parameters</h3>
                        <p>Your actual retention is tracking ${retentionDrop}% below the requested retention of ${requestedRetention}%. Because you have no overdue cards, the algorithm weights might be miscalibrated for your memory. <strong>Consider running the optimizer</strong> to tune the parameters to your learning history.</p>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="actionable-insight-banner success" style="margin-bottom:0;">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <div class="insight-content">
                        <h3>Next Action: Keep up the Good Work</h3>
                        <p>Your actual recall (${actualRetention}%) is tracking closely to the desired retention! Your memory stability is perfectly calibrated. No settings changes are necessary right now.</p>
                    </div>
                </div>
            `;
        }
    }
}
