/**
 * @file features/dashboard/analytics/overview/learningVelocity.ts
 * @description Component for rendering learning velocity metrics and sparkline charts.
 */

import { UIUtils } from '../../../common/utils/uiUtils';
import { DataUtils } from '../utils/dataUtils';

export class LearningVelocity {
    dataUtils: DataUtils;

    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
        } catch (err) {
            UIUtils.catchError('LearningVelocity', 'Error initializing LearningVelocity constructor', err);
            this.dataUtils = dataUtils;
        }
    }

    render(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            const velocity = this.dataUtils.getLearningVelocity();
            
            const sparkline1 = this.generateSparkline('#a8c7fa', velocity.sparklineNew);
            const sparkline2 = this.generateSparkline('#50e3c2', velocity.sparklineGrad);
            const sparkline3 = this.generateSparkline('#f5a623', velocity.sparklineRev);

            container.innerHTML = `
                <div class="ana-panel-header" style="margin-bottom:0;">
                    <span class="ana-panel-title">
                        Learning Velocity
                        <span class="help-icon" data-tooltip="How fast you are acquiring new knowledge and moving cards into long-term memory.">?</span>
                    </span>
                </div>
                <div class="velocity-kpi-grid">
                    ${this.buildKpiCard('New Cards/Day', 'The average number of new cards you learn each day.', velocity.newCardsTrend, velocity.newCardsPerDay, '/day', sparkline1)}
                    ${this.buildKpiCard('Graduated/Week', 'Cards that have successfully moved out of the learning phase this week.', velocity.graduatedTrend, velocity.graduatedPerWeek, '/week', sparkline2)}
                    ${this.buildKpiCard('Total Reviews', 'The overall count of reviews you\'ve completed across all time.', velocity.reviewsTrend, velocity.reviewsPerDay, '/day', sparkline3)}
                </div>
            `;
        } catch (err) {
            UIUtils.catchError('LearningVelocity', 'Error rendering LearningVelocity', err, { containerId });
        }
    }

    private buildKpiCard(title: string, tooltip: string, trendValue: number, mainValue: string | number, unit: string, sparkline: string): string {
        return `
            <div class="kpi-card">
                <div class="kpi-header">
                    <span class="kpi-title">
                        ${title}
                        <span class="help-icon" data-tooltip="${tooltip}">?</span>
                    </span>
                    ${this.formatTrend(trendValue)}
                </div>
                <div class="kpi-value">${mainValue} <span class="kpi-unit">${unit}</span></div>
                <div class="kpi-sparkline">${sparkline}</div>
            </div>
        `;
    }

    private formatTrend(val: number): string {
        try {
            if (val === 0) return `<span class="kpi-trend" style="color:var(--md-text-low);">0%</span>`;
            if (val > 0) return `<span class="kpi-trend trend-up">▲ ${val}%</span>`;
            return `<span class="kpi-trend trend-down">▼ ${Math.abs(val)}%</span>`;
        } catch (trendErr) {
            UIUtils.catchError('LearningVelocity', 'Error formatting trend value', trendErr, { val });
            return `<span class="kpi-trend" style="color:var(--md-text-low);">0%</span>`;
        }
    }

    generateSparkline(color: string, dataArray: number[] = []): string {
        try {
            if (!dataArray || dataArray.length === 0) return '';
            
            const maxVal = Math.max(...dataArray, 1);
            const pts: string[] = [];
            const xStep = 100 / Math.max(1, dataArray.length - 1);
            
            for (let i = 0; i < dataArray.length; i++) {
                const y = 35 - ((dataArray[i] / maxVal) * 30);
                pts.push(`${i * xStep},${y}`);
            }
            
            return `
                <svg viewBox="0 0 100 40" class="sparkline-svg" preserveAspectRatio="none">
                    <polyline points="${pts.join(' ')}" stroke="${color}" fill="none" stroke-width="2" stroke-linecap="round"/>
                </svg>
            `;
        } catch (err) {
            UIUtils.catchError('LearningVelocity', 'Error generating sparkline SVG', err, { color, dataArray });
            return '';
        }
    }
}
