/**
 * @file tests/unit/features/dashboard/studyplan/StudyPlanComponents.test.tsx
 * @description Unit tests for Preact components in the Exam Study Plan feature.
 */

import { h, render } from 'preact';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
    StudyPlanSetupPanel,
    StudyPlanCountdownRing,
    StudyPlanActivePanel,
    StudyPlanScheduleTable,
    StudyPlanApp,
    StudyPlanController
} from '../../../../../features/dashboard/studyplan/studyplan';

describe('StudyPlan Preact Components', () => {
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

    describe('StudyPlanSetupPanel', () => {
        it('renders inputs, preview values, and handles activation button click', () => {
            const onActivate = jest.fn();
            const onExamDateChange = jest.fn();
            const onDailyLimitChange = jest.fn();

            render(
                <StudyPlanSetupPanel
                    examDateMin="2026-08-02"
                    daysLeft={10}
                    totalCards={50}
                    dailyTarget={5}
                    showPreview={true}
                    onExamDateChange={onExamDateChange}
                    onDailyLimitChange={onDailyLimitChange}
                    onActivate={onActivate}
                />,
                container
            );

            expect(container.querySelector('#preview-days')?.textContent).toBe('10');
            expect(container.querySelector('#preview-total')?.textContent).toBe('50');
            expect(container.querySelector('#preview-daily')?.textContent).toBe('5');

            const btn = container.querySelector('#activate-btn') as HTMLButtonElement;
            expect(btn.disabled).toBe(false);
            btn.click();
            expect(onActivate).toHaveBeenCalled();
        });

        it('disables activate button when showPreview is false', () => {
            render(
                <StudyPlanSetupPanel
                    examDateMin="2026-08-02"
                    daysLeft={0}
                    totalCards={0}
                    dailyTarget={0}
                    showPreview={false}
                    onExamDateChange={jest.fn()}
                    onDailyLimitChange={jest.fn()}
                    onActivate={jest.fn()}
                />,
                container
            );

            const btn = container.querySelector('#activate-btn') as HTMLButtonElement;
            expect(btn.disabled).toBe(true);
        });
    });

    describe('StudyPlanCountdownRing', () => {
        it('renders remaining days, deadline date, and urgency ring classes', () => {
            render(
                <StudyPlanCountdownRing
                    daysLeft={2}
                    progress={0.8}
                    title="Exam Countdown"
                    examDateFormatted="Monday, August 10, 2026"
                />,
                container
            );

            expect(container.querySelector('#countdown-days')?.textContent).toBe('2');
            expect(container.querySelector('#countdown-title')?.textContent).toBe('Exam Countdown');
            expect(container.querySelector('#countdown-exam-date')?.textContent).toBe('Monday, August 10, 2026');
            expect(container.querySelector('#countdown-ring-fill')?.classList.contains('urgent')).toBe(true);
        });
    });

    describe('StudyPlanActivePanel', () => {
        it('renders active stats cards and handles deactivate click', () => {
            const onDeactivate = jest.fn();

            render(
                <StudyPlanActivePanel
                    totalCards={100}
                    dailyTarget={10}
                    completedCards={25}
                    daysLeft={10}
                    progress={0.25}
                    title="Exam Countdown"
                    examDateFormatted="August 10, 2026"
                    onDeactivate={onDeactivate}
                />,
                container
            );

            expect(container.querySelector('#active-total-cards')?.textContent).toBe('100');
            expect(container.querySelector('#active-daily-target')?.textContent).toBe('10');
            expect(container.querySelector('#active-completed')?.textContent).toBe('25');

            const deactBtn = container.querySelector('#deactivate-btn') as HTMLButtonElement;
            deactBtn.click();
            expect(onDeactivate).toHaveBeenCalled();
        });
    });

    describe('StudyPlanScheduleTable', () => {
        it('renders schedule rows with badges and highlights', () => {
            const rows = [
                { dayIndex: 1, dateFormatted: 'Sat, Aug 1', cardsCount: 10, status: 'Done' as const, isToday: false, isPast: true },
                { dayIndex: 2, dateFormatted: 'Sun, Aug 2', cardsCount: 10, status: 'Today' as const, isToday: true, isPast: false },
                { dayIndex: 3, dateFormatted: 'Mon, Aug 3', cardsCount: 10, status: 'Upcoming' as const, isToday: false, isPast: false }
            ];

            render(<StudyPlanScheduleTable rows={rows} />, container);

            const trs = container.querySelectorAll('tbody tr');
            expect(trs.length).toBe(3);
            expect(trs[0].classList.contains('past-row')).toBe(true);
            expect(trs[1].classList.contains('today-row')).toBe(true);
            expect(container.querySelector('.badge-today')?.textContent).toBe('Today');
            expect(container.querySelector('.badge-complete')?.textContent).toBe('Done');
        });
    });

    describe('StudyPlanApp', () => {
        it('renders SetupPanel when exam mode is inactive', () => {
            const controller = new StudyPlanController();
            controller.settings = null;

            render(<StudyPlanApp controller={controller} />, container);

            expect(container.querySelector('.algorecall-brand-name')?.textContent).toBe('AlgoRecall');
            expect(container.querySelector('h1')?.textContent).toContain('Exam Countdown Mode');
            expect(container.querySelector('#setup-panel')).not.toBeNull();
            expect(container.querySelector('#active-panel')).toBeNull();
        });

        it('renders ActivePanel when exam mode is active', () => {
            const controller = new StudyPlanController();
            controller.settings = {
                isActive: true,
                examDate: '2026-12-31',
                dailyTarget: 5,
                activatedAt: Date.now() - 86400000
            };
            controller.allCards = [
                { id: 'c1', due: Date.now() + 86400000 } as any
            ];

            render(<StudyPlanApp controller={controller} />, container);

            expect(container.querySelector('#setup-panel')).toBeNull();
            expect(container.querySelector('#active-panel')).not.toBeNull();
            expect(container.querySelector('#active-daily-target')?.textContent).toBe('5');
        });

        it('GAP-025: caps preview total by dailyLimit and resets examDate/dailyLimit on deactivate', async () => {
            const controller = new StudyPlanController();
            controller.settings = null;
            controller.allCards = Array.from({ length: 100 }, (_, i) => ({
                id: `c-${i}`,
                due: Date.now()
            })) as any;

            const futureDate = new Date(Date.now() + 5 * 86400000);
            const futureIso = futureDate.toISOString().split('T')[0];

            render(<StudyPlanApp controller={controller} />, container);

            const dateInput = container.querySelector('#exam-date-input') as HTMLInputElement;
            dateInput.value = futureIso;
            dateInput.dispatchEvent(new Event('change', { bubbles: true }));

            const limitInput = container.querySelector('#daily-limit-input') as HTMLInputElement;
            limitInput.value = '5';
            limitInput.dispatchEvent(new Event('input', { bubbles: true }));

            await Promise.resolve();

            const days = parseInt(container.querySelector('#preview-days')?.textContent || '0', 10);
            expect(days).toBeGreaterThan(0);
            expect(container.querySelector('#preview-daily')?.textContent).toBe('5');
            expect(container.querySelector('#preview-total')?.textContent).toBe(String(5 * days));

            // Simulate activation then deactivation
            controller.settings = {
                isActive: true,
                examDate: futureIso,
                dailyTarget: 5,
                activatedAt: Date.now()
            };
            controller.onUpdate?.();
            await Promise.resolve();

            expect(container.querySelector('#active-panel')).not.toBeNull();

            controller.deactivateExamMode = jest.fn(() => {
                controller.settings = null;
                controller.onUpdate?.();
            });
            (container.querySelector('#deactivate-btn') as HTMLButtonElement).click();
            await Promise.resolve();

            const activateBtn = container.querySelector('#activate-btn') as HTMLButtonElement;
            expect(activateBtn).not.toBeNull();
            expect(activateBtn.disabled).toBe(true);
        });
    });
});

