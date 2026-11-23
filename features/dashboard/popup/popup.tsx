/**
 * @file Browser Action Popup Primary Application (Pure Declarative Preact)
 * @module features/dashboard/popup/popup
 * @context Browser Action Popup UI (`features/dashboard/popup/popup.html`)
 * @description Master entry point and single-page application for the browser action popup.
 * Pure declarative Preact functional architecture mounting once at `<div id="root"></div>`.
 * Eliminates all imperative DOM querying and mutations, restoring 100% visual parity and
 * canonical navigation link destinations matching the main reference commit.
 */

import { h, Fragment, VNode, render, FunctionalComponent } from 'preact';
import { flushSync } from 'preact/compat';
import { useState, useEffect, useMemo, useCallback, useRef } from 'preact/hooks';
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { withErrorHandling } from '../../../decorators';
import { Card, StorageData, ExtensionSettings, Achievement, PersonalRecords, FSRSParameters } from '../../../types/domain';
import { BROWSER_CONFIG } from '../../common/browserConfig';
import { calculateStreaks, triggerConfetti } from './stats';
import {
    DEFAULT_DAILY_GOAL,
    DEFAULT_EXTENSION_SETTINGS,
    MS_PER_DAY,
    DAYS_PER_WEEK,
    HEATMAP_LEVEL_THRESHOLDS,
    SEARCH_MAX_RESULTS,
    RECALL_THRESHOLD_GOOD,
    RECALL_THRESHOLD_WARNING,
    DUE_CARDS_THRESHOLD_WARNING,
    STREAK_MILESTONES,
    REVIEW_MILESTONES
} from '../../common/constants';
import { ThemeSync } from '../../common/theme-sync';
import { ActionService } from '../../common/services/actionService';
import { getLastReviewDate } from '../../common/utils/cardUtils';
import AbstractScheduler from '../../tracker/scheduler/scheduler';
import FsrsScheduler from '@tracker/scheduler/fsrsScheduler';
import { evaluateAchievements } from './achievements';

function safeFlushSync(fn: () => void): void {
    try {
        flushSync(fn);
    } catch (_) {
        fn();
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// PREACT CHILD COMPONENTS (EXPORTED FOR UNIT TESTS & MODULAR RENDERING)
// ─────────────────────────────────────────────────────────────────────────────

export interface PopupHeaderProps {
    onToggleTheme?: () => void;
    onOpenAnalytics?: () => void;
}

export function PopupHeader({ onToggleTheme, onOpenAnalytics }: PopupHeaderProps): VNode {
    return (
        <header className="popup-header">
            <div className="brand-badge">
                <span className="brand-name">AlgoRecall</span>
            </div>
            <div className="header-actions">
                <button
                    id="header-analytics-btn"
                    className="icon-btn"
                    title="Open Full Analytics Dashboard"
                    onClick={onOpenAnalytics}
                >
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }}>
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                </button>
                <button
                    id="theme-toggle-btn"
                    className="icon-btn"
                    title="Toggle Dark / Light Theme"
                    onClick={onToggleTheme}
                >
                    🌓
                </button>
            </div>
        </header>
    );
}

export interface PopupNavigationGridProps {
    onOpenAnalytics?: () => void;
    onOpenHeatmap?: () => void;
    onOpenForecast?: () => void;
    onOpenHistory?: () => void;
    onOpenStudyPlan?: () => void;
    onOpenPomodoro?: () => void;
    onOpenSummary?: () => void;
    onOpenConfigureFsrs?: () => void;
    onOpenPlatforms?: () => void;
    onOpenHelp?: () => void;
}

export function PopupNavigationGrid({
    onOpenAnalytics,
    onOpenHeatmap,
    onOpenForecast,
    onOpenHistory,
    onOpenStudyPlan,
    onOpenPomodoro,
    onOpenSummary,
    onOpenConfigureFsrs,
    onOpenPlatforms,
    onOpenHelp
}: PopupNavigationGridProps): VNode {
    return (
        <div className="navigation-grid">
            <button id="open-analytics-btn" className="nav-btn" onClick={onOpenAnalytics}>
                Analytics
            </button>
            <button id="open-heatmap-tab-btn" className="nav-btn" onClick={onOpenHeatmap}>
                Heatmap
            </button>
            <button id="open-forecast-btn" className="nav-btn" onClick={onOpenForecast}>
                Forecast
            </button>
            <button id="open-history-btn" className="nav-btn" onClick={onOpenHistory}>
                History
            </button>
            <button id="open-studyplan-btn" className="nav-btn" onClick={onOpenStudyPlan}>
                Study Plan
            </button>
            <button id="open-pomodoro-btn" className="nav-btn" onClick={onOpenPomodoro}>
                Pomodoro
            </button>
            <button id="open-summary-page-btn" className="nav-btn" onClick={onOpenSummary}>
                Summary
            </button>
            <button id="configure-fsrs-btn" className="nav-btn" onClick={onOpenConfigureFsrs}>
                Settings
            </button>
            <button id="manage-platforms-btn" className="nav-btn" onClick={onOpenPlatforms}>
                Platforms
            </button>
            <button id="help-btn" className="nav-btn" onClick={onOpenHelp}>
                Help
            </button>
        </div>
    );
}

export interface PopupSettingsTogglesProps {
    markerEnabled: boolean;
    chartsEnabled: boolean;
    launcherEnabled: boolean;
    devModeEnabled: boolean;
    onToggleMarker?: (enabled: boolean) => void;
    onToggleCharts?: (enabled: boolean) => void;
    onToggleLauncher?: (enabled: boolean) => void;
    onToggleDevMode?: (enabled: boolean) => void;
}

export function PopupSettingsToggles({
    markerEnabled,
    chartsEnabled,
    launcherEnabled,
    devModeEnabled,
    onToggleMarker,
    onToggleCharts,
    onToggleLauncher,
    onToggleDevMode
}: PopupSettingsTogglesProps): VNode {
    return (
        <div className="popup-settings-card">
            <div className="setting-toggle-row">
                <label htmlFor="toggle-text-marker">Floating Highlighter</label>
                <input
                    type="checkbox"
                    id="toggle-text-marker"
                    checked={markerEnabled}
                    onChange={(e) => onToggleMarker && onToggleMarker((e.target as HTMLInputElement).checked)}
                />
            </div>
            <div className="setting-toggle-row">
                <label htmlFor="toggle-show-charts">Activity Charts</label>
                <input
                    type="checkbox"
                    id="toggle-show-charts"
                    checked={chartsEnabled}
                    onChange={(e) => onToggleCharts && onToggleCharts((e.target as HTMLInputElement).checked)}
                />
            </div>
            <div className="setting-toggle-row">
                <label htmlFor="toggle-tracker-launcher">Problem Tracker Button</label>
                <input
                    type="checkbox"
                    id="toggle-tracker-launcher"
                    checked={launcherEnabled}
                    onChange={(e) => onToggleLauncher && onToggleLauncher((e.target as HTMLInputElement).checked)}
                />
            </div>
            <div className="setting-toggle-row">
                <label htmlFor="toggle-dev-mode">Developer Mode</label>
                <input
                    type="checkbox"
                    id="toggle-dev-mode"
                    checked={devModeEnabled}
                    onChange={(e) => onToggleDevMode && onToggleDevMode((e.target as HTMLInputElement).checked)}
                />
            </div>
        </div>
    );
}

export interface PopupStatusToastProps {
    message: string | null;
}

export function PopupStatusToast({ message }: PopupStatusToastProps): VNode | null {
    if (!message) return null;
    return (
        <div id="status-msg" className="status-toast show">
            {message}
        </div>
    );
}

export interface DailyFocusCardProps {
    completedToday?: number;
    dailyGoalTarget?: number;
    currentStreak?: number;
    longestStreak?: number;
    activity?: Record<string, number>;
    achievements?: Achievement[];
    studyPlanDaysLeft?: number | null;
    isEditingGoal?: boolean;
    goalInputVal?: string;
    onToggleGoalEdit?: () => void;
    onGoalInputChange?: (val: string) => void;
    onSaveGoal?: () => void;
    onOpenAchievements?: () => void;
    style?: any;
    hasCards?: boolean;
}

