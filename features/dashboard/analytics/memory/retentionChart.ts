/**
 * @file features/dashboard/analytics/memory/retentionChart.ts
 * @description Renders interactive multi-line retention decay charts with confidence bands.
 */

import { Logger } from '@common/logger';
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
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RetentionChart', `Error initializing RetentionChart constructor: ${errorMessage}`, { err });
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
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RetentionChart', `Error setting filter tag: ${errorMessage}`, { tag, err });
        }
    }

    setGroupBy(type: string): void {
        try {
            this.groupBy = type || 'tag';
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RetentionChart', `Error setting group by: ${errorMessage}`, { type, err });
        }
    }

    setShowConfidence(show: boolean): void {
        try {
            this.showConfidence = Boolean(show);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RetentionChart', `Error setting show confidence: ${errorMessage}`, { show, err });
        }
    }

    render(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            const groups: Record<string, { stabilities: number[]; count: number; difficulties: number[] }> = {};
            if (this.dataUtils && this.dataUtils.cards) {
                this.dataUtils.cards.forEach(card => {
                    try {
                        if (this.filterTag) {
                            const hasTag = card.tags && card.tags.some((t: string) => t.toLowerCase().includes(this.filterTag));
                            if (!hasTag) return;
                        }

                        if (card.stability > 0) {
                            let keys: string[] = [];
                            if (this.groupBy === 'tag') {
                                keys = (card.tags && card.tags.length > 0) ? card.tags : ['Untagged'];
                            } else if (this.groupBy === 'deck') {
                                keys = ['Default'];
                            } else if (this.groupBy === 'difficulty') {
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
                        const errorMessage = cardErr instanceof Error ? cardErr.message : String(cardErr);
                        Logger.error('RetentionChart', `Error processing card for retention chart: ${errorMessage}`, { card, cardErr });
                    }
                });
            }

            const groupNames = Object.keys(groups);
            if (groupNames.length === 0) {
                container.innerHTML = '<div class="retention-empty">No reviewed cards yet to generate curves.</div>';
                return;
            }

            const groupAvgs = groupNames.map(name => {
                const count = groups[name].count || 1;
                const avgStability = groups[name].stabilities.reduce((a, b) => a + b, 0) / count;
                const avgDifficulty = groups[name].difficulties.reduce((a, b) => a + b, 0) / count;
                return {
                    name,
                    avgStability,
                    avgDifficulty,
                    count
                };
            }).sort((a, b) => b.count - a.count).slice(0, 6);

            const timePoints = [0, 1, 3, 7, 14, 21, 30];

            const svgW = 900, svgH = 250;
            const padL = 50, padR = 20, padT = 20, padB = 40;
            const chartW = svgW - padL - padR;
            const chartH = svgH - padT - padB;

            const xScale = (t: number) => padL + (t / 30) * chartW;
            const yScale = (r: number) => padT + (1 - r) * chartH;

            let svgContent = `<svg class="retention-curve-svg multi-line" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="width: 100%; height: 100%; min-height: 250px;">`;

            [0, 0.25, 0.5, 0.75, 1.0].forEach(r => {
                const y = yScale(r);
                svgContent += `<line class="retention-grid-line" x1="${padL}" y1="${y}" x2="${svgW - padR}" y2="${y}" />`;
                svgContent += `<text class="retention-axis-label" x="${padL - 10}" y="${y + 4}" text-anchor="end">${Math.round(r * 100)}%</text>`;
            });

            timePoints.forEach(t => {
                const x = xScale(t);
                svgContent += `<text class="retention-axis-label" x="${x}" y="${svgH - 10}" text-anchor="middle">${t === 0 ? 'Now' : t + 'd'}</text>`;
            });

            groupAvgs.forEach((gData, idx) => {
                try {
                    const color = this.chartColors[idx % this.chartColors.length];
                    const points = timePoints.map(t => {
                        let R = 0;
                        const sched = this.scheduler as (AbstractScheduler & { getProjectedRetrievability?: (stability: number, days: number) => number }) | null;
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

                    if (this.showConfidence) {
                        try {
                            svgContent += ConfidenceBand.renderBand(points, color, gData.count);
                        } catch (bandErr) {
                            const errorMessage = bandErr instanceof Error ? bandErr.message : String(bandErr);
                            Logger.error('RetentionChart', `Error rendering confidence band: ${errorMessage}`, { gData, bandErr });
                        }
                    }

                    svgContent += `<polyline class="retention-line" points="${points.map(p => `${p.x},${p.y}`).join(' ')}" stroke="${color}" />`;

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
                        svgContent += `
                            <circle class="retention-dot interactive-dot" cx="${p.x}" cy="${p.y}" fill="${color}" r="4" data-tooltip="${encodeURIComponent(tooltipHtml)}">
                                <title>${gData.name}&#10;Retention: ${Math.round(p.R * 100)}%&#10;Stability: ${gData.avgStability.toFixed(1)}d&#10;Difficulty: ${gData.avgDifficulty.toFixed(1)}&#10;Cards: ${gData.count}</title>
                            </circle>
                        `;
                    });
                } catch (groupErr) {
                    const errorMessage = groupErr instanceof Error ? groupErr.message : String(groupErr);
                    Logger.error('RetentionChart', `Error rendering curve for retention group: ${errorMessage}`, { gData, groupErr });
                }
            });

            svgContent += `</svg>`;

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

            container.innerHTML = svgContent + legendHtml;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('RetentionChart', `Error rendering RetentionChart: ${errorMessage}`, { containerId, groupBy: this.groupBy, filterTag: this.filterTag, err });
        }
    }
}
