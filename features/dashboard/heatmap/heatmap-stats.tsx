/**
 * @file features/dashboard/heatmap/heatmap-stats.tsx
 * @description Computes study streak statistics and renders the statistics card panels
 * inside the full-screen heatmap page.
 * Migrated to Preact with TypeScript for declarative stats rendering.
 *
 * Architecture Role: Heatmap Streak & Cadence Statistics Engine.
 * Context: Extension Standalone Tab (`features/dashboard/heatmap/heatmap.html`).
 * Key Exports:
 * - `StreakStatsResult`: Metrics output containing current streak, longest streak, active days, and max reviews.
 * - `StreakStatCard`: Preact component rendering an individual metric card.
 * - `HeatmapStatsDashboard`: Preact component rendering the 4-metric grid.
 * - `HeatmapStats`: Static utility class computing streaks and rendering KPI cards.
 */

import { h, VNode, render } from 'preact';
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { MS_PER_DAY } from '../../common/constants';

/**
 * Calculated streak and activity statistics derived from user review logs.
 */
export interface StreakStatsResult {
    /** Current consecutive days with at least one review completed (active today or yesterday). */
    currentStreak: number;
    /** All-time longest consecutive daily review streak. */
    longestStreak: number;
    /** Total number of unique calendar days on which reviews occurred. */
    activeDays: number;
    /** Highest number of reviews completed in a single calendar day. */
    maxReviews: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface StreakStatCardProps {
    title: string;
    value: number;
    unit: string;
    variant: 'streak' | 'longest' | 'active' | 'max';
    iconSvg: VNode;
}

/**
 * Preact component rendering a single heatmap KPI stat card.
 */
export function StreakStatCard({ title, value, unit, variant, iconSvg }: StreakStatCardProps): VNode {
    return (
        <div className={`stats-card stats-card-${variant}`}>
            <span className="stats-card-title">
                {iconSvg}
                {title}
            </span>
            <div className="stats-card-value">
                {value}
                <span className="stats-card-unit">{unit}</span>
            </div>
        </div>
    );
}

export interface HeatmapStatsDashboardProps {
    stats: StreakStatsResult;
}

/**
 * Preact component rendering all four streak and cadence KPI stat cards.
 */
export function HeatmapStatsDashboard({ stats }: HeatmapStatsDashboardProps): VNode {
    return (
        <div className="stats-grid">
            <StreakStatCard
                title="Current Streak"
                value={stats.currentStreak}
                unit="days"
                variant="streak"
                iconSvg={
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: '#f0932b', width: '13px', height: '13px' }}>
                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                    </svg>
                }
            />
            <StreakStatCard
                title="Longest Streak"
                value={stats.longestStreak}
                unit="days"
                variant="longest"
                iconSvg={
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-warning)', width: '13px', height: '13px' }}>
                        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                        <path d="M4 22h16" />
                        <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34" />
                        <path d="M12 2a6 6 0 0 0-6 6v3a6 6 0 0 0 12 0V8a6 6 0 0 0-6-6z" />
                    </svg>
                }
            />
            <StreakStatCard
                title="Active Days"
                value={stats.activeDays}
                unit="days"
                variant="active"
                iconSvg={
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-primary)', width: '13px', height: '13px' }}>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                }
            />
            <StreakStatCard
                title="Max Reviews"
                value={stats.maxReviews}
                unit="reviews"
                variant="max"
                iconSvg={
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ stroke: 'var(--md-success)', width: '13px', height: '13px' }}>
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                }
            />
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS CALCULATION & DOM INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Utility class providing mathematical streak calculation algorithms
 * and DOM rendering for the KPI stat cards on the heatmap page.
 */
export class HeatmapStats {
    /**
     * Calculates current streak, longest streak, active days, and max reviews in a day,
     * and renders the corresponding HTML templates into the stats container.
     * @param activityData - Map of ISO date strings (`YYYY-MM-DD`) to daily review counts.
     */
    static renderStatsDashboard(activityData: Record<string, number>): void {
        try {
            const container = document.getElementById('heatmap-stats-container');
            if (!container) return;

            const stats = this.getStreakStats(activityData);

            render(<HeatmapStatsDashboard stats={stats} />, container);
        } catch (err) {
            UIUtils.catchError('HeatmapStats', 'Error rendering heatmap stats dashboard', err);
        }
    }

    /**
     * Calculates current and historical maximum streaks, active days,
     * and maximum daily review load metrics from the global activity data.
     * @param activityData - Map of ISO date strings (`YYYY-MM-DD`) to daily review counts.
     * @returns {@link StreakStatsResult} containing streak and activity metrics.
     */
    static getStreakStats(activityData: Record<string, number>): StreakStatsResult {
        try {
            const dates = Object.keys(activityData).filter(d => activityData[d] > 0).sort();
            if (dates.length === 0) {
                return { currentStreak: 0, longestStreak: 0, activeDays: 0, maxReviews: 0 };
            }
            
            const activeDays = dates.length;
            const maxReviews = Math.max(...Object.values(activityData), 0);
            
            let longestStreak = 0;
            let currentStreak = 0;
            
            let tempStreak = 0;
            let lastTime: number | null = null;
            
            dates.forEach(dStr => {
                const parts = dStr.split('-');
                const t = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
                
                if (lastTime === null) {
                    tempStreak = 1;
                } else {
                    const diffDays = Math.round((t - lastTime) / MS_PER_DAY);
                    if (diffDays === 1) {
                        tempStreak++;
                    } else if (diffDays > 1) {
                        if (tempStreak > longestStreak) longestStreak = tempStreak;
                        tempStreak = 1;
                    }
                }
                lastTime = t;
            });
            if (tempStreak > longestStreak) longestStreak = tempStreak;
            
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayTime = today.getTime();
            
            let checkTime = todayTime;
            const todayStr = new Date(checkTime - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const yesterdayStr = new Date(checkTime - MS_PER_DAY - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            
            if (activityData[todayStr] > 0 || activityData[yesterdayStr] > 0) {
                if (activityData[todayStr] > 0) {
                    checkTime = todayTime;
                } else {
                    checkTime = todayTime - MS_PER_DAY;
                }
                
                while (true) {
                    const checkStr = new Date(checkTime - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                    if (activityData[checkStr] > 0) {
                        currentStreak++;
                        checkTime -= MS_PER_DAY;
                    } else {
                        break;
                    }
                }
            }
            
            return { currentStreak, longestStreak, activeDays, maxReviews };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HeatmapStats', `Error calculating streak stats: ${errorMessage}`, { err });
            return { currentStreak: 0, longestStreak: 0, activeDays: 0, maxReviews: 0 };
        }
    }
}

try {
    const win = window as unknown as { AlgoRecall: { HeatmapStats?: typeof HeatmapStats } };
    win.AlgoRecall = win.AlgoRecall || {};
    win.AlgoRecall.HeatmapStats = HeatmapStats;
} catch (err) {
    UIUtils.catchError('HeatmapStats', 'Error binding HeatmapStats to window.AlgoRecall', err);
}

if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).HeatmapStats = HeatmapStats;
    (module.exports as any).HeatmapStatsDashboard = HeatmapStatsDashboard;
    (module.exports as any).StreakStatCard = StreakStatCard;
}