export function DailyFocusCard({
    completedToday = 0,
    dailyGoalTarget = DEFAULT_DAILY_GOAL,
    currentStreak = 0,
    longestStreak = 0,
    activity = {},
    achievements = [],
    studyPlanDaysLeft = null,
    isEditingGoal = false,
    goalInputVal = String(DEFAULT_DAILY_GOAL),
    onToggleGoalEdit,
    onGoalInputChange,
    onSaveGoal,
    onOpenAchievements,
    style,
    hasCards = true
}: DailyFocusCardProps = {}): VNode {
    const isGoalMet = dailyGoalTarget > 0 && completedToday >= dailyGoalTarget;
    const progress = dailyGoalTarget > 0 ? completedToday / dailyGoalTarget : 0;
    const circumference = 2 * Math.PI * 42;
    const offset = circumference - (Math.min(Math.max(progress, 0), 1) * circumference);

    // 7-day rolling momentum calculation
    const today = new Date();
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const momentumDays: Array<{ day: string; count: number; goalMet: boolean; isToday: boolean; dateKey: string; tooltip: string }> = [];
    let activeDaysCount = 0;

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateKey = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const count = activity[dateKey] || 0;
        const isToday = i === 0;
        const goalMet = count >= dailyGoalTarget && dailyGoalTarget > 0;
        if (count > 0) activeDaysCount++;

        const tooltip = `${dateKey}: ${count} review${count === 1 ? '' : 's'}${goalMet ? ' (Goal reached!)' : ''}`;
        momentumDays.push({
            day: dayNames[d.getDay()],
            count,
            goalMet,
            isToday,
            dateKey,
            tooltip
        });
    }

    const unlockedCount = achievements.filter(a => a.unlocked).length;
    const totalCount = achievements.length || 8;

    return (
        <div id="daily-focus-card" className="card activity-focus-card" style={style}>
            <div className="card-header-clean">
                <div className="header-label-group">
                    <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                    </svg>
                    <span className="card-title">Daily Focus & Momentum</span>
                </div>
            </div>

            <div id="gamification-panel" className="gamification-wrapper">
                {!hasCards ? (
                    <div className="achievement-state">
                        <div className="achievement-title" style={{ color: 'var(--md-text-low)' }}>
                            <svg className="svg-icon" style={{ stroke: 'var(--md-text-low)', marginRight: '4px' }} viewBox="0 0 24 24">
                                <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
                                <circle cx="12" cy="10" r="3" />
                            </svg>
                            Welcome to Spaced Repetitions!
                        </div>
                        <div className="achievement-subtitle">
                            Highlight text or open the review widget on problems to save your first pattern.
                        </div>
                    </div>
                ) : (
                    <Fragment>
                        {/* Circular SVG Goal Progress Ring */}
                        <div className="goal-ring-container">
                            <div className={`goal-ring-wrap ${isGoalMet ? 'goal-ring-complete' : ''}`}>
                                <svg className="goal-ring-svg" viewBox="0 0 100 100">
                                    <circle className="goal-ring-bg" cx="50" cy="50" r="42" />
                                    <circle
                                        id="goal-progress-ring"
                                        className={`goal-ring-fill ${isGoalMet ? 'goal-ring-fill-complete' : ''}`}
                                        cx="50"
                                        cy="50"
                                        r="42"
                                        strokeDasharray={String(circumference)}
                                        strokeDashoffset={String(offset)}
                                    />
                                </svg>
                                <div className="goal-ring-text">
                                    {isGoalMet ? (
                                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '22px', height: '22px', stroke: 'var(--md-success)' }}>
                                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                            <polyline points="22 4 12 14.01 9 11.01" />
                                        </svg>
                                    ) : (
                                        <Fragment>
                                            <span id="daily-goal-count" className="goal-ring-count">{completedToday}</span>
                                            <span className="goal-ring-label">of <span id="daily-goal-target">{dailyGoalTarget}</span></span>
                                        </Fragment>
                                    )}
                                </div>
                            </div>
                            <div className="goal-info">
                                <div className="gamification-header">
                                    <span className="gamification-title" style={isGoalMet ? { color: 'var(--md-success)' } : {}}>
                                        <svg className="svg-icon" style={{ stroke: isGoalMet ? 'var(--md-success)' : 'var(--md-warning)', marginRight: '3px' }} viewBox="0 0 24 24">
                                            {isGoalMet ? (
                                                <Fragment>
                                                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                    <polyline points="22 4 12 14.01 9 11.01" />
                                                </Fragment>
                                            ) : (
                                                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                                            )}
                                        </svg>
                                        {isGoalMet ? 'Goal Complete!' : 'Daily Goal'}
                                    </span>
                                    <button
                                        id="goal-edit-btn"
                                        className="goal-edit-btn"
                                        title="Change daily goal"
                                        aria-label="Change daily goal"
                                        onClick={onToggleGoalEdit}
                                    >
                                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '11px', height: '11px' }}>
                                            <circle cx="12" cy="12" r="3" />
                                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                                        </svg>
                                    </button>
                                </div>

                                <div
                                    id="goal-editor"
                                    className="goal-editor"
                                    style={{ display: isEditingGoal ? 'flex' : 'none' }}
                                >
                                    <input
                                        type="number"
                                        id="goal-input"
                                        className="goal-input"
                                        value={goalInputVal}
                                        min="1"
                                        max="999"
                                        onInput={(e) => onGoalInputChange && onGoalInputChange((e.target as HTMLInputElement).value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') onSaveGoal && onSaveGoal();
                                        }}
                                    />
                                    <button
                                        id="goal-save-btn"
                                        className="goal-save-btn"
                                        onClick={onSaveGoal}
                                    >
                                        Set
                                    </button>
                                </div>

                                {/* Streak Badge */}
                                {(currentStreak > 0 || longestStreak > 0) && (
                                    <div className="streak-badge">
                                        <svg
                                            className="svg-icon streak-fire"
                                            style={{
                                                stroke: currentStreak > 0 ? 'var(--md-warning)' : 'var(--md-text-low)',
                                                fill: currentStreak > 0 ? 'rgba(249,171,0,0.2)' : 'none'
                                            }}
                                            viewBox="0 0 24 24"
                                        >
                                            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                                        </svg>
                                        <span id="streak-days" className="streak-text">
                                            {currentStreak > 0 ? `${currentStreak}-day streak` : 'No active streak'}
                                        </span>
                                        {longestStreak > 0 && (
                                            <span id="longest-streak" className="streak-best">
                                                Best: {longestStreak}
                                            </span>
                                        )}
                                        <span id="study-streak-count" style={{ display: 'none' }}>{currentStreak}</span>
                                        <span id="momentum-days" style={{ display: 'none' }}>{currentStreak > 0 ? `${currentStreak}d Active` : '0d'}</span>
                                    </div>
                                )}

                                {/* Motivational Text */}
                                <div id="daily-goal-status" className="gamification-msg">
                                    {isGoalMet ? (
                                        <Fragment>
                                            <svg className="svg-icon" style={{ stroke: 'var(--md-success)', marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} viewBox="0 0 24 24">
                                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                                <polyline points="22 4 12 14.01 9 11.01" />
                                            </svg>
                                            All {completedToday} reviews done! Inbox Zero achieved!
                                        </Fragment>
                                    ) : completedToday > 0 ? (
                                        <Fragment>
                                            <svg className="svg-icon" style={{ stroke: 'var(--md-success)', marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} viewBox="0 0 24 24">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            Keep going! {Math.max(0, dailyGoalTarget - completedToday)} more to hit your goal!
                                        </Fragment>
                                    ) : (
                                        <Fragment>
                                            <svg className="svg-icon" style={{ stroke: 'var(--md-primary)', marginRight: '4px', display: 'inline-block', verticalAlign: 'middle' }} viewBox="0 0 24 24">
                                                <circle cx="12" cy="12" r="10" />
                                                <circle cx="12" cy="12" r="6" />
                                                <circle cx="12" cy="12" r="2" />
                                            </svg>
                                            Start your daily streak today!
                                        </Fragment>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Exam Countdown Pill (if study plan active) */}
                        {studyPlanDaysLeft !== null && (
                            <div className={`exam-countdown-pill ${studyPlanDaysLeft <= 3 ? '' : 'safe'}`}>
                                <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '12px', height: '12px' }}>
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                    <line x1="16" y1="2" x2="16" y2="6" />
                                    <line x1="8" y1="2" x2="8" y2="6" />
                                    <line x1="3" y1="10" x2="21" y2="10" />
                                </svg>
                                {studyPlanDaysLeft === 0 ? 'Exam is today!' : `${studyPlanDaysLeft} day${studyPlanDaysLeft !== 1 ? 's' : ''} until exam`}
                            </div>
                        )}

                        {/* 7-Day Momentum Calendar Row */}
                        <div className="weekly-progress-container" aria-label="7-Day Review Momentum">
                            <div className="weekly-progress-header">
                                <span className="weekly-progress-title">7-Day Momentum</span>
                                <span className="weekly-progress-badge">{activeDaysCount}/7 active</span>
                            </div>
                            <div className="weekly-days-row">
                                {momentumDays.map(day => (
                                    <div
                                        key={day.dateKey}
                                        className={`weekly-day-col ${day.goalMet ? 'goal-met' : day.count > 0 ? 'active' : 'empty'} ${day.isToday ? 'is-today' : ''}`}
                                        title={day.tooltip}
                                        tabIndex={0}
                                        role="img"
                                        aria-label={day.tooltip}
                                    >
                                        <span className="weekly-day-name">{day.day}</span>
                                        <div className="weekly-day-dot">
                                            {day.goalMet ? '✓' : (day.count > 0 ? day.count : '')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Achievements Pill Button */}
                        <div className="achievements-pill-container">
                            <button
                                id="achievements-open-btn"
                                className="achievements-pill-btn"
                                type="button"
                                aria-haspopup="dialog"
                                aria-expanded="false"
                                title="View unlocked milestones and personal records"
                                onClick={onOpenAchievements}
                            >
                                <span className="achievements-pill-icon">🏆</span>
                                <span className="achievements-pill-text">Milestones & Records</span>
                                <span className="achievements-pill-count">{unlockedCount}/{totalCount}</span>
                            </button>
                        </div>
                    </Fragment>
                )}
            </div>
        </div>
    );
}

