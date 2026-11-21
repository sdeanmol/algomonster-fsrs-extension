/**
 * @file Popup Summary Statistics and Daily Goals (Preact)
 * @module features/dashboard/popup/stats
 * @context Browser Action Popup UI (`features/dashboard/popup/popup.html`)
 * @description Renders summary statistics (Total Cards, Due Today, Retention Rate),
 * daily goal circular SVG progress ring, Gamification XP level bar with streak counters,
 * and 7-day momentum indicators using pure declarative Preact functional components.
 *
 * Key Exports:
 * - `PopupStatsOverview`: Preact component for the 3-box summary KPI cards.
 * - `PopupDailyGoalRing`: Preact component for circular SVG daily review goal ring.
 * - `PopupStreakBadge`: Preact component for study streak counters.
 * - `PopupLevelBadge`: Preact component for XP progress bar, level number, and title.
 * - `DailyFocusCard`: Preact component for the Daily Focus & Momentum collapsible card.
 * - `StatsComponent`: Compatibility coordinator class managing stats calculation and storage synchronization.
 */

import { h, VNode, Fragment, render as preactRender } from "preact";
import { useState } from "preact/hooks";
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import {
    RECALL_THRESHOLD_GOOD,
    RECALL_THRESHOLD_WARNING,
    DUE_CARDS_THRESHOLD_WARNING,
    DEFAULT_DAILY_GOAL,
    STREAK_MILESTONES,
    REVIEW_MILESTONES,
    CONFETTI_COLORS,
    CONFETTI_PARTICLE_COUNT
} from '@common/constants';
import { DashboardComponent, DashboardCoordinator } from './DashboardComponent';
import { getLastReviewDate } from '../../common/utils/cardUtils';
import { Card, StorageData, Achievement, PersonalRecords } from '../../../types/domain';
import AbstractScheduler from '../../tracker/scheduler/scheduler';
import { evaluateAchievements, renderAchievementsModalContent } from './achievements';

/**
 * Result structure representing consecutive study day streaks.
 */
export interface StreakResult {
    /** Number of consecutive daily reviews active up to today/yesterday. */
    current: number;
    /** All-time highest consecutive daily streak achieved. */
    longest: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Props for the PopupStatsOverview component.
 */
export interface PopupStatsOverviewProps {
    /** Total number of cards tracked across all platforms */
    totalCards: number;
    /** Number of cards currently due for review */
    dueCards: number;
    /** Overall retention percentage (0-100) */
    retentionRate: number;
    /** Callback to view all saved cards */
    onViewTotal?: () => void;
    /** Callback to view cards due today */
    onViewDue?: () => void;
    /** Callback to view retention details */
    onViewRetention?: () => void;
}

/**
 * Preact component rendering the 3-column KPI summary stat boxes in the popup.
 */
export function PopupStatsOverview({
    totalCards,
    dueCards,
    retentionRate,
    onViewTotal,
    onViewDue,
    onViewRetention
}: PopupStatsOverviewProps): VNode {
    const dueClass = dueCards === 0 ? 'success' : (dueCards <= DUE_CARDS_THRESHOLD_WARNING ? 'warning' : 'danger');
    const retentionClass = retentionRate >= RECALL_THRESHOLD_GOOD
        ? 'success'
        : (retentionRate >= RECALL_THRESHOLD_WARNING ? 'warning' : 'danger');

    return (
        <div className="card stats-hero">
            <div className="stats-grid">
                <div
                    id="box-total"
                    className="stat-box"
                    title="View all saved patterns"
                    role="button"
                    tabIndex={0}
                    onClick={onViewTotal}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onViewTotal?.();
                        }
                    }}
                >
                    <span className="stat-value" id="total-cards">{totalCards}</span>
                    <span className="stat-label">Patterns</span>
                </div>
                <div
                    id="box-due"
                    className={`stat-box stat-box-due ${dueClass}`}
                    title="View patterns due today"
                    role="button"
                    tabIndex={0}
                    onClick={onViewDue}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onViewDue?.();
                        }
                    }}
                >
                    <span className="stat-value" id="due-cards">{dueCards}</span>
                    <span className="stat-label">Due Today</span>
                </div>
                <div
                    id="box-retention"
                    className={`stat-box ${retentionClass}`}
                    title="View lapsed cards"
                    role="button"
                    tabIndex={0}
                    onClick={onViewRetention}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onViewRetention?.();
                        }
                    }}
                >
                    <span className="stat-value" id="retention-rate">{retentionRate}%</span>
                    <span className="stat-label">Retention</span>
                </div>
            </div>

            {/* Due Reviews Practice Banner */}
            {dueCards > 0 ? (
                <div id="due-banner" className="due-banner">
                    <span>{dueCards} pattern{dueCards === 1 ? '' : 's'} due for review!</span>
                    <button
                        id="due-cards-btn"
                        className="btn btn-primary btn-sm"
                        onClick={onViewDue}
                    >
                        Review Now
                    </button>
                </div>
            ) : (
                <div id="due-banner" className="due-banner hide-panel" style={{ display: 'none' }}>
                    <span>All caught up!</span>
                    <button
                        id="due-cards-btn"
                        className="btn btn-primary btn-sm"
                        onClick={onViewDue}
                    >
                        Practice
                    </button>
                </div>
            )}
        </div>
    );
}

/**
 * Props for the PopupDailyGoalRing component.
 */
export interface PopupDailyGoalRingProps {
    todayReviewed: number;
    dailyGoal: number;
    progress: number;
    isGoalMet: boolean;
    onSaveGoal?: (newGoal: number) => void;
}

