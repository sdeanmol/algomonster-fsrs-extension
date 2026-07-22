export class PredictionComparison {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Dummy data for Actual vs Predicted
        // In reality, actual recall comes from log history success rate at various time intervals
        
        const svgW = 900, svgH = 200;
        const padL = 50, padR = 20, padT = 20, padB = 40;
        const chartW = svgW - padL - padR;
        const chartH = svgH - padT - padB;

        const xScale = (t) => padL + (t / 30) * chartW;
        const yScale = (r) => padT + (1 - r) * chartH;
        
        const timePoints = [0, 1, 3, 7, 14, 21, 30];
        const avgStability = this.dataUtils.getSummaryStats().avgStability || 10;
        const decay = -0.5;

        // Prediction
        const predPoints = timePoints.map(t => {
            const R = Math.exp(decay * t / avgStability);
            return { t, R, x: xScale(t), y: yScale(R) };
        });

        // Actual (Simulated lower recall)
        const actPoints = timePoints.map(t => {
            const R = Math.exp(decay * t / (avgStability * 0.85)); // 15% worse stability
            return { t, R, x: xScale(t), y: yScale(R) };
        });
        
        // Gap at 30 days
        const diff = predPoints[predPoints.length-1].R - actPoints[actPoints.length-1].R;
        const gapText = diff > 0.05 
            ? `Actual recall is ${Math.round(diff*100)}% below expected. Consider reviewing more consistently.`
            : `Actual recall is tracking closely to predictions!`;

        let svgContent = `<svg class="prediction-svg multi-line" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="none" style="width: 100%; height: 100%; min-height: 250px;">`;

        // Grid lines
        [0, 0.5, 1.0].forEach(r => {
            const y = yScale(r);
            svgContent += `<line class="retention-grid-line" x1="${padL}" y1="${y}" x2="${svgW - padR}" y2="${y}" />`;
            svgContent += `<text class="retention-axis-label" x="${padL - 10}" y="${y + 4}" text-anchor="end">${Math.round(r * 100)}%</text>`;
        });
        
        timePoints.forEach(t => {
            const x = xScale(t);
            svgContent += `<text class="retention-axis-label" x="${x}" y="${svgH - 10}" text-anchor="middle">${t}d</text>`;
        });

        // Render Prediction (Dashed line)
        svgContent += `<polyline points="${predPoints.map(p => `${p.x},${p.y}`).join(' ')}" stroke="#a8c7fa" stroke-dasharray="5,5" fill="none" stroke-width="2" />`;
        // Render Actual (Solid line)
        svgContent += `<polyline points="${actPoints.map(p => `${p.x},${p.y}`).join(' ')}" stroke="#f28b82" fill="none" stroke-width="2" />`;
        
        svgContent += `</svg>`;
        
        let legendHtml = `
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

        container.innerHTML = svgContent + legendHtml;
    }
}
