/**
 * @file features/dashboard/analytics/overview/memoryHealth.ts
 * @description Component for rendering the overall Memory Health score, radial status ring,
 * and key performance metrics (retention, lapses, stability, review streak) within the analytics overview.
 * @context Popup / Analytics SPA Dashboard
 */

import { UIUtils } from '../../../common/utils/uiUtils';
import { DataUtils, SummaryStats } from '../utils/dataUtils';
import AbstractScheduler from '../../../tracker/scheduler/scheduler';

/**
 * Summary statistics shape required for computing and rendering the Memory Health card.
 */
export interface MemoryHealthInputStats {
    /** Measured FSRS true retention percentage (0-100) */
    trueRetention?: number;
    /** Fallback retention percentage if trueRetention is uncalculated */
    retention?: number;
    /** Number of consecutive active study days */
    streak?: number;
    /** Cumulative count of card lapses across the entire deck */
    totalLapses?: number;
    /** Average memory stability across all cards in days */
    avgStability?: number;
}

/**
 * Visualizes overall deck memory health using an animated SVG radial progress ring
 * and a summary grid of foundational retention and consistency metrics.
 */
export class MemoryHealth {
    /** Data utility instance for querying summary metrics and active scheduler configurations */
    dataUtils: DataUtils;

    /**
     * Initializes the MemoryHealth component.
     * @param dataUtils - Card statistics helper instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
        } catch (err) {
            UIUtils.catchError('MemoryHealth', 'Error initializing MemoryHealth constructor', err);
            this.dataUtils = dataUtils;
        }
    }

    /**
     * Calculates health scores, builds the radial SVG ring, and injects the memory health card into the container.
     * @param containerId - DOM ID of the container element hosting memory health.
     * @returns void
     */
    render(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            const stats = this.dataUtils.getSummaryStats();
            const healthScore = this.calculateHealthScore(stats);
            const targetRetention = this.getTargetRetention();

            let statusText = 'Excellent';
            let statusClass = 'health-excellent';
            if (healthScore === 0) { 
                statusText = 'Need Data'; 
                statusClass = 'health-nodata'; 
            } else if (healthScore < targetRetention - 7) { 
                statusText = 'Needs Attention'; 
                statusClass = 'health-warning'; 
            } else if (healthScore < targetRetention - 2) { 
                statusText = 'Good'; 
                statusClass = 'health-good'; 
            }

            const trend = stats.streak >= 3 ? '▲ Consistent' : (stats.streak > 0 ? '▶ Active' : '▼ Needs Review');
            const trendMsg = stats.streak >= 3 ? 'You are building strong long-term memory.' : 'Review more consistently to improve memory health.';
            const trendClass = stats.streak >= 3 ? 'trend-up' : (stats.streak > 0 ? '' : 'trend-down');

            const svgCircle = `
                <svg class="health-ring" viewBox="0 0 120 120">
                    <circle class="ring-bg" cx="60" cy="60" r="50"></circle>
                    <circle class="ring-progress ${statusClass}" cx="60" cy="60" r="50" 
                            stroke-dasharray="314" stroke-dashoffset="${314 - (314 * healthScore / 100)}">
                    </circle>
                </svg>
            `;

            container.innerHTML = this.buildHealthCard(healthScore, statusText, statusClass, trend, trendMsg, trendClass, svgCircle, stats);
        } catch (err) {
            UIUtils.catchError('MemoryHealth', 'Error rendering MemoryHealth', err, { containerId });
        }
    }

    /**
     * Extracts or derives the numerical health score from the summary statistics object.
     * @param stats - Measured study and retention metrics.
     * @returns Memory health score between 0 and 100.
     */
    private calculateHealthScore(stats: MemoryHealthInputStats): number {
        if (stats.trueRetention && stats.trueRetention > 0) return stats.trueRetention;
        if (stats.retention && stats.retention > 0) return stats.retention;
        return 0;
    }

    /**
     * Retrieves the target requested retention percentage configured in the active FSRS scheduler,
     * defaulting to 90% if not explicitly configured.
     * @returns Target retention percentage (0-100).
     */
    private getTargetRetention(): number {
        const sched = this.dataUtils.scheduler as (AbstractScheduler & { requestRetention?: number }) | null;
        if (sched && sched.requestRetention) {
            return sched.requestRetention * 100;
        }
        return 90;
    }

    /**
     * Builds the complete HTML card markup containing the SVG radial ring,
     * textual status assessment, and 4-metric footer grid.
     * @param healthScore - Calculated score value out of 100.
     * @param statusText - Qualitative rating ('Excellent', 'Good', 'Needs Attention', or 'Need Data').
     * @param statusClass - CSS class name for styling the status badge and ring stroke.
     * @param trend - Trend indicator string with directional arrow.
     * @param trendMsg - Narrative feedback advice.
     * @param trendClass - CSS class name applied to trend text.
     * @param svgCircle - Rendered SVG radial gauge markup string.
     * @param stats - Underlying metric inputs.
     * @returns Rendered HTML card markup string.
     */
    private buildHealthCard(
        healthScore: number,
        statusText: string,
        statusClass: string,
        trend: string,
        trendMsg: string,
        trendClass: string,
        svgCircle: string,
        stats: MemoryHealthInputStats
    ): string {
        return `
            <div class="memory-health-card">
                <div class="ana-panel-header">
                    <span class="ana-panel-title">
                        Memory Health Score
                        <span class="help-icon" data-tooltip="A composite score out of 100 based on your current retention rate and how consistently you review. Aim for 85+.">?</span>
                    </span>
                </div>
                <div class="health-content">
                    <div class="health-ring-wrapper">
                        ${svgCircle}
                        <div class="health-score-center">
                            <span class="score-value">${healthScore}</span>
                            <span class="score-max">/ 100</span>
                        </div>
                    </div>
                    <div class="health-details">
                        <div class="health-status ${statusClass}">${statusText}</div>
                        <div class="health-trend ${trendClass}">${trend}</div>
                        <p class="health-msg">${trendMsg}</p>
                    </div>
                </div>
                <div class="health-metrics-grid">
                    <div class="health-metric">
                        <div class="hm-val">${stats.trueRetention}%</div>
                        <div class="hm-lbl">Retention <span class="help-icon" data-tooltip="Probability you will remember your cards right now (FSRS Retrievability).">?</span></div>
                    </div>
                    <div class="health-metric">
                        <div class="hm-val">${stats.totalLapses}</div>
                        <div class="hm-lbl">Total Lapses <span class="help-icon" data-tooltip="Total number of times you have forgotten a card (rated 'Again').">?</span></div>
                    </div>
                    <div class="health-metric">
                        <div class="hm-val">${(stats.avgStability || 0).toFixed(1)}d</div>
                        <div class="hm-lbl">Avg Stability <span class="help-icon" data-tooltip="Average time it takes for your retention to drop from 100% to 90%.">?</span></div>
                    </div>
                    <div class="health-metric">
                        <div class="hm-val">${stats.streak}d</div>
                        <div class="hm-lbl">Streak <span class="help-icon" data-tooltip="Consecutive days you have studied at least one card.">?</span></div>
                    </div>
                </div>
            </div>
        `;
    }
}
