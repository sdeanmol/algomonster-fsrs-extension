/**
 * @file features/dashboard/analytics/readiness/readiness.tsx
 * @description Exam Readiness tab controller. Predicts expected recall per subject/tag
 * based on the FSRS exponential memory decay formula for an upcoming exam date.
 *
 * Architecture Role: Analytics Tab Sub-View Controller (Exam Readiness Forecast).
 * Context: Extension Standalone Tab (`features/dashboard/analytics/analytics.html`).
 * Key Exports:
 * - {@link ReadinessTab}: View controller class managing target days input and subject recall projections.
 */

import { h, Fragment, FunctionalComponent } from 'preact';
import { Logger } from '@common/logger';
import { RECALL_THRESHOLD_GOOD, RECALL_THRESHOLD_WARNING } from '@common/constants';
import { DataUtils, ExamReadinessStats, ExamReadinessTagResult } from '../utils/dataUtils';

export interface ReadinessTopicCardProps {
    topic: ExamReadinessTagResult;
    daysAhead: number;
}

export const ReadinessTopicCard: FunctionalComponent<ReadinessTopicCardProps> = ({ topic, daysAhead }) => {
    const barWidth = Math.min(100, Math.max(0, topic.expectedRecall));
    return (
        <div class="readiness-topic-card">
            <div class="topic-info">
                <div class="topic-name-wrap">
                    <span class="topic-name">{topic.tag}</span>
                    <span class="topic-meta">{topic.count} card{topic.count !== 1 ? 's' : ''} &middot; Avg Stability: {topic.avgStability}d</span>
                </div>
                <div class={`topic-score-badge ${topic.statusClass}`}>
                    {topic.expectedRecall}%
                </div>
            </div>
            <div class="topic-progress-bg">
                <div class={`topic-progress-fill ${topic.statusClass}`} style={{ width: `${barWidth}%` }} />
            </div>
            <div class="topic-footer">
                <span class={`status-pill ${topic.statusClass}`}>{topic.status}</span>
                <span class="target-recall-hint">FSRS Retrievability at T+{daysAhead}d</span>
            </div>
        </div>
    );
};

export interface ReadinessMetricsGridProps {
    stats: ExamReadinessStats;
    formattedDate: string;
}

export const ReadinessMetricsGrid: FunctionalComponent<ReadinessMetricsGridProps> = ({ stats, formattedDate }) => {
    const recallClass = stats.overallRecall >= RECALL_THRESHOLD_GOOD
        ? 'text-success'
        : (stats.overallRecall >= RECALL_THRESHOLD_WARNING ? 'text-warning' : 'text-danger');
    const atRiskClass = stats.atRiskCount > 0 ? 'text-danger' : 'text-success';

    return (
        <div class="readiness-metrics-grid">
            <div class="readiness-metric-card">
                <span class="metric-title">Overall Expected Recall</span>
                <div class="metric-val-wrap">
                    <span class={`metric-value ${recallClass}`}>{stats.overallRecall}%</span>
                </div>
                <span class="metric-sub">Deck-wide FSRS projected retention</span>
            </div>

            <div class="readiness-metric-card">
                <span class="metric-title">Exam Target</span>
                <div class="metric-val-wrap">
                    <span class="metric-value text-accent">{stats.daysAhead}d</span>
                </div>
                <span class="metric-sub">{formattedDate}</span>
            </div>

            <div class="readiness-metric-card">
                <span class="metric-title">At-Risk Topics</span>
                <div class="metric-val-wrap">
                    <span class={`metric-value ${atRiskClass}`}>{stats.atRiskCount}</span>
                </div>
                <span class="metric-sub">Subjects below 75% recall target</span>
            </div>
        </div>
    );
};

/**
 * Controller for the Exam Readiness tab, calculating projected recall on an upcoming date.
 */
