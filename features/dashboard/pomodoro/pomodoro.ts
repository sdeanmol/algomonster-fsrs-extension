/**
 * @file features/dashboard/pomodoro/pomodoro.ts
 * @description Controller for the dedicated Pomodoro focus timer dashboard.
 * Manages interval countdowns, visual progress rings, phase shifts (Focus, Short Break, Long Break),
 * background service worker synchronizations, and daily focus statistics.
 *
 * Architecture Role: Pomodoro Focus Timer Standalone Page Controller.
 * Context: Extension Standalone Tab (`features/dashboard/pomodoro/pomodoro.html`).
 * Key Exports:
 * - {@link PomodoroTimer}: Primary controller class managing the focus timer lifecycle and UI.
 */

import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { CatchAndLog, CatchAndReturn, withErrorHandling } from '../../../decorators';
import { StorageData } from '../../../types/domain';

/**
 * Persisted user configuration for timer durations and cycle counts.
 */
export interface PomodoroSettings {
    /** Length of a focus session in minutes. */
    focusDuration: number;
    /** Length of a short break in minutes. */
    shortBreakDuration: number;
    /** Length of a long break in minutes. */
    longBreakDuration: number;
    /** Number of focus sessions required before triggering a long break. */
    sessionsBeforeLongBreak: number;
}

/**
 * Historical statistics tracking focus volume and completed sessions.
 */
export interface PomodoroStats {
    /** Date string (`YYYY-MM-DD` or locale) for which the daily statistics apply. */
    lastDate?: string;
    /** Number of focus sessions successfully completed today. */
    sessionsToday?: number;
    /** Total focus time accumulated today in minutes. */
    focusMinutesToday?: number;
}

/**
 * Active timer execution state synchronized across popup and background worker.
 */
export interface PomodoroState {
    /** Operational status of the timer: 'idle', 'running', or 'paused'. */
    state: 'idle' | 'running' | 'paused';
    /** Current timer mode: 'focus', 'shortBreak', or 'longBreak'. */
    phase: 'focus' | 'shortBreak' | 'longBreak';
    /** Index of the current focus session within the active cycle (1-based). */
    currentSession: number;
    /** Remaining seconds in the current phase countdown. */
    timeRemaining: number;
    /** Total duration in seconds of the current phase. */
    totalTime: number;
    /** Epoch timestamp in milliseconds when the active countdown will reach 0. */
    targetEndTime: number | null;
}

/**
 * Controller class for the Pomodoro focus timer dashboard.
 * Coordinates timer states, animates SVG progress rings, manages storage persistence,
 * and exchanges IPC messages with the background alarm scheduler.
 */
export class PomodoroTimer {
    /** Active timer duration and session count settings. */
    settings: PomodoroSettings;
    /** Current operational timer status. */
    state: 'idle' | 'running' | 'paused';
    /** Current operational phase mode. */
    phase: 'focus' | 'shortBreak' | 'longBreak';
    /** Active focus session sequence counter. */
    currentSession: number;
    /** Seconds remaining in active countdown. */
    timeRemaining: number;
    /** Full duration in seconds of current countdown. */
    totalTime: number;
    /** Target completion timestamp in ms. */
    targetEndTime: number | null;
    /** Window interval identifier for the 1-second visual render loop. */
    intervalId: NodeJS.Timeout | null = null;
    /** Number of focus sessions completed today. */
    todaySessions: number;
    /** Total focus minutes accumulated today. */
    todayFocusMinutes: number;

