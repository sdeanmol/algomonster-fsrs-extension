export class LearningVelocity {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const velocity = this.dataUtils.getLearningVelocity();

        // Dummy sparkline SVGs for visual flair
        const sparkline1 = this.generateSparkline('#4a90e2');
        const sparkline2 = this.generateSparkline('#50e3c2');
        const sparkline3 = this.generateSparkline('#f5a623');

        const formatTrend = (val) => {
            if (val === 0) return `<span class="kpi-trend" style="color:var(--md-text-low);">0%</span>`;
            if (val > 0) return `<span class="kpi-trend trend-up">▲ ${val}%</span>`;
            return `<span class="kpi-trend trend-down">▼ ${Math.abs(val)}%</span>`;
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
    }

    generateSparkline(color) {
        // Generates a simple random sparkline SVG
        const pts = [];
        let y = 20;
        for (let i = 0; i <= 10; i++) {
            pts.push(`${i * 10},${y}`);
            y += (Math.random() * 10 - 5);
            y = Math.max(5, Math.min(35, y));
        }
        return `
            <svg viewBox="0 0 100 40" class="sparkline-svg">
                <polyline points="${pts.join(' ')}" stroke="${color}" fill="none" stroke-width="2" stroke-linecap="round"/>
            </svg>
        `;
    }
}