export interface BentoCommandCenterProps {
    onOpenStudyPlan?: () => void;
    onOpenPomodoro?: () => void;
    onOpenAnalytics?: () => void;
    onOpenForecast?: () => void;
    onOpenSummary?: () => void;
    onOpenHistory?: () => void;
    onOpenHighlights?: () => void;
    onOpenColors?: () => void;
    onOpenSettings?: () => void;
    onPracticeDue?: () => void;
    onOpenHeatmap?: () => void;
}

export function BentoCommandCenter({
    onOpenStudyPlan,
    onOpenPomodoro,
    onOpenAnalytics,
    onOpenForecast,
    onOpenSummary,
    onOpenHistory,
    onOpenHighlights,
    onOpenColors,
    onOpenSettings
}: BentoCommandCenterProps = {}): VNode {
    return (
        <div id="bento-command-center" className="card quick-launchpad-card">
            <div className="card-header-clean launchpad-header">
                <div className="header-label-group">
                    <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                    </svg>
                    <span className="card-title">Command Center</span>
                </div>
            </div>

            {/* Bento Tier 1: Primary Focus Engines */}
            <div className="bento-row bento-row-hero">
                <button
                    id="studyplan-btn"
                    className="launch-tile launch-tile-hero"
                    title="Open Exam Mode & Study Plan"
                    onClick={onOpenStudyPlan}
                >
                    <div className="tile-icon-wrap exam-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 2L2 7l10 5 10-5-10-5z" />
                            <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                        </svg>
                    </div>
                    <div className="tile-content">
                        <span className="tile-headline">Exam Mode</span>
                        <span className="tile-subline">Study Plan</span>
                    </div>
                    <svg className="svg-icon tile-arrow" viewBox="0 0 24 24" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>

                <button
                    id="pomodoro-btn"
                    className="launch-tile launch-tile-hero"
                    title="Open Pomodoro Focus Timer"
                    onClick={onOpenPomodoro}
                >
                    <div className="tile-icon-wrap pomodoro-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                    </div>
                    <div className="tile-content">
                        <span className="tile-headline">Pomodoro</span>
                        <span className="tile-subline">Focus Timer</span>
                    </div>
                    <svg className="svg-icon tile-arrow" viewBox="0 0 24 24" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </button>
            </div>

            {/* Bento Tier 2: Review Intelligence & Insights */}
            <div className="bento-group-label">INSIGHTS & REVIEW</div>
            <div className="bento-row bento-row-quad">
                <button
                    id="analytics-btn"
                    className="launch-tile launch-tile-compact"
                    title="Open Full Analytics Dashboard"
                    onClick={onOpenAnalytics}
                >
                    <div className="tile-icon-wrap analytics-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                    </div>
                    <span className="tile-title">Analytics</span>
                </button>

                <button
                    id="forecast-btn"
                    className="launch-tile launch-tile-compact"
                    title="Open Review Forecast"
                    onClick={onOpenForecast}
                >
                    <div className="tile-icon-wrap forecast-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                            <polyline points="17 6 23 6 23 12" />
                        </svg>
                    </div>
                    <span className="tile-title">Forecast</span>
                </button>

                <button
                    id="open-summary-page-btn"
                    className="launch-tile launch-tile-compact"
                    title="Open Weekly & Monthly Digest Summary"
                    onClick={onOpenSummary}
                >
                    <div className="tile-icon-wrap summary-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                    </div>
                    <span className="tile-title">Summary</span>
                </button>

                <button
                    id="history-btn"
                    className="launch-tile launch-tile-compact"
                    title="Open Review History"
                    onClick={onOpenHistory}
                >
                    <div className="tile-icon-wrap history-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 14 14" />
                            <path d="M3.05 11a9 9 0 0 1 .5-2" />
                        </svg>
                    </div>
                    <span className="tile-title">History</span>
                </button>
            </div>

            {/* Bento Tier 3: Workspace & Customization */}
            <div className="bento-group-label">WORKSPACE & TOOLS</div>
            <div className="bento-row bento-row-trio">
                <button
                    id="manage-highlights-btn"
                    className="launch-tile launch-tile-compact"
                    title="Open Highlights Manager"
                    onClick={onOpenHighlights}
                >
                    <div className="tile-icon-wrap highlights-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                    </div>
                    <span className="tile-title">Highlights</span>
                </button>

                <button
                    id="open-options-btn"
                    className="launch-tile launch-tile-compact"
                    title="Customize Marker Colors"
                    onClick={onOpenColors}
                >
                    <div className="tile-icon-wrap colors-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
                            <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
                            <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
                            <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
                        </svg>
                    </div>
                    <span className="tile-title">Colors</span>
                </button>

                <button
                    id="settings-hub-btn"
                    className="launch-tile launch-tile-compact"
                    title="Open Settings & Preferences Hub"
                    onClick={onOpenSettings}
                >
                    <div className="tile-icon-wrap settings-color">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1 2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06-.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </div>
                    <span className="tile-title">Settings</span>
                </button>
            </div>
        </div>
    );
}

export interface AchievementsModalProps {
    isOpen?: boolean;
    onClose?: () => void;
    achievements?: Achievement[];
    records?: PersonalRecords | null;
}

