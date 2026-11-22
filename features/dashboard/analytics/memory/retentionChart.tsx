/**
 * @file features/dashboard/analytics/memory/retentionChart.tsx
 * @description Renders interactive multi-line retention decay charts with optional confidence bands
 * within the memory analytics view. Groups flashcards by tag, deck, or difficulty, plotting FSRS
 * forgetting trajectories across a 30-day horizon with hoverable data point tooltips.
 * @context Popup / Analytics SPA Dashboard
 */

import { h, Fragment, FunctionalComponent, render } from 'preact';
import { useMemo } from 'preact/hooks';
import { UIUtils } from '../../../common/utils/uiUtils';
import { ConfidenceBand, ConfidenceBandPolygon, PointR } from './confidenceBand';
import { DataUtils } from '../utils/dataUtils';
import { resolveContainer } from '../utils/resolveContainer';
import AbstractScheduler from '../../../tracker/scheduler/scheduler';
import { ANALYTICS_CHART_COLORS, RETENTION_TIME_POINTS } from '../../../common/constants';

export interface RetentionLegendGroup {
    name: string;
    count: number;
    color: string;
}

export interface RetentionChartLegendProps {
    groups: RetentionLegendGroup[];
}

export const RetentionChartLegend: FunctionalComponent<RetentionChartLegendProps> = ({ groups }) => {
    return (
        <div class="retention-legend">
            {groups.map(g => (
                <div class="retention-legend-item" key={g.name}>
                    <span class="retention-legend-dot" style={{ background: g.color }} />
                    {g.name}
                </div>
            ))}
        </div>
    );
};

export interface RetentionChartViewProps {
    dataUtils: DataUtils;
    scheduler?: AbstractScheduler | null;
    groupBy?: string;
    filterTag?: string;
    showConfidence?: boolean;
}

