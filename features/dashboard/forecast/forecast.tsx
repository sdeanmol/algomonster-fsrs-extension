/**
 * @file features/dashboard/forecast/forecast.tsx
 * @description Main controller for the dedicated review forecast dashboard page.
 * Projects upcoming review volumes up to 30 days based on scheduled card due dates,
 * rendering interactive CSS column charts, a 30-day calendar grid, and aggregate metrics.
 * Migrated to Preact with TypeScript for modular forecast rendering and full test parity.
 *
 * Architecture Role: Forecast Standalone Page Controller.
 * Context: Extension Standalone Tab (`features/dashboard/forecast/forecast.html`).
 * Key Exports:
 * - `ForecastMetricsHeader`: Preact component for workload metrics summary tiles.
 * - `ForecastCalendarCell`: Preact component rendering an individual calendar day cell.
 * - `ForecastCalendar`: Preact component rendering the 30-day forecast calendar.
 * - `ForecastChart`: Preact component rendering the daily review volume bar chart.
 * - `ForecastDashboard`: Main dashboard class calculating daily review loads and rendering charts.
 */

import { h, VNode } from 'preact';
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { Card, StorageData, ExtensionSettings } from '../../../types/domain';
import { FORECAST_DAYS_TO_SHOW, DAY_NAMES_SHORT } from '../../common/constants';

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface ForecastMetricsHeaderProps {
    totalUpcoming: number;
    avgPerDay: string;
    peakCount: number;
    todayCount: number;
    subtitle: string;
}

/**
 * Preact component rendering workload metrics summary header.
 */
export function ForecastMetricsHeader({
    totalUpcoming,
    avgPerDay,
    peakCount,
    todayCount,
    subtitle
}: ForecastMetricsHeaderProps): VNode {
    return (
        <div className="forecast-metrics-summary">
            <div id="forecast-subtitle" className="forecast-subtitle">{subtitle}</div>
            <div className="metrics-grid">
                <div className="metric-card">
                    <span className="metric-label">Due Today</span>
                    <span id="forecast-today" className="metric-value">{todayCount}</span>
                </div>
                <div className="metric-card">
                    <span className="metric-label">Total (30 Days)</span>
                    <span id="forecast-total" className="metric-value">{totalUpcoming}</span>
                </div>
                <div className="metric-card">
                    <span className="metric-label">Daily Average</span>
                    <span id="forecast-avg" className="metric-value">{avgPerDay}</span>
                </div>
                <div className="metric-card">
                    <span className="metric-label">Peak Workload</span>
                    <span id="forecast-peak" className="metric-value">{peakCount}</span>
                </div>
            </div>
        </div>
    );
}

export interface ForecastCalendarCellProps {
    dayNumber: number;
    count: number;
    isToday: boolean;
    level: 0 | 1 | 2 | 3 | 4;
    title: string;
    onClick?: () => void;
}

/**
 * Preact component rendering a single calendar day cell with review count pill.
 */
export function ForecastCalendarCell({
    dayNumber,
    count,
    isToday,
    level,
    title,
    onClick
}: ForecastCalendarCellProps): VNode {
    return (
        <div
            className={`cal-cell ${isToday ? 'cal-today' : ''} cal-level-${level}`}
            title={title}
            onClick={count > 0 ? onClick : undefined}
            style={{ cursor: count > 0 ? 'pointer' : 'default' }}
        >
            <span className="cal-day">{dayNumber}</span>
            <span className="cal-count">{count > 0 ? count : ''}</span>
        </div>
    );
}

export interface ForecastCalendarProps {
    startDow: number;
    cells: ForecastCalendarCellProps[];
    dayNames?: string[];
}

/**
 * Preact component rendering 30-day forecast calendar with weekday headers and legend.
 */
