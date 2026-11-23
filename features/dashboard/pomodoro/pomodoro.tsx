/**
 * @file features/dashboard/pomodoro/pomodoro.tsx
 * @description Pomodoro Study Timer UI controller and visual renderer.
 * Synchronizes timer countdown state with the background service worker, renders
 * animated SVG progress rings, manages phase switching (focus -> shortBreak -> longBreak),
 * and tracks daily study time and session counts.
 * Migrated to Preact with TypeScript for modular, accessible timer controls and visual dials.
 *
 * Architecture Role: Pomodoro Standalone Page Controller.
 * Context: Extension Standalone Tab (`features/dashboard/pomodoro/pomodoro.html`).
 * Key Exports:
 * - `PomodoroSettings`: Configurable phase durations and cycle thresholds.
 * - `PomodoroState`: Shared timer execution and session state object.
 * - `PomodoroStats`: Daily aggregated study session counters.
 * - `PomodoroPhaseTabs`: Preact component for timer phase selection.
 * - `PomodoroTimerRing`: Preact component rendering the circular SVG timer ring.
 * - `PomodoroSessionProgress`: Preact component displaying completed session dots.
 * - `PomodoroStatsDisplay`: Preact component displaying daily sessions and focus minutes.
 * - `PomodoroControls`: Preact component for Start, Pause, Reset, and Skip controls.
 * - `PomodoroSettingsForm`: Preact component for interval length configuration.
 * - `PomodoroApp`: Preact container component combining all timer sections.
 * - `PomodoroTimer`: Controller class managing tick intervals, DOM updates, and background sync.
 */

import { h, Fragment, render, VNode } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { StorageData } from '../../../types/domain';
import { DEFAULT_POMODORO_SETTINGS } from '../../common/constants';

/**
 * User-configurable duration and interval settings for the Pomodoro timer.
 */
export interface PomodoroSettings {
    /** Duration of focus / work sessions in minutes. */
    focusDuration: number;
    /** Duration of short break sessions in minutes. */
    shortBreakDuration: number;
    /** Duration of long break sessions in minutes. */
    longBreakDuration: number;
    /** Number of focus sessions required before triggering a long break. */
    sessionsBeforeLongBreak: number;
}

/**
 * Live execution and synchronization state of the Pomodoro timer.
 */
export interface PomodoroState {
    /** Current operating state: 'idle', 'running', or 'paused'. */
    state: 'idle' | 'running' | 'paused';
    /** Current interval phase: 'focus', 'shortBreak', or 'longBreak'. */
    phase: 'focus' | 'shortBreak' | 'longBreak';
    /** 1-based index of the active focus session within current cycle. */
    currentSession: number;
    /** Seconds remaining until the active interval expires. */
    timeRemaining: number;
    /** Total duration of the active interval in seconds. */
    totalTime: number;
    /** Epoch timestamp in milliseconds when active interval should end, or null. */
    targetEndTime: number | null;
}

/**
 * Aggregated daily performance metrics for completed Pomodoro sessions.
 */
