import { h, render } from 'preact';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { LearningVelocityKpiCard, LearningVelocityPanel } from '../../../../../features/dashboard/analytics/overview/learningVelocity';
import { ForecastDayTile, MiniForecastStrip } from '../../../../../features/dashboard/analytics/overview/miniForecast';
import { MemoryHealthRadialRing, MemoryHealthMetricsGrid } from '../../../../../features/dashboard/analytics/overview/memoryHealth';
import { OverviewNextActionBanner } from '../../../../../features/dashboard/analytics/overview/overview';
import { ConfidenceBandPolygon } from '../../../../../features/dashboard/analytics/memory/confidenceBand';
import { RetentionChartLegend } from '../../../../../features/dashboard/analytics/memory/retentionChart';
import { SimulationStepCard, SimulationStepsGrid } from '../../../../../features/dashboard/analytics/memory/futureMemorySimulation';
import { PredictionComparisonLegend } from '../../../../../features/dashboard/analytics/memory/predictionComparison';
import { ReviewStatMini, ReviewBarCol } from '../../../../../features/dashboard/analytics/performance/reviewStats';
import { RecoveryTable } from '../../../../../features/dashboard/analytics/performance/recoveryTracking';
import { CoverageTableComponent } from '../../../../../features/dashboard/analytics/tags/coverageTable';
import { RetentionBarRow } from '../../../../../features/dashboard/analytics/tags/retentionBarChart';
import { ReadinessTopicCard, ReadinessMetricsGrid } from '../../../../../features/dashboard/analytics/readiness/readiness';
import { ReviewTimeHighlightBanner } from '../../../../../features/dashboard/analytics/insights/reviewTimeAnalytics';
import { AnalyticsGlobalKpiBar, AnalyticsSidebar, AnalyticsHeader, AnalyticsApp, AnalyticsDashboardSPA } from '../../../../../features/dashboard/analytics/analytics';

