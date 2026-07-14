/**
 * @file features/dashboard/pomodoro/pomodoro.js
 * @description Pomodoro Study Timer controller.
 * Manages focus/break cycles with configurable durations,
 * session tracking, and notification alerts on phase completion.
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
        this.intervalId = null;

        // Today's stats
        this.todaySessions = 0;
        this.todayFocusMinutes = 0;
    }

    init() {
        chrome.storage.local.get(['pomodoroSettings', 'pomodoroStats'], (result) => {
            if (result.pomodoroSettings) {
                Object.assign(this.settings, result.pomodoroSettings);
            }

            // Load today's stats
            const stats = result.pomodoroStats || {};
            const todayKey = this.getTodayKey();
            if (stats[todayKey]) {
                this.todaySessions = stats[todayKey].sessions || 0;
                this.todayFocusMinutes = stats[todayKey].focusMinutes || 0;
            }

            this.loadSettingsUI();
            this.resetTimer();
            this.updateTodayStats();
            this.bindEvents();
        });
    }

    getTodayKey() {
        const d = new Date();
        return new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }

    bindEvents() {
        document.getElementById('start-btn')?.addEventListener('click', () => this.start());
        document.getElementById('pause-btn')?.addEventListener('click', () => this.pause());
        document.getElementById('reset-btn')?.addEventListener('click', () => this.reset());
        document.getElementById('skip-btn')?.addEventListener('click', () => this.skip());
        document.getElementById('save-settings-btn')?.addEventListener('click', () => this.saveSettings());
    }

    /**
     * Loads saved settings into the settings form inputs.
     */
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

    /**
     * Saves the settings from form inputs to storage.
     */
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

    /**
     * Gets the duration in minutes for the current phase.
     */
    getPhaseDuration() {
        switch (this.phase) {
            case 'focus': return this.settings.focusDuration;
            case 'shortBreak': return this.settings.shortBreakDuration;
            case 'longBreak': return this.settings.longBreakDuration;
            default: return this.settings.focusDuration;
        }
    }

    /**
     * Resets the timer to the beginning of the current phase.
     */
    resetTimer() {
        this.totalTime = this.getPhaseDuration() * 60;
        this.timeRemaining = this.totalTime;
        this.updateDisplay();
        this.updateRing();
        this.updatePhaseIndicator();
        this.updateSessionDots();
    }

    /**
     * Starts or resumes the timer.
     */
    start() {
        if (this.state === 'running') return;

        this.state = 'running';
        document.getElementById('start-btn').style.display = 'none';
        document.getElementById('pause-btn').style.display = 'flex';
        document.querySelector('.timer-ring-svg')?.classList.add('running');
        document.body.className = this.phase === 'focus' ? 'phase-focus' : 'phase-break';

        this.intervalId = setInterval(() => {
            this.timeRemaining--;

            if (this.timeRemaining <= 0) {
                this.onPhaseComplete();
                return;
            }

            this.updateDisplay();
            this.updateRing();
        }, 1000);
    }

    /**
     * Pauses the timer.
     */
    pause() {
        if (this.state !== 'running') return;

        this.state = 'paused';
        clearInterval(this.intervalId);
        this.intervalId = null;

        document.getElementById('start-btn').style.display = 'flex';
        document.getElementById('pause-btn').style.display = 'none';
        document.querySelector('.timer-ring-svg')?.classList.remove('running');
    }

    /**
     * Resets the timer completely, going back to focus phase session 1.
     */
    reset() {
        this.state = 'idle';
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.phase = 'focus';
        this.currentSession = 1;

        document.getElementById('start-btn').style.display = 'flex';
        document.getElementById('pause-btn').style.display = 'none';
        document.querySelector('.timer-ring-svg')?.classList.remove('running');
        document.body.className = '';

        this.resetTimer();
    }

    /**
     * Skips to the next phase.
     */
    skip() {
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.state = 'idle';

        document.getElementById('start-btn').style.display = 'flex';
        document.getElementById('pause-btn').style.display = 'none';
        document.querySelector('.timer-ring-svg')?.classList.remove('running');

        this.advancePhase();
        this.resetTimer();
    }

    /**
     * Called when the current phase timer reaches zero.
     */
    onPhaseComplete() {
        clearInterval(this.intervalId);
        this.intervalId = null;
        this.state = 'idle';

        document.getElementById('start-btn').style.display = 'flex';
        document.getElementById('pause-btn').style.display = 'none';
        document.querySelector('.timer-ring-svg')?.classList.remove('running');

        // Track completed focus sessions
        if (this.phase === 'focus') {
            this.todaySessions++;
            this.todayFocusMinutes += this.settings.focusDuration;
            this.saveTodayStats();
            this.updateTodayStats();
        }

        // Send notification
        this.sendNotification();

        // Advance to next phase
        this.advancePhase();
        this.resetTimer();
    }

    /**
     * Advances to the next timer phase.
     */
    advancePhase() {
        if (this.phase === 'focus') {
            // After focus: check if long break is due
            if (this.currentSession >= this.settings.sessionsBeforeLongBreak) {
                this.phase = 'longBreak';
            } else {
                this.phase = 'shortBreak';
            }
        } else {
            // After any break: advance session and go to focus
            if (this.phase === 'longBreak') {
                this.currentSession = 1;
            } else {
                this.currentSession++;
            }
            this.phase = 'focus';
        }
    }

    /**
     * Updates the time display (MM:SS format).
     */
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

    /**
     * Updates the SVG ring progress indicator.
     */
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

    /**
     * Updates the phase indicator pill tabs.
     */
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

    /**
     * Updates the session dot indicators.
     */
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

    /**
     * Sends a notification when a phase completes.
     */
    sendNotification() {
        const isBreakPhase = this.phase !== 'focus'; // We already advanced, so check opposite
        const title = isBreakPhase ? '⏰ Break Time!' : '🎯 Focus Time!';
        const message = isBreakPhase
            ? `Great work! Take a ${this.getPhaseDuration()}-minute break.`
            : 'Break is over. Time to focus!';

        // Try chrome notification API
        if (chrome.notifications) {
            chrome.notifications.create(`pomodoro-${Date.now()}`, {
                type: 'basic',
                iconUrl: chrome.runtime.getURL('icons/icon.png'),
                title: title,
                message: message,
                priority: 2
            });
        }
    }

    /**
     * Updates the today's stats display.
     */
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

    /**
     * Persists today's session stats to storage.
     */
    saveTodayStats() {
        const todayKey = this.getTodayKey();
        chrome.storage.local.get(['pomodoroStats'], (result) => {
            const stats = result.pomodoroStats || {};
            stats[todayKey] = {
                sessions: this.todaySessions,
                focusMinutes: this.todayFocusMinutes
            };
            chrome.storage.local.set({ pomodoroStats: stats });
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const timer = new PomodoroTimer();
    timer.init();
});
