/**
 * @file tests/unit/features/dashboard/pomodoro/PomodoroComponents.test.tsx
 * @description Unit tests for Preact UI components in the Pomodoro feature.
 */

import { h, render } from 'preact';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
    PomodoroPhaseTabs,
    PomodoroTimerRing,
    PomodoroSessionProgress,
    PomodoroStatsDisplay,
    PomodoroControls,
    PomodoroSettingsForm,
    PomodoroApp,
    PomodoroTimer
} from '../../../../../features/dashboard/pomodoro/pomodoro';

describe('Pomodoro Preact Components', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
        document.body.innerHTML = '';
    });

    describe('PomodoroPhaseTabs', () => {
        it('renders focus tab as active when phase is focus', () => {
            const onSelect = jest.fn();
            render(<PomodoroPhaseTabs phase="focus" onSelectPhase={onSelect} />, container);

            const focusTab = container.querySelector('#phase-focus');
            const shortBreakTab = container.querySelector('#phase-short-break');
            expect(focusTab?.classList.contains('active')).toBe(true);
            expect(shortBreakTab?.classList.contains('active')).toBe(false);

            (focusTab as HTMLElement).click();
            expect(onSelect).toHaveBeenCalledWith('focus');
        });

        it('triggers onSelectPhase when clicking shortBreak and longBreak tabs', () => {
            const onSelect = jest.fn();
            render(<PomodoroPhaseTabs phase="shortBreak" onSelectPhase={onSelect} />, container);

            const shortBreakTab = container.querySelector('#phase-short-break') as HTMLElement;
            const longBreakTab = container.querySelector('#phase-long-break') as HTMLElement;
            expect(shortBreakTab.classList.contains('active')).toBe(true);

            longBreakTab.click();
            expect(onSelect).toHaveBeenCalledWith('longBreak');
        });
    });

    describe('PomodoroTimerRing', () => {
        it('renders formatted timer text and phase label', () => {
            render(
                <PomodoroTimerRing
                    timeRemaining={1500}
                    totalTime={1500}
                    phaseLabel="Focus Time"
                    phase="focus"
                />,
                container
            );

            expect(container.querySelector('#timer-time')?.textContent).toBe('25:00');
            expect(container.querySelector('#timer-phase-label')?.textContent).toBe('Focus Time');
            expect(container.querySelector('#timer-ring-fill')?.classList.contains('break-ring')).toBe(false);
        });

        it('applies break-ring class for break phases', () => {
            render(
                <PomodoroTimerRing
                    timeRemaining={300}
                    totalTime={300}
                    phaseLabel="Short Break"
                    phase="shortBreak"
                />,
                container
            );

            expect(container.querySelector('#timer-time')?.textContent).toBe('05:00');
            expect(container.querySelector('#timer-ring-fill')?.classList.contains('break-ring')).toBe(true);
        });
    });

    describe('PomodoroSessionProgress', () => {
        it('renders correct number of session dots and labels', () => {
            render(<PomodoroSessionProgress currentSession={2} totalSessions={4} />, container);

            const dots = container.querySelectorAll('.session-dot');
            expect(dots.length).toBe(4);
            expect(dots[0].classList.contains('complete')).toBe(true);
            expect(dots[1].classList.contains('active')).toBe(true);
            expect(dots[2].classList.contains('complete')).toBe(false);
            expect(container.querySelector('#session-text')?.textContent).toContain('2 of 4');
        });
    });

    describe('PomodoroStatsDisplay', () => {
        it('renders formatted session count and focus minutes (< 60m)', () => {
            render(<PomodoroStatsDisplay todaySessions={3} todayFocusMinutes={45} />, container);

            expect(container.querySelector('#today-sessions')?.textContent).toBe('3');
            expect(container.querySelector('#today-focus-time')?.textContent).toBe('45m');
        });

        it('formats hours and minutes when focus time >= 60m', () => {
            render(<PomodoroStatsDisplay todaySessions={5} todayFocusMinutes={150} />, container);

            expect(container.querySelector('#today-focus-time')?.textContent).toBe('2h 30m');
        });
    });

    describe('PomodoroControls', () => {
        it('renders controls and responds to callbacks', () => {
            const onStart = jest.fn();
            const onPause = jest.fn();
            const onReset = jest.fn();
            const onSkip = jest.fn();

            render(
                <PomodoroControls
                    state="idle"
                    onStart={onStart}
                    onPause={onPause}
                    onReset={onReset}
                    onSkip={onSkip}
                />,
                container
            );

            const startBtn = container.querySelector('#start-btn') as HTMLElement;
            const pauseBtn = container.querySelector('#pause-btn') as HTMLElement;
            expect(startBtn.style.display).not.toBe('none');
            expect(pauseBtn.style.display).toBe('none');

            startBtn.click();
            expect(onStart).toHaveBeenCalled();

            (container.querySelector('#reset-btn') as HTMLElement).click();
            expect(onReset).toHaveBeenCalled();

            (container.querySelector('#skip-btn') as HTMLElement).click();
            expect(onSkip).toHaveBeenCalled();
        });
    });

    describe('PomodoroSettingsForm', () => {
        it('renders settings inputs and submits modified values', () => {
            const onSave = jest.fn();
            const settings = {
                focusDuration: 25,
                shortBreakDuration: 5,
                longBreakDuration: 15,
                sessionsBeforeLongBreak: 4
            };

            render(<PomodoroSettingsForm settings={settings} onSave={onSave} />, container);

            const focusInput = container.querySelector('#focus-duration') as HTMLInputElement;
            expect(focusInput.value).toBe('25');

            focusInput.value = '30';
            const form = container.querySelector('.pomodoro-settings-form') as HTMLFormElement;
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

            expect(onSave).toHaveBeenCalledWith({
                focusDuration: 30,
                shortBreakDuration: 5,
                longBreakDuration: 15,
                sessionsBeforeLongBreak: 4
            });
        });
    });

    describe('PomodoroApp & PomodoroTimer parity (GAP-008, GAP-033)', () => {
        const flushEffects = () => new Promise((resolve) => setTimeout(resolve, 20));

        it('GAP-008: updates document.title with live countdown and start() resets 0 & starts visual interval', async () => {
            const timer = new PomodoroTimer();
            timer.initialized = true;
            timer.timeRemaining = 0;
            timer.todayFocusMinutes = 60;
            const intervalSpy = jest.spyOn(timer, 'startVisualInterval');

            render(<PomodoroApp timer={timer} />, container);
            await flushEffects();
            expect(document.title).toBe('00:00 — AlgoRecall Pomodoro');

            timer.start();
            expect(timer.timeRemaining).toBe(timer.settings.focusDuration * 60);
            expect(intervalSpy).toHaveBeenCalled();

            timer.stopVisualInterval();
        });

        it('GAP-033: formats 60m as 1h and allows clearing number input without snapping to 1', async () => {
            const timer = new PomodoroTimer();
            timer.initialized = true;
            timer.todayFocusMinutes = 60;
            const saveSpy = jest.spyOn(timer, 'saveSettings').mockImplementation(() => {});

            render(<PomodoroApp timer={timer} />, container);
            await flushEffects();
            expect(container.querySelector('#today-focus-time')?.textContent).toBe('1h');

            const focusInput = container.querySelector('#focus-duration') as HTMLInputElement;
            focusInput.value = '';
            focusInput.dispatchEvent(new Event('input', { bubbles: true }));
            await flushEffects();

            expect(focusInput.value).toBe('');

            (container.querySelector('#save-settings-btn') as HTMLButtonElement).click();
            expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({
                focusDuration: timer.settings.focusDuration
            }));
        });
    });
});

