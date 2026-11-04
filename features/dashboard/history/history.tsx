/**
 * @file features/dashboard/history/history.tsx
 * @description Main controller and Preact components for the dedicated contribution and review history dashboard.
 * Aggregates review logs across year, month, or day granularities, renders interactive
 * CSS column charts, and displays clickable drill-down cards linked to detailed card views in `data.html`.
 * Migrated to Preact with TypeScript for modular history views and visual charts.
 *
 * Architecture Role: History Standalone Page Controller and Preact Root Component.
 * Context: Extension Standalone Tab (`features/dashboard/history/history.html`).
 * Key Exports:
 * - `HistoryViewToggle`: Preact component for toggling year/month/day view granularities.
 * - `HistoryBreadcrumb`: Preact component rendering drill-down breadcrumb navigation.
 * - `HistorySummaryCard`: Preact component rendering year/month/day drill-down card.
 * - `HistoryBarChart`: Preact component rendering distribution bars and axes.
 * - `HistoryApp`: Root Preact component owning layout, view mode, charts, and drill-down cards.
 * - `FSRSHistoryDashboard`: Controller class managing date grouping, view drill-downs, and chart rendering.
 */

import { h, VNode, render, Fragment } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { Card, StorageData, ExtensionSettings, ReviewLog } from '../../../types/domain';
import { MONTH_NAMES } from '../../common/constants';

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface HistoryViewToggleProps {
    currentView: string;
    onViewChange: (view: 'year' | 'month' | 'day') => void;
}

/**
 * Preact component for switching calendar view granularities (Year, Month, Day).
 */
export function HistoryViewToggle({ currentView, onViewChange }: HistoryViewToggleProps): VNode {
    return (
        <div className="view-toggle controls" role="group" aria-label="Calendar hierarchy level">
            <button
                id="view-year"
                className={`btn btn-secondary ${currentView === 'year' ? 'active' : ''}`}
                onClick={() => onViewChange('year')}
            >
                Years
            </button>
            <button
                id="view-month"
                className={`btn btn-secondary ${currentView === 'month' ? 'active' : ''}`}
                onClick={() => onViewChange('month')}
            >
                Months
            </button>
            <button
                id="view-day"
                className={`btn btn-secondary ${currentView === 'day' ? 'active' : ''}`}
                onClick={() => onViewChange('day')}
            >
                Days
            </button>
        </div>
    );
}

export interface HistoryBreadcrumbProps {
    currentView: string;
    selectedYear: string | null;
    selectedMonth: string | null;
    monthNames?: string[];
    onNavigateYear?: () => void;
    onNavigateMonth?: (year: string) => void;
}

/**
 * Preact component for breadcrumb navigation across Year -> Month -> Day levels.
 */
export function HistoryBreadcrumb({
    currentView,
    selectedYear,
    selectedMonth,
    monthNames = MONTH_NAMES,
    onNavigateYear,
    onNavigateMonth
}: HistoryBreadcrumbProps): VNode {
    const handleNavigateYear = () => {
        try {
            if (onNavigateYear) onNavigateYear();
        } catch (err) {
            UIUtils.catchError('HistoryBreadcrumb', 'Error navigating year', err);
        }
    };

    const handleNavigateMonth = () => {
        try {
            if (selectedYear && onNavigateMonth) onNavigateMonth(selectedYear);
        } catch (err) {
            UIUtils.catchError('HistoryBreadcrumb', 'Error navigating month', err);
        }
    };

    if (currentView === 'year') {
        return <div id="breadcrumb" className="breadcrumb">All Years</div>;
    }

    if (currentView === 'month') {
        return (
            <div id="breadcrumb" className="breadcrumb">
                <span className="bc-year" role="button" tabIndex={0} onClick={handleNavigateYear}>All Years</span>
                {' > '}
                {selectedYear}
            </div>
        );
    }

    const monthIndex = selectedMonth ? parseInt(selectedMonth.split('-')[1], 10) - 1 : 0;
    const monthName = monthNames[monthIndex] || '';

    return (
        <div id="breadcrumb" className="breadcrumb">
            <span className="bc-year" role="button" tabIndex={0} onClick={handleNavigateYear}>All Years</span>
            {' > '}
            <span
                className="bc-month"
                role="button"
                tabIndex={0}
                data-year={selectedYear || ''}
                onClick={handleNavigateMonth}
            >
                {selectedYear}
            </span>
            {' > '}
            {monthName}
        </div>
    );
}

