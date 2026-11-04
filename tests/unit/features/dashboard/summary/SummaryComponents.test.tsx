/**
 * @file tests/unit/features/dashboard/summary/SummaryComponents.test.tsx
 * @description Unit tests for Preact components in the Performance Summary feature.
 */

import { h, render } from 'preact';
import {
    SummaryPeriodTabs,
    SummaryKpiGrid,
    SummaryInsightsList,
    SummaryActivityChart,
    SummaryTopicMasteryList,
    SummaryApp,
    SummaryDashboard
} from '../../../../../features/dashboard/summary/summary';
import { SummaryReport } from '../../../../../features/dashboard/summary/summaryGenerator';

describe('Summary Preact Components', () => {
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

    describe('SummaryPeriodTabs', () => {
        it('renders weekly and monthly tab buttons and handles clicks', () => {
            const onSelect = jest.fn();
            render(<SummaryPeriodTabs currentPeriod="weekly" onSelectPeriod={onSelect} />, container);

            const weeklyBtn = container.querySelector('#period-weekly-btn') as HTMLElement;
            const monthlyBtn = container.querySelector('#period-monthly-btn') as HTMLElement;

            expect(weeklyBtn.classList.contains('active')).toBe(true);
            expect(monthlyBtn.classList.contains('active')).toBe(false);

            monthlyBtn.click();
            expect(onSelect).toHaveBeenCalledWith('monthly');
        });
    });

    describe('SummaryKpiGrid', () => {
        it('renders KPI metrics and percentage badges', () => {
            const mockReport: Partial<SummaryReport> = {
                totalReviews: 84,
                prevPeriodReviews: 70,
                reviewsChangePct: 20,
                retentionRate: 88,
                prevRetentionRate: 85,
                retentionChangeDiff: 3,
                newCardsLearned: 15,
                activeDays: 6,
                totalDaysInPeriod: 7
            };

            render(<SummaryKpiGrid report={mockReport as SummaryReport} currentPeriod="weekly" />, container);

            expect(container.querySelector('#kpi-reviews')?.textContent).toBe('84');
            expect(container.querySelector('#kpi-reviews-trend')?.textContent).toContain('+20%');
            expect(container.querySelector('#kpi-retention')?.textContent).toBe('88%');
            expect(container.querySelector('#kpi-retention-trend')?.textContent).toContain('+3%');
            expect(container.querySelector('#kpi-new-cards')?.textContent).toBe('15');
            expect(container.querySelector('#kpi-active-days')?.textContent).toBe('6/7');
        });
    });

    describe('SummaryInsightsList', () => {
        it('renders empty state when no insights exist', () => {
            render(<SummaryInsightsList insights={[]} />, container);
            expect(container.querySelector('.empty-state')?.textContent).toContain('No specific recommendations');
        });

        it('renders recommendation items with icons and titles', () => {
            const insights = [
                { type: 'positive' as const, icon: '🔥', title: 'Great Consistency', description: 'Maintained strong streak' },
                { type: 'warning' as const, icon: '⚠️', title: 'Watch Out', description: 'Leech card detected' }
            ];

            render(<SummaryInsightsList insights={insights} />, container);

            const items = container.querySelectorAll('.insight-item');
            expect(items.length).toBe(2);
            expect(items[0].classList.contains('positive')).toBe(true);
            expect(container.querySelector('.insight-title')?.textContent).toBe('Great Consistency');
        });
    });

    describe('SummaryActivityChart', () => {
        it('renders activity columns with bar heights and labels', () => {
            const daily = [
                { dateStr: 'Aug 1', fullDate: '2026-08-01', count: 10 },
                { dateStr: 'Aug 2', fullDate: '2026-08-02', count: 0 }
            ];

            render(<SummaryActivityChart dailyActivity={daily} isMonthly={false} />, container);

            const bars = container.querySelectorAll('.chart-bar-wrapper');
            expect(bars.length).toBe(2);
            expect(bars[1].querySelector('.chart-bar')?.classList.contains('zero')).toBe(true);
        });
    });

    describe('SummaryTopicMasteryList', () => {
        it('renders empty state when topics list is empty', () => {
            render(<SummaryTopicMasteryList title="Top Topics" containerId="top-topics" topics={[]} />, container);
            expect(container.querySelector('.empty-state')?.textContent).toContain('No topic data logged');
        });

        it('renders topic rows with percentage fills', () => {
            const topics = [
                { tag: 'Dynamic Programming', totalReviews: 20, successReviews: 18, retentionRate: 90 }
            ];

            render(<SummaryTopicMasteryList title="Top Topics" containerId="top-topics" topics={topics} />, container);

            expect(container.querySelector('.topic-name')?.textContent).toBe('Dynamic Programming');
            expect(container.querySelector('.topic-stats')?.textContent).toContain('90%');
            expect(container.querySelector('.topic-bar-fill')?.classList.contains('high')).toBe(true);
        });
    });

    describe('SummaryApp', () => {
        it('renders the complete SummaryApp dashboard', () => {
            const dashboard = new SummaryDashboard();
            render(<SummaryApp dashboard={dashboard} />, container);

            expect(container.querySelector('.algorecall-brand-name')?.textContent).toBe('AlgoRecall');
            expect(container.querySelector('h1')?.textContent).toContain('Notification & Digest Summary');
            expect(container.querySelector('#period-weekly-btn')?.classList.contains('active')).toBe(true);
            expect(container.querySelector('.kpi-grid')).not.toBeNull();
            expect(container.querySelector('#insights-container')).not.toBeNull();
            expect(container.querySelector('#activity-chart-container')).not.toBeNull();
            expect(container.querySelector('#top-topics-container')).not.toBeNull();
            expect(container.querySelector('#weak-topics-container')).not.toBeNull();
        });

        it('switches between weekly and monthly tabs inside SummaryApp', async () => {
            const dashboard = new SummaryDashboard();
            render(<SummaryApp dashboard={dashboard} />, container);

            const monthlyBtn = container.querySelector('#period-monthly-btn') as HTMLElement;
            monthlyBtn.click();
            await Promise.resolve();

            expect(monthlyBtn.classList.contains('active')).toBe(true);
            expect(container.querySelector('#period-weekly-btn')?.classList.contains('active')).toBe(false);
        });
    });
});