/**
 * Preact component rendering the circular SVG daily review goal ring and target editor.
 */
export function PopupDailyGoalRing({
    todayReviewed,
    dailyGoal,
    progress,
    isGoalMet,
    onSaveGoal
}: PopupDailyGoalRingProps): VNode {
    const [isEditing, setIsEditing] = useState(false);
    const [goalInputVal, setGoalInputVal] = useState(String(dailyGoal));

    const circumference = 2 * Math.PI * 42;
    const offset = circumference - (Math.min(Math.max(progress, 0), 1) * circumference);

    const handleSave = () => {
        const parsed = parseInt(goalInputVal, 10);
        if (parsed && parsed > 0 && parsed <= 999) {
            onSaveGoal?.(parsed);
            setIsEditing(false);
        }
    };

    return (
        <div className="daily-goal-card">
            <div className="daily-goal-ring-container goal-ring-container">
                <div className={`goal-ring-wrap ${isGoalMet ? 'goal-ring-complete' : ''}`}>
                    <svg className="daily-goal-svg goal-ring-svg" viewBox="0 0 100 100">
                        <circle className="daily-goal-bg goal-ring-bg" cx="50" cy="50" r="42" />
                        <circle
                            id="daily-goal-progress"
                            className={`daily-goal-fill goal-ring-fill ${isGoalMet ? 'goal-met goal-ring-fill-complete' : ''}`}
                            cx="50"
                            cy="50"
                            r="42"
                            strokeDasharray={String(circumference)}
                            strokeDashoffset={String(offset)}
                        />
                        <circle
                            id="daily-goal-ring-fill"
                            className="hidden-ring-anchor"
                            style={{ display: 'none' }}
                        />
                    </svg>
                    <div className="daily-goal-center-text goal-ring-text">
                        {isGoalMet ? (
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: "22px", height: "22px", stroke: "var(--md-success)" }}>
                                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                <polyline points="22 4 12 14.01 9 11.01" />
                            </svg>
                        ) : (
                            <Fragment>
                                <span id="daily-goal-count" className="daily-goal-count goal-ring-count">{todayReviewed}</span>
                                <span className="daily-goal-divider">/</span>
                                <span id="daily-goal-target" className="daily-goal-target goal-ring-label">{dailyGoal}</span>
                            </Fragment>
                        )}
                    </div>
                </div>
            </div>

            <div className="daily-goal-info goal-info">
                <div className="gamification-header">
                    <span className="daily-goal-title gamification-title">
                        <svg className="svg-icon" style={{ stroke: "var(--md-warning)", marginRight: "3px" }} viewBox="0 0 24 24">
                            <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                        </svg>
                        Daily Review Goal
                    </span>
                    <button
                        id="goal-edit-btn"
                        className="goal-edit-btn"
                        title="Change daily goal"
                        aria-label="Change daily goal"
                        onClick={() => setIsEditing(!isEditing)}
                    >
                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: "11px", height: "11px" }}>
                            <circle cx="12" cy="12" r="3" />
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                        </svg>
                    </button>
                </div>

                <div
                    id="goal-editor"
                    className="goal-editor"
                    style={{ display: isEditing ? 'flex' : 'none' }}
                >
                    <input
                        type="number"
                        id="goal-input"
                        className="goal-input"
                        value={goalInputVal}
                        min="1"
                        max="999"
                        onInput={(e) => setGoalInputVal((e.target as HTMLInputElement).value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSave();
                        }}
                    />
                    <button
                        id="goal-save-btn"
                        className="goal-save-btn"
                        onClick={handleSave}
                    >
                        Set
                    </button>
                </div>

                <span id="daily-goal-status" className="daily-goal-status gamification-msg">
                    {isGoalMet ? "Goal completed! 🎉" : `${Math.max(0, dailyGoal - todayReviewed)} more to reach goal`}
                </span>
            </div>
        </div>
    );
}

/**
 * Props for the PopupStreakBadge component.
 */
export interface PopupStreakBadgeProps {
    currentStreak: number;
    longestStreak: number;
}

/**
 * Preact component rendering study streak and best record badges.
 */
export function PopupStreakBadge({ currentStreak, longestStreak }: PopupStreakBadgeProps): VNode {
    return (
        <div id="streak-card" className="streak-card streak-badge">
            <span className="streak-icon">🔥</span>
            <div className="streak-details">
                <span id="study-streak-count" className="streak-count" style={{ display: 'none' }}>
                    {currentStreak}
                </span>
                <span id="streak-days" className="streak-number streak-text">
                    {currentStreak} Day{currentStreak === 1 ? "" : "s"}
                </span>
                <span className="streak-subtitle">Current Streak</span>
            </div>
            <div className="longest-streak-details">
                <span id="longest-streak-days" className="longest-streak-number streak-best">
                    {longestStreak}
                </span>
                <span id="longest-streak" style={{ display: 'none' }}>
                    {longestStreak}
                </span>
                <span className="longest-streak-subtitle">Best</span>
            </div>
        </div>
    );
}

/**
 * Props for the PopupLevelBadge component.
 */
export interface PopupLevelBadgeProps {
    level: number;
    levelTitle: string;
    currentXP: number;
    nextLevelXP: number;
    progress: number;
}

/**
 * Preact component rendering the user's gamification XP level badge and progression bar.
 */
