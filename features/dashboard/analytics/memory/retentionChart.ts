/**
 * @file features/dashboard/analytics/memory/retentionChart.ts
 * @description Renders interactive multi-line retention decay charts with confidence bands.
 */

import { UIUtils } from '../../../common/utils/uiUtils';
import { ConfidenceBand } from './confidenceBand';
import { DataUtils } from '../utils/dataUtils';
import AbstractScheduler from '../../../tracker/scheduler/scheduler';

export class RetentionChart {
    dataUtils: DataUtils;
    scheduler: AbstractScheduler | null;
    groupBy: string;
    showConfidence: boolean;
    chartColors: string[];
    filterTag: string;

    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
            this.scheduler = dataUtils ? dataUtils.scheduler : null;
            this.groupBy = 'tag';
            this.showConfidence = false;
            
            this.chartColors = [
                '#a8c7fa', '#81c995', '#fde293', '#f28b82',
                '#c4a8fa', '#8ecae6', '#f4a261', '#e76f51',
                '#90be6d', '#f9c74f', '#43aa8b', '#577590'
            ];
            this.filterTag = '';
        } catch (err) {
            UIUtils.catchError('RetentionChart', 'Error initializing RetentionChart constructor', err);
            this.dataUtils = dataUtils;
            this.scheduler = dataUtils ? dataUtils.scheduler : null;
            this.groupBy = 'tag';
            this.showConfidence = false;
            this.chartColors = ['#a8c7fa', '#81c995', '#fde293', '#f28b82'];
            this.filterTag = '';
        }
    }

    setFilterTag(tag: string): void {
        try {
            this.filterTag = (tag || '').trim().toLowerCase();
        } catch (err) {
            UIUtils.catchError('RetentionChart', 'Error setting filter tag', err, { tag });
        }
    }

    setGroupBy(type: string): void {
        try {
            this.groupBy = type || 'tag';
        } catch (err) {
            UIUtils.catchError('RetentionChart', 'Error setting group by', err, { type });
        }
    }

    setShowConfidence(show: boolean): void {
        try {
            this.showConfidence = Boolean(show);
        } catch (err) {
            UIUtils.catchError('RetentionChart', 'Error setting show confidence', err, { show });
        }
    }

    /**
     * Main entry point to render the retention chart into the given container.
     * It computes group statistics, builds the SVG, and appends the legend.
     */
    render(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            // 1. Process and group card data
            const groupAvgs = this.calculateGroupStats();
            if (groupAvgs.length === 0) {
                container.innerHTML = '<div class="retention-empty">No reviewed cards yet to generate curves.</div>';
                return;
            }

            const timePoints = [0, 1, 3, 7, 14, 21, 30];
            const svgW = 900, svgH = 250;
            const padL = 50, padR = 20, padT = 20, padB = 40;
            const chartW = svgW - padL - padR;
            const chartH = svgH - padT - padB;

            const xScale = (t: number) => padL + (t / 30) * chartW;
            const yScale = (r: number) => padT + (1 - r) * chartH;

            // 2. Build the SVG Grid and Labels
            let svgContent = `<svg class="retention-curve-svg multi-line" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="width: 100%; height: 100%; min-height: 250px;">`;
            svgContent += this.generateSvgAxes(svgW, svgH, padL, padR, padT, xScale, yScale, timePoints);

            // 3. Render curves and data points for each group
            groupAvgs.forEach((gData, idx) => {
                try {
                    const color = this.chartColors[idx % this.chartColors.length];
                    svgContent += this.generateGroupCurve(gData, color, timePoints, xScale, yScale);
                } catch (groupErr) {
                    UIUtils.catchError('RetentionChart', 'Error rendering curve for retention group', groupErr, { gData });
                }
            });

            svgContent += `</svg>`;

            // 4. Build the Legend HTML
            const legendHtml = this.generateLegendHTML(groupAvgs);

            container.innerHTML = svgContent + legendHtml;
        } catch (err) {
            UIUtils.catchError('RetentionChart', 'Error rendering RetentionChart', err, { containerId, groupBy: this.groupBy, filterTag: this.filterTag });
        }
    }

    /**
     * Groups cards by the selected criteria (tag, deck, difficulty) and returns 
     * the top 6 groups by count with their average stability and difficulty.
     */
    private calculateGroupStats(): Array<{ name: string; avgStability: number; avgDifficulty: number; count: number }> {
        const groups: Record<string, { stabilities: number[]; count: number; difficulties: number[] }> = {};
        
        if (!this.dataUtils || !this.dataUtils.cards) return [];

        this.dataUtils.cards.forEach(card => {
            try {
                // Apply tag filtering if specified
                if (this.filterTag) {
                    const hasTag = card.tags && card.tags.some((t: string) => t.toLowerCase().includes(this.filterTag));
                    if (!hasTag) return;
                }

                // Only consider cards with valid stability
                if (card.stability > 0) {
                    let keys: string[] = [];
                    if (this.groupBy === 'tag') {
                        keys = (card.tags && card.tags.length > 0) ? card.tags : ['Untagged'];
                    } else if (this.groupBy === 'deck') {
                        keys = ['Default']; // Deck support can be expanded here
                    } else if (this.groupBy === 'difficulty') {
                        if (card.difficulty < 3) keys = ['Easy'];
                        else if (card.difficulty < 7) keys = ['Medium'];
                        else keys = ['Hard'];
                    }

                    // Aggregate stats per group
                    keys.forEach(key => {
                        if (!groups[key]) groups[key] = { stabilities: [], count: 0, difficulties: [] };
                        groups[key].stabilities.push(card.stability);
                        groups[key].difficulties.push(card.difficulty || 0);
                        groups[key].count++;
                    });
                }
            } catch (cardErr) {
                UIUtils.catchError('RetentionChart', 'Error processing card for retention chart', cardErr, { card });
            }
        });

        // Convert the aggregated groups into averaged stats, sort by count, and keep top 6
        return Object.keys(groups).map(name => {
            const count = groups[name].count || 1;
            const avgStability = groups[name].stabilities.reduce((a, b) => a + b, 0) / count;
            const avgDifficulty = groups[name].difficulties.reduce((a, b) => a + b, 0) / count;
            return { name, avgStability, avgDifficulty, count };
        }).sort((a, b) => b.count - a.count).slice(0, 6);
    }

    /**
     * Generates the SVG strings for the background grid (Y-axis percentages) 
     * and X-axis time labels.
     */
    private generateSvgAxes(svgW: number, svgH: number, padL: number, padR: number, padT: number, xScale: (t: number) => number, yScale: (r: number) => number, timePoints: number[]): string {
        let content = '';

        // Y-axis grid lines and labels (0% to 100% in 25% increments)
        [0, 0.25, 0.5, 0.75, 1.0].forEach(r => {
            const y = yScale(r);
            content += `<line class="retention-grid-line" x1="${padL}" y1="${y}" x2="${svgW - padR}" y2="${y}" />`;
            content += `<text class="retention-axis-label" x="${padL - 10}" y="${y + 4}" text-anchor="end">${Math.round(r * 100)}%</text>`;
        });

        // X-axis time points
        timePoints.forEach(t => {
            const x = xScale(t);
            content += `<text class="retention-axis-label" x="${x}" y="${svgH - 10}" text-anchor="middle">${t === 0 ? 'Now' : t + 'd'}</text>`;
        });

        return content;
    }

    /**
     * Generates the SVG curve, confidence band, and interactive tooltip dots 
     * for a specific group's memory decay.
     */
    private generateGroupCurve(gData: { name: string; avgStability: number; avgDifficulty: number; count: number }, color: string, timePoints: number[], xScale: (t: number) => number, yScale: (r: number) => number): string {
        let content = '';

        // 1. Calculate projected retrievability points for this curve
        const points = timePoints.map(t => {
            let R = 0;
            const sched = this.scheduler as (AbstractScheduler & { getProjectedRetrievability?: (stability: number, days: number) => number }) | null;
            
            // Prefer the scheduler's robust projection if available, else fallback to standard formula
            if (sched && typeof sched.getProjectedRetrievability === 'function') {
                R = sched.getProjectedRetrievability(gData.avgStability, t);
            } else {
                const stability = gData.avgStability;
                if (stability > 0) {
                    R = Math.pow(1 + ((19 / 81) * t) / stability, -0.5);
                }
            }
            return { t, R, x: xScale(t), y: yScale(R) };
        });

        // 2. Render Confidence Band (Optional)
        if (this.showConfidence) {
            try {
                content += ConfidenceBand.renderBand(points, color, gData.count);
            } catch (bandErr) {
                UIUtils.catchError('RetentionChart', 'Error rendering confidence band', bandErr, { gData });
            }
        }

        // 3. Render the connecting line
        content += `<polyline class="retention-line" points="${points.map(p => `${p.x},${p.y}`).join(' ')}" stroke="${color}" />`;

        // 4. Render interactive dots with tooltips
        points.forEach(p => {
            const tooltipHtml = `
                <div class="chart-tooltip-content">
                    <strong>${gData.name} - ${p.t} Days</strong><br>
                    Retention: ${Math.round(p.R * 100)}%<br>
                    Stability: ${gData.avgStability.toFixed(1)}d<br>
                    Difficulty: ${gData.avgDifficulty.toFixed(1)}<br>
                    Cards: ${gData.count}
                </div>
            `;
            content += `
                <circle class="retention-dot interactive-dot" cx="${p.x}" cy="${p.y}" fill="${color}" r="4" data-tooltip="${encodeURIComponent(tooltipHtml)}">
                    <title>${gData.name}&#10;Retention: ${Math.round(p.R * 100)}%&#10;Stability: ${gData.avgStability.toFixed(1)}d&#10;Difficulty: ${gData.avgDifficulty.toFixed(1)}&#10;Cards: ${gData.count}</title>
                </circle>
            `;
        });

        return content;
    }

    /**
     * Generates the legend HTML mapping colors to group names.
     */
    private generateLegendHTML(groupAvgs: Array<{ name: string; count: number }>): string {
        let legendHtml = '<div class="retention-legend">';
        groupAvgs.forEach((gData, idx) => {
            const color = this.chartColors[idx % this.chartColors.length];
            legendHtml += `
                <div class="retention-legend-item">
                    <span class="retention-legend-dot" style="background:${color};"></span>
                    ${gData.name}
                </div>
            `;
        });
        legendHtml += '</div>';
        return legendHtml;
    }
}
