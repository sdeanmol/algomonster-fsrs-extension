let activityData = {};
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['fsrsActivity'], (result) => {
        activityData = result.fsrsActivity || {};
        setupFilters();
        renderHeatmap();
    });
});

function setupFilters() {
    const typeSelect = document.getElementById('filter-type');
    const yearSelect = document.getElementById('select-year');
    const monthSelect = document.getElementById('select-month');
    const daySelect = document.getElementById('select-day');

    const today = new Date();
    const currentYear = today.getFullYear().toString();
    const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
    const currentDay = today.getDate().toString().padStart(2, '0');

    // 1. Ensure current year is always available and selected by default
    let years = new Set([currentYear]); 
    Object.keys(activityData).forEach(d => years.add(d.split('-')[0]));
    
    yearSelect.innerHTML = Array.from(years).sort().reverse().map(y => `<option value="${y}">${y}</option>`).join('');
    yearSelect.value = currentYear;

    // 2. Safely cascade Month updates
    function updateMonthDropdown() {
        const targetYear = yearSelect.value;
        let activeMonths = new Set();
        
        Object.keys(activityData).filter(d => d.startsWith(targetYear)).forEach(d => activeMonths.add(d.split('-')[1]));
        
        if (activeMonths.size === 0) {
            for(let i=1; i<=12; i++) activeMonths.add(i.toString().padStart(2, '0'));
        }
        
        monthSelect.innerHTML = Array.from(activeMonths).sort().map(m => `<option value="${m}">${monthNames[parseInt(m)-1]}</option>`).join('');
        
        if (targetYear === currentYear && activeMonths.has(currentMonth)) {
            monthSelect.value = currentMonth;
        } else {
            monthSelect.value = monthSelect.options[0].value;
        }
    }

    // 3. Safely cascade Day updates
    function updateDayDropdown() {
        const targetYear = yearSelect.value;
        const targetMonth = monthSelect.value;
        let activeDays = new Set();
        
        Object.keys(activityData).filter(d => d.startsWith(`${targetYear}-${targetMonth}`)).forEach(d => activeDays.add(d.split('-')[2]));
        
        if (activeDays.size === 0) {
            const daysInMonth = new Date(parseInt(targetYear), parseInt(targetMonth), 0).getDate();
            for(let i=1; i<=daysInMonth; i++) activeDays.add(i.toString().padStart(2, '0'));
        }
        
        daySelect.innerHTML = Array.from(activeDays).sort().map(d => `<option value="${d}">Day ${parseInt(d)}</option>`).join('');
        
        if (targetYear === currentYear && targetMonth === currentMonth && activeDays.has(currentDay)) {
            daySelect.value = currentDay;
        } else {
            daySelect.value = daySelect.options[0].value;
        }
    }

    updateMonthDropdown();
    updateDayDropdown();

    // 4. Attach Event Listeners
    typeSelect.addEventListener('change', () => {
        const mode = typeSelect.value;
        yearSelect.classList.toggle('hide-select', mode === 'lifetime');
        monthSelect.classList.toggle('hide-select', mode !== 'month-wise' && mode !== 'day-wise');
        daySelect.classList.toggle('hide-select', mode !== 'day-wise');
        renderHeatmap();
    });

    yearSelect.addEventListener('change', () => {
        updateMonthDropdown();
        updateDayDropdown();
        renderHeatmap();
    });

    monthSelect.addEventListener('change', () => {
        updateDayDropdown();
        renderHeatmap();
    });

    daySelect.addEventListener('change', renderHeatmap);
}

