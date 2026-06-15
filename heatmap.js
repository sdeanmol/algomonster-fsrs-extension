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
    yearSelect.value = currentYear; // Default to Current Year

    // 2. Safely cascade Month updates
    function updateMonthDropdown() {
        const targetYear = yearSelect.value;
        let activeMonths = new Set();
        
        Object.keys(activityData).filter(d => d.startsWith(targetYear)).forEach(d => activeMonths.add(d.split('-')[1]));
        
        // Fallback to all 12 months if no data exists for this year
        if (activeMonths.size === 0) {
            for(let i=1; i<=12; i++) activeMonths.add(i.toString().padStart(2, '0'));
        }
        
        monthSelect.innerHTML = Array.from(activeMonths).sort().map(m => `<option value="${m}">${monthNames[parseInt(m)-1]}</option>`).join('');
        
        // Smart Defaulting
        if (targetYear === currentYear && activeMonths.has(currentMonth)) {
            monthSelect.value = currentMonth;
        } else {
            monthSelect.value = monthSelect.options[0].value; // Force select first available
        }
    }

    // 3. Safely cascade Day updates
    function updateDayDropdown() {
        const targetYear = yearSelect.value;
        const targetMonth = monthSelect.value;
        let activeDays = new Set();
        
        Object.keys(activityData).filter(d => d.startsWith(`${targetYear}-${targetMonth}`)).forEach(d => activeDays.add(d.split('-')[2]));
        
        // Fallback to all days in the specific month if no data exists
        if (activeDays.size === 0) {
            const daysInMonth = new Date(parseInt(targetYear), parseInt(targetMonth), 0).getDate();
            for(let i=1; i<=daysInMonth; i++) activeDays.add(i.toString().padStart(2, '0'));
        }
        
        daySelect.innerHTML = Array.from(activeDays).sort().map(d => `<option value="${d}">Day ${parseInt(d)}</option>`).join('');
        
        // Smart Defaulting
        if (targetYear === currentYear && targetMonth === currentMonth && activeDays.has(currentDay)) {
            daySelect.value = currentDay;
        } else {
            daySelect.value = daySelect.options[0].value; // Force select first available
        }
    }

    // Initialize the dropdown chains
    updateMonthDropdown();
    updateDayDropdown();

    // 4. Attach Event Listeners
    typeSelect.addEventListener('change', () => {
        const mode = typeSelect.value;
        yearSelect.style.display = (mode !== 'lifetime') ? 'inline-block' : 'none';
        monthSelect.style.display = (mode === 'month-wise' || mode === 'day-wise') ? 'inline-block' : 'none';
        daySelect.style.display = (mode === 'day-wise') ? 'inline-block' : 'none';
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
    grid.innerHTML = '';

    const mode = document.getElementById('filter-type').value;
    const chosenYear = document.getElementById('select-year').value;
    const chosenMonth = document.getElementById('select-month').value;
    const chosenDay = document.getElementById('select-day').value;

    let startDate, totalDays;
    let totalReviewsCalculated = 0;

    // Securely parse dates as integers to prevent NaN crashes
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

        // Dimming logic
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
                chrome.tabs.create({ url: `data.html?view=history&date=${dateString}` });
            });
        }

        grid.appendChild(cell);
    }

    if(totalReviewsCalculated > 0) {
        summaryText.innerText += ` (${totalReviewsCalculated} Total Reviews)`;
    }

    // UI Scroll Snap
    setTimeout(() => {
        const wrapper = document.querySelector('.heatmap-wrapper');
        if (wrapper && mode === 'lifetime') wrapper.scrollLeft = wrapper.scrollWidth;
    }, 50);
}