export interface HistorySummaryCardProps {
    type: 'year' | 'month' | 'day';
    title: string;
    value: number;
    subtitle: string;
    activeDays?: number;
    year?: string;
    month?: string;
    date?: string;
    onCardClick?: () => void;
    onViewCards?: (e: Event) => void;
}

/**
 * Preact component rendering drill-down cards with review counts and jump buttons.
 */
export function HistorySummaryCard({
    type,
    title,
    value,
    subtitle,
    activeDays,
    year,
    month,
    date,
    onCardClick,
    onViewCards
}: HistorySummaryCardProps): VNode {
    const handleButtonClick = (e: Event) => {
        try {
            e.stopPropagation();
            if (onViewCards) onViewCards(e);
        } catch (err) {
            UIUtils.catchError('HistorySummaryCard', 'Error in view cards button click', err);
        }
    };

    const handleCardClick = () => {
        try {
            if (onCardClick) onCardClick();
        } catch (err) {
            UIUtils.catchError('HistorySummaryCard', 'Error in card click', err);
        }
    };

    if (type === 'year') {
        return (
            <div className="card card-year" data-year={year} title="Click to view Months" onClick={handleCardClick}>
                <div className="card-title">{title}</div>
                <div className="card-value">{value}</div>
                <div className="card-subtitle">
                    {subtitle}
                    {activeDays !== undefined && (
                        <span><br />Active Days: {activeDays}</span>
                    )}
                </div>
                <button className="view-data-btn btn-year" data-year={year} onClick={handleButtonClick}>
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '12px', height: '12px' }}>
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    View Cards
                </button>
            </div>
        );
    }

    if (type === 'month') {
        return (
            <div className="card card-month" data-year={year} data-month={month} title="Click to view Days" onClick={handleCardClick}>
                <div className="card-title">{title}</div>
                <div className="card-value">{value}</div>
                <div className="card-subtitle">{subtitle}</div>
                <button className="view-data-btn btn-month" data-month={month} onClick={handleButtonClick}>
                    <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '12px', height: '12px' }}>
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    View Cards
                </button>
            </div>
        );
    }

    return (
        <div className="card card-day" data-date={date} title="View cards reviewed on this day" onClick={handleCardClick}>
            <div className="card-title">{title}</div>
            <div className="card-value">{value}</div>
            <div className="card-subtitle">{subtitle}</div>
            <div className="card-day-link" onClick={handleButtonClick}>
                <svg className="svg-icon" viewBox="0 0 24 24" style={{ width: '12px', height: '12px', marginRight: '4px' }}>
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                View Cards
            </div>
        </div>
    );
}

export interface HistoryBarDataPoint {
    label: string;
    value: number;
    tooltip?: string;
    action?: (e?: Event) => void;
}

export interface HistoryBarChartProps {
    title: string;
    dataPoints: HistoryBarDataPoint[];
    maxVal: number;
}

/**
 * Preact component rendering CSS bar chart distributions.
 */
