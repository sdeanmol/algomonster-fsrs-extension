/**
 * @file features/dashboard/history/history.js
 * @description Main controller for the dedicated contribution history dashboard.
 * Aggregates review logs by year, month, or day, and displays grid list drill-downs
 * with interactive CSS charts tracking user activity metrics.
 * Upstream dependencies: None.
 * Downstream dependencies: chrome.storage (reads fsrsActivity, chromeSettings).
 */

let activityData = {};
let currentView = 'year'; 
let selectedYear = null;
let selectedMonth = null; 

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['fsrsActivity', 'chromeSettings'], (result) => {
        activityData = result.fsrsActivity || {};
        window.chromeSettings = result.chromeSettings || {};
        attachListeners();
        renderView();
    });
});

/**
 * Attaches click event listeners to basic static view filter buttons.
 */
function attachListeners() {
    document.getElementById('view-year').addEventListener('click', () => setView('year'));
    document.getElementById('view-month').addEventListener('click', () => setView('month'));
    document.getElementById('view-day').addEventListener('click', () => setView('day'));
}

/**
 * Updates current dashboard view mode and sets target drill-down scope variables.
 * @param {string} view - View modes: 'year', 'month', or 'day'.
 * @param {string} [targetYear=null] - Year string filter context.
 * @param {string} [targetMonth=null] - Month key string filter context.
 */
function setView(view, targetYear = null, targetMonth = null) {
    currentView = view;
    if (view === 'year') {
        selectedYear = null; selectedMonth = null;
    } else if (view === 'month') {
        selectedYear = targetYear || selectedYear || getMostRecentYear();
        selectedMonth = null;
    } else if (view === 'day') {
        selectedYear = targetYear || selectedYear || getMostRecentYear();
        selectedMonth = targetMonth || selectedMonth || getMostRecentMonth(selectedYear);
    }
    renderView();
}

/**
 * Retrieves the most recent year string from aggregated data.
 * @returns {string} The most recent year.
 */
function getMostRecentYear() {
    const years = Object.keys(aggregateByYear());
    return years.length > 0 ? years.sort().reverse()[0] : new Date().getFullYear().toString();
}

/**
 * Retrieves the most recent month string for a given year.
 * @param {string} year - Year filter context.
 * @returns {string} The most recent month key.
 */
function getMostRecentMonth(year) {
    const months = Object.keys(aggregateByMonth(year));
    return months.length > 0 ? months.sort().reverse()[0] : `${year}-01`;
}

/**
 * Navigates users to a list view of card entities matching the specific date filter.
 * @param {string} dateRange - ISO date string or year/month key prefix.
 * @param {Event} [event] - The trigger event.
 */
function openDataTab(dateRange, event) {
    if (event) event.stopPropagation(); 
    chrome.tabs.create({ url: `features/common/data/data.html?view=history&date=${dateRange}` });
}

/**
 * Builds breadcrumbs and renders the container panels/grid cards matching active view modes.
 */