export function PopupLevelBadge({
    level,
    levelTitle,
    currentXP,
    nextLevelXP,
    progress
}: PopupLevelBadgeProps): VNode {
    return (
        <div className="level-badge-card">
            <div className="level-badge-top">
                <span id="user-level" className="level-badge-number">Level {level}</span>
                <span id="user-level-badge" className="level-badge" style={{ display: 'none' }}>Lv. {level}</span>
                <span id="level-num" style={{ display: 'none' }}>{level}</span>
                <span id="user-title" className="level-badge-title">{levelTitle}</span>
                <span id="level-title" style={{ display: 'none' }}>{levelTitle}</span>
            </div>
            <div
                id="xp-progress-bar-container"
                className="xp-bar-container level-progress-bar-bg"
                role="progressbar"
                aria-label="XP Progress to Next Level"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
            >
                <div
                    id="xp-bar-fill"
                    className="xp-bar-fill level-progress-bar-fill"
                    style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
                />
            </div>
            <div className="level-xp-text">
                <span id="user-current-xp">{currentXP}</span> / <span id="user-next-xp">{nextLevelXP} XP</span>
                <span id="xp-text" style={{ display: 'none' }}>{currentXP} / {nextLevelXP} XP</span>
            </div>
        </div>
    );
}

/**
 * Props for the DailyFocusCard component.
 */
export interface DailyFocusCardProps {
    completedToday?: number;
    dailyGoal?: number;
    currentStreak?: number;
    longestStreak?: number;
    activity?: Record<string, number>;
    achievements?: Achievement[];
    studyPlanDaysLeft?: number | null;
    onSaveGoal?: (newGoal: number) => void;
    onOpenAchievements?: () => void;
}

/**
 * Preact component rendering the complete Daily Focus & Momentum collapsible section.
 */
export function DailyFocusCard({
    completedToday = 0,
    dailyGoal = DEFAULT_DAILY_GOAL,
    currentStreak = 0,
    longestStreak = 0,
    activity = {},
    achievements = [],
    studyPlanDaysLeft = null,
    onSaveGoal,
    onOpenAchievements
}: DailyFocusCardProps = {}): VNode {
    const isGoalMet = dailyGoal > 0 && completedToday >= dailyGoal;
    const progress = dailyGoal > 0 ? completedToday / dailyGoal : 0;

    // Generate 7-day rolling momentum array
    const today = new Date();
    const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const momentumDays: Array<{ day: string; count: number; goalMet: boolean; isToday: boolean; dateKey: string }> = [];
    let activeDaysCount = 0;

    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateKey = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const count = activity[dateKey] || 0;
        const isToday = i === 0;
        const goalMet = count >= dailyGoal && dailyGoal > 0;
        if (count > 0) activeDaysCount++;

        momentumDays.push({
            day: dayNames[d.getDay()],
            count,
            goalMet,
            isToday,
            dateKey
        });
    }

    const unlockedAchievements = achievements.filter(a => a.unlocked).length;
    const totalAchievements = achievements.length || 8;

    return (
        <details id="daily-focus-card" className="card details-card activity-focus-card" open>
            <summary className="details-summary card-header-clean">
                <div className="summary-content header-label-group">
                    <svg className="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
                    </svg>
                    <span className="card-title">Daily Focus & Momentum</span>
                </div>
                <svg className="svg-icon chevron" viewBox="0 0 24 24" aria-hidden="true">
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </summary>

            <div className="details-body">
                <div id="gamification-panel" className="gamification-wrapper">
                    {/* Daily Goal Circular SVG Progress */}
                    <PopupDailyGoalRing
                        todayReviewed={completedToday}
                        dailyGoal={dailyGoal}
                        progress={progress}
                        isGoalMet={isGoalMet}
                        onSaveGoal={onSaveGoal}
                    />

                    {/* Study Streak Badge */}
                    <PopupStreakBadge
                        currentStreak={currentStreak}
                        longestStreak={longestStreak}
                    />

                    {/* Exam countdown pill if study plan is active */}
                    {studyPlanDaysLeft !== null && (
                        <div className={`exam-countdown-pill ${studyPlanDaysLeft <= 3 ? '' : 'safe'}`}>
                            <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: "12px", height: "12px" }}>
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                <line x1="16" y1="2" x2="16" y2="6" />
                                <line x1="8" y1="2" x2="8" y2="6" />
                                <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            {studyPlanDaysLeft === 0 ? 'Exam is today!' : `${studyPlanDaysLeft} day${studyPlanDaysLeft !== 1 ? 's' : ''} until exam`}
                        </div>
                    )}

                    {/* 7-Day Momentum Indicator */}
                    <div id="momentum-days" className="weekly-progress-container" aria-label="7-Day Review Momentum">
                        <div className="weekly-progress-header">
                            <span className="weekly-progress-title">7-Day Momentum</span>
                            <span className="weekly-progress-badge">{activeDaysCount}/7 active</span>
                        </div>
                        <div className="weekly-days-row">
                            {momentumDays.map((m, idx) => {
                                let stateClass = 'empty';
                                if (m.goalMet) stateClass = 'goal-met';
                                else if (m.count > 0) stateClass = 'active';

                                return (
                                    <div
                                        key={idx}
                                        className={`weekly-day-col ${stateClass} ${m.isToday ? 'is-today' : ''}`}
                                        title={`${m.dateKey}: ${m.count} review${m.count === 1 ? '' : 's'}`}
                                        tabIndex={0}
                                        role="img"
                                        aria-label={`${m.dateKey}: ${m.count} reviews`}
                                    >
                                        <span className="weekly-day-name">{m.day}</span>
                                        <div className="weekly-day-dot">
                                            {m.goalMet ? '✓' : (m.count > 0 ? m.count : '')}
                                        </div>
                                    </div>
                                );
                            })}
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
                            <span className="achievements-pill-count">{unlockedAchievements}/{totalAchievements}</span>
                        </button>
                    </div>
                </div>
            </div>
        </details>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// PURE UTILITY FUNCTIONS (CALCULATION & CELEBRATION)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes consecutive study day streaks from daily review counts.
 */
