/**
 * @file features/dashboard/analytics/tags/tags.tsx
 * @description Controller for the Tag Analytics tab component within the analytics dashboard.
 * Coordinates rendering of deck coverage breakdown, retention/stability comparisons by tag,
 * and actionable recommendation banners targeting the user's weakest knowledge areas.
 * @context Popup / Analytics SPA Dashboard
 */

import { h, Fragment, FunctionalComponent } from 'preact';
import { Logger } from '@common/logger';
import { CoverageTable } from './coverageTable';
import { RetentionBarChart } from './retentionBarChart';
import { DataUtils, TagStats } from '../utils/dataUtils';

export interface TagsNextActionBannerProps {
    weakestTag: TagStats | null;
    globalRetention: number;
}

export const TagsNextActionBanner: FunctionalComponent<TagsNextActionBannerProps> = ({ weakestTag, globalRetention }) => {
    if (weakestTag && weakestTag.trueRetention < (globalRetention - 5)) {
        return (
            <div class="actionable-insight-banner warning" style={{ marginBottom: 0 }}>
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                    <line x1="7" y1="7" x2="7.01" y2="7" />
                </svg>
                <div class="insight-content">
                    <h3>Next Action: Target Weak Tags</h3>
                    <p>Your <strong>{weakestTag.tag}</strong> tag has a retrievability of {weakestTag.trueRetention}%, which is significantly below your overall average of {globalRetention}%. Your next action is to do a <strong>custom study session</strong> focused only on this tag to boost its stability.</p>
                </div>
            </div>
        );
    }

    return (
        <div class="actionable-insight-banner success" style={{ marginBottom: 0 }}>
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
                <line x1="7" y1="7" x2="7.01" y2="7" />
            </svg>
            <div class="insight-content">
                <h3>Next Action: Maintain Tag Balance</h3>
                <p>Your tags are looking healthy with no major outliers pulling your retrievability down! Your next action is to <strong>keep learning new cards</strong> across all tags to expand your knowledge base evenly.</p>
            </div>
        </div>
    );
};

export const TagsTabContent: FunctionalComponent = () => {
    return (
        <div class="tags-grid">
            <div id="tags-next-action-container" />
            <div class="tags-panel ana-panel-wide">
                <div class="ana-panel-header">
                    <span class="ana-panel-title">
                        Tag Coverage Analysis
                        <span class="help-icon" data-tooltip="Shows how completely each tag is represented in your total flashcard deck. Click a tag to see those specific cards. 

Tag Colors (Due Cards):
• Green: 0 due
• Light Blue: 1-5 due
• Yellow: 6-10 due
• Pink: 11-20 due
• Red: 21+ due">?</span>
                    </span>
                </div>
                <div id="coverage-table-container" />
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
                <div id="retention-bar-chart-container" class="ana-chart-area" />
            </div>
        </div>
    );
};

/**
 * Controller for the Tag Analytics tab view.
 * Integrates tabular tag coverage summaries, horizontal comparative bar charts,
 * and automated remediation recommendations based on retrievability deficits.
 */
export class TagsTab {
    /** Data utility instance for card filtering and tag aggregation */
    dataUtils: DataUtils;
    /** Sub-component rendering the tag coverage and due card statistics table */
    coverageTable: CoverageTable;
    /** Sub-component rendering configurable horizontal bar charts for tag metrics */
    retentionBarChart: RetentionBarChart;
    /** Flag indicating whether the primary static DOM shell has already been mounted */
    rendered: boolean;

    /**
     * Initializes the TagsTab controller with its nested visualization sub-components.
     * @param dataUtils - Card data and analytics helper instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
            this.coverageTable = new CoverageTable(this.dataUtils);
            this.retentionBarChart = new RetentionBarChart(this.dataUtils);
            this.rendered = false;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('TagsTab', `Error initializing TagsTab constructor: ${errorMessage}`, { err });
            this.dataUtils = dataUtils;
            this.coverageTable = new CoverageTable(dataUtils);
            this.retentionBarChart = new RetentionBarChart(dataUtils);
            this.rendered = false;
        }
    }

    /**
     * Renders the complete Tag Analytics view into the designated container element.
     * Builds the container layout on first call and refreshes sub-components on subsequent invocations.
     * @param containerId - DOM ID of the container element hosting the tag tab.
     * @returns void
     */
    render(containerId: string): void {
        try {
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
                                    <span class="help-icon" data-tooltip="Shows how completely each tag is represented in your total flashcard deck. Click a tag to see those specific cards. 

Tag Colors (Due Cards):
• Green: 0 due
• Light Blue: 1-5 due
• Yellow: 6-10 due
• Pink: 11-20 due
• Red: 21+ due">?</span>
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

                const sortBySelect = container.querySelector('#tag-sort-by') as HTMLSelectElement | null;
                if (sortBySelect) {
                    sortBySelect.addEventListener('change', (e: Event) => {
                        try {
                            const target = e.target as HTMLSelectElement;
                            this.retentionBarChart.setSortBy(target.value);
                            this.retentionBarChart.render('retention-bar-chart-container');
                        } catch (selectErr) {
                            const errorMessage = selectErr instanceof Error ? selectErr.message : String(selectErr);
                            Logger.error('TagsTab', `Error handling tag-sort-by select change: ${errorMessage}`, { selectErr });
                        }
                    });
                }

                this.rendered = true;
            }

            this.coverageTable.render('coverage-table-container');
            this.retentionBarChart.render('retention-bar-chart-container');
            this.renderNextAction('tags-next-action-container');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('TagsTab', `Error rendering TagsTab: ${errorMessage}`, { containerId, err });
        }
    }

    /**
     * Identifies the tag with the lowest retrievability (minimum sample size of 5 cards)
     * and displays an actionable warning banner if it falls 5%+ below the global average.
     * Displays an encouraging maintenance banner if all tags are balanced.
     * @param containerId - DOM element ID for the next action banner container.
     * @returns void
     */
    renderNextAction(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            const stats = this.dataUtils.getStatsByTag();
            const globalStats = this.dataUtils.getSummaryStats();
            const globalRetention = globalStats.trueRetention || 90;

            let weakestTag: TagStats | null = null;

            stats.forEach(s => {
                if (s.count >= 5 && (!weakestTag || s.trueRetention < weakestTag.trueRetention)) {
                    weakestTag = s;
                }
            });

            if (weakestTag && (weakestTag as TagStats).trueRetention < (globalRetention - 5)) {
                container.innerHTML = `
                    <div class="actionable-insight-banner warning" style="margin-bottom:0;">
                        <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line>
                        </svg>
                        <div class="insight-content">
                            <h3>Next Action: Target Weak Tags</h3>
                            <p>Your <strong>${(weakestTag as TagStats).tag}</strong> tag has a retrievability of ${(weakestTag as TagStats).trueRetention}%, which is significantly below your overall average of ${globalRetention}%. Your next action is to do a <strong>custom study session</strong> focused only on this tag to boost its stability.</p>
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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('TagsTab', `Error rendering next action for tags: ${errorMessage}`, { containerId, err });
        }
    }
}

