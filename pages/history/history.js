let activityData = {};
let currentView = 'year'; 
let selectedYear = null;
let selectedMonth = null; 

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

function getMostRecentYear() {
    const years = Object.keys(aggregateByYear());
    return years.length > 0 ? years.sort().reverse()[0] : new Date().getFullYear().toString();
}

function getMostRecentMonth(year) {
    const months = Object.keys(aggregateByMonth(year));
    return months.length > 0 ? months.sort().reverse()[0] : `${year}-01`;
}

function openDataTab(dateRange, event) {
    if (event) event.stopPropagation(); 
    chrome.tabs.create({ url: `pages/data/data.html?view=history&date=${dateRange}` });
}

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

    // 3. Attach Dynamic Listeners to injected elements safely
    bindDynamicListeners();
}

// NEW: Dynamically binds events safely to avoid Chrome CSP violations
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
            const monthKey = dateString.substring(0, 7); 
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