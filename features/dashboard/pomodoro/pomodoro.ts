/**
 * @file features/dashboard/pomodoro/pomodoro.ts
 * @description Pomodoro Study Timer UI controller.
 * Syncs visually with the background service worker which handles the true timer state.
 */

import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { StorageData } from '../../../types/domain';

export interface PomodoroSettings {
    focusDuration: number;
    shortBreakDuration: number;
    longBreakDuration: number;
    sessionsBeforeLongBreak: number;
}

export interface PomodoroState {
    state: 'idle' | 'running' | 'paused';
    phase: 'focus' | 'shortBreak' | 'longBreak';
    currentSession: number;
    timeRemaining: number;
    totalTime: number;
    targetEndTime: number | null;
}

export interface PomodoroStats {
    sessionsToday?: number;
    focusMinutesToday?: number;
    lastDate?: string;
}

export class PomodoroTimer {
    settings: PomodoroSettings;
    state: 'idle' | 'running' | 'paused';
    phase: 'focus' | 'shortBreak' | 'longBreak';
    currentSession: number;
    timeRemaining: number;
    totalTime: number;
    targetEndTime: number | null;
    intervalId: ReturnType<typeof setInterval> | null;
    todaySessions: number;
    todayFocusMinutes: number;

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
