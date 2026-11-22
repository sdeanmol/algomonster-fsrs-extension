/**
 * @file features/dashboard/analytics/memory/memory.tsx
 * @description Main controller for the Memory & Retention tab in the analytics dashboard.
 * Coordinates multi-line forgetting curves, predicted vs actual recall comparisons,
 * FSRS personalized model status badges, and overdue review remediation guidance.
 * @context Popup / Analytics SPA Dashboard
 */

import { h, Fragment, FunctionalComponent, render } from 'preact';
import { useState, useMemo, useEffect } from 'preact/hooks';
import { flushSync } from 'preact/compat';
import { UIUtils } from '../../../common/utils/uiUtils';
import { RetentionChart, RetentionChartView } from './retentionChart';
import { PredictionComparison, PredictionComparisonChart } from './predictionComparison';
import { DataUtils } from '../utils/dataUtils';
import { resolveContainer } from '../utils/resolveContainer';
import { Card, StorageData } from '../../../../types/domain';
import { DEFAULT_FSRS_REQUEST_RETENTION, RETENTION_DROP_THRESHOLD } from '../../../common/constants';

function safeFlushSync(fn: () => void): void {
    try {
        flushSync(fn);
    } catch (_) {
        fn();
    }
}

export interface PersonalMemoryModelBannerProps {
    isPersonalized: boolean;
    timestamp: string;
}

export const PersonalMemoryModelBanner: FunctionalComponent<PersonalMemoryModelBannerProps> = ({ isPersonalized, timestamp }) => {
    return (
        <div class="memory-panel ana-panel-wide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px' }}>
            <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '14px' }}>Personal Memory Model</h3>
                <p style={{ margin: 0, fontSize: '12px', color: 'var(--md-text-low)' }}>Uses your history to predict forgetting.</p>
            </div>
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: 'var(--md-text-low)', display: 'block', textTransform: 'uppercase' }}>Source</span>
                    {isPersonalized ? (
                        <span class="tag-badge" style={{ background: 'var(--md-primary-container)', color: 'var(--md-primary)' }}>Optimized</span>
                    ) : (
                        <span class="tag-badge" style={{ background: 'var(--md-surface-variant)', color: 'var(--md-text-low)' }}>Default Weights</span>
                    )}
                </div>
                <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '11px', color: 'var(--md-text-low)', display: 'block', textTransform: 'uppercase' }}>Last Trained</span>
                    <span style={{ fontSize: '14px', fontWeight: 600 }}>{timestamp}</span>
                </div>
                <a href="../../tracker/config/fsrsConfig.html" target="_blank" class="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }}>Configure</a>
            </div>
        </div>
    );
};

export const MemoryTabContent: FunctionalComponent = () => {
    return (
        <div class="memory-grid">
            <div id="memory-next-action-container" />
            <div id="personal-memory-status-container" />
            <div class="memory-panel ana-panel-wide">
                <div class="ana-panel-header">
                    <span class="ana-panel-title">
                        Multiple Retention Curves
                        <span class="help-icon" data-tooltip="Shows how your memory of a card decays over time. A flatter curve means better long-term memory.">?</span>
                    </span>
                    <div class="memory-controls" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div id="tag-filter-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
                            <input
                                type="text"
                                id="retention-tag-filter"
                                class="modern-input"
                                placeholder="Filter by tag..."
                                style={{ width: '140px', padding: '6px 10px', fontSize: '13px', height: '32px', borderRadius: '6px', border: '1px solid var(--md-outline-variant)' }}
                            />
                        </div>
                        <select id="retention-group-by" class="modern-select" style={{ height: '32px', padding: '0 28px 0 10px', fontSize: '13px', borderRadius: '6px' }}>
                            <option value="tag">By Tag</option>
                            <option value="deck">By Deck</option>
                            <option value="difficulty">By Difficulty</option>
                        </select>
                        <label class="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                            <input type="checkbox" id="toggle-confidence-bands" style={{ margin: 0, cursor: 'pointer' }} />
                            Show confidence band
                        </label>
                    </div>
                </div>
                <div id="retention-curves-container" class="ana-chart-area" />
            </div>

            <div class="memory-panel ana-panel-wide">
                <div class="ana-panel-header">
                    <span class="ana-panel-title">
                        Actual vs Predicted Recall
                        <span class="help-icon" data-tooltip="Compares your real-world review performance against the scheduling mathematical prediction model. Large gaps mean the algorithm might need tuning.">?</span>
                    </span>
                </div>
                <div id="prediction-comparison-container" class="ana-chart-area" />
            </div>
        </div>
    );
};