describe('Analytics Preact Components', () => {
    let container: HTMLElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        render(null, container);
        container.remove();
        jest.clearAllMocks();
    });

    it('renders LearningVelocityKpiCard with positive trend and sparkline points', () => {
        render(
            <LearningVelocityKpiCard
                title="New Cards/Day"
                tooltip="Average new cards learned"
                trendValue={15}
                mainValue={5}
                unit="/day"
                sparklinePoints={[1, 2, 4, 5]}
            />,
            container
        );
        expect(container.textContent).toContain('New Cards/Day');
        expect(container.textContent).toContain('▲ 15%');
        expect(container.querySelector('.sparkline-svg')).not.toBeNull();
    });

    it('renders ForecastDayTile with click handler', () => {
        const onClick = jest.fn();
        render(
            <ForecastDayTile
                isToday={true}
                dayName="Mon"
                formattedDate="Aug 4"
                count={5}
                countClass="count-med"
                dateStr="2026-08-04"
                offset={0}
                onClick={onClick}
            />,
            container
        );
        expect(container.textContent).toContain('Today');
        expect(container.textContent).toContain('5');
        const card = container.querySelector('.forecast-day-card') as HTMLElement;
        card.click();
        expect(onClick).toHaveBeenCalledWith('2026-08-04', 0);
    });

    it('renders MemoryHealthRadialRing and MemoryHealthMetricsGrid', () => {
        render(
            <div>
                <MemoryHealthRadialRing healthScore={85} statusClass="health-good" />
                <MemoryHealthMetricsGrid stats={{ trueRetention: 85, totalLapses: 2, avgStability: 14.2, streak: 5 }} />
            </div>,
            container
        );
        expect(container.querySelector('.health-ring')).not.toBeNull();
        expect(container.textContent).toContain('85%');
        expect(container.textContent).toContain('14.2d');
        expect(container.textContent).toContain('5d');
    });

    it('renders OverviewNextActionBanner for pending reviews and caught up', () => {
        render(<OverviewNextActionBanner type="pending" dueCount={8} />, container);
        expect(container.textContent).toContain('Reviews Pending');
        expect(container.textContent).toContain('8 cards due');

        render(<OverviewNextActionBanner type="caught-up" />, container);
        expect(container.textContent).toContain('all caught up');
    });

    it('renders ConfidenceBandPolygon when valid points provided', () => {
        const svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        container.appendChild(svgContainer);
        render(
            <ConfidenceBandPolygon
                points={[
                    { t: 0, R: 1.0, x: 50, y: 20 },
                    { t: 15, R: 0.85, x: 200, y: 50 },
                    { t: 30, R: 0.70, x: 350, y: 90 }
                ]}
                color="#a8c7fa"
                n={20}
            />,
            svgContainer
        );
        expect(svgContainer.querySelector('polygon')).not.toBeNull();
    });

    it('renders RetentionChartLegend', () => {
        render(
            <RetentionChartLegend
                groups={[
                    { name: 'Trees', count: 10, color: '#ff0000' },
                    { name: 'Graphs', count: 5, color: '#00ff00' }
                ]}
            />,
            container
        );
        expect(container.textContent).toContain('Trees');
        expect(container.textContent).toContain('Graphs');
    });

    it('renders SimulationStepCard with correct styles', () => {
        render(
            <SimulationStepCard
                label="Today"
                badgeText="Current"
                badgeClass="badge-today"
                stepClass="step-today"
                retention={92}
            />,
            container
        );
        expect(container.textContent).toContain('Today');
        expect(container.textContent).toContain('92%');
        expect(container.querySelector('.fill-success')).not.toBeNull();
    });

    it('renders PredictionComparisonLegend', () => {
        render(
            <PredictionComparisonLegend gapText="Tracking closely" diff={0.02} />,
            container
        );
        expect(container.textContent).toContain('Predicted Retention');
        expect(container.textContent).toContain('Actual Recall');
        expect(container.textContent).toContain('Tracking closely');
    });

    it('renders ReviewStatMini and ReviewBarCol', () => {
        render(
            <div>
                <ReviewStatMini value="42" label="Total Reviews" />
                <ReviewBarCol tooltip="Mon: 5 reviews" label="M" value={5} heightPct={50} />
            </div>,
            container
        );
        expect(container.textContent).toContain('42');
        expect(container.textContent).toContain('Total Reviews');
        expect(container.textContent).toContain('M');
    });

    it('renders RecoveryTable with cards', () => {
        const mockCards: any[] = [
            { id: '1', problemTitle: 'Two Sum', lapses: 2, stability: 12.5, historyLog: [] }
        ];
        render(<RecoveryTable cards={mockCards} isRecovered={true} />, container);
        expect(container.textContent).toContain('Two Sum');
        expect(container.textContent).toContain('12.5d');
    });

    it('renders CoverageTableComponent with tag badge', () => {
        const onTagClick = jest.fn();
        const mockStats: any[] = [
            { tag: 'binary-search', count: 12, trueRetention: 88, avgStability: 9.4, due: 2 }
        ];
        render(
            <CoverageTableComponent stats={mockStats} totalCards={20} onTagClick={onTagClick} />,
            container
        );
        expect(container.textContent).toContain('binary-search');
        expect(container.textContent).toContain('60%');
        const badge = container.querySelector('.clickable-tag') as HTMLElement;
        badge.click();
        expect(onTagClick).toHaveBeenCalledWith('binary-search');
    });

    it('renders RetentionBarRow with progress fill', () => {
        render(
            <RetentionBarRow
                tag="dynamic-programming"
                due={0}
                val={75}
                displayVal="75%"
                fillClass="fill-warning"
            />,
            container
        );
        expect(container.textContent).toContain('dynamic-programming');
        expect(container.textContent).toContain('75%');
    });

    it('renders ReadinessTopicCard and ReadinessMetricsGrid', () => {
        const topic: any = {
            tag: 'Graphs',
            count: 6,
            avgStability: 11.2,
            expectedRecall: 84,
            status: 'Moderate',
            statusClass: 'ready-medium'
        };
        const stats: any = {
            overallRecall: 85,
            daysAhead: 14,
            atRiskCount: 0
        };
        render(
            <div>
                <ReadinessTopicCard topic={topic} daysAhead={14} />
                <ReadinessMetricsGrid stats={stats} formattedDate="Aug 18, 2026" />
            </div>,
            container
        );
        expect(container.textContent).toContain('Graphs');
        expect(container.textContent).toContain('84%');
        expect(container.textContent).toContain('Overall Expected Recall');
    });

    it('renders ReviewTimeHighlightBanner and AnalyticsGlobalKpiBar', () => {
        const summaryStats: any = {
            totalCards: 25,
            trueRetention: 92,
            dueToday: 3
        };
        render(
            <div>
                <ReviewTimeHighlightBanner highlightText="Morning is best (95% recall)" />
                <AnalyticsGlobalKpiBar stats={summaryStats} examRecall={88} />
            </div>,
            container
        );
        expect(container.textContent).toContain('Morning is best');
        expect(container.textContent).toContain('25');
        expect(container.textContent).toContain('Cards');
        expect(container.textContent).toContain('92%');
        expect(container.textContent).toContain('Retention');
        expect(container.textContent).toContain('3');
        expect(container.textContent).toContain('Due Today');
        expect(container.textContent).toContain('88%');
        expect(container.textContent).toContain('Exam Recall');
    });

    it('renders AnalyticsSidebar and triggers tab selection', () => {
        const onSelect = jest.fn();
        render(<AnalyticsSidebar currentTab="overview" onSelectTab={onSelect} />, container);

        expect(container.textContent).toContain('Analytics');
        expect(container.textContent).toContain('Overview');
        expect(container.textContent).toContain('Exam Readiness');
        expect(container.textContent).toContain('Memory Retention');
        expect(container.textContent).toContain('Tag Analytics');
        expect(container.textContent).toContain('View All Patterns');

        const readinessBtn = container.querySelector('[data-tab="readiness"]') as HTMLButtonElement;
        expect(readinessBtn).not.toBeNull();
        readinessBtn.click();
        expect(onSelect).toHaveBeenCalledWith('readiness');
    });

    it('renders AnalyticsHeader with title and branding', () => {
        const summaryStats = {
            totalCards: 15,
            dueToday: 2,
            trueRetention: 90
        };
        render(
            <AnalyticsHeader
                title="Exam Readiness Forecast"
                subtitle="15 patterns tracked"
                stats={summaryStats}
                examRecall={85}
            />,
            container
        );
        expect(container.querySelector('#current-tab-title')?.textContent).toBe('Exam Readiness Forecast');
        expect(container.querySelector('#analytics-subtitle')?.textContent).toBe('15 patterns tracked');
        expect(container.textContent).toContain('AlgoRecall');
    });

    it('renders AnalyticsApp root layout with all tab panes', () => {
        const spa = new AnalyticsDashboardSPA();
        render(<AnalyticsApp spa={spa} />, container);

        expect(container.querySelector('.dashboard-layout')).not.toBeNull();
        expect(container.querySelector('.sidebar')).not.toBeNull();
        expect(container.querySelector('.main-content')).not.toBeNull();
        expect(container.querySelector('#tab-overview')).not.toBeNull();
        expect(container.querySelector('#tab-readiness')).not.toBeNull();
        expect(container.querySelector('#tab-memory')).not.toBeNull();
        expect(container.querySelector('#tab-simulation')).not.toBeNull();
        expect(container.querySelector('#tab-tags')).not.toBeNull();
        expect(container.querySelector('#tab-performance')).not.toBeNull();
        expect(container.querySelector('#tab-insights')).not.toBeNull();
    });
});

