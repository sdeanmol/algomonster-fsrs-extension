import { CoverageTable } from './coverageTable.js';
import { RetentionBarChart } from './retentionBarChart.js';

export class TagsTab {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
        this.coverageTable = new CoverageTable(this.dataUtils);
        this.retentionBarChart = new RetentionBarChart(this.dataUtils);
        this.rendered = false;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        if (!this.rendered) {
            container.innerHTML = `
                <div class="tags-grid">
                    <div id="tags-next-action-container"></div>
                    <div class="tags-panel ana-panel-wide">
                        <div class="ana-panel-header">
                            <span class="ana-panel-title">
                                Tag Coverage Analysis
                                <span class="help-icon" data-tooltip="Shows how completely each tag is represented in your total flashcard deck. Click a tag to see those specific cards.">?</span>
                            </span>
                        </div>
                        <div id="coverage-table-container"></div>
                    </div>
                    
                    <div class="tags-panel ana-panel-wide">
                        <div class="ana-panel-header">
                            <span class="ana-panel-title">
                                Retention by Tag
                                <span class="help-icon" data-tooltip="Compares your memory retention and stability across different subjects/tags.">?</span>
                            </span>
                            <select id="tag-sort-by" class="modern-select">
                                <option value="retention">Sort by Retention</option>
                                <option value="stability">Sort by Stability</option>
                                <option value="cards">Sort by Cards</option>
                                <option value="lapses">Sort by Lapses</option>
                            </select>
                        </div>
                        <div id="retention-bar-chart-container" class="ana-chart-area"></div>
                    </div>
                </div>
            `;
            
            const sortBySelect = container.querySelector('#tag-sort-by');
            sortBySelect.addEventListener('change', (e) => {
                this.retentionBarChart.setSortBy(e.target.value);
                this.retentionBarChart.render('retention-bar-chart-container');
            });

            this.rendered = true;
        }

        this.coverageTable.render('coverage-table-container');
        this.retentionBarChart.render('retention-bar-chart-container');
        this.renderNextAction('tags-next-action-container');
    }

    renderNextAction(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const stats = this.dataUtils.getStatsByTag();
        const globalStats = this.dataUtils.getSummaryStats();
        // Compare against genuine current retrievability
        const globalRetention = globalStats.trueRetention || 90; 
        
        let weakestTag = null;
        
        stats.forEach(s => {
            // Only consider tags with significant data and lower than the global retention average
            if (s.count >= 5 && (!weakestTag || s.trueRetention < weakestTag.trueRetention)) {
                weakestTag = s;
            }
        });

        // Scheduling logic: If a specific subject is pulling down the global retention by more than 5%
        if (weakestTag && weakestTag.trueRetention < (globalRetention - 5)) {
            container.innerHTML = `
                <div class="actionable-insight-banner warning" style="margin-bottom:0;">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>
                    </svg>
                    <div class="insight-content">
                        <h3>Next Action: Target Weak Tags</h3>
                        <p>Your <strong>${weakestTag.tag}</strong> tag has a retrievability of ${weakestTag.trueRetention}%, which is significantly below your overall average of ${globalRetention}%. Your next action is to do a <strong>custom study session</strong> focused only on this tag to boost its stability.</p>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="actionable-insight-banner success" style="margin-bottom:0;">
                    <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>
                    </svg>
                    <div class="insight-content">
                        <h3>Next Action: Maintain Tag Balance</h3>
                        <p>Your tags are looking healthy with no major outliers pulling your retrievability down! Your next action is to <strong>keep learning new cards</strong> across all tags to expand your knowledge base evenly.</p>
                    </div>
                </div>
            `;
        }
    }
}