export function AchievementsModal({
    isOpen = false,
    onClose,
    achievements = [],
    records = null
}: AchievementsModalProps = {}): VNode {
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose?.();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const unlockedCount = achievements.filter(a => a.unlocked).length;

    return (
        <div
            id="achievements-modal"
            className={`modal-overlay ${isOpen ? '' : 'hide-panel'}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="achievements-modal-title"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose?.();
                }
            }}
        >
            <div className="modal-card">
                <div className="modal-header">
                    <h3 id="achievements-modal-title" className="modal-title">
                        <svg
                            className="svg-icon"
                            viewBox="0 0 24 24"
                            style={{ stroke: 'var(--md-warning)', width: '18px', height: '18px', marginRight: '6px' }}
                        >
                            <circle cx="12" cy="8" r="7" />
                            <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
                        </svg>
                        Milestones & Records
                    </h3>
                    <button
                        id="close-achievements-btn"
                        className="icon-btn close-modal-btn"
                        aria-label="Close dialog"
                        title="Close dialog"
                        onClick={onClose}
                    >
                        <svg className="svg-icon" viewBox="0 0 24 24">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>
                <div id="achievements-modal-body" className="modal-body">
                    {records && (
                        <div className="records-card">
                            <h4 className="records-card-title">
                                <svg
                                    className="svg-icon"
                                    viewBox="0 0 24 24"
                                    style={{ stroke: 'var(--md-primary)', width: '15px', height: '15px', marginRight: '6px' }}
                                >
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                Personal Records
                            </h4>
                            <div className="records-grid">
                                <div className="record-stat-box">
                                    <span className="record-stat-label">Active Streak</span>
                                    <span
                                        className="record-stat-value"
                                        style={{ color: records.currentStreak > 0 ? 'var(--md-warning)' : 'var(--md-text-med)' }}
                                    >
                                        🔥 {records.currentStreak}d
                                    </span>
                                </div>
                                <div className="record-stat-box">
                                    <span className="record-stat-label">Longest Streak</span>
                                    <span className="record-stat-value">
                                        🏆 {records.longestStreak}d
                                    </span>
                                </div>
                                <div className="record-stat-box">
                                    <span className="record-stat-label">Most in 1 Day</span>
                                    <span className="record-stat-value" style={{ color: 'var(--md-success)' }}>
                                        ⚡ {records.maxDailyReviews}
                                    </span>
                                </div>
                                <div className="record-stat-box">
                                    <span className="record-stat-label">Total Reviews</span>
                                    <span className="record-stat-value">
                                        📚 {records.totalReviews}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="achievements-section">
                        <div className="achievements-section-header">
                            <h4 className="achievements-section-title">
                                Milestones ({unlockedCount} of {achievements.length || 8} Unlocked)
                            </h4>
                        </div>
                        <div className="achievements-list">
                            {achievements.length === 0 ? (
                                <p style={{ fontSize: '13px', color: 'var(--md-text-low)' }}>
                                    Track your spaced repetition streaks, consistency milestones, and mastery level badges!
                                </p>
                            ) : (
                                achievements.map((a) => (
                                    <div key={a.id} className={`achievement-row ${a.unlocked ? 'is-unlocked' : 'is-locked'}`}>
                                        <div className="achievement-icon-wrap" aria-hidden="true">
                                            <span className="achievement-icon">{a.icon}</span>
                                        </div>
                                        <div className="achievement-details">
                                            <div className="achievement-header-row">
                                                <span className="achievement-title">{a.title}</span>
                                                {a.unlocked ? (
                                                    <span className="achievement-badge unlocked">✓ Unlocked</span>
                                                ) : (
                                                    <span className="achievement-badge in-progress">{a.progress || 'In progress'}</span>
                                                )}
                                            </div>
                                            <p className="achievement-desc">{a.description}</p>
                                            {!a.unlocked && a.progressPercent !== undefined && (
                                                <div
                                                    className="achievement-progress-bar"
                                                    role="progressbar"
                                                    aria-valuenow={a.progressPercent}
                                                    aria-valuemin={0}
                                                    aria-valuemax={100}
                                                >
                                                    <div className="achievement-progress-fill" style={{ width: `${a.progressPercent}%` }} />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT POPUP COMPONENT (PURE DECLARATIVE PREACT)
// ─────────────────────────────────────────────────────────────────────────────

export interface PopupAppProps {
    initialCards?: Card[];
    initialSettings?: ExtensionSettings;
}

export const PopupApp: FunctionalComponent<PopupAppProps> = ({ initialCards, initialSettings }) => {
    // ── 1. Settings & UI State ──
    const [settings, setSettings] = useState<ExtensionSettings>(() => initialSettings || {
        showMarkerPopup: true,
        showCharts: true,
        showLauncher: true,
        developerMode: false,
        showDailyFocus: true
    });

    const [cards, setCards] = useState<Card[]>(() => initialCards || []);
    const [activity, setActivity] = useState<Record<string, number>>({});
    const [fsrsGlobalParams, setFsrsGlobalParams] = useState<Partial<FSRSParameters> | null>(null);
    const [dailyGoalTarget, setDailyGoalTarget] = useState<number>(DEFAULT_DAILY_GOAL);
    const [longestStreak, setLongestStreak] = useState<number>(0);
    const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
    const [studyPlanSettings, setStudyPlanSettings] = useState<{ isActive?: boolean; examDate?: string } | null>(null);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [selectedTag, setSelectedTag] = useState<string>('all');
    const [statusToast, setStatusToast] = useState<{ message: string; isError: boolean } | null>(null);
    const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
    const [isAchievementsOpen, setIsAchievementsOpen] = useState<boolean>(false);
    const [ratingStatus, setRatingStatus] = useState<'unrated' | 'snoozed' | 'rated'>('unrated');
    const [notificationPermission, setNotificationPermission] = useState<'default' | 'granted' | 'denied'>('default');
    const [isLifetimeView, setIsLifetimeView] = useState<boolean>(false);
    const [isEditingGoal, setIsEditingGoal] = useState<boolean>(false);
    const [goalInputVal, setGoalInputVal] = useState<string>(String(DEFAULT_DAILY_GOAL));
    const heatmapGridRef = useRef<HTMLDivElement>(null);

    // ── 2. Load Stored Data on Mount & Reloads ──
    const loadInitialData = useCallback(async () => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                const result = (await chrome.storage.local.get([
                    'extensionSettings',
                    'fsrsCards',
                    'fsrsActivity',
                    'ratingPromptState',
                    'dailyGoalTarget',
                    'longestStreak',
                    'lastCelebratedMilestone',
                    'unlockedAchievements',
                    'studyPlanSettings',
                    'fsrsGlobalParams'
                ])) as StorageData & {
                    ratingPromptState?: { status?: string; snoozedUntil?: number };
                    dailyGoalTarget?: number;
                    longestStreak?: number;
                    lastCelebratedMilestone?: number;
                    unlockedAchievements?: string[];
                    studyPlanSettings?: { isActive?: boolean; examDate?: string };
                    fsrsGlobalParams?: Partial<FSRSParameters>;
                };

                if (result.extensionSettings) {
                    setSettings(prev => ({ ...prev, ...result.extensionSettings }));
                }
                if (result.fsrsCards) {
                    setCards(result.fsrsCards);
                }
                if (result.fsrsActivity) {
                    setActivity(result.fsrsActivity);
                }
                if (typeof result.dailyGoalTarget === 'number') {
                    setDailyGoalTarget(result.dailyGoalTarget);
                    setGoalInputVal(String(result.dailyGoalTarget));
                }
                if (typeof result.longestStreak === 'number') {
                    setLongestStreak(result.longestStreak);
                }
                if (result.unlockedAchievements) {
                    setUnlockedAchievements(result.unlockedAchievements);
                }
                if (result.studyPlanSettings) {
                    setStudyPlanSettings(result.studyPlanSettings);
                }
                if (result.fsrsGlobalParams) {
                    setFsrsGlobalParams(result.fsrsGlobalParams);
                }

                // Rating Prompt State
                const rating = result.ratingPromptState || { status: 'unrated', snoozedUntil: 0 };
                const now = Date.now();
                if (rating.status === 'snoozed' && rating.snoozedUntil && now >= rating.snoozedUntil) {
                    rating.status = 'unrated';
                    await chrome.storage.local.set({ ratingPromptState: rating });
                }
                setRatingStatus((rating.status as 'unrated' | 'snoozed' | 'rated') || 'unrated');
            }

            if (typeof Notification !== 'undefined') {
                setNotificationPermission(Notification.permission);
            }
        } catch (err) {
            UIUtils.catchError('PopupApp', 'Error loading storage data', err);
        }
    }, []);

    useEffect(() => {
        loadInitialData();
    }, [loadInitialData]);

    // ── 3. Derived Statistics & Metrics ──
    const now = Date.now();
    const totalCount = cards.length;
    const dueCards = useMemo(() => cards.filter(c => c.due <= now), [cards, now]);
    const dueCount = dueCards.length;

    // FSRS Retrievability and Overall Retention Calculation
    const retentionRate = useMemo(() => {
        if (cards.length === 0) return 0;

        let totalRetrievability = 0;
        let retrievabilityCount = 0;
        const SchedulerClass = (window as unknown as { FsrsScheduler?: new (params?: Partial<FSRSParameters> | null) => AbstractScheduler }).FsrsScheduler || FsrsScheduler;
        const scheduler = typeof SchedulerClass === 'function' ? new SchedulerClass(fsrsGlobalParams || null) : new FsrsScheduler(fsrsGlobalParams || null);

        let totalReps = 0;
        let totalLapses = 0;

        cards.forEach((card) => {
            totalReps += card.reps || 0;
            totalLapses += card.lapses || 0;

            if (card.stability > 0 && scheduler) {
                const lastReview = getLastReviewDate(card);
                if (lastReview) {
                    const r = scheduler.getRetrievability(card, now);
                    totalRetrievability += r;
                    retrievabilityCount++;
                }
            }
        });

        if (retrievabilityCount > 0) {
            return Math.round((totalRetrievability / retrievabilityCount) * 100);
        } else if (totalReps > 0) {
            return Math.max(0, Math.min(100, Math.round(((totalReps - totalLapses) / totalReps) * 100)));
        }
        return 0;
    }, [cards, fsrsGlobalParams]);

    // Consecutive Study Streaks
    const { current: currentStreak, longest: calculatedLongestStreak } = useMemo(() => {
        return calculateStreaks(activity);
    }, [activity]);
    const effectiveLongestStreak = Math.max(longestStreak, calculatedLongestStreak);

    // Activity Reviews, Gamification Level & XP Progress
    const totalActivityReviews = useMemo(() => {
        return Object.values(activity).reduce((sum, count) => sum + (count || 0), 0);
    }, [activity]);

    const level = useMemo(() => {
        return Math.floor(1 + 0.6 * Math.sqrt(totalActivityReviews));
    }, [totalActivityReviews]);

    const { xpPercent, levelBadgeTitle } = useMemo(() => {
        const currentLevelReviews = Math.pow((level - 1) / 0.6, 2);
        const nextLevelReviews = Math.pow(level / 0.6, 2);
        const progressRange = nextLevelReviews - currentLevelReviews;
        const progressMade = totalActivityReviews - currentLevelReviews;
        const pct = progressRange > 0 ? Math.max(0, Math.min(100, Math.round((progressMade / progressRange) * 100))) : 0;

        let levelTitle = 'Novice';
        if (level >= 35) levelTitle = 'Grandmaster';
        else if (level >= 20) levelTitle = 'Expert';
        else if (level >= 10) levelTitle = 'Specialist';
        else if (level >= 5) levelTitle = 'Apprentice';

        const reviewsToNext = Math.ceil(nextLevelReviews - totalActivityReviews);
        const title = `${levelTitle} (${totalActivityReviews} Total Reviews) - ${reviewsToNext} until Lv. ${level + 1}`;
        return { xpPercent: pct, levelBadgeTitle: title };
    }, [level, totalActivityReviews]);

    // Completed reviews today
    const completedToday = useMemo(() => {
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const todayEndTime = todayEnd.getTime();
        let count = 0;

        cards.forEach((card) => {
            const lastReview = getLastReviewDate(card);
            const isReviewedToday = lastReview ? new Date(lastReview).toDateString() === new Date().toDateString() : false;
            const wasDueTodayOrEarlier = !card.previousDue || card.previousDue <= todayEndTime;
            if (isReviewedToday && wasDueTodayOrEarlier) {
                count++;
            }
        });
        return count;
    }, [cards]);

    // Achievements Evaluation & Personal Records
    const { evaluatedAchievements, evaluatedRecords } = useMemo(() => {
        const evalResult = evaluateAchievements({
            cards,
            activity,
            dailyGoalTarget,
            currentStreak,
            longestStreak: effectiveLongestStreak,
            completedToday,
            unlockedIds: unlockedAchievements
        });
        return {
            evaluatedAchievements: evalResult.achievements,
            evaluatedRecords: evalResult.records
        };
    }, [cards, activity, dailyGoalTarget, currentStreak, effectiveLongestStreak, completedToday, unlockedAchievements]);

    // Study Plan Days Left
    const studyPlanDaysLeft = useMemo(() => {
        if (!studyPlanSettings?.isActive || !studyPlanSettings?.examDate) return null;
        const examTime = new Date(studyPlanSettings.examDate + 'T23:59:59').getTime();
        return Math.max(0, Math.ceil((examTime - now) / (1000 * 60 * 60 * 24)));
    }, [studyPlanSettings, now]);

    // Tag list for dropdown
    const allTags = useMemo(() => {
        const set = new Set<string>();
        for (const c of cards) {
            if (c.tags) {
                for (const t of c.tags) set.add(t);
            }
        }
        return Array.from(set).sort();
    }, [cards]);

    // Quick Search Filtering (Searches 4 fields: problemTitle, problemUrl, tags, approach)
    const filteredCards = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query && selectedTag === 'all') return [];

        return cards.filter(card => {
            if (selectedTag !== 'all' && !(card.tags && card.tags.includes(selectedTag))) {
                return false;
            }
            if (query) {
                const titleMatch = card.problemTitle && card.problemTitle.toLowerCase().includes(query);
                const urlMatch = card.problemUrl && card.problemUrl.toLowerCase().includes(query);
                const tagMatch = card.tags && card.tags.some(t => t.toLowerCase().includes(query));
                const approachMatch = card.approach && card.approach.toLowerCase().includes(query);
                if (!titleMatch && !urlMatch && !tagMatch && !approachMatch) return false;
            }
            return true;
        });
    }, [cards, searchQuery, selectedTag]);

    // View All Search URL
    const searchViewAllUrl = useMemo(() => {
        const urlParams = new URLSearchParams();
        urlParams.append('view', 'total');
        if (searchQuery.trim()) urlParams.append('search', searchQuery.trim());
        if (selectedTag && selectedTag !== 'all') urlParams.append('tag', selectedTag);
        return chrome.runtime?.getURL
            ? chrome.runtime.getURL(`features/common/data/data.html?${urlParams.toString()}`)
            : `features/common/data/data.html?${urlParams.toString()}`;
    }, [searchQuery, selectedTag]);

    // Heatmap Cells Generation
    const heatmapCells = useMemo(() => {
        const todayDate = new Date();
        const dayOfWeek = todayDate.getDay();
        let totalDays = 0;
        let startDate = new Date(todayDate);

        if (isLifetimeView && Object.keys(activity).length > 0) {
            const dateKeys = Object.keys(activity).sort();
            const oldestDateParts = dateKeys[0].split('-');
            const oldestDate = new Date(parseInt(oldestDateParts[0], 10), parseInt(oldestDateParts[1], 10) - 1, parseInt(oldestDateParts[2], 10));
            oldestDate.setDate(oldestDate.getDate() - oldestDate.getDay());
            const diffTime = todayDate.getTime() - oldestDate.getTime();
            totalDays = Math.floor(diffTime / MS_PER_DAY) + 1;
            startDate = oldestDate;
        } else {
            totalDays = (11 * DAYS_PER_WEEK) + (dayOfWeek + 1);
            startDate.setDate(todayDate.getDate() - totalDays + 1);
        }

        const cells: Array<{ dateString: string; count: number; level: 0 | 1 | 2 | 3 | 4 }> = [];
        for (let i = 0; i < totalDays; i++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + i);
            const dateString = new Date(cellDate.getTime() - (cellDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const count = activity[dateString] || 0;

            let cellLevel: 0 | 1 | 2 | 3 | 4 = 0;
            if (count === HEATMAP_LEVEL_THRESHOLDS[0]) cellLevel = 0;
            else if (count <= HEATMAP_LEVEL_THRESHOLDS[1]) cellLevel = 1;
            else if (count <= HEATMAP_LEVEL_THRESHOLDS[2]) cellLevel = 2;
            else if (count <= HEATMAP_LEVEL_THRESHOLDS[3]) cellLevel = 3;
            else cellLevel = 4;

            cells.push({ dateString, count, level: cellLevel });
        }
        return cells;
    }, [activity, isLifetimeView]);

    // Auto-scroll heatmap to right on render
    useEffect(() => {
        if (heatmapGridRef.current) {
            heatmapGridRef.current.scrollLeft = heatmapGridRef.current.scrollWidth;
        }
    }, [heatmapCells]);

    // Store Review URL with extension ID substitution on Chrome
    const resolvedReviewUrl = useMemo(() => {
        const raw = BROWSER_CONFIG.reviewUrl;
        if (BROWSER_CONFIG.target === 'chrome' && typeof chrome !== 'undefined' && chrome.runtime?.id) {
            return raw.replace('YOUR_EXTENSION_ID', chrome.runtime.id);
        }
        return raw;
    }, []);

    // Engagement gate for Rating Prompt Card: Only show when >= 1 cards saved and not snoozed
    const isPromptCardVisible = cards.length >= 1 && ratingStatus !== 'snoozed';

    // ── 4. Action Handlers ──
    const showStatus = useCallback((message: string, isError = false) => {
        safeFlushSync(() => {
            setStatusToast({ message, isError });
        });
        setTimeout(() => {
            safeFlushSync(() => {
                setStatusToast(prev => (prev?.message === message ? null : prev));
            });
        }, 3000);
    }, []);

    const openTab = useCallback((urlPath: string) => {
        try {
            if (typeof chrome !== 'undefined' && chrome.tabs?.create && chrome.runtime?.getURL) {
                chrome.tabs.create({ url: chrome.runtime.getURL(urlPath) });
            }
        } catch (err) {
            UIUtils.catchError('PopupApp', `Error opening tab for path: ${urlPath}`, err);
        }
    }, []);

    const handleKeyDownNavigate = useCallback((e: KeyboardEvent, urlPath: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openTab(urlPath);
        }
    }, [openTab]);

    const handleSettingChange = useCallback(async (key: keyof ExtensionSettings, val: boolean) => {
        try {
            const next = { ...settings, [key]: val };
            setSettings(next);
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                await chrome.storage.local.set({ extensionSettings: next });
            }

            // Status toasts matching main reference feedback
            if (key === 'showMarkerPopup') {
                showStatus(val ? 'Highlighter enabled!' : 'Highlighter disabled!');
            } else if (key === 'showLauncher') {
                showStatus(val ? 'Problem tracker launcher enabled!' : 'Problem tracker launcher disabled!');
            } else if (key === 'showCharts') {
                showStatus(val ? 'Visual charts enabled!' : 'Visual charts hidden!');
            } else if (key === 'showDailyFocus') {
                showStatus(val ? 'Daily Focus & Momentum enabled!' : 'Daily Focus & Momentum hidden!');
            } else if (key === 'developerMode') {
                showStatus(val ? 'Developer mode enabled!' : 'Developer mode disabled!');
            }
        } catch (err) {
            UIUtils.catchError('PopupApp', `Error saving setting ${String(key)}`, err);
        }
    }, [settings, showStatus]);

    const handleThemeToggle = useCallback(() => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                chrome.storage.local.get(['theme'], (result) => {
                    const currentTheme = result?.theme || 'dark';
                    const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
                    ThemeSync.applyTheme(nextTheme);
                    chrome.storage.local.set({ theme: nextTheme }, () => {
                        showStatus(`Switched to ${nextTheme === 'dark' ? 'Dark' : 'Light'} Mode!`);
                    });
                });
            } else {
                ThemeSync.applyTheme('light');
                showStatus('Switched to Light Mode!');
            }
        } catch (err) {
            UIUtils.catchError('PopupApp', 'Error toggling theme', err);
        }
    }, [showStatus]);

    // Manual review check via check_due_cards_now
    const handleCheckNow = useCallback(() => {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ action: 'check_due_cards_now' }, (response) => {
                    if (response && response.success) {
                        const count = typeof response.dueCount === 'number' ? response.dueCount : 0;
                        showStatus(`Checked! ${count} review${count === 1 ? '' : 's'} due.`, false);
                    } else {
                        showStatus('Checked for due reviews.', false);
                    }
                    loadInitialData();
                });
            }
        } catch (err) {
            UIUtils.catchError('PopupApp', 'Error checking due reviews', err);
        }
    }, [showStatus, loadInitialData]);

    // Save Daily Goal
    const handleSaveGoal = useCallback(async () => {
        const val = parseInt(goalInputVal, 10);
        if (val && val > 0 && val <= 999) {
            setDailyGoalTarget(val);
            setIsEditingGoal(false);
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                await chrome.storage.local.set({ dailyGoalTarget: val });
            }
            showStatus(`Daily goal set to ${val} reviews!`);
            loadInitialData();
        }
    }, [goalInputVal, showStatus, loadInitialData]);

    // Notification Permission Request
    const handleEnableNotifications = useCallback(() => {
        if (typeof Notification !== 'undefined') {
            Notification.requestPermission().then((permission) => {
                setNotificationPermission(permission as any);
                if (permission === 'granted') {
                    showStatus('Notifications enabled successfully!');
                } else {
                    showStatus('Notifications were not allowed.', true);
                }
            });
        }
    }, [showStatus]);

    // Rating Prompt Actions
    const handleSnoozeRating = useCallback(async () => {
        const snoozedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
        setRatingStatus('snoozed');
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({
                ratingPromptState: { status: 'snoozed', snoozedUntil }
            });
        }
        showStatus('Notification paused for 7 days!');
    }, [showStatus]);

    const handleAlreadyRated = useCallback(async () => {
        setRatingStatus('rated');
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({
                ratingPromptState: { status: 'rated', snoozedUntil: 0 }
            });
        }
        showStatus('Thank you for your rating!');
    }, [showStatus]);

    const handleEditRating = useCallback(async () => {
        if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
            chrome.tabs.create({ url: resolvedReviewUrl });
        }
        setRatingStatus('unrated');
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({
                ratingPromptState: { status: 'unrated', snoozedUntil: 0 }
            });
        }
    }, [resolvedReviewUrl]);

    // Dev Mode Test Notifications
    const handleTestNotification = useCallback(() => {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ action: 'test_notification' }, (response) => {
                    if (response && response.success) {
                        showStatus('Test notification sent!');
                    } else {
                        showStatus('Failed to send test notification.', true);
                    }
                });
            }
        } catch (err) {
            UIUtils.catchError('PopupApp', 'Error sending test notification', err);
        }
    }, [showStatus]);

    const handleTestSummaryNotification = useCallback(() => {
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
                chrome.runtime.sendMessage({ action: 'test_summary_notification' }, (response) => {
                    if (response && response.success) {
                        showStatus('Test weekly summary notification sent!');
                    } else {
                        showStatus('Failed to send test summary notification.', true);
                    }
                });
            }
        } catch (err) {
            UIUtils.catchError('PopupApp', 'Error sending test summary notification', err);
        }
    }, [showStatus]);

    // Export Debug Logs
    const handleExportLogs = useCallback(async () => {
        try {
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
                const result = await chrome.storage.local.get(['debugLogs']);
                const logs = result?.debugLogs || [];
                if (!logs || logs.length === 0) {
                    showStatus('No debug logs found.', false);
                    return;
                }
                const jsonStr = JSON.stringify(logs, null, 2);
                if (BROWSER_CONFIG.supportsDownloads && chrome.downloads?.download) {
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    chrome.downloads.download({ url, filename: `algorecall-debug-${Date.now()}.json` }, () => {
                        showStatus('Debug logs exported.', false);
                    });
                } else {
                    const blob = new Blob([jsonStr], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    ActionService.triggerDomDownload(url, `algorecall-debug-${Date.now()}.json`);
                    showStatus('Debug logs exported.', false);
                }
            }
        } catch (err) {
            UIUtils.catchError('PopupApp', 'Error exporting debug logs', err);
        }
    }, [showStatus]);

    // CSS class for due stat box
    const dueClass = dueCount === 0 ? 'success' : (dueCount <= DUE_CARDS_THRESHOLD_WARNING ? 'warning' : 'danger');
    const retentionClass = retentionRate >= RECALL_THRESHOLD_GOOD
        ? 'success'
        : (retentionRate >= RECALL_THRESHOLD_WARNING ? 'warning' : 'danger');

    return (
        <div id="popup-app-container">
            {/* Confetti Overlay */}
            <canvas id="confetti-canvas" className="confetti-canvas" />
            <div id="celebration-confetti-canvas" style={{ display: 'none' }} />

            {/* Header: Branding, Level Badge, and Top-5 Action Controls */}
            <header className="header-modern">
                <div className="header-main">
                    <h1 className="app-title">
                        <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                            <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                        </svg>
                        <span className="algorecall-brand-name">AlgoRecall</span>
                    </h1>

                    <div className="header-controls">
                        {/* 1. Gamification Level Badge: Click opens achievements modal */}
                        <div
                            id="user-level-badge"
                            className="level-badge"
                            title={levelBadgeTitle}
                            onClick={() => safeFlushSync(() => setIsAchievementsOpen(true))}
                        >
                            Lv. {level}
                        </div>

                        {/* 2. Quick Check Due Reviews Trigger */}
                        <button
                            id="check-now-btn"
                            className="icon-btn check-now-header-btn"
                            title="Check for due reviews immediately"
                            aria-label="Check for due reviews immediately"
                            onClick={handleCheckNow}
                        >
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <polyline points="23 4 23 10 17 10" />
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                            </svg>
                        </button>

                        {/* 3. Header Analytics Button: Opens dedicated analytics tab */}
                        <button
                            id="header-analytics-btn"
                            className="icon-btn analytics-header-btn"
                            title="Open Analytics Dashboard"
                            aria-label="Open Analytics Dashboard"
                            onClick={() => openTab('features/dashboard/analytics/analytics.html')}
                        >
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <line x1="18" y1="20" x2="18" y2="10" />
                                <line x1="12" y1="20" x2="12" y2="4" />
                                <line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                        </button>

                        {/* 4. Theme Switcher Button */}
                        <button
                            id="theme-toggle-btn"
                            className="icon-btn theme-toggle-btn"
                            title="Toggle Theme"
                            aria-label="Toggle Theme"
                            onClick={handleThemeToggle}
                        >
                            <svg className="svg-icon sun-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="5" />
                                <line x1="12" y1="1" x2="12" y2="3" />
                                <line x1="12" y1="21" x2="12" y2="23" />
                                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                                <line x1="1" y1="12" x2="3" y2="12" />
                                <line x1="21" y1="12" x2="23" y2="12" />
                                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                            </svg>
                            <svg className="svg-icon moon-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                            </svg>
                        </button>

                        {/* 5. Documentation Help Trigger */}
                        <button
                            id="help-btn"
                            className="icon-btn help-btn"
                            title="How it works"
                            aria-label="How it works"
                            onClick={() => openTab('features/common/help/help.html')}
                        >
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Level XP Progress Bar */}
                <div
                    className="xp-bar-container"
                    id="xp-progress-bar-container"
                    title="XP Progress to Next Level"
                    role="progressbar"
                    aria-label="XP Progress to Next Level"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={xpPercent}
                >
                    <div id="xp-bar-fill" className="xp-bar-fill" style={{ width: `${xpPercent}%` }} />
                </div>
            </header>

            <div className="main-content">
                {/* Notification Permission Warning Banner */}
                <div
                    id="permission-warning-banner"
                    className={`banner warning-banner ${notificationPermission === 'granted' || !BROWSER_CONFIG.supportsNotifications ? 'hide-panel' : ''}`}
                >
                    <div className="banner-content">
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        <span>Reminders work best with notifications enabled.</span>
                    </div>
                    <button
                        id="enable-notifications-btn"
                        className="btn-text-accent"
                        onClick={handleEnableNotifications}
                    >
                        Enable
                    </button>
                </div>

                {/* Rating Prompt Card: Engagement gated (>= 1 cards saved) */}
                <div
                    id="rating-prompt-card"
                    className={`card rating-card ${!isPromptCardVisible ? 'hide-panel' : ''}`}
                >
                    <div
                        id="rating-prompt-state"
                        className={`rating-state ${ratingStatus === 'rated' ? 'hide-panel' : ''}`}
                    >
                        <div className="rating-text-group">
                            <h3 className="rating-title">Enjoying AlgoRecall? 🌟</h3>
                            <p className="rating-desc" id="rating-prompt-text">Rate us 5 stars to help us grow!</p>
                        </div>
                        <div className="rating-actions-v">
                            <a
                                href={resolvedReviewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                id="rate-store-btn"
                                className="btn btn-primary rating-btn"
                                data-review-url={resolvedReviewUrl}
                            >
                                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                                <span id="rate-store-label">Rate on {BROWSER_CONFIG.storeName}</span>
                            </a>
                            <div className="rating-sub-actions">
                                <button id="snooze-rate-btn" className="btn-link" onClick={handleSnoozeRating}>
                                    Snooze (7 days)
                                </button>
                                <button id="already-rated-btn" className="btn-link" onClick={handleAlreadyRated}>
                                    Already Rated
                                </button>
                            </div>
                        </div>
                    </div>
                    <div
                        id="rating-thanks-state"
                        className={`rating-state ${ratingStatus !== 'rated' ? 'hide-panel' : ''}`}
                    >
                        <span className="thanks-text">Thank you for supporting us! ❤️</span>
                        <button id="edit-rating-btn" className="btn-link" onClick={handleEditRating}>
                            Edit Rating
                        </button>
                    </div>
                </div>

                {/* Hero Section: Stat Boxes & Quick Search */}
                <div className="card stats-hero">
                    <div className="stats-grid">
                        <div
                            className="stat-box"
                            id="box-total"
                            title="View all saved patterns"
                            role="button"
                            tabIndex={0}
                            onClick={() => openTab('features/common/data/data.html?view=total')}
                            onKeyDown={(e) => handleKeyDownNavigate(e as unknown as KeyboardEvent, 'features/common/data/data.html?view=total')}
                        >
                            <span className="stat-value" id="total-cards">{totalCount}</span>
                            <span className="stat-label">Patterns</span>
                        </div>
                        <div
                            className={`stat-box stat-box-due ${dueClass}`}
                            id="box-due"
                            title="View patterns due today"
                            role="button"
                            tabIndex={0}
                            onClick={() => openTab('features/common/data/data.html?view=due')}
                            onKeyDown={(e) => handleKeyDownNavigate(e as unknown as KeyboardEvent, 'features/common/data/data.html?view=due')}
                        >
                            <span className="stat-value" id="due-cards">{dueCount}</span>
                            <span className="stat-label">Due Today</span>
                        </div>
                        <div
                            className={`stat-box ${retentionClass}`}
                            id="box-retention"
                            title="View lapsed cards"
                            role="button"
                            tabIndex={0}
                            onClick={() => openTab('features/common/data/data.html?view=retention')}
                            onKeyDown={(e) => handleKeyDownNavigate(e as unknown as KeyboardEvent, 'features/common/data/data.html?view=retention')}
                        >
                            <span className="stat-value" id="retention-rate">{retentionRate}%</span>
                            <span className="stat-label">Retention</span>
                        </div>
                    </div>

                    {/* Quick Search & Tag Filter: Exact main structure, no rogue clear button or tag pills */}
                    <div className="search-compact">
                        <div className="search-input-wrapper">
                            <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="11" cy="11" r="8" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                            </svg>
                            <input
                                type="text"
                                id="popup-search-input"
                                className="search-input"
                                placeholder="Search patterns..."
                                value={searchQuery}
                                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                            />
                        </div>
                        <select
                            id="popup-tag-filter"
                            className="tag-filter-select"
                            aria-label="Filter by tag"
                            value={selectedTag}
                            onChange={(e) => setSelectedTag((e.target as HTMLSelectElement).value)}
                        >
                            <option value="all">All Tags</option>
                            {allTags.map(tag => (
                                <option key={tag} value={tag}>{tag}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search Results Dropdown List */}
                    <div
                        id="popup-search-results"
                        className="search-results-container"
                        style={{ display: searchQuery.trim() || selectedTag !== 'all' ? 'block' : 'none' }}
                    >
                        {filteredCards.length === 0 ? (
                            <div className="popup-search-empty">No matching patterns found.</div>
                        ) : (
                            <Fragment>
                                {filteredCards.slice(0, SEARCH_MAX_RESULTS).map(card => (
                                    <a
                                        key={card.id}
                                        href={card.problemUrl || '#'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="popup-search-item"
                                        title={card.problemTitle || 'Untitled'}
                                        aria-label={card.problemTitle || 'Untitled'}
                                    >
                                        <div className="popup-search-item-top">
                                            <span className="popup-search-title">{card.problemTitle || 'Untitled'}</span>
                                            <span className={`popup-badge ${card.due <= now ? 'popup-badge-due' : 'popup-badge-safe'}`}>
                                                {card.due <= now ? 'Due' : 'Safe'}
                                            </span>
                                        </div>
                                        <div className="popup-search-item-tags">
                                            {(card.tags || []).slice(0, 3).map((tag, idx) => (
                                                <span key={idx} className="popup-tag">{tag}</span>
                                            ))}
                                        </div>
                                    </a>
                                ))}
                                {filteredCards.length > SEARCH_MAX_RESULTS && (
                                    <a
                                        href={searchViewAllUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="popup-search-view-all"
                                    >
                                        View all {filteredCards.length} results →
                                    </a>
                                )}
                            </Fragment>
                        )}
                    </div>
                </div>

                {/* Static Card 1: Daily Focus & Momentum (Div card, NOT details) */}
                <DailyFocusCard
                    completedToday={completedToday}
                    dailyGoalTarget={dailyGoalTarget}
                    currentStreak={currentStreak}
                    longestStreak={effectiveLongestStreak}
                    activity={activity}
                    achievements={evaluatedAchievements}
                    studyPlanDaysLeft={studyPlanDaysLeft}
                    isEditingGoal={isEditingGoal}
                    goalInputVal={goalInputVal}
                    onToggleGoalEdit={() => safeFlushSync(() => setIsEditingGoal(!isEditingGoal))}
                    onGoalInputChange={(val) => setGoalInputVal(val)}
                    onSaveGoal={handleSaveGoal}
                    onOpenAchievements={() => safeFlushSync(() => setIsAchievementsOpen(true))}
                    style={{ display: settings.showDailyFocus !== false ? '' : 'none' }}
                    hasCards={cards.length > 0}
                />

                {/* Static Card 2: Bento Command Center (Div card, NOT details) */}
                <BentoCommandCenter
                    onOpenStudyPlan={() => openTab('features/dashboard/studyplan/studyplan.html')}
                    onOpenPomodoro={() => openTab('features/dashboard/pomodoro/pomodoro.html')}
                    onOpenAnalytics={() => openTab('features/dashboard/analytics/analytics.html')}
                    onOpenForecast={() => openTab('features/dashboard/forecast/forecast.html')}
                    onOpenSummary={() => openTab('features/dashboard/summary/summary.html')}
                    onOpenHistory={() => openTab('features/dashboard/history/history.html')}
                    onOpenHighlights={() => openTab('features/highlighter/manager/highlights.html')}
                    onOpenColors={() => openTab('features/highlighter/options/highlightOptions.html')}
                    onOpenSettings={() => openTab('features/common/settings/settings.html')}
                />

                {/* Static Card 3: Activity Heatmap Section (Div card, NOT details) */}
                <div
                    id="activity-charts-card"
                    className="card heatmap-card heatmap-section"
                    style={{ display: settings.showCharts !== false ? '' : 'none' }}
                >
                    <div className="heatmap-header">
                        <div className="heatmap-title-wrap">
                            <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <rect x="3" y="3" width="7" height="7" />
                                <rect x="14" y="3" width="7" height="7" />
                                <rect x="14" y="14" width="7" height="7" />
                                <rect x="3" y="14" width="7" height="7" />
                            </svg>
                            <span className="heatmap-label">Contributions</span>
                        </div>
                        <div className="heatmap-actions-group">
                            <button
                                id="toggle-lifetime-btn"
                                className="btn-text-subtle"
                                onClick={() => safeFlushSync(() => setIsLifetimeView(prev => !prev))}
                            >
                                {isLifetimeView ? 'Show Last 12 Weeks' : 'Show Lifetime'}
                            </button>
                            <button
                                id="open-heatmap-tab-btn"
                                className="btn-icon-text"
                                title="Open full screen heatmap"
                                aria-label="Open full screen heatmap"
                                onClick={() => openTab('features/dashboard/heatmap/heatmap.html')}
                            >
                                <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                    <polyline points="15 3 21 3 21 9" />
                                    <line x1="10" y1="14" x2="21" y2="3" />
                                </svg>
                                Full Screen
                            </button>
                        </div>
                    </div>
                    <div className="heatmap-container">
                        <div id="heatmap-grid" className="heatmap" ref={heatmapGridRef}>
                            {heatmapCells.map((cell) => (
                                <div
                                    key={cell.dateString}
                                    className={`heatmap-cell level-${cell.level}`}
                                    role="img"
                                    aria-label={cell.count === 1 ? `1 review on ${cell.dateString}` : `${cell.count} reviews on ${cell.dateString}`}
                                    title={cell.count === 1 ? `1 review on ${cell.dateString}` : `${cell.count} reviews on ${cell.dateString}`}
                                    tabIndex={0}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Progressive Disclosure Drawer: ONLY details accordion in the file */}
                <details id="advanced-tools-drawer" className="card details-card advanced-drawer">
                    <summary className="details-summary">
                        <div className="summary-content">
                            <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                                <circle cx="12" cy="12" r="1" />
                                <circle cx="19" cy="12" r="1" />
                                <circle cx="5" cy="12" r="1" />
                            </svg>
                            <span className="card-title">Advanced Options</span>
                        </div>
                        <svg className="svg-icon chevron" viewBox="0 0 24 24" aria-hidden="true">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </summary>
                    <div className="details-body">
                        {/* Floating Highlighter Toggle */}
                        <div className="setting-row">
                            <label htmlFor="toggle-marker-popup" className="setting-label">Floating Highlighter</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="toggle-marker-popup"
                                    role="switch"
                                    checked={settings.showMarkerPopup !== false}
                                    aria-checked={settings.showMarkerPopup !== false ? 'true' : 'false'}
                                    onChange={(e) => handleSettingChange('showMarkerPopup', (e.target as HTMLInputElement).checked)}
                                />
                                <span className="slider" />
                            </label>
                        </div>

                        {/* Problem Tracker Launcher Toggle */}
                        <div className="setting-row">
                            <label htmlFor="toggle-algo-launcher" className="setting-label">Problem Tracker Button</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="toggle-algo-launcher"
                                    role="switch"
                                    checked={settings.showLauncher !== false}
                                    aria-checked={settings.showLauncher !== false ? 'true' : 'false'}
                                    onChange={(e) => handleSettingChange('showLauncher', (e.target as HTMLInputElement).checked)}
                                />
                                <span className="slider" />
                            </label>
                        </div>

                        {/* Show Analytics & Charts Toggle */}
                        <div className="setting-row">
                            <label htmlFor="toggle-show-charts" className="setting-label">Show Analytics & Charts</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="toggle-show-charts"
                                    role="switch"
                                    checked={settings.showCharts !== false}
                                    aria-checked={settings.showCharts !== false ? 'true' : 'false'}
                                    onChange={(e) => handleSettingChange('showCharts', (e.target as HTMLInputElement).checked)}
                                />
                                <span className="slider" />
                            </label>
                        </div>

                        {/* Daily Focus & Momentum Toggle */}
                        <div className="setting-row">
                            <label htmlFor="toggle-daily-focus" className="setting-label">Daily Focus & Momentum</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="toggle-daily-focus"
                                    role="switch"
                                    checked={settings.showDailyFocus !== false}
                                    aria-checked={settings.showDailyFocus !== false ? 'true' : 'false'}
                                    onChange={(e) => handleSettingChange('showDailyFocus', (e.target as HTMLInputElement).checked)}
                                />
                                <span className="slider" />
                            </label>
                        </div>

                        {/* Developer Mode Toggle */}
                        <div className="setting-row">
                            <label htmlFor="toggle-dev-mode" className="setting-label">Developer Mode</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="toggle-dev-mode"
                                    role="switch"
                                    checked={!!settings.developerMode}
                                    aria-checked={settings.developerMode ? 'true' : 'false'}
                                    onChange={(e) => handleSettingChange('developerMode', (e.target as HTMLInputElement).checked)}
                                />
                                <span className="slider" />
                            </label>
                        </div>

                        {/* Developer Mode Action Buttons */}
                        <div
                            id="dev-mode-actions"
                            style={{ display: settings.developerMode ? 'block' : 'none', marginTop: '8px', textAlign: 'right' }}
                        >
                            <button id="export-debug-logs-btn" className="btn btn-secondary btn-sm" onClick={handleExportLogs}>
                                Export Debug Logs
                            </button>
                        </div>

                        {/* Notification Controls: Dev Mode Test Buttons */}
                        <div
                            id="notification-settings-card"
                            className="notification-card"
                            style={{ display: BROWSER_CONFIG.supportsNotifications ? 'block' : 'none' }}
                        >
                            <div
                                id="test-notifications-container"
                                className="button-row"
                                style={{
                                    display: settings.developerMode ? 'flex' : 'none',
                                    flexDirection: 'column',
                                    gap: '8px',
                                    marginTop: '8px'
                                }}
                            >
                                <button id="test-notification-btn" className="btn btn-secondary flex-1" onClick={handleTestNotification}>
                                    Send Test Notification
                                </button>
                                <button id="test-summary-notification-btn" className="btn btn-secondary flex-1" onClick={handleTestSummaryNotification}>
                                    Send Test Summary Notification
                                </button>
                            </div>
                        </div>
                    </div>
                </details>

                {/* Static Review Banner: Hidden when rating prompt card is visible */}
                <div
                    className="static-review-banner"
                    style={{ display: isPromptCardVisible ? 'none' : 'block' }}
                >
                    <a
                        href={resolvedReviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        id="static-review-link"
                        className="static-review-link"
                    >
                        <svg className="svg-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                        Love AlgoRecall? Rate us 5 stars!
                    </a>
                </div>

                <footer className="footer-modern">
                    <p>AlgoRecall: 100% Private, Local-First.</p>
                    <a
                        href="../../common/settings/settings.html#about"
                        onClick={(e) => {
                            e.preventDefault();
                            openTab('features/common/settings/settings.html#about');
                        }}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Help & Privacy
                    </a>
                </footer>
            </div>

            {/* Achievements Modal Dialog */}
            <AchievementsModal
                isOpen={isAchievementsOpen}
                onClose={() => safeFlushSync(() => setIsAchievementsOpen(false))}
                achievements={evaluatedAchievements}
                records={evaluatedRecords}
            />

            {/* Status & Milestone Feedback Toasts */}
            <div
                id="status-msg"
                className={`toast modern-toast status-toast ${statusToast ? `show ${statusToast.isError ? 'error' : 'success'}` : ''}`}
            >
                {statusToast && (
                    <Fragment>
                        <svg className="svg-icon toast-icon" viewBox="0 0 24 24" aria-hidden="true">
                            {statusToast.isError ? (
                                <Fragment>
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </Fragment>
                            ) : (
                                <polyline points="20 6 9 17 4 12" />
                            )}
                        </svg>
                        <span>{statusToast.message}</span>
                    </Fragment>
                )}
            </div>

            <div id="milestone-toast" className={`toast milestone-toast ${milestoneToast ? 'show' : ''}`}>
                <span id="milestone-toast-text">{milestoneToast || ''}</span>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE MOUNT ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

export const initPopupDashboard = withErrorHandling((): void => {
    const root = document.getElementById('root') || document.body;
    if (root) {
        render(<PopupApp />, root);
    }
}, { context: 'Popup', message: 'Initialization failed' });

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPopupDashboard);
    } else {
        initPopupDashboard();
    }
}
