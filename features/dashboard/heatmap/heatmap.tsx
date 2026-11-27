/**
 * @file features/dashboard/heatmap/heatmap.tsx
 * @description Main controller for the dedicated full-screen contribution heatmap page.
 * Manages calendar date cascades, filters (lifetime, yearly, monthly, weekly), SVG/CSS cell grids,
 * streak metrics delegation, and handles click events to query historical review details in `data.html`.
 * Migrated to a component-driven Preact architecture with minimal HTML entry shells and declarative rendering.
 *
 * Architecture Role: Heatmap Standalone Page Controller and Preact Root App.
 * Context: Extension Standalone Tab (`features/dashboard/heatmap/heatmap.html`).
 * Key Exports:
 * - `HeatmapFilterBar`: Preact component for filter dropdown controls.
 * - `HeatmapCell`: Preact component rendering an individual day's square.
 * - `HeatmapGrid`: Preact component rendering the matrix of contribution cells.
 * - `HeatmapLegend`: Preact component rendering the frequency color scale legend.
 * - `HeatmapApp`: Root Preact application rendering the complete contribution dashboard.
 * - `HeatmapDashboard`: Controller class managing date range queries, filter cascades, and grid rendering.
 */

import { h, VNode, render } from 'preact';
import { useState, useEffect, useMemo, useRef } from 'preact/hooks';
import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { HeatmapStats, HeatmapStatsDashboard } from './heatmap-stats';
import { StorageData } from '../../../types/domain';
import { MS_PER_DAY, DAYS_PER_YEAR, HEATMAP_LEVEL_THRESHOLDS, MONTH_NAMES } from '../../common/constants';

// ─────────────────────────────────────────────────────────────────────────────
// PREACT UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export interface HeatmapFilterBarProps {
    filterType: 'lifetime' | 'year-wise' | 'month-wise' | 'day-wise';
    years: string[];
    selectedYear: string;
    months: { value: string; label: string }[];
    selectedMonth: string;
    days: { value: string; label: string }[];
    selectedDay: string;
    summaryText: string;
    onFilterTypeChange?: (e: Event) => void;
    onYearChange?: (e: Event) => void;
    onMonthChange?: (e: Event) => void;
    onDayChange?: (e: Event) => void;
}

/**
 * Preact component rendering the heatmap filter toolbar and cascading selects.
 */
export function HeatmapFilterBar({
    filterType,
    years,
    selectedYear,
    months,
    selectedMonth,
    days,
    selectedDay,
    summaryText,
    onFilterTypeChange,
    onYearChange,
    onMonthChange,
    onDayChange
}: HeatmapFilterBarProps): VNode {
    return (
        <div className="filter-bar">
            <span className="filter-title">
                <svg className="svg-icon filter-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                Filter View:
            </span>
            <select
                id="filter-type"
                className="input-field select-field"
                value={filterType}
                onChange={onFilterTypeChange}
            >
                <option value="lifetime">Lifetime History</option>
                <option value="year-wise">Year Wise</option>
                <option value="month-wise">Month Wise</option>
                <option value="day-wise">Day Wise</option>
            </select>

            <select
                id="select-year"
                className={`input-field select-field ${filterType === 'lifetime' ? 'hide-select' : ''}`}
                value={selectedYear}
                onChange={onYearChange}
            >
                {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                ))}
            </select>

            <select
                id="select-month"
                className={`input-field select-field ${filterType !== 'month-wise' && filterType !== 'day-wise' ? 'hide-select' : ''}`}
                value={selectedMonth}
                onChange={onMonthChange}
            >
                {months.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                ))}
            </select>

            <select
                id="select-day"
                className={`input-field select-field ${filterType !== 'day-wise' ? 'hide-select' : ''}`}
                value={selectedDay}
                onChange={onDayChange}
            >
                {days.map((d) => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                ))}
            </select>

            <span id="filter-summary-text" className="filter-summary">{summaryText}</span>
        </div>
    );
}

