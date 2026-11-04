/**
 * @file features/dashboard/analytics/insights/insights.tsx
 * @description Main controller for the Behavioral Insights tab in the Analytics Dashboard.
 * Embeds time-of-day study analytics and presents actionable recommendation banners
 * advising optimal review scheduling based on retention patterns.
 *
 * Architecture Role: Analytics Tab Sub-View Controller (Behavioral Insights).
 * Context: Extension Standalone Tab (`features/dashboard/analytics/analytics.html`).
 * Key Exports:
 * - {@link InsightsTab}: View controller class rendering study habits and recommendation banners.
 */

import { h, Fragment, FunctionalComponent } from 'preact';
import { UIUtils } from '../../../common/utils/uiUtils';
import { ReviewTimeAnalytics } from './reviewTimeAnalytics';
import { DataUtils } from '../utils/dataUtils';

export interface InsightsNextActionBannerProps {
    type: 'empty' | 'optimize' | 'collect';
    bucketName?: string;
}

export const InsightsNextActionBanner: FunctionalComponent<InsightsNextActionBannerProps> = ({ type, bucketName }) => {
    if (type === 'empty') {
        return (
            <div class="actionable-insight-banner warning" style={{ marginBottom: 0 }}>
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                </svg>
                <div class="insight-content">
                    <h3>Next Action: Keep Reviewing</h3>
                    <p>Not enough timestamp data available yet. Your next action is to <strong>do more reviews</strong> so we can figure out your best study time.</p>
                </div>
            </div>
        );
    }

    if (type === 'optimize') {
        return (
            <div class="actionable-insight-banner success" style={{ marginBottom: 0 }}>
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div class="insight-content">
                    <h3>Next Action: Optimize Your Schedule</h3>
                    <p>Based on your FSRS review logs, you retain information best in the <strong>{bucketName}</strong>. Your next action is to <strong>schedule your heaviest study sessions during this time</strong> to maximize your memory consolidation.</p>
                </div>
            </div>
        );
    }

    return (
        <div class="actionable-insight-banner success" style={{ marginBottom: 0 }}>
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <div class="insight-content">
                <h3>Next Action: Collect More Data</h3>
                <p>We're starting to track your habits in the FSRS logs. Keep reviewing at different times of the day to discover when your memory is sharpest!</p>
            </div>
        </div>
    );
};

export const InsightsTabContent: FunctionalComponent = () => {
    return (
        <div class="insights-grid">
            <div id="insights-next-action-container" />
            <div class="insights-panel ana-panel-wide">
                <div class="ana-panel-header">
                    <span class="ana-panel-title">
                        Review Time Analytics
                        <span class="help-icon" data-tooltip="Analyzes your retention rates based on the time of day you do your reviews to find your most effective study time.">?</span>
                    </span>
                    <span class="ana-panel-hint">When do you study best?</span>
                </div>
                <div id="review-time-analytics-container" />
            </div>
        </div>
    );
};

/**
 * Controller for the Insights tab, rendering behavioral study metrics and next actions.
 */
export class InsightsTab {
    /** Shared statistical calculation engine. */
    dataUtils: DataUtils;
    /** Sub-component rendering time-of-day charts and duration statistics. */
    reviewTimeAnalytics: ReviewTimeAnalytics;
    /** Tracks whether static DOM container scaffolding has already been injected. */
    rendered: boolean;

    /**
     * Initializes the Insights tab with a DataUtils reference.
     * @param dataUtils - Statistical engine instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
            this.reviewTimeAnalytics = new ReviewTimeAnalytics(this.dataUtils);
            this.rendered = false;
        } catch (err) {
            UIUtils.catchError('InsightsTab', 'Error initializing InsightsTab constructor', err);
            this.dataUtils = dataUtils;
            this.reviewTimeAnalytics = new ReviewTimeAnalytics(dataUtils);
            this.rendered = false;
        }
    }

    /**
     * Renders container structure and initiates child component rendering.
     * @param containerId - ID of parent DOM element.
     */
    render(containerId: string): void {
        try {
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
        } catch (err) {
            UIUtils.catchError('InsightsTab', 'Error rendering InsightsTab', err, { containerId });
        }
    }

    /**
     * Evaluates study time buckets and renders an actionable recommendation banner.
     * @param containerId - ID of the container element for the banner.
     */
    renderNextAction(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            const timeInsights = this.dataUtils ? this.dataUtils.getReviewTimeInsights() : { hasTimeData: false, data: [] };
            const { hasTimeData, data } = timeInsights;

            if (!hasTimeData || !data || data.every(d => d.reviews === 0)) {
                container.innerHTML = this.buildEmptyStateBanner();
                return;
            }

            // Find the time bucket with the highest retention (minimum 5 reviews)
            const validData = data.filter(d => d.reviews > 5);
            const best = validData.length > 0 
                ? validData.reduce((prev, current) => (prev.retention > current.retention) ? prev : current)
                : null;

            if (best) {
                container.innerHTML = this.buildOptimizationBanner(best.bucket);
            } else {
                container.innerHTML = this.buildCollectMoreDataBanner();
            }
        } catch (err) {
            UIUtils.catchError('InsightsTab', 'Error rendering insights next action', err, { containerId });
        }
    }

    /**
     * Builds HTML template for the empty state warning banner.
     */
    private buildEmptyStateBanner(): string {
        return `
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
    }

    /**
     * Builds HTML template for the schedule optimization advice banner.
     * @param bucketName - Best-performing study time period name (e.g. 'morning').
     */
    private buildOptimizationBanner(bucketName: string): string {
        return `
            <div class="actionable-insight-banner success" style="margin-bottom:0;">
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <div class="insight-content">
                    <h3>Next Action: Optimize Your Schedule</h3>
                    <p>Based on your FSRS review logs, you retain information best in the <strong>${bucketName}</strong>. Your next action is to <strong>schedule your heaviest study sessions during this time</strong> to maximize your memory consolidation.</p>
                </div>
            </div>
        `;
    }

    /**
     * Builds HTML template advising the user to log more reviews across different times.
     */
    private buildCollectMoreDataBanner(): string {
        return `
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

