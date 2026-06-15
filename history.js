let activityData = {};
let currentView = 'year'; // Options: 'year', 'month', 'day'
let selectedYear = null;
let selectedMonth = null; // Format: "YYYY-MM"

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['fsrsActivity'], (result) => {
        activityData = result.fsrsActivity || {};
        attachListeners();
        renderView();
    });
});

function attachListeners() {
    document.getElementById('view-year').addEventListener('click', () => setView('year'));
    document.getElementById('view-month').addEventListener('click', () => setView('month'));
    document.getElementById('view-day').addEventListener('click', () => setView('day'));
}

// Navigates between granularity levels
function setView(view, targetYear = null, targetMonth = null) {
    currentView = view;
    
    if (view === 'year') {
        selectedYear = null;
        selectedMonth = null;
    } else if (view === 'month') {
        selectedYear = targetYear || selectedYear || getMostRecentYear();
        selectedMonth = null;
    } else if (view === 'day') {
        selectedYear = targetYear || selectedYear || getMostRecentYear();
        selectedMonth = targetMonth || selectedMonth || getMostRecentMonth(selectedYear);
    }
    
    renderView();
}

function getMostRecentYear() {
    const years = Object.keys(aggregateByYear());
    return years.length > 0 ? years.sort().reverse()[0] : new Date().getFullYear().toString();
}

function getMostRecentMonth(year) {
    const months = Object.keys(aggregateByMonth(year));
    return months.length > 0 ? months.sort().reverse()[0] : `${year}-01`;
}

// Renders the UI based on state
function renderView() {
    // 1. Update active button styles
    ['year', 'month', 'day'].forEach(v => {
        document.getElementById(`view-${v}`).classList.toggle('active', v === currentView);
    });

    // 2. Update Breadcrumb Navigation
    const breadcrumb = document.getElementById('breadcrumb');
    if (currentView === 'year') {
        breadcrumb.innerHTML = `All Years`;
    } else if (currentView === 'month') {
        breadcrumb.innerHTML = `<span onclick="setView('year')">All Years</span> > ${selectedYear}`;
    } else if (currentView === 'day') {
        const m = parseInt(selectedMonth.split('-')[1], 10) - 1;
        breadcrumb.innerHTML = `<span onclick="setView('year')">All Years</span> > <span onclick="setView('month', '${selectedYear}')">${selectedYear}</span> > ${monthNames[m]}`;
    }

    // 3. Render Grid Data
    const container = document.getElementById('chart-container');
    container.className = `grid grid-${currentView}s`; // changes css class to grid-years, grid-months, etc.
    container.innerHTML = '';

    if (Object.keys(activityData).length === 0) {
        container.innerHTML = `<div class="empty-state">No contribution activity recorded yet. Start reviewing!</div>`;
        return;
    }

    if (currentView === 'year') {
        const yearData = aggregateByYear();
        Object.keys(yearData).sort().reverse().forEach(year => {
            container.innerHTML += `
                <div class="card" onclick="setView('month', '${year}')">
                    <div class="card-title">${year}</div>
                    <div class="card-value">${yearData[year].total}</div>
                    <div class="card-subtitle">Patterns Reviewed<br>Active Days: ${yearData[year].activeDays}</div>
                </div>
            `;
        });
    } 
    else if (currentView === 'month') {
        const monthData = aggregateByMonth(selectedYear);
        if (Object.keys(monthData).length === 0) return container.innerHTML = `<div class="empty-state">No activity in ${selectedYear}</div>`;
        
        Object.keys(monthData).sort().reverse().forEach(monthKey => {
            const mIndex = parseInt(monthKey.split('-')[1], 10) - 1;
            container.innerHTML += `
                <div class="card" onclick="setView('day', '${selectedYear}', '${monthKey}')">
                    <div class="card-title">${monthNames[mIndex]}</div>
                    <div class="card-value">${monthData[monthKey].total}</div>
                    <div class="card-subtitle">Patterns Reviewed</div>
                </div>
            `;
        });
    } 
    else if (currentView === 'day') {
        const dayData = aggregateByDay(selectedMonth);
        if (Object.keys(dayData).length === 0) return container.innerHTML = `<div class="empty-state">No activity in this month.</div>`;
        
        Object.keys(dayData).sort().reverse().forEach(dateString => {
            const dateObj = new Date(dateString);
            const displayDate = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
            
            container.innerHTML += `
                <div class="card no-click">
                    <div class="card-title" style="font-size: 14px;">${displayDate}</div>
                    <div class="card-value" style="font-size: 20px;">${dayData[dateString]}</div>
                    <div class="card-subtitle">Reviews</div>
                </div>
            `;
        });
    }
}

// --- Data Aggregation Functions ---

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

function aggregateByMonth(targetYear) {
    const months = {};
    for (const [dateString, count] of Object.entries(activityData)) {
        if (dateString.startsWith(targetYear)) {
            const monthKey = dateString.substring(0, 7); // "YYYY-MM"
            if (!months[monthKey]) months[monthKey] = { total: 0 };
            months[monthKey].total += count;
        }
    }
    return months;
}

function aggregateByDay(targetMonth) {
    const days = {};
    for (const [dateString, count] of Object.entries(activityData)) {
        if (dateString.startsWith(targetMonth)) {
            days[dateString] = count;
        }
    }
    return days;
}