export function ForecastCalendar({
    startDow,
    cells,
    dayNames = DAY_NAMES_SHORT
}: ForecastCalendarProps): VNode {
    return (
        <div className="forecast-calendar-container">
            <div id="forecast-calendar" className="forecast-calendar">
                {dayNames.map((name) => (
                    <div key={name} className="cal-header">{name}</div>
                ))}
                {Array.from({ length: startDow }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="cal-cell cal-empty" />
                ))}
                {cells.map((cell, idx) => (
                    <ForecastCalendarCell key={`cell-${idx}`} {...cell} />
                ))}
            </div>
            <div className="cal-legend">
                <span className="cal-legend-label">Less</span>
                <div className="cal-legend-cell cal-level-0" />
                <div className="cal-legend-cell cal-level-1" />
                <div className="cal-legend-cell cal-level-2" />
                <div className="cal-legend-cell cal-level-3" />
                <div className="cal-legend-cell cal-level-4" />
                <span className="cal-legend-label">More</span>
            </div>
        </div>
    );
}

export interface ForecastChartProps {
    dataPoints: Array<{
        index: number;
        label: string;
        value: number;
        displayDate: string;
        level: number;
        onClick?: () => void;
    }>;
    maxLimit: number;
}

/**
 * Preact component rendering the 30-day workload forecast bar chart.
 */
