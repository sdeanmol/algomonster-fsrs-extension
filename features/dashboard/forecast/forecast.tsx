/**
 * @file features/dashboard/forecast/forecast.tsx
 * @description Main controller for the dedicated review forecast dashboard page.
 * Projects upcoming review volumes up to 30 days based on scheduled card due dates,
 * rendering interactive CSS column charts, a 30-day calendar grid, and aggregate metrics.
 * Migrated to a component-driven Preact architecture with minimal HTML entry shells and declarative rendering.
 *
 * Architecture Role: Forecast Standalone Page Controller and Preact Root App.
 * Context: Extension Standalone Tab (`features/dashboard/forecast/forecast.html`).
 * Key Exports:
 * - `ForecastMetricsHeader`: Preact component for workload metrics summary tiles.
 * - `ForecastSummaryCards`: Preact component for the 4 overview metrics tiles.
 * - `ForecastCalendarCell`: Preact component rendering an individual calendar day cell.
 * - `ForecastCalendar`: Preact component rendering the 30-day forecast calendar.
 * - `ForecastChart`: Preact component rendering the daily review volume bar chart.
 * - `ForecastApp`: Root Preact application rendering the entire forecast dashboard.
 * - `ForecastDashboard`: Main dashboard class calculating daily review loads and rendering charts.
 */

import { h, VNode, render } from 'preact';
import { useState, useEffect, useMemo } from 'preact/hooks';
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

export interface ForecastSummaryCardsProps {
    totalUpcoming: number | string;
    avgPerDay: string;
    peakCount: number | string;
    todayCount: number | string;
}

/**
 * Preact component rendering the 4 top-level overview cards.
 */
