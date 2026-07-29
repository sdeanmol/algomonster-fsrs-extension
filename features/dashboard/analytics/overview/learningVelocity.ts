/**
 * @file features/dashboard/analytics/overview/learningVelocity.ts
 * @description Component for rendering learning velocity metrics and sparkline charts.
 */

import { Logger } from '@common/logger';
import { DataUtils } from '../utils/dataUtils';

export class LearningVelocity {
    dataUtils: DataUtils;

    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('LearningVelocity', `Error initializing LearningVelocity constructor: ${errorMessage}`, { err });
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

            const formatTrend = (val: number) => {
                try {
                    if (val === 0) return `<span class="kpi-trend" style="color:var(--md-text-low);">0%</span>`;
                    if (val > 0) return `<span class="kpi-trend trend-up">▲ ${val}%</span>`;
                    return `<span class="kpi-trend trend-down">▼ ${Math.abs(val)}%</span>`;
                } catch (trendErr) {
                    const errorMessage = trendErr instanceof Error ? trendErr.message : String(trendErr);
                    Logger.error('LearningVelocity', `Error formatting trend value: ${errorMessage}`, { val, trendErr });
                    return `<span class="kpi-trend" style="color:var(--md-text-low);">0%</span>`;
                }
            };

            container.innerHTML = `
                <div class="ana-panel-header" style="margin-bottom:0;">
                    <span class="ana-panel-title">
                        Learning Velocity
                        <span class="help-icon" data-tooltip="How fast you are acquiring new knowledge and moving cards into long-term memory.">?</span>
                    </span>
                </div>
                <div class="velocity-kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-header">
                            <span class="kpi-title">
                                New Cards/Day
                                <span class="help-icon" data-tooltip="The average number of new cards you learn each day.">?</span>
                            </span>
                            ${formatTrend(velocity.newCardsTrend)}
                        </div>
                        <div class="kpi-value">${velocity.newCardsPerDay} <span class="kpi-unit">/day</span></div>
                        <div class="kpi-sparkline">${sparkline1}</div>
                    </div>
                    
                    <div class="kpi-card">
                        <div class="kpi-header">
                            <span class="kpi-title">
                                Graduated/Week
                                <span class="help-icon" data-tooltip="Cards that have successfully moved out of the learning phase this week.">?</span>
                            </span>
                            ${formatTrend(velocity.graduatedTrend)}
                        </div>
                        <div class="kpi-value">${velocity.graduatedPerWeek} <span class="kpi-unit">/week</span></div>
                        <div class="kpi-sparkline">${sparkline2}</div>
                    </div>

                    <div class="kpi-card">
                        <div class="kpi-header">
                            <span class="kpi-title">
                                Total Reviews
                                <span class="help-icon" data-tooltip="The overall count of reviews you've completed across all time.">?</span>
                            </span>
                            ${formatTrend(velocity.reviewsTrend)}
                        </div>
                        <div class="kpi-value">${velocity.reviewsPerDay} <span class="kpi-unit">/day</span></div>
                        <div class="kpi-sparkline">${sparkline3}</div>
                    </div>
                </div>
            `;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('LearningVelocity', `Error rendering LearningVelocity: ${errorMessage}`, { containerId, err });
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
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('LearningVelocity', `Error generating sparkline SVG: ${errorMessage}`, { color, dataArray, err });
            return '';
        }
    }
}
