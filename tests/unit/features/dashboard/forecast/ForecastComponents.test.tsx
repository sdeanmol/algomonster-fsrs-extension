/**
 * @file tests/unit/features/dashboard/forecast/ForecastComponents.test.tsx
 * @description Unit tests for Preact components in the Review Forecast feature.
 */

import { h, render } from 'preact';
import {
    ForecastMetricsHeader,
    ForecastCalendarCell,
    ForecastCalendar,
    ForecastChart
} from '../../../../../features/dashboard/forecast/forecast';

describe('Forecast Preact Components', () => {
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

    describe('ForecastMetricsHeader', () => {
        it('renders workload summary tiles and subtitle', () => {
            render(
                <ForecastMetricsHeader
                    totalUpcoming={42}
                    avgPerDay="1.4"
                    peakCount={8}
                    todayCount={5}
                    subtitle="10 total cards · Next 30 days"
                />,
                container
            );

            expect(container.querySelector('#forecast-subtitle')?.textContent).toBe('10 total cards · Next 30 days');
            expect(container.querySelector('#forecast-today')?.textContent).toBe('5');
            expect(container.querySelector('#forecast-total')?.textContent).toBe('42');
            expect(container.querySelector('#forecast-avg')?.textContent).toBe('1.4');
            expect(container.querySelector('#forecast-peak')?.textContent).toBe('8');
        });
    });

    describe('ForecastCalendarCell', () => {
        it('renders day number, count pill, level class, and responds to click', () => {
            const onClick = jest.fn();
            render(
                <ForecastCalendarCell
                    dayNumber={15}
                    count={4}
                    isToday={true}
                    level={2}
                    title="Jan 15: 4 cards due"
                    onClick={onClick}
                />,
                container
            );

            const cell = container.querySelector('.cal-cell') as HTMLElement;
            expect(cell.classList.contains('cal-today')).toBe(true);
            expect(cell.classList.contains('cal-level-2')).toBe(true);
            expect(container.querySelector('.cal-day')?.textContent).toBe('15');
            expect(container.querySelector('.cal-count')?.textContent).toBe('4');

            cell.click();
            expect(onClick).toHaveBeenCalled();
        });

        it('does not trigger onClick when count is 0', () => {
            const onClick = jest.fn();
            render(
                <ForecastCalendarCell
                    dayNumber={16}
                    count={0}
                    isToday={false}
                    level={0}
                    title="Jan 16: 0 cards due"
                    onClick={onClick}
                />,
                container
            );

            const cell = container.querySelector('.cal-cell') as HTMLElement;
            cell.click();
            expect(onClick).not.toHaveBeenCalled();
        });
    });

    describe('ForecastCalendar', () => {
        it('renders headers, empty offset cells, cells, and legend', () => {
            const cells = [
                { dayNumber: 1, count: 2, isToday: true, level: 1 as const, title: 'Day 1' },
                { dayNumber: 2, count: 0, isToday: false, level: 0 as const, title: 'Day 2' }
            ];

            render(<ForecastCalendar startDow={2} cells={cells} />, container);

            expect(container.querySelectorAll('.cal-header').length).toBe(7);
            expect(container.querySelectorAll('.cal-empty').length).toBe(2);
            expect(container.querySelectorAll('.cal-cell:not(.cal-empty)').length).toBe(2);
            expect(container.querySelector('.cal-legend')).not.toBeNull();
        });
    });

    describe('ForecastChart', () => {
        it('renders workload bar columns with tooltips and labels', () => {
            const onBarClick = jest.fn();
            const dataPoints = [
                { index: 0, label: 'Today', value: 3, displayDate: 'Today', level: 2, onClick: onBarClick },
                { index: 1, label: '', value: 0, displayDate: 'Tomorrow', level: 0 }
            ];

            render(<ForecastChart dataPoints={dataPoints} maxLimit={5} />, container);

            const cols = container.querySelectorAll('.chart-bar-col');
            expect(cols.length).toBe(2);

            (cols[0] as HTMLElement).click();
            expect(onBarClick).toHaveBeenCalled();
        });
    });
});

