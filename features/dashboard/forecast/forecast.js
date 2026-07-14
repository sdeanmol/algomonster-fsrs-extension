// features/dashboard/forecast/forecast.js — Review Forecast Calendar (R2.2)

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['fsrsCards'], (result) => {
        const cards = result.fsrsCards || [];
        renderForecast(cards);
    });
});

function renderForecast(cards) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysToShow = 30;

    // Group cards by due date (day granularity)
    const dueCounts = {};
    let pastDueCount = 0;

    cards.forEach(card => {
        const dueDate = new Date(card.due);
        const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const diffDays = Math.floor((dueDay - todayStart) / (1000 * 60 * 60 * 24));

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
        if (count > peakCount) {
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
        `${cards.length} total cards · Next 30 days starting ${formatDateShort(todayStart)}`;

    // Render calendar grid
    const calendar = document.getElementById('forecast-calendar');
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
        cell.title = `${formatDateFull(date)}: ${count} card${count !== 1 ? 's' : ''} due`;

        // Click to view cards due on this day
        const cellDateStr = formatDateKey(date);
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

function formatDateShort(date) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateFull(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateKey(date) {
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}