export function calculateStreaks(activity: Record<string, number>): StreakResult {
    try {
        const sortedDates = Object.keys(activity).filter(k => activity[k] > 0).sort();
        if (sortedDates.length === 0) return { current: 0, longest: 0 };

        let currentStreak = 0;
        const today = new Date();
        const checkDate = new Date(today);

        for (let i = 0; i < 365; i++) {
            const dateStr = formatDateKey(checkDate);
            if (activity[dateStr] && activity[dateStr] > 0) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                if (i === 0) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    continue;
                }
                break;
            }
        }

        let longestStreak = 0;
        let tempStreak = 0;
        let prevDate: Date | null = null;

        for (const dateStr of sortedDates) {
            const parts = dateStr.split('-');
            const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));

            if (prevDate) {
                const diffDays = Math.round((d.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
                if (diffDays === 1) {
                    tempStreak++;
                } else {
                    tempStreak = 1;
                }
            } else {
                tempStreak = 1;
            }

            if (tempStreak > longestStreak) longestStreak = tempStreak;
            prevDate = d;
        }

        return { current: currentStreak, longest: longestStreak };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('StatsComponent', `Error calculating streaks: ${errorMessage}`, { err });
        return { current: 0, longest: 0 };
    }
}

/**
 * Generates local timezone date key string (YYYY-MM-DD).
 */
export function formatDateKey(date: Date): string {
    try {
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    } catch (err) {
        return new Date().toISOString().split('T')[0];
    }
}

/**
 * Triggers a canvas confetti animation on the specified canvas or #confetti-canvas.
 */
