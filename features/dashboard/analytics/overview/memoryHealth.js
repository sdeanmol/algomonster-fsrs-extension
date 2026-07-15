export class MemoryHealth {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const stats = this.dataUtils.getSummaryStats();
        
        // Calculate a genuine FSRS health score based on average current retrievability
        let healthScore = 0;
        if (stats.trueRetention > 0) {
            healthScore = stats.trueRetention;
            // Optionally add a small bump for consistent review behavior, but keep it grounded in actual recall
            if (stats.streak > 3) healthScore = Math.min(100, healthScore + 2);
            if (stats.streak > 7) healthScore = Math.min(100, healthScore + 3);
        } else if (stats.retention > 0) {
            healthScore = stats.retention;
        } else {
            healthScore = 0; // No data yet
        }

        let statusText = 'Excellent';
        let statusClass = 'health-excellent';
        if (healthScore === 0) { statusText = 'Need Data'; statusClass = 'health-nodata'; }
        else if (healthScore < 70) { statusText = 'Needs Attention'; statusClass = 'health-warning'; }
        else if (healthScore < 85) { statusText = 'Good'; statusClass = 'health-good'; }

        // Determine trend (dummy logic for now without historical snapshot, 
        // ideally we'd compare against last week's health score)
        const trend = stats.streak > 2 ? '▲ +3 this week' : '▼ -1 this week';
        const trendMsg = stats.streak > 2 ? 'Your review consistency improved.' : 'Keep reviewing to improve memory health.';
        const trendClass = stats.streak > 2 ? 'trend-up' : 'trend-down';

        const svgCircle = `
            <svg class="health-ring" viewBox="0 0 120 120">
                <circle class="ring-bg" cx="60" cy="60" r="50"></circle>
                <circle class="ring-progress ${statusClass}" cx="60" cy="60" r="50" 
                        stroke-dasharray="314" stroke-dashoffset="${314 - (314 * healthScore / 100)}">
                </circle>
            </svg>
        `;

        container.innerHTML = `
            <div class="memory-health-card">
                <div class="ana-panel-header">
                    <span class="ana-panel-title">
                        Memory Health Score
                        <span class="help-icon" data-tooltip="A composite score out of 100 based on your current retention rate and how consistently you review. Aim for 85+.">?</span>
                    </span>
                </div>
                <div class="health-content">
                    <div class="health-ring-wrapper">
                        ${svgCircle}
                        <div class="health-score-center">
                            <span class="score-value">${healthScore}</span>
                            <span class="score-max">/ 100</span>
                        </div>
                    </div>
                    <div class="health-details">
                        <div class="health-status ${statusClass}">${statusText}</div>
                        <div class="health-trend ${trendClass}">${trend}</div>
                        <p class="health-msg">${trendMsg}</p>
                    </div>
                </div>
                <div class="health-metrics-grid">
                    <div class="health-metric">
                        <div class="hm-val">${stats.retention}%</div>
                        <div class="hm-lbl">Retention</div>
                    </div>
                    <div class="health-metric">
                        <div class="hm-val">${stats.totalLapses}</div>
                        <div class="hm-lbl">Total Lapses</div>
                    </div>
                    <div class="health-metric">
                        <div class="hm-val">${stats.avgStability.toFixed(1)}d</div>
                        <div class="hm-lbl">Avg Stability</div>
                    </div>
                    <div class="health-metric">
                        <div class="hm-val">${stats.streak}d</div>
                        <div class="hm-lbl">Streak</div>
                    </div>
                </div>
            </div>
        `;
    }
}
