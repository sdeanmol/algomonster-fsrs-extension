/**
 * @file tests/unit/features/dashboard/heatmap/HeatmapComponents.test.tsx
 * @description Unit tests for Preact components in the Heatmap dashboard feature.
 */

import { h, render } from 'preact';
import {
    StreakStatCard,
    HeatmapStatsDashboard
} from '../../../../../features/dashboard/heatmap/heatmap-stats';
import {
    HeatmapFilterBar,
    HeatmapCell,
    HeatmapLegend,
    HeatmapGrid,
    HeatmapApp
} from '../../../../../features/dashboard/heatmap/heatmap';

describe('Heatmap Preact Components', () => {
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

    describe('StreakStatCard and HeatmapStatsDashboard', () => {
        it('renders individual StreakStatCard with correct title, value, unit, and icon', () => {
            render(
                <StreakStatCard
                    title="Current Streak"
                    value={7}
                    unit="days"
                    variant="streak"
                    iconSvg={<svg className="test-svg" />}
                />,
                container
            );

            expect(container.querySelector('.stats-card-streak')).not.toBeNull();
            expect(container.querySelector('.stats-card-title')?.textContent).toContain('Current Streak');
            expect(container.querySelector('.stats-card-value')?.textContent).toContain('7');
            expect(container.querySelector('.stats-card-unit')?.textContent).toBe('days');
            expect(container.querySelector('.test-svg')).not.toBeNull();
        });

        it('renders HeatmapStatsDashboard with 4 KPI cards', () => {
            const stats = {
                currentStreak: 5,
                longestStreak: 12,
                activeDays: 20,
                maxReviews: 45
            };

            render(<HeatmapStatsDashboard stats={stats} />, container);

            const cards = container.querySelectorAll('.stats-card');
            expect(cards.length).toBe(4);
            expect(container.querySelector('.stats-card-streak')?.textContent).toContain('5');
            expect(container.querySelector('.stats-card-longest')?.textContent).toContain('12');
            expect(container.querySelector('.stats-card-active')?.textContent).toContain('20');
            expect(container.querySelector('.stats-card-max')?.textContent).toContain('45');
        });
    });

    describe('HeatmapFilterBar', () => {
        it('renders filter dropdowns and summary text', () => {
            const onFilterTypeChange = jest.fn();
            const onYearChange = jest.fn();

            render(
                <HeatmapFilterBar
                    filterType="year-wise"
                    years={['2026', '2025']}
                    selectedYear="2026"
                    months={[{ value: '08', label: 'August' }]}
                    selectedMonth="08"
                    days={[{ value: '01', label: 'Day 1' }]}
                    selectedDay="01"
                    summaryText="Showing: Full Year 2026"
                    onFilterTypeChange={onFilterTypeChange}
                    onYearChange={onYearChange}
                />,
                container
            );

            expect(container.querySelector('#filter-type')).not.toBeNull();
            expect(container.querySelector('#select-year')?.classList.contains('hide-select')).toBe(false);
            expect(container.querySelector('#filter-summary-text')?.textContent).toBe('Showing: Full Year 2026');

            const yearSelect = container.querySelector('#select-year') as HTMLSelectElement;
            yearSelect.dispatchEvent(new Event('change'));
            expect(onYearChange).toHaveBeenCalled();
        });
    });

    describe('HeatmapCell', () => {
        it('renders active cell with level class, accessible attributes, and handles clicks', () => {
            const onClick = jest.fn();
            render(
                <HeatmapCell
                    dateString="2026-08-01"
                    displayDate="Sat, Aug 1, 2026"
                    count={5}
                    level={2}
                    isOutsideRange={false}
                    onClick={onClick}
                />,
                container
            );

            const cell = container.querySelector('.heatmap-cell') as HTMLElement;
            expect(cell.classList.contains('level-2')).toBe(true);
            expect(cell.getAttribute('aria-label')).toBe('5 reviews on Sat, Aug 1, 2026');

            cell.click();
            expect(onClick).toHaveBeenCalled();
        });

        it('renders outside range cell with opacity 0.08 and disabled pointer events', () => {
            render(
                <HeatmapCell
                    dateString="2026-07-31"
                    displayDate="Fri, Jul 31, 2026"
                    count={0}
                    level={0}
                    isOutsideRange={true}
                />,
                container
            );

            const cell = container.querySelector('.heatmap-cell') as HTMLElement;
            expect(cell.style.opacity).toBe('0.08');
            expect(cell.style.pointerEvents).toBe('none');
        });
    });

    describe('HeatmapGrid and HeatmapApp', () => {
        it('renders HeatmapGrid with cells', () => {
            const cells = [
                {
                    dateString: '2026-08-01',
                    displayDate: 'Aug 1, 2026',
                    count: 3,
                    level: 2 as const,
                    isOutsideRange: false
                }
            ];
            render(<HeatmapGrid cells={cells} />, container);

            expect(container.querySelector('#full-heatmap-grid')).not.toBeNull();
            expect(container.querySelectorAll('.heatmap-cell').length).toBe(1);
        });

        it('renders complete HeatmapApp root component with header, filter bar, grid, and stats', async () => {
            const initialActivity = {
                '2026-08-01': 5,
                '2026-08-02': 10
            };
            render(<HeatmapApp initialActivityData={initialActivity} />, container);

            expect(container.querySelector('.algorecall-brand-name')?.textContent).toBe('AlgoRecall');
            expect(container.querySelector('h1')?.textContent).toContain('Contribution Heatmap');
            expect(container.querySelector('.heatmap-legend')).not.toBeNull();
            expect(container.querySelector('.filter-bar')).not.toBeNull();
            expect(container.querySelector('#full-heatmap-grid')).not.toBeNull();
            expect(container.querySelector('#heatmap-stats-container')).not.toBeNull();

            // Check that changing filter type updates select dropdown
            const filterTypeSelect = container.querySelector('#filter-type') as HTMLSelectElement;
            filterTypeSelect.value = 'month-wise';
            filterTypeSelect.dispatchEvent(new Event('change', { bubbles: true }));

            await Promise.resolve();

            expect(container.querySelector('#select-month')?.classList.contains('hide-select')).toBe(false);
        });
    });
});

