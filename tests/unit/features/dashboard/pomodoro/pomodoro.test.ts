import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { PomodoroTimer, PomodoroState, PomodoroSettings, PomodoroStats } from '../../../../../features/dashboard/pomodoro/pomodoro';

describe('PomodoroTimer', () => {
  let timer: PomodoroTimer;

  const getFreshSettings = (): PomodoroSettings => ({
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsBeforeLongBreak: 4
  });

  const getFreshState = (): PomodoroState => ({
    state: 'idle',
    phase: 'focus',
    currentSession: 1,
    timeRemaining: 1500,
    totalTime: 1500,
    targetEndTime: null
  });

  const getFreshStats = (): PomodoroStats => ({
    sessionsToday: 3,
    focusMinutesToday: 75,
    lastDate: new Date().toLocaleDateString()
  });

  beforeEach(() => {
    delete (chrome.runtime as any).lastError;
    jest.useFakeTimers();

    document.body.innerHTML = `
      <div class="timer-ring-svg"></div>
      <circle id="timer-ring-fill"></circle>
      <span id="timer-time">25:00</span>
      <span id="timer-phase-label">Focus Time</span>

      <span id="phase-focus"></span>
      <span id="phase-short-break"></span>
      <span id="phase-long-break"></span>

      <div id="session-dots"></div>
      <span id="session-text"></span>

      <span id="today-sessions">0</span>
      <span id="today-focus-time">0m</span>

      <button id="start-btn">Start</button>
      <button id="pause-btn" style="display: none;">Pause</button>
      <button id="reset-btn">Reset</button>
      <button id="skip-btn">Skip</button>
      <button id="save-settings-btn">Save</button>

      <input id="focus-duration" value="25" />
      <input id="short-break-duration" value="5" />
      <input id="long-break-duration" value="15" />
      <input id="sessions-count" value="4" />
    `;

    (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
      const result = {
        pomodoroSettings: getFreshSettings(),
        pomodoroState: getFreshState(),
        pomodoroStats: getFreshStats()
      };
      if (cb) cb(result);
      return Promise.resolve(result);
    });

    (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
      if (cb) cb();
      return Promise.resolve();
    });

    (chrome as any).runtime = {
      sendMessage: jest.fn(),
      lastError: undefined
    };

    (chrome.storage as any).onChanged = {
      addListener: jest.fn()
    };

    timer = new PomodoroTimer();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    delete (chrome.runtime as any).lastError;
  });

  describe('init and storage loading', () => {
    it('initializes timer with settings, stats, and state from storage', () => {
      timer.init();

      expect(chrome.storage.local.get).toHaveBeenCalled();
      const timeEl = document.getElementById('timer-time');
      expect(timeEl?.textContent).toBe('25:00');
    });

    it('handles running state on init and starts visual interval', () => {
      const runningState = getFreshState();
      runningState.state = 'running';
      runningState.targetEndTime = Date.now() + 100000;

      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb({ pomodoroSettings: getFreshSettings(), pomodoroState: runningState });
      });

      timer.init();
      expect(timer.state).toBe('running');
    });

    it('handles chrome.runtime.lastError when reading storage during init', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Read error' };
        if (cb) cb({});
      });

      expect(() => timer.init()).not.toThrow();
    });

    it('handles storage onChanged listener events for state and stats', () => {
      let listener: any;
      (chrome.storage.onChanged.addListener as jest.Mock).mockImplementation((fn: any) => {
        listener = fn;
      });

      timer.init();
      expect(listener).toBeDefined();

      // Trigger state change to idle
      listener({ pomodoroState: { newValue: getFreshState() } }, 'local');
      expect(timer.state).toBe('idle');

      // Trigger state change to running
      const runningState = getFreshState();
      runningState.state = 'running';
      runningState.targetEndTime = Date.now() + 10000;
      listener({ pomodoroState: { newValue: runningState } }, 'local');
      expect(timer.state).toBe('running');

      // Trigger stats change
      listener({ pomodoroStats: { newValue: getFreshStats() } }, 'local');
      expect(timer.todaySessions).toBe(3);
    });

    it('handles exceptions in storage change handler gracefully', () => {
      let listener: any;
      (chrome.storage.onChanged.addListener as jest.Mock).mockImplementation((fn: any) => {
        listener = fn;
      });

      timer.init();
      Object.defineProperty(timer, 'syncState', {
        value: () => { throw new Error('Sync exception'); }
      });

      expect(() => listener({ pomodoroState: { newValue: getFreshState() } }, 'local')).not.toThrow();
    });

    it('handles exceptions in init callback gracefully', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation((keys: any, cb?: any) => {
        if (cb) cb({ pomodoroState: 'corrupted' });
      });

      expect(() => timer.init()).not.toThrow();
    });

    it('handles outer storage get error in init', () => {
      (chrome.storage.local.get as jest.Mock).mockImplementation(() => {
        throw new Error('Outer storage error');
      });

      expect(() => timer.init()).not.toThrow();
    });
  });

  describe('timer operations: start, pause, reset, skip', () => {
    it('starts timer and handles chrome.runtime.lastError in set callback', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Start set error' };
        if (cb) cb();
      });

      timer.timeRemaining = 1500;
      timer.start();

      expect(timer.state).toBe('running');
      expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    });

    it('does nothing if start is called when timer is already running', () => {
      timer.state = 'running';
      timer.start();
      expect(chrome.runtime.sendMessage).not.toThrow();
    });

    it('pauses timer and handles chrome.runtime.lastError in set callback', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Pause set error' };
        if (cb) cb();
      });

      timer.state = 'running';
      timer.targetEndTime = Date.now() + 60000;
      timer.pause();

      expect(timer.state).toBe('paused');
    });

    it('does nothing if pause is called when timer is not running', () => {
      timer.state = 'idle';
      timer.pause();
      expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('resets timer state to default idle focus phase and handles lastError', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Reset set error' };
        if (cb) cb();
      });

      timer.state = 'running';
      timer.currentSession = 3;
      timer.reset();

      expect(timer.state).toBe('idle');
      expect(timer.phase).toBe('focus');
    });

    it('skips from focus to short break, then focus to long break, and handles lastError', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Skip set error' };
        if (cb) cb();
      });

      timer.phase = 'focus';
      timer.currentSession = 1;
      timer.skip();
      expect(timer.phase).toBe('shortBreak');

      timer.skip(); // back to focus
      expect(timer.phase).toBe('focus');
      expect(timer.currentSession).toBe(2);

      timer.currentSession = 4;
      timer.skip(); // 4th focus session -> longBreak
      expect(timer.phase).toBe('longBreak');

      timer.skip(); // back to focus with reset session count
      expect(timer.phase).toBe('focus');
      expect(timer.currentSession).toBe(1);
    });

    it('handles default phase duration fallback when phase is unknown', () => {
      (timer as any).phase = 'unknown_phase';
      expect(timer.getPhaseDuration()).toBe(25);
    });

    it('handles getStateObj exception fallback', () => {
      Object.defineProperty(timer, 'state', {
        get: () => { throw new Error('State getter error'); }
      });
      const fallback = timer.getStateObj();
      expect(fallback.state).toBe('idle');
    });

    it('handles exceptions in start, pause, reset, skip catch blocks', () => {
      Object.defineProperty(timer, 'getStateObj', {
        value: () => { throw new Error('State obj error'); }
      });

      expect(() => timer.start()).not.toThrow();
      expect(() => timer.pause()).not.toThrow();
      expect(() => timer.reset()).not.toThrow();
      expect(() => timer.skip()).not.toThrow();
    });
  });

  describe('settings management and UI syncing', () => {
    it('loads settings into inputs and saves modified settings', () => {
      timer.loadSettingsUI();
      const focusInput = document.getElementById('focus-duration') as HTMLInputElement;
      expect(focusInput.value).toBe('25');

      focusInput.value = '30';
      timer.saveSettings();

      expect(timer.settings.focusDuration).toBe(30);
      expect(chrome.storage.local.set).toHaveBeenCalled();
    });

    it('handles lastError and callback errors when saving settings', () => {
      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        (chrome.runtime as any).lastError = { message: 'Save error' };
        if (cb) cb();
      });
      expect(() => timer.saveSettings()).not.toThrow();

      (chrome.storage.local.set as jest.Mock).mockImplementation((data: any, cb?: any) => {
        if (cb) {
          timer.reset = () => { throw new Error('Reset error in callback'); };
          cb();
        }
      });
      expect(() => timer.saveSettings()).not.toThrow();
    });
  });

  describe('display, ring, and stats updates and internal error paths', () => {
    it('updates today stats with minutes and hours formatting', () => {
      timer.todayFocusMinutes = 45;
      timer.updateTodayStats();
      const focusEl = document.getElementById('today-focus-time');
      expect(focusEl?.textContent).toBe('45m');

      timer.todayFocusMinutes = 150;
      timer.updateTodayStats();
      expect(focusEl?.textContent).toBe('2h 30m');

      timer.todayFocusMinutes = 120;
      timer.updateTodayStats();
      expect(focusEl?.textContent).toBe('2h');
    });

    it('updates SVG progress ring for focus vs break phases', () => {
      timer.totalTime = 1500;
      timer.timeRemaining = 750;
      timer.phase = 'focus';
      timer.updateRing();

      const ring = document.getElementById('timer-ring-fill');
      expect(ring?.classList.contains('break-ring')).toBe(false);

      timer.phase = 'shortBreak';
      timer.updateRing();
      expect(ring?.classList.contains('break-ring')).toBe(true);

      timer.phase = 'longBreak';
      timer.updateRing();
      expect(ring?.classList.contains('break-ring')).toBe(true);
    });

    it('triggers tick intervals and handles errors inside tick callback', () => {
      timer.state = 'running';
      timer.targetEndTime = Date.now() + 10000;

      // Force exception inside tick callback
      timer.updateDisplay = () => { throw new Error('Tick update display error'); };
      timer.startVisualInterval();

      expect(() => jest.advanceTimersByTime(2000)).not.toThrow();
    });

    it('handles error paths across internal UI updates', () => {
      const origGEBI = document.getElementById;
      document.getElementById = () => { throw new Error('GEBI error'); };

      expect(() => timer.updateDisplay()).not.toThrow();
      expect(() => timer.updateRing()).not.toThrow();
      expect(() => timer.updatePhaseIndicator()).not.toThrow();
      expect(() => timer.updateSessionDots()).not.toThrow();
      expect(() => timer.updateTodayStats()).not.toThrow();
      expect(() => timer.loadSettingsUI()).not.toThrow();
      expect(() => timer.bindEvents()).not.toThrow();

      document.getElementById = origGEBI;
    });

    it('triggers button clicks via event listeners and handles exceptions in handlers', () => {
      timer.init();

      document.getElementById('start-btn')?.click();
      expect(timer.state).toBe('running');

      document.getElementById('pause-btn')?.click();
      expect(timer.state).toBe('paused');

      document.getElementById('reset-btn')?.click();
      expect(timer.state).toBe('idle');

      document.getElementById('skip-btn')?.click();
      expect(timer.phase).toBe('shortBreak');

      document.getElementById('save-settings-btn')?.click();
      expect(chrome.storage.local.set).toHaveBeenCalled();

      // Trigger exception handlers inside event listeners
      timer.start = () => { throw new Error('Start error'); };
      timer.pause = () => { throw new Error('Pause error'); };
      timer.reset = () => { throw new Error('Reset error'); };
      timer.skip = () => { throw new Error('Skip error'); };
      timer.saveSettings = () => { throw new Error('Save error'); };

      expect(() => document.getElementById('start-btn')?.click()).not.toThrow();
      expect(() => document.getElementById('pause-btn')?.click()).not.toThrow();
      expect(() => document.getElementById('reset-btn')?.click()).not.toThrow();
      expect(() => document.getElementById('skip-btn')?.click()).not.toThrow();
      expect(() => document.getElementById('save-settings-btn')?.click()).not.toThrow();
    });
  });
});
