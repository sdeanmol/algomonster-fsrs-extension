/**
 * @file features/dashboard/analytics/overview/miniForecast.tsx
 * @description Component for rendering the mini 7-day upcoming review forecast strip
 * within the analytics overview dashboard. Displays clickable daily review load tiles
 * that open filtered card queue lists via Chrome tabs.
 * @context Popup / Analytics SPA Dashboard
 */

import { h, Fragment, FunctionalComponent, render } from 'preact';
import { useCallback, useMemo } from 'preact/hooks';
import { UIUtils } from '../../../common/utils/uiUtils';
import { DataUtils } from '../utils/dataUtils';
import { MS_PER_DAY, DAY_NAMES_SHORT } from '../../../common/constants';

export interface ForecastDayTileProps {
    isToday: boolean;
    dayName: string;
    formattedDate: string;
    count: number;
    countClass: string;
    dateStr: string;
    offset: number;
    onClick?: (dateStr: string, offset: number) => void;
}

export const ForecastDayTile: FunctionalComponent<ForecastDayTileProps> = ({
    isToday,
    dayName,
    formattedDate,
    count,
    countClass,
    dateStr,
    offset,
    onClick
}) => {
    return (
        <div
            class={`forecast-day-card ${isToday ? 'today' : ''}`}
            title={`${count} card${count !== 1 ? 's' : ''} due`}
            data-date={dateStr}
            data-offset={offset}
            style={{ cursor: 'pointer' }}
            onClick={() => onClick && onClick(dateStr, offset)}
        >
            <div class="forecast-day-name">{isToday ? 'Today' : dayName}</div>
            <div class="forecast-day-date">{formattedDate}</div>
            <div class={`forecast-day-count ${countClass}`}>{count}</div>
            <div class="forecast-day-label">{count === 1 ? 'card' : 'cards'}</div>
        </div>
    );
};

export interface MiniForecastStripProps {
    days: Array<{
        isToday: boolean;
        dayName: string;
        formattedDate: string;
        count: number;
        countClass: string;
        dateStr: string;
        offset: number;
    }>;
    onFullForecastClick?: () => void;
    onDayClick?: (dateStr: string, offset: number) => void;
}

export const MiniForecastStrip: FunctionalComponent<MiniForecastStripProps> = ({
    days,
    onFullForecastClick,
    onDayClick
}) => {
    return (
        <div class="ana-panel-wide" style={{ marginTop: '24px' }}>
            <div class="ana-panel-header">
                <span class="ana-panel-title">
                    <svg class="svg-icon" viewBox="0 0 24 24" style={{ width: '16px', height: '16px', marginRight: '6px', stroke: 'currentColor', fill: 'none', verticalAlign: 'middle', strokeWidth: 2 }}>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    Upcoming Reviews — Next 7 Days
                </span>
                <a
                    id="full-forecast-link"
                    href="#"
                    class="ana-panel-link"
                    style={{ color: 'var(--md-primary)', textDecoration: 'none', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={(e) => {
                        e.preventDefault();
                        if (onFullForecastClick) onFullForecastClick();
                    }}
                >
                    Full 30-Day Forecast
                    <svg class="svg-icon" viewBox="0 0 24 24" style={{ width: '12px', height: '12px', stroke: 'currentColor', fill: 'none', strokeWidth: 2 }}>
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <polyline points="15 3 21 3 21 9" />
                        <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                </a>
            </div>
            <div class="ana-forecast-strip" style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '8px 0' }}>
                {days.map(d => (
                    <ForecastDayTile key={d.dateStr} {...d} onClick={onDayClick} />
                ))}
            </div>
        </div>
    );
};

export interface MiniForecastPanelProps {
    dataUtils: DataUtils;
    onFullForecastClick?: () => void;
    onDayClick?: (dateStr: string, offset: number) => void;
}

