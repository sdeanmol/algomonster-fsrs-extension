import { ConfidenceBand } from './confidenceBand';
import { DataUtils } from '../utils/dataUtils';

export class RetentionChart {
    dataUtils: DataUtils;
    scheduler: any;
    groupBy: string;
    showConfidence: boolean;
    chartColors: string[];
    filterTag: string;

    constructor(dataUtils: DataUtils) {
        this.dataUtils = dataUtils;
        this.scheduler = dataUtils.scheduler;
        this.groupBy = 'tag';
        this.showConfidence = false;
        
        this.chartColors = [
            '#a8c7fa', '#81c995', '#fde293', '#f28b82',
            '#c4a8fa', '#8ecae6', '#f4a261', '#e76f51',
            '#90be6d', '#f9c74f', '#43aa8b', '#577590'
        ];
        this.filterTag = '';
    }

    setFilterTag(tag: string): void {
        this.filterTag = (tag || '').trim().toLowerCase();
    }

    setGroupBy(type: string): void {
        this.groupBy = type;
    }

    setShowConfidence(show: boolean): void {
        this.showConfidence = show;
    }

    render(containerId: string): void {
        const container = document.getElementById(containerId);
        if (!container) return;

        const groups: { [key: string]: { stabilities: number[]; count: number; difficulties: number[] } } = {};
        this.dataUtils.cards.forEach(card => {
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
        });

        const groupNames = Object.keys(groups);
        if (groupNames.length === 0) {
            container.innerHTML = '<div class="retention-empty">No reviewed cards yet to generate curves.</div>';
            return;
        }

        const groupAvgs = groupNames.map(name => ({
            name,
            avgStability: groups[name].stabilities.reduce((a, b) => a + b, 0) / groups[name].count,
            avgDifficulty: groups[name].difficulties.reduce((a, b) => a + b, 0) / groups[name].count,
            count: groups[name].count
        })).sort((a, b) => b.count - a.count).slice(0, 6);

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
            const color = this.chartColors[idx % this.chartColors.length];
            const points = timePoints.map(t => {
                let R = 0;
                if (this.scheduler && typeof this.scheduler.getProjectedRetrievability === 'function') {
                    R = this.scheduler.getProjectedRetrievability(gData.avgStability, t);
                } else {
                    const stability = gData.avgStability;
                    if (stability > 0) {
                        R = Math.pow(1 + ((19 / 81) * t) / stability, -0.5);
                    }
                }
                
                return { t, R, x: xScale(t), y: yScale(R) };
            });

            if (this.showConfidence) {
                svgContent += ConfidenceBand.renderBand(points, color, gData.count);
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
    }
}
