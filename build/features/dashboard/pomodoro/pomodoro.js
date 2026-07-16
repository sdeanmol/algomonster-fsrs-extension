/**
 * @file features/dashboard/pomodoro/pomodoro.js
 * @description Pomodoro Study Timer UI controller.
 * Syncs visually with the background service worker which handles the true timer state.
 */
class PomodoroTimer {
    constructor() {
        this.settings = {
            focusDuration: 25,
            shortBreakDuration: 5,
            longBreakDuration: 15,
            sessionsBeforeLongBreak: 4
        };

        this.state = 'idle'; // 'idle' | 'running' | 'paused'
        this.phase = 'focus'; // 'focus' | 'shortBreak' | 'longBreak'
        this.currentSession = 1;
        this.timeRemaining = 0; // seconds
        this.totalTime = 0; // seconds for current phase
        this.targetEndTime = null;
        this.intervalId = null;

        // Today's stats
        this.todaySessions = 0;
        this.todayFocusMinutes = 0;
    }

    init() {
        chrome.storage.local.get(['pomodoroSettings', 'pomodoroStats', 'pomodoroState'], (result) => {
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

            // Load today's stats
            const stats = result.pomodoroStats || {};
            if (stats.lastDate === new Date().toLocaleDateString()) {
                this.todaySessions = stats.sessionsToday || 0;
                this.todayFocusMinutes = stats.focusMinutesToday || 0;
            }

            this.loadSettingsUI();
            this.updateTodayStats();
            this.bindEvents();
            
            // Re-sync UI timer visually
            if (this.state === 'running') {
                this.startVisualInterval();
            } else {
                this.updateDisplay();
                this.updateRing();
                this.updatePhaseIndicator();
                this.updateSessionDots();
                
                document.getElementById('start-btn').style.display = 'flex';
                document.getElementById('pause-btn').style.display = 'none';
                document.querySelector('.timer-ring-svg')?.classList.remove('running');
                document.body.className = '';
            }
        });
        
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area === 'local' && changes.pomodoroState) {
                this.syncState(changes.pomodoroState.newValue);
            }
            if (area === 'local' && changes.pomodoroStats) {
                const stats = changes.pomodoroStats.newValue;
                if (stats && stats.lastDate === new Date().toLocaleDateString()) {
                    this.todaySessions = stats.sessionsToday || 0;
                    this.todayFocusMinutes = stats.focusMinutesToday || 0;
                    this.updateTodayStats();
                }
            }
        });
    }

    resetState() {
        this.state = 'idle';
        this.phase = 'focus';
        this.currentSession = 1;
        this.totalTime = this.getPhaseDuration() * 60;
        this.timeRemaining = this.totalTime;
        this.targetEndTime = null;
    }

    getStateObj() {
        return {
            state: this.state,
            phase: this.phase,
            currentSession: this.currentSession,
            timeRemaining: this.timeRemaining,
            totalTime: this.totalTime,
            targetEndTime: this.targetEndTime
        };
    }

    syncState(newState) {
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
            
            document.getElementById('start-btn').style.display = 'flex';
            document.getElementById('pause-btn').style.display = 'none';
            document.querySelector('.timer-ring-svg')?.classList.remove('running');
            document.body.className = '';
        } else {
            this.startVisualInterval();
        }
        
        this.updatePhaseIndicator();
        this.updateSessionDots();
    }

    bindEvents() {
        document.getElementById('start-btn')?.addEventListener('click', () => this.start());
        document.getElementById('pause-btn')?.addEventListener('click', () => this.pause());
        document.getElementById('reset-btn')?.addEventListener('click', () => this.reset());
        document.getElementById('skip-btn')?.addEventListener('click', () => this.skip());
        document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());
    }

    loadSettingsUI() {
        const focusInput = document.getElementById('focus-duration');
        const shortInput = document.getElementById('short-break-duration');
        const longInput = document.getElementById('long-break-duration');
        const sessionsInput = document.getElementById('sessions-count');

        if (focusInput) focusInput.value = this.settings.focusDuration;
        if (shortInput) shortInput.value = this.settings.shortBreakDuration;
        if (longInput) longInput.value = this.settings.longBreakDuration;
        if (sessionsInput) sessionsInput.value = this.settings.sessionsBeforeLongBreak;
    }

    saveSettings() {
        const focusDuration = parseInt(document.getElementById('focus-duration')?.value) || 25;
        const shortBreakDuration = parseInt(document.getElementById('short-break-duration')?.value) || 5;
        const longBreakDuration = parseInt(document.getElementById('long-break-duration')?.value) || 15;
        const sessionsBeforeLongBreak = parseInt(document.getElementById('sessions-count')?.value) || 4;

        this.settings = { focusDuration, shortBreakDuration, longBreakDuration, sessionsBeforeLongBreak };

        chrome.storage.local.set({ pomodoroSettings: this.settings }, () => {
            this.reset();
        });
    }

    getPhaseDuration() {
        switch (this.phase) {
            case 'focus': return this.settings.focusDuration;
            case 'shortBreak': return this.settings.shortBreakDuration;
            case 'longBreak': return this.settings.longBreakDuration;
            default: return this.settings.focusDuration;
        }
    }

    start() {
        if (this.state === 'running') return;
        this.state = 'running';
        this.targetEndTime = Date.now() + (this.timeRemaining * 1000);
        
        const stateObj = this.getStateObj();
        chrome.storage.local.set({ pomodoroState: stateObj });
        chrome.runtime.sendMessage({ action: 'pomodoro_action', payload: { command: 'start', state: stateObj } });
    }

    pause() {
        if (this.state !== 'running') return;
        
        this.state = 'paused';
        if (this.targetEndTime) {
            this.timeRemaining = Math.max(0, Math.ceil((this.targetEndTime - Date.now()) / 1000));
        }
        
        const stateObj = this.getStateObj();
        chrome.storage.local.set({ pomodoroState: stateObj });
        chrome.runtime.sendMessage({ action: 'pomodoro_action', payload: { command: 'pause', state: stateObj } });
    }

    reset() {
        this.resetState();
        const stateObj = this.getStateObj();
        chrome.storage.local.set({ pomodoroState: stateObj });
        chrome.runtime.sendMessage({ action: 'pomodoro_action', payload: { command: 'reset', state: stateObj } });
    }

    skip() {
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
        chrome.storage.local.set({ pomodoroState: stateObj });
        chrome.runtime.sendMessage({ action: 'pomodoro_action', payload: { command: 'skip', state: stateObj } });
    }

    startVisualInterval() {
        this.stopVisualInterval();
        
        document.getElementById('start-btn').style.display = 'none';
        document.getElementById('pause-btn').style.display = 'flex';
        document.querySelector('.timer-ring-svg')?.classList.add('running');
        document.body.className = this.phase === 'focus' ? 'phase-focus' : 'phase-break';

        const tick = () => {
            if (this.state !== 'running') return this.stopVisualInterval();
            this.timeRemaining = Math.max(0, Math.ceil((this.targetEndTime - Date.now()) / 1000));
            this.updateDisplay();
            this.updateRing();
        };
        
        tick();
        this.intervalId = setInterval(tick, 1000);
        this.updatePhaseIndicator();
        this.updateSessionDots();
    }
    
    stopVisualInterval() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    updateDisplay() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

        document.getElementById('timer-time').textContent = timeStr;
        document.title = `${timeStr} — AlgoRecall Pomodoro`;
        
        // Phase label
        const labels = { focus: 'Focus Time', shortBreak: 'Short Break', longBreak: 'Long Break' };
        document.getElementById('timer-phase-label').textContent = labels[this.phase] || 'Focus Time';
    }

    updateRing() {
        const ring = document.getElementById('timer-ring-fill');
        if (!ring) return;

        const circumference = 2 * Math.PI * 88;
        const progress = this.totalTime > 0 ? (this.totalTime - this.timeRemaining) / this.totalTime : 0;
        const offset = circumference - (progress * circumference);

        ring.setAttribute('stroke-dasharray', circumference);
        ring.setAttribute('stroke-dashoffset', offset);

        // Color by phase
        if (this.phase === 'focus') {
            ring.classList.remove('break-ring');
        } else {
            ring.classList.add('break-ring');
        }
    }

    updatePhaseIndicator() {
        const pills = {
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

    updateSessionDots() {
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

    updateTodayStats() {
        const sessionsEl = document.getElementById('today-sessions');
        const focusEl = document.getElementById('today-focus-time');

        if (sessionsEl) sessionsEl.textContent = this.todaySessions;
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

document.addEventListener('DOMContentLoaded', () => {
    window.pomodoro = new PomodoroTimer();
    window.pomodoro.init();
});