export const RetentionChartView: FunctionalComponent<RetentionChartViewProps> = ({
    dataUtils,
    scheduler: propScheduler,
    groupBy = 'tag',
    filterTag = '',
    showConfidence = false
}) => {
    const scheduler = propScheduler !== undefined ? propScheduler : (dataUtils ? dataUtils.scheduler : null);
    const chartColors = ANALYTICS_CHART_COLORS;
    const cleanFilterTag = (filterTag || '').trim().toLowerCase();

    const groupAvgs = useMemo(() => {
        const groups: Record<string, { stabilities: number[]; count: number; difficulties: number[] }> = {};
        if (!dataUtils || !dataUtils.cards) return [];

        dataUtils.cards.forEach(card => {
            try {
                if (cleanFilterTag) {
                    const hasTag = card.tags && card.tags.some((t: string) => t.toLowerCase().includes(cleanFilterTag));
                    if (!hasTag) return;
                }

                if (card.stability > 0) {
                    let keys: string[] = [];
                    if (groupBy === 'tag') {
                        keys = (card.tags && card.tags.length > 0) ? card.tags : ['Untagged'];
                    } else if (groupBy === 'deck') {
                        keys = ['Default'];
                    } else if (groupBy === 'difficulty') {
                        if (card.difficulty < 3) keys = ['Easy'];
                        else if (card.difficulty < 7) keys = ['Medium'];
                        else keys = ['Hard'];
                    }

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

        return Object.keys(groups).map(name => {
            const count = groups[name].count || 1;
            const avgStability = groups[name].stabilities.reduce((a, b) => a + b, 0) / count;
            const avgDifficulty = groups[name].difficulties.reduce((a, b) => a + b, 0) / count;
            return { name, avgStability, avgDifficulty, count };
        }).sort((a, b) => b.count - a.count).slice(0, 6);
    }, [dataUtils, cleanFilterTag, groupBy]);

    if (groupAvgs.length === 0) {
        return <div class="retention-empty">No reviewed cards yet to generate curves.</div>;
    }

    const timePoints = RETENTION_TIME_POINTS;
    const svgW = 900, svgH = 250;
    const padL = 50, padR = 20, padT = 20, padB = 40;
    const chartW = svgW - padL - padR;
    const chartH = svgH - padT - padB;

    const xScale = (t: number) => padL + (t / 30) * chartW;
    const yScale = (r: number) => padT + (1 - r) * chartH;

    const legendGroups = groupAvgs.map((g, idx) => ({
        name: g.name,
        count: g.count,
        color: chartColors[idx % chartColors.length]
    }));

    return (
        <Fragment>
            <svg class="retention-curve-svg multi-line" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', minHeight: '250px' }}>
                {[0, 0.25, 0.5, 0.75, 1.0].map(r => {
                    const y = yScale(r);
                    return (
                        <g key={r}>
                            <line class="retention-grid-line" x1={padL} y1={y} x2={svgW - padR} y2={y} />
                            <text class="retention-axis-label" x={padL - 10} y={y + 4} text-anchor="end">{Math.round(r * 100)}%</text>
                        </g>
                    );
                })}
                {timePoints.map(t => {
                    const x = xScale(t);
                    return (
                        <text key={t} class="retention-axis-label" x={x} y={svgH - 10} text-anchor="middle">{t === 0 ? 'Now' : `${t}d`}</text>
                    );
                })}
                {groupAvgs.map((gData, idx) => {
                    const color = chartColors[idx % chartColors.length];
                    const points: PointR[] = timePoints.map(t => {
                        let R = 0;
                        const sched = scheduler as (AbstractScheduler & { getProjectedRetrievability?: (stability: number, days: number) => number }) | null;
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

                    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

                    return (
                        <g key={gData.name}>
                            {showConfidence && (
                                <ConfidenceBandPolygon points={points} color={color} n={gData.count} />
                            )}
                            <polyline class="retention-line" points={polylinePoints} stroke={color} fill="none" stroke-width="2.5" />
                            {points.map((p, pIdx) => {
                                const tooltipText = `${gData.name}\nRetention: ${Math.round(p.R * 100)}%\nStability: ${gData.avgStability.toFixed(1)}d\nDifficulty: ${gData.avgDifficulty.toFixed(1)}\nCards: ${gData.count}`;
                                return (
                                    <circle
                                        key={pIdx}
                                        class="retention-dot interactive-dot"
                                        cx={p.x}
                                        cy={p.y}
                                        fill={color}
                                        r="4"
                                    >
                                        <title>{tooltipText}</title>
                                    </circle>
                                );
                            })}
                        </g>
                    );
                })}
            </svg>
            <RetentionChartLegend groups={legendGroups} />
        </Fragment>
    );
};

/**
 * Visualizes memory decay trajectories across flashcard cohorts.
 * Plots multi-series SVG forgetting curves with optional statistical confidence intervals
 * and per-point parameter breakdown tooltips.
 */
export class RetentionChart {
    /** Data utility instance providing card collections and query methods */
    dataUtils: DataUtils;
    /** Active FSRS scheduler instance used for mathematical retrievability projections */
    scheduler: AbstractScheduler | null;
    /** Current grouping dimension ('tag' | 'deck' | 'difficulty') */
    groupBy: string;
    /** Flag controlling whether semi-transparent confidence interval bands are drawn */
    showConfidence: boolean;
    /** Palette of CSS colors used to distinguish different grouped curves */
    chartColors: string[];
    /** Filter substring applied to tag names when grouping by tag */
    filterTag: string;

    /**
     * Initializes the RetentionChart component.
     * @param dataUtils - Card statistics and scheduler helper instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
            this.scheduler = dataUtils ? dataUtils.scheduler : null;
            this.groupBy = 'tag';
            this.showConfidence = false;
            
            this.chartColors = [...ANALYTICS_CHART_COLORS];
            this.filterTag = '';
        } catch (err) {
            UIUtils.catchError('RetentionChart', 'Error initializing RetentionChart constructor', err);
            this.dataUtils = dataUtils;
            this.scheduler = dataUtils ? dataUtils.scheduler : null;
            this.groupBy = 'tag';
            this.showConfidence = false;
            this.chartColors = [...ANALYTICS_CHART_COLORS];
            this.filterTag = '';
        }
    }

    /**
     * Sets a tag substring filter to limit displayed curves to matching tags.
     * @param tag - Tag filter string query.
     * @returns void
     */
    setFilterTag(tag: string): void {
        try {
            this.filterTag = (tag || '').trim().toLowerCase();
        } catch (err) {
            UIUtils.catchError('RetentionChart', 'Error setting filter tag', err, { tag });
        }
    }

    /**
     * Updates the grouping category used to partition flashcards into separate curves.
     * @param type - Cohort grouping criterion ('tag', 'deck', or 'difficulty').
     * @returns void
     */
    setGroupBy(type: string): void {
        try {
            this.groupBy = type || 'tag';
        } catch (err) {
            UIUtils.catchError('RetentionChart', 'Error setting group by', err, { type });
        }
    }

    /**
     * Toggles visibility of the semi-transparent confidence intervals around curves.
     * @param show - True to display confidence bands; false to hide.
     * @returns void
     */
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
     * @param containerId - DOM ID of the container element hosting the chart.
     * @returns void
     */
    render(containerId: string): void {
        try {
            const container = resolveContainer(containerId);
            if (!container) return;

            render(
                <RetentionChartView
                    dataUtils={this.dataUtils}
                    scheduler={this.scheduler}
                    groupBy={this.groupBy}
                    filterTag={this.filterTag}
                    showConfidence={this.showConfidence}
                />,
                container
            );
        } catch (err) {
            UIUtils.catchError('RetentionChart', 'Error rendering RetentionChart', err, { containerId, groupBy: this.groupBy, filterTag: this.filterTag });
        }
    }

    /**
     * Groups cards by the selected criteria (tag, deck, difficulty) and returns 
     * the top 6 groups by count with their average stability and difficulty.
     * @returns Array of group summary objects sorted by descending card count.
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
     * @param svgW - Total SVG viewbox width.
     * @param svgH - Total SVG viewbox height.
     * @param padL - Left padding in pixels.
     * @param padR - Right margin padding in pixels.
     * @param padT - Top margin padding in pixels.
     * @param xScale - Scaling function converting days to SVG X pixels.
     * @param yScale - Scaling function converting retrievability to SVG Y pixels.
     * @param timePoints - Array of time point days.
     * @returns Concatenated SVG markup string of axes and labels.
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
     * @param gData - Cohort summary statistics (name, average stability, average difficulty, card count).
     * @param color - Color assigned to this group's curve.
     * @param timePoints - Array of day offsets to evaluate.
     * @param xScale - Scaling function converting days to SVG X pixels.
     * @param yScale - Scaling function converting retrievability to SVG Y pixels.
     * @returns Rendered SVG elements for the group's curve, optional band, and dots.
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
     * @param groupAvgs - Array of cohort groups containing name and card count.
     * @returns Rendered HTML legend markup string.
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