export class ReadinessTab {
    /** Statistical calculation engine reference. */
    dataUtils: DataUtils;
    /** Current forecast horizon in days ahead (default: 12 days). */
    daysAhead: number;

    /**
     * Initializes ReadinessTab with DataUtils reference and default 12-day horizon.
     * @param dataUtils - Statistical engine instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
            this.daysAhead = 12;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ReadinessTab', `Error initializing ReadinessTab constructor: ${errorMessage}`, { err });
            this.dataUtils = dataUtils;
            this.daysAhead = 12;
        }
    }

    /**
     * Renders readiness overview cards, preset day chips, and subject-by-subject recall scores into container.
     * @param containerId - ID of DOM element to render into.
     */
    render(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            const stats = this.dataUtils.getExamReadinessStats(this.daysAhead);
            const formattedDate = stats.targetDate.toLocaleDateString(undefined, {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });

            let tagRowsHtml = '';
            if (stats.tags.length === 0) {
                tagRowsHtml = `
                    <div class="readiness-empty-state">
                        <svg class="svg-icon empty-icon" viewBox="0 0 24 24">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <h3>No Card History Available</h3>
                        <p>Add and review cards to calculate real-time FSRS exam readiness predictions per subject.</p>
                    </div>
                `;
            } else {
                tagRowsHtml = stats.tags.map(t => {
                    const barWidth = Math.min(100, Math.max(0, t.expectedRecall));
                    return `
                        <div class="readiness-topic-card">
                            <div class="topic-info">
                                <div class="topic-name-wrap">
                                    <span class="topic-name">${this.escapeHtml(t.tag)}</span>
                                    <span class="topic-meta">${t.count} card${t.count !== 1 ? 's' : ''} &middot; Avg Stability: ${t.avgStability}d</span>
                                </div>
                                <div class="topic-score-badge ${t.statusClass}">
                                    ${t.expectedRecall}%
                                </div>
                            </div>
                            <div class="topic-progress-bg">
                                <div class="topic-progress-fill ${t.statusClass}" style="width: ${barWidth}%;"></div>
                            </div>
                            <div class="topic-footer">
                                <span class="status-pill ${t.statusClass}">${t.status}</span>
                                <span class="target-recall-hint">FSRS Retrievability at T+${stats.daysAhead}d</span>
                            </div>
                        </div>
                    `;
                }).join('');
            }

            container.innerHTML = `
                <div class="readiness-wrapper">
                    <div class="readiness-control-card">
                        <div class="control-header">
                            <h2>Exam Readiness Forecast</h2>
                            <p class="subtitle">Predict expected recall probability across all subjects using FSRS memory decay.</p>
                        </div>

                        <div class="simulation-input-row">
                            <label for="readiness-days-input" class="sim-label">
                                Suppose exam is in
                            </label>
                            <div class="days-input-wrapper">
                                <input type="number" id="readiness-days-input" class="days-number-input" 
                                       min="0" max="365" value="${stats.daysAhead}" aria-label="Days until exam">
                                <span class="days-suffix">days</span>
                            </div>

                            <div class="preset-chips">
                                <button class="preset-chip ${stats.daysAhead === 7 ? 'active' : ''}" data-days="7">7 Days</button>
                                <button class="preset-chip ${stats.daysAhead === 12 ? 'active' : ''}" data-days="12">12 Days</button>
                                <button class="preset-chip ${stats.daysAhead === 30 ? 'active' : ''}" data-days="30">30 Days</button>
                                <button class="preset-chip ${stats.daysAhead === 60 ? 'active' : ''}" data-days="60">60 Days</button>
                            </div>
                        </div>

                        <div class="target-date-display">
                            <svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            <span>Target Exam Date: <strong>${formattedDate}</strong></span>
                        </div>
                    </div>

                    <div class="readiness-metrics-grid">
                        <div class="readiness-metric-card">
                            <span class="metric-title">Overall Expected Recall</span>
                            <div class="metric-val-wrap">
                                <span class="metric-value ${stats.overallRecall >= RECALL_THRESHOLD_GOOD ? 'text-success' : (stats.overallRecall >= RECALL_THRESHOLD_WARNING ? 'text-warning' : 'text-danger')}">
                                    ${stats.overallRecall}%
                                </span>
                            </div>
                            <span class="metric-sub">Deck-wide FSRS projected retention</span>
                        </div>

                        <div class="readiness-metric-card">
                            <span class="metric-title">Exam Target</span>
                            <div class="metric-val-wrap">
                                <span class="metric-value text-accent">${stats.daysAhead}d</span>
                            </div>
                            <span class="metric-sub">${formattedDate}</span>
                        </div>

                        <div class="readiness-metric-card">
                            <span class="metric-title">At-Risk Topics</span>
                            <div class="metric-val-wrap">
                                <span class="metric-value ${stats.atRiskCount > 0 ? 'text-danger' : 'text-success'}">
                                    ${stats.atRiskCount}
                                </span>
                            </div>
                            <span class="metric-sub">Subjects below 75% recall target</span>
                        </div>
                    </div>

                    <div class="readiness-section">
                        <div class="section-header">
                            <h3>Expected Recall by Subject / Tag</h3>
                            <span class="help-icon" data-tooltip="Calculated dynamically per card using ts-fsrs retrievability decay at target exam timestamp.">?</span>
                        </div>

                        <div class="topics-grid">
                            ${tagRowsHtml}
                        </div>
                    </div>

                    <div class="readiness-footer-actions">
                        <a href="../studyplan/studyplan.html" class="btn btn-primary">
                            <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path><polyline points="16 2 16 6"></polyline><polyline points="8 2 8 6"></polyline><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                            Activate Exam Countdown Mode
                        </a>
                    </div>
                </div>
            `;

            this.bindEvents();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ReadinessTab', `Error rendering ReadinessTab: ${errorMessage}`, { containerId, daysAhead: this.daysAhead, err });
        }
    }

    /**
     * Binds input listeners to the days-until-exam number input and preset day chips.
     */
    bindEvents(): void {
        try {
            const daysInput = document.getElementById('readiness-days-input') as HTMLInputElement | null;
            if (daysInput) {
                daysInput.addEventListener('input', (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const val = parseInt(target.value, 10);
                        if (!isNaN(val) && val >= 0) {
                            this.daysAhead = val;
                            this.render('tab-readiness');
                        }
                    } catch (inputErr) {
                        const errorMessage = inputErr instanceof Error ? inputErr.message : String(inputErr);
                        Logger.error('ReadinessTab', `Error in readiness days input handler: ${errorMessage}`, { inputErr });
                    }
                });
            }

            const presetChips = document.querySelectorAll('.preset-chip');
            presetChips.forEach(chip => {
                chip.addEventListener('click', (e: Event) => {
                    try {
                        const currentTarget = e.currentTarget as HTMLElement;
                        const days = parseInt(currentTarget.dataset.days || '', 10);
                        if (!isNaN(days)) {
                            this.daysAhead = days;
                            this.render('tab-readiness');
                        }
                    } catch (chipErr) {
                        const errorMessage = chipErr instanceof Error ? chipErr.message : String(chipErr);
                        Logger.error('ReadinessTab', `Error in preset chip click handler: ${errorMessage}`, { chipErr });
                    }
                });
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ReadinessTab', `Error binding ReadinessTab event listeners: ${errorMessage}`, { err });
        }
    }

    /**
     * Sanitizes string values to prevent XSS during HTML string concatenation.
     * @param str - Raw input string.
     * @returns Escaped safe HTML string.
     */
    escapeHtml(str: string): string {
        try {
            if (!str) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ReadinessTab', `Error escaping HTML string: ${errorMessage}`, { str, err });
            return String(str || '');
        }
    }
}
