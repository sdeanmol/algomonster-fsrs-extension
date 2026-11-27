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

import { h, Fragment, FunctionalComponent, render } from 'preact';
import { useState, useMemo } from 'preact/hooks';
import { Logger } from '@common/logger';
import { RECALL_THRESHOLD_GOOD, RECALL_THRESHOLD_WARNING } from '@common/constants';
import { DataUtils, ExamReadinessStats, ExamReadinessTagResult } from '../utils/dataUtils';
import { resolveContainer } from '../utils/resolveContainer';
import { Card } from '../../../../types/domain';

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

export interface ReadinessTabProps {
    cards?: Card[];
    dataUtils?: DataUtils;
    daysAhead?: number;
    onDaysChange?: (days: number) => void;
}

export const ReadinessTabComponent: FunctionalComponent<ReadinessTabProps> = ({
    cards,
    dataUtils: propDataUtils,
    daysAhead: controlledDays,
    onDaysChange
}) => {
    const dataUtils = useMemo(() => propDataUtils || new DataUtils(cards || [], {}, null), [propDataUtils, cards]);
    const [internalDays, setInternalDays] = useState(controlledDays !== undefined ? controlledDays : 12);
    const daysAhead = controlledDays !== undefined ? controlledDays : internalDays;

    const handleDaysUpdate = (days: number) => {
        setInternalDays(days);
        if (onDaysChange) {
            onDaysChange(days);
        }
    };

    const stats = useMemo(() => dataUtils.getExamReadinessStats(daysAhead), [dataUtils, daysAhead]);
    const formattedDate = useMemo(() => stats.targetDate.toLocaleDateString(undefined, {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }), [stats.targetDate]);

    return (
        <div class="readiness-wrapper">
            <div class="readiness-control-card">
                <div class="control-header">
                    <h2>Exam Readiness Forecast</h2>
                    <p class="subtitle">Predict expected recall probability across all subjects using AlgoRecall Engine memory decay.</p>
                </div>

                    <div class="simulation-input-row">
                        <label for="readiness-days-input" class="sim-label">
                            Suppose exam is in
                        </label>
                        <div class="days-input-wrapper">
                            <input
                                type="number"
                                id="readiness-days-input"
                                class="days-number-input"
                                min="0"
                                max="365"
                                value={daysAhead}
                                aria-label="Days until exam"
                                onInput={(e) => {
                                    const val = parseInt((e.target as HTMLInputElement).value, 10);
                                    if (!isNaN(val) && val >= 0) {
                                        handleDaysUpdate(val);
                                    }
                                }}
                            />
                            <span class="days-suffix">days</span>
                        </div>

                        <div class="preset-chips">
                            {[7, 12, 30, 60].map(days => (
                                <button
                                    key={days}
                                    class={`preset-chip ${daysAhead === days ? 'active' : ''}`}
                                    data-days={days}
                                    onClick={() => handleDaysUpdate(days)}
                                >
                                    {days} Days
                                </button>
                            ))}
                        </div>
                    </div>

                    <div class="target-date-display">
                        <svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                        <span>Target Exam Date: <strong>{formattedDate}</strong></span>
                    </div>
                </div>

                <ReadinessMetricsGrid stats={stats} formattedDate={formattedDate} />

                <div class="readiness-section">
                    <div class="section-header">
                        <h3>Expected Recall by Subject / Tag</h3>
                        <span class="help-icon" data-tooltip="Calculated dynamically per card using AlgoRecall Engine retrievability decay at target exam timestamp.">?</span>
                    </div>

                    <div class="topics-grid">
                        {stats.tags.length === 0 ? (
                            <div class="readiness-empty-state">
                                <svg class="svg-icon empty-icon" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <h3>No Card History Available</h3>
                                <p>Add and review cards to calculate real-time FSRS exam readiness predictions per subject.</p>
                            </div>
                        ) : (
                            stats.tags.map(t => (
                                <ReadinessTopicCard key={t.tag} topic={t} daysAhead={daysAhead} />
                            ))
                        )}
                    </div>
                </div>

                <div class="readiness-footer-actions">
                    <a href="../studyplan/studyplan.html" class="btn btn-primary">
                        <svg class="svg-icon" viewBox="0 0 24 24"><path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" /><polyline points="16 2 16 6" /><polyline points="8 2 8 6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                        Activate Exam Countdown Mode
                    </a>
                </div>
        </div>
    );
};

/**
 * Controller for the Exam Readiness tab, calculating projected recall on an upcoming date.
 */
export class ReadinessTabClass {
    props?: ReadinessTabProps;
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
            const container = resolveContainer(containerId);
            if (!container) return;

            render(
                <ReadinessTabComponent
                    dataUtils={this.dataUtils}
                    daysAhead={this.daysAhead}
                    onDaysChange={(days) => {
                        this.daysAhead = days;
                        this.render(containerId);
                    }}
                />,
                container
            );
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ReadinessTab', `Error rendering ReadinessTab: ${errorMessage}`, { containerId, daysAhead: this.daysAhead, err });
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

export type ReadinessTab = ReadinessTabClass;

export const ReadinessTab: FunctionalComponent<ReadinessTabProps> & {
    new (dataUtils: DataUtils): ReadinessTabClass;
} = function(this: any, propsOrDataUtils: any) {
    if (new.target) {
        return new ReadinessTabClass(propsOrDataUtils);
    }
    return ReadinessTabComponent(propsOrDataUtils);
} as any;
