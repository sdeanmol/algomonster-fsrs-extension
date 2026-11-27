/**
 * @file features/dashboard/analytics/overview/overview.tsx
 * @description Main controller for the Analytics Overview tab component.
 * Coordinates rendering of Memory Health scores, Learning Velocity KPI sparklines,
 * a mini 7-day upcoming review forecast strip, and dynamic next action guidance banners.
 * @context Popup / Analytics SPA Dashboard
 */

import { h, Fragment, FunctionalComponent, render } from 'preact';
import { useMemo } from 'preact/hooks';
import { UIUtils } from '../../../common/utils/uiUtils';
import { MemoryHealth, MemoryHealthPanel } from './memoryHealth';
import { LearningVelocity, LearningVelocityView } from './learningVelocity';
import { MiniForecast, MiniForecastPanel } from './miniForecast';
import { DataUtils } from '../utils/dataUtils';
import { resolveContainer } from '../utils/resolveContainer';
import { Card } from '../../../../types/domain';
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

export interface OverviewTabProps {
    cards?: Card[];
    activity?: Record<string, number>;
    dataUtils?: DataUtils;
}

const SafeMemoryHealthPanel: FunctionalComponent<{ dataUtils: DataUtils }> = (props) => {
    if (typeof MemoryHealthPanel === 'function') {
        return <MemoryHealthPanel {...props} />;
    }
    return null;
};

const SafeLearningVelocityView: FunctionalComponent<{ dataUtils: DataUtils }> = (props) => {
    if (typeof LearningVelocityView === 'function') {
        return <LearningVelocityView {...props} />;
    }
    return null;
};

const SafeMiniForecastPanel: FunctionalComponent<{ dataUtils: DataUtils }> = (props) => {
    if (typeof MiniForecastPanel === 'function') {
        return <MiniForecastPanel {...props} />;
    }
    return null;
};

export const OverviewTabComponent: FunctionalComponent<OverviewTabProps> = ({ cards, activity, dataUtils: propDataUtils }) => {
    const dataUtils = useMemo(() => propDataUtils || new DataUtils(cards || [], activity || {}, null), [propDataUtils, cards, activity]);
    const stats = useMemo(() => dataUtils.getSummaryStats(), [dataUtils]);

    const nextActionType = useMemo<'pending' | 'dropping' | 'caught-up'>(() => {
        const dueCount = stats.due || 0;
        let healthScore = 0;
        if (stats.trueRetention > 0) healthScore = stats.trueRetention;
        else if (stats.retention > 0) healthScore = stats.retention;
        const health = healthScore;

        const sched = dataUtils.scheduler as (AbstractScheduler & { requestRetention?: number }) | null;
        const targetRetention = (sched && sched.requestRetention) ? sched.requestRetention * 100 : 90;

        if (dueCount > 0) return 'pending';
        if (health < (targetRetention - 7) && (stats.totalCards || 0) > 10) return 'dropping';
        return 'caught-up';
    }, [stats, dataUtils]);

    return (
        <Fragment>
            <div id="overview-next-action-container">
                <OverviewNextActionBanner
                    type={nextActionType}
                    dueCount={stats.due || 0}
                    health={stats.trueRetention > 0 ? stats.trueRetention : (stats.retention || 0)}
                />
            </div>
            <div class="overview-grid">
                <div id="memory-health-container" class="overview-panel">
                    <SafeMemoryHealthPanel dataUtils={dataUtils} />
                </div>
                <div id="learning-velocity-container" class="overview-panel">
                    <SafeLearningVelocityView dataUtils={dataUtils} />
                </div>
            </div>
            <div id="mini-forecast-container">
                <SafeMiniForecastPanel dataUtils={dataUtils} />
            </div>
        </Fragment>
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
export class OverviewTabClass {
    props?: OverviewTabProps;
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
            const container = resolveContainer(containerId);
            if (!container) return;
            
            render(<OverviewTabComponent dataUtils={this.dataUtils} />, container);
            this.rendered = true;
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
            const container = resolveContainer(containerId);
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

            let bannerType: 'pending' | 'dropping' | 'caught-up' = 'caught-up';
            if (dueCount > 0) {
                bannerType = 'pending';
            } else if (health < (targetRetention - 7) && stats.totalCards > 10) {
                bannerType = 'dropping';
            }

            render(<OverviewNextActionBanner type={bannerType} dueCount={dueCount} health={health} />, container);
        } catch (err) {
            UIUtils.catchError('OverviewTab', 'Error rendering overview next action', err, { containerId });
        }
    }
}

export type OverviewTab = OverviewTabClass;

export const OverviewTab: FunctionalComponent<OverviewTabProps> & {
    new (dataUtils: DataUtils): OverviewTabClass;
} = function(this: any, propsOrDataUtils: any) {
    if (new.target) {
        return new OverviewTabClass(propsOrDataUtils);
    }
    return OverviewTabComponent(propsOrDataUtils);
} as any;

