/**
 * @file tests/unit/features/dashboard/history/HistoryComponents.test.tsx
 * @description Unit tests for Preact components in the Review History feature.
 */

import { h, render } from 'preact';
import {
    HistoryViewToggle,
    HistoryBreadcrumb,
    HistorySummaryCard,
    HistoryBarChart
} from '../../../../../features/dashboard/history/history';

describe('History Preact Components', () => {
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

    describe('HistoryViewToggle', () => {
        it('renders view toggle buttons and marks active view', () => {
            const onChange = jest.fn();
            render(<HistoryViewToggle currentView="month" onViewChange={onChange} />, container);

            expect(container.querySelector('#view-month')?.classList.contains('active')).toBe(true);
            expect(container.querySelector('#view-year')?.classList.contains('active')).toBe(false);

            (container.querySelector('#view-year') as HTMLElement).click();
            expect(onChange).toHaveBeenCalledWith('year');
        });
    });

    describe('HistoryBreadcrumb', () => {
        it('renders "All Years" for year view', () => {
            render(<HistoryBreadcrumb currentView="year" selectedYear={null} selectedMonth={null} />, container);
            expect(container.querySelector('#breadcrumb')?.textContent).toBe('All Years');
        });

        it('renders year link and selected month for day view', () => {
            const onNavigateYear = jest.fn();
            const onNavigateMonth = jest.fn();

            render(
                <HistoryBreadcrumb
                    currentView="day"
                    selectedYear="2026"
                    selectedMonth="2026-08"
                    onNavigateYear={onNavigateYear}
                    onNavigateMonth={onNavigateMonth}
                />,
                container
            );

            expect(container.querySelector('#breadcrumb')?.textContent).toContain('2026');
            expect(container.querySelector('#breadcrumb')?.textContent).toContain('August');

            (container.querySelector('.bc-year') as HTMLElement).click();
            expect(onNavigateYear).toHaveBeenCalled();

            (container.querySelector('.bc-month') as HTMLElement).click();
            expect(onNavigateMonth).toHaveBeenCalledWith('2026');
        });
    });

    describe('HistorySummaryCard', () => {
        it('renders year card with title, values, and button', () => {
            const onCardClick = jest.fn();
            const onViewCards = jest.fn();

            render(
                <HistorySummaryCard
                    type="year"
                    title="2026"
                    value={120}
                    subtitle="Patterns Reviewed"
                    activeDays={25}
                    year="2026"
                    onCardClick={onCardClick}
                    onViewCards={onViewCards}
                />,
                container
            );

            expect(container.querySelector('.card-title')?.textContent).toBe('2026');
            expect(container.querySelector('.card-value')?.textContent).toBe('120');
            expect(container.querySelector('.card-subtitle')?.textContent).toContain('Active Days: 25');

            (container.querySelector('.card-year') as HTMLElement).click();
            expect(onCardClick).toHaveBeenCalled();

            (container.querySelector('.btn-year') as HTMLElement).click();
            expect(onViewCards).toHaveBeenCalled();
        });

        it('renders day card with date title and link', () => {
            const onCardClick = jest.fn();

            render(
                <HistorySummaryCard
                    type="day"
                    title="Sat, Aug 1"
                    value={15}
                    subtitle="Cards Reviewed"
                    date="2026-08-01"
                    onCardClick={onCardClick}
                />,
                container
            );

            expect(container.querySelector('.card-title')?.textContent).toBe('Sat, Aug 1');
            expect(container.querySelector('.card-value')?.textContent).toBe('15');
            expect(container.querySelector('.card-day-link')).not.toBeNull();
        });
    });

    describe('HistoryBarChart', () => {
        it('renders chart bars, tooltips, and responds to click', () => {
            const onBarAction = jest.fn();
            const dataPoints = [
                { label: '2025', value: 50, tooltip: '2025: 50 reviews', action: onBarAction },
                { label: '2026', value: 100, tooltip: '2026: 100 reviews' }
            ];

            render(<HistoryBarChart title="Reviews per Year" dataPoints={dataPoints} maxVal={100} />, container);

            expect(container.querySelector('.chart-title-label')?.textContent).toBe('Reviews per Year');
            const bars = container.querySelectorAll('.chart-bar-col');
            expect(bars.length).toBe(2);

            (bars[0] as HTMLElement).click();
            expect(onBarAction).toHaveBeenCalled();
        });
    });
});

