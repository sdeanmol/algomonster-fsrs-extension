/**
 * @file features/dashboard/summary/summary.ts
 * @description Controller for the dynamic Weekly and Monthly Digest Summary page.
 */

import { Logger } from '@common/logger';
import { StorageData, Card } from '../../../types/domain';
import { generateSummaryReport, SummaryReport, TopicMastery, SummaryInsight } from './summaryGenerator';

export class SummaryDashboard {
    private currentPeriod: 'weekly' | 'monthly' = 'weekly';
    private allCards: Card[] = [];
    private fsrsActivity: { [date: string]: number } = {};

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
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('SummaryDashboard', `Error during init: ${errorMessage}`, { err });
        }
    }

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
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('SummaryDashboard', `Error in storage callback: ${errorMessage}`, { innerErr });
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('SummaryDashboard', `Failed storage get: ${errorMessage}`, { err });
        }
    }

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
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('SummaryDashboard', `Error rendering report: ${errorMessage}`, { err });
        }
    }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    const summaryApp = new SummaryDashboard();
    summaryApp.init();
});