    /**
     * Initializes default timer settings (25m focus, 5m short break, 15m long break).
     */
    constructor() {
        this.settings = {
            focusDuration: 25,
            shortBreakDuration: 5,
            longBreakDuration: 15,
            sessionsBeforeLongBreak: 4
        };
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
    @CatchAndLog('PomodoroTimer', 'Failed to fetch storage in Pomodoro init')
    init(): void {
        chrome.storage.local.get(['pomodoroSettings', 'pomodoroStats', 'pomodoroState'], withErrorHandling((result: StorageData & {
            pomodoroSettings?: PomodoroSettings;
            pomodoroStats?: PomodoroStats;
            pomodoroState?: PomodoroState;
        }) => {
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

            chrome.storage.onChanged.addListener(withErrorHandling((changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
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
            }, 'PomodoroTimer', 'Error handling storage change event'));
        }, 'PomodoroTimer', 'Error during pomodoro dashboard init'));
    }

    /**
     * Resets internal countdown and session state back to default focus phase.
     */
    @CatchAndLog('PomodoroTimer', 'Error resetting pomodoro state')
    resetState(): void {
        this.state = 'idle';
        this.phase = 'focus';
        this.currentSession = 1;
        this.totalTime = this.getPhaseDuration() * 60;
        this.timeRemaining = this.totalTime;
        this.targetEndTime = null;
    }

    /**
     * Generates a serializable snapshot of the current timer execution state.
     * @returns Serializable {@link PomodoroState} object.
     */
    @CatchAndReturn({
        state: 'idle',
        phase: 'focus',
        currentSession: 1,
        timeRemaining: 0,
        totalTime: 0,
        targetEndTime: null
    }, 'PomodoroTimer', 'Error getting state object')
    getStateObj(): PomodoroState {
        return {
            state: this.state,
            phase: this.phase,
            currentSession: this.currentSession,
            timeRemaining: this.timeRemaining,
            totalTime: this.totalTime,
            targetEndTime: this.targetEndTime
        };
    }

    /**
     * Synchronizes local UI timer properties with incoming background state updates.
     * @param newState - New PomodoroState received from storage or message event.
     */
    @CatchAndLog('PomodoroTimer', 'Error syncing state')
    syncState(newState: PomodoroState | undefined): void {
        if (!newState) return;
        this.state = newState.state;
        this.phase = newState.phase;
        this.currentSession = newState.currentSession;
        this.timeRemaining = newState.timeRemaining;
        this.totalTime = newState.totalTime;
        this.targetEndTime = newState.targetEndTime;

        this.updateDisplay();
        this.updateRing();
        this.updatePhaseIndicator();
        this.updateSessionDots();

        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');

        if (this.state === 'running') {
            if (startBtn) startBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'flex';
            document.querySelector('.timer-ring-svg')?.classList.add('running');
            this.startVisualInterval();
        } else {
            if (startBtn) startBtn.style.display = 'flex';
            if (pauseBtn) pauseBtn.style.display = 'none';
            document.querySelector('.timer-ring-svg')?.classList.remove('running');
            this.stopVisualInterval();
        }
    }

    /**
     * Refreshes active timer state by fetching latest `pomodoroState` snapshot from storage.
     * @fires chrome.storage.local.get
     */
    @CatchAndLog('PomodoroTimer', 'Error syncing from storage')
    syncFromStorage(): void {
        chrome.storage.local.get('pomodoroState', (result: { pomodoroState?: PomodoroState }) => {
            if (result.pomodoroState) {
                this.syncState(result.pomodoroState);
            }
        });
    }

    /**
     * Binds click handlers to Start, Pause, Reset, Skip, and Settings buttons.
     */
    @CatchAndLog('PomodoroTimer', 'Error binding pomodoro events')
    bindEvents(): void {
        document.getElementById('start-btn')?.addEventListener('click', withErrorHandling(() => {
            this.start();
        }, 'PomodoroTimer', 'Error in start button click handler'));

        document.getElementById('pause-btn')?.addEventListener('click', withErrorHandling(() => {
            this.pause();
        }, 'PomodoroTimer', 'Error in pause button click handler'));

        document.getElementById('reset-btn')?.addEventListener('click', withErrorHandling(() => {
            this.reset();
        }, 'PomodoroTimer', 'Error in reset button click handler'));

        document.getElementById('skip-btn')?.addEventListener('click', withErrorHandling(() => {
            this.skip();
        }, 'PomodoroTimer', 'Error in skip button click handler'));

        document.getElementById('save-settings-btn')?.addEventListener('click', withErrorHandling(() => {
            this.saveSettings();
        }, 'PomodoroTimer', 'Error in save settings button click handler'));
    }

    /**
     * Populates settings modal input fields with values from `this.settings`.
     */
    @CatchAndLog('PomodoroTimer', 'Error loading settings UI')
    loadSettingsUI(): void {
        const focusInput = document.getElementById('focus-duration') as HTMLInputElement | null;
        const shortInput = document.getElementById('short-break-duration') as HTMLInputElement | null;
        const longInput = document.getElementById('long-break-duration') as HTMLInputElement | null;
        const sessionsInput = document.getElementById('sessions-count') as HTMLInputElement | null;

        if (focusInput) focusInput.value = String(this.settings.focusDuration);
        if (shortInput) shortInput.value = String(this.settings.shortBreakDuration);
        if (longInput) longInput.value = String(this.settings.longBreakDuration);
        if (sessionsInput) sessionsInput.value = String(this.settings.sessionsBeforeLongBreak);
    }

    /**
     * Reads updated durations from settings modal inputs and persists them to storage.
     * @fires chrome.storage.local.set
     */
    @CatchAndLog('PomodoroTimer', 'Error saving pomodoro settings')
    saveSettings(): void {
        const focusInput = document.getElementById('focus-duration') as HTMLInputElement | null;
        const shortInput = document.getElementById('short-break-duration') as HTMLInputElement | null;
        const longInput = document.getElementById('long-break-duration') as HTMLInputElement | null;
        const sessionsInput = document.getElementById('sessions-count') as HTMLInputElement | null;

        const focusDuration = parseInt(focusInput?.value || '25', 10) || 25;
        const shortBreakDuration = parseInt(shortInput?.value || '5', 10) || 5;
        const longBreakDuration = parseInt(longInput?.value || '15', 10) || 15;
        const sessionsBeforeLongBreak = parseInt(sessionsInput?.value || '4', 10) || 4;

        this.settings = { focusDuration, shortBreakDuration, longBreakDuration, sessionsBeforeLongBreak };

        chrome.storage.local.set({ pomodoroSettings: this.settings }, withErrorHandling(() => {
            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
            if (lastError) {
                const errorMessage = lastError.message || String(lastError);
                Logger.error('PomodoroTimer', `Storage error saving pomodoroSettings: ${errorMessage}`, { error: lastError });
                return;
            }
            this.reset();
        }, 'PomodoroTimer', 'Error in storage set callback for saveSettings'));
    }

    /**
     * Resolves the configured duration in minutes for the active phase.
     * @returns Phase length in minutes.
     */
    @CatchAndReturn(25, 'PomodoroTimer', 'Error getting phase duration')
    getPhaseDuration(): number {
        switch (this.phase) {
            case 'focus': return this.settings.focusDuration;
            case 'shortBreak': return this.settings.shortBreakDuration;
            case 'longBreak': return this.settings.longBreakDuration;
            default: return this.settings.focusDuration;
        }
    }

    /**
     * Starts or resumes the Pomodoro countdown timer.
     * @fires chrome.storage.local.set
     * @fires chrome.runtime.sendMessage
     */
    @CatchAndLog('PomodoroTimer', 'Error starting pomodoro timer')
    start(): void {
        if (this.state === 'running') return;

        this.state = 'running';
        if (this.timeRemaining === 0) {
            this.totalTime = this.getPhaseDuration() * 60;
            this.timeRemaining = this.totalTime;
        }
        this.targetEndTime = Date.now() + (this.timeRemaining * 1000);

        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'flex';
        document.querySelector('.timer-ring-svg')?.classList.add('running');

        this.startVisualInterval();

        chrome.storage.local.set({ pomodoroState: this.getStateObj() }, () => {
            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
            if (lastError) {
                const errorMessage = lastError.message || String(lastError);
                Logger.error('PomodoroTimer', `Storage error saving pomodoroState on start: ${errorMessage}`, { error: lastError });
            }
        });

        chrome.runtime.sendMessage({
            action: 'startPomodoro',
            phase: this.phase,
            duration: this.timeRemaining
        }, () => {
            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
            if (lastError) {
                const errorMessage = lastError.message || String(lastError);
                Logger.error('PomodoroTimer', `Message error on startPomodoro: ${errorMessage}`, { error: lastError });
            }
        });
    }

    /**
     * Pauses the active countdown and preserves remaining time.
     * @fires chrome.storage.local.set
     * @fires chrome.runtime.sendMessage
     */
    @CatchAndLog('PomodoroTimer', 'Error pausing pomodoro timer')
    pause(): void {
        if (this.state !== 'running') return;

        this.state = 'paused';
        this.targetEndTime = null;
        this.stopVisualInterval();

        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');
        if (startBtn) startBtn.style.display = 'flex';
        if (pauseBtn) pauseBtn.style.display = 'none';
        document.querySelector('.timer-ring-svg')?.classList.remove('running');

        chrome.storage.local.set({ pomodoroState: this.getStateObj() }, () => {
            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
            if (lastError) {
                const errorMessage = lastError.message || String(lastError);
                Logger.error('PomodoroTimer', `Storage error saving pomodoroState on pause: ${errorMessage}`, { error: lastError });
            }
        });

        chrome.runtime.sendMessage({ action: 'pausePomodoro' }, () => {
            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
            if (lastError) {
                const errorMessage = lastError.message || String(lastError);
                Logger.error('PomodoroTimer', `Message error on pausePomodoro: ${errorMessage}`, { error: lastError });
            }
        });
    }

    /**
     * Resets active countdown back to start of current phase and halts timer.
     * @fires chrome.storage.local.set
     * @fires chrome.runtime.sendMessage
     */
    @CatchAndLog('PomodoroTimer', 'Error resetting pomodoro timer')
    reset(): void {
        this.state = 'idle';
        this.totalTime = this.getPhaseDuration() * 60;
        this.timeRemaining = this.totalTime;
        this.targetEndTime = null;
        this.stopVisualInterval();

        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');
        if (startBtn) startBtn.style.display = 'flex';
        if (pauseBtn) pauseBtn.style.display = 'none';
        document.querySelector('.timer-ring-svg')?.classList.remove('running');

        this.updateDisplay();
        this.updateRing();

        chrome.storage.local.set({ pomodoroState: this.getStateObj() }, () => {
            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
            if (lastError) {
                const errorMessage = lastError.message || String(lastError);
                Logger.error('PomodoroTimer', `Storage error saving pomodoroState on reset: ${errorMessage}`, { error: lastError });
            }
        });

        chrome.runtime.sendMessage({ action: 'resetPomodoro' }, () => {
            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
            if (lastError) {
                const errorMessage = lastError.message || String(lastError);
                Logger.error('PomodoroTimer', `Message error on resetPomodoro: ${errorMessage}`, { error: lastError });
            }
        });
    }

    /**
     * Advances to the next phase in the cycle immediately without waiting for timer expiration.
     * @fires chrome.storage.local.set
     * @fires chrome.runtime.sendMessage
     */
    @CatchAndLog('PomodoroTimer', 'Error skipping pomodoro phase')
    skip(): void {
        if (this.phase === 'focus') {
            if (this.currentSession % this.settings.sessionsBeforeLongBreak === 0) {
                this.phase = 'longBreak';
            } else {
                this.phase = 'shortBreak';
            }
        } else {
            this.phase = 'focus';
            if (this.currentSession >= this.settings.sessionsBeforeLongBreak) {
                this.currentSession = 1;
            } else {
                this.currentSession++;
            }
        }

        this.state = 'idle';
        this.totalTime = this.getPhaseDuration() * 60;
        this.timeRemaining = this.totalTime;
        this.targetEndTime = null;
        this.stopVisualInterval();

        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');
        if (startBtn) startBtn.style.display = 'flex';
        if (pauseBtn) pauseBtn.style.display = 'none';
        document.querySelector('.timer-ring-svg')?.classList.remove('running');

        this.updateDisplay();
        this.updateRing();
        this.updatePhaseIndicator();
        this.updateSessionDots();

        chrome.storage.local.set({ pomodoroState: this.getStateObj() }, () => {
            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
            if (lastError) {
                const errorMessage = lastError.message || String(lastError);
                Logger.error('PomodoroTimer', `Storage error saving pomodoroState on skip: ${errorMessage}`, { error: lastError });
            }
        });

        chrome.runtime.sendMessage({ action: 'skipPomodoro' }, () => {
            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
            if (lastError) {
                const errorMessage = lastError.message || String(lastError);
                Logger.error('PomodoroTimer', `Message error on skipPomodoro: ${errorMessage}`, { error: lastError });
            }
        });
    }

    /**
     * Starts 1-second interval loop updating the clock display and SVG ring.
     */
    @CatchAndLog('PomodoroTimer', 'Error starting visual interval')
    startVisualInterval(): void {
        this.stopVisualInterval();
        
        const startBtn = document.getElementById('start-btn');
        const pauseBtn = document.getElementById('pause-btn');
        if (startBtn) startBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'flex';
        document.querySelector('.timer-ring-svg')?.classList.add('running');
        document.body.className = this.phase === 'focus' ? 'phase-focus' : 'phase-break';

        const tick = withErrorHandling(() => {
            if (this.state !== 'running') return this.stopVisualInterval();
            if (this.targetEndTime) {
                this.timeRemaining = Math.max(0, Math.ceil((this.targetEndTime - Date.now()) / 1000));
            }
            this.updateDisplay();
            this.updateRing();
        }, 'PomodoroTimer', 'Error in visual timer tick');
        
        tick();
        this.intervalId = setInterval(tick, 1000);
        this.updatePhaseIndicator();
        this.updateSessionDots();
    }
    
    /**
     * Stops and clears the 1-second visual timer update interval.
     */
    @CatchAndLog('PomodoroTimer', 'Error stopping visual interval')
    stopVisualInterval(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Updates the main digital clock text (MM:SS) and window title.
     */
    @CatchAndLog('PomodoroTimer', 'Error updating timer display')
    updateDisplay(): void {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        const timerTimeEl = document.getElementById('timer-time');
        if (timerTimeEl) timerTimeEl.textContent = timeStr;
        document.title = `${timeStr} — AlgoRecall Pomodoro`;
        
        const labels: Record<string, string> = { focus: 'Focus Time', shortBreak: 'Short Break', longBreak: 'Long Break' };
        const phaseLabelEl = document.getElementById('timer-phase-label');
        if (phaseLabelEl) phaseLabelEl.textContent = labels[this.phase] || 'Focus Time';
    }

    /**
     * Updates strokeDashoffset on the SVG countdown ring based on elapsed time ratio.
     */
    @CatchAndLog('PomodoroTimer', 'Error updating SVG progress ring')
    updateRing(): void {
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
    }

    /**
     * Highlights the active phase pill ('focus', 'shortBreak', or 'longBreak').
     */
    @CatchAndLog('PomodoroTimer', 'Error updating phase indicator pills')
    updatePhaseIndicator(): void {
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
    }

    /**
     * Updates cycle progress dots indicating how many sessions have been completed.
     */
    @CatchAndLog('PomodoroTimer', 'Error updating session dots')
    updateSessionDots(): void {
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
    }

    /**
     * Formats and updates the daily completed sessions and focus time stat labels.
     */
    @CatchAndLog('PomodoroTimer', 'Error updating today stats')
    updateTodayStats(): void {
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
    }
}

/**
 * Initializes Pomodoro controller and attaches to global window scope on DOM load.
 */
const initPomodoro = withErrorHandling((): void => {
    const win = window as unknown as { pomodoro?: PomodoroTimer };
    win.pomodoro = new PomodoroTimer();
    win.pomodoro.init();
}, 'PomodoroTimer', 'Initialization failed');

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPomodoro);
    } else {
        initPomodoro();
    }
}
