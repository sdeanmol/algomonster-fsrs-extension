/**
 * @file features/dashboard/summary/summary.tsx
 * @description Controller for the dynamic Weekly and Monthly Digest Summary page.
 * Aggregates study metrics, retention trends, leech patterns, topic mastery distributions,
 * and generates actionable study insights.
 * Migrated to Preact with TypeScript for modular summary cards, charts, and topic bars.
 *
 * Architecture Role: Summary Digest Standalone Page Controller.
 * Context: Extension Standalone Tab (`features/dashboard/summary/summary.html`).
 * Key Exports:
 * - `SummaryPeriodTabs`: Preact component for weekly vs monthly period switching.
 * - `SummaryKpiGrid`: Preact component for KPI metric cards and trend badges.
 * - `SummaryInsightsList`: Preact component for smart recommendation callouts.
 * - `SummaryActivityChart`: Preact component for daily review activity bar chart.
 * - `SummaryTopicMasteryList`: Preact component for topic mastery and weak topics progress bars.
 * - `SummaryDashboard`: Master controller class managing timeframe tabs and digest rendering.
 */

import { h, VNode } from 'preact';
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
        <div className="period-tabs" role="tablist">
            <button
                id="period-weekly-btn"
                className={`tab-btn ${isWeekly ? 'active' : ''}`}
                role="tab"
                aria-selected={isWeekly ? 'true' : 'false'}
                onClick={() => onSelectPeriod('weekly')}
            >
                Weekly Digest
            </button>
            <button
                id="period-monthly-btn"
                className={`tab-btn ${!isWeekly ? 'active' : ''}`}
                role="tab"
                aria-selected={!isWeekly ? 'true' : 'false'}
                onClick={() => onSelectPeriod('monthly')}
            >
                Monthly Digest
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
    const activeDaysPct = Math.round((report.activeDays / report.totalDaysInPeriod) * 100);

    return (
        <div className="kpi-grid">
            <div className="kpi-card">
                <div className="kpi-header">
                    <span className="kpi-label">Total Reviews</span>
                    <span id="kpi-reviews-trend" className={`kpi-badge ${reviewsTrendClass}`}>
                        {reviewsSign}{reviewsDiff}%
                    </span>
                </div>
                <div id="kpi-reviews" className="kpi-value">{report.totalReviews}</div>
                <div id="kpi-reviews-sub" className="kpi-sub">
                    vs {report.prevPeriodReviews} in prev {currentPeriod === 'weekly' ? 'week' : 'month'}
                </div>
            </div>

            <div className="kpi-card">
                <div className="kpi-header">
                    <span className="kpi-label">Retention Rate</span>
                    <span id="kpi-retention-trend" className={`kpi-badge ${retentionTrendClass}`}>
                        {retentionSign}{retentionDiff}%
                    </span>
                </div>
                <div id="kpi-retention" className="kpi-value">{report.retentionRate}%</div>
                <div id="kpi-retention-sub" className="kpi-sub">
                    prev period: {report.prevRetentionRate}%
                </div>
            </div>

            <div className="kpi-card">
                <div className="kpi-header">
                    <span className="kpi-label">New Cards Learned</span>
                </div>
                <div id="kpi-new-cards" className="kpi-value">{report.newCardsLearned}</div>
                <div className="kpi-sub">Introduced this period</div>
            </div>

            <div className="kpi-card">
                <div className="kpi-header">
                    <span className="kpi-label">Active Days</span>
                </div>
                <div id="kpi-active-days" className="kpi-value">
                    {report.activeDays}/{report.totalDaysInPeriod}
                </div>
                <div id="kpi-active-days-sub" className="kpi-sub">
                    {activeDaysPct}% active days
                </div>
            </div>
        </div>
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
            <div id="insights-container" className="insights-container">
                <div className="empty-state">No specific recommendations for this period.</div>
            </div>
        );
    }

    return (
        <div id="insights-container" className="insights-container">
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
        <div id="activity-chart-container" className="chart-bars-container">
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
    title: string;
    containerId: string;
    topics: TopicMastery[];
}

/**
 * Preact component rendering topic mastery percentage bars.
 */