export function ForecastChart({ dataPoints, maxLimit }: ForecastChartProps): VNode {
    return (
        <div id="forecast-chart-wrapper" className="chart-wrapper">
            <h3 className="chart-title-label">Workload Forecast (Next 30 Days)</h3>
            <div className="chart-container-inner">
                <div className="chart-viewport">
                    <div className="chart-grid-lines">
                        <div className="grid-line" style={{ bottom: '0%' }}><span>0</span></div>
                        <div className="grid-line" style={{ bottom: '50%' }}><span>{Math.round(maxLimit / 2)}</span></div>
                        <div className="grid-line" style={{ bottom: '100%' }}><span>{maxLimit}</span></div>
                    </div>
                    <div className="chart-bars">
                        {dataPoints.map((dp) => {
                            const heightPct = (dp.value / maxLimit) * 100;
                            const isZero = dp.value === 0;
                            const tooltipText = `${dp.displayDate}: ${dp.value} card${dp.value !== 1 ? 's' : ''} due`;

                            let levelClass = '';
                            if (!isZero) {
                                if (dp.value <= 2) levelClass = 'cal-bar-level-1';
                                else if (dp.value <= 5) levelClass = 'cal-bar-level-2';
                                else if (dp.value <= 10) levelClass = 'cal-bar-level-3';
                                else levelClass = 'cal-bar-level-4';
                            }

                            return (
                                <div
                                    key={dp.index}
                                    className={`chart-bar-col ${dp.value > 0 ? 'has-value' : ''}`}
                                    style={{ cursor: dp.value > 0 ? 'pointer' : 'default' }}
                                    onClick={dp.value > 0 ? dp.onClick : undefined}
                                >
                                    <div
                                        className={`chart-bar ${isZero ? 'zero-bar' : levelClass}`}
                                        style={{ height: `${Math.max(heightPct, 3)}%` }}
                                    >
                                        <div className="chart-bar-tooltip">{tooltipText}</div>
                                    </div>
                                    <div className="chart-bar-label">{dp.label}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORECAST CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Controller for the review workload forecast dashboard page.
 * Aggregates card due dates across the next 30 days and renders an interactive
 * column chart and calendar view allowing drill-down into specific forecast dates.
 */
export class ForecastDashboard {
    /** Cached extension settings, including chart visibility toggles. */
    extensionSettings: ExtensionSettings;

    /**
     * Creates an instance of ForecastDashboard with initial empty settings.
     */
    constructor() {
        this.extensionSettings = {};
    }

    /**
     * Bootstraps forecast settings and triggers UI loads by fetching card data from local storage.
     * @listens chrome.storage.local
     */
    init(): void {
        try {
            chrome.storage.local.get(['fsrsCards', 'extensionSettings'], (result: StorageData) => {
                try {
                    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                    if (lastError) {
                        const errorMessage = lastError.message || String(lastError);
                        Logger.error('ForecastDashboard', `Storage error fetching forecast data: ${errorMessage}`, { error: lastError });
                        return;
                    }

                    const cards: Card[] = result.fsrsCards || [];
                    this.extensionSettings = result.extensionSettings || {};
                    this.renderForecast(cards);
                } catch (innerErr) {
            UIUtils.catchError('ForecastDashboard', 'Error rendering forecast', innerErr);
        }
            });
        } catch (err) {
            UIUtils.catchError('ForecastDashboard', 'Failed storage get in Forecast init', err);
        }
    }

    /**
     * Orchestrates the grouping of cards by due date, calculates peak/total workload stats,
     * and renders both the workload forecast chart and the 30-day forecast calendar.
     */
    renderForecast(cards: Card[]): void {
        try {
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const daysToShow = FORECAST_DAYS_TO_SHOW;

            const dueCounts: Record<number, number> = {};
            let pastDueCount = 0;

            cards.forEach((card: Card) => {
                if (card.state === 0) return; // Ignore 'New' unstudied cards in spaced-repetition forecast

                const dueDate = new Date(card.due);
                const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                
                const diffDays = Math.round((dueDay.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                    pastDueCount++;
                } else if (diffDays <= daysToShow) {
                    const key = diffDays;
                    dueCounts[key] = (dueCounts[key] || 0) + 1;
                }
            });

            dueCounts[0] = (dueCounts[0] || 0) + pastDueCount;

            let totalUpcoming = 0;
            let peakCount = 0;

            for (let i = 0; i <= daysToShow; i++) {
                const count = dueCounts[i] || 0;
                totalUpcoming += count;
                
                if (i > 0 && count > peakCount) {
                    peakCount = count;
                }
            }

            const avgPerDay = totalUpcoming > 0 ? (totalUpcoming / (daysToShow + 1)).toFixed(1) : '0';

            const totalEl = document.getElementById('forecast-total');
            const avgEl = document.getElementById('forecast-avg');
            const peakEl = document.getElementById('forecast-peak');
            const todayEl = document.getElementById('forecast-today');
            const subtitleEl = document.getElementById('forecast-subtitle');

            if (totalEl) totalEl.textContent = String(totalUpcoming);
            if (avgEl) avgEl.textContent = avgPerDay;
            if (peakEl) peakEl.textContent = String(peakCount);
            if (todayEl) todayEl.textContent = String(dueCounts[0] || 0);
            if (subtitleEl) {
                subtitleEl.textContent = `${cards.length} total cards · Next 30 days starting ${this.formatDateShort(todayStart)}`;
            }

            this.renderForecastChart(dueCounts, todayStart, daysToShow);

            const calendar = document.getElementById('forecast-calendar');
            if (!calendar) return;
            calendar.innerHTML = '';

            const dayNames = DAY_NAMES_SHORT;
            dayNames.forEach(name => {
                const header = document.createElement('div');
                header.className = 'cal-header';
                header.textContent = name;
                calendar.appendChild(header);
            });

            const startDow = todayStart.getDay();
            for (let i = 0; i < startDow; i++) {
                const empty = document.createElement('div');
                empty.className = 'cal-cell cal-empty';
                calendar.appendChild(empty);
            }

            for (let i = 0; i <= daysToShow; i++) {
                const date = new Date(todayStart);
                date.setDate(date.getDate() + i);
                const count = dueCounts[i] || 0;

                const cell = document.createElement('div');
                cell.className = 'cal-cell';
                if (i === 0) cell.classList.add('cal-today');

                if (count === 0) cell.classList.add('cal-level-0');
                else if (count <= 2) cell.classList.add('cal-level-1');
                else if (count <= 5) cell.classList.add('cal-level-2');
                else if (count <= 10) cell.classList.add('cal-level-3');
                else cell.classList.add('cal-level-4');

                cell.innerHTML = `
                    <span class="cal-day">${date.getDate()}</span>
                    <span class="cal-count">${count > 0 ? count : ''}</span>
                `;
                cell.title = `${this.formatDateFull(date)}: ${count} card${count !== 1 ? 's' : ''} due`;

                const cellDateStr = this.formatDateKey(date);
                const cellDayOffset = i;
                cell.addEventListener('click', () => {
                    try {
                        if (count === 0) return;
                        const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=forecast&date=${cellDateStr}&offset=${cellDayOffset}`);
                        chrome.tabs.create({ url: dataUrl }, () => {
                            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                            if (lastError) {
                                const errorMessage = lastError.message || String(lastError);
                                Logger.error('ForecastDashboard', `Error creating tab on calendar cell click: ${errorMessage}`, { cellDateStr, error: lastError });
                            }
                        });
                    } catch (clickErr) {
            UIUtils.catchError('ForecastDashboard', 'Error in calendar cell click handler', clickErr, { cellDateStr });
        }
                });

                calendar.appendChild(cell);
            }

            const legend = document.createElement('div');
            legend.className = 'cal-legend';
            legend.innerHTML = `
                <span class="cal-legend-label">Less</span>
                <div class="cal-legend-cell cal-level-0"></div>
                <div class="cal-legend-cell cal-level-1"></div>
                <div class="cal-legend-cell cal-level-2"></div>
                <div class="cal-legend-cell cal-level-3"></div>
                <div class="cal-legend-cell cal-level-4"></div>
                <span class="cal-legend-label">More</span>
            `;
            calendar.parentElement?.appendChild(legend);
        } catch (err) {
            UIUtils.catchError('ForecastDashboard', 'Error orchestrating forecast rendering', err);
        }
    }

    /**
     * Formats a date object into a short localized string (e.g., "Jan 5").
     * @param date - Date to format.
     * @returns Formatted short date string.
     */
    formatDateShort(date: Date): string {
        try {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ForecastDashboard', `Error formatting short date: ${errorMessage}`, { date, err });
            return date.toDateString();
        }
    }

    /**
     * Formats a date object into a full localized string with weekday (e.g., "Mon, Jan 5").
     * @param date - Date to format.
     * @returns Formatted full date string.
     */
    formatDateFull(date: Date): string {
        try {
            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ForecastDashboard', `Error formatting full date: ${errorMessage}`, { date, err });
            return date.toDateString();
        }
    }

    /**
     * Formats a date object into an ISO-style date key (`YYYY-MM-DD`) in local time.
     * @param date - Date to convert.
     * @returns `YYYY-MM-DD` date key string.
     */
    formatDateKey(date: Date): string {
        try {
            return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ForecastDashboard', `Error formatting date key: ${errorMessage}`, { date, err });
            return new Date().toISOString().split('T')[0];
        }
    }

    /**
     * Renders a responsive CSS column bar chart showing daily review volume projections.
     * @param dueCounts - Map of day offset index to projected number of due cards.
     * @param todayStart - Midnight timestamp of the current day.
     * @param daysToShow - Total number of forecast days to visualize.
     */
    renderForecastChart(dueCounts: Record<number, number>, todayStart: Date, daysToShow: number): void {
        try {
            const chartWrapper = document.getElementById('forecast-chart-wrapper');
            if (!chartWrapper) return;

            const showCharts = this.extensionSettings && this.extensionSettings.showCharts !== undefined
                ? this.extensionSettings.showCharts
                : true;

            if (!showCharts) {
                chartWrapper.style.display = 'none';
                return;
            }

            chartWrapper.style.display = 'block';
            chartWrapper.innerHTML = '';

            const title = document.createElement('h3');
            title.className = 'chart-title-label';
            title.innerText = 'Workload Forecast (Next 30 Days)';
            chartWrapper.appendChild(title);

            const chartContainerInner = document.createElement('div');
            chartContainerInner.className = 'chart-container-inner';

            const viewport = document.createElement('div');
            viewport.className = 'chart-viewport';

            let maxVal = 0;
            const dataPoints: Array<{ index: number; dateStr: string; displayDate: string; value: number }> = [];

            for (let i = 0; i <= daysToShow; i++) {
                const count = dueCounts[i] || 0;
                if (count > maxVal) maxVal = count;

                const date = new Date(todayStart);
                date.setDate(date.getDate() + i);

                dataPoints.push({
                    index: i,
                    dateStr: this.formatDateKey(date),
                    displayDate: this.formatDateFull(date),
                    value: count
                });
            }

            const maxLimit = Math.max(maxVal, 1);

            const gridLines = document.createElement('div');
            gridLines.className = 'chart-grid-lines';
            gridLines.innerHTML = `
                <div class="grid-line" style="bottom: 0%;"><span>0</span></div>
                <div class="grid-line" style="bottom: 50%;"><span>${Math.round(maxLimit / 2)}</span></div>
                <div class="grid-line" style="bottom: 100%;"><span>${maxLimit}</span></div>
            `;
            viewport.appendChild(gridLines);

            const barsContainer = document.createElement('div');
            barsContainer.className = 'chart-bars';

            dataPoints.forEach(dp => {
                const barCol = document.createElement('div');
                barCol.className = 'chart-bar-col';
                if (dp.value > 0) barCol.classList.add('has-value');

                const heightPct = (dp.value / maxLimit) * 100;

                const bar = document.createElement('div');
                bar.className = 'chart-bar';
                bar.style.height = `${Math.max(heightPct, 3)}%`;

                if (dp.value === 0) {
                    bar.classList.add('zero-bar');
                } else {
                    if (dp.value <= 2) bar.classList.add('cal-bar-level-1');
                    else if (dp.value <= 5) bar.classList.add('cal-bar-level-2');
                    else if (dp.value <= 10) bar.classList.add('cal-bar-level-3');
                    else bar.classList.add('cal-bar-level-4');
                }

                const tooltip = document.createElement('div');
                tooltip.className = 'chart-bar-tooltip';
                tooltip.innerText = `${dp.displayDate}: ${dp.value} card${dp.value !== 1 ? 's' : ''} due`;
                bar.appendChild(tooltip);

                const barLabel = document.createElement('div');
                barLabel.className = 'chart-bar-label';
                
                if (dp.index === 0) {
                    barLabel.innerText = 'Today';
                } else if (dp.index % 5 === 0) {
                    barLabel.innerText = `+${dp.index}`;
                } else {
                    barLabel.innerText = '';
                }

                barCol.appendChild(bar);
                barCol.appendChild(barLabel);

                if (dp.value > 0) {
                    barCol.style.cursor = 'pointer';
                    barCol.addEventListener('click', () => {
                        try {
                            const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=forecast&date=${dp.dateStr}&offset=${dp.index}`);
                            chrome.tabs.create({ url: dataUrl }, () => {
                                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                if (lastError) {
                                    const errorMessage = lastError.message || String(lastError);
                                    Logger.error('ForecastDashboard', `Error creating tab on forecast chart bar click: ${errorMessage}`, { dateStr: dp.dateStr, error: lastError });
                                }
                            });
                        } catch (clickErr) {
            UIUtils.catchError('ForecastDashboard', 'Error in chart bar click handler', clickErr, { dp });
        }
                    });
                }

                barsContainer.appendChild(barCol);
            });

            viewport.appendChild(barsContainer);
            chartContainerInner.appendChild(viewport);
            chartWrapper.appendChild(chartContainerInner);
        } catch (err) {
            UIUtils.catchError('ForecastDashboard', 'Error rendering forecast chart', err);
        }
    }
}

/**
 * Initializes the forecast dashboard controller on DOM load.
 */
function initForecast(): void {
    try {
        const forecast = new ForecastDashboard();
        forecast.init();
    } catch (err) {
            UIUtils.catchError('ForecastDashboard', 'Initialization failed', err);
        }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initForecast);
    } else {
        initForecast();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).ForecastDashboard = ForecastDashboard;
    (module.exports as any).ForecastMetricsHeader = ForecastMetricsHeader;
    (module.exports as any).ForecastCalendarCell = ForecastCalendarCell;
    (module.exports as any).ForecastCalendar = ForecastCalendar;
    (module.exports as any).ForecastChart = ForecastChart;
}