export const MiniForecastPanel: FunctionalComponent<MiniForecastPanelProps> = ({
    dataUtils,
    onFullForecastClick,
    onDayClick
}) => {
    const handleFullForecast = useCallback(() => {
        if (onFullForecastClick) {
            onFullForecastClick();
            return;
        }
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.getURL && chrome.tabs?.create) {
                chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/forecast/forecast.html') });
            }
        } catch (linkErr) {
            UIUtils.catchError('MiniForecast', 'Error handling full forecast link click', linkErr);
        }
    }, [onFullForecastClick]);

    const handleDayClick = useCallback((dateStr: string, offset: number) => {
        if (onDayClick) {
            onDayClick(dateStr, offset);
            return;
        }
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime?.getURL && chrome.tabs?.create) {
                const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=forecast&date=${dateStr}&offset=${offset}`);
                chrome.tabs.create({ url: dataUrl });
            }
        } catch (cardClickErr) {
            UIUtils.catchError('MiniForecast', 'Error handling day card click', cardClickErr);
        }
    }, [onDayClick]);

    const days = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayNames = DAY_NAMES_SHORT;

        const dueCounts: Record<number, number> = {};
        let pastDueCount = 0;

        if (dataUtils && dataUtils.cards) {
            dataUtils.cards.forEach(card => {
                try {
                    const dueDate = new Date(card.due);
                    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                    const diffDays = Math.floor((dueDay.getTime() - todayStart.getTime()) / MS_PER_DAY);

                    if (diffDays < 0) pastDueCount++;
                    else if (diffDays < 7) dueCounts[diffDays] = (dueCounts[diffDays] || 0) + 1;
                } catch (cardErr) {
                    UIUtils.catchError('MiniForecast', 'Error calculating card due date offset', cardErr, { card });
                }
            });
        }
        dueCounts[0] = (dueCounts[0] || 0) + pastDueCount;

        const result: Array<{
            isToday: boolean;
            dayName: string;
            formattedDate: string;
            count: number;
            countClass: string;
            dateStr: string;
            offset: number;
        }> = [];

        for (let i = 0; i < 7; i++) {
            const date = new Date(todayStart);
            date.setDate(date.getDate() + i);
            const count = dueCounts[i] || 0;
            const isToday = i === 0;

            let countClass = 'count-zero';
            if (count > 0 && count <= 3) countClass = 'count-low';
            else if (count > 3 && count <= 8) countClass = 'count-med';
            else if (count > 8) countClass = 'count-high';

            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            result.push({
                isToday,
                dayName: isToday ? 'Today' : dayNames[date.getDay()],
                formattedDate: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                count,
                countClass,
                dateStr,
                offset: i
            });
        }
        return result;
    }, [dataUtils]);

    return (
        <MiniForecastStrip
            days={days}
            onFullForecastClick={handleFullForecast}
            onDayClick={handleDayClick}
        />
    );
};

/**
 * Visualizes a compact 7-day upcoming review workload forecast.
 * Provides interactive tiles linking to specific date queues and the full 30-day forecast page.
 */
export class MiniForecast {
    /** Data utility instance for card due dates and collection queries */
    dataUtils: DataUtils;

    /**
     * Initializes the MiniForecast component.
     * @param dataUtils - Card statistics helper instance.
     */
    constructor(dataUtils: DataUtils) {
        try {
            this.dataUtils = dataUtils;
        } catch (err) {
            UIUtils.catchError('MiniForecast', 'Error initializing MiniForecast constructor', err);
            this.dataUtils = dataUtils;
        }
    }

    /**
     * Renders the 7-day mini forecast bar into the specified container element
     * and attaches click listeners to navigate to filtered card lists.
     * @param containerId - DOM ID of the container element hosting the forecast.
     * @returns void
     * @fires chrome.tabs.create
     */
    render(containerId: string): void {
        try {
            const container = document.getElementById(containerId);
            if (!container) return;

            render(<MiniForecastPanel dataUtils={this.dataUtils} />, container);
        } catch (err) {
            UIUtils.catchError('MiniForecast', 'Error rendering MiniForecast', err, { containerId });
        }
    }

    /**
     * Aggregates cards into day-offset buckets (0 = today, 1 = tomorrow, ..., 6 = in 6 days),
     * folding any overdue cards into the today bucket.
     * @param todayStart - Start-of-day Date instance for today.
     * @returns Mapping of day offset (0-6) to due card count.
     */
    private calculateDueCounts(todayStart: Date): Record<number, number> {
        const dueCounts: Record<number, number> = {};
        let pastDueCount = 0;

        if (this.dataUtils && this.dataUtils.cards) {
            this.dataUtils.cards.forEach(card => {
                try {
                    const dueDate = new Date(card.due);
                    const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                    const diffDays = Math.floor((dueDay.getTime() - todayStart.getTime()) / MS_PER_DAY);

                    if (diffDays < 0) pastDueCount++;
                    else if (diffDays < 7) dueCounts[diffDays] = (dueCounts[diffDays] || 0) + 1;
                } catch (cardErr) {
                    UIUtils.catchError('MiniForecast', 'Error calculating card due date offset', cardErr, { card });
                }
            });
        }
        dueCounts[0] = (dueCounts[0] || 0) + pastDueCount;
        return dueCounts;
    }

    /**
     * Generates HTML markup for each of the 7 daily forecast cards.
     * @param todayStart - Start-of-day Date instance for today.
     * @param dueCounts - Count of due cards keyed by day offset.
     * @param dayNames - Array of abbreviated weekday names.
     * @returns Concatenated HTML string of day cards.
     */
    private buildForecastStrip(todayStart: Date, dueCounts: Record<number, number>, dayNames: string[]): string {
        let forecastStrip = '';
        for (let i = 0; i < 7; i++) {
            const date = new Date(todayStart);
            date.setDate(date.getDate() + i);
            const count = dueCounts[i] || 0;
            const isToday = i === 0;

            let countClass = 'count-zero';
            if (count > 0 && count <= 3) countClass = 'count-low';
            else if (count > 3 && count <= 8) countClass = 'count-med';
            else if (count > 8) countClass = 'count-high';

            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            forecastStrip += `
                <div class="forecast-day-card ${isToday ? 'today' : ''}" title="${count} card${count !== 1 ? 's' : ''} due" data-date="${dateStr}" data-offset="${i}" style="cursor: pointer;">
                    <div class="forecast-day-name">${isToday ? 'Today' : dayNames[date.getDay()]}</div>
                    <div class="forecast-day-date">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div class="forecast-day-count ${countClass}">${count}</div>
                    <div class="forecast-day-label">${count === 1 ? 'card' : 'cards'}</div>
                </div>`;
        }
        return forecastStrip;
    }

    /**
     * Attaches click handlers to the 30-day forecast link and individual day cards,
     * opening new Chrome tabs with appropriately filtered parameters.
     * @param container - Root container element hosting the forecast strip.
     * @returns void
     * @fires chrome.tabs.create
     */
    private bindEventListeners(container: HTMLElement): void {
        const fullForecastLink = container.querySelector('#full-forecast-link');
        if (fullForecastLink) {
            fullForecastLink.addEventListener('click', (e) => {
                try {
                    e.preventDefault();
                    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL && chrome.tabs?.create) {
                        chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/forecast/forecast.html') });
                    }
                } catch (linkErr) {
                    UIUtils.catchError('MiniForecast', 'Error handling full forecast link click', linkErr);
                }
            });
        }

        const dayCards = container.querySelectorAll('.forecast-day-card');
        dayCards.forEach(card => {
            card.addEventListener('click', () => {
                try {
                    const dateStr = card.getAttribute('data-date');
                    const offset = card.getAttribute('data-offset');
                    if (typeof chrome !== 'undefined' && chrome.runtime?.getURL && chrome.tabs?.create) {
                        const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=forecast&date=${dateStr}&offset=${offset}`);
                        chrome.tabs.create({ url: dataUrl });
                    }
                } catch (cardClickErr) {
                    UIUtils.catchError('MiniForecast', 'Error handling day card click', cardClickErr);
                }
            });
        });
    }
}