export function triggerConfetti(canvasEl?: HTMLCanvasElement | null): void {
    try {
        const canvas = canvasEl || (document.getElementById('confetti-canvas') || document.getElementById('celebration-confetti-canvas')) as HTMLCanvasElement | null;
        if (!canvas) return;

        const ctx = canvas.getContext ? canvas.getContext('2d') : null;
        if (!ctx) return;

        canvas.width = canvas.offsetWidth || 350;
        canvas.height = canvas.offsetHeight || 500;

        const colors = CONFETTI_COLORS;
        const particleCount = CONFETTI_PARTICLE_COUNT;
        const particles: Array<{
            x: number;
            y: number;
            w: number;
            h: number;
            vx: number;
            vy: number;
            color: string;
            rotation: number;
            rotationSpeed: number;
            opacity: number;
            shape: 'rect' | 'circle';
        }> = [];

        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: canvas.width * Math.random(),
                y: canvas.height * -0.1 * Math.random(),
                w: 4 + Math.random() * 6,
                h: 3 + Math.random() * 4,
                vx: (Math.random() - 0.5) * 4,
                vy: 1 + Math.random() * 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotationSpeed: (Math.random() - 0.5) * 10,
                opacity: 1,
                shape: Math.random() > 0.5 ? 'rect' : 'circle',
            });
        }

        let frame = 0;
        const maxFrames = 150;

        const animate = () => {
            try {
                frame++;
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                if (frame > maxFrames) {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    return;
                }

                const fadeStart = maxFrames * 0.7;

                particles.forEach(p => {
                    p.x += p.vx;
                    p.vy += 0.05;
                    p.y += p.vy;
                    p.rotation += p.rotationSpeed;

                    if (frame > fadeStart) {
                        p.opacity = Math.max(0, 1 - (frame - fadeStart) / (maxFrames - fadeStart));
                    }

                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate((p.rotation * Math.PI) / 180);
                    ctx.globalAlpha = p.opacity;
                    ctx.fillStyle = p.color;

                    if (p.shape === 'rect') {
                        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                    } else {
                        ctx.beginPath();
                        ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
                        ctx.fill();
                    }

                    ctx.restore();
                });

                requestAnimationFrame(animate);
            } catch (loopErr) {
                UIUtils.catchError('StatsComponent', 'Error in confetti animation loop', loopErr);
            }
        };

        requestAnimationFrame(animate);
    } catch (err) {
        UIUtils.catchError('StatsComponent', 'Error initializing confetti animation', err);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPATIBILITY FACADE: StatsComponent
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sub-component for the popup dashboard that calculates overall retention,
 * drives XP progression, and provides stats calculation methods.
 */
export class StatsComponent extends DashboardComponent {
    dailyGoalTarget: number;
    longestStreak: number;
    cachedActivity: Record<string, number> = {};
    cachedAchievements: Achievement[] = [];
    cachedRecords: PersonalRecords | null = null;

    constructor(coordinator: DashboardCoordinator) {
        super(coordinator);
        this.dailyGoalTarget = DEFAULT_DAILY_GOAL;
        this.longestStreak = 0;
    }

    async load(): Promise<void> {
        try {
            const result = (await chrome.storage.local.get([
                'fsrsCards',
                'fsrsActivity',
                'dailyGoalTarget',
                'longestStreak',
                'lastCelebratedMilestone',
                'unlockedAchievements',
                'studyPlanSettings'
            ])) as StorageData & {
                lastCelebratedMilestone?: number;
                unlockedAchievements?: string[];
                studyPlanSettings?: { isActive?: boolean; examDate?: string };
            };

            const cards: Card[] = result.fsrsCards || [];
            const activity: Record<string, number> = result.fsrsActivity || {};
            this.dailyGoalTarget = typeof result.dailyGoalTarget === 'number' ? result.dailyGoalTarget : DEFAULT_DAILY_GOAL;
            const storedLongestStreak = typeof result.longestStreak === 'number' ? result.longestStreak : 0;
            const lastCelebratedMilestone = typeof result.lastCelebratedMilestone === 'number' ? result.lastCelebratedMilestone : 0;
            const studyPlanSettings = result.studyPlanSettings || null;
            const now = Date.now();

            const dueToday = cards.filter((c: Card) => c.due <= now).length;

            const totalEl = document.getElementById('total-cards');
            const dueEl = document.getElementById('due-cards');
            const retentionEl = document.getElementById('retention-rate');

            if (totalEl) totalEl.innerText = String(cards.length);
            if (dueEl) dueEl.innerText = String(dueToday);

            const boxDue = document.getElementById('box-due');
            if (boxDue) {
                boxDue.classList.remove('success', 'warning', 'danger', 'urgent');
                if (dueToday === 0) {
                    boxDue.classList.add('success');
                } else if (dueToday <= DUE_CARDS_THRESHOLD_WARNING) {
                    boxDue.classList.add('warning');
                } else {
                    boxDue.classList.add('danger');
                }
            }

            let totalRetrievability = 0;
            let retrievabilityCount = 0;
            const SchedulerClass = (window as unknown as { FsrsScheduler?: new () => AbstractScheduler }).FsrsScheduler;
            const scheduler = typeof SchedulerClass === 'function' ? new SchedulerClass() : null;

            let totalActivityReviews = 0;
            let totalReps = 0;
            let totalLapses = 0;

            cards.forEach((card: Card) => {
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

            Object.values(activity).forEach(count => {
                totalActivityReviews += count;
            });

            const boxRetention = document.getElementById('box-retention');
            if (retentionEl) {
                let retentionVal = 0;
                let retentionStr = "0%";
                if (retrievabilityCount > 0) {
                    retentionVal = (totalRetrievability / retrievabilityCount) * 100;
                    retentionStr = Math.round(retentionVal) + "%";
                } else if (totalReps > 0) {
                    retentionVal = ((totalReps - totalLapses) / totalReps) * 100;
                    retentionStr = Math.round(retentionVal) + "%";
                }
                retentionEl.innerText = retentionStr;

                if (boxRetention) {
                    boxRetention.classList.remove('success', 'warning', 'danger');
                    if (retentionVal >= RECALL_THRESHOLD_GOOD) {
                        boxRetention.classList.add('success');
                    } else if (retentionVal >= RECALL_THRESHOLD_WARNING) {
                        boxRetention.classList.add('warning');
                    } else {
                        boxRetention.classList.add('danger');
                    }
                }
            }

            // Level & XP Progression
            const level = Math.floor(1 + 0.6 * Math.sqrt(totalActivityReviews));
            const currentLevelReviews = Math.pow((level - 1) / 0.6, 2);
            const nextLevelReviews = Math.pow(level / 0.6, 2);
            const progressRange = nextLevelReviews - currentLevelReviews;
            const progressMade = totalActivityReviews - currentLevelReviews;
            const currentLevelProgress = progressRange > 0 ? Math.max(0, Math.min(100, (progressMade / progressRange) * 100)) : 0;

            const levelBadge = document.getElementById('user-level-badge');
            const xpBarFill = document.getElementById('xp-bar-fill');
            const xpBarContainer = document.getElementById('xp-progress-bar-container');

            if (levelBadge) {
                levelBadge.innerText = `Lv. ${level}`;
                let levelTitle = "Novice";
                if (level >= 35) levelTitle = "Grandmaster";
                else if (level >= 20) levelTitle = "Expert";
                else if (level >= 10) levelTitle = "Specialist";
                else if (level >= 5) levelTitle = "Apprentice";

                const reviewsToNext = Math.ceil(nextLevelReviews - totalActivityReviews);
                levelBadge.title = `${levelTitle} (${totalActivityReviews} Total Reviews) - ${reviewsToNext} until Lv. ${level + 1}`;
            }
            if (xpBarFill) {
                xpBarFill.style.width = `${currentLevelProgress}%`;
            }
            if (xpBarContainer) {
                xpBarContainer.setAttribute('aria-valuenow', Math.round(currentLevelProgress).toString());
            }

            // Streaks
            const streakData = this.calculateStreaks(activity);
            this.longestStreak = Math.max(streakData.longest, storedLongestStreak);

            if (this.longestStreak > storedLongestStreak) {
                await chrome.storage.local.set({ longestStreak: this.longestStreak });
            }

            // Completed today
            const todayEnd = new Date();
            todayEnd.setHours(23, 59, 59, 999);
            const todayEndTime = todayEnd.getTime();

            let completedToday = 0;
            cards.forEach((card: Card) => {
                const lastReview = getLastReviewDate(card);
                const isReviewedToday = lastReview ? new Date(lastReview).toDateString() === new Date().toDateString() : false;
                const wasDueTodayOrEarlier = !card.previousDue || card.previousDue <= todayEndTime;

                if (isReviewedToday && wasDueTodayOrEarlier) {
                    completedToday++;
                }
            });

            // Achievements
            this.cachedActivity = activity;
            const evalResult = evaluateAchievements({
                cards,
                activity,
                dailyGoalTarget: this.dailyGoalTarget,
                currentStreak: streakData.current,
                longestStreak: this.longestStreak,
                completedToday,
                unlockedIds: result.unlockedAchievements || []
            });
            this.cachedAchievements = evalResult.achievements;
            this.cachedRecords = evalResult.records;

            if (evalResult.newUnlocks.length > 0) {
                await chrome.storage.local.set({ unlockedAchievements: evalResult.allUnlockedIds });
                const first = evalResult.newUnlocks[0];
                setTimeout(() => {
                    this.showMilestoneToast(`🏆 ${first.icon} ${first.title} Unlocked!`);
                    this.showConfetti();
                }, 300);
            }

            // Render into gamification panel
            const gamificationPanel = document.getElementById('gamification-panel');
            if (gamificationPanel) {
                let studyPlanDaysLeft: number | null = null;
                if (studyPlanSettings && studyPlanSettings.isActive && studyPlanSettings.examDate) {
                    const examTime = new Date(studyPlanSettings.examDate + 'T23:59:59').getTime();
                    studyPlanDaysLeft = Math.max(0, Math.ceil((examTime - now) / (1000 * 60 * 60 * 24)));
                }

                if (cards.length === 0) {
                    gamificationPanel.innerHTML = `
                        <div class="achievement-state">
                            <div class="achievement-title" style="color: var(--md-text-low);">
                                <svg class="svg-icon" style="stroke: var(--md-text-low); margin-right: 4px;" viewBox="0 0 24 24"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                Welcome to Spaced Repetitions!
                            </div>
                            <div class="achievement-subtitle">Highlight text or open FSRS widget on problems to save your first pattern.</div>
                        </div>
                    `;
                } else if (dueToday === 0 && completedToday >= this.dailyGoalTarget) {
                    gamificationPanel.innerHTML = this.renderGoalComplete(completedToday, this.dailyGoalTarget, streakData.current, this.longestStreak);
                } else {
                    gamificationPanel.innerHTML = this.renderGoalProgress(completedToday, this.dailyGoalTarget, dueToday, streakData.current, this.longestStreak);
                }

                if (studyPlanDaysLeft !== null) {
                    const pillClass = studyPlanDaysLeft <= 3 ? '' : 'safe';
                    const goalInfo = gamificationPanel.querySelector('.goal-info') || gamificationPanel;
                    const pillHtml = document.createElement('div');
                    pillHtml.className = `exam-countdown-pill ${pillClass}`;
                    pillHtml.innerHTML = `
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        ${studyPlanDaysLeft === 0 ? 'Exam is today!' : `${studyPlanDaysLeft} day${studyPlanDaysLeft !== 1 ? 's' : ''} until exam`}
                    `;
                    goalInfo.appendChild(pillHtml);
                }

                this.bindEditorEvents(gamificationPanel);
                this.bindAchievementsModal(gamificationPanel);
            }

            // Milestone check
            const streakMilestones = STREAK_MILESTONES;
            const reviewMilestones = REVIEW_MILESTONES;

            let newMilestone: { type: string; value: number } | null = null;
            for (const milestone of streakMilestones) {
                if (streakData.current >= milestone && lastCelebratedMilestone < milestone) {
                    newMilestone = { type: 'streak', value: milestone };
                }
            }

            if (!newMilestone) {
                for (const milestone of reviewMilestones) {
                    if (totalActivityReviews >= milestone && lastCelebratedMilestone < milestone) {
                        newMilestone = { type: 'reviews', value: milestone };
                    }
                }
            }

            if (newMilestone) {
                const milestoneKey = newMilestone.value;
                await chrome.storage.local.set({ lastCelebratedMilestone: milestoneKey });

                setTimeout(() => {
                    const label = newMilestone!.type === 'streak'
                        ? `🔥 ${milestoneKey}-Day Streak!`
                        : `⭐ ${milestoneKey} Reviews!`;
                    this.showMilestoneToast(label);
                    this.showConfetti();
                }, 300);
            }
        } catch (error) {
            UIUtils.catchError('StatsComponent', 'Error loading stats', error);
        }
    }

    calculateStreaks(activity: Record<string, number>): StreakResult {
        return calculateStreaks(activity);
    }

    formatDateKey(date: Date): string {
        return formatDateKey(date);
    }

    renderWeeklyProgress(activity: Record<string, number> = {}, dailyGoal: number = DEFAULT_DAILY_GOAL): string {
        const today = new Date();
        const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
        const daysHtml: string[] = [];
        let activeDaysCount = 0;

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateKey = this.formatDateKey(d);
            const count = activity[dateKey] || 0;
            const isToday = i === 0;
            const dayInitial = dayNames[d.getDay()];
            const goalMet = count >= dailyGoal && dailyGoal > 0;
            const hasActivity = count > 0;

            if (hasActivity) activeDaysCount++;

            let stateClass = 'empty';
            if (goalMet) stateClass = 'goal-met';
            else if (hasActivity) stateClass = 'active';

            const tooltip = `${dateKey}: ${count} review${count === 1 ? '' : 's'}${goalMet ? ' (Goal reached!)' : ''}`;

            daysHtml.push(`
                <div class="weekly-day-col ${stateClass} ${isToday ? 'is-today' : ''}" title="${tooltip}" tabindex="0" role="img" aria-label="${tooltip}">
                    <span class="weekly-day-name">${dayInitial}</span>
                    <div class="weekly-day-dot">
                        ${goalMet ? '✓' : (count > 0 ? count : '')}
                    </div>
                </div>
            `);
        }

        return `
            <div class="weekly-progress-container" aria-label="7-Day Review Momentum">
                <div class="weekly-progress-header">
                    <span class="weekly-progress-title">7-Day Momentum</span>
                    <span class="weekly-progress-badge">${activeDaysCount}/7 active</span>
                </div>
                <div class="weekly-days-row">
                    ${daysHtml.join('')}
                </div>
            </div>
        `;
    }

    renderAchievementsPill(achievements: Achievement[] = []): string {
        const unlockedCount = achievements.filter(a => a.unlocked).length;
        const totalCount = achievements.length || 8;

        return `
            <div class="achievements-pill-container">
                <button id="achievements-open-btn" class="achievements-pill-btn" type="button" aria-haspopup="dialog" aria-expanded="false" title="View unlocked milestones and personal records">
                    <span class="achievements-pill-icon">🏆</span>
                    <span class="achievements-pill-text">Milestones & Records</span>
                    <span class="achievements-pill-count">${unlockedCount}/${totalCount}</span>
                </button>
            </div>
        `;
    }

    renderGoalProgress(completed: number, target: number, dueRemaining: number, currentStreak: number, longestStreak: number): string {
        try {
            const completedVal = Number(completed);
            const targetVal = Number(target);
            const pct = Math.min(Math.round((completedVal / targetVal) * 100), 100);
            const circumference = 2 * Math.PI * 42;
            const offset = circumference - (pct / 100) * circumference;
            const streakHtml = this.renderStreakBadge(currentStreak, longestStreak);

            let motivationMsg = `<svg class="svg-icon" style="stroke: var(--md-primary); margin-right: 4px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg> Start your daily streak today!`;
            if (completedVal > 0 && completedVal < targetVal) {
                motivationMsg = `<svg class="svg-icon" style="stroke: var(--md-success); margin-right: 4px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> Keep going! ${targetVal - completedVal} more to hit your goal!`;
            } else if (completedVal >= targetVal) {
                motivationMsg = `<svg class="svg-icon" style="stroke: var(--md-success); margin-right: 4px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Daily goal reached! ${dueRemaining > 0 ? `${dueRemaining} more patterns due.` : 'All caught up!'}`;
            }

        return `
            <div class="goal-ring-container">
                <div class="goal-ring-wrap">
                    <svg class="goal-ring-svg" viewBox="0 0 100 100">
                        <circle class="goal-ring-bg" cx="50" cy="50" r="42" />
                        <circle class="goal-ring-fill" cx="50" cy="50" r="42"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="${offset}" />
                    </svg>
                    <div class="goal-ring-text">
                        <span class="goal-ring-count">${completed}</span>
                        <span class="goal-ring-label">of ${target}</span>
                    </div>
                </div>
                <div class="goal-info">
                    <div class="gamification-header">
                        <span class="gamification-title">
                            <svg class="svg-icon" style="stroke: var(--md-warning); margin-right: 3px;" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
                            Daily Goal
                        </span>
                        <button id="goal-edit-btn" class="goal-edit-btn" title="Change daily goal" aria-label="Change daily goal">
                            <svg class="svg-icon" viewBox="0 0 24 24" style="width:11px; height:11px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        </button>
                    </div>
                    <div id="goal-editor" class="goal-editor" style="display: none;">
                        <input type="number" id="goal-input" class="goal-input" value="${target}" min="1" max="999" />
                        <button id="goal-save-btn" class="goal-save-btn">Set</button>
                    </div>
                    ${streakHtml}
                    <div class="gamification-msg">${motivationMsg}</div>
                </div>
            </div>
            ${this.renderWeeklyProgress(this.cachedActivity, targetVal)}
            ${this.renderAchievementsPill(this.cachedAchievements)}
        `;
        } catch (err) {
            UIUtils.catchError('StatsComponent', 'Error rendering goal progress', err);
            return '';
        }
    }

    renderGoalComplete(completed: number, target: number, currentStreak: number, longestStreak: number): string {
        try {
            const completedVal = Number(completed);
            const targetVal = Number(target);
            const circumference = 2 * Math.PI * 42;
        const streakHtml = this.renderStreakBadge(currentStreak, longestStreak);

        return `
            <div class="goal-ring-container">
                <div class="goal-ring-wrap goal-ring-complete">
                    <svg class="goal-ring-svg" viewBox="0 0 100 100">
                        <circle class="goal-ring-bg" cx="50" cy="50" r="42" />
                        <circle class="goal-ring-fill goal-ring-fill-complete" cx="50" cy="50" r="42"
                            stroke-dasharray="${circumference}"
                            stroke-dashoffset="0" />
                    </svg>
                    <div class="goal-ring-text">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width: 22px; height: 22px; stroke: var(--md-success);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    </div>
                </div>
                <div class="goal-info">
                    <div class="gamification-header">
                        <span class="gamification-title" style="color: var(--md-success);">
                            <svg class="svg-icon" style="stroke: var(--md-success); margin-right: 3px;" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            Goal Complete!
                        </span>
                        <button id="goal-edit-btn" class="goal-edit-btn" title="Change daily goal" aria-label="Change daily goal">
                            <svg class="svg-icon" viewBox="0 0 24 24" style="width:11px; height:11px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        </button>
                    </div>
                    <div id="goal-editor" class="goal-editor" style="display: none;">
                        <input type="number" id="goal-input" class="goal-input" value="${target}" min="1" max="999" />
                        <button id="goal-save-btn" class="goal-save-btn">Set</button>
                    </div>
                    ${streakHtml}
                    <div class="gamification-msg">
                        <svg class="svg-icon" style="stroke: var(--md-success); margin-right: 4px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        All ${completed} reviews done! Inbox Zero achieved!
                    </div>
                </div>
            </div>
            ${this.renderWeeklyProgress(this.cachedActivity, targetVal)}
            ${this.renderAchievementsPill(this.cachedAchievements)}
        `;
        } catch (err) {
            UIUtils.catchError('StatsComponent', 'Error rendering goal complete', err);
            return '';
        }
    }

    renderStreakBadge(current: number, longest: number): string {
        try {
            if (current === 0 && longest === 0) return '';
            const fireColor = current > 0 ? 'var(--md-warning)' : 'var(--md-text-low)';
            const streakText = current > 0 ? `${current}-day streak` : 'No active streak';
            const bestText = longest > 0 ? `Best: ${longest}` : '';

            return `
            <div class="streak-badge">
                <svg class="svg-icon streak-fire" style="stroke: ${fireColor}; fill: ${current > 0 ? 'rgba(249,171,0,0.2)' : 'none'};" viewBox="0 0 24 24">
                    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
                </svg>
                <span class="streak-text">${streakText}</span>
                ${bestText ? `<span class="streak-best">${bestText}</span>` : ''}
            </div>
        `;
        } catch (err) {
            UIUtils.catchError('StatsComponent', 'Error rendering streak badge', err);
            return '';
        }
    }

    bindEditorEvents(gamificationPanel: HTMLElement): void {
        const goalEditBtn = gamificationPanel.querySelector('#goal-edit-btn');
        const goalEditor = gamificationPanel.querySelector('#goal-editor') as HTMLElement | null;
        const goalInput = gamificationPanel.querySelector('#goal-input') as HTMLInputElement | null;
        const goalSaveBtn = gamificationPanel.querySelector('#goal-save-btn');

        if (goalEditBtn && goalEditor && goalInput) {
            goalEditBtn.addEventListener('click', () => {
                goalEditor.style.display = goalEditor.style.display === 'none' ? 'flex' : 'none';
                if (goalEditor.style.display === 'flex') goalInput.focus();
            });

            const saveGoal = async () => {
                const val = parseInt(goalInput.value, 10);
                if (val && val > 0 && val <= 999) {
                    await chrome.storage.local.set({ dailyGoalTarget: val });
                    goalEditor.style.display = 'none';
                    await this.load();
                }
            };

            goalSaveBtn?.addEventListener('click', () => {
                saveGoal().catch(err => {
                    Logger.error('StatsComponent', 'Error saving goal on click', { err });
                });
            });

            goalInput.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                    saveGoal().catch(err => {
                        Logger.error('StatsComponent', 'Error saving goal on keydown', { err });
                    });
                }
            });
        }
    }

    bindEvents(): void {}

    bindAchievementsModal(container?: HTMLElement): void {
        const openModal = () => {
            const modal = document.getElementById('achievements-modal');
            const modalBody = document.getElementById('achievements-modal-body');
            if (modal && modalBody) {
                if (this.cachedRecords) {
                    modalBody.innerHTML = renderAchievementsModalContent(
                        this.cachedAchievements,
                        this.cachedRecords
                    );
                }
                modal.classList.remove('hide-panel');
                modal.setAttribute('aria-hidden', 'false');
                const closeBtn = document.getElementById('close-achievements-btn');
                closeBtn?.focus();
            }
        };

        const closeModal = () => {
            const modal = document.getElementById('achievements-modal');
            if (modal) {
                modal.classList.add('hide-panel');
                modal.setAttribute('aria-hidden', 'true');
            }
        };

        const openBtns = [
            container?.querySelector('#achievements-open-btn'),
            document.getElementById('achievements-open-btn'),
            document.getElementById('achievements-btn')
        ];

        openBtns.forEach(btn => {
            if (btn) {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    openModal();
                });
            }
        });

        const closeBtn = document.getElementById('close-achievements-btn');
        closeBtn?.addEventListener('click', closeModal);

        const modal = document.getElementById('achievements-modal');
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });

        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape' && modal && !modal.classList.contains('hide-panel')) {
                closeModal();
            }
        });
    }

    showMilestoneToast(message: string): void {
        try {
            const toast = document.getElementById('milestone-toast');
            const toastText = document.getElementById('milestone-toast-text');
            if (!toast || !toastText) return;

            toastText.textContent = message;
            toast.classList.add('show');

            setTimeout(() => {
                try {
                    toast.classList.remove('show');
                } catch (timerErr) {
                    UIUtils.catchError('StatsComponent', 'Error hiding milestone toast', timerErr);
                }
            }, 3500);
        } catch (err) {
            UIUtils.catchError('StatsComponent', 'Error showing milestone toast', err, { message });
        }
    }

    showConfetti(): void {
        try {
            triggerConfetti();
        } catch (err) {
            UIUtils.catchError('StatsComponent', 'Error showing confetti', err);
        }
    }
}

if (typeof module !== "undefined" && module.exports) {
    (module.exports as any).StatsComponent = StatsComponent;
    (module.exports as any).PopupStatsOverview = PopupStatsOverview;
    (module.exports as any).PopupDailyGoalRing = PopupDailyGoalRing;
    (module.exports as any).PopupStreakBadge = PopupStreakBadge;
    (module.exports as any).PopupLevelBadge = PopupLevelBadge;
    (module.exports as any).DailyFocusCard = DailyFocusCard;
    (module.exports as any).calculateStreaks = calculateStreaks;
    (module.exports as any).formatDateKey = formatDateKey;
    (module.exports as any).triggerConfetti = triggerConfetti;
}