export function ForecastSummaryCards({
    totalUpcoming,
    avgPerDay,
    peakCount,
    todayCount
}: ForecastSummaryCardsProps): VNode {
    return (
        <div className="forecast-summary">
            <div className="summary-card">
                <div className="summary-value" id="forecast-total">{totalUpcoming}</div>
                <div className="summary-label">Next 30 Days</div>
            </div>
            <div className="summary-card">
                <div className="summary-value" id="forecast-avg">{avgPerDay}</div>
                <div className="summary-label">Daily Average</div>
            </div>
            <div className="summary-card">
                <div className="summary-value" id="forecast-peak">{peakCount}</div>
                <div className="summary-label">Peak Day</div>
            </div>
            <div className="summary-card">
                <div className="summary-value" id="forecast-today">{todayCount}</div>
                <div className="summary-label">Due Today</div>
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
    startDow?: number;
    cells: ForecastCalendarCellProps[];
}

/**
 * Preact component rendering the 30-day forecast calendar grid with headers and legend.
 */
export function ForecastCalendar({ startDow = 0, cells = [] }: ForecastCalendarProps): VNode {
    const emptyCells = Array.from({ length: startDow });

    return (
        <div className="forecast-calendar-wrapper">
            <div className="forecast-calendar" id="forecast-calendar">
                {DAY_NAMES_SHORT.map((name) => (
                    <div key={name} className="cal-header">{name}</div>
                ))}
                {emptyCells.map((_, idx) => (
                    <div key={`empty-${idx}`} className="cal-cell cal-empty" />
                ))}
                {cells.map((day, idx) => (
                    <ForecastCalendarCell key={idx} {...day} />
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

export interface ForecastDataPoint {
    index: number;
    label?: string;
    dateStr?: string;
    displayDate: string;
    value: number;
    level?: number;
    onClick?: () => void;
}

export interface ForecastChartProps {
    dataPoints: ForecastDataPoint[];
    maxLimit: number;
    onBarClick?: (dp: ForecastDataPoint) => void;
}

/**
 * Preact component rendering the CSS column bar chart for daily workload volumes.
 */
export function ForecastChart({ dataPoints, maxLimit, onBarClick }: ForecastChartProps): VNode {
    const limit = Math.max(maxLimit, 1);

    return (
        <div id="forecast-chart-wrapper" className="panel chart-panel" style={{ marginBottom: '24px', display: 'block' }}>
            <h3 className="chart-title-label">Workload Forecast (Next 30 Days)</h3>
            <div className="chart-container-inner">
                <div className="chart-viewport">
                    <div className="chart-grid-lines">
                        <div className="grid-line" style={{ bottom: '0%' }}><span>0</span></div>
                        <div className="grid-line" style={{ bottom: '50%' }}><span>{Math.round(limit / 2)}</span></div>
                        <div className="grid-line" style={{ bottom: '100%' }}><span>{limit}</span></div>
                    </div>
                    <div className="chart-bars">
                        {dataPoints.map((dp) => {
                            const heightPct = (dp.value / limit) * 100;
                            let levelClass = 'zero-bar';
                            if (dp.value > 0) {
                                if (dp.value <= 2) levelClass = 'cal-bar-level-1';
                                else if (dp.value <= 5) levelClass = 'cal-bar-level-2';
                                else if (dp.value <= 10) levelClass = 'cal-bar-level-3';
                                else levelClass = 'cal-bar-level-4';
                            }

                            const handleClick = () => {
                                if (dp.onClick) dp.onClick();
                                if (onBarClick) onBarClick(dp);
                            };

                            const labelText = dp.label !== undefined
                                ? dp.label
                                : dp.index === 0 ? 'Today' : dp.index % 5 === 0 ? `+${dp.index}` : '';

                            return (
                                <div
                                    key={dp.index}
                                    className={`chart-bar-col ${dp.value > 0 ? 'has-value' : ''}`}
                                    style={{ cursor: dp.value > 0 || dp.onClick ? 'pointer' : 'default' }}
                                    onClick={handleClick}
                                >
                                    <div
                                        className={`chart-bar ${levelClass}`}
                                        style={{ height: `${Math.max(heightPct, 3)}%` }}
                                    >
                                        <div className="chart-bar-tooltip">
                                            {`${dp.displayDate}: ${dp.value} card${dp.value !== 1 ? 's' : ''} due`}
                                        </div>
                                    </div>
                                    <div className="chart-bar-label">
                                        {labelText}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

export interface ForecastAppProps {
    initialCards?: Card[];
    initialSettings?: ExtensionSettings;
}

/**
 * Root Preact Component for the full review forecast page.
 * Renders header, 4-metric summary cards, workload bar chart, calendar grid, and legend.
 */
export function ForecastApp({ initialCards, initialSettings }: ForecastAppProps): VNode {
    const [cards, setCards] = useState<Card[]>(initialCards || []);
    const [settings, setSettings] = useState<ExtensionSettings>(initialSettings || {});

    useEffect(() => {
        if (!initialCards && typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.get(['fsrsCards', 'extensionSettings'], (result: StorageData) => {
                if (result.fsrsCards) setCards(result.fsrsCards);
                if (result.extensionSettings) setSettings(result.extensionSettings);
            });
        }
    }, [initialCards]);

    const showCharts = settings.showCharts !== undefined ? settings.showCharts : true;

    const { summary, dataPoints, maxVal, calendarCells, startDow } = useMemo(() => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayStartTime = todayStart.getTime();

        const dueCounts: Record<number, number> = {};
        for (let i = 0; i <= FORECAST_DAYS_TO_SHOW; i++) {
            dueCounts[i] = 0;
        }

        cards.forEach((card) => {
            if (card.state === 0) return;
            const diffMs = card.due - todayStartTime;
            const dayOffset = Math.floor(diffMs / 86400000);
            if (dayOffset <= 0) {
                dueCounts[0] = (dueCounts[0] || 0) + 1;
            } else if (dayOffset <= FORECAST_DAYS_TO_SHOW) {
                dueCounts[dayOffset] = (dueCounts[dayOffset] || 0) + 1;
            }
        });

        let totalUpcoming = 0;
        let peak = 0;
        const pts: ForecastDataPoint[] = [];

        for (let i = 0; i <= FORECAST_DAYS_TO_SHOW; i++) {
            const count = dueCounts[i] || 0;
            totalUpcoming += count;
            if (count > peak) peak = count;

            const date = new Date(todayStart);
            date.setDate(date.getDate() + i);

            pts.push({
                index: i,
                dateStr: new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0],
                displayDate: date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                value: count
            });
        }

        const avg = (totalUpcoming / (FORECAST_DAYS_TO_SHOW + 1)).toFixed(1);
        const todayCount = dueCounts[0] || 0;

        const cells: ForecastCalendarCellProps[] = [];
        for (let i = 0; i <= FORECAST_DAYS_TO_SHOW; i++) {
            const count = dueCounts[i] || 0;
            const date = new Date(todayStart);
            date.setDate(date.getDate() + i);

            let level: 0 | 1 | 2 | 3 | 4 = 0;
            if (count === 0) level = 0;
            else if (count <= 2) level = 1;
            else if (count <= 5) level = 2;
            else if (count <= 10) level = 3;
            else level = 4;

            const dateKey = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const fullDate = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

            const onCellClick = () => {
                try {
                    if (typeof chrome !== 'undefined' && chrome.tabs?.create && chrome.runtime?.getURL) {
                        const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=forecast&date=${dateKey}&offset=${i}`);
                        chrome.tabs.create({ url: dataUrl });
                    }
                } catch (err) {
                    UIUtils.catchError('ForecastDashboard', 'Error opening forecast date in data manager', err);
                }
            };

            cells.push({
                dayNumber: date.getDate(),
                count,
                isToday: i === 0,
                level,
                title: `${fullDate}: ${count} card${count !== 1 ? 's' : ''} due`,
                onClick: onCellClick
            });
        }

        return {
            summary: {
                totalUpcoming,
                avgPerDay: avg,
                peakCount: peak,
                todayCount
            },
            dataPoints: pts,
            maxVal: peak,
            calendarCells: cells,
            startDow: todayStart.getDay()
        };
    }, [cards]);

    const handleBarClick = (dp: ForecastDataPoint) => {
        try {
            if (typeof chrome !== 'undefined' && chrome.tabs?.create && chrome.runtime?.getURL) {
                const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=forecast&date=${dp.dateStr}&offset=${dp.index}`);
                chrome.tabs.create({ url: dataUrl });
            }
        } catch (err) {
            UIUtils.catchError('ForecastDashboard', 'Error navigating on bar click', err);
        }
    };

    return (
        <div className="container">
            <div className="header">
                <div className="header-main">
                    <div className="algorecall-brand-badge">
                        <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1 1-2 1-3.5 0-2.5 2-5 5.5-6z" />
                            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                            <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                        </svg>
                        <span className="algorecall-brand-name">AlgoRecall</span>
                    </div>
                    <h1>Review Forecast</h1>
                    <p className="subtitle" id="forecast-subtitle">{`${cards.length} total cards tracked`}</p>
                </div>
                <div className="header-actions">
                    <a href="../popup/popup.html" className="btn btn-secondary">
                        <svg className="svg-icon" viewBox="0 0 24 24" style={{ marginRight: '6px' }} aria-hidden="true">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        Back to Dashboard
                    </a>
                </div>
            </div>

            <ForecastSummaryCards
                totalUpcoming={summary.totalUpcoming}
                avgPerDay={summary.avgPerDay}
                peakCount={summary.peakCount}
                todayCount={summary.todayCount}
            />

            {showCharts && (
                <ForecastChart
                    dataPoints={dataPoints}
                    maxLimit={maxVal}
                    onBarClick={handleBarClick}
                />
            )}

            <div id="calendar-parent">
                <ForecastCalendar startDow={startDow} cells={calendarCells} />
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// FORECAST CONTROLLER CLASS (Backward-Compatibility Bridge)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Controller for the review workload forecast dashboard page.
 * Bridges storage interactions, computes daily card projections, and renders Preact views.
 */
export class ForecastDashboard {
    cards: Card[];
    extensionSettings: ExtensionSettings | null;

    constructor() {
        this.cards = [];
        this.extensionSettings = null;
    }

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

                    this.cards = result.fsrsCards || [];
                    this.extensionSettings = result.extensionSettings || null;

                    const root = document.getElementById('root');
                    if (root) {
                        render(<ForecastApp initialCards={this.cards} initialSettings={this.extensionSettings || undefined} />, root);
                    } else {
                        this.renderForecast();
                    }
                } catch (innerErr) {
                    UIUtils.catchError('ForecastDashboard', 'Error initializing forecast view', innerErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('ForecastDashboard', 'Failed to execute storage get in Forecast init', err);
        }
    }

    renderForecast(cardsToRender?: Card[]): void {
        try {
            const cards = cardsToRender || this.cards;
            this.cards = cards;

            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const daysToShow = FORECAST_DAYS_TO_SHOW;

            const dueCounts: Record<number, number> = {};
            let pastDueCount = 0;

            cards.forEach((card: Card) => {
                if (card.state === 0) return;

                const dueDate = new Date(card.due);
                const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                const diffDays = Math.round((dueDay.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                    pastDueCount++;
                } else if (diffDays <= daysToShow) {
                    dueCounts[diffDays] = (dueCounts[diffDays] || 0) + 1;
                }
            });

            dueCounts[0] = (dueCounts[0] || 0) + pastDueCount;

            let totalUpcoming = 0;
            let peakCount = 0;

            for (let i = 0; i <= daysToShow; i++) {
                const count = dueCounts[i] || 0;
                totalUpcoming += count;
                if (count > peakCount) peakCount = count;
            }

            const avgPerDay = totalUpcoming > 0 ? (totalUpcoming / (daysToShow + 1)).toFixed(1) : '0';
            const todayCount = dueCounts[0] || 0;

            const totalEl = document.getElementById('forecast-total');
            const avgEl = document.getElementById('forecast-avg');
            const peakEl = document.getElementById('forecast-peak');
            const todayEl = document.getElementById('forecast-today');
            const subtitleEl = document.getElementById('forecast-subtitle');

            if (totalEl) totalEl.textContent = String(totalUpcoming);
            if (avgEl) avgEl.textContent = avgPerDay;
            if (peakEl) peakEl.textContent = String(peakCount);
            if (todayEl) todayEl.textContent = String(todayCount);
            if (subtitleEl) {
                subtitleEl.textContent = `${cards.length} total cards · Next 30 days starting ${this.formatDateShort(todayStart)}`;
            }

            this.renderForecastChart(dueCounts, todayStart, daysToShow);
            this.renderCalendar(dueCounts, todayStart, daysToShow);
        } catch (err) {
            UIUtils.catchError('ForecastDashboard', 'Error rendering forecast metrics', err);
        }
    }

    renderCalendar(dueCounts: Record<number, number>, todayStart: Date, daysToShow: number): void {
        try {
            const calendar = document.getElementById('forecast-calendar');
            if (!calendar) return;

            const cells: ForecastCalendarCellProps[] = [];

            for (let i = 0; i <= daysToShow; i++) {
                const count = dueCounts[i] || 0;
                const date = new Date(todayStart);
                date.setDate(date.getDate() + i);

                let level: 0 | 1 | 2 | 3 | 4 = 0;
                if (count === 0) level = 0;
                else if (count <= 2) level = 1;
                else if (count <= 5) level = 2;
                else if (count <= 10) level = 3;
                else level = 4;

                const dateKey = this.formatDateKey(date);
                const fullDate = this.formatDateFull(date);

                const onCellClick = () => {
                    try {
                        if (count === 0) return;
                        const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=forecast&date=${dateKey}&offset=${i}`);
                        chrome.tabs.create({ url: dataUrl }, () => {
                            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                            if (lastError) {
                                const errorMessage = lastError.message || String(lastError);
                                Logger.error('ForecastDashboard', `Error creating tab on calendar cell click: ${errorMessage}`, { dateKey, error: lastError });
                            }
                        });
                    } catch (clickErr) {
                        UIUtils.catchError('ForecastDashboard', 'Error in calendar cell click handler', clickErr, { dateKey });
                    }
                };

                cells.push({
                    dayNumber: date.getDate(),
                    count,
                    isToday: i === 0,
                    level,
                    title: `${fullDate}: ${count} card${count !== 1 ? 's' : ''} due`,
                    onClick: onCellClick
                });
            }

            const startDow = todayStart.getDay();
            const emptyCells = Array.from({ length: startDow });

            render(
                <div>
                    {DAY_NAMES_SHORT.map((name) => (
                        <div key={name} className="cal-header">{name}</div>
                    ))}
                    {emptyCells.map((_, idx) => (
                        <div key={`empty-${idx}`} className="cal-cell cal-empty" />
                    ))}
                    {cells.map((day, idx) => (
                        <ForecastCalendarCell key={idx} {...day} />
                    ))}
                </div>,
                calendar
            );

            const parent = calendar.parentElement;
            if (parent && !parent.querySelector('.cal-legend')) {
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
                parent.appendChild(legend);
            }
        } catch (err) {
            UIUtils.catchError('ForecastDashboard', 'Error orchestrating forecast calendar rendering', err);
        }
    }

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

            let maxVal = 0;
            const dataPoints: ForecastDataPoint[] = [];

            for (let i = 0; i <= daysToShow; i++) {
                const count = dueCounts[i] || 0;
                if (count > maxVal) maxVal = count;

                const date = new Date(todayStart);
                date.setDate(date.getDate() + i);

                const dateStr = this.formatDateKey(date);
                const displayDate = this.formatDateFull(date);
                const index = i;

                const onBarClick = () => {
                    try {
                        const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=forecast&date=${dateStr}&offset=${index}`);
                        chrome.tabs.create({ url: dataUrl }, () => {
                            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                            if (lastError) {
                                const errorMessage = lastError.message || String(lastError);
                                Logger.error('ForecastDashboard', `Error creating tab on bar click: ${errorMessage}`, { dateStr, error: lastError });
                            }
                        });
                    } catch (clickErr) {
                        UIUtils.catchError('ForecastDashboard', 'Error in bar click handler', clickErr, { dateStr });
                    }
                };

                dataPoints.push({
                    index: i,
                    dateStr,
                    displayDate,
                    value: count,
                    onClick: onBarClick
                });
            }

            render(
                <ForecastChart
                    dataPoints={dataPoints}
                    maxLimit={maxVal}
                />,
                chartWrapper
            );
        } catch (err) {
            UIUtils.catchError('ForecastDashboard', 'Error rendering forecast chart', err);
        }
    }

    formatDateShort(date: Date): string {
        try {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ForecastDashboard', `Error formatting short date: ${errorMessage}`, { date, err });
            return date.toDateString();
        }
    }

    formatDateFull(date: Date): string {
        try {
            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ForecastDashboard', `Error formatting full date: ${errorMessage}`, { date, err });
            return date.toDateString();
        }
    }

    formatDateKey(date: Date): string {
        try {
            return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ForecastDashboard', `Error formatting date key: ${errorMessage}`, { date, err });
            return new Date().toISOString().split('T')[0];
        }
    }
}

/**
 * Initializes the forecast dashboard controller on DOM load.
 */
function initForecast(): void {
    try {
        const root = document.getElementById('root');
        if (root) {
            render(<ForecastApp />, root);
        } else {
            const dashboard = new ForecastDashboard();
            dashboard.init();
        }
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
    (module.exports as any).ForecastApp = ForecastApp;
    (module.exports as any).ForecastMetricsHeader = ForecastMetricsHeader;
    (module.exports as any).ForecastSummaryCards = ForecastSummaryCards;
    (module.exports as any).ForecastCalendarCell = ForecastCalendarCell;
    (module.exports as any).ForecastCalendar = ForecastCalendar;
    (module.exports as any).ForecastChart = ForecastChart;
}
