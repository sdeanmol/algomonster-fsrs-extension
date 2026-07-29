/**
 * @file features/dashboard/forecast/forecast.ts
 * @description Main controller for the dedicated forecast future workloads dashboard.
 * Projects upcoming review volumes up to 30 days based on scheduled card due dates,
 * rendering column charts and interactive calendars.
 */

import { Logger } from '@common/logger';
import { Card, StorageData, ChromeSettings } from '../../../types/domain';

export class ForecastDashboard {
    chromeSettings: ChromeSettings;

    constructor() {
        this.chromeSettings = {};
    }

    /**
     * Bootstraps forecast settings and triggers UI loads.
     */
    init(): void {
        try {
            chrome.storage.local.get(['fsrsCards', 'chromeSettings'], (result: StorageData) => {
                try {
                    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                    if (lastError) {
                        const errorMessage = lastError.message || String(lastError);
                        Logger.error('ForecastDashboard', `Storage error fetching forecast data: ${errorMessage}`, { error: lastError });
                        return;
                    }

                    const cards: Card[] = result.fsrsCards || [];
                    this.chromeSettings = result.chromeSettings || {};
                    this.renderForecast(cards);
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('ForecastDashboard', `Error rendering forecast: ${errorMessage}`, { innerErr });
                    // Comment: Non-fatal chart rendering error
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ForecastDashboard', `Failed storage get in Forecast init: ${errorMessage}`, { err });
            // Comment: Catch storage retrieval failure gracefully
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
            const daysToShow = 30;

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

            const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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
                        const errorMessage = clickErr instanceof Error ? clickErr.message : String(clickErr);
                        Logger.error('ForecastDashboard', `Error in calendar cell click handler: ${errorMessage}`, { cellDateStr, clickErr });
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
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ForecastDashboard', `Error orchestrating forecast rendering: ${errorMessage}`, { err });
            // Comment: Non-fatal forecast orchestration error
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

    renderForecastChart(dueCounts: Record<number, number>, todayStart: Date, daysToShow: number): void {
        try {
            const chartWrapper = document.getElementById('forecast-chart-wrapper');
            if (!chartWrapper) return;

            const showCharts = this.chromeSettings && this.chromeSettings.showCharts !== undefined
                ? this.chromeSettings.showCharts
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
                            const errorMessage = clickErr instanceof Error ? clickErr.message : String(clickErr);
                            Logger.error('ForecastDashboard', `Error in chart bar click handler: ${errorMessage}`, { dp, clickErr });
                        }
                    });
                }

                barsContainer.appendChild(barCol);
            });

            viewport.appendChild(barsContainer);
            chartContainerInner.appendChild(viewport);
            chartWrapper.appendChild(chartContainerInner);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ForecastDashboard', `Error rendering forecast chart: ${errorMessage}`, { err });
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        const forecast = new ForecastDashboard();
        forecast.init();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('ForecastDashboard', `Error initializing ForecastDashboard on DOMContentLoaded: ${errorMessage}`, { err });
    }
});
