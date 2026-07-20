import { ReviewTimeAnalytics } from './reviewTimeAnalytics.js';

export class InsightsTab {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
        this.reviewTimeAnalytics = new ReviewTimeAnalytics(this.dataUtils);
        this.rendered = false;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!this.rendered) {
            container.innerHTML = `
                <div class="insights-grid">
                    <div id="insights-next-action-container"></div>
                    <div class="insights-panel ana-panel-wide">
                        <div class="ana-panel-header">
                            <span class="ana-panel-title">
                                Review Time Analytics
                                <span class="help-icon" data-tooltip="Analyzes your retention rates based on the time of day you do your reviews to find your most effective study time.">?</span>
                            </span>
                            <span class="ana-panel-hint">When do you study best?</span>
                        </div>
                        <div id="review-time-analytics-container"></div>
                    </div>
                </div>
            `;
            this.rendered = true;
        }

        this.reviewTimeAnalytics.render('review-time-analytics-container');
        this.renderNextAction('insights-next-action-container');
    }

    renderNextAction(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const { hasTimeData, data } = this.dataUtils.getReviewTimeInsights();

        if (!hasTimeData || data.every(d => d.reviews === 0)) {
            container.innerHTML = `
                <div class="actionable-insight-banner warning" style="margin-bottom:0;">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <div class="insight-content">
                        <h3>Next Action: Keep Reviewing</h3>
                        <p>Not enough timestamp data available yet. Your next action is to <strong>do more reviews</strong> so we can figure out your best study time.</p>
                    </div>
                </div>
            `;
            return;
        }

        let best = data[0];
        data.forEach(d => {
            if (d.retention > best.retention && d.reviews > 5) {
                best = d;
            }
        });

        if (best.reviews > 5) {
            container.innerHTML = `
                <div class="actionable-insight-banner success" style="margin-bottom:0;">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <div class="insight-content">
                        <h3>Next Action: Optimize Your Schedule</h3>
                        <p>Based on your FSRS review logs, you retain information best in the <strong>${best.bucket}</strong>. Your next action is to <strong>schedule your heaviest study sessions during this time</strong> to maximize your memory consolidation.</p>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="actionable-insight-banner success" style="margin-bottom:0;">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <div class="insight-content">
                        <h3>Next Action: Collect More Data</h3>
                        <p>We're starting to track your habits in the FSRS logs. Keep reviewing at different times of the day to discover when your memory is sharpest!</p>
                    </div>
                </div>
            `;
        }
    }
}