export interface PomodoroStats {
    /** Total focus sessions completed today. */
    sessionsToday?: number;
    /** Total focus minutes accumulated today. */
    focusMinutesToday?: number;
    /** Formatted date string (`toLocaleDateString`) indicating when stats were last recorded. */
    lastDate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface PomodoroPhaseTabsProps {
    phase: 'focus' | 'shortBreak' | 'longBreak';
    onSelectPhase?: (phase: 'focus' | 'shortBreak' | 'longBreak') => void;
}

export function PomodoroPhaseTabs({ phase, onSelectPhase }: PomodoroPhaseTabsProps): VNode {
    return (
        <div className="phase-indicators" role="tablist">
            <span
                id="phase-focus"
                className={`phase-indicator ${phase === 'focus' ? 'active' : ''}`}
                role="tab"
                aria-selected={phase === 'focus'}
                onClick={() => onSelectPhase && onSelectPhase('focus')}
            >
                Focus
            </span>
            <span
                id="phase-short-break"
                className={`phase-indicator ${phase === 'shortBreak' ? 'active' : ''}`}
                role="tab"
                aria-selected={phase === 'shortBreak'}
                onClick={() => onSelectPhase && onSelectPhase('shortBreak')}
            >
                Short Break
            </span>
            <span
                id="phase-long-break"
                className={`phase-indicator ${phase === 'longBreak' ? 'active' : ''}`}
                role="tab"
                aria-selected={phase === 'longBreak'}
                onClick={() => onSelectPhase && onSelectPhase('longBreak')}
            >
                Long Break
            </span>
        </div>
    );
}

export interface PomodoroTimerRingProps {
    timeRemaining: number;
    totalTime: number;
    phaseLabel: string;
    phase: 'focus' | 'shortBreak' | 'longBreak';
    isRunning?: boolean;
}

export function PomodoroTimerRing({
    timeRemaining,
    totalTime,
    phaseLabel,
    phase,
    isRunning = false
}: PomodoroTimerRingProps): VNode {
    const circumference = 2 * Math.PI * 88;
    const progress = totalTime > 0 ? (totalTime - timeRemaining) / totalTime : 0;
    const targetOffset = circumference - (progress * circumference);
    const [animatedOffset, setAnimatedOffset] = useState<number>(circumference);

    useEffect(() => {
        const raf = requestAnimationFrame(() => {
            setAnimatedOffset(targetOffset);
        });
        return () => cancelAnimationFrame(raf);
    }, [targetOffset]);

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return (
        <div className="timer-ring-container">
            <svg className={`timer-ring-svg ${isRunning ? 'running' : ''}`} viewBox="0 0 200 200">
                <circle
                    className="timer-ring-bg"
                    cx="100"
                    cy="100"
                    r={88}
                />
                <circle
                    id="timer-ring-fill"
                    className={`timer-ring-fill ${phase !== 'focus' ? 'break-ring' : ''}`}
                    cx="100"
                    cy="100"
                    r={88}
                    stroke-dasharray={String(circumference)}
                    stroke-dashoffset={String(targetOffset)}
                    style={{
                        strokeDasharray: `${circumference}`,
                        strokeDashoffset: `${targetOffset}`,
                        transition: isRunning ? 'stroke-dashoffset 1s linear, stroke 0.5s ease' : 'none'
                    }}
                />
            </svg>
            <div className="timer-display-overlay">
                <span id="timer-time" className="timer-time">{formattedTime}</span>
                <span id="timer-phase-label" className="timer-phase-label">{phaseLabel}</span>
            </div>
        </div>
    );
}

export interface PomodoroSessionProgressProps {
    currentSession: number;
    totalSessions: number;
}

export function PomodoroSessionProgress({
    currentSession,
    totalSessions
}: PomodoroSessionProgressProps): VNode {
    const dots = [];
    for (let i = 1; i <= totalSessions; i++) {
        let dotClass = 'session-dot';
        if (i < currentSession) {
            dotClass += ' complete';
        } else if (i === currentSession) {
            dotClass += ' active';
        }
        dots.push(<div key={i} className={dotClass} />);
    }

    return (
        <div className="session-progress">
            <div id="session-dots" className="session-dots">
                {dots}
            </div>
            <span id="session-text" className="session-text">
                {currentSession} of {totalSessions}
            </span>
        </div>
    );
}

export interface PomodoroStatsDisplayProps {
    todaySessions: number;
    todayFocusMinutes: number;
}

export function PomodoroStatsDisplay({
    todaySessions,
    todayFocusMinutes
}: PomodoroStatsDisplayProps): VNode {
    let focusText = `${todayFocusMinutes}m`;
    if (todayFocusMinutes >= 60) {
        const hours = Math.floor(todayFocusMinutes / 60);
        const mins = todayFocusMinutes % 60;
        focusText = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }

    return (
        <div className="pomodoro-today-stats">
            <div className="stat-card">
                <span className="stat-label">Today's Sessions</span>
                <span id="today-sessions" className="stat-value">{todaySessions}</span>
            </div>
            <div className="stat-card">
                <span className="stat-label">Focus Time</span>
                <span id="today-focus-time" className="stat-value">{focusText}</span>
            </div>
        </div>
    );
}

export interface PomodoroControlsProps {
    state: 'idle' | 'running' | 'paused';
    onStart: () => void;
    onPause: () => void;
    onReset: () => void;
    onSkip: () => void;
}

export function PomodoroControls({
    state,
    onStart,
    onPause,
    onReset,
    onSkip
}: PomodoroControlsProps): VNode {
    return (
        <div className="timer-controls">
            <button
                id="start-btn"
                className="btn btn-primary btn-round"
                title="Start Timer"
                aria-label="Start Timer"
                style={{ display: state === 'running' ? 'none' : 'flex' }}
                onClick={onStart}
            >
                <svg className="svg-icon" viewBox="0 0 24 24">
                    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                </svg>
            </button>
            <button
                id="pause-btn"
                className="btn btn-secondary btn-round"
                title="Pause Timer"
                aria-label="Pause Timer"
                style={{ display: state === 'running' ? 'flex' : 'none' }}
                onClick={onPause}
            >
                <svg className="svg-icon" viewBox="0 0 24 24">
                    <rect x="6" y="4" width="4" height="16" fill="currentColor" />
                    <rect x="14" y="4" width="4" height="16" fill="currentColor" />
                </svg>
            </button>
            <button id="reset-btn" className="btn btn-secondary" title="Reset Timer" aria-label="Reset Timer" onClick={onReset}>
                Reset
            </button>
            <button id="skip-btn" className="btn btn-secondary" title="Skip Phase" aria-label="Skip Phase" onClick={onSkip}>
                Skip
            </button>
        </div>
    );
}

export interface PomodoroSettingsFormProps {
    settings: PomodoroSettings;
    onSave: (settings: PomodoroSettings) => void;
}

export function PomodoroSettingsForm({ settings, onSave }: PomodoroSettingsFormProps): VNode {
    const [focusDuration, setFocusDuration] = useState(settings.focusDuration);
    const [shortBreakDuration, setShortBreakDuration] = useState(settings.shortBreakDuration);
    const [longBreakDuration, setLongBreakDuration] = useState(settings.longBreakDuration);
    const [sessionsBeforeLongBreak, setSessionsBeforeLongBreak] = useState(settings.sessionsBeforeLongBreak);

    useEffect(() => {
        setFocusDuration(settings.focusDuration);
        setShortBreakDuration(settings.shortBreakDuration);
        setLongBreakDuration(settings.longBreakDuration);
        setSessionsBeforeLongBreak(settings.sessionsBeforeLongBreak);
    }, [settings.focusDuration, settings.shortBreakDuration, settings.longBreakDuration, settings.sessionsBeforeLongBreak]);

    const handleSubmit = (e: Event) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement | null;
        const focusInput = form?.elements?.namedItem('focus-duration') as HTMLInputElement | null;
        const shortInput = form?.elements?.namedItem('short-break-duration') as HTMLInputElement | null;
        const longInput = form?.elements?.namedItem('long-break-duration') as HTMLInputElement | null;
        const sessionsInput = form?.elements?.namedItem('sessions-count') as HTMLInputElement | null;

        onSave({
            focusDuration: focusInput ? parseInt(focusInput.value, 10) || focusDuration : focusDuration,
            shortBreakDuration: shortInput ? parseInt(shortInput.value, 10) || shortBreakDuration : shortBreakDuration,
            longBreakDuration: longInput ? parseInt(longInput.value, 10) || longBreakDuration : longBreakDuration,
            sessionsBeforeLongBreak: sessionsInput ? parseInt(sessionsInput.value, 10) || sessionsBeforeLongBreak : sessionsBeforeLongBreak
        });
    };

    return (
        <form className="pomodoro-settings-form" onSubmit={handleSubmit}>
            <div className="settings-field">
                <label htmlFor="focus-duration">Focus Duration (min):</label>
                <input
                    type="number"
                    id="focus-duration"
                    name="focus-duration"
                    min={1}
                    max={120}
                    value={focusDuration}
                    onInput={(e) => setFocusDuration(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                    onChange={(e) => setFocusDuration(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                />
            </div>
            <div className="settings-field">
                <label htmlFor="short-break-duration">Short Break (min):</label>
                <input
                    type="number"
                    id="short-break-duration"
                    name="short-break-duration"
                    min={1}
                    max={60}
                    value={shortBreakDuration}
                    onInput={(e) => setShortBreakDuration(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                    onChange={(e) => setShortBreakDuration(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                />
            </div>
            <div className="settings-field">
                <label htmlFor="long-break-duration">Long Break (min):</label>
                <input
                    type="number"
                    id="long-break-duration"
                    name="long-break-duration"
                    min={1}
                    max={60}
                    value={longBreakDuration}
                    onInput={(e) => setLongBreakDuration(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                    onChange={(e) => setLongBreakDuration(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                />
            </div>
            <div className="settings-field">
                <label htmlFor="sessions-count">Sessions Before Long Break:</label>
                <input
                    type="number"
                    id="sessions-count"
                    name="sessions-count"
                    min={1}
                    max={12}
                    value={sessionsBeforeLongBreak}
                    onInput={(e) => setSessionsBeforeLongBreak(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                    onChange={(e) => setSessionsBeforeLongBreak(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                />
            </div>
            <button type="submit" id="save-settings-btn" className="btn btn-primary">
                Save Settings
            </button>
        </form>
    );
}

export interface PomodoroAppProps {
    timer?: PomodoroTimer;
}

/**
 * Root Preact Component for the full Pomodoro Study Timer page.
 * Renders header, phase pill selectors, SVG timer ring, control buttons, session dots,
 * today's stats, and configurable timer settings.
 */
export function PomodoroApp({ timer: initialTimer }: PomodoroAppProps): VNode {
    const timer = useMemo(() => initialTimer || new PomodoroTimer(), [initialTimer]);
    const [, setTick] = useState(0);

    const [cfgFocus, setCfgFocus] = useState(timer.settings.focusDuration);
    const [cfgShort, setCfgShort] = useState(timer.settings.shortBreakDuration);
    const [cfgLong, setCfgLong] = useState(timer.settings.longBreakDuration);
    const [cfgSessions, setCfgSessions] = useState(timer.settings.sessionsBeforeLongBreak);

    useEffect(() => {
        setCfgFocus(timer.settings.focusDuration);
        setCfgShort(timer.settings.shortBreakDuration);
        setCfgLong(timer.settings.longBreakDuration);
        setCfgSessions(timer.settings.sessionsBeforeLongBreak);
    }, [timer.settings.focusDuration, timer.settings.shortBreakDuration, timer.settings.longBreakDuration, timer.settings.sessionsBeforeLongBreak]);

    useEffect(() => {
        if (!timer.initialized) {
            timer.init();
        }
        const interval = setInterval(() => {
            setTick((t) => t + 1);
        }, 500);
        return () => clearInterval(interval);
    }, [timer]);

    const mins = Math.floor(timer.timeRemaining / 60);
    const secs = timer.timeRemaining % 60;
    const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    let phaseLabel = 'Focus Time';
    if (timer.phase === 'shortBreak') phaseLabel = 'Short Break';
    if (timer.phase === 'longBreak') phaseLabel = 'Long Break';

    const circumference = 2 * Math.PI * 88;
    const progress = timer.totalTime > 0 ? (timer.totalTime - timer.timeRemaining) / timer.totalTime : 0;
    const targetOffset = circumference * (1 - progress);
    const [animatedOffset, setAnimatedOffset] = useState<number>(() => (timer.state === 'running' ? targetOffset : 0));

    useEffect(() => {
        const timerId = setTimeout(() => {
            setAnimatedOffset(targetOffset);
        }, 50);
        return () => clearTimeout(timerId);
    }, [targetOffset]);

    return (
        <div className={`container ${timer.phase === 'focus' ? 'phase-focus' : 'phase-break'}`}>
            <header className="pomodoro-header">
                <div className="algorecall-brand-badge">
                    <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                        <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                    </svg>
                    <span className="algorecall-brand-name">AlgoRecall</span>
                </div>
                <h1 className="pomodoro-title">Pomodoro Timer</h1>
            </header>

            <div className="phase-indicator">
                <div
                    id="phase-focus"
                    className={`phase-pill ${timer.phase === 'focus' ? 'active' : ''}`}
                    onClick={() => { timer.phase = 'focus'; timer.reset(); setTick((t) => t + 1); }}
                >
                    Focus
                </div>
                <div
                    id="phase-short-break"
                    className={`phase-pill ${timer.phase === 'shortBreak' ? 'active break-active' : ''}`}
                    onClick={() => { timer.phase = 'shortBreak'; timer.reset(); setTick((t) => t + 1); }}
                >
                    Short Break
                </div>
                <div
                    id="phase-long-break"
                    className={`phase-pill ${timer.phase === 'longBreak' ? 'active break-active' : ''}`}
                    onClick={() => { timer.phase = 'longBreak'; timer.reset(); setTick((t) => t + 1); }}
                >
                    Long Break
                </div>
            </div>

            <div className="timer-section">
                <div className="timer-ring-wrap">
                    <svg className={`timer-ring-svg ${timer.state === 'running' ? 'running' : ''}`} viewBox="0 0 200 200">
                        <circle className="timer-ring-bg" cx="100" cy="100" r="88" />
                        <circle
                            className={`timer-ring-fill ${timer.phase !== 'focus' ? 'break-ring' : ''}`}
                            id="timer-ring-fill"
                            cx="100"
                            cy="100"
                            r="88"
                            stroke-dasharray={String(circumference)}
                            stroke-dashoffset={String(animatedOffset)}
                            style={{
                                strokeDasharray: `${circumference}`,
                                strokeDashoffset: `${animatedOffset}`,
                                transition: timer.state === 'running'
                                    ? 'stroke-dashoffset 1s linear, stroke 0.5s ease'
                                    : 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.5s ease'
                            }}
                        />
                    </svg>
                    <div className="timer-display">
                        <span className="timer-time" id="timer-time">{formattedTime}</span>
                        <span className="timer-phase-label" id="timer-phase-label">{phaseLabel}</span>
                    </div>
                </div>
            </div>

            <div className="controls">
                <button
                    id="start-btn"
                    className="btn btn-primary btn-round"
                    title="Start Timer"
                    aria-label="Start Timer"
                    style={{ display: timer.state === 'running' ? 'none' : 'flex' }}
                    onClick={() => { timer.start(); setTick((t) => t + 1); }}
                >
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }} aria-hidden="true">
                        <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" />
                    </svg>
                </button>
                <button
                    id="pause-btn"
                    className="btn btn-secondary btn-round"
                    title="Pause Timer"
                    aria-label="Pause Timer"
                    style={{ display: timer.state === 'running' ? 'flex' : 'none' }}
                    onClick={() => { timer.pause(); setTick((t) => t + 1); }}
                >
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '20px', height: '20px' }} aria-hidden="true">
                        <rect x="6" y="4" width="4" height="16" fill="currentColor" />
                        <rect x="14" y="4" width="4" height="16" fill="currentColor" />
                    </svg>
                </button>
                <button
                    id="reset-btn"
                    className="btn btn-secondary btn-round-sm"
                    title="Reset Timer"
                    aria-label="Reset Timer"
                    onClick={() => { timer.reset(); setTick((t) => t + 1); }}
                >
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }} aria-hidden="true">
                        <polyline points="1 4 1 10 7 10" />
                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                    </svg>
                </button>
                <button
                    id="skip-btn"
                    className="btn btn-secondary btn-round-sm"
                    title="Skip to Next Phase"
                    aria-label="Skip to Next Phase"
                    onClick={() => { timer.skip(); setTick((t) => t + 1); }}
                >
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '16px', height: '16px' }} aria-hidden="true">
                        <polygon points="5 4 15 12 5 20 5 4" />
                        <line x1="19" y1="5" x2="19" y2="19" />
                    </svg>
                </button>
            </div>

            <div className="session-counter">
                <span className="session-label">Session</span>
                <div className="session-dots" id="session-dots">
                    {Array.from({ length: timer.settings.sessionsBeforeLongBreak }).map((_, idx) => {
                        const sessionNum = idx + 1;
                        let dotClass = 'session-dot';
                        if (sessionNum < timer.currentSession) dotClass += ' complete';
                        else if (sessionNum === timer.currentSession) dotClass += ' active';
                        return <div key={sessionNum} className={dotClass} />;
                    })}
                </div>
                <span className="session-text" id="session-text">
                    {`${timer.currentSession} of ${timer.settings.sessionsBeforeLongBreak}`}
                </span>
            </div>

            <div className="today-stats">
                <div className="today-stat">
                    <span className="today-stat-value" id="today-sessions">{timer.todaySessions}</span>
                    <span className="today-stat-label">Sessions Today</span>
                </div>
                <div className="today-stat">
                    <span className="today-stat-value" id="today-focus-time">
                        {timer.todayFocusMinutes >= 60
                            ? `${Math.floor(timer.todayFocusMinutes / 60)}h ${timer.todayFocusMinutes % 60}m`
                            : `${timer.todayFocusMinutes}m`}
                    </span>
                    <span className="today-stat-label">Focus Time</span>
                </div>
            </div>

            <details className="settings-panel">
                <summary className="settings-toggle">
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '14px', height: '14px', marginRight: '6px' }} aria-hidden="true">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                    </svg>
                    Timer Settings
                </summary>
                <div className="settings-body">
                    <div className="settings-row">
                        <div className="setting-group">
                            <label htmlFor="focus-duration">Focus (min)</label>
                            <input
                                type="number"
                                id="focus-duration"
                                className="input-field setting-input"
                                value={cfgFocus}
                                min={1}
                                max={120}
                                onInput={(e) => setCfgFocus(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                            />
                        </div>
                        <div className="setting-group">
                            <label htmlFor="short-break-duration">Short Break (min)</label>
                            <input
                                type="number"
                                id="short-break-duration"
                                className="input-field setting-input"
                                value={cfgShort}
                                min={1}
                                max={30}
                                onInput={(e) => setCfgShort(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                            />
                        </div>
                        <div className="setting-group">
                            <label htmlFor="long-break-duration">Long Break (min)</label>
                            <input
                                type="number"
                                id="long-break-duration"
                                className="input-field setting-input"
                                value={cfgLong}
                                min={1}
                                max={60}
                                onInput={(e) => setCfgLong(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                            />
                        </div>
                        <div className="setting-group">
                            <label htmlFor="sessions-count">Sessions Before Long Break</label>
                            <input
                                type="number"
                                id="sessions-count"
                                className="input-field setting-input"
                                value={cfgSessions}
                                min={2}
                                max={10}
                                onInput={(e) => setCfgSessions(parseInt((e.target as HTMLInputElement).value, 10) || 1)}
                            />
                        </div>
                    </div>
                    <button
                        id="save-settings-btn"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: '12px' }}
                        onClick={() => {
                            timer.saveSettings({
                                focusDuration: cfgFocus,
                                shortBreakDuration: cfgShort,
                                longBreakDuration: cfgLong,
                                sessionsBeforeLongBreak: cfgSessions
                            });
                            setTick((t) => t + 1);
                        }}
                    >
                        Save Settings
                    </button>
                </div>
            </details>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// POMODORO CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

export class PomodoroTimer {
    /** Configured interval lengths and cycle thresholds. */
    settings: PomodoroSettings;
    /** Timer running status: 'idle', 'running', or 'paused'. */
    state: 'idle' | 'running' | 'paused';
    /** Active session phase: 'focus', 'shortBreak', or 'longBreak'. */
    phase: 'focus' | 'shortBreak' | 'longBreak';
    /** 1-based session counter within the current cycle. */
    currentSession: number;
    /** Remaining seconds in the current phase. */
    timeRemaining: number;
    /** Total seconds allocated to the current phase. */
    totalTime: number;
    /** Target completion epoch timestamp in milliseconds, or null if idle/paused. */
    targetEndTime: number | null;
    /** Handle for the 1-second visual countdown interval. */
    intervalId: ReturnType<typeof setInterval> | null;
    /** Number of focus sessions completed today. */
    todaySessions: number;
    /** Total focus minutes logged today. */
    todayFocusMinutes: number;
    /** Flag indicating whether the timer instance has initialized storage. */
    initialized: boolean;

    /**
     * Initializes default Pomodoro timer properties and settings defaults.
     */
    constructor() {
        this.settings = { ...DEFAULT_POMODORO_SETTINGS };

        this.state = 'idle';
        this.phase = 'focus';
        this.currentSession = 1;
        this.totalTime = this.settings.focusDuration * 60;
        this.timeRemaining = this.totalTime;
        this.targetEndTime = null;
        this.intervalId = null;

        this.todaySessions = 0;
        this.todayFocusMinutes = 0;
        this.initialized = false;
    }

    /**
     * Formats total seconds into MM:SS display string.
     */
    formatTime(totalSeconds: number): string {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    /**
     * Initializes timer by loading persistent settings and state from storage,
     * registering storage change listeners, and syncing visual indicators.
     * @listens chrome.storage.local
     * @listens chrome.storage.onChanged
     */
    init(): void {
        this.initialized = true;
        try {
            chrome.storage.local.get(['pomodoroSettings', 'pomodoroStats', 'pomodoroState'], (result: StorageData & {
                pomodoroSettings?: PomodoroSettings;
                pomodoroStats?: PomodoroStats;
                pomodoroState?: PomodoroState;
            }) => {
                try {
                    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                    if (lastError) {
                        const errorMessage = lastError.message || String(lastError);
                        Logger.error('PomodoroTimer', `Storage error fetching pomodoro data: ${errorMessage}`, { error: lastError });
                        return;
                    }

                    if (result.pomodoroSettings) {
                        Object.assign(this.settings, result.pomodoroSettings);
                    }

                    if (result.pomodoroState) {
                        this.state = result.pomodoroState.state;
                        this.phase = result.pomodoroState.phase;
                        this.currentSession = result.pomodoroState.currentSession;
                        this.timeRemaining = result.pomodoroState.timeRemaining;
                        this.totalTime = result.pomodoroState.totalTime;
                        this.targetEndTime = result.pomodoroState.targetEndTime;
                    } else {
                        this.resetState();
                    }

                    const stats: Partial<PomodoroStats> = result.pomodoroStats || {};
                    if (stats.lastDate === new Date().toLocaleDateString()) {
                        this.todaySessions = stats.sessionsToday || 0;
                        this.todayFocusMinutes = stats.focusMinutesToday || 0;
                    }

                    this.loadSettingsUI();
                    this.updateTodayStats();
                    this.bindEvents();
                    
                    if (this.state === 'running') {
                        this.startVisualInterval();
                    } else {
                        this.updateDisplay();
                        this.updateRing();
                        this.updatePhaseIndicator();
                        this.updateSessionDots();
                    }

                    chrome.storage.onChanged.addListener((changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
                        try {
                            if (area === 'local' && changes.pomodoroState) {
                                this.syncState(changes.pomodoroState.newValue as PomodoroState | undefined);
                            }
                            if (area === 'local' && changes.pomodoroStats) {
                                const stats = changes.pomodoroStats.newValue as PomodoroStats | undefined;
                                if (stats && stats.lastDate === new Date().toLocaleDateString()) {
                                    this.todaySessions = stats.sessionsToday || 0;
                                    this.todayFocusMinutes = stats.focusMinutesToday || 0;
                                    this.updateTodayStats();
                                }
                            }
                        } catch (changeErr) {
            UIUtils.catchError('PomodoroTimer', 'Error handling storage change event', changeErr);
        }
                    });
                } catch (innerErr) {
            UIUtils.catchError('PomodoroTimer', 'Error during pomodoro dashboard init', innerErr);
        }
            });
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Failed to fetch storage in Pomodoro init', err);
        }
    }

    /**
     * Resets internal countdown and session state back to default focus phase.
     */
    resetState(): void {
        try {
            this.state = 'idle';
            this.phase = 'focus';
            this.currentSession = 1;
            this.totalTime = this.getPhaseDuration() * 60;
            this.timeRemaining = this.totalTime;
            this.targetEndTime = null;
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error resetting pomodoro state', err);
        }
    }

    /**
     * Generates a serializable snapshot of the current timer execution state.
     * @returns Serializable {@link PomodoroState} object.
     */
    getStateObj(): PomodoroState {
        try {
            return {
                state: this.state,
                phase: this.phase,
                currentSession: this.currentSession,
                timeRemaining: this.timeRemaining,
                totalTime: this.totalTime,
                targetEndTime: this.targetEndTime
            };
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('PomodoroTimer', `Error getting state object: ${errorMessage}`, { err });
            return {
                state: 'idle',
                phase: 'focus',
                currentSession: 1,
                timeRemaining: 0,
                totalTime: 0,
                targetEndTime: null
            };
        }
    }

    /**
     * Synchronizes local UI timer properties with incoming background state updates.
     * @param newState - New PomodoroState received from storage or message event.
     */
    syncState(newState: PomodoroState | undefined): void {
        try {
            if (!newState) return;
            this.state = newState.state;
            this.phase = newState.phase;
            this.currentSession = newState.currentSession;
            this.totalTime = newState.totalTime;
            this.targetEndTime = newState.targetEndTime;
            
            if (this.state !== 'running') {
                this.timeRemaining = newState.timeRemaining;
                this.stopVisualInterval();
                this.updateDisplay();
                this.updateRing();
            } else {
                this.startVisualInterval();
            }
            
            this.updatePhaseIndicator();
            this.updateSessionDots();
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error syncing pomodoro state', err, { newState });
        }
    }

    /**
     * Attaches click handlers to start, pause, reset, skip, and save settings buttons.
     */
    bindEvents(): void {}

    /**
     * Populates settings modal input fields with values from `this.settings`.
     */
    loadSettingsUI(): void {}

    /**
     * Resets current interval and timer state back to beginning of active phase.
     */
    resetTimer(): void {
        this.reset();
    }

    /**
     * Reads updated durations from settings modal inputs and persists them to storage.
     * @fires chrome.storage.local.set
     */
    saveSettings(newSettings?: Partial<PomodoroSettings>): void {
        try {
            if (newSettings) {
                this.settings = { ...this.settings, ...newSettings };
            }
            chrome.storage.local.set({ pomodoroSettings: this.settings }, () => {
                try {
                    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                    if (lastError) {
                        const errorMessage = lastError.message || String(lastError);
                        Logger.error('PomodoroTimer', `Storage error saving pomodoroSettings: ${errorMessage}`, { error: lastError });
                        return;
                    }
                    this.reset();
                } catch (cbErr) {
                    UIUtils.catchError('PomodoroTimer', 'Error in storage set callback for saveSettings', cbErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error saving pomodoro settings', err);
        }
    }

    /**
     * Resolves the configured duration in minutes for the active phase.
     * @returns Phase length in minutes.
     */
    getPhaseDuration(): number {
        try {
            switch (this.phase) {
                case 'focus': return this.settings.focusDuration;
                case 'shortBreak': return this.settings.shortBreakDuration;
                case 'longBreak': return this.settings.longBreakDuration;
                default: return this.settings.focusDuration;
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('PomodoroTimer', `Error getting phase duration: ${errorMessage}`, { phase: this.phase, err });
            return this.settings.focusDuration || 25;
        }
    }

    /**
     * Starts or resumes timer countdown, saving state to storage and sending command to background worker.
     * @fires chrome.storage.local.set
     * @fires chrome.runtime.sendMessage
     */
    start(): void {
        try {
            if (this.state === 'running') return;
            this.state = 'running';
            this.targetEndTime = Date.now() + (this.timeRemaining * 1000);
            
            const stateObj = this.getStateObj();
            chrome.storage.local.set({ pomodoroState: stateObj }, () => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('PomodoroTimer', `Storage error saving pomodoroState on start: ${errorMessage}`, { error: lastError });
                }
            });
            chrome.runtime.sendMessage({ action: 'pomodoro_action', payload: { command: 'start', state: stateObj } });
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error starting pomodoro timer', err);
        }
    }

    /**
     * Pauses active countdown, saving remaining time and notifying background worker.
     * @fires chrome.storage.local.set
     * @fires chrome.runtime.sendMessage
     */
    pause(): void {
        try {
            if (this.state !== 'running') return;
            
            this.state = 'paused';
            if (this.targetEndTime) {
                this.timeRemaining = Math.max(0, Math.ceil((this.targetEndTime - Date.now()) / 1000));
            }
            
            const stateObj = this.getStateObj();
            chrome.storage.local.set({ pomodoroState: stateObj }, () => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('PomodoroTimer', `Storage error saving pomodoroState on pause: ${errorMessage}`, { error: lastError });
                }
            });
            chrome.runtime.sendMessage({ action: 'pomodoro_action', payload: { command: 'pause', state: stateObj } });
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error pausing pomodoro timer', err);
        }
    }

    /**
     * Resets timer to initial focus state, saving state and notifying background worker.
     * @fires chrome.storage.local.set
     * @fires chrome.runtime.sendMessage
     */
    reset(): void {
        try {
            this.state = 'idle';
            this.totalTime = this.getPhaseDuration() * 60;
            this.timeRemaining = this.totalTime;
            this.targetEndTime = null;
            this.stopVisualInterval();

            const stateObj = this.getStateObj();
            chrome.storage.local.set({ pomodoroState: stateObj }, () => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('PomodoroTimer', `Storage error saving pomodoroState on reset: ${errorMessage}`, { error: lastError });
                }
            });
            chrome.runtime.sendMessage({ action: 'pomodoro_action', payload: { command: 'reset', state: stateObj } });
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error resetting pomodoro timer', err);
        }
    }

    /**
     * Skips current phase immediately to the subsequent cycle stage (e.g. Focus -> Break).
     * @fires chrome.storage.local.set
     * @fires chrome.runtime.sendMessage
     */
    skip(): void {
        try {
            if (this.phase === 'focus') {
                if (this.currentSession >= this.settings.sessionsBeforeLongBreak) {
                    this.phase = 'longBreak';
                } else {
                    this.phase = 'shortBreak';
                }
            } else {
                if (this.phase === 'longBreak') {
                    this.currentSession = 1;
                } else {
                    this.currentSession++;
                }
                this.phase = 'focus';
            }
            this.state = 'idle';
            this.totalTime = this.getPhaseDuration() * 60;
            this.timeRemaining = this.totalTime;
            this.targetEndTime = null;
            
            const stateObj = this.getStateObj();
            chrome.storage.local.set({ pomodoroState: stateObj }, () => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('PomodoroTimer', `Storage error saving pomodoroState on skip: ${errorMessage}`, { error: lastError });
                }
            });
            chrome.runtime.sendMessage({ action: 'pomodoro_action', payload: { command: 'skip', state: stateObj } });
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error skipping pomodoro phase', err);
        }
    }

    /**
     * Starts 1-second interval loop updating the clock display and SVG ring.
     */
    startVisualInterval(): void {
        try {
            this.stopVisualInterval();

            const tick = () => {
                try {
                    if (this.state !== 'running') return this.stopVisualInterval();
                    if (this.targetEndTime) {
                        this.timeRemaining = Math.max(0, Math.ceil((this.targetEndTime - Date.now()) / 1000));
                    }
                    this.updateDisplay();
                    this.updateRing();
                } catch (tickErr) {
                    UIUtils.catchError('PomodoroTimer', 'Error in visual timer tick', tickErr);
                }
            };
            
            tick();
            this.intervalId = setInterval(tick, 1000);
            this.updatePhaseIndicator();
            this.updateSessionDots();
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error starting visual interval', err);
        }
    }
    
    /**
     * Stops and clears the 1-second visual timer update interval.
     */
    stopVisualInterval(): void {
        try {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error stopping visual interval', err);
        }
    }

    /**
     * Updates the main digital clock text (MM:SS) and window title.
     */
    updateDisplay(): void {}

    /**
     * Updates strokeDashoffset on the SVG countdown ring based on elapsed time ratio.
     */
    updateRing(): void {}

    /**
     * Highlights the active phase pill ('focus', 'shortBreak', or 'longBreak').
     */
    updatePhaseIndicator(): void {}

    /**
     * Updates cycle progress dots indicating how many sessions have been completed.
     */
    updateSessionDots(): void {}

    /**
     * Formats and updates the daily completed sessions and focus time stat labels.
     */
    updateTodayStats(): void {}
}

/**
 * Initializes Pomodoro controller and attaches to global window scope on DOM load.
 */
function initPomodoro(): void {
    try {
        const root = document.getElementById('root');
        if (root) {
            const win = window as unknown as { pomodoro?: PomodoroTimer };
            win.pomodoro = new PomodoroTimer();
            win.pomodoro.init();
            render(<PomodoroApp timer={win.pomodoro} />, root);
        }
    } catch (err) {
        UIUtils.catchError('PomodoroTimer', 'Initialization failed', err);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPomodoro);
    } else {
        initPomodoro();
    }
}

if (typeof module !== "undefined" && module.exports) {
    (module.exports as any).PomodoroPhaseTabs = PomodoroPhaseTabs;
    (module.exports as any).PomodoroTimerRing = PomodoroTimerRing;
    (module.exports as any).PomodoroSessionProgress = PomodoroSessionProgress;
    (module.exports as any).PomodoroStatsDisplay = PomodoroStatsDisplay;
    (module.exports as any).PomodoroControls = PomodoroControls;
    (module.exports as any).PomodoroSettingsForm = PomodoroSettingsForm;
    (module.exports as any).PomodoroApp = PomodoroApp;
    (module.exports as any).PomodoroTimer = PomodoroTimer;
    (module.exports as any).initPomodoro = initPomodoro;
}
