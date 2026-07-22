/**
 * @file features/dashboard/forecast/forecast.js
 * @description Main controller for the dedicated forecast future workloads dashboard.
 * Projects upcoming review volumes up to 30 days based on scheduled card due dates,
 * rendering column charts and interactive calendars.
 */
class ForecastDashboard {
    constructor() {
        this.chromeSettings = {};
    }

    /**
     * Bootstraps forecast settings and triggers UI loads.
     */
    init() {
        chrome.storage.local.get(['fsrsCards', 'chromeSettings'], (result) => {
            const cards = result.fsrsCards || [];
            this.chromeSettings = result.chromeSettings || {};
            this.renderForecast(cards);
        });
    }

    /**
     * Orchestrates the grouping of cards by due date, calculates peak/total workload stats,
     * and renders both the workload forecast chart and the 30-day forecast calendar.
     * 
     * @param {Array} cards - All scheduled problem cards.
     */
    renderForecast(cards) {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const daysToShow = 30;

        // Group cards by due date (day granularity)
        const dueCounts = {};
        let pastDueCount = 0;

        cards.forEach(card => {
            if (card.state === 0) return; // Ignore 'New' unstudied cards in spaced-repetition forecast

            const dueDate = new Date(card.due);
            const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            
            // Use Math.round to prevent off-by-one errors on Daylight Saving Time boundaries
            const diffDays = Math.round((dueDay - todayStart) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) {
                pastDueCount++;
            } else if (diffDays <= daysToShow) {
                const key = diffDays;
                dueCounts[key] = (dueCounts[key] || 0) + 1;
            }
        });

        // Add past-due cards to today
        dueCounts[0] = (dueCounts[0] || 0) + pastDueCount;

        // Compute stats
        let totalUpcoming = 0;
        let peakCount = 0;
        let peakDayIdx = 0;

        for (let i = 0; i <= daysToShow; i++) {
            const count = dueCounts[i] || 0;
            totalUpcoming += count;
            
            // Peak day should represent the highest *scheduled* future workload (ignoring current backlog/today)
            if (i > 0 && count > peakCount) {
                peakCount = count;
                peakDayIdx = i;
            }
        }

        const avgPerDay = totalUpcoming > 0 ? (totalUpcoming / (daysToShow + 1)).toFixed(1) : '0';
        const peakDate = new Date(todayStart);
        peakDate.setDate(peakDate.getDate() + peakDayIdx);

        // Update summary cards
        document.getElementById('forecast-total').textContent = totalUpcoming;
        document.getElementById('forecast-avg').textContent = avgPerDay;
        document.getElementById('forecast-peak').textContent = peakCount;
        document.getElementById('forecast-today').textContent = dueCounts[0] || 0;
        document.getElementById('forecast-subtitle').textContent = 
            `${cards.length} total cards · Next 30 days starting ${this.formatDateShort(todayStart)}`;

        // Render Forecast Chart
        this.renderForecastChart(dueCounts, todayStart, daysToShow);

        // Render calendar grid
        const calendar = document.getElementById('forecast-calendar');
        if (!calendar) return;
        calendar.innerHTML = '';

        // Day headers
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(name => {
            const header = document.createElement('div');
            header.className = 'cal-header';
            header.textContent = name;
            calendar.appendChild(header);
        });

        // Leading empty cells (align to weekday)
        const startDow = todayStart.getDay();
        for (let i = 0; i < startDow; i++) {
            const empty = document.createElement('div');
            empty.className = 'cal-cell cal-empty';
            calendar.appendChild(empty);
        }

        // Day cells
        for (let i = 0; i <= daysToShow; i++) {
            const date = new Date(todayStart);
            date.setDate(date.getDate() + i);
            const count = dueCounts[i] || 0;

            const cell = document.createElement('div');
            cell.className = 'cal-cell';
            if (i === 0) cell.classList.add('cal-today');

            // Volume-based coloring
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

            // Click to view cards due on this day
            const cellDateStr = this.formatDateKey(date);
            const cellDayOffset = i;
            cell.addEventListener('click', () => {
                if (count === 0) return; // No cards due, skip navigation
                const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=forecast&date=${cellDateStr}&offset=${cellDayOffset}`);
                chrome.tabs.create({ url: dataUrl });
            });

            calendar.appendChild(cell);
        }

        // Legend
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
        calendar.parentElement.appendChild(legend);
    }

    /**
     * Returns a short formatted date string (e.g., 'Jul 14').
     * @param {Date} date - Date object.
     * @returns {string} Short formatted date.
     */
    formatDateShort(date) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    /**
     * Returns a full formatted date string (e.g., 'Tue, Jul 14').
     * @param {Date} date - Date object.
     * @returns {string} Full formatted date.
     */
    formatDateFull(date) {
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    /**
     * Formats a Date object to local YYYY-MM-DD key.
     * @param {Date} date - Date object.
     * @returns {string} YYYY-MM-DD formatted date string.
     */
    formatDateKey(date) {
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }

    /**
     * Renders the Workload Forecast chart using dynamic CSS height columns.
     * Bars are color-coded based on count volume to indicate upcoming peak study days.
     * 
     * @param {Object} dueCounts - Binned counts of cards due per day offset (index 0 = today).
     * @param {Date} todayStart - Start date object of today.
     * @param {number} daysToShow - Forecast range length (e.g. 30 days).
     */
    renderForecastChart(dueCounts, todayStart, daysToShow) {
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
        const dataPoints = [];

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

        // Grid lines
        const gridLines = document.createElement('div');
        gridLines.className = 'chart-grid-lines';
        gridLines.innerHTML = `
            <div class="grid-line" style="bottom: 0%;"><span>0</span></div>
            <div class="grid-line" style="bottom: 50%;"><span>${Math.round(maxLimit / 2)}</span></div>
            <div class="grid-line" style="bottom: 100%;"><span>${maxLimit}</span></div>
        `;
        viewport.appendChild(gridLines);

        // Bars Container
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
                // Match calendar colors
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
                    const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=forecast&date=${dp.dateStr}&offset=${dp.index}`);
                    chrome.tabs.create({ url: dataUrl });
                });
            }

            barsContainer.appendChild(barCol);
        });

        viewport.appendChild(barsContainer);
        chartContainerInner.appendChild(viewport);
        chartWrapper.appendChild(chartContainerInner);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const forecast = new ForecastDashboard();
    forecast.init();
});