export function HistoryBarChart({ title, dataPoints, maxVal }: HistoryBarChartProps): VNode {
    return (
        <div className="chart-wrapper">
            <h3 className="chart-title-label">{title}</h3>
            <div className="chart-container-inner">
                <div className="chart-viewport">
                    <div className="chart-grid-lines">
                        <div className="grid-line" style={{ bottom: '0%' }}><span>0</span></div>
                        <div className="grid-line" style={{ bottom: '50%' }}><span>{Math.round(maxVal / 2)}</span></div>
                        <div className="grid-line" style={{ bottom: '100%' }}><span>{maxVal}</span></div>
                    </div>
                    <div className="chart-bars">
                        {dataPoints.map((dp, idx) => {
                            const heightPct = maxVal > 0 ? (dp.value / maxVal) * 100 : 0;
                            const tooltipText = dp.tooltip || `${dp.label}: ${dp.value} reviews`;

                            return (
                                <div
                                    key={idx}
                                    className={`chart-bar-col ${dp.value > 0 ? 'has-value' : ''}`}
                                    role={dp.action ? 'button' : undefined}
                                    tabIndex={dp.action ? 0 : undefined}
                                    aria-label={tooltipText}
                                    style={dp.action ? { cursor: 'pointer' } : undefined}
                                    onClick={(e) => {
                                        try {
                                            if (dp.action) dp.action(e);
                                        } catch (aErr) {
                                            UIUtils.catchError('HistoryBarChart', 'Error executing chart bar click action', aErr, { dp });
                                        }
                                    }}
                                    onKeyDown={(e: KeyboardEvent) => {
                                        if ((e.key === 'Enter' || e.key === ' ') && dp.action) {
                                            try {
                                                e.preventDefault();
                                                dp.action(e);
                                            } catch (aErr) {
                                                UIUtils.catchError('HistoryBarChart', 'Error executing chart bar keydown action', aErr, { dp });
                                            }
                                        }
                                    }}
                                >
                                    <div
                                        className={`chart-bar ${dp.value === 0 ? 'zero-bar' : ''}`}
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
// ROOT PREACT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export interface HistoryAppProps {
    dashboard?: FSRSHistoryDashboard;
}

export function HistoryApp({ dashboard: initialDashboard }: HistoryAppProps): VNode {
    const [dashboard] = useState(() => initialDashboard || new FSRSHistoryDashboard());
    const [currentView, setCurrentView] = useState<'year' | 'month' | 'day'>(
        (dashboard.currentView as 'year' | 'month' | 'day') || 'year'
    );
    const [selectedYear, setSelectedYear] = useState<string | null>(dashboard.selectedYear);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(dashboard.selectedMonth);
    const [activityData, setActivityData] = useState<Record<string, number>>(dashboard.activityData || {});
    const [extensionSettings, setExtensionSettings] = useState<ExtensionSettings>(dashboard.extensionSettings || {});
    const [, setRenderTrigger] = useState(0);

    const forceUpdate = () => setRenderTrigger(c => c + 1);

    useEffect(() => {
        dashboard.onUpdate = () => {
            setCurrentView((dashboard.currentView as 'year' | 'month' | 'day') || 'year');
            setSelectedYear(dashboard.selectedYear);
            setSelectedMonth(dashboard.selectedMonth);
            setActivityData({ ...dashboard.activityData });
            setExtensionSettings({ ...dashboard.extensionSettings });
            forceUpdate();
        };

        if (Object.keys(dashboard.activityData).length === 0) {
            dashboard.init();
        }
    }, [dashboard]);

    const handleSetView = (view: 'year' | 'month' | 'day', targetYear: string | null = null, targetMonth: string | null = null) => {
        dashboard.setView(view, targetYear, targetMonth);
        setCurrentView((dashboard.currentView as 'year' | 'month' | 'day') || 'year');
        setSelectedYear(dashboard.selectedYear);
        setSelectedMonth(dashboard.selectedMonth);
        forceUpdate();
    };

    const handleOpenDataTab = (dateRange: string, e?: Event) => {
        dashboard.openDataTab(dateRange, e);
    };

    const showCharts = extensionSettings.showCharts !== undefined ? extensionSettings.showCharts : true;
    const hasActivity = Object.keys(activityData).length > 0;
    const showChartWrapper = showCharts && hasActivity;

    let chartTitle = '';
    let chartDataPoints: HistoryBarDataPoint[] = [];

    if (showChartWrapper) {
        if (currentView === 'year') {
            chartTitle = 'Reviews per Year';
            const yearData = dashboard.aggregateByYear();
            const years = Object.keys(yearData).sort();
            chartDataPoints = years.map(yr => ({
                label: yr,
                value: yearData[yr].total,
                action: () => handleSetView('month', yr)
            }));
        } else if (currentView === 'month' && selectedYear) {
            chartTitle = `Reviews in ${selectedYear}`;
            const monthData = dashboard.aggregateByMonth(selectedYear);
            for (let m = 1; m <= 12; m++) {
                const mStr = m.toString().padStart(2, '0');
                const monthKey = `${selectedYear}-${mStr}`;
                const count = monthData[monthKey] ? monthData[monthKey].total : 0;
                chartDataPoints.push({
                    label: dashboard.monthNames[m - 1].substring(0, 3),
                    value: count,
                    action: () => handleSetView('day', selectedYear, monthKey),
                    tooltip: `${dashboard.monthNames[m - 1]} ${selectedYear}: ${count} reviews`
                });
            }
        } else if (currentView === 'day' && selectedMonth) {
            const [y, mo] = selectedMonth.split('-');
            const mIdx = parseInt(mo, 10) - 1;
            chartTitle = `Reviews in ${dashboard.monthNames[mIdx]} ${y}`;
            const dayData = dashboard.aggregateByDay(selectedMonth);
            const daysInMonth = new Date(parseInt(y, 10), parseInt(mo, 10), 0).getDate();

            for (let d = 1; d <= daysInMonth; d++) {
                const dStr = d.toString().padStart(2, '0');
                const dateStr = `${selectedMonth}-${dStr}`;
                const count = dayData[dateStr] || 0;
                chartDataPoints.push({
                    label: d.toString(),
                    value: count,
                    action: count > 0 ? (e?: Event) => handleOpenDataTab(dateStr, e) : undefined,
                    tooltip: `${new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${count} reviews`
                });
            }
        }
    }

    const chartMaxVal = chartDataPoints.length > 0 ? Math.max(...chartDataPoints.map(p => p.value), 1) : 1;

    let cardsContent: VNode | VNode[];
    if (!hasActivity) {
        cardsContent = <div className="empty-state">No contribution activity recorded yet. Start reviewing!</div>;
    } else if (currentView === 'year') {
        const yearData = dashboard.aggregateByYear();
        const years = Object.keys(yearData).sort().reverse();
        cardsContent = (
            <Fragment>
                {years.map(yr => (
                    <HistorySummaryCard
                        key={yr}
                        type="year"
                        title={yr}
                        value={yearData[yr].total}
                        subtitle="Patterns Reviewed"
                        activeDays={yearData[yr].activeDays}
                        year={yr}
                        onCardClick={() => handleSetView('month', yr)}
                        onViewCards={(e) => handleOpenDataTab(yr, e)}
                    />
                ))}
            </Fragment>
        );
    } else if (currentView === 'month' && selectedYear) {
        const monthData = dashboard.aggregateByMonth(selectedYear);
        const monthKeys = Object.keys(monthData).sort().reverse();
        if (monthKeys.length === 0) {
            cardsContent = <div className="empty-state">No activity in {selectedYear}</div>;
        } else {
            cardsContent = (
                <Fragment>
                    {monthKeys.map(monthKey => {
                        const mIndex = parseInt(monthKey.split('-')[1], 10) - 1;
                        return (
                            <HistorySummaryCard
                                key={monthKey}
                                type="month"
                                title={dashboard.monthNames[mIndex]}
                                value={monthData[monthKey].total}
                                subtitle="Patterns Reviewed"
                                year={selectedYear}
                                month={monthKey}
                                onCardClick={() => handleSetView('day', selectedYear, monthKey)}
                                onViewCards={(e) => handleOpenDataTab(monthKey, e)}
                            />
                        );
                    })}
                </Fragment>
            );
        }
    } else if (currentView === 'day' && selectedMonth) {
        const dayData = dashboard.aggregateByDay(selectedMonth);
        const dateStrings = Object.keys(dayData).sort().reverse();
        if (dateStrings.length === 0) {
            cardsContent = <div className="empty-state">No activity in this month.</div>;
        } else {
            cardsContent = (
                <Fragment>
                    {dateStrings.map(dateString => {
                        const dateObj = new Date(dateString);
                        const displayDate = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                        return (
                            <HistorySummaryCard
                                key={dateString}
                                type="day"
                                title={displayDate}
                                value={dayData[dateString]}
                                subtitle="Cards Reviewed"
                                date={dateString}
                                onCardClick={() => handleOpenDataTab(dateString)}
                                onViewCards={(e) => handleOpenDataTab(dateString, e)}
                            />
                        );
                    })}
                </Fragment>
            );
        }
    } else {
        cardsContent = <div className="empty-state">No activity recorded.</div>;
    }

    return (
        <div className="container">
            <div className="header">
                <div>
                    <div className="algorecall-brand-badge">
                        <svg className="svg-icon logo-icon algorecall-brand-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z" />
                            <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z" />
                            <path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2" />
                        </svg>
                        <span className="algorecall-brand-name">AlgoRecall</span>
                    </div>
                    <h1>
                        <svg className="svg-icon page-header-icon" viewBox="0 0 24 24" aria-hidden="true">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                        Review Activity History
                    </h1>
                    <HistoryBreadcrumb
                        currentView={currentView}
                        selectedYear={selectedYear}
                        selectedMonth={selectedMonth}
                        monthNames={dashboard.monthNames}
                        onNavigateYear={() => handleSetView('year')}
                        onNavigateMonth={(yr) => handleSetView('month', yr)}
                    />
                </div>
                <HistoryViewToggle
                    currentView={currentView}
                    onViewChange={(v) => handleSetView(v)}
                />
            </div>

            <div
                id="history-chart-wrapper"
                className="panel chart-panel"
                style={{ marginBottom: '24px', display: showChartWrapper ? 'block' : 'none' }}
            >
                {showChartWrapper && (
                    <HistoryBarChart
                        title={chartTitle}
                        dataPoints={chartDataPoints}
                        maxVal={chartMaxVal}
                    />
                )}
            </div>

            <div id="chart-container" className={`grid grid-${currentView}s`}>
                {cardsContent}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY DASHBOARD CONTROLLER CLASS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Controller for the review activity history dashboard page.
 * Manages calendar hierarchies (year -> month -> day), aggregates review frequencies,
 * and handles drill-down navigation into specific review logs.
 */
export class FSRSHistoryDashboard {
    /** Map of ISO date strings (`YYYY-MM-DD`) to count of reviews completed on that date. */
    activityData: Record<string, number>;
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
    /** State change observer callback. */
    onUpdate?: () => void;

    /**
     * Initializes default history dashboard state with empty activity data and year view.
     */
    constructor() {
        this.activityData = {};
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
    attachListeners(): void {
        try {
            document.getElementById('view-year')?.addEventListener('click', () => {
                try {
                    this.setView('year');
                } catch (err) {
                    UIUtils.catchError('FSRSHistoryDashboard', 'Error setting view to year', err);
                }
            });
            document.getElementById('view-month')?.addEventListener('click', () => {
                try {
                    this.setView('month');
                } catch (err) {
                    UIUtils.catchError('FSRSHistoryDashboard', 'Error setting view to month', err);
                }
            });
            document.getElementById('view-day')?.addEventListener('click', () => {
                try {
                    this.setView('day');
                } catch (err) {
                    UIUtils.catchError('FSRSHistoryDashboard', 'Error setting view to day', err);
                }
            });
        } catch (err) {
            UIUtils.catchError('FSRSHistoryDashboard', 'Error attaching view listeners', err);
        }
    }

    /**
     * Switches the current calendar hierarchy level and re-renders the dashboard.
     * @param view - View mode ('year', 'month', or 'day').
     * @param targetYear - Optional specific year to inspect.
     * @param targetMonth - Optional specific year-month (e.g. '2026-03') to inspect.
     */
    setView(view: string, targetYear: string | null = null, targetMonth: string | null = null): void {
        try {
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
        } catch (err) {
            UIUtils.catchError('FSRSHistoryDashboard', 'Error setting history dashboard view', err, { view, targetYear, targetMonth });
        }
    }

    /**
     * Determines the most recent year with logged reviews, or falls back to current year.
     * @returns 4-digit year string.
     */
    getMostRecentYear(): string {
        try {
            const years = Object.keys(this.aggregateByYear());
            return years.length > 0 ? years.sort().reverse()[0] : new Date().getFullYear().toString();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSHistoryDashboard', `Error getting most recent year: ${errorMessage}`, { err });
            return new Date().getFullYear().toString();
        }
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
     * Opens a new browser tab navigating to `data.html` filtered to cards reviewed in `dateRange`.
     * @param dateRange - ISO date string or year/month prefix to query.
     * @param event - Optional click event to prevent propagation.
     */
    openDataTab(dateRange: string, event?: Event): void {
        try {
            if (event) event.stopPropagation();
            chrome.tabs.create({ url: `features/common/data/data.html?view=history&date=${dateRange}` }, () => {
                const tabError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (tabError) {
                    const errorMessage = tabError.message || String(tabError);
                    Logger.error('FSRSHistoryDashboard', `Error creating tab in openDataTab: ${errorMessage}`, { dateRange, error: tabError });
                }
            });
        } catch (err) {
            UIUtils.catchError('FSRSHistoryDashboard', 'Error opening data tab', err, { dateRange });
        }
    }

    /**
     * Renders breadcrumbs, drill-down summary cards, and charts for the active view granularity.
     */
    renderView(): void {
        try {
            const root = document.getElementById('root');
            if (root) {
                render(<HistoryApp dashboard={this} />, root);
                if (this.onUpdate) this.onUpdate();
                return;
            }

            // Fallback for legacy DOM test environments without #root
            ['year', 'month', 'day'].forEach(v => {
                document.getElementById(`view-${v}`)?.classList.toggle('active', v === this.currentView);
            });

            const breadcrumb = document.getElementById('breadcrumb');
            if (breadcrumb) {
                if (this.currentView === 'year') {
                    breadcrumb.innerHTML = `All Years`;
                } else if (this.currentView === 'month') {
                    breadcrumb.innerHTML = `<span class="bc-year" role="button" tabindex="0">All Years</span> > ${this.selectedYear}`;
                } else if (this.currentView === 'day' && this.selectedMonth) {
                    const m = parseInt(this.selectedMonth.split('-')[1], 10) - 1;
                    breadcrumb.innerHTML = `<span class="bc-year" role="button" tabindex="0">All Years</span> > <span class="bc-month" role="button" tabindex="0" data-year="${this.selectedYear}">${this.selectedYear}</span> > ${this.monthNames[m]}`;
                }
            }

            const container = document.getElementById('chart-container');
            if (container) {
                container.className = `grid grid-${this.currentView}s`;

                if (Object.keys(this.activityData).length === 0) {
                    render(<div className="empty-state">No contribution activity recorded yet. Start reviewing!</div>, container);
                } else if (this.currentView === 'year') {
                    const yearData = this.aggregateByYear();
                    const years = Object.keys(yearData).sort().reverse();
                    render(
                        <Fragment>
                            {years.map(yr => (
                                <HistorySummaryCard
                                    key={yr}
                                    type="year"
                                    title={yr}
                                    value={yearData[yr].total}
                                    subtitle="Patterns Reviewed"
                                    activeDays={yearData[yr].activeDays}
                                    year={yr}
                                    onCardClick={() => this.setView('month', yr)}
                                    onViewCards={(e) => this.openDataTab(yr, e)}
                                />
                            ))}
                        </Fragment>,
                        container
                    );
                } else if (this.currentView === 'month' && this.selectedYear) {
                    const monthData = this.aggregateByMonth(this.selectedYear);
                    const monthKeys = Object.keys(monthData).sort().reverse();
                    if (monthKeys.length === 0) {
                        render(<div className="empty-state">No activity in {this.selectedYear}</div>, container);
                    } else {
                        render(
                            <Fragment>
                                {monthKeys.map(monthKey => {
                                    const mIndex = parseInt(monthKey.split('-')[1], 10) - 1;
                                    return (
                                        <HistorySummaryCard
                                            key={monthKey}
                                            type="month"
                                            title={this.monthNames[mIndex]}
                                            value={monthData[monthKey].total}
                                            subtitle="Patterns Reviewed"
                                            year={this.selectedYear || undefined}
                                            month={monthKey}
                                            onCardClick={() => this.setView('day', this.selectedYear, monthKey)}
                                            onViewCards={(e) => this.openDataTab(monthKey, e)}
                                        />
                                    );
                                })}
                            </Fragment>,
                            container
                        );
                    }
                } else if (this.currentView === 'day' && this.selectedMonth) {
                    const dayData = this.aggregateByDay(this.selectedMonth);
                    const dateStrings = Object.keys(dayData).sort().reverse();
                    if (dateStrings.length === 0) {
                        render(<div className="empty-state">No activity in this month.</div>, container);
                    } else {
                        render(
                            <Fragment>
                                {dateStrings.map(dateString => {
                                    const dateObj = new Date(dateString);
                                    const displayDate = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                                    return (
                                        <HistorySummaryCard
                                            key={dateString}
                                            type="day"
                                            title={displayDate}
                                            value={dayData[dateString]}
                                            subtitle="Cards Reviewed"
                                            date={dateString}
                                            onCardClick={() => this.openDataTab(dateString)}
                                            onViewCards={(e) => this.openDataTab(dateString, e)}
                                        />
                                    );
                                })}
                            </Fragment>,
                            container
                        );
                    }
                }
            }

            this.renderHistoryChart();
            this.bindDynamicListeners();
            if (this.onUpdate) this.onUpdate();
        } catch (err) {
            UIUtils.catchError('FSRSHistoryDashboard', 'Error rendering history view', err, { currentView: this.currentView });
        }
    }

    /**
     * Renders a responsive CSS bar chart displaying review activity distributions
     * for the currently selected hierarchy view (years, months in year, or days in month).
     */
    renderHistoryChart(): void {
        try {
            const chartWrapper = document.getElementById('history-chart-wrapper');
            if (!chartWrapper) return;

            const showCharts = this.extensionSettings && this.extensionSettings.showCharts !== undefined
                ? this.extensionSettings.showCharts
                : true;

            if (!showCharts || Object.keys(this.activityData).length === 0) {
                chartWrapper.style.display = 'none';
                render(null, chartWrapper);
                return;
            }

            chartWrapper.style.display = 'block';

            let dataPoints: Array<{ label: string; value: number; action?: (e?: Event) => void; tooltip?: string }> = [];
            let titleText = '';

            if (this.currentView === 'year') {
                titleText = 'Reviews per Year';
                const yearData = this.aggregateByYear();
                const years = Object.keys(yearData).sort();
                dataPoints = years.map(yr => ({
                    label: yr,
                    value: yearData[yr].total,
                    action: () => this.setView('month', yr)
                }));
            } else if (this.currentView === 'month' && this.selectedYear) {
                titleText = `Reviews in ${this.selectedYear}`;
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
                const [year, month] = this.selectedMonth.split('-');
                const mIndex = parseInt(month, 10) - 1;
                titleText = `Reviews in ${this.monthNames[mIndex]} ${year}`;
                const dayData = this.aggregateByDay(this.selectedMonth);
                const daysInMonth = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();

                for (let d = 1; d <= daysInMonth; d++) {
                    const dStr = d.toString().padStart(2, '0');
                    const dateStr = `${this.selectedMonth}-${dStr}`;
                    const count = dayData[dateStr] || 0;
                    dataPoints.push({
                        label: d.toString(),
                        value: count,
                        action: count > 0 ? (e?: Event) => this.openDataTab(dateStr, e) : undefined,
                        tooltip: `${new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${count} reviews`
                    });
                }
            }

            const maxVal = Math.max(...dataPoints.map(p => p.value), 1);
            render(<HistoryBarChart title={titleText} dataPoints={dataPoints} maxVal={maxVal} />, chartWrapper);
        } catch (err) {
            UIUtils.catchError('FSRSHistoryDashboard', 'Error rendering history chart', err);
        }
    }

    /**
     * Binds event listeners to dynamically rendered breadcrumb links and drill-down cards.
     */
    bindDynamicListeners(): void {
        try {
            document.querySelectorAll('.bc-year').forEach(el => {
                el.addEventListener('click', () => {
                    try {
                        this.setView('year');
                    } catch (err) {
                        UIUtils.catchError('FSRSHistoryDashboard', 'Error in breadcrumb year click handler', err);
                    }
                });
            });
            document.querySelectorAll('.bc-month').forEach(el => {
                el.addEventListener('click', (e: Event) => {
                    try {
                        const target = e.target as HTMLElement;
                        this.setView('month', target.getAttribute('data-year'));
                    } catch (err) {
                        UIUtils.catchError('FSRSHistoryDashboard', 'Error in breadcrumb month click handler', err);
                    }
                });
            });

            document.querySelectorAll('.card-year').forEach(el => {
                el.addEventListener('click', (e: Event) => {
                    try {
                        const target = e.target as HTMLElement;
                        if (target.closest('button')) return;
                        this.setView('month', el.getAttribute('data-year'));
                    } catch (err) {
                        UIUtils.catchError('FSRSHistoryDashboard', 'Error in card year click handler', err);
                    }
                });
            });
            document.querySelectorAll('.card-month').forEach(el => {
                el.addEventListener('click', (e: Event) => {
                    try {
                        const target = e.target as HTMLElement;
                        if (target.closest('button')) return;
                        this.setView('day', el.getAttribute('data-year'), el.getAttribute('data-month'));
                    } catch (err) {
                        UIUtils.catchError('FSRSHistoryDashboard', 'Error in card month click handler', err);
                    }
                });
            });

            document.querySelectorAll('.btn-year').forEach(el => {
                el.addEventListener('click', (e: Event) => {
                    try {
                        this.openDataTab(el.getAttribute('data-year') || '', e);
                    } catch (err) {
                        UIUtils.catchError('FSRSHistoryDashboard', 'Error in btn year click handler', err);
                    }
                });
            });
            document.querySelectorAll('.btn-month').forEach(el => {
                el.addEventListener('click', (e: Event) => {
                    try {
                        this.openDataTab(el.getAttribute('data-month') || '', e);
                    } catch (err) {
                        UIUtils.catchError('FSRSHistoryDashboard', 'Error in btn month click handler', err);
                    }
                });
            });
            document.querySelectorAll('.card-day').forEach(el => {
                el.addEventListener('click', (e: Event) => {
                    try {
                        this.openDataTab(el.getAttribute('data-date') || '', e);
                    } catch (err) {
                        UIUtils.catchError('FSRSHistoryDashboard', 'Error in card day click handler', err);
                    }
                });
            });
        } catch (err) {
            UIUtils.catchError('FSRSHistoryDashboard', 'Error binding dynamic listeners', err);
        }
    }

    /**
     * Aggregates activity counts by 4-digit year, tallying total reviews and unique active days.
     * @returns Map of year strings to total reviews and active day counts.
     */
    aggregateByYear(): Record<string, { total: number; activeDays: number }> {
        try {
            const years: Record<string, { total: number; activeDays: number }> = {};
            for (const [dateString, count] of Object.entries(this.activityData)) {
                const year = dateString.split('-')[0];
                if (!years[year]) years[year] = { total: 0, activeDays: 0 };
                years[year].total += count;
                years[year].activeDays += 1;
            }
            return years;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSHistoryDashboard', `Error aggregating history by year: ${errorMessage}`, { err });
            return {};
        }
    }

    /**
     * Aggregates activity counts for each month in a specific year.
     * @param targetYear - 4-digit year string.
     * @returns Map of `YYYY-MM` month strings to total review counts.
     */
    aggregateByMonth(targetYear: string): Record<string, { total: number }> {
        try {
            const months: Record<string, { total: number }> = {};
            for (const [dateString, count] of Object.entries(this.activityData)) {
                if (dateString.startsWith(targetYear)) {
                    const monthKey = dateString.substring(0, 7);
                    if (!months[monthKey]) months[monthKey] = { total: 0 };
                    months[monthKey].total += count;
                }
            }
            return months;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSHistoryDashboard', `Error aggregating history by month: ${errorMessage}`, { targetYear, err });
            return {};
        }
    }

    /**
     * Aggregates activity counts for each day in a specific month.
     * @param targetMonth - `YYYY-MM` month string.
     * @returns Map of `YYYY-MM-DD` date strings to review counts.
     */
    aggregateByDay(targetMonth: string): Record<string, number> {
        try {
            const days: Record<string, number> = {};
            for (const [dateString, count] of Object.entries(this.activityData)) {
                if (dateString.startsWith(targetMonth)) {
                    days[dateString] = count;
                }
            }
            return days;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('FSRSHistoryDashboard', `Error aggregating history by day: ${errorMessage}`, { targetMonth, err });
            return {};
        }
    }
}

/**
 * Initializes the history dashboard controller on DOM load.
 */
export function initHistory(): void {
    try {
        const root = document.getElementById('root');
        const history = new FSRSHistoryDashboard();
        if (root) {
            render(<HistoryApp dashboard={history} />, root);
        } else {
            history.init();
        }
    } catch (err) {
        UIUtils.catchError('FSRSHistoryDashboard', 'Initialization failed', err);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHistory);
    } else {
        initHistory();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).FSRSHistoryDashboard = FSRSHistoryDashboard;
    (module.exports as any).HistoryViewToggle = HistoryViewToggle;
    (module.exports as any).HistoryBreadcrumb = HistoryBreadcrumb;
    (module.exports as any).HistorySummaryCard = HistorySummaryCard;
    (module.exports as any).HistoryBarChart = HistoryBarChart;
    (module.exports as any).HistoryApp = HistoryApp;
    (module.exports as any).initHistory = initHistory;
}