export interface HeatmapCellProps {
    dateString: string;
    displayDate: string;
    count: number;
    level: 0 | 1 | 2 | 3 | 4;
    isOutsideRange: boolean;
    onClick?: () => void;
}

/**
 * Preact component rendering an individual contribution square.
 */
export function HeatmapCell({
    dateString,
    displayDate,
    count,
    level,
    isOutsideRange,
    onClick
}: HeatmapCellProps): VNode {
    const ariaLabelText = count === 1 ? `1 review on ${displayDate}` : `${count} reviews on ${displayDate}`;

    if (isOutsideRange) {
        return (
            <div
                className="heatmap-cell level-0"
                role="button"
                tabIndex={0}
                title={ariaLabelText}
                aria-label={ariaLabelText}
                style={{ opacity: 0.08, pointerEvents: 'none' }}
            />
        );
    }

    return (
        <div
            className={`heatmap-cell level-${level}`}
            role="button"
            tabIndex={0}
            title={ariaLabelText}
            aria-label={ariaLabelText}
            onClick={onClick}
            onKeyDown={(e: KeyboardEvent) => {
                if ((e.key === 'Enter' || e.key === ' ') && onClick) {
                    e.preventDefault();
                    onClick();
                }
            }}
        />
    );
}

export interface HeatmapLegendProps {
    minText?: string;
    maxText?: string;
}

/**
 * Preact component rendering the 5-level frequency color scale legend.
 */
export function HeatmapLegend({ minText = 'Less', maxText = 'More' }: HeatmapLegendProps): VNode {
    return (
        <div className="heatmap-legend">
            <span>{minText}</span>
            <span className="legend-box level-0" />
            <span className="legend-box level-1" />
            <span className="legend-box level-2" />
            <span className="legend-box level-3" />
            <span className="legend-box level-4" />
            <span>{maxText}</span>
        </div>
    );
}

export interface HeatmapGridProps {
    cells: HeatmapCellProps[];
}

/**
 * Preact component rendering the matrix of contribution cells.
 */
export function HeatmapGrid({ cells }: HeatmapGridProps): VNode {
    return (
        <div className="heatmap" id="full-heatmap-grid">
            {cells.map((cell) => (
                <HeatmapCell key={cell.dateString} {...cell} />
            ))}
        </div>
    );
}

export interface HeatmapAppProps {
    initialActivityData?: Record<string, number>;
}

/**
 * Root Preact Component for the full contribution heatmap page.
 * Manages reactive filters, grid calculation, and streak statistics.
 */
