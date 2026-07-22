import { ConfidenceBand } from './confidenceBand.js';

export class RetentionChart {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
        this.scheduler = dataUtils.scheduler;
        this.groupBy = 'tag';
        this.showConfidence = false;
        
        this.chartColors = [
            '#a8c7fa', '#81c995', '#fde293', '#f28b82',
            '#c4a8fa', '#8ecae6', '#f4a261', '#e76f51',
            '#90be6d', '#f9c74f', '#43aa8b', '#577590'
        ];
    }

    setGroupBy(type) {
        this.groupBy = type;
    }

    setShowConfidence(show) {
        this.showConfidence = show;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Group cards based on selection
        const groups = {};
        this.dataUtils.cards.forEach(card => {
            if (card.stability > 0) {
                let keys = [];
                if (this.groupBy === 'tag') {
                    keys = (card.tags && card.tags.length > 0) ? card.tags : ['Untagged'];
                } else if (this.groupBy === 'deck') {
                    keys = ['Default']; // Modify based on your deck logic
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

        // Compute averages and sort
        const groupAvgs = groupNames.map(name => ({
            name,
            avgStability: groups[name].stabilities.reduce((a,b)=>a+b,0) / groups[name].count,
            avgDifficulty: groups[name].difficulties.reduce((a,b)=>a+b,0) / groups[name].count,
            count: groups[name].count
        })).sort((a, b) => b.count - a.count).slice(0, 6); // Max 6 lines

        const timePoints = [0, 1, 3, 7, 14, 21, 30];

        const svgW = 900, svgH = 250;
        const padL = 50, padR = 20, padT = 20, padB = 40;
        const chartW = svgW - padL - padR;
        const chartH = svgH - padT - padB;

        const xScale = (t) => padL + (t / 30) * chartW;
        const yScale = (r) => padT + (1 - r) * chartH;

        let svgContent = `<svg class="retention-curve-svg multi-line" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="width: 100%; height: 100%; min-height: 250px;">`;

        // Grid lines
        [0, 0.25, 0.5, 0.75, 1.0].forEach(r => {
            const y = yScale(r);
            svgContent += `<line class="retention-grid-line" x1="${padL}" y1="${y}" x2="${svgW - padR}" y2="${y}" />`;
            svgContent += `<text class="retention-axis-label" x="${padL - 10}" y="${y + 4}" text-anchor="end">${Math.round(r * 100)}%</text>`;
        });

        // X-axis
        timePoints.forEach(t => {
            const x = xScale(t);
            svgContent += `<text class="retention-axis-label" x="${x}" y="${svgH - 10}" text-anchor="middle">${t === 0 ? 'Now' : t + 'd'}</text>`;
        });

        // Plot curves
        groupAvgs.forEach((gData, idx) => {
            const color = this.chartColors[idx % this.chartColors.length];
            const points = timePoints.map(t => {
                const R = this.scheduler ? this.scheduler.getProjectedRetrievability(gData.avgStability, t) : 0;
                return { t, R, x: xScale(t), y: yScale(R) };
            });

            if (this.showConfidence) {
                svgContent += ConfidenceBand.renderBand(points, color, gData.count);
            }

            svgContent += `<polyline class="retention-line" points="${points.map(p => `${p.x},${p.y}`).join(' ')}" stroke="${color}" />`;

            // Hover dots with rich tooltips
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
                // Just use title for native hover, in a real SPA we might bind JS tooltips
                svgContent += `
                    <circle class="retention-dot interactive-dot" cx="${p.x}" cy="${p.y}" fill="${color}" r="4" data-tooltip="${encodeURIComponent(tooltipHtml)}">
                        <title>${gData.name}&#10;Retention: ${Math.round(p.R * 100)}%&#10;Stability: ${gData.avgStability.toFixed(1)}d&#10;Difficulty: ${gData.avgDifficulty.toFixed(1)}&#10;Cards: ${gData.count}</title>
                    </circle>
                `;
            });
        });

        svgContent += `</svg>`;

        // Legend
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
