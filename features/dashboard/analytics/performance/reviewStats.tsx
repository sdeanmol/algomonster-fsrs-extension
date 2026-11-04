/**
 * @file features/dashboard/analytics/performance/reviewStats.tsx
 * @description Renders study review volume histograms and activity statistics over daily (14 days),
 * weekly (12 weeks), or monthly (12 months) periods.
 * @context Popup / Analytics SPA Dashboard
 */

import { h, Fragment, FunctionalComponent } from 'preact';
import { Logger } from '@common/logger';
import { DataUtils } from '../utils/dataUtils';

export interface ReviewStatMiniProps {
    value: string | number;
    label: string;
}

export const ReviewStatMini: FunctionalComponent<ReviewStatMiniProps> = ({ value, label }) => {
    return (
        <div class="review-stat-mini">
            <div class="review-stat-value">{value}</div>
            <div class="review-stat-label">{label}</div>
        </div>
    );
};

export interface ReviewBarColProps {
    tooltip: string;
    label: string;
    value: number;
    heightPct: number;
}

export const ReviewBarCol: FunctionalComponent<ReviewBarColProps> = ({ tooltip, label, value, heightPct }) => {
    const barClass = value === 0 ? 'review-bar review-bar-zero' : 'review-bar';
    return (
        <div class="review-bar-col" title={tooltip}>
            <div class={barClass} style={{ height: `${Math.max(heightPct, 3)}%` }} />
            <div class="review-bar-label">{label}</div>
        </div>
    );
};

/**
 * Visualizes historical review volume as vertical bars and summarizes key review metrics
 * (total reviews, average per period, and active period count).
 */
export class ReviewStats {
    /** Data utility instance for review activity queries and date key formatting */
    dataUtils: DataUtils;
    /** Current time aggregation bucket period ('daily' | 'weekly' | 'monthly') */
    period: string;

    /**
     * Creates an instance of ReviewStats.
     * @param dataUtils - Card statistics and study history utility instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
            this.period = 'daily';
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ReviewStats', `Error initializing ReviewStats constructor: ${errorMessage}`, { err });
            this.dataUtils = dataUtils;
            this.period = 'daily';
        }
    }

    /**
     * Updates the time aggregation bucket period.
     * @param period - Time frame bucket ('daily', 'weekly', or 'monthly').
     * @returns void
     */
    setPeriod(period: string): void {
        try {
            this.period = period || 'daily';
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ReviewStats', `Error setting review stats period: ${errorMessage}`, { period, err });
        }
    }

    /**
     * Generates the summary KPI tiles and vertical bar chart for review activity across the selected period,
     * injecting the HTML into the target container element.
     * @param containerId - DOM ID of the container element hosting the review stats.
     * @returns void
     */
    render(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            const activity = this.dataUtils ? (this.dataUtils.activity || {}) : {};
            const sortedDates = Object.keys(activity).sort();
            if (sortedDates.length === 0) {
                container.innerHTML = '<div class="retention-empty">No review activity recorded yet.</div>';
                return;
            }

            const buckets: Array<{ label: string; tooltip: string; value: number }> = [];
            let totalReviews = 0;
            let activePeriods = 0;

            if (this.period === 'daily') {
                const today = new Date();
                for (let i = 13; i >= 0; i--) {
                    const d = new Date(today);
                    d.setDate(d.getDate() - i);
                    const key = this.dataUtils.formatDateKey(d);
                    const count = activity[key] || 0;
                    totalReviews += count;
                    if (count > 0) activePeriods++;
                    buckets.push({
                        label: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
                        tooltip: `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${count} reviews`,
                        value: count
                    });
                }
            } else if (this.period === 'weekly') {
                const today = new Date();
                for (let w = 11; w >= 0; w--) {
                    let weekTotal = 0;
                    const weekStart = new Date(today);
                    weekStart.setDate(weekStart.getDate() - (w * 7 + 6));
                    for (let d = 0; d < 7; d++) {
                        const day = new Date(weekStart);
                        day.setDate(day.getDate() + d);
                        const key = this.dataUtils.formatDateKey(day);
                        weekTotal += activity[key] || 0;
                    }
                    totalReviews += weekTotal;
                    if (weekTotal > 0) activePeriods++;
                    const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    buckets.push({
                        label: `W${12 - w}`,
                        tooltip: `Week of ${weekLabel}: ${weekTotal} reviews`,
                        value: weekTotal
                    });
                }
            } else if (this.period === 'monthly') {
                const today = new Date();
                for (let m = 11; m >= 0; m--) {
                    const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
                    const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
                    let monthTotal = 0;
                    Object.entries(activity).forEach(([dateStr, count]) => {
                        if (dateStr.startsWith(monthKey)) monthTotal += count;
                    });
                    totalReviews += monthTotal;
                    if (monthTotal > 0) activePeriods++;
                    buckets.push({
                        label: monthDate.toLocaleDateString('en-US', { month: 'short' }),
                        tooltip: `${monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}: ${monthTotal} reviews`,
                        value: monthTotal
                    });
                }
            }

            const avgPerPeriod = activePeriods > 0 ? (totalReviews / buckets.length).toFixed(1) : '0';
            const maxVal = Math.max(...buckets.map(b => b.value), 1);

            const periodLabels: Record<string, string> = { daily: 'Day', weekly: 'Week', monthly: 'Month' };
            let html = `<div class="review-stats-summary">
                <div class="review-stat-mini">
                    <div class="review-stat-value">${totalReviews}</div>
                    <div class="review-stat-label">Total Reviews</div>
                </div>
                <div class="review-stat-mini">
                    <div class="review-stat-value">${avgPerPeriod}</div>
                    <div class="review-stat-label">Avg / ${periodLabels[this.period] || 'Period'}</div>
                </div>
                <div class="review-stat-mini">
                    <div class="review-stat-value">${activePeriods}</div>
                    <div class="review-stat-label">Active ${periodLabels[this.period] || 'Period'}s</div>
                </div>
            </div>`;

            html += '<div class="review-bars-container">';
            buckets.forEach(b => {
                const heightPct = (b.value / maxVal) * 100;
                const barClass = b.value === 0 ? 'review-bar review-bar-zero' : 'review-bar';
                html += `<div class="review-bar-col" title="${b.tooltip}">
                    <div class="${barClass}" style="height:${Math.max(heightPct, 3)}%;"></div>
                    <div class="review-bar-label">${b.label}</div>
                </div>`;
            });
            html += '</div>';

            container.innerHTML = html;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ReviewStats', `Error rendering review stats: ${errorMessage}`, { containerId, period: this.period, err });
        }
    }
}