function renderView() {
    ['year', 'month', 'day'].forEach(v => {
        document.getElementById(`view-${v}`).classList.toggle('active', v === currentView);
    });

    // 1. Build Breadcrumbs (using classes instead of onclick)
    const breadcrumb = document.getElementById('breadcrumb');
    if (currentView === 'year') {
        breadcrumb.innerHTML = `All Years`;
    } else if (currentView === 'month') {
        breadcrumb.innerHTML = `<span class="bc-year">All Years</span> > ${selectedYear}`;
    } else if (currentView === 'day') {
        const m = parseInt(selectedMonth.split('-')[1], 10) - 1;
        breadcrumb.innerHTML = `<span class="bc-year">All Years</span> > <span class="bc-month" data-year="${selectedYear}">${selectedYear}</span> > ${monthNames[m]}`;
    }

    // 2. Render Cards
    const container = document.getElementById('chart-container');
    container.className = `grid grid-${currentView}s`; 
    container.innerHTML = '';

    if (Object.keys(activityData).length === 0) {
        container.innerHTML = `<div class="empty-state">No contribution activity recorded yet. Start reviewing!</div>`;
        return;
    }

    if (currentView === 'year') {
        const yearData = aggregateByYear();
        Object.keys(yearData).sort().reverse().forEach(year => {
            // Replaced onclick with data-attributes and classes
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
    else if (currentView === 'month') {
        const monthData = aggregateByMonth(selectedYear);
        if (Object.keys(monthData).length === 0) {
            container.innerHTML = `<div class="empty-state">No activity in ${selectedYear}</div>`;
        } else {
            Object.keys(monthData).sort().reverse().forEach(monthKey => {
                const mIndex = parseInt(monthKey.split('-')[1], 10) - 1;
                container.innerHTML += `
                    <div class="card card-month" data-year="${selectedYear}" data-month="${monthKey}" title="Click to view Days">
                        <div class="card-title">${monthNames[mIndex]}</div>
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
    else if (currentView === 'day') {
        const dayData = aggregateByDay(selectedMonth);
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
                        <div class="card-subtitle">Reviews</div>
                        <div class="card-day-link">
                            <svg class="svg-icon" viewBox="0 0 24 24" style="width:12px; height:12px; margin-right:4px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                            View Cards
                        </div>
                    </div>
                `;
            });
        }
    }

    // 3. Render Chart
    renderHistoryChart();

    // 4. Attach Dynamic Listeners to injected elements safely
    bindDynamicListeners();
}

/**
 * Computes datapoints based on active view modes and renders column chart bars.
 */
function renderHistoryChart() {
    const chartWrapper = document.getElementById('history-chart-wrapper');
    if (!chartWrapper) return;

    const showCharts = window.chromeSettings && window.chromeSettings.showCharts !== undefined
        ? window.chromeSettings.showCharts
        : true;

    if (!showCharts || Object.keys(activityData).length === 0) {
        chartWrapper.style.display = 'none';
        return;
    }

    chartWrapper.style.display = 'block';
    chartWrapper.innerHTML = '';

    let dataPoints = [];
    if (currentView === 'year') {
        const yearData = aggregateByYear();
        const years = Object.keys(yearData).sort();
        dataPoints = years.map(yr => ({
            label: yr,
            value: yearData[yr].total,
            action: () => setView('month', yr)
        }));
    } else if (currentView === 'month') {
        const monthData = aggregateByMonth(selectedYear);
        for (let m = 1; m <= 12; m++) {
            const mStr = m.toString().padStart(2, '0');
            const monthKey = `${selectedYear}-${mStr}`;
            const count = monthData[monthKey] ? monthData[monthKey].total : 0;
            dataPoints.push({
                label: monthNames[m - 1].substring(0, 3),
                value: count,
                action: () => setView('day', selectedYear, monthKey),
                tooltip: `${monthNames[m - 1]} ${selectedYear}: ${count} reviews`
            });
        }
    } else if (currentView === 'day') {
        const dayData = aggregateByDay(selectedMonth);
        const [year, month] = selectedMonth.split('-');
        const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dStr = d.toString().padStart(2, '0');
            const dateStr = `${selectedMonth}-${dStr}`;
            const count = dayData[dateStr] || 0;
            dataPoints.push({
                label: d.toString(),
                value: count,
                action: (e) => openDataTab(dateStr, e),
                tooltip: `${new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${count} reviews`
            });
        }
    }

    const maxVal = Math.max(...dataPoints.map(p => p.value), 1);
    
    // Create title
    const title = document.createElement('h3');
    title.className = 'chart-title-label';
    title.innerText = currentView === 'year' 
        ? 'Reviews per Year' 
        : currentView === 'month' 
            ? `Reviews in ${selectedYear}`
            : `Reviews in ${monthNames[parseInt(selectedMonth.split('-')[1]) - 1]} ${selectedMonth.split('-')[0]}`;
    chartWrapper.appendChild(title);

    const chartContainerInner = document.createElement('div');
    chartContainerInner.className = 'chart-container-inner';

    // Viewport
    const viewport = document.createElement('div');
    viewport.className = 'chart-viewport';

    // Grid lines
    const gridLines = document.createElement('div');
    gridLines.className = 'chart-grid-lines';
    gridLines.innerHTML = `
        <div class="grid-line" style="bottom: 0%;"><span>0</span></div>
        <div class="grid-line" style="bottom: 50%;"><span>${Math.round(maxVal / 2)}</span></div>
        <div class="grid-line" style="bottom: 100%;"><span>${maxVal}</span></div>
    `;
    viewport.appendChild(gridLines);

    // Bars
    const barsContainer = document.createElement('div');
    barsContainer.className = 'chart-bars';

    dataPoints.forEach(dp => {
        const barCol = document.createElement('div');
        barCol.className = 'chart-bar-col';
        if (dp.value > 0) barCol.classList.add('has-value');

        const heightPct = (dp.value / maxVal) * 100;

        const bar = document.createElement('div');
        bar.className = 'chart-bar';
        bar.style.height = `${Math.max(heightPct, 3)}%`; // Min 3% for visibility

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

        if (dp.value > 0 || currentView !== 'day') {
            barCol.style.cursor = 'pointer';
            barCol.addEventListener('click', dp.action);
        }

        barsContainer.appendChild(barCol);
    });

    viewport.appendChild(barsContainer);
    chartContainerInner.appendChild(viewport);
    chartWrapper.appendChild(chartContainerInner);
}

/**
 * Safely binds click listener events to dynamically added DOM elements
 * avoiding security/CSP issues.
 */
function bindDynamicListeners() {
    // Breadcrumb Listeners
    document.querySelectorAll('.bc-year').forEach(el => {
        el.addEventListener('click', () => setView('year'));
    });
    document.querySelectorAll('.bc-month').forEach(el => {
        el.addEventListener('click', (e) => setView('month', e.target.getAttribute('data-year')));
    });

    // Card Drill-Down Listeners
    document.querySelectorAll('.card-year').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') return; // Ignore if clicking the button inside
            setView('month', e.currentTarget.getAttribute('data-year'));
        });
    });
    document.querySelectorAll('.card-month').forEach(el => {
        el.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            setView('day', e.currentTarget.getAttribute('data-year'), e.currentTarget.getAttribute('data-month'));
        });
    });

    // Link "View Data" Button Listeners
    document.querySelectorAll('.btn-year').forEach(el => {
        el.addEventListener('click', (e) => openDataTab(e.currentTarget.getAttribute('data-year'), e));
    });
    document.querySelectorAll('.btn-month').forEach(el => {
        el.addEventListener('click', (e) => openDataTab(e.currentTarget.getAttribute('data-month'), e));
    });
    document.querySelectorAll('.card-day').forEach(el => {
        el.addEventListener('click', (e) => openDataTab(e.currentTarget.getAttribute('data-date'), e));
    });
}

