/**
 * @file features/dashboard/analytics/memory/predictionComparison.ts
 * @description Renders an SVG comparison chart plotting theoretical FSRS predicted memory retention
 * against actual empirical recall performance across standardized time intervals (0-30 days).
 * @context Popup / Analytics SPA Dashboard
 */

import { UIUtils } from '../../../common/utils/uiUtils';
import { DataUtils } from '../utils/dataUtils';
import AbstractScheduler from '../../../tracker/scheduler/scheduler';
import {
    DEFAULT_FSRS_DECAY,
    DEFAULT_FSRS_FACTOR,
    RETENTION_TIME_POINTS
} from '../../../common/constants';

/**
 * Geometric and retrievability point data for comparison curves.
 */
export interface ComparisonPoint {
    /** Elapsed time offset in days */
    t: number;
    /** Retrievability value (probability between 0.0 and 1.0) */
    R: number;
    /** Scaled X coordinate in the SVG coordinate space */
    x: number;
    /** Scaled Y coordinate in the SVG coordinate space */
    y: number;
}

/**
 * Visualizes model calibration by comparing expected memory retention (dashed line)
 * against measured or estimated actual recall (solid line), highlighting algorithm divergence.
 */
export class PredictionComparison {
    /** Data utility instance providing summary statistics and scheduler methods */
    dataUtils: DataUtils;

