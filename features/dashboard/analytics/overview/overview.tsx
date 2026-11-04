/**
 * @file features/dashboard/analytics/overview/overview.tsx
 * @description Main controller for the Analytics Overview tab component.
 * Coordinates rendering of Memory Health scores, Learning Velocity KPI sparklines,
 * a mini 7-day upcoming review forecast strip, and dynamic next action guidance banners.
 * @context Popup / Analytics SPA Dashboard
 */

import { h, Fragment, FunctionalComponent } from 'preact';
import { UIUtils } from '../../../common/utils/uiUtils';
import { MemoryHealth } from './memoryHealth';
import { LearningVelocity } from './learningVelocity';
import { MiniForecast } from './miniForecast';
import { DataUtils } from '../utils/dataUtils';
import AbstractScheduler from '../../../tracker/scheduler/scheduler';

export interface OverviewNextActionBannerProps {
    type: 'caught-up' | 'pending' | 'dropping';
    dueCount?: number;
    health?: number;
}

export const OverviewNextActionBanner: FunctionalComponent<OverviewNextActionBannerProps> = ({ type, dueCount, health }) => {
    if (type === 'pending') {
        return (
            <div class="actionable-insight-banner warning">
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div class="insight-content">
                    <h3>Next Action: Reviews Pending</h3>
                    <p>You have <strong>{dueCount} cards due</strong> right now. Your next action is to head back to the dashboard and clear your queue.</p>
                </div>
            </div>
        );
    }

    if (type === 'dropping') {
        return (
            <div class="actionable-insight-banner warning">
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <div class="insight-content">
                    <h3>Next Action: Memory Health Dropping</h3>
                    <p>Your memory health is currently at {health}%. Your next action should be a <strong>custom study session</strong> to review difficult cards before you forget them.</p>
                </div>
            </div>
        );
    }

    return (
        <div class="actionable-insight-banner success">
            <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
            <div class="insight-content">
                <h3>Next Action: You are all caught up!</h3>
                <p>Your next step is to <strong>enjoy the rest of your day</strong>. Alternatively, you can learn some new cards.</p>
            </div>
        </div>
    );
};

export const OverviewTabContent: FunctionalComponent = () => {
    return (
        <Fragment>
            <div id="overview-next-action-container" />
            <div class="overview-grid">
                <div id="memory-health-container" class="overview-panel" />
                <div id="learning-velocity-container" class="overview-panel" />
            </div>
            <div id="mini-forecast-container" />
        </Fragment>
    );
};

/**
 * Controller for the Overview tab view in the analytics dashboard.
 * Synthesizes high-level retention health, velocity trends, and review queue status.
 */
export class OverviewTab {
    /** Data utility instance for querying card stats and velocity */
    dataUtils: DataUtils;
    /** Sub-component rendering the memory health radial gauge and metric tiles */
    memoryHealth: MemoryHealth;
    /** Sub-component rendering learning speed KPIs and sparkline graphs */
    learningVelocity: LearningVelocity;
    /** Sub-component rendering the horizontal 7-day upcoming review cards */
    miniForecast: MiniForecast;
    /** Flag indicating whether the primary static DOM shell has already been mounted */
    rendered: boolean;

    /**
     * Initializes the OverviewTab with child visualization components.
     * @param dataUtils - Card statistics and study history utility instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
            this.memoryHealth = new MemoryHealth(this.dataUtils);
            this.learningVelocity = new LearningVelocity(this.dataUtils);
            this.miniForecast = new MiniForecast(this.dataUtils);
            this.rendered = false;
        } catch (err) {
            UIUtils.catchError('OverviewTab', 'Error initializing OverviewTab constructor', err);
            this.dataUtils = dataUtils;
            this.memoryHealth = new MemoryHealth(dataUtils);
            this.learningVelocity = new LearningVelocity(dataUtils);
            this.miniForecast = new MiniForecast(dataUtils);
            this.rendered = false;
        }
    }

    /**
     * Renders the complete overview dashboard grid into the specified container element.
     * @param containerId - DOM ID of the container element hosting the overview tab.
     * @returns void
     */
    render(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            if (!this.rendered) {
                container.innerHTML = `
                    <div id="overview-next-action-container"></div>
                    <div class="overview-grid">
                        <div id="memory-health-container" class="overview-panel"></div>
                        <div id="learning-velocity-container" class="overview-panel"></div>
                    </div>
                    <div id="mini-forecast-container"></div>
                `;
                this.rendered = true;
            }

            this.renderNextAction('overview-next-action-container');
            this.memoryHealth.render('memory-health-container');
            this.learningVelocity.render('learning-velocity-container');
            this.miniForecast.render('mini-forecast-container');
        } catch (err) {
            UIUtils.catchError('OverviewTab', 'Error rendering OverviewTab', err, { containerId });
        }
    }

    /**
     * Determines the user's highest-priority next study action based on due queue size,
     * memory health drop relative to target retention, or complete catch-up state.
     * @param containerId - DOM ID of the container element hosting the action banner.
     * @returns void
     */
    renderNextAction(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            const stats = this.dataUtils.getSummaryStats();
            const dueCount = stats.due || 0;
            
            let healthScore = 0;
            if (stats.trueRetention > 0) {
                healthScore = stats.trueRetention;
            } else if (stats.retention > 0) {
                healthScore = stats.retention;
            }
            const health = healthScore;
            
            const sched = this.dataUtils.scheduler as (AbstractScheduler & { requestRetention?: number }) | null;
            const targetRetention = (sched && sched.requestRetention)
                ? sched.requestRetention * 100
                : 90;

            if (dueCount > 0) {
                container.innerHTML = this.buildPendingReviewsBanner(dueCount);
            } else if (health < (targetRetention - 7) && stats.totalCards > 10) {
                container.innerHTML = this.buildMemoryHealthDroppingBanner(health);
            } else {
                container.innerHTML = this.buildCaughtUpBanner();
            }
        } catch (err) {
            UIUtils.catchError('OverviewTab', 'Error rendering overview next action', err, { containerId });
        }
    }

    /**
     * Generates HTML markup for an all-caught-up success banner.
     * @returns Rendered HTML banner string.
     */
    private buildCaughtUpBanner(): string {
        return `
            <div class="actionable-insight-banner success">
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <div class="insight-content">
                    <h3>Next Action: You are all caught up!</h3>
                    <p>Your next step is to <strong>enjoy the rest of your day</strong>. Alternatively, you can learn some new cards.</p>
                </div>
            </div>
        `;
    }

    /**
     * Generates HTML markup for a warning banner indicating pending reviews.
     * @param dueCount - Number of cards currently due for review.
     * @returns Rendered HTML banner string.
     */
    private buildPendingReviewsBanner(dueCount: number): string {
        return `
            <div class="actionable-insight-banner warning">
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <div class="insight-content">
                    <h3>Next Action: Reviews Pending</h3>
                    <p>You have <strong>${dueCount} cards due</strong> right now. Your next action is to head back to the dashboard and clear your queue.</p>
                </div>
            </div>
        `;
    }

    /**
     * Generates HTML markup for a warning banner indicating declining memory retention.
     * @param health - Current retention score percentage.
     * @returns Rendered HTML banner string.
     */
    private buildMemoryHealthDroppingBanner(health: number): string {
        return `
            <div class="actionable-insight-banner warning">
                <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <div class="insight-content">
                    <h3>Next Action: Memory Health Dropping</h3>
                    <p>Your memory health is currently at ${health}%. Your next action should be a <strong>custom study session</strong> to review difficult cards before you forget them.</p>
                </div>
            </div>
        `;
    }
}