/**
 * Aggregates review metrics by year keys.
 * @returns {Object} Year mapping counts.
 */
function aggregateByYear() {
    const years = {};
    for (const [dateString, count] of Object.entries(activityData)) {
        const year = dateString.split('-')[0];
        if (!years[year]) years[year] = { total: 0, activeDays: 0 };
        years[year].total += count;
        years[year].activeDays += 1;
    }
    return years;
}

/**
 * Aggregates review metrics by month keys.
 * @param {string} targetYear - Year filter context.
 * @returns {Object} Month mapping counts.
 */
function aggregateByMonth(targetYear) {
    const months = {};
    for (const [dateString, count] of Object.entries(activityData)) {
        if (dateString.startsWith(targetYear)) {
            const monthKey = dateString.substring(0, 7); 
            if (!months[monthKey]) months[monthKey] = { total: 0 };
            months[monthKey].total += count;
        }
    }
    return months;
}

/**
 * Aggregates review metrics by day keys.
 * @param {string} targetMonth - Month filter context.
 * @returns {Object} Day mapping counts.
 */
function aggregateByDay(targetMonth) {
    const days = {};
    for (const [dateString, count] of Object.entries(activityData)) {
        if (dateString.startsWith(targetMonth)) {
            days[dateString] = count;
        }
    }
    return days;
}