import { RecoveryTracking } from './recoveryTracking.js';
import { ReviewStats } from './reviewStats.js';

export class PerformanceTab {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
        this.reviewStats = new ReviewStats(this.dataUtils);
        this.recoveryTracking = new RecoveryTracking(this.dataUtils);
        this.rendered = false;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!this.rendered) {
            container.innerHTML = `
                <div class="performance-grid">
                    <div id="performance-next-action-container"></div>
                    <div class="performance-panel ana-panel-wide">
                        <div class="ana-panel-header">
                            <span class="ana-panel-title">
                                Review Statistics
                                <span class="help-icon" data-tooltip="Shows the volume of your review activity over daily, weekly, or monthly periods.">?</span>
                            </span>
                            <div class="performance-controls">
                                <select id="review-period-select" class="modern-select">
                                    <option value="daily">Daily (14 days)</option>
                                    <option value="weekly">Weekly (12 weeks)</option>
                                    <option value="monthly">Monthly (12 months)</option>
                                </select>
                            </div>
                        </div>
                        <div id="review-stats-container"></div>
                    </div>

                    <div class="performance-panel ana-panel-wide">
                        <div class="ana-panel-header">
                            <span class="ana-panel-title">
                                Trouble Spots & Recovery
                                <span class="help-icon" data-tooltip="Highlights cards you've forgotten multiple times (Lapses). 'Still Struggling' means the card has not yet graduated to long-term memory again.">?</span>
                            </span>
                            <div class="performance-controls">
                                <select id="performance-filter-tag" class="modern-select">
                                    <option value="all">All Tags</option>
                                    <!-- Options populated dynamically if needed -->
                                </select>
                            </div>
                        </div>
                        <div id="recovery-tracking-container"></div>
                    </div>
                </div>
            `;
            
            // Basic event listener for future filter expansion
            const tagFilter = container.querySelector('#performance-filter-tag');
            tagFilter.addEventListener('change', (e) => {
                this.recoveryTracking.setTagFilter(e.target.value);
                this.recoveryTracking.render('recovery-tracking-container');
            });
            const periodSelect = container.querySelector('#review-period-select');
            periodSelect.addEventListener('change', (e) => {
                this.reviewStats.setPeriod(e.target.value);
                this.reviewStats.render('review-stats-container');
            });
            
            this.rendered = true;
        }

        this.reviewStats.render('review-stats-container');
        this.recoveryTracking.render('recovery-tracking-container');
        this.renderNextAction('performance-next-action-container');
    }

    renderNextAction(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const dataUtils = this.dataUtils;
        let struggling = 0;
        dataUtils.cards.forEach(c => {
            // FSRS Difficulty scales from 1 (easiest) to 10 (hardest).
            // A card with difficulty >= 7 and at least 1 lapse is genuinely struggling.
            if ((c.difficulty || 0) >= 7 && (c.lapses || 0) >= 1) {
                struggling++;
            }
        });

        if (struggling > 0) {
            container.innerHTML = `
                <div class="actionable-insight-banner warning" style="margin-bottom:0;">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <div class="insight-content">
                        <h3>Next Action: Reformulate Problem Cards</h3>
                        <p>The FSRS algorithm has identified <strong>${struggling} cards</strong> with a High Difficulty rating (≥ 7) that you have lapsed on. Your next action is to <strong>edit these cards</strong>: simplify the information, add a mnemonic, or break them down into smaller pieces.</p>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="actionable-insight-banner success" style="margin-bottom:0;">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    <div class="insight-content">
                        <h3>Next Action: Consistent Reviews</h3>
                        <p>You have no major trouble spots right now! Keep up the daily reviews to maintain your high FSRS recovery rate.</p>
                    </div>
                </div>
            `;
        }
    }
}
