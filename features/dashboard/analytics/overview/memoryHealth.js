export class MemoryHealth {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const stats = this.dataUtils.getSummaryStats();
        
        // Calculate a genuine memory health score based on average current retrievability
        let healthScore = 0;
        if (stats.trueRetention > 0) {
            healthScore = stats.trueRetention;
        } else if (stats.retention > 0) {
            healthScore = stats.retention;
        } else {
            healthScore = 0; // No data yet
        }

        // Determine target retention baseline (usually 90%)
        let targetRetention = 90;
        if (this.dataUtils.scheduler && this.dataUtils.scheduler.requestRetention) {
            targetRetention = this.dataUtils.scheduler.requestRetention * 100;
        }

        let statusText = 'Excellent';
        let statusClass = 'health-excellent';
        if (healthScore === 0) { 
            statusText = 'Need Data'; 
            statusClass = 'health-nodata'; 
        } else if (healthScore < targetRetention - 7) { 
            statusText = 'Needs Attention'; 
            statusClass = 'health-warning'; 
        } else if (healthScore < targetRetention - 2) { 
            statusText = 'Good'; 
            statusClass = 'health-good'; 
        }

        // Determine trend based on current streak consistency
        const trend = stats.streak >= 3 ? '▲ Consistent' : (stats.streak > 0 ? '▶ Active' : '▼ Needs Review');
        const trendMsg = stats.streak >= 3 ? 'You are building strong long-term memory.' : 'Review more consistently to improve memory health.';
        const trendClass = stats.streak >= 3 ? 'trend-up' : (stats.streak > 0 ? '' : 'trend-down');

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
                        <div class="hm-val">${stats.trueRetention}%</div>
                        <div class="hm-lbl">Retention <span class="help-icon" data-tooltip="Probability you will remember your cards right now (FSRS Retrievability).">?</span></div>
                    </div>
                    <div class="health-metric">
                        <div class="hm-val">${stats.totalLapses}</div>
                        <div class="hm-lbl">Total Lapses <span class="help-icon" data-tooltip="Total number of times you have forgotten a card (rated 'Again').">?</span></div>
                    </div>
                    <div class="health-metric">
                        <div class="hm-val">${stats.avgStability.toFixed(1)}d</div>
                        <div class="hm-lbl">Avg Stability <span class="help-icon" data-tooltip="Average time it takes for your retention to drop from 100% to 90%.">?</span></div>
                    </div>
                    <div class="health-metric">
                        <div class="hm-val">${stats.streak}d</div>
                        <div class="hm-lbl">Streak <span class="help-icon" data-tooltip="Consecutive days you have studied at least one card.">?</span></div>
                    </div>
                </div>
            </div>
        `;
    }
}