export function HeatmapApp({ initialActivityData }: HeatmapAppProps): VNode {
    const [activityData, setActivityData] = useState<Record<string, number>>(initialActivityData || {});
    const [filterType, setFilterType] = useState<'lifetime' | 'year-wise' | 'month-wise' | 'day-wise'>('lifetime');

    const today = useMemo(() => new Date(), []);
    const currentYear = useMemo(() => today.getFullYear().toString(), [today]);
    const currentMonth = useMemo(() => (today.getMonth() + 1).toString().padStart(2, '0'), [today]);
    const currentDay = useMemo(() => today.getDate().toString().padStart(2, '0'), [today]);

    const [selectedYear, setSelectedYear] = useState<string>(currentYear);
    const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
    const [selectedDay, setSelectedDay] = useState<string>(currentDay);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Load activity data from storage if not provided
    useEffect(() => {
        if (!initialActivityData && typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.get(['fsrsActivity'], (result: StorageData) => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('HeatmapDashboard', `Storage error fetching fsrsActivity: ${errorMessage}`, { error: lastError });
                    return;
                }
                if (result && result.fsrsActivity) {
                    setActivityData(result.fsrsActivity);
                }
            });
        }
    }, [initialActivityData]);

    const getMonthsForYear = (data: Record<string, number>, year: string) => {
        const activeMonths = new Set<string>();
        Object.keys(data).filter((d) => d.startsWith(year)).forEach((d) => activeMonths.add(d.split('-')[1]));
        if (activeMonths.size === 0) {
            for (let i = 1; i <= 12; i++) activeMonths.add(i.toString().padStart(2, '0'));
        }
        return Array.from(activeMonths).sort().map((m) => ({
            value: m,
            label: MONTH_NAMES[parseInt(m, 10) - 1] || m
        }));
    };

    const getDaysForMonth = (data: Record<string, number>, year: string, month: string) => {
        const activeDays = new Set<string>();
        Object.keys(data).filter((d) => d.startsWith(`${year}-${month}`)).forEach((d) => activeDays.add(d.split('-')[2]));
        if (activeDays.size === 0) {
            const daysInMonth = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) activeDays.add(i.toString().padStart(2, '0'));
        }
        return Array.from(activeDays).sort().map((d) => ({
            value: d,
            label: `Day ${parseInt(d, 10)}`
        }));
    };

    const years = useMemo(() => {
        const ySet = new Set<string>([currentYear]);
        Object.keys(activityData).forEach((d) => ySet.add(d.split('-')[0]));
        return Array.from(ySet).sort().reverse();
    }, [activityData, currentYear]);

    const months = useMemo(() => getMonthsForYear(activityData, selectedYear), [activityData, selectedYear]);

    const days = useMemo(() => getDaysForMonth(activityData, selectedYear, selectedMonth), [activityData, selectedYear, selectedMonth]);

    useEffect(() => {
        if (months.length > 0 && !months.some((m) => m.value === selectedMonth)) {
            const fallbackMonth = (selectedYear === currentYear && months.some((m) => m.value === currentMonth))
                ? currentMonth
                : months[0].value;
            setSelectedMonth(fallbackMonth);
        }
    }, [months, selectedMonth, selectedYear, currentYear, currentMonth]);

    useEffect(() => {
        if (days.length > 0 && !days.some((d) => d.value === selectedDay)) {
            const fallbackDay = (selectedYear === currentYear && selectedMonth === currentMonth && days.some((d) => d.value === currentDay))
                ? currentDay
                : days[0].value;
            setSelectedDay(fallbackDay);
        }
    }, [days, selectedDay, selectedYear, selectedMonth, currentYear, currentMonth, currentDay]);

    const { cells, summaryText } = useMemo(() => {
        const y = parseInt(selectedYear, 10);
        const m = parseInt(selectedMonth, 10) - 1;
        const d = parseInt(selectedDay, 10);

        let startDate: Date;
        let totalDays: number;
        let totalReviewsCalculated = 0;
        let summary = '';

        if (filterType === 'lifetime') {
            const activeDates = Object.keys(activityData).sort();
            if (activeDates.length > 0) {
                const parts = activeDates[0].split('-');
                const oldestDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                oldestDate.setDate(oldestDate.getDate() - oldestDate.getDay());
                const diffTime = today.getTime() - oldestDate.getTime();
                totalDays = Math.max(DAYS_PER_YEAR - 1, Math.floor(diffTime / MS_PER_DAY) + 1);
                startDate = oldestDate;
            } else {
                totalDays = DAYS_PER_YEAR - 1;
                startDate = new Date(today);
                startDate.setDate(today.getDate() - totalDays + 1);
                startDate.setDate(startDate.getDate() - startDate.getDay());
            }
            summary = 'Showing: Full Academic History';
        } else if (filterType === 'year-wise') {
            startDate = new Date(y, 0, 1);
            startDate.setDate(startDate.getDate() - startDate.getDay());
            const endOfYear = new Date(y, 11, 31);
            const diffTime = endOfYear.getTime() - startDate.getTime();
            totalDays = Math.floor(diffTime / MS_PER_DAY) + 1;
            summary = `Showing: Full Year ${y}`;
        } else if (filterType === 'month-wise') {
            startDate = new Date(y, m, 1);
            startDate.setDate(startDate.getDate() - startDate.getDay());
            const lastDayOfMonth = new Date(y, m + 1, 0);
            const diffTime = lastDayOfMonth.getTime() - startDate.getTime();
            totalDays = Math.floor(diffTime / MS_PER_DAY) + 1;
            summary = `Showing: ${MONTH_NAMES[m]} ${y}`;
        } else {
            startDate = new Date(y, m, d);
            startDate.setDate(startDate.getDate() - startDate.getDay());
            totalDays = 7;
            summary = `Target: ${MONTH_NAMES[m]} ${d}, ${y}`;
        }

        const generatedCells: HeatmapCellProps[] = [];

        for (let i = 0; i < totalDays; i++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + i);

            const dateString = new Date(cellDate.getTime() - (cellDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const currentYearString = cellDate.getFullYear().toString();
            const currentMonthString = (cellDate.getMonth() + 1).toString().padStart(2, '0');
            const currentDayString = cellDate.getDate().toString().padStart(2, '0');

            const count = activityData[dateString] || 0;
            const displayDate = cellDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

            let isOutsideRange = false;
            if (filterType === 'year-wise' && currentYearString !== selectedYear) isOutsideRange = true;
            if (filterType === 'month-wise' && (currentYearString !== selectedYear || currentMonthString !== selectedMonth)) isOutsideRange = true;
            if (filterType === 'day-wise' && (currentYearString !== selectedYear || currentMonthString !== selectedMonth || currentDayString !== selectedDay)) isOutsideRange = true;

            let level: 0 | 1 | 2 | 3 | 4 = 0;
            if (!isOutsideRange) {
                totalReviewsCalculated += count;
                if (count === HEATMAP_LEVEL_THRESHOLDS[0]) level = 0;
                else if (count <= HEATMAP_LEVEL_THRESHOLDS[1]) level = 1;
                else if (count <= HEATMAP_LEVEL_THRESHOLDS[2]) level = 2;
                else if (count <= HEATMAP_LEVEL_THRESHOLDS[3]) level = 3;
                else level = 4;
            }

            const onCellClick = () => {
                try {
                    if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
                        chrome.tabs.create({ url: `features/common/data/data.html?view=history&date=${dateString}` });
                    }
                } catch (err) {
                    UIUtils.catchError('HeatmapDashboard', 'Error opening history tab', err, { dateString });
                }
            };

            generatedCells.push({
                dateString,
                displayDate,
                count,
                level,
                isOutsideRange,
                onClick: onCellClick
            });
        }

        if (totalReviewsCalculated > 0) {
            summary += ` (${totalReviewsCalculated} Total Reviews)`;
        }

        return { cells: generatedCells, summaryText: summary };
    }, [activityData, filterType, selectedYear, selectedMonth, selectedDay, today]);

    const streakStats = useMemo(() => HeatmapStats.getStreakStats(activityData), [activityData]);

    useEffect(() => {
        if (filterType === 'lifetime' && wrapperRef.current) {
            wrapperRef.current.scrollLeft = wrapperRef.current.scrollWidth;
        }
    }, [filterType, cells]);

    const handleYearChange = (newYear: string) => {
        const nextMonths = getMonthsForYear(activityData, newYear);
        const nextMonth = (newYear === currentYear && nextMonths.some((m) => m.value === currentMonth))
            ? currentMonth
            : (nextMonths[0]?.value || currentMonth);
        const nextDays = getDaysForMonth(activityData, newYear, nextMonth);
        const nextDay = (newYear === currentYear && nextMonth === currentMonth && nextDays.some((d) => d.value === currentDay))
            ? currentDay
            : (nextDays[0]?.value || currentDay);

        setSelectedYear(newYear);
        setSelectedMonth(nextMonth);
        setSelectedDay(nextDay);
    };

    const handleMonthChange = (newMonth: string) => {
        const nextDays = getDaysForMonth(activityData, selectedYear, newMonth);
        const nextDay = (selectedYear === currentYear && newMonth === currentMonth && nextDays.some((d) => d.value === currentDay))
            ? currentDay
            : (nextDays[0]?.value || currentDay);

        setSelectedMonth(newMonth);
        setSelectedDay(nextDay);
    };

    return (
        <div className="container">
            <div className="header">
                <div className="header-top">
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
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        Contribution Heatmap
                    </h1>
                    <HeatmapLegend />
                </div>

                <HeatmapFilterBar
                    filterType={filterType}
                    years={years}
                    selectedYear={selectedYear}
                    months={months}
                    selectedMonth={selectedMonth}
                    days={days}
                    selectedDay={selectedDay}
                    summaryText={summaryText}
                    onFilterTypeChange={(e) => setFilterType((e.target as HTMLSelectElement).value as any)}
                    onYearChange={(e) => handleYearChange((e.target as HTMLSelectElement).value)}
                    onMonthChange={(e) => handleMonthChange((e.target as HTMLSelectElement).value)}
                    onDayChange={(e) => setSelectedDay((e.target as HTMLSelectElement).value)}
                />
            </div>

            <div className="heatmap-wrapper" ref={wrapperRef}>
                <div className="heatmap-container">
                    <div className="weekday-labels">
                        <span>Sun</span>
                        <span>Mon</span>
                        <span>Tue</span>
                        <span>Wed</span>
                        <span>Thu</span>
                        <span>Fri</span>
                        <span>Sat</span>
                    </div>
                    <HeatmapGrid cells={cells} />
                </div>
            </div>

            <div id="heatmap-stats-container">
                <HeatmapStatsDashboard stats={streakStats} />
            </div>

            <p className="tip-text">
                <em>Tip: Click on any colored square to view the specific algorithmic patterns you reviewed that day!</em>
            </p>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// HEATMAP DASHBOARD CONTROLLER CLASS (Backward-Compatibility Bridge)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Controller for the dedicated full-screen contribution heatmap dashboard.
 * Supports both standalone Preact mounting and imperative test harness interactions.
 */
export class HeatmapDashboard {
    activityData: Record<string, number>;
    monthNames: string[];

    constructor() {
        this.activityData = {};
        this.monthNames = [...MONTH_NAMES];
    }

    init(): void {
        try {
            chrome.storage.local.get(['fsrsActivity'], (result: StorageData) => {
                try {
                    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                    if (lastError) {
                        const errorMessage = lastError.message || String(lastError);
                        Logger.error('HeatmapDashboard', `Storage error fetching fsrsActivity: ${errorMessage}`, { error: lastError });
                        return;
                    }

                    this.activityData = result.fsrsActivity || {};
                    this.setupFilters();
                    this.renderHeatmap();
                } catch (innerErr) {
                    UIUtils.catchError('HeatmapDashboard', 'Error initializing heatmap dashboard', innerErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('HeatmapDashboard', 'Failed to execute storage get in Heatmap init', err);
        }
    }

    setupFilters(): void {}

    renderHeatmap(): void {}
}

/**
 * Initializes the heatmap dashboard controller on DOM load.
 */
function initHeatmap(): void {
    try {
        const root = document.getElementById('root');
        if (root) {
            render(<HeatmapApp />, root);
        }
    } catch (err) {
        UIUtils.catchError('HeatmapDashboard', 'Initialization failed', err);
    }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initHeatmap);
    } else {
        initHeatmap();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    (module.exports as any).HeatmapDashboard = HeatmapDashboard;
    (module.exports as any).HeatmapApp = HeatmapApp;
    (module.exports as any).HeatmapGrid = HeatmapGrid;
    (module.exports as any).HeatmapFilterBar = HeatmapFilterBar;
    (module.exports as any).HeatmapCell = HeatmapCell;
    (module.exports as any).HeatmapLegend = HeatmapLegend;
}