export function SummaryTopicMasteryList({
    title,
    containerId,
    topics
}: SummaryTopicMasteryListProps): VNode {
    if (topics.length === 0) {
        return (
            <div className="topic-card">
                <h3>{title}</h3>
                <div id={containerId}>
                    <div className="empty-state">No topic data logged in this timeframe.</div>
                </div>
            </div>
        );
    }

    return (
        <div className="topic-card">
            <h3>{title}</h3>
            <div id={containerId}>
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

    /**
     * Initializes the summary digest by parsing URL parameters, binding tab controls,
     * and reading card records from local storage.
     */
    init(): void {
        try {
            // Read URL params if timeframe is passed e.g. ?period=monthly
            const urlParams = new URLSearchParams(window.location.search);
            const periodParam = urlParams.get('period') || urlParams.get('timeframe');
            if (periodParam === 'monthly') {
                this.currentPeriod = 'monthly';
            }

            this.bindEvents();
            this.loadData();
        } catch (err) {
            UIUtils.catchError('SummaryDashboard', 'Error during init', err);
        }
    }

    /**
     * Attaches click handlers to the weekly and monthly timeframe toggle buttons.
     */
    private bindEvents(): void {
        const weeklyBtn = document.getElementById('period-weekly-btn');
        const monthlyBtn = document.getElementById('period-monthly-btn');

        if (weeklyBtn) {
            weeklyBtn.addEventListener('click', () => {
                if (this.currentPeriod !== 'weekly') {
                    this.currentPeriod = 'weekly';
                    this.updateTabUI();
                    this.renderReport();
                }
            });
        }

        if (monthlyBtn) {
            monthlyBtn.addEventListener('click', () => {
                if (this.currentPeriod !== 'monthly') {
                    this.currentPeriod = 'monthly';
                    this.updateTabUI();
                    this.renderReport();
                }
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
    private renderReport(): void {
        try {
            const report: SummaryReport = generateSummaryReport(
                this.allCards,
                this.fsrsActivity,
                this.currentPeriod
            );

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
                if (report.insights.length === 0) {
                    insightsContainer.innerHTML = `<div class="empty-state">No specific recommendations for this period.</div>`;
                } else {
                    insightsContainer.innerHTML = report.insights.map((insight: SummaryInsight) => `
                        <div class="insight-item ${insight.type}">
                            <span class="insight-icon">${insight.icon}</span>
                            <div class="insight-content">
                                <span class="insight-title">${insight.title}</span>
                                <span class="insight-desc">${insight.description}</span>
                            </div>
                        </div>
                    `).join('');
                }
            }

            // 3. Activity Chart (Daily Breakdown)
            const chartContainer = document.getElementById('activity-chart-container');
            if (chartContainer) {
                const maxCount = Math.max(...report.dailyActivity.map(a => a.count), 1);
                const isMonthly = this.currentPeriod === 'monthly';
                const totalPoints = report.dailyActivity.length;

                chartContainer.innerHTML = report.dailyActivity.map((pt, idx) => {
                    const heightPct = pt.count > 0 ? Math.max(Math.round((pt.count / maxCount) * 100), 10) : 0;
                    // In monthly mode (30 points), render date text for every 5th bar and the final bar
                    const showLabel = !isMonthly || idx % 5 === 0 || idx === totalPoints - 1;
                    return `
                        <div class="chart-bar-wrapper" title="${pt.fullDate}: ${pt.count} review(s)">
                            <div class="chart-bar ${pt.count === 0 ? 'zero' : ''}" style="height: ${heightPct}%;"></div>
                            <span class="chart-label ${showLabel ? '' : 'hidden-label'}">${showLabel ? pt.dateStr : ''}</span>
                        </div>
                    `;
                }).join('');
            }

            // 4. Health Metrics
            const avgStabilityEl = document.getElementById('metric-avg-stability');
            if (avgStabilityEl) avgStabilityEl.innerText = `${report.avgStability}d`;

            const leechEl = document.getElementById('metric-leeches');
            if (leechEl) leechEl.innerText = String(report.leechCount);

            const streakEl = document.getElementById('metric-streak');
            if (streakEl) streakEl.innerText = `${report.longestStreakInPeriod} day${report.longestStreakInPeriod === 1 ? '' : 's'}`;

            // 5. Topic Mastery & Weak Topics
            const renderTopicList = (containerId: string, topics: TopicMastery[], isWeak: boolean) => {
                const container = document.getElementById(containerId);
                if (!container) return;

                if (topics.length === 0) {
                    container.innerHTML = `<div class="empty-state">No topic data logged in this timeframe.</div>`;
                    return;
                }

                container.innerHTML = topics.map(t => {
                    const fillClass = t.retentionRate >= 80 ? 'high' : t.retentionRate >= 60 ? 'medium' : 'low';
                    return `
                        <div class="topic-row">
                            <div class="topic-header">
                                <span class="topic-name">${t.tag}</span>
                                <span class="topic-stats">${t.retentionRate}% (${t.successReviews}/${t.totalReviews})</span>
                            </div>
                            <div class="topic-bar-bg">
                                <div class="topic-bar-fill ${fillClass}" style="width: ${t.retentionRate}%;"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            };

            renderTopicList('top-topics-container', report.topTopics, false);
            renderTopicList('weak-topics-container', report.weakestTopics, true);

        } catch (err) {
            UIUtils.catchError('SummaryDashboard', 'Error rendering report', err);
        }
    }
}

/**
 * Initializes the summary dashboard controller on DOM load.
 */
function initSummaryDashboard(): void {
    try {
        const summaryApp = new SummaryDashboard();
        summaryApp.init();
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
}
