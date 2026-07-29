import { Card, StorageData, ChromeSettings, ReviewLog } from '../../../types/domain';

/**
 * @file features/dashboard/history/history.ts
 * @description Main controller for the dedicated contribution history dashboard.
 * Aggregates review logs by year, month, or day, and displays grid list drill-downs
 * with interactive CSS charts tracking user activity metrics.
 */
export class FSRSHistoryDashboard {
    activityData: Record<string, number>;
    chromeSettings: ChromeSettings;
    currentView: string;
    selectedYear: string | null;
    selectedMonth: string | null;
    monthNames: string[];

    constructor() {
        this.activityData = {};
        this.chromeSettings = {};
        this.currentView = 'year';
        this.selectedYear = null;
        this.selectedMonth = null;
        this.monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    }

    init(): void {
        const logger = (window as unknown as { Logger?: { error: (m: string, s: string, d?: unknown) => void } }).Logger;
        try {
            chrome.storage.local.get(['fsrsActivity', 'fsrsCards', 'chromeSettings'], (result: StorageData) => {
                try {
                    let activityData: Record<string, number> = result.fsrsActivity || {};
                    const allCards: Card[] = result.fsrsCards || [];

                    const expectedActivity: Record<string, number> = {};
                    allCards.forEach((c: Card) => {
                        if (c.historyLog) {
                            const uniqueDatesForCard = new Set<string>();
                            c.historyLog.forEach((log: ReviewLog | number) => {
                                const timestamp = (typeof log === 'object' && log !== null) ? log.date : log;
                                const dateObj = new Date(timestamp);
                                const localDateStr = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                                uniqueDatesForCard.add(localDateStr);
                            });
                            uniqueDatesForCard.forEach(dateStr => {
                                expectedActivity[dateStr] = (expectedActivity[dateStr] || 0) + 1;
                            });
                        }
                    });

                    let needsUpdate = false;
                    for (const key of new Set([...Object.keys(activityData), ...Object.keys(expectedActivity)])) {
                        if (activityData[key] !== expectedActivity[key]) {
                            needsUpdate = true;
                            break;
                        }
                    }
                    if (needsUpdate) {
                        activityData = expectedActivity;
                        chrome.storage.local.set({ fsrsActivity: activityData });
                    }

                    this.activityData = activityData;
                    this.chromeSettings = result.chromeSettings || {};
                    this.attachListeners();
                    this.renderView();
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    if (logger) logger.error('History', `Error during history dashboard render: ${errorMessage}`, { innerErr });
                    // Comment: Catch rendering error gracefully
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            if (logger) logger.error('History', `Failed to fetch history storage: ${errorMessage}`, { err });
            // Comment: Catch storage retrieval failure
        }
    }

    attachListeners(): void {
        document.getElementById('view-year')?.addEventListener('click', () => this.setView('year'));
        document.getElementById('view-month')?.addEventListener('click', () => this.setView('month'));
        document.getElementById('view-day')?.addEventListener('click', () => this.setView('day'));
    }

    setView(view: string, targetYear: string | null = null, targetMonth: string | null = null): void {
        this.currentView = view;
        if (view === 'year') {
            this.selectedYear = null;
            this.selectedMonth = null;
        } else if (view === 'month') {
            this.selectedYear = targetYear || this.selectedYear || this.getMostRecentYear();
            this.selectedMonth = null;
        } else if (view === 'day') {
            this.selectedYear = targetYear || this.selectedYear || this.getMostRecentYear();
            this.selectedMonth = targetMonth || this.selectedMonth || this.getMostRecentMonth(this.selectedYear);
        }
        this.renderView();
    }

    getMostRecentYear(): string {
        const years = Object.keys(this.aggregateByYear());
        return years.length > 0 ? years.sort().reverse()[0] : new Date().getFullYear().toString();
    }

    getMostRecentMonth(year: string): string {
        const months = Object.keys(this.aggregateByMonth(year));
        return months.length > 0 ? months.sort().reverse()[0] : `${year}-01`;
    }

    openDataTab(dateRange: string, event?: Event): void {
        if (event) event.stopPropagation();
        chrome.tabs.create({ url: `features/common/data/data.html?view=history&date=${dateRange}` });
    }

    renderView(): void {
        ['year', 'month', 'day'].forEach(v => {
            document.getElementById(`view-${v}`)?.classList.toggle('active', v === this.currentView);
        });

        const breadcrumb = document.getElementById('breadcrumb');
        if (!breadcrumb) return;

        if (this.currentView === 'year') {
            breadcrumb.innerHTML = `All Years`;
        } else if (this.currentView === 'month') {
            breadcrumb.innerHTML = `<span class="bc-year">All Years</span> > ${this.selectedYear}`;
        } else if (this.currentView === 'day' && this.selectedMonth) {
            const m = parseInt(this.selectedMonth.split('-')[1], 10) - 1;
            breadcrumb.innerHTML = `<span class="bc-year">All Years</span> > <span class="bc-month" data-year="${this.selectedYear}">${this.selectedYear}</span> > ${this.monthNames[m]}`;
        }

        const container = document.getElementById('chart-container');
        if (!container) return;
        container.className = `grid grid-${this.currentView}s`;
        container.innerHTML = '';

        if (Object.keys(this.activityData).length === 0) {
            container.innerHTML = `<div class="empty-state">No contribution activity recorded yet. Start reviewing!</div>`;
            return;
        }

        if (this.currentView === 'year') {
            const yearData = this.aggregateByYear();
            Object.keys(yearData).sort().reverse().forEach(year => {
                container.innerHTML += `
                    <div class="card card-year" data-year="${year}" title="Click to view Months">
                        <div class="card-title">${year}</div>
                        <div class="card-value">${yearData[year].total}</div>
                        <div class="card-subtitle">Patterns Reviewed<br>Active Days: ${yearData[year].activeDays}</div>
                        <button class="view-data-btn btn-year" data-year="${year}">
                            <svg class="svg-icon" viewBox="0 0 24 24" style="width:12px; height:12px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                            View Cards
                        </button>
                    </div>
                `;
            });
        }
        else if (this.currentView === 'month' && this.selectedYear) {
            const monthData = this.aggregateByMonth(this.selectedYear);
            if (Object.keys(monthData).length === 0) {
                container.innerHTML = `<div class="empty-state">No activity in ${this.selectedYear}</div>`;
            } else {
                Object.keys(monthData).sort().reverse().forEach(monthKey => {
                    const mIndex = parseInt(monthKey.split('-')[1], 10) - 1;
                    container.innerHTML += `
                        <div class="card card-month" data-year="${this.selectedYear}" data-month="${monthKey}" title="Click to view Days">
                            <div class="card-title">${this.monthNames[mIndex]}</div>
                            <div class="card-value">${monthData[monthKey].total}</div>
                            <div class="card-subtitle">Patterns Reviewed</div>
                            <button class="view-data-btn btn-month" data-month="${monthKey}">
                                <svg class="svg-icon" viewBox="0 0 24 24" style="width:12px; height:12px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                View Cards
                            </button>
                        </div>
                    `;
                });
            }
        }
        else if (this.currentView === 'day' && this.selectedMonth) {
            const dayData = this.aggregateByDay(this.selectedMonth);
            if (Object.keys(dayData).length === 0) {
                container.innerHTML = `<div class="empty-state">No activity in this month.</div>`;
            } else {
                Object.keys(dayData).sort().reverse().forEach(dateString => {
                    const dateObj = new Date(dateString);
                    const displayDate = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

                    container.innerHTML += `
                        <div class="card card-day" data-date="${dateString}" title="View cards reviewed on this day">
                            <div class="card-title">${displayDate}</div>
                            <div class="card-value">${dayData[dateString]}</div>
                            <div class="card-subtitle">Cards Reviewed</div>
                            <div class="card-day-link">
                                <svg class="svg-icon" viewBox="0 0 24 24" style="width:12px; height:12px; margin-right:4px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                                View Cards
                            </div>
                        </div>
                    `;
                });
            }
        }

        this.renderHistoryChart();
        this.bindDynamicListeners();
    }

    renderHistoryChart(): void {
        const chartWrapper = document.getElementById('history-chart-wrapper');
        if (!chartWrapper) return;

        const showCharts = this.chromeSettings && this.chromeSettings.showCharts !== undefined
            ? this.chromeSettings.showCharts
            : true;

        if (!showCharts || Object.keys(this.activityData).length === 0) {
            chartWrapper.style.display = 'none';
            return;
        }

        chartWrapper.style.display = 'block';
        chartWrapper.innerHTML = '';

        let dataPoints: Array<{ label: string; value: number; action: (e?: Event) => void; tooltip?: string }> = [];
        if (this.currentView === 'year') {
            const yearData = this.aggregateByYear();
            const years = Object.keys(yearData).sort();
            dataPoints = years.map(yr => ({
                label: yr,
                value: yearData[yr].total,
                action: () => this.setView('month', yr)
            }));
        } else if (this.currentView === 'month' && this.selectedYear) {
            const monthData = this.aggregateByMonth(this.selectedYear);
            for (let m = 1; m <= 12; m++) {
                const mStr = m.toString().padStart(2, '0');
                const monthKey = `${this.selectedYear}-${mStr}`;
                const count = monthData[monthKey] ? monthData[monthKey].total : 0;
                dataPoints.push({
                    label: this.monthNames[m - 1].substring(0, 3),
                    value: count,
                    action: () => this.setView('day', this.selectedYear, monthKey),
                    tooltip: `${this.monthNames[m - 1]} ${this.selectedYear}: ${count} reviews`
                });
            }
        } else if (this.currentView === 'day' && this.selectedMonth) {
            const dayData = this.aggregateByDay(this.selectedMonth);
            const [year, month] = this.selectedMonth.split('-');
            const daysInMonth = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();

            for (let d = 1; d <= daysInMonth; d++) {
                const dStr = d.toString().padStart(2, '0');
                const dateStr = `${this.selectedMonth}-${dStr}`;
                const count = dayData[dateStr] || 0;
                dataPoints.push({
                    label: d.toString(),
                    value: count,
                    action: (e?: Event) => this.openDataTab(dateStr, e),
                    tooltip: `${new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${count} reviews`
                });
            }
        }

        const maxVal = Math.max(...dataPoints.map(p => p.value), 1);

        const title = document.createElement('h3');
        title.className = 'chart-title-label';
        title.innerText = this.currentView === 'year'
            ? 'Reviews per Year'
            : this.currentView === 'month'
                ? `Reviews in ${this.selectedYear}`
                : `Reviews in ${this.monthNames[parseInt((this.selectedMonth || '').split('-')[1] || '1', 10) - 1]} ${(this.selectedMonth || '').split('-')[0]}`;
        chartWrapper.appendChild(title);

        const chartContainerInner = document.createElement('div');
        chartContainerInner.className = 'chart-container-inner';

        const viewport = document.createElement('div');
        viewport.className = 'chart-viewport';

        const gridLines = document.createElement('div');
        gridLines.className = 'chart-grid-lines';
        gridLines.innerHTML = `
            <div class="grid-line" style="bottom: 0%;"><span>0</span></div>
            <div class="grid-line" style="bottom: 50%;"><span>${Math.round(maxVal / 2)}</span></div>
            <div class="grid-line" style="bottom: 100%;"><span>${maxVal}</span></div>
        `;
        viewport.appendChild(gridLines);

        const barsContainer = document.createElement('div');
        barsContainer.className = 'chart-bars';

        dataPoints.forEach(dp => {
            const barCol = document.createElement('div');
            barCol.className = 'chart-bar-col';
            if (dp.value > 0) barCol.classList.add('has-value');

            const heightPct = (dp.value / maxVal) * 100;

            const bar = document.createElement('div');
            bar.className = 'chart-bar';
            bar.style.height = `${Math.max(heightPct, 3)}%`;

            if (dp.value === 0) {
                bar.classList.add('zero-bar');
            }

            const tooltipText = dp.tooltip || `${dp.label}: ${dp.value} reviews`;
            const tooltip = document.createElement('div');
            tooltip.className = 'chart-bar-tooltip';
            tooltip.innerText = tooltipText;
            bar.appendChild(tooltip);

            const barLabel = document.createElement('div');
            barLabel.className = 'chart-bar-label';
            barLabel.innerText = dp.label;

            barCol.appendChild(bar);
            barCol.appendChild(barLabel);

            if (dp.value > 0 || this.currentView !== 'day') {
                barCol.style.cursor = 'pointer';
                barCol.setAttribute('role', 'button');
                barCol.setAttribute('tabindex', '0');
                barCol.setAttribute('aria-label', tooltipText);

                barCol.addEventListener('click', (e) => dp.action(e));
                barCol.addEventListener('keydown', (e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        dp.action(e);
                    }
                });
            }

            barsContainer.appendChild(barCol);
        });

        viewport.appendChild(barsContainer);
        chartContainerInner.appendChild(viewport);
        chartWrapper.appendChild(chartContainerInner);
    }

    bindDynamicListeners(): void {
        document.querySelectorAll('.bc-year').forEach(el => {
            el.addEventListener('click', () => this.setView('year'));
        });
        document.querySelectorAll('.bc-month').forEach(el => {
            el.addEventListener('click', (e: Event) => {
                const target = e.target as HTMLElement;
                this.setView('month', target.getAttribute('data-year'));
            });
        });

        document.querySelectorAll('.card-year').forEach(el => {
            el.addEventListener('click', (e: Event) => {
                const target = e.target as HTMLElement;
                if (target.closest('button')) return;
                this.setView('month', el.getAttribute('data-year'));
            });
        });
        document.querySelectorAll('.card-month').forEach(el => {
            el.addEventListener('click', (e: Event) => {
                const target = e.target as HTMLElement;
                if (target.closest('button')) return;
                this.setView('day', el.getAttribute('data-year'), el.getAttribute('data-month'));
            });
        });

        document.querySelectorAll('.btn-year').forEach(el => {
            el.addEventListener('click', (e: Event) => this.openDataTab(el.getAttribute('data-year') || '', e));
        });
        document.querySelectorAll('.btn-month').forEach(el => {
            el.addEventListener('click', (e: Event) => this.openDataTab(el.getAttribute('data-month') || '', e));
        });
        document.querySelectorAll('.card-day').forEach(el => {
            el.addEventListener('click', (e: Event) => this.openDataTab(el.getAttribute('data-date') || '', e));
        });
    }

    aggregateByYear(): Record<string, { total: number; activeDays: number }> {
        const years: Record<string, { total: number; activeDays: number }> = {};
        for (const [dateString, count] of Object.entries(this.activityData)) {
            const year = dateString.split('-')[0];
            if (!years[year]) years[year] = { total: 0, activeDays: 0 };
            years[year].total += count;
            years[year].activeDays += 1;
        }
        return years;
    }

    aggregateByMonth(targetYear: string): Record<string, { total: number }> {
        const months: Record<string, { total: number }> = {};
        for (const [dateString, count] of Object.entries(this.activityData)) {
            if (dateString.startsWith(targetYear)) {
                const monthKey = dateString.substring(0, 7);
                if (!months[monthKey]) months[monthKey] = { total: 0 };
                months[monthKey].total += count;
            }
        }
        return months;
    }

    aggregateByDay(targetMonth: string): Record<string, number> {
        const days: Record<string, number> = {};
        for (const [dateString, count] of Object.entries(this.activityData)) {
            if (dateString.startsWith(targetMonth)) {
                days[dateString] = count;
            }
        }
        return days;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const history = new FSRSHistoryDashboard();
    history.init();
});