function renderHeatmap() {
    const grid = document.getElementById('full-heatmap-grid');
    const summaryText = document.getElementById('filter-summary-text');
    if (!grid) return;
    grid.innerHTML = '';

    const mode = document.getElementById('filter-type').value;
    const chosenYear = document.getElementById('select-year').value;
    const chosenMonth = document.getElementById('select-month').value;
    const chosenDay = document.getElementById('select-day').value;

    let startDate, totalDays;
    let totalReviewsCalculated = 0;

    const y = parseInt(chosenYear, 10);
    const m = parseInt(chosenMonth, 10) - 1; 
    const d = parseInt(chosenDay, 10);

    if (mode === 'lifetime') {
        const today = new Date();
        const activeDates = Object.keys(activityData).sort();
        
        if (activeDates.length > 0) {
            const parts = activeDates[0].split('-');
            const oldestDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
            oldestDate.setDate(oldestDate.getDate() - oldestDate.getDay()); 
            
            const diffTime = today.getTime() - oldestDate.getTime();
            totalDays = Math.max(364, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1); 
            startDate = oldestDate;
        } else {
            totalDays = 364; 
            startDate = new Date(today);
            startDate.setDate(today.getDate() - totalDays + 1);
            startDate.setDate(startDate.getDate() - startDate.getDay()); 
        }
        summaryText.innerText = "Showing: Full Academic History";
    } 
    else if (mode === 'year-wise') {
        startDate = new Date(y, 0, 1);
        startDate.setDate(startDate.getDate() - startDate.getDay()); 
        
        const endOfYear = new Date(y, 11, 31);
        const diffTime = endOfYear.getTime() - startDate.getTime();
        totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        summaryText.innerText = `Showing: Full Year ${y}`;
    } 
    else if (mode === 'month-wise') {
        startDate = new Date(y, m, 1);
        startDate.setDate(startDate.getDate() - startDate.getDay()); 
        
        const lastDayOfMonth = new Date(y, m + 1, 0);
        const diffTime = lastDayOfMonth.getTime() - startDate.getTime();
        totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        summaryText.innerText = `Showing: ${monthNames[m]} ${y}`;
    } 
    else if (mode === 'day-wise') {
        startDate = new Date(y, m, d);
        startDate.setDate(startDate.getDate() - startDate.getDay()); 
        totalDays = 7; 
        summaryText.innerText = `Target: ${monthNames[m]} ${d}, ${y}`;
    }

    // Render loop
    for (let i = 0; i < totalDays; i++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + i);
        
        const dateString = new Date(cellDate.getTime() - (cellDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        const currentYearString = cellDate.getFullYear().toString();
        const currentMonthString = (cellDate.getMonth() + 1).toString().padStart(2, '0');
        const currentDayString = cellDate.getDate().toString().padStart(2, '0');

        let count = activityData[dateString] || 0;
        
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        
        const displayDate = cellDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        cell.title = count === 1 ? `1 review on ${displayDate}` : `${count} reviews on ${displayDate}`;

        let isOutsideFilterRange = false;
        if (mode === 'year-wise' && currentYearString !== chosenYear) isOutsideFilterRange = true;
        if (mode === 'month-wise' && (currentYearString !== chosenYear || currentMonthString !== chosenMonth)) isOutsideFilterRange = true;
        if (mode === 'day-wise' && (currentYearString !== chosenYear || currentMonthString !== chosenMonth || currentDayString !== chosenDay)) isOutsideFilterRange = true;

        if (isOutsideFilterRange) {
            cell.style.opacity = "0.08"; 
            cell.style.pointerEvents = "none";
            cell.classList.add('level-0');
        } else {
            totalReviewsCalculated += count;
            if (count === 0) cell.classList.add('level-0');
            else if (count <= 2) cell.classList.add('level-1');
            else if (count <= 5) cell.classList.add('level-2');
            else if (count <= 8) cell.classList.add('level-3');
            else cell.classList.add('level-4');

            cell.addEventListener('click', () => {
                chrome.tabs.create({ url: `pages/data/data.html?view=history&date=${dateString}` });
            });
        }

        grid.appendChild(cell);
    }

    if(totalReviewsCalculated > 0) {
        summaryText.innerText += ` (${totalReviewsCalculated} Total Reviews)`;
    }

    // Render Stats Dashboard
    renderStatsDashboard();

    // Scroll Grid
    setTimeout(() => {
        const wrapper = document.querySelector('.heatmap-wrapper');
        if (wrapper && mode === 'lifetime') wrapper.scrollLeft = wrapper.scrollWidth;
    }, 50);
}

function renderStatsDashboard() {
    const container = document.getElementById('heatmap-stats-container');
    if (!container) return;

    const stats = getStreakStats();

    container.innerHTML = `
        <div class="stats-card stats-card-streak">
            <span class="stats-card-title">
                <svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #f0932b; width:13px; height:13px;"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
                Current Streak
            </span>
            <div class="stats-card-value">
                ${stats.currentStreak}
                <span class="stats-card-unit">days</span>
            </div>
        </div>
        <div class="stats-card stats-card-longest">
            <span class="stats-card-title">
                <svg class="svg-icon" viewBox="0 0 24 24" style="stroke: var(--md-warning); width:13px; height:13px;"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"></path><path d="M12 2a6 6 0 0 0-6 6v3a6 6 0 0 0 12 0V8a6 6 0 0 0-6-6z"></path></svg>
                Longest Streak
            </span>
            <div class="stats-card-value">
                ${stats.longestStreak}
                <span class="stats-card-unit">days</span>
            </div>
        </div>
        <div class="stats-card stats-card-active">
            <span class="stats-card-title">
                <svg class="svg-icon" viewBox="0 0 24 24" style="stroke: var(--md-primary); width:13px; height:13px;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                Active Days
            </span>
            <div class="stats-card-value">
                ${stats.activeDays}
                <span class="stats-card-unit">days</span>
            </div>
        </div>
        <div class="stats-card stats-card-max">
            <span class="stats-card-title">
                <svg class="svg-icon" viewBox="0 0 24 24" style="stroke: var(--md-success); width:13px; height:13px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                Max Reviews
            </span>
            <div class="stats-card-value">
                ${stats.maxReviews}
                <span class="stats-card-unit">reviews</span>
            </div>
        </div>
    `;
}

function getStreakStats() {
    const dates = Object.keys(activityData).filter(d => activityData[d] > 0).sort();
    if (dates.length === 0) {
        return { currentStreak: 0, longestStreak: 0, activeDays: 0, maxReviews: 0 };
    }
    
    const activeDays = dates.length;
    const maxReviews = Math.max(...Object.values(activityData), 0);
    
    let longestStreak = 0;
    let currentStreak = 0;
    
    // Calculate Longest Streak
    let tempStreak = 0;
    let lastTime = null;
    
    dates.forEach(dStr => {
        const parts = dStr.split('-');
        const t = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).getTime();
        
        if (lastTime === null) {
            tempStreak = 1;
        } else {
            const diffDays = Math.round((t - lastTime) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                tempStreak++;
            } else if (diffDays > 1) {
                if (tempStreak > longestStreak) longestStreak = tempStreak;
                tempStreak = 1;
            }
        }
        lastTime = t;
    });
    if (tempStreak > longestStreak) longestStreak = tempStreak;
    
    // Calculate Current Streak
    const oneDay = 1000 * 60 * 60 * 24;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    
    let checkTime = todayTime;
    let todayStr = new Date(checkTime - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    let yesterdayStr = new Date(checkTime - oneDay - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    
    if (activityData[todayStr] > 0 || activityData[yesterdayStr] > 0) {
        if (activityData[todayStr] > 0) {
            checkTime = todayTime;
        } else {
            checkTime = todayTime - oneDay;
        }
        
        while (true) {
            const checkStr = new Date(checkTime - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            if (activityData[checkStr] > 0) {
                currentStreak++;
                checkTime -= oneDay;
            } else {
                break;
            }
        }
    }
    
    return { currentStreak, longestStreak, activeDays, maxReviews };
}