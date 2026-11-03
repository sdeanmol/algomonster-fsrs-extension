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
}

export function PomodoroTimerRing({
    timeRemaining,
    totalTime,
    phaseLabel,
    phase
}: PomodoroTimerRingProps): VNode {
    const circumference = 2 * Math.PI * 88;
    const progress = totalTime > 0 ? (totalTime - timeRemaining) / totalTime : 0;
    const offset = circumference - (progress * circumference);

    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return (
        <div className="timer-ring-container">
            <svg className="timer-ring-svg" viewBox="0 0 200 200">
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
                    strokeDasharray={String(circumference)}
                    strokeDashoffset={String(offset)}
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
    const handleSubmit = (e: Event) => {
        e.preventDefault();
        const focusInput = document.getElementById('focus-duration') as HTMLInputElement | null;
        const shortInput = document.getElementById('short-break-duration') as HTMLInputElement | null;
        const longInput = document.getElementById('long-break-duration') as HTMLInputElement | null;
        const sessionsInput = document.getElementById('sessions-count') as HTMLInputElement | null;

        const newSettings: PomodoroSettings = {
            focusDuration: focusInput ? parseInt(focusInput.value, 10) || settings.focusDuration : settings.focusDuration,
            shortBreakDuration: shortInput ? parseInt(shortInput.value, 10) || settings.shortBreakDuration : settings.shortBreakDuration,
            longBreakDuration: longInput ? parseInt(longInput.value, 10) || settings.longBreakDuration : settings.longBreakDuration,
            sessionsBeforeLongBreak: sessionsInput ? parseInt(sessionsInput.value, 10) || settings.sessionsBeforeLongBreak : settings.sessionsBeforeLongBreak
        };
        onSave(newSettings);
    };

    return (
        <form className="pomodoro-settings-form" onSubmit={handleSubmit}>
            <div className="settings-field">
                <label htmlFor="focus-duration">Focus Duration (min):</label>
                <input type="number" id="focus-duration" min={1} max={120} defaultValue={settings.focusDuration} />
            </div>
            <div className="settings-field">
                <label htmlFor="short-break-duration">Short Break (min):</label>
                <input type="number" id="short-break-duration" min={1} max={60} defaultValue={settings.shortBreakDuration} />
            </div>
            <div className="settings-field">
                <label htmlFor="long-break-duration">Long Break (min):</label>
                <input type="number" id="long-break-duration" min={1} max={60} defaultValue={settings.longBreakDuration} />
            </div>
            <div className="settings-field">
                <label htmlFor="sessions-count">Sessions Before Long Break:</label>
                <input type="number" id="sessions-count" min={1} max={12} defaultValue={settings.sessionsBeforeLongBreak} />
            </div>
            <button type="submit" id="save-settings-btn" className="btn btn-primary">
                Save Settings
            </button>
        </form>
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

    /**
     * Initializes default Pomodoro timer properties and settings defaults.
     */
    constructor() {
        this.settings = { ...DEFAULT_POMODORO_SETTINGS };

        this.state = 'idle';
        this.phase = 'focus';
        this.currentSession = 1;
        this.timeRemaining = 0;
        this.totalTime = 0;
        this.targetEndTime = null;
        this.intervalId = null;

        this.todaySessions = 0;
        this.todayFocusMinutes = 0;
    }

    /**
     * Initializes timer by loading persistent settings and state from storage,
     * registering storage change listeners, and syncing visual indicators.
     * @listens chrome.storage.local
     * @listens chrome.storage.onChanged
     */
    init(): void {
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

                        const startBtn = document.getElementById('start-btn');
                        const pauseBtn = document.getElementById('pause-btn');
                        if (startBtn) startBtn.style.display = 'flex';
                        if (pauseBtn) pauseBtn.style.display = 'none';
                        document.querySelector('.timer-ring-svg')?.classList.remove('running');
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
                
                const startBtn = document.getElementById('start-btn');
                const pauseBtn = document.getElementById('pause-btn');
                if (startBtn) startBtn.style.display = 'flex';
                if (pauseBtn) pauseBtn.style.display = 'none';
                document.querySelector('.timer-ring-svg')?.classList.remove('running');
                document.body.className = '';
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
    bindEvents(): void {
        try {
            document.getElementById('start-btn')?.addEventListener('click', () => {
                try {
                    this.start();
                } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error in start button click handler', err);
        }
            });
            document.getElementById('pause-btn')?.addEventListener('click', () => {
                try {
                    this.pause();
                } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error in pause button click handler', err);
        }
            });
            document.getElementById('reset-btn')?.addEventListener('click', () => {
                try {
                    this.reset();
                } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error in reset button click handler', err);
        }
            });
            document.getElementById('skip-btn')?.addEventListener('click', () => {
                try {
                    this.skip();
                } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error in skip button click handler', err);
        }
            });
            document.getElementById('save-settings-btn')?.addEventListener('click', () => {
                try {
                    this.saveSettings();
                } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error in save settings button click handler', err);
        }
            });
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error binding pomodoro events', err);
        }
    }

    /**
     * Populates settings modal input fields with values from `this.settings`.
     */
    loadSettingsUI(): void {
        try {
            const focusInput = document.getElementById('focus-duration') as HTMLInputElement | null;
            const shortInput = document.getElementById('short-break-duration') as HTMLInputElement | null;
            const longInput = document.getElementById('long-break-duration') as HTMLInputElement | null;
            const sessionsInput = document.getElementById('sessions-count') as HTMLInputElement | null;

            if (focusInput) focusInput.value = String(this.settings.focusDuration);
            if (shortInput) shortInput.value = String(this.settings.shortBreakDuration);
            if (longInput) longInput.value = String(this.settings.longBreakDuration);
            if (sessionsInput) sessionsInput.value = String(this.settings.sessionsBeforeLongBreak);
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error loading settings UI', err);
        }
    }

    /**
     * Reads updated durations from settings modal inputs and persists them to storage.
     * @fires chrome.storage.local.set
     */
    saveSettings(): void {
        try {
            const focusInput = document.getElementById('focus-duration') as HTMLInputElement | null;
            const shortInput = document.getElementById('short-break-duration') as HTMLInputElement | null;
            const longInput = document.getElementById('long-break-duration') as HTMLInputElement | null;
            const sessionsInput = document.getElementById('sessions-count') as HTMLInputElement | null;

            const focusDuration = parseInt(focusInput?.value || '25', 10) || 25;
            const shortBreakDuration = parseInt(shortInput?.value || '5', 10) || 5;
            const longBreakDuration = parseInt(longInput?.value || '15', 10) || 15;
            const sessionsBeforeLongBreak = parseInt(sessionsInput?.value || '4', 10) || 4;

            this.settings = { focusDuration, shortBreakDuration, longBreakDuration, sessionsBeforeLongBreak };

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
            this.resetState();
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
            
            const startBtn = document.getElementById('start-btn');
            const pauseBtn = document.getElementById('pause-btn');
            if (startBtn) startBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'flex';
            document.querySelector('.timer-ring-svg')?.classList.add('running');
            document.body.className = this.phase === 'focus' ? 'phase-focus' : 'phase-break';

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
    updateDisplay(): void {
        try {
            const minutes = Math.floor(this.timeRemaining / 60);
            const seconds = this.timeRemaining % 60;
            const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            const timerTimeEl = document.getElementById('timer-time');
            if (timerTimeEl) timerTimeEl.textContent = timeStr;
            document.title = `${timeStr} — AlgoRecall Pomodoro`;
            
            const labels: Record<string, string> = { focus: 'Focus Time', shortBreak: 'Short Break', longBreak: 'Long Break' };
            const phaseLabelEl = document.getElementById('timer-phase-label');
            if (phaseLabelEl) phaseLabelEl.textContent = labels[this.phase] || 'Focus Time';
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error updating timer display', err, { timeRemaining: this.timeRemaining });
        }
    }

    /**
     * Updates strokeDashoffset on the SVG countdown ring based on elapsed time ratio.
     */
    updateRing(): void {
        try {
            const ring = document.getElementById('timer-ring-fill');
            if (!ring) return;

            const circumference = 2 * Math.PI * 88;
            const progress = this.totalTime > 0 ? (this.totalTime - this.timeRemaining) / this.totalTime : 0;
            const offset = circumference - (progress * circumference);

            ring.setAttribute('stroke-dasharray', String(circumference));
            ring.setAttribute('stroke-dashoffset', String(offset));

            if (this.phase === 'focus') {
                ring.classList.remove('break-ring');
            } else {
                ring.classList.add('break-ring');
            }
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error updating SVG progress ring', err);
        }
    }

    /**
     * Highlights the active phase pill ('focus', 'shortBreak', or 'longBreak').
     */
    updatePhaseIndicator(): void {
        try {
            const pills: Record<string, HTMLElement | null> = {
                'focus': document.getElementById('phase-focus'),
                'shortBreak': document.getElementById('phase-short-break'),
                'longBreak': document.getElementById('phase-long-break')
            };

            Object.entries(pills).forEach(([phase, el]) => {
                if (!el) return;
                el.classList.remove('active', 'break-active');
                if (phase === this.phase) {
                    el.classList.add('active');
                    if (phase !== 'focus') el.classList.add('break-active');
                }
            });
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error updating phase indicator pills', err, { phase: this.phase });
        }
    }

    /**
     * Updates cycle progress dots indicating how many sessions have been completed.
     */
    updateSessionDots(): void {
        try {
            const dotsContainer = document.getElementById('session-dots');
            const sessionText = document.getElementById('session-text');
            if (!dotsContainer) return;

            const total = this.settings.sessionsBeforeLongBreak;
            let html = '';
            for (let i = 1; i <= total; i++) {
                let cls = 'session-dot';
                if (i < this.currentSession) cls += ' complete';
                else if (i === this.currentSession) cls += ' active';
                html += `<div class="${cls}"></div>`;
            }
            dotsContainer.innerHTML = html;

            if (sessionText) {
                sessionText.textContent = `${this.currentSession} of ${total}`;
            }
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error updating session dots', err, { currentSession: this.currentSession });
        }
    }

    /**
     * Formats and updates the daily completed sessions and focus time stat labels.
     */
    updateTodayStats(): void {
        try {
            const sessionsEl = document.getElementById('today-sessions');
            const focusEl = document.getElementById('today-focus-time');

            if (sessionsEl) sessionsEl.textContent = String(this.todaySessions);
            if (focusEl) {
                if (this.todayFocusMinutes >= 60) {
                    const hours = Math.floor(this.todayFocusMinutes / 60);
                    const mins = this.todayFocusMinutes % 60;
                    focusEl.textContent = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
                } else {
                    focusEl.textContent = `${this.todayFocusMinutes}m`;
                }
            }
        } catch (err) {
            UIUtils.catchError('PomodoroTimer', 'Error updating today stats UI', err, { todaySessions: this.todaySessions, todayFocusMinutes: this.todayFocusMinutes });
        }
    }
}

/**
 * Initializes Pomodoro controller and attaches to global window scope on DOM load.
 */
function initPomodoro(): void {
    try {
        const win = window as unknown as { pomodoro?: PomodoroTimer };
        win.pomodoro = new PomodoroTimer();
        win.pomodoro.init();
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
    (module.exports as any).PomodoroTimer = PomodoroTimer;
    (module.exports as any).initPomodoro = initPomodoro;
}
