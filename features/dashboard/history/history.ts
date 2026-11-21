/**
 * @file features/dashboard/history/history.ts
 * @description Main controller for the dedicated contribution and review history dashboard.
 * Aggregates review logs across year, month, or day granularities, renders interactive
 * CSS column charts, and displays clickable drill-down cards linked to detailed card views in `data.html`.
 *
 * Architecture Role: History Standalone Page Controller.
 * Context: Extension Standalone Tab (`features/dashboard/history/history.html`).
 * Key Exports:
 * - {@link FSRSHistoryDashboard}: Controller class managing date grouping, view drill-downs, and chart rendering.
 */

import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { CatchAndLog, CatchAndReturn, withErrorHandling } from '../../../decorators';
import { Card, StorageData, ExtensionSettings, ReviewLog } from '../../../types/domain';
import { MONTH_NAMES } from '../../common/constants';

/**
 * Controller for the review activity history dashboard page.
 * Manages calendar hierarchies (year -> month -> day), aggregates review frequencies,
 * and handles drill-down navigation into specific review logs.
 */
export class FSRSHistoryDashboard {
    /** Map of ISO date strings (`YYYY-MM-DD`) to count of reviews completed on that date. */
    activityData: Record<string, number>;
    /** Cached collection of all cards used to calculate accurate unique pattern counts matching data page. */
    allCards: Card[];
    /** Cached extension settings including chart display preferences. */
    extensionSettings: ExtensionSettings;
    /** Current calendar hierarchy zoom level: 'year', 'month', or 'day'. */
    currentView: string;
    /** Currently selected 4-digit year filter (e.g., '2026'), or null in year view. */
    selectedYear: string | null;
    /** Currently selected year-month filter (e.g., '2026-03'), or null if above day view. */
    selectedMonth: string | null;
    /** Array of localized month names used for display headers and breadcrumbs. */
    monthNames: string[];

    /**
     * Initializes default history dashboard state with empty activity data and year view.
     */
    constructor() {
        this.activityData = {};
        this.allCards = [];
        this.extensionSettings = {};
        this.currentView = 'year';
        this.selectedYear = null;
        this.selectedMonth = null;
        this.monthNames = [...MONTH_NAMES];
    }

