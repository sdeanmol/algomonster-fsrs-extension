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
import { useState, useEffect, useMemo } from 'preact/hooks';
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

    // Load activity data from storage if not provided
    useEffect(() => {
        if (!initialActivityData && typeof chrome !== 'undefined' && chrome.storage?.local) {
            chrome.storage.local.get(['fsrsActivity'], (result: StorageData) => {
                if (result && result.fsrsActivity) {
                    setActivityData(result.fsrsActivity);
                }
            });
        }
    }, [initialActivityData]);

    const years = useMemo(() => {
        const ySet = new Set<string>([currentYear]);
        Object.keys(activityData).forEach((d) => ySet.add(d.split('-')[0]));
        return Array.from(ySet).sort().reverse();
    }, [activityData, currentYear]);

    const months = useMemo(() => {
        const activeMonths = new Set<string>();
        Object.keys(activityData).filter((d) => d.startsWith(selectedYear)).forEach((d) => activeMonths.add(d.split('-')[1]));
        if (activeMonths.size === 0) {
            for (let i = 1; i <= 12; i++) activeMonths.add(i.toString().padStart(2, '0'));
        }
        return Array.from(activeMonths).sort().map((m) => ({
            value: m,
            label: MONTH_NAMES[parseInt(m, 10) - 1] || m
        }));
    }, [activityData, selectedYear]);

    const days = useMemo(() => {
        const activeDays = new Set<string>();
        Object.keys(activityData).filter((d) => d.startsWith(`${selectedYear}-${selectedMonth}`)).forEach((d) => activeDays.add(d.split('-')[2]));
        if (activeDays.size === 0) {
            const daysInMonth = new Date(parseInt(selectedYear, 10), parseInt(selectedMonth, 10), 0).getDate();
            for (let i = 1; i <= daysInMonth; i++) activeDays.add(i.toString().padStart(2, '0'));
        }
        return Array.from(activeDays).sort().map((d) => ({
            value: d,
            label: `Day ${parseInt(d, 10)}`
        }));
    }, [activityData, selectedYear, selectedMonth]);

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
                    onYearChange={(e) => setSelectedYear((e.target as HTMLSelectElement).value)}
                    onMonthChange={(e) => setSelectedMonth((e.target as HTMLSelectElement).value)}
                    onDayChange={(e) => setSelectedDay((e.target as HTMLSelectElement).value)}
                />
            </div>

            <div className="heatmap-wrapper">
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

            <div id="heatmap-stats-container" className="stats-grid">
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

                    const root = document.getElementById('root');
                    if (root) {
                        render(<HeatmapApp initialActivityData={this.activityData} />, root);
                    } else {
                        this.setupFilters();
                        this.renderHeatmap();
                    }
                } catch (innerErr) {
                    UIUtils.catchError('HeatmapDashboard', 'Error initializing heatmap dashboard', innerErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('HeatmapDashboard', 'Failed to execute storage get in Heatmap init', err);
        }
    }

    setupFilters(): void {
        try {
            const typeSelect = document.getElementById('filter-type') as HTMLSelectElement | null;
            const yearSelect = document.getElementById('select-year') as HTMLSelectElement | null;
            const monthSelect = document.getElementById('select-month') as HTMLSelectElement | null;
            const daySelect = document.getElementById('select-day') as HTMLSelectElement | null;

            if (!typeSelect || !yearSelect || !monthSelect || !daySelect) return;

            const today = new Date();
            const currentYear = today.getFullYear().toString();
            const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
            const currentDay = today.getDate().toString().padStart(2, '0');

            const years = new Set<string>([currentYear]);
            Object.keys(this.activityData).forEach((d) => years.add(d.split('-')[0]));

            yearSelect.innerHTML = Array.from(years).sort().reverse().map((y) => `<option value="${y}">${y}</option>`).join('');
            yearSelect.value = currentYear;

            const updateMonthDropdown = () => {
                try {
                    const targetYear = yearSelect.value;
                    const activeMonths = new Set<string>();

                    Object.keys(this.activityData).filter((d) => d.startsWith(targetYear)).forEach((d) => activeMonths.add(d.split('-')[1]));

                    if (activeMonths.size === 0) {
                        for (let i = 1; i <= 12; i++) activeMonths.add(i.toString().padStart(2, '0'));
                    }

                    monthSelect.innerHTML = Array.from(activeMonths).sort().map((m) => `<option value="${m}">${this.monthNames[parseInt(m, 10) - 1]}</option>`).join('');

                    if (targetYear === currentYear && activeMonths.has(currentMonth)) {
                        monthSelect.value = currentMonth;
                    } else if (monthSelect.options.length > 0) {
                        monthSelect.value = monthSelect.options[0].value;
                    }
                } catch (mErr) {
                    UIUtils.catchError('HeatmapDashboard', 'Error updating month dropdown options', mErr);
                }
            };

            const updateDayDropdown = () => {
                try {
                    const targetYear = yearSelect.value;
                    const targetMonth = monthSelect.value;
                    const activeDays = new Set<string>();

                    Object.keys(this.activityData).filter((d) => d.startsWith(`${targetYear}-${targetMonth}`)).forEach((d) => activeDays.add(d.split('-')[2]));

                    if (activeDays.size === 0) {
                        const daysInMonth = new Date(parseInt(targetYear, 10), parseInt(targetMonth, 10), 0).getDate();
                        for (let i = 1; i <= daysInMonth; i++) activeDays.add(i.toString().padStart(2, '0'));
                    }

                    daySelect.innerHTML = Array.from(activeDays).sort().map((d) => `<option value="${d}">Day ${parseInt(d, 10)}</option>`).join('');

                    if (targetYear === currentYear && targetMonth === currentMonth && activeDays.has(currentDay)) {
                        daySelect.value = currentDay;
                    } else if (daySelect.options.length > 0) {
                        daySelect.value = daySelect.options[0].value;
                    }
                } catch (dErr) {
                    UIUtils.catchError('HeatmapDashboard', 'Error updating day dropdown options', dErr);
                }
            };

            updateMonthDropdown();
            updateDayDropdown();

            typeSelect.addEventListener('change', () => {
                try {
                    const mode = typeSelect.value;
                    yearSelect.classList.toggle('hide-select', mode === 'lifetime');
                    monthSelect.classList.toggle('hide-select', mode !== 'month-wise' && mode !== 'day-wise');
                    daySelect.classList.toggle('hide-select', mode !== 'day-wise');
                    this.renderHeatmap();
                } catch (tErr) {
                    UIUtils.catchError('HeatmapDashboard', 'Error handling filter type change', tErr);
                }
            });

            yearSelect.addEventListener('change', () => {
                try {
                    updateMonthDropdown();
                    updateDayDropdown();
                    this.renderHeatmap();
                } catch (yErr) {
                    UIUtils.catchError('HeatmapDashboard', 'Error handling year filter change', yErr);
                }
            });

            monthSelect.addEventListener('change', () => {
                try {
                    updateDayDropdown();
                    this.renderHeatmap();
                } catch (mErr) {
                    UIUtils.catchError('HeatmapDashboard', 'Error handling month filter change', mErr);
                }
            });

            daySelect.addEventListener('change', () => {
                try {
                    this.renderHeatmap();
                } catch (dErr) {
                    UIUtils.catchError('HeatmapDashboard', 'Error handling day filter change', dErr);
                }
            });
        } catch (err) {
            UIUtils.catchError('HeatmapDashboard', 'Error setting up heatmap filters', err);
        }
    }

    renderHeatmap(): void {
        try {
            const grid = document.getElementById('full-heatmap-grid');
            const summaryText = document.getElementById('filter-summary-text');
            if (!grid) return;

            const typeSelect = document.getElementById('filter-type') as HTMLSelectElement | null;
            const yearSelect = document.getElementById('select-year') as HTMLSelectElement | null;
            const monthSelect = document.getElementById('select-month') as HTMLSelectElement | null;
            const daySelect = document.getElementById('select-day') as HTMLSelectElement | null;

            if (!typeSelect || !yearSelect || !monthSelect || !daySelect) return;

            const mode = typeSelect.value;
            const chosenYear = yearSelect.value;
            const chosenMonth = monthSelect.value;
            const chosenDay = daySelect.value;

            let startDate: Date;
            let totalDays: number;
            let totalReviewsCalculated = 0;

            const y = parseInt(chosenYear, 10);
            const m = parseInt(chosenMonth, 10) - 1;
            const d = parseInt(chosenDay, 10);

            if (mode === 'lifetime') {
                const today = new Date();
                const activeDates = Object.keys(this.activityData).sort();

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
                if (summaryText) summaryText.innerText = 'Showing: Full Academic History';
            } else if (mode === 'year-wise') {
                startDate = new Date(y, 0, 1);
                startDate.setDate(startDate.getDate() - startDate.getDay());

                const endOfYear = new Date(y, 11, 31);
                const diffTime = endOfYear.getTime() - startDate.getTime();
                totalDays = Math.floor(diffTime / MS_PER_DAY) + 1;
                if (summaryText) summaryText.innerText = `Showing: Full Year ${y}`;
            } else if (mode === 'month-wise') {
                startDate = new Date(y, m, 1);
                startDate.setDate(startDate.getDate() - startDate.getDay());

                const lastDayOfMonth = new Date(y, m + 1, 0);
                const diffTime = lastDayOfMonth.getTime() - startDate.getTime();
                totalDays = Math.floor(diffTime / MS_PER_DAY) + 1;
                if (summaryText) summaryText.innerText = `Showing: ${this.monthNames[m]} ${y}`;
            } else {
                startDate = new Date(y, m, d);
                startDate.setDate(startDate.getDate() - startDate.getDay());
                totalDays = 7;
                if (summaryText) summaryText.innerText = `Target: ${this.monthNames[m]} ${d}, ${y}`;
            }

            const cells: HeatmapCellProps[] = [];

            for (let i = 0; i < totalDays; i++) {
                const cellDate = new Date(startDate);
                cellDate.setDate(startDate.getDate() + i);

                const dateString = new Date(cellDate.getTime() - (cellDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                const currentYearString = cellDate.getFullYear().toString();
                const currentMonthString = (cellDate.getMonth() + 1).toString().padStart(2, '0');
                const currentDayString = cellDate.getDate().toString().padStart(2, '0');

                const count = this.activityData[dateString] || 0;
                const displayDate = cellDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

                let isOutsideFilterRange = false;
                if (mode === 'year-wise' && currentYearString !== chosenYear) isOutsideFilterRange = true;
                if (mode === 'month-wise' && (currentYearString !== chosenYear || currentMonthString !== chosenMonth)) isOutsideFilterRange = true;
                if (mode === 'day-wise' && (currentYearString !== chosenYear || currentMonthString !== chosenMonth || currentDayString !== chosenDay)) isOutsideFilterRange = true;

                let level: 0 | 1 | 2 | 3 | 4 = 0;
                if (!isOutsideFilterRange) {
                    totalReviewsCalculated += count;
                    if (count === HEATMAP_LEVEL_THRESHOLDS[0]) level = 0;
                    else if (count <= HEATMAP_LEVEL_THRESHOLDS[1]) level = 1;
                    else if (count <= HEATMAP_LEVEL_THRESHOLDS[2]) level = 2;
                    else if (count <= HEATMAP_LEVEL_THRESHOLDS[3]) level = 3;
                    else level = 4;
                }

                const handleCellClick = () => {
                    try {
                        chrome.tabs.create({ url: `features/common/data/data.html?view=history&date=${dateString}` }, () => {
                            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                            if (lastError) {
                                const errorMessage = lastError.message || String(lastError);
                                Logger.error('HeatmapDashboard', `Error creating tab on heatmap cell click: ${errorMessage}`, { dateString, error: lastError });
                            }
                        });
                    } catch (tabErr) {
                        UIUtils.catchError('HeatmapDashboard', 'Error executing handleCellClick', tabErr, { dateString });
                    }
                };

                cells.push({
                    dateString,
                    displayDate,
                    count,
                    level,
                    isOutsideRange: isOutsideFilterRange,
                    onClick: handleCellClick
                });
            }

            // Render all cells declaratively via Preact instead of imperative createElement/appendChild
            render(
                <div>
                    {cells.map((c) => (
                        <HeatmapCell key={c.dateString} {...c} />
                    ))}
                </div>,
                grid
            );

            if (summaryText && totalReviewsCalculated > 0) {
                summaryText.innerText += ` (${totalReviewsCalculated} Total Reviews)`;
            }

            const statsContainer = document.getElementById('heatmap-stats-container');
            if (statsContainer) {
                HeatmapStats.renderStatsDashboard(this.activityData);
            }

            setTimeout(() => {
                try {
                    const wrapper = document.querySelector('.heatmap-wrapper');
                    if (wrapper && mode === 'lifetime') wrapper.scrollLeft = wrapper.scrollWidth;
                } catch (sErr) {
                    UIUtils.catchError('HeatmapDashboard', 'Error scrolling heatmap wrapper', sErr);
                }
            }, 50);
        } catch (err) {
            UIUtils.catchError('HeatmapDashboard', 'Error rendering heatmap grid', err);
        }
    }
}

/**
 * Initializes the heatmap dashboard controller on DOM load.
 */
function initHeatmap(): void {
    try {
        const root = document.getElementById('root');
        if (root) {
            render(<HeatmapApp />, root);
        } else {
            const dashboard = new HeatmapDashboard();
            dashboard.init();
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