export interface MemoryTabProps {
    cards?: Card[];
    dataUtils?: DataUtils;
    retentionChart?: RetentionChart;
}

export const MemoryTabComponent: FunctionalComponent<MemoryTabProps> = ({
    cards,
    dataUtils: propDataUtils,
    retentionChart: propRetentionChart
}) => {
    const dataUtils = useMemo(() => propDataUtils || new DataUtils(cards || [], {}, null), [propDataUtils, cards]);
    const [groupBy, setGroupBy] = useState<string>(propRetentionChart ? propRetentionChart.groupBy : 'tag');
    const [filterTag, setFilterTag] = useState<string>(propRetentionChart ? propRetentionChart.filterTag : '');
    const [showConfidence, setShowConfidence] = useState<boolean>(propRetentionChart ? propRetentionChart.showConfidence : false);

    const [modelStatus, setModelStatus] = useState<{ isPersonalized: boolean; timestamp: string }>({ isPersonalized: false, timestamp: 'Never' });

    useEffect(() => {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.get(['fsrsGlobalParams'], (result: any) => {
                const params = (result && result.fsrsGlobalParams) || {};
                const isPersonalized = params.version && params.version.includes('personalized');
                const timestamp = params.timestamp ? new Date(params.timestamp).toLocaleDateString() : 'Never';
                setModelStatus({ isPersonalized, timestamp });
            });
        }
    }, []);

    const handleGroupByChange = (val: string) => {
        try {
            safeFlushSync(() => {
                setGroupBy(val);
            });
            if (propRetentionChart) propRetentionChart.setGroupBy(val);
        } catch (err) {
            UIUtils.catchError('MemoryTab', 'Error handling retention-group-by select change', err);
        }
    };

    const handleFilterTagChange = (val: string) => {
        try {
            setFilterTag(val);
            if (propRetentionChart) propRetentionChart.setFilterTag(val);
        } catch (err) {
            UIUtils.catchError('MemoryTab', 'Error handling retention-tag-filter input change', err);
        }
    };

    const handleConfidenceChange = (val: boolean) => {
        try {
            setShowConfidence(val);
            if (propRetentionChart) propRetentionChart.setShowConfidence(val);
        } catch (err) {
            UIUtils.catchError('MemoryTab', 'Error handling toggle-confidence-bands change', err);
        }
    };

    const stats = dataUtils.getSummaryStats();
    const requestedRetention = dataUtils.scheduler
        ? Math.round(dataUtils.scheduler.getDefaultRequestRetention() * 100)
        : Math.round(DEFAULT_FSRS_REQUEST_RETENTION * 100);
    const actualRetention = stats.retention || 0;
    const retentionDrop = requestedRetention - actualRetention;

    let nextActionBanner = (
        <div class="actionable-insight-banner success" style={{ marginBottom: 0 }}>
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
            </svg>
            <div class="insight-content">
                <h3>Next Action: Keep up the Good Work</h3>
                <p>Your actual recall ({actualRetention}%) is tracking closely to the desired retention! Your memory stability is perfectly calibrated. No settings changes are necessary right now.</p>
            </div>
        </div>
    );

    if (stats.due > 0) {
        nextActionBanner = (
            <div class="actionable-insight-banner warning" style={{ marginBottom: 0 }}>
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div class="insight-content">
                    <h3>Next Action: Clear Overdue Reviews</h3>
                    <p>Your actual retention ({actualRetention}%) is affected by your <strong>{stats.due} overdue cards</strong>. The scheduling algorithm assumes you review cards exactly when they are due. Your next action is to <strong>clear your review queue</strong> to restore your memory stability!</p>
                </div>
            </div>
        );
    } else if (retentionDrop > RETENTION_DROP_THRESHOLD && actualRetention > 0) {
        nextActionBanner = (
            <div class="actionable-insight-banner warning" style={{ marginBottom: 0 }}>
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div class="insight-content">
                    <h3>Next Action: Calibrate Algorithm Parameters</h3>
                    <p>Your actual retention is tracking {retentionDrop}% below the requested retention of {requestedRetention}%. Because you have no overdue cards, the algorithm weights might be miscalibrated for your memory. <strong>Consider running the optimizer</strong> to tune the parameters to your learning history.</p>
                </div>
            </div>
        );
    }

    return (
        <div id="tab-memory" class="tab-pane active">
            <div class="memory-grid">
                <div id="memory-next-action-container">
                    {nextActionBanner}
                </div>
                <div id="personal-memory-status-container">
                    <PersonalMemoryModelBanner isPersonalized={modelStatus.isPersonalized} timestamp={modelStatus.timestamp} />
                </div>
                <div class="memory-panel ana-panel-wide">
                    <div class="ana-panel-header">
                        <span class="ana-panel-title">
                            Multiple Retention Curves
                            <span class="help-icon" data-tooltip="Shows how your memory of a card decays over time. A flatter curve means better long-term memory.">?</span>
                        </span>
                        <div class="memory-controls" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div id="tag-filter-wrapper" style={{ display: groupBy === 'tag' ? 'flex' : 'none', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    id="retention-tag-filter"
                                    class="modern-input"
                                    placeholder="Filter by tag..."
                                    value={filterTag}
                                    onInput={(e) => handleFilterTagChange((e.target as HTMLInputElement).value)}
                                    style={{ width: '140px', padding: '6px 10px', fontSize: '13px', height: '32px', borderRadius: '6px', border: '1px solid var(--md-outline-variant)' }}
                                />
                            </div>
                            <select
                                id="retention-group-by"
                                class="modern-select"
                                value={groupBy}
                                onChange={(e) => handleGroupByChange((e.target as HTMLSelectElement).value)}
                                style={{ height: '32px', padding: '0 28px 0 10px', fontSize: '13px', borderRadius: '6px' }}
                            >
                                <option value="tag">By Tag</option>
                                <option value="deck">By Deck</option>
                                <option value="difficulty">By Difficulty</option>
                            </select>
                            <label class="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', margin: 0 }}>
                                <input
                                    type="checkbox"
                                    id="toggle-confidence-bands"
                                    checked={showConfidence}
                                    onChange={(e) => handleConfidenceChange((e.target as HTMLInputElement).checked)}
                                    style={{ margin: 0, cursor: 'pointer' }}
                                />
                                Show confidence band
                            </label>
                        </div>
                    </div>
                    <div id="retention-curves-container" class="ana-chart-area">
                        <RetentionChartView
                            dataUtils={dataUtils}
                            groupBy={groupBy}
                            filterTag={filterTag}
                            showConfidence={showConfidence}
                        />
                    </div>
                </div>

                <div class="memory-panel ana-panel-wide">
                    <div class="ana-panel-header">
                        <span class="ana-panel-title">
                            Actual vs Predicted Recall
                            <span class="help-icon" data-tooltip="Compares your real-world review performance against the scheduling mathematical prediction model. Large gaps mean the algorithm might need tuning.">?</span>
                        </span>
                    </div>
                    <div id="prediction-comparison-container" class="ana-chart-area">
                        <PredictionComparisonChart dataUtils={dataUtils} />
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Controller for the Memory & Retention tab view in the analytics dashboard.
 * Orchestrates retention decay visualizations, model calibration comparisons,
 * and personal FSRS parameter weight status.
 */
export class MemoryTabClass {
    props?: MemoryTabProps;
    /** Data utility instance for card statistics and FSRS parameters */
    dataUtils: DataUtils;
    /** Sub-component rendering interactive forgetting curves with optional confidence intervals */
    retentionChart: RetentionChart;
    /** Sub-component comparing model predictions against observed review outcomes */
    predictionComparison: PredictionComparison;
    /** Flag indicating whether the primary static DOM shell has already been mounted */
    rendered: boolean;

    /**
     * Initializes the MemoryTab controller and child visualization components.
     * @param dataUtils - Card statistics and scheduler helper instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
            this.retentionChart = new RetentionChart(this.dataUtils);
            this.predictionComparison = new PredictionComparison(this.dataUtils);
            this.rendered = false;
        } catch (err) {
            UIUtils.catchError('MemoryTab', 'Error initializing MemoryTab constructor', err);
            this.dataUtils = dataUtils;
            this.retentionChart = new RetentionChart(dataUtils);
            this.predictionComparison = new PredictionComparison(dataUtils);
            this.rendered = false;
        }
    }

    /**
     * Renders the complete Memory & Retention view into the target container element.
     * Builds static layout on initial run and refreshes charts and guidance on subsequent calls.
     * @param containerId - DOM ID of the container element hosting the memory tab.
     * @returns void
     */
    render(containerId: string): void {
        try {
            const container = resolveContainer(containerId);
            if (!container) return;

            render(<MemoryTabComponent dataUtils={this.dataUtils} retentionChart={this.retentionChart} />, container);
            this.rendered = true;
        } catch (err) {
            UIUtils.catchError('MemoryTab', 'Error rendering MemoryTab', err, { containerId });
        }
    }

    renderPersonalMemoryStatus(containerId: string): void {
        try {
            const container = resolveContainer(containerId);
            if (!container) return;

            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.get(['fsrsGlobalParams'], (result: any) => {
                    const params = (result && result.fsrsGlobalParams) || {};
                    const isPersonalized = params.version && params.version.includes('personalized');
                    const timestamp = params.timestamp ? new Date(params.timestamp).toLocaleDateString() : 'Never';
                    render(<PersonalMemoryModelBanner isPersonalized={isPersonalized} timestamp={timestamp} />, container);
                });
            }
        } catch (err) {
            UIUtils.catchError('MemoryTab', 'Error rendering personal memory status', err, { containerId });
        }
    }

    renderNextAction(containerId: string): void {
        try {
            const container = resolveContainer(containerId);
            if (!container) return;

            const stats = this.dataUtils.getSummaryStats();
            const requestedRetention = this.dataUtils.scheduler
                ? Math.round(this.dataUtils.scheduler.getDefaultRequestRetention() * 100)
                : Math.round(DEFAULT_FSRS_REQUEST_RETENTION * 100);
            const actualRetention = stats.retention || 0;
            const retentionDrop = requestedRetention - actualRetention;

            let banner = (
                <div class="actionable-insight-banner success" style={{ marginBottom: 0 }}>
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <div class="insight-content">
                        <h3>Next Action: Keep up the Good Work</h3>
                        <p>Your actual recall ({actualRetention}%) is tracking closely to the desired retention! Your memory stability is perfectly calibrated. No settings changes are necessary right now.</p>
                    </div>
                </div>
            );

            if (stats.due > 0) {
                banner = (
                    <div class="actionable-insight-banner warning" style={{ marginBottom: 0 }}>
                        <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <div class="insight-content">
                            <h3>Next Action: Clear Overdue Reviews</h3>
                            <p>Your actual retention ({actualRetention}%) is affected by your <strong>{stats.due} overdue cards</strong>. The scheduling algorithm assumes you review cards exactly when they are due. Your next action is to <strong>clear your review queue</strong> to restore your memory stability!</p>
                        </div>
                    </div>
                );
            } else if (retentionDrop > RETENTION_DROP_THRESHOLD && actualRetention > 0) {
                banner = (
                    <div class="actionable-insight-banner warning" style={{ marginBottom: 0 }}>
                        <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <div class="insight-content">
                            <h3>Next Action: Calibrate Algorithm Parameters</h3>
                            <p>Your actual retention is tracking {retentionDrop}% below the requested retention of {requestedRetention}%. Because you have no overdue cards, the algorithm weights might be miscalibrated for your memory. <strong>Consider running the optimizer</strong> to tune the parameters to your learning history.</p>
                        </div>
                    </div>
                );
            }

            render(banner, container);
        } catch (err) {
            UIUtils.catchError('MemoryTab', 'Error rendering memory next action', err, { containerId });
        }
    }
}

export type MemoryTab = MemoryTabClass;

export const MemoryTab: FunctionalComponent<MemoryTabProps> & {
    new (dataUtils: DataUtils): MemoryTabClass;
} = function(this: any, propsOrDataUtils: any) {
    if (new.target) {
        return new MemoryTabClass(propsOrDataUtils);
    }
    return MemoryTabComponent(propsOrDataUtils);
} as any;

