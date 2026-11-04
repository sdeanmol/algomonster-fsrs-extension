/**
 * @file features/dashboard/analytics/performance/performance.tsx
 * @description Main controller for the Performance & Recovery tab in the analytics dashboard.
 * Coordinates review volume history breakdowns (daily, weekly, monthly) and lapse recovery tracking
 * for cards undergoing memory rehabilitation.
 * @context Popup / Analytics SPA Dashboard
 */

import { h, Fragment, FunctionalComponent } from 'preact';
import { Logger } from '@common/logger';
import { RecoveryTracking } from './recoveryTracking';
import { ReviewStats } from './reviewStats';
import { DataUtils } from '../utils/dataUtils';

export interface PerformanceNextActionBannerProps {
    strugglingCount: number;
}

export const PerformanceNextActionBanner: FunctionalComponent<PerformanceNextActionBannerProps> = ({ strugglingCount }) => {
    if (strugglingCount > 0) {
        return (
            <div class="actionable-insight-banner warning" style={{ marginBottom: 0 }}>
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div class="insight-content">
                    <h3>Next Action: Reformulate Problem Cards</h3>
                    <p>The scheduling algorithm has identified <strong>{strugglingCount} cards</strong> with a High Difficulty rating that you have lapsed on. Your next action is to <strong>edit these cards</strong>: simplify the information, add a mnemonic, or break them down into smaller pieces.</p>
                </div>
            </div>
        );
    }

    return (
        <div class="actionable-insight-banner success" style={{ marginBottom: 0 }}>
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12" />
            </svg>
            <div class="insight-content">
                <h3>Next Action: Consistent Reviews</h3>
                <p>You have no major trouble spots right now! Keep up the daily reviews to maintain your high recovery rate.</p>
            </div>
        </div>
    );
};

export const PerformanceTabContent: FunctionalComponent = () => {
    return (
        <div class="performance-grid">
            <div id="performance-next-action-container" />
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
                <div id="review-stats-container" />
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
                        </select>
                    </div>
                </div>
                <div id="recovery-tracking-container" />
            </div>
        </div>
    );
};

/**
 * Controller for the Performance & Recovery analytics tab.
 * Aggregates study activity volume timelines and tracks recovery progress
 * for flashcards that have experienced memory lapses.
 */
export class PerformanceTab {
    /** Data utility instance for card statistics and activity queries */
    dataUtils: DataUtils;
    /** Sub-component rendering review activity histograms and period averages */
    reviewStats: ReviewStats;
    /** Sub-component tracking recovered versus struggling lapsed cards */
    recoveryTracking: RecoveryTracking;
    /** Flag indicating whether the primary static DOM shell has already been mounted */
    rendered: boolean;

    /**
     * Initializes the PerformanceTab controller and instantiates child components.
     * @param dataUtils - Card statistics and study history utility instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
            this.reviewStats = new ReviewStats(this.dataUtils);
            this.recoveryTracking = new RecoveryTracking(this.dataUtils);
            this.rendered = false;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('PerformanceTab', `Error initializing PerformanceTab constructor: ${errorMessage}`, { err });
            this.dataUtils = dataUtils;
            this.reviewStats = new ReviewStats(dataUtils);
            this.recoveryTracking = new RecoveryTracking(dataUtils);
            this.rendered = false;
        }
    }

    /**
     * Renders the Performance tab DOM structure into the specified container element.
     * Sets up event listeners for period switching and tag filtering on first mount.
     * @param containerId - DOM ID of the container element hosting the tab.
     * @returns void
     */
    render(containerId: string): void {
        try {
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
                                    </select>
                                </div>
                            </div>
                            <div id="recovery-tracking-container"></div>
                        </div>
                    </div>
                `;
                
                const tagFilter = container.querySelector('#performance-filter-tag') as HTMLSelectElement | null;
                if (tagFilter) {
                    tagFilter.addEventListener('change', (e: Event) => {
                        try {
                            const target = e.target as HTMLSelectElement;
                            this.recoveryTracking.setTagFilter(target.value);
                            this.recoveryTracking.render('recovery-tracking-container');
                        } catch (tagErr) {
                            const errorMessage = tagErr instanceof Error ? tagErr.message : String(tagErr);
                            Logger.error('PerformanceTab', `Error in tag filter change listener: ${errorMessage}`, { tagErr });
                        }
                    });
                }

                const periodSelect = container.querySelector('#review-period-select') as HTMLSelectElement | null;
                if (periodSelect) {
                    periodSelect.addEventListener('change', (e: Event) => {
                        try {
                            const target = e.target as HTMLSelectElement;
                            this.reviewStats.setPeriod(target.value);
                            this.reviewStats.render('review-stats-container');
                        } catch (periodErr) {
                            const errorMessage = periodErr instanceof Error ? periodErr.message : String(periodErr);
                            Logger.error('PerformanceTab', `Error in period select change listener: ${errorMessage}`, { periodErr });
                        }
                    });
                }
                
                this.rendered = true;
            }

            this.reviewStats.render('review-stats-container');
            this.recoveryTracking.render('recovery-tracking-container');
            this.renderNextAction('performance-next-action-container');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('PerformanceTab', `Error rendering PerformanceTab: ${errorMessage}`, { containerId, err });
        }
    }

    /**
     * Inspects cards for high difficulty combined with one or more lapses,
     * rendering an actionable advice banner instructing the user to reformulate problem cards,
     * or a positive reinforcement banner if no trouble spots exist.
     * @param containerId - DOM ID of the container element hosting the banner.
     * @returns void
     */
    renderNextAction(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            const dataUtils = this.dataUtils;
            let struggling = 0;
            if (dataUtils && dataUtils.cards) {
                dataUtils.cards.forEach(c => {
                    const isHard = dataUtils.scheduler ? dataUtils.scheduler.isHighDifficulty(c) : (c.difficulty || 0) >= 7;
                    if (isHard && (c.lapses || 0) >= 1) {
                        struggling++;
                    }
                });
            }

            if (struggling > 0) {
                container.innerHTML = `
                    <div class="actionable-insight-banner warning" style="margin-bottom:0;">
                        <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <div class="insight-content">
                            <h3>Next Action: Reformulate Problem Cards</h3>
                            <p>The scheduling algorithm has identified <strong>${struggling} cards</strong> with a High Difficulty rating that you have lapsed on. Your next action is to <strong>edit these cards</strong>: simplify the information, add a mnemonic, or break them down into smaller pieces.</p>
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
                            <p>You have no major trouble spots right now! Keep up the daily reviews to maintain your high recovery rate.</p>
                        </div>
                    </div>
                `;
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('PerformanceTab', `Error rendering performance next action: ${errorMessage}`, { containerId, err });
        }
    }
}

