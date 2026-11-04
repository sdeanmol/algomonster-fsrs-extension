/**
 * @file features/dashboard/analytics/overview/learningVelocity.tsx
 * @description Component for rendering learning velocity metrics and SVG sparkline charts
 * within the analytics overview dashboard. Displays new cards per day, graduated cards per week,
 * total reviews completed, and recent velocity trends.
 * @context Popup / Analytics SPA Dashboard
 */

import { h, Fragment, FunctionalComponent } from 'preact';
import { UIUtils } from '../../../common/utils/uiUtils';
import { DataUtils, LearningVelocity as LearningVelocityData } from '../utils/dataUtils';

export interface LearningVelocityKpiCardProps {
    title: string;
    tooltip: string;
    trendValue: number;
    mainValue: string | number;
    unit: string;
    sparklineSvg?: string;
    sparklinePoints?: number[];
    sparklineColor?: string;
}

export const LearningVelocityKpiCard: FunctionalComponent<LearningVelocityKpiCardProps> = ({
    title,
    tooltip,
    trendValue,
    mainValue,
    unit,
    sparklineSvg,
    sparklinePoints,
    sparklineColor = '#a8c7fa'
}) => {
    let trendNode = <span class="kpi-trend" style="color:var(--md-text-low);">0%</span>;
    if (trendValue > 0) {
        trendNode = <span class="kpi-trend trend-up">▲ {trendValue}%</span>;
    } else if (trendValue < 0) {
        trendNode = <span class="kpi-trend trend-down">▼ {Math.abs(trendValue)}%</span>;
    }

    let renderedSparkline = null;
    if (sparklineSvg) {
        renderedSparkline = <div class="kpi-sparkline" dangerouslySetInnerHTML={{ __html: sparklineSvg }} />;
    } else if (sparklinePoints && sparklinePoints.length > 0) {
        const maxVal = Math.max(...sparklinePoints, 1);
        const pts: string[] = [];
        const xStep = 100 / Math.max(1, sparklinePoints.length - 1);
        for (let i = 0; i < sparklinePoints.length; i++) {
            const y = 35 - ((sparklinePoints[i] / maxVal) * 30);
            pts.push(`${i * xStep},${y}`);
        }
        renderedSparkline = (
            <div class="kpi-sparkline">
                <svg viewBox="0 0 100 40" class="sparkline-svg" preserveAspectRatio="none">
                    <polyline points={pts.join(' ')} stroke={sparklineColor} fill="none" stroke-width="2" stroke-linecap="round" />
                </svg>
            </div>
        );
    } else {
        renderedSparkline = <div class="kpi-sparkline" />;
    }

    return (
        <div class="kpi-card">
            <div class="kpi-header">
                <span class="kpi-title">
                    {title}
                    <span class="help-icon" data-tooltip={tooltip}>?</span>
                </span>
                {trendNode}
            </div>
            <div class="kpi-value">{mainValue} <span class="kpi-unit">{unit}</span></div>
            {renderedSparkline}
        </div>
    );
};

export interface LearningVelocityPanelProps {
    velocity: LearningVelocityData;
}

export const LearningVelocityPanel: FunctionalComponent<LearningVelocityPanelProps> = ({ velocity }) => {
    return (
        <Fragment>
            <div class="ana-panel-header" style="margin-bottom:0;">
                <span class="ana-panel-title">
                    Learning Velocity
                    <span class="help-icon" data-tooltip="How fast you are acquiring new knowledge and moving cards into long-term memory.">?</span>
                </span>
            </div>
            <div class="velocity-kpi-grid">
                <LearningVelocityKpiCard
                    title="New Cards/Day"
                    tooltip="The average number of new cards you learn each day."
                    trendValue={velocity.newCardsTrend}
                    mainValue={velocity.newCardsPerDay}
                    unit="/day"
                    sparklinePoints={velocity.sparklineNew}
                    sparklineColor="#a8c7fa"
                />
                <LearningVelocityKpiCard
                    title="Graduated/Week"
                    tooltip="Cards that have successfully moved out of the learning phase this week."
                    trendValue={velocity.graduatedTrend}
                    mainValue={velocity.graduatedPerWeek}
                    unit="/week"
                    sparklinePoints={velocity.sparklineGrad}
                    sparklineColor="#50e3c2"
                />
                <LearningVelocityKpiCard
                    title="Total Reviews"
                    tooltip="The overall count of reviews you've completed across all time."
                    trendValue={velocity.reviewsTrend}
                    mainValue={velocity.reviewsPerDay}
                    unit="/day"
                    sparklinePoints={velocity.sparklineRev}
                    sparklineColor="#f5a623"
                />
            </div>
        </Fragment>
    );
};

/**
 * Visualizes the rate of knowledge acquisition and progression into long-term memory.
 * Computes trend percentages and generates lightweight SVG sparklines.
 */
export class LearningVelocity {
    /** Data utility instance for querying card velocity metrics */
    dataUtils: DataUtils;

    /**
     * Initializes the LearningVelocity component.
     * @param dataUtils - Card statistics helper instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
        } catch (err) {
            UIUtils.catchError('LearningVelocity', 'Error initializing LearningVelocity constructor', err);
            this.dataUtils = dataUtils;
        }
    }

    /**
     * Generates and injects the learning velocity KPI cards and sparklines into the container.
     * @param containerId - DOM ID of the container element hosting learning velocity.
     * @returns void
     */
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

    /**
     * Builds the HTML string for an individual learning velocity KPI metric card.
     * @param title - Metric title display text.
     * @param tooltip - Informational explainer shown on question mark hover.
     * @param trendValue - Percent difference compared to previous time period.
     * @param mainValue - Primary numerical value or rate.
     * @param unit - Rate unit suffix (e.g., '/day' or '/week').
     * @param sparkline - Rendered SVG polyline markup.
     * @returns Rendered HTML card markup string.
     */
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

    /**
     * Formats a signed trend delta value into styled HTML with arrow indicators.
     * @param val - Integer percentage trend value (positive for growth, negative for decline).
     * @returns HTML span element string with trend-up, trend-down, or neutral styling.
     */
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

    /**
     * Generates a miniature responsive SVG polyline sparkline representing historical trends.
     * @param color - Stroke color CSS string (hex or var).
     * @param dataArray - Sequence of historical numerical data points (defaults to empty array).
     * @returns Rendered SVG markup string, or empty string if no data available.
     */
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
