/**
 * @file features/dashboard/summary/summary.tsx
 * @description Controller and Preact components for the dynamic Weekly and Monthly Digest Summary page.
 * Aggregates study metrics, retention trends, leech patterns, topic mastery distributions,
 * and generates actionable study insights.
 * Migrated to Preact with TypeScript for modular summary cards, charts, and topic bars.
 *
 * Architecture Role: Summary Digest Standalone Page Controller and Preact Root Component.
 * Context: Extension Standalone Tab (`features/dashboard/summary/summary.html`).
 * Key Exports:
 * - `SummaryPeriodTabs`: Preact component for weekly vs monthly period switching.
 * - `SummaryKpiGrid`: Preact component for KPI metric cards and trend badges.
 * - `SummaryInsightsList`: Preact component for smart recommendation callouts.
 * - `SummaryActivityChart`: Preact component for daily review activity bar chart.
 * - `SummaryTopicMasteryList`: Preact component for topic mastery and weak topics progress bars.
 * - `SummaryApp`: Root Preact component for the Performance & Notification Summary page.
 * - `SummaryDashboard`: Master controller class managing timeframe tabs and digest rendering.
 */

import { h, VNode, render, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { StorageData, Card } from '../../../types/domain';
import { generateSummaryReport, SummaryReport, TopicMastery, SummaryInsight, DailyActivityPoint } from './summaryGenerator';

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface SummaryPeriodTabsProps {
    currentPeriod: 'weekly' | 'monthly';
    onSelectPeriod: (period: 'weekly' | 'monthly') => void;
}

/**
 * Preact component for switching between Weekly and Monthly digest timeframes.
 */
export function SummaryPeriodTabs({ currentPeriod, onSelectPeriod }: SummaryPeriodTabsProps): VNode {
    const isWeekly = currentPeriod === 'weekly';

    return (
        <div className="period-tabs period-toggle-group" role="tablist">
            <button
                id="period-weekly-btn"
                className={`tab-btn period-tab ${isWeekly ? 'active' : ''}`}
                role="tab"
                aria-selected={isWeekly ? 'true' : 'false'}
                onClick={() => onSelectPeriod('weekly')}
            >
                Weekly (7 Days)
            </button>
            <button
                id="period-monthly-btn"
                className={`tab-btn period-tab ${!isWeekly ? 'active' : ''}`}
                role="tab"
                aria-selected={!isWeekly ? 'true' : 'false'}
                onClick={() => onSelectPeriod('monthly')}
            >
                Monthly (30 Days)
            </button>
        </div>
    );
}

export interface SummaryKpiGridProps {
    report: SummaryReport;
    currentPeriod: 'weekly' | 'monthly';
}

/**
 * Preact component rendering top-level KPI cards and trend percentage badges.
 */
export function SummaryKpiGrid({ report, currentPeriod }: SummaryKpiGridProps): VNode {
    const reviewsDiff = report.reviewsChangePct;
    const reviewsSign = reviewsDiff > 0 ? '+' : '';
    const reviewsTrendClass = reviewsDiff > 0 ? 'up' : reviewsDiff < 0 ? 'down' : 'neutral';

    const retentionDiff = report.retentionChangeDiff;
    const retentionSign = retentionDiff > 0 ? '+' : '';
    const retentionTrendClass = retentionDiff > 0 ? 'up' : retentionDiff < 0 ? 'down' : 'neutral';
    const activeDaysPct = report.totalDaysInPeriod > 0 ? Math.round((report.activeDays / report.totalDaysInPeriod) * 100) : 0;

    return (
        <section className="kpi-grid">
            <div className="card kpi-card">
                <div className="kpi-icon-wrapper blue">
                    <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                    </svg>
                </div>
                <div className="kpi-details">
                    <span className="kpi-label">Total Reviews</span>
                    <div className="kpi-val-group">
                        <span id="kpi-reviews" className="kpi-val kpi-value">{report.totalReviews}</span>
                        <span id="kpi-reviews-trend" className={`kpi-badge ${reviewsTrendClass}`}>
                            {reviewsSign}{reviewsDiff}%
                        </span>
                    </div>
                    <span className="kpi-subtext kpi-sub" id="kpi-reviews-sub">
                        vs {report.prevPeriodReviews} in prev {currentPeriod === 'weekly' ? 'week' : 'month'}
                    </span>
                </div>
            </div>

            <div className="card kpi-card">
                <div className="kpi-icon-wrapper green">
                    <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                </div>
                <div className="kpi-details">
                    <span className="kpi-label">Recall Retention</span>
                    <div className="kpi-val-group">
                        <span id="kpi-retention" className="kpi-val kpi-value">{report.retentionRate}%</span>
                        <span id="kpi-retention-trend" className={`kpi-badge ${retentionTrendClass}`}>
                            {retentionSign}{retentionDiff}%
                        </span>
                    </div>
                    <span className="kpi-subtext kpi-sub" id="kpi-retention-sub">
                        prev period: {report.prevRetentionRate}%
                    </span>
                </div>
            </div>

            <div className="card kpi-card">
                <div className="kpi-icon-wrapper purple">
                    <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="11" x2="12" y2="17" />
                        <line x1="9" y1="14" x2="15" y2="14" />
                    </svg>
                </div>
                <div className="kpi-details">
                    <span className="kpi-label">New Patterns</span>
                    <div className="kpi-val-group">
                        <span id="kpi-new-cards" className="kpi-val kpi-value">{report.newCardsLearned}</span>
                    </div>
                    <span className="kpi-subtext kpi-sub">patterns added to review loop</span>
                </div>
            </div>

            <div className="card kpi-card">
                <div className="kpi-icon-wrapper orange">
                    <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                </div>
                <div className="kpi-details">
                    <span className="kpi-label">Study Consistency</span>
                    <div className="kpi-val-group">
                        <span id="kpi-active-days" className="kpi-val kpi-value">
                            {report.activeDays}/{report.totalDaysInPeriod}
                        </span>
                    </div>
                    <span className="kpi-subtext kpi-sub" id="kpi-active-days-sub">
                        {activeDaysPct}% active days
                    </span>
                </div>
            </div>
        </section>
    );
}

export interface SummaryInsightsListProps {
    insights: SummaryInsight[];
}

/**
 * Preact component rendering smart recommendations and observational callouts.
 */
export function SummaryInsightsList({ insights }: SummaryInsightsListProps): VNode {
    if (insights.length === 0) {
        return (
            <div id="insights-container" className="insights-container insights-grid">
                <div className="empty-state">No specific recommendations for this period.</div>
            </div>
        );
    }

    return (
        <div id="insights-container" className="insights-container insights-grid">
            {insights.map((insight, idx) => (
                <div key={idx} className={`insight-item ${insight.type}`}>
                    <span className="insight-icon">{insight.icon}</span>
                    <div className="insight-content">
                        <span className="insight-title">{insight.title}</span>
                        <span className="insight-desc">{insight.description}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}

export interface SummaryActivityChartProps {
    dailyActivity: DailyActivityPoint[];
    isMonthly: boolean;
}

/**
 * Preact component rendering daily review activity columns and date labels.
 */
export function SummaryActivityChart({ dailyActivity, isMonthly }: SummaryActivityChartProps): VNode {
    const maxCount = Math.max(...dailyActivity.map(a => a.count), 1);
    const totalPoints = dailyActivity.length;

    return (
        <div id="activity-chart-container" className="chart-bars-container chart-container">
            {dailyActivity.map((pt, idx) => {
                const heightPct = pt.count > 0 ? Math.max(Math.round((pt.count / maxCount) * 100), 10) : 0;
                const showLabel = !isMonthly || idx % 5 === 0 || idx === totalPoints - 1;

                return (
                    <div
                        key={idx}
                        className="chart-bar-wrapper"
                        title={`${pt.fullDate}: ${pt.count} review(s)`}
                    >
                        <div
                            className={`chart-bar ${pt.count === 0 ? 'zero' : ''}`}
                            style={{ height: `${heightPct}%` }}
                        />
                        <span className={`chart-label ${showLabel ? '' : 'hidden-label'}`}>
                            {showLabel ? pt.dateStr : ''}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

export interface SummaryTopicMasteryListProps {
    title?: string;
    containerId: string;
    topics: TopicMastery[];
}

/**
 * Preact component rendering topic mastery percentage bars.
 */
export function SummaryTopicMasteryList({
    containerId,
    topics
}: SummaryTopicMasteryListProps): VNode {
    if (topics.length === 0) {
        return (
            <div id={containerId} className="topics-list">
                <div className="empty-state">No topic data logged in this timeframe.</div>
            </div>
        );
    }

    return (
        <div id={containerId} className="topics-list">
            {topics.map((t) => {
                const fillClass = t.retentionRate >= 80 ? 'high' : t.retentionRate >= 60 ? 'medium' : 'low';
                return (
                    <div key={t.tag} className="topic-row">
                        <div className="topic-header">
                            <span className="topic-name">{t.tag}</span>
                            <span className="topic-stats">{t.retentionRate}% ({t.successReviews}/{t.totalReviews})</span>
                        </div>
                        <div className="topic-bar-bg">
                            <div className={`topic-bar-fill ${fillClass}`} style={{ width: `${t.retentionRate}%` }} />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT PREACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface SummaryAppProps {
    dashboard?: SummaryDashboard;
}

export function SummaryApp({ dashboard: initialDashboard }: SummaryAppProps): VNode {
    const [dashboard] = useState(() => initialDashboard || new SummaryDashboard());
    const [currentPeriod, setCurrentPeriod] = useState<'weekly' | 'monthly'>(dashboard.getPeriod());
    const [report, setReport] = useState<SummaryReport>(() => dashboard.getReport());
    const [, setRenderTrigger] = useState(0);

    const forceUpdate = () => setRenderTrigger(c => c + 1);

    useEffect(() => {
        dashboard.onUpdate = () => {
            setCurrentPeriod(dashboard.getPeriod());
            setReport(dashboard.getReport());
            forceUpdate();
        };

        if (dashboard.isEmpty()) {
            dashboard.init();
        }
    }, [dashboard]);

    const handleSelectPeriod = (period: 'weekly' | 'monthly') => {
        dashboard.setPeriod(period);
        setCurrentPeriod(period);
        setReport(dashboard.getReport());
        forceUpdate();
    };

    const isMonthly = currentPeriod === 'monthly';

    return (
        <div className="summary-container">
            {/* Top Navigation Header */}
            <header className="summary-header">
                <div className="header-left">
                    <div className="algorecall-brand-badge">
                        <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                            <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                        </svg>
                        <span className="algorecall-brand-name">AlgoRecall</span>
                    </div>
                    <h1 className="summary-app-title">
                        <svg className="svg-icon logo-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10 9 9 9 8 9" />
                        </svg>
                        <span>Notification & Digest Summary</span>
                    </h1>
                    <p id="summary-date-subtitle" className="subtitle">
                        {report.periodLabel ? `${report.periodLabel} (${report.startDateStr} — ${report.endDateStr}) ·` : 'Generated on the fly from current study activity'}
                    </p>
                </div>
                <div className="header-right">
                    <SummaryPeriodTabs
                        currentPeriod={currentPeriod}
                        onSelectPeriod={handleSelectPeriod}
                    />
                    <a href="../popup/popup.html" className="btn btn-secondary nav-back-btn" title="Back to Dashboard">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Dashboard
                    </a>
                </div>
            </header>

            {/* KPI Hero Cards Grid */}
            <SummaryKpiGrid report={report} currentPeriod={currentPeriod} />

            {/* Smart Recommendations & Insights Section */}
            <section className="card section-card">
                <h2 className="section-title">
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-warning)' }} aria-hidden="true">
                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                    </svg>
                    Smart Learning Advisor & Insights
                </h2>
                <SummaryInsightsList insights={report.insights} />
            </section>

            {/* Detailed Breakdown Grid (Charts + Topic Breakdown) */}
            <div className="details-grid">
                {/* Left Column: Activity Chart & Memory Stability */}
                <div className="column-main">
                    <div className="card section-card">
                        <h3 className="section-title">
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-primary)' }} aria-hidden="true">
                                <line x1="18" y1="20" x2="18" y2="10" />
                                <line x1="12" y1="20" x2="12" y2="4" />
                                <line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                            Daily Review Activity Breakdown
                        </h3>
                        <SummaryActivityChart
                            dailyActivity={report.dailyActivity}
                            isMonthly={isMonthly}
                        />
                    </div>

                    <div className="card section-card">
                        <h3 className="section-title">
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-secondary)' }} aria-hidden="true">
                                <path d="M12 4.5a2.5 2.5 0 0 0-4.96.44 2.5 2.5 0 0 0-2.96 3.08 3 3 0 0 0-.34 5.58 2.5 2.5 0 0 0 1.32 4.24 2.5 2.5 0 0 0 4.44 2.04" />
                                <path d="M12 4.5a2.5 2.5 0 0 1 4.96.44 2.5 2.5 0 0 1 2.96 3.08 3 3 0 0 1 .34 5.58 2.5 2.5 0 0 1-1.32 4.24 2.5 2.5 0 0 1-4.44 2.04" />
                                <line x1="12" y1="3" x2="12" y2="21" />
                            </svg>
                            FSRS Memory Health Metrics
                        </h3>
                        <div className="health-metrics-grid">
                            <div className="health-metric-item">
                                <span className="metric-val" id="metric-avg-stability">{report.avgStability}d</span>
                                <span className="metric-lbl">Avg Card Stability</span>
                            </div>
                            <div className="health-metric-item">
                                <span className="metric-val" id="metric-leeches">{report.leechCount}</span>
                                <span className="metric-lbl">Leech Cards (3+ Lapses)</span>
                            </div>
                            <div className="health-metric-item">
                                <span className="metric-val" id="metric-streak">
                                    {report.longestStreakInPeriod} day{report.longestStreakInPeriod === 1 ? '' : 's'}
                                </span>
                                <span className="metric-lbl">Period Max Streak</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Topic Mastery & Attention Needed */}
                <div className="column-side">
                    <div className="card section-card">
                        <h3 className="section-title">
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-success)' }} aria-hidden="true">
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                            Top Topics Mastered
                        </h3>
                        <SummaryTopicMasteryList
                            containerId="top-topics-container"
                            topics={report.topTopics}
                        />
                    </div>

                    <div className="card section-card">
                        <h3 className="section-title">
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-danger)' }} aria-hidden="true">
                                <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            Topics Needing Focus
                        </h3>
                        <SummaryTopicMasteryList
                            containerId="weak-topics-container"
                            topics={report.weakestTopics}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY DASHBOARD CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Controller for the Weekly & Monthly Study Digest dashboard.
 * Manages timeframe switching (7-day weekly vs 30-day monthly), loads stored card histories,
 * and renders KPI cards, activity charts, and topic mastery distributions.
 */
export class SummaryDashboard {
    /** Active summary period: 'weekly' (last 7 days) or 'monthly' (last 30 days). */
    private currentPeriod: 'weekly' | 'monthly' = 'weekly';
    /** Collection of all cards loaded from extension storage. */
    private allCards: Card[] = [];
    /** Cached activity history mapping ISO date strings to review counts. */
    private fsrsActivity: { [date: string]: number } = {};
    /** State change observer callback. */
    onUpdate?: () => void;

    /**
     * Initializes the summary digest by parsing URL parameters, binding tab controls,
     * and reading card records from local storage.
     */
    init(): void {
        try {
            // Read URL params if timeframe is passed e.g. ?period=monthly
            if (typeof window !== 'undefined' && window.location) {
                const urlParams = new URLSearchParams(window.location.search);
                const periodParam = urlParams.get('period') || urlParams.get('timeframe');
                if (periodParam === 'monthly') {
                    this.currentPeriod = 'monthly';
                }
            }

            this.bindEvents();
            this.loadData();
        } catch (err) {
            UIUtils.catchError('SummaryDashboard', 'Error during init', err);
        }
    }

    getPeriod(): 'weekly' | 'monthly' {
        return this.currentPeriod;
    }

    setPeriod(period: 'weekly' | 'monthly'): void {
        if (this.currentPeriod !== period) {
            this.currentPeriod = period;
            this.updateTabUI();
            this.renderReport();
            if (this.onUpdate) this.onUpdate();
        }
    }

    isEmpty(): boolean {
        return this.allCards.length === 0 && Object.keys(this.fsrsActivity).length === 0;
    }

    getReport(): SummaryReport {
        return generateSummaryReport(this.allCards, this.fsrsActivity, this.currentPeriod);
    }

    /**
     * Attaches click handlers to the weekly and monthly timeframe toggle buttons.
     */
    private bindEvents(): void {
        const weeklyBtn = document.getElementById('period-weekly-btn');
        const monthlyBtn = document.getElementById('period-monthly-btn');

        if (weeklyBtn) {
            weeklyBtn.addEventListener('click', () => {
                this.setPeriod('weekly');
            });
        }

        if (monthlyBtn) {
            monthlyBtn.addEventListener('click', () => {
                this.setPeriod('monthly');
            });
        }
    }

    /**
     * Updates CSS active classes and ARIA selection states on period buttons.
     */
    private updateTabUI(): void {
        const weeklyBtn = document.getElementById('period-weekly-btn');
        const monthlyBtn = document.getElementById('period-monthly-btn');

        if (weeklyBtn && monthlyBtn) {
            const isWeekly = this.currentPeriod === 'weekly';
            weeklyBtn.classList.toggle('active', isWeekly);
            weeklyBtn.setAttribute('aria-selected', String(isWeekly));

            monthlyBtn.classList.toggle('active', !isWeekly);
            monthlyBtn.setAttribute('aria-selected', String(!isWeekly));
        }
    }

    /**
     * Loads cards and activity history from local storage and triggers report generation.
     * @listens chrome.storage.local
     */
    private loadData(): void {
        try {
            chrome.storage.local.get(['fsrsCards', 'fsrsActivity'], (result: StorageData) => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('SummaryDashboard', `Storage error fetching cards: ${errorMessage}`);
                        return;
                    }

                    this.allCards = result.fsrsCards || [];
                    this.fsrsActivity = result.fsrsActivity || {};

                    this.updateTabUI();
                    this.renderReport();
                    if (this.onUpdate) this.onUpdate();
                } catch (innerErr) {
                    UIUtils.catchError('SummaryDashboard', 'Error in storage callback', innerErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('SummaryDashboard', 'Failed storage get', err);
        }
    }

    /**
     * Generates and renders all sections of the summary report into the DOM:
     * KPI cards, actionable insights, daily bar chart, and topic mastery lists.
     */
    renderReport(): void {
        try {
            const root = document.getElementById('root');
            if (root) {
                render(<SummaryApp dashboard={this} />, root);
                return;
            }

            const report: SummaryReport = this.getReport();

            // Subtitle Date Range
            const subtitleEl = document.getElementById('summary-date-subtitle');
            if (subtitleEl) {
                subtitleEl.innerText = `${report.periodLabel} (${report.startDateStr} — ${report.endDateStr}) ·`;
            }

            // 1. KPI Cards
            const reviewsEl = document.getElementById('kpi-reviews');
            const reviewsTrendEl = document.getElementById('kpi-reviews-trend');
            const reviewsSubEl = document.getElementById('kpi-reviews-sub');

            if (reviewsEl) reviewsEl.innerText = String(report.totalReviews);
            if (reviewsTrendEl) {
                const diff = report.reviewsChangePct;
                const sign = diff > 0 ? '+' : '';
                reviewsTrendEl.innerText = `${sign}${diff}%`;
                reviewsTrendEl.className = `kpi-badge ${diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral'}`;
            }
            if (reviewsSubEl) {
                reviewsSubEl.innerText = `vs ${report.prevPeriodReviews} in prev ${this.currentPeriod === 'weekly' ? 'week' : 'month'}`;
            }

            const retentionEl = document.getElementById('kpi-retention');
            const retentionTrendEl = document.getElementById('kpi-retention-trend');
            const retentionSubEl = document.getElementById('kpi-retention-sub');

            if (retentionEl) retentionEl.innerText = `${report.retentionRate}%`;
            if (retentionTrendEl) {
                const diff = report.retentionChangeDiff;
                const sign = diff > 0 ? '+' : '';
                retentionTrendEl.innerText = `${sign}${diff}%`;
                retentionTrendEl.className = `kpi-badge ${diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral'}`;
            }
            if (retentionSubEl) {
                retentionSubEl.innerText = `prev period: ${report.prevRetentionRate}%`;
            }

            const newCardsEl = document.getElementById('kpi-new-cards');
            if (newCardsEl) newCardsEl.innerText = String(report.newCardsLearned);

            const activeDaysEl = document.getElementById('kpi-active-days');
            const activeDaysSubEl = document.getElementById('kpi-active-days-sub');
            if (activeDaysEl) activeDaysEl.innerText = `${report.activeDays}/${report.totalDaysInPeriod}`;
            if (activeDaysSubEl) {
                const pct = Math.round((report.activeDays / report.totalDaysInPeriod) * 100);
                activeDaysSubEl.innerText = `${pct}% active days`;
            }

            // 2. Smart Insights Section
            const insightsContainer = document.getElementById('insights-container');
            if (insightsContainer) {
                render(<SummaryInsightsList insights={report.insights} />, insightsContainer);
            }

            // 3. Activity Chart (Daily Breakdown)
            const chartContainer = document.getElementById('activity-chart-container');
            if (chartContainer) {
                render(
                    <SummaryActivityChart
                        dailyActivity={report.dailyActivity}
                        isMonthly={this.currentPeriod === 'monthly'}
                    />,
                    chartContainer
                );
            }

            // 4. Health Metrics
            const avgStabilityEl = document.getElementById('metric-avg-stability');
            if (avgStabilityEl) avgStabilityEl.innerText = `${report.avgStability}d`;

            const leechEl = document.getElementById('metric-leeches');
            if (leechEl) leechEl.innerText = String(report.leechCount);

            const streakEl = document.getElementById('metric-streak');
            if (streakEl) streakEl.innerText = `${report.longestStreakInPeriod} day${report.longestStreakInPeriod === 1 ? '' : 's'}`;

            // 5. Topic Mastery & Weak Topics
            const topTopicsContainer = document.getElementById('top-topics-container');
            if (topTopicsContainer) {
                render(<SummaryTopicMasteryList containerId="top-topics-container" topics={report.topTopics} />, topTopicsContainer);
            }

            const weakTopicsContainer = document.getElementById('weak-topics-container');
            if (weakTopicsContainer) {
                render(<SummaryTopicMasteryList containerId="weak-topics-container" topics={report.weakestTopics} />, weakTopicsContainer);
            }

        } catch (err) {
            UIUtils.catchError('SummaryDashboard', 'Error rendering report', err);
        }
    }
}

/**
 * Initializes the summary dashboard controller on DOM load.
 */
export function initSummaryDashboard(): void {
    try {
        const root = document.getElementById('root');
        const summaryApp = new SummaryDashboard();
        if (root) {
            render(<SummaryApp dashboard={summaryApp} />, root);
        } else {
            summaryApp.init();
        }
    } catch (err) {
        UIUtils.catchError('SummaryDashboard', 'Initialization failed', err);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSummaryDashboard);
    } else {
        initSummaryDashboard();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).SummaryDashboard = SummaryDashboard;
    (module.exports as any).SummaryPeriodTabs = SummaryPeriodTabs;
    (module.exports as any).SummaryKpiGrid = SummaryKpiGrid;
    (module.exports as any).SummaryInsightsList = SummaryInsightsList;
    (module.exports as any).SummaryActivityChart = SummaryActivityChart;
    (module.exports as any).SummaryTopicMasteryList = SummaryTopicMasteryList;
    (module.exports as any).SummaryApp = SummaryApp;
    (module.exports as any).initSummaryDashboard = initSummaryDashboard;
}