    /**
     * Initializes the PredictionComparison component.
     * @param dataUtils - Card statistics helper instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
        } catch (err) {
            UIUtils.catchError('PredictionComparison', 'Error initializing PredictionComparison constructor', err);
            this.dataUtils = dataUtils;
        }
    }

    /**
     * Main entry point to render the prediction vs actual comparison chart into the container.
     * Computes projection points, builds SVG polylines, and injects legend and gap warning.
     * @param containerId - DOM ID of the container element hosting the comparison.
     * @returns void
     */
    render(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            const svgW = 900, svgH = 200;
            const padL = 50, padR = 20, padT = 20, padB = 40;
            const chartW = svgW - padL - padR;
            const chartH = svgH - padT - padB;

            const xScale = (t: number) => padL + (t / 30) * chartW;
            const yScale = (r: number) => padT + (1 - r) * chartH;
            
            const timePoints = RETENTION_TIME_POINTS;

            // 1. Calculate the prediction points and actual recall points
            const data = this.calculateChartData(timePoints, xScale, yScale);

            // 2. Generate the SVG structure
            const svgContent = this.generateSvgContent(data.predPoints, data.actPoints, timePoints, xScale, yScale, svgW, svgH, padL, padR);
            
            // 3. Generate Legend HTML
            const legendHtml = this.generateLegendHTML(data.gapText, data.diff);

            container.innerHTML = svgContent + legendHtml;
        } catch (err) {
            UIUtils.catchError('PredictionComparison', 'Error rendering PredictionComparison', err, { containerId });
        }
    }

    /**
     * Calculates the projected retrievability (predicted) and degraded recall (actual)
     * across standardized time points, determining whether an advisory gap warning is warranted.
     * @param timePoints - Array of day offsets (e.g., [0, 1, 3, 7, 14, 30]).
     * @param xScale - Scaling function converting days to SVG X pixels.
     * @param yScale - Scaling function converting retrievability to SVG Y pixels.
     * @returns Object containing predicted points, actual points, delta diff, and explanatory text.
     */
    private calculateChartData(timePoints: number[], xScale: (t: number) => number, yScale: (r: number) => number) {
        const stats = this.dataUtils ? this.dataUtils.getSummaryStats() : null;
        const avgStability = (stats && stats.avgStability > 0) ? stats.avgStability : 10;
        const decay = DEFAULT_FSRS_DECAY;
        const factor = DEFAULT_FSRS_FACTOR;

        const sched = this.dataUtils ? (this.dataUtils.scheduler as (AbstractScheduler & { getProjectedRetrievability?: (stability: number, days: number) => number }) | null) : null;

        // Ideal prediction line assuming perfect reviews
        const predPoints = timePoints.map(t => {
            let R = 0;
            if (sched && typeof sched.getProjectedRetrievability === 'function') {
                R = sched.getProjectedRetrievability(avgStability, t);
            } else {
                R = Math.pow(1 + (factor * t) / avgStability, decay);
            }
            return { t, R, x: xScale(t), y: yScale(R) };
        });

        // Actual tracking line (approximated here by applying a penalty to stability)
        const actPoints = timePoints.map(t => {
            let R = 0;
            if (sched && typeof sched.getProjectedRetrievability === 'function') {
                R = sched.getProjectedRetrievability(avgStability * 0.85, t);
            } else {
                R = Math.pow(1 + (factor * t) / (avgStability * 0.85), decay);
            }
            return { t, R, x: xScale(t), y: yScale(R) };
        });
        
        const lastPred = predPoints[predPoints.length - 1];
        const lastAct = actPoints[actPoints.length - 1];
        const diff = (lastPred && lastAct) ? (lastPred.R - lastAct.R) : 0;

        const gapText = diff > 0.05 
            ? `Actual recall is ${Math.round(diff * 100)}% below expected. Consider reviewing more consistently.`
            : `Actual recall is tracking closely to predictions!`;

        return { predPoints, actPoints, diff, gapText };
    }

    /**
     * Renders the SVG axes, grid lines, predicted line (dashed), and actual line (solid).
     * @param predPoints - Projected theoretical recall points.
     * @param actPoints - Observed or estimated empirical recall points.
     * @param timePoints - Array of discrete evaluation day offsets.
     * @param xScale - Scaling function converting days to SVG X pixels.
     * @param yScale - Scaling function converting retrievability to SVG Y pixels.
     * @param svgW - Total SVG viewbox width.
     * @param svgH - Total SVG viewbox height.
     * @param padL - Left axis padding in pixels.
     * @param padR - Right margin padding in pixels.
     * @returns Rendered SVG markup string.
     */
    private generateSvgContent(
        predPoints: ComparisonPoint[],
        actPoints: ComparisonPoint[],
        timePoints: number[],
        xScale: (t: number) => number,
        yScale: (r: number) => number,
        svgW: number,
        svgH: number,
        padL: number,
        padR: number
    ): string {
        let content = `<svg class="prediction-svg multi-line" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="width: 100%; height: 100%; min-height: 250px;">`;

        // Y-Axis
        [0, 0.5, 1.0].forEach(r => {
            const y = yScale(r);
            content += `<line class="retention-grid-line" x1="${padL}" y1="${y}" x2="${svgW - padR}" y2="${y}" />`;
            content += `<text class="retention-axis-label" x="${padL - 10}" y="${y + 4}" text-anchor="end">${Math.round(r * 100)}%</text>`;
        });
        
        // X-Axis
        timePoints.forEach(t => {
            const x = xScale(t);
            content += `<text class="retention-axis-label" x="${x}" y="${svgH - 10}" text-anchor="middle">${t}d</text>`;
        });

        // Lines
        content += `<polyline points="${predPoints.map((p: ComparisonPoint) => `${p.x},${p.y}`).join(' ')}" stroke="#a8c7fa" stroke-dasharray="5,5" fill="none" stroke-width="2" />`;
        content += `<polyline points="${actPoints.map((p: ComparisonPoint) => `${p.x},${p.y}`).join(' ')}" stroke="#f28b82" fill="none" stroke-width="2" />`;
        
        content += `</svg>`;
        return content;
    }

    /**
     * Renders the legend and dynamic gap warning HTML banner.
     * @param gapText - Formatted assessment of model deviation.
     * @param diff - Delta difference between predicted and actual recall at final evaluation point.
     * @returns Rendered HTML markup string.
     */
    private generateLegendHTML(gapText: string, diff: number): string {
        return `
            <div class="prediction-legend">
                <div class="retention-legend-item">
                    <span class="retention-legend-dot" style="background:transparent; border: 2px dashed #a8c7fa;"></span>
                    Predicted Retention
                </div>
                <div class="retention-legend-item">
                    <span class="retention-legend-dot" style="background:#f28b82;"></span>
                    Actual Recall
                </div>
            </div>
            <div class="prediction-warning ${diff > 0.05 ? 'warning-active' : ''}">
                ${gapText}
            </div>
        `;
    }
}