    /**
     * Initializes history data from storage, validates consistency between cards' history logs
     * and cached `fsrsActivity` map, updates storage if out of sync, and renders initial view.
     * @listens chrome.storage.local
     */
    init(): void {
        try {
            chrome.storage.local.get(['fsrsActivity', 'fsrsCards', 'extensionSettings'], (result: StorageData) => {
                try {
                    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                    if (lastError) {
                        const errorMessage = lastError.message || String(lastError);
                        Logger.error('FSRSHistoryDashboard', `Storage error fetching history data: ${errorMessage}`, { error: lastError });
                        return;
                    }

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
                        chrome.storage.local.set({ fsrsActivity: activityData }, () => {
                            const setError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                            if (setError) {
                                const errorMessage = setError.message || String(setError);
                                Logger.error('FSRSHistoryDashboard', `Storage error setting synced fsrsActivity: ${errorMessage}`, { error: setError });
                            }
                        });
                    }

                    this.activityData = activityData;
                    this.allCards = allCards;
                    this.extensionSettings = result.extensionSettings || {};
                    this.attachListeners();
                    this.renderView();
                } catch (innerErr) {
                    UIUtils.catchError('FSRSHistoryDashboard', 'Error during history dashboard render', innerErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('FSRSHistoryDashboard', 'Failed to fetch history storage', err);
        }
    }

    /**
     * Binds click listeners to the year/month/day view toggle buttons.
     */
    @CatchAndLog('FSRSHistoryDashboard', 'Error attaching view listeners')
    attachListeners(): void {
        document.getElementById('view-year')?.addEventListener('click', withErrorHandling(() => {
            this.setView('year');
        }, 'FSRSHistoryDashboard', 'Error setting view to year'));

        document.getElementById('view-month')?.addEventListener('click', withErrorHandling(() => {
            this.setView('month');
        }, 'FSRSHistoryDashboard', 'Error setting view to month'));

        document.getElementById('view-day')?.addEventListener('click', withErrorHandling(() => {
            this.setView('day');
        }, 'FSRSHistoryDashboard', 'Error setting view to day'));
    }

    /**
     * Switches the current calendar hierarchy level and re-renders the dashboard.
     * @param view - View mode ('year', 'month', or 'day').
     * @param targetYear - Optional specific year to inspect.
     * @param targetMonth - Optional specific year-month (e.g. '2026-03') to inspect.
     */
    @CatchAndLog('FSRSHistoryDashboard', 'Error setting history dashboard view')
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

    /**
     * Determines the most recent year with logged reviews, or falls back to current year.
     * @returns 4-digit year string.
     */
    @CatchAndReturn(new Date().getFullYear().toString(), 'FSRSHistoryDashboard', 'Error getting most recent year')
    getMostRecentYear(): string {
        const years = Object.keys(this.aggregateByYear());
        return years.length > 0 ? years.sort().reverse()[0] : new Date().getFullYear().toString();
    }

    /**
     * Determines the most recent month with logged reviews in a given year.
     * @param year - 4-digit year string.
     * @returns `YYYY-MM` month string.
     */
    getMostRecentMonth(year: string): string {
        try {
            const months = Object.keys(this.aggregateByMonth(year));
            return months.length > 0 ? months.sort().reverse()[0] : `${year}-01`;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSHistoryDashboard', `Error getting most recent month: ${errorMessage}`, { year, err });
            return `${year}-01`;
        }
    }

    /**
     * Navigates the current browser tab to `data.html` filtered to cards reviewed in `dateRange`.
     * @param dateRange - ISO date string or year/month prefix to query.
     * @param event - Optional click event to prevent propagation.
     */
    @CatchAndLog('FSRSHistoryDashboard', 'Error opening data tab')
    openDataTab(dateRange: string, event?: Event): void {
        if (event) event.stopPropagation();
        const targetUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
            ? chrome.runtime.getURL(`features/common/data/data.html?view=history&date=${encodeURIComponent(dateRange)}`)
            : `../../common/data/data.html?view=history&date=${encodeURIComponent(dateRange)}`;
        if (typeof window !== 'undefined' && window.location) {
            window.location.href = targetUrl;
        }
    }

    /**
     * Renders breadcrumbs, drill-down summary cards, and charts for the active view granularity.
     */
    @CatchAndLog('FSRSHistoryDashboard', 'Error rendering history view')
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
                        <div class="card card-day" data-date="${dateString}" tabindex="0" role="button" aria-label="View cards reviewed on ${displayDate}" title="View cards reviewed on this day">
                            <div class="card-title">${displayDate}</div>
                            <div class="card-value">${dayData[dateString]}</div>
                            <div class="card-subtitle">Patterns Reviewed</div>
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

    /**
     * Renders a responsive CSS bar chart displaying review activity distributions
     * for the currently selected hierarchy view (years, months in year, or days in month).
     */
    @CatchAndLog('FSRSHistoryDashboard', 'Error rendering history chart')
    renderHistoryChart(): void {
        const chartWrapper = document.getElementById('history-chart-wrapper');
        if (!chartWrapper) return;

        const showCharts = this.extensionSettings && this.extensionSettings.showCharts !== undefined
            ? this.extensionSettings.showCharts
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

                barCol.addEventListener('click', withErrorHandling((e) => {
                    dp.action(e);
                }, 'FSRSHistoryDashboard', 'Error executing chart bar click action'));

                barCol.addEventListener('keydown', withErrorHandling((e: KeyboardEvent) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        dp.action(e);
                    }
                }, 'FSRSHistoryDashboard', 'Error executing chart bar keydown action'));
            }

            barsContainer.appendChild(barCol);
        });

        viewport.appendChild(barsContainer);
        chartContainerInner.appendChild(viewport);
        chartWrapper.appendChild(chartContainerInner);
    }

    /**
     * Binds event listeners to dynamically rendered breadcrumb links and drill-down cards.
     */
    @CatchAndLog('FSRSHistoryDashboard', 'Error binding dynamic listeners')
    bindDynamicListeners(): void {
        document.querySelectorAll('.bc-year').forEach(el => {
            el.addEventListener('click', withErrorHandling(() => {
                this.setView('year');
            }, 'FSRSHistoryDashboard', 'Error in breadcrumb year click handler'));
        });
        document.querySelectorAll('.bc-month').forEach(el => {
            el.addEventListener('click', withErrorHandling((e: Event) => {
                const target = e.target as HTMLElement;
                this.setView('month', target.getAttribute('data-year'));
            }, 'FSRSHistoryDashboard', 'Error in breadcrumb month click handler'));
        });

        document.querySelectorAll('.card-year').forEach(el => {
            el.addEventListener('click', withErrorHandling((e: Event) => {
                const target = e.target as HTMLElement;
                if (target.closest('button')) return;
                this.setView('month', el.getAttribute('data-year'));
            }, 'FSRSHistoryDashboard', 'Error in card year click handler'));
        });
        document.querySelectorAll('.card-month').forEach(el => {
            el.addEventListener('click', withErrorHandling((e: Event) => {
                const target = e.target as HTMLElement;
                if (target.closest('button')) return;
                this.setView('day', el.getAttribute('data-year'), el.getAttribute('data-month'));
            }, 'FSRSHistoryDashboard', 'Error in card month click handler'));
        });

        document.querySelectorAll('.btn-year').forEach(el => {
            el.addEventListener('click', withErrorHandling((e: Event) => {
                this.openDataTab(el.getAttribute('data-year') || '', e);
            }, 'FSRSHistoryDashboard', 'Error in btn year click handler'));
        });
        document.querySelectorAll('.btn-month').forEach(el => {
            el.addEventListener('click', withErrorHandling((e: Event) => {
                this.openDataTab(el.getAttribute('data-month') || '', e);
            }, 'FSRSHistoryDashboard', 'Error in btn month click handler'));
        });
        document.querySelectorAll('.card-day').forEach(el => {
            el.addEventListener('click', withErrorHandling((e: Event) => {
                this.openDataTab(el.getAttribute('data-date') || '', e);
            }, 'FSRSHistoryDashboard', 'Error in card day click handler'));

            el.addEventListener('keydown', withErrorHandling((e: Event) => {
                const keyEvent = e as KeyboardEvent;
                if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
                    keyEvent.preventDefault();
                    this.openDataTab(el.getAttribute('data-date') || '', e);
                }
            }, 'FSRSHistoryDashboard', 'Error in card day keydown handler'));
        });
    }

    /**
     * Aggregates activity counts by 4-digit year, tallying unique patterns reviewed and unique active days.
     * @returns Map of year strings to total unique patterns and active day counts.
     */
    @CatchAndReturn({}, 'FSRSHistoryDashboard', 'Error aggregating history by year')
    aggregateByYear(): Record<string, { total: number; activeDays: number }> {
        if (this.allCards && this.allCards.length > 0) {
            const yearCardSets: Record<string, Set<string>> = {};
            const yearActiveDates: Record<string, Set<string>> = {};

            this.allCards.forEach((c: Card) => {
                if (!c.historyLog || !Array.isArray(c.historyLog)) return;
                const cardId = c.id || c.problemTitle || Math.random().toString();
                c.historyLog.forEach((log: ReviewLog | number) => {
                    const timestamp = (typeof log === 'object' && log !== null) ? log.date : log;
                    if (!timestamp) return;
                    const dateObj = new Date(timestamp);
                    if (isNaN(dateObj.getTime())) return;
                    const localDateStr = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                    const year = localDateStr.split('-')[0];

                    if (!yearCardSets[year]) {
                        yearCardSets[year] = new Set<string>();
                        yearActiveDates[year] = new Set<string>();
                    }
                    yearCardSets[year].add(cardId);
                    yearActiveDates[year].add(localDateStr);
                });
            });

            const years: Record<string, { total: number; activeDays: number }> = {};
            for (const [year, cardSet] of Object.entries(yearCardSets)) {
                years[year] = {
                    total: cardSet.size,
                    activeDays: yearActiveDates[year].size
                };
            }
            return years;
        }

        const years: Record<string, { total: number; activeDays: number }> = {};
        for (const [dateString, count] of Object.entries(this.activityData)) {
            const year = dateString.split('-')[0];
            if (!years[year]) years[year] = { total: 0, activeDays: 0 };
            years[year].total += count;
            years[year].activeDays += 1;
        }
        return years;
    }

    /**
     * Aggregates activity counts for each month in a specific year, tallying unique patterns reviewed.
     * @param targetYear - 4-digit year string.
     * @returns Map of `YYYY-MM` month strings to total unique pattern counts.
     */
    @CatchAndReturn({}, 'FSRSHistoryDashboard', 'Error aggregating history by month')
    aggregateByMonth(targetYear: string): Record<string, { total: number }> {
        if (this.allCards && this.allCards.length > 0) {
            const monthCardSets: Record<string, Set<string>> = {};

            this.allCards.forEach((c: Card) => {
                if (!c.historyLog || !Array.isArray(c.historyLog)) return;
                const cardId = c.id || c.problemTitle || Math.random().toString();
                c.historyLog.forEach((log: ReviewLog | number) => {
                    const timestamp = (typeof log === 'object' && log !== null) ? log.date : log;
                    if (!timestamp) return;
                    const dateObj = new Date(timestamp);
                    if (isNaN(dateObj.getTime())) return;
                    const localDateStr = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                    if (localDateStr.startsWith(targetYear)) {
                        const monthKey = localDateStr.substring(0, 7);
                        if (!monthCardSets[monthKey]) {
                            monthCardSets[monthKey] = new Set<string>();
                        }
                        monthCardSets[monthKey].add(cardId);
                    }
                });
            });

            const months: Record<string, { total: number }> = {};
            for (const [monthKey, cardSet] of Object.entries(monthCardSets)) {
                months[monthKey] = { total: cardSet.size };
            }
            return months;
        }

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

    /**
     * Aggregates activity counts for each day in a specific month, tallying unique patterns reviewed.
     * @param targetMonth - `YYYY-MM` month string.
     * @returns Map of `YYYY-MM-DD` date strings to unique pattern counts.
     */
    @CatchAndReturn({}, 'FSRSHistoryDashboard', 'Error aggregating history by day')
    aggregateByDay(targetMonth: string): Record<string, number> {
        if (this.allCards && this.allCards.length > 0) {
            const dayCardSets: Record<string, Set<string>> = {};

            this.allCards.forEach((c: Card) => {
                if (!c.historyLog || !Array.isArray(c.historyLog)) return;
                const cardId = c.id || c.problemTitle || Math.random().toString();
                c.historyLog.forEach((log: ReviewLog | number) => {
                    const timestamp = (typeof log === 'object' && log !== null) ? log.date : log;
                    if (!timestamp) return;
                    const dateObj = new Date(timestamp);
                    if (isNaN(dateObj.getTime())) return;
                    const localDateStr = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                    if (localDateStr.startsWith(targetMonth)) {
                        if (!dayCardSets[localDateStr]) {
                            dayCardSets[localDateStr] = new Set<string>();
                        }
                        dayCardSets[localDateStr].add(cardId);
                    }
                });
            });

            const days: Record<string, number> = {};
            for (const [dateString, cardSet] of Object.entries(dayCardSets)) {
                days[dateString] = cardSet.size;
            }
            return days;
        }

        const days: Record<string, number> = {};
        for (const [dateString, count] of Object.entries(this.activityData)) {
            if (dateString.startsWith(targetMonth)) {
                days[dateString] = count;
            }
        }
        return days;
    }
}

/**
 * Initializes the history dashboard controller on DOM load.
 */
const initHistory = withErrorHandling((): void => {
    const history = new FSRSHistoryDashboard();
    history.init();
}, 'FSRSHistoryDashboard', 'Initialization failed');

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHistory);
    } else {
        initHistory();
    }
}
