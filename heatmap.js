let activityData = {};
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

document.addEventListener('DOMContentLoaded', () => {
    chrome.storage.local.get(['fsrsActivity'], (result) => {
        activityData = result.fsrsActivity || {};
        setupFilters();
        renderHeatmap(); // Draw initial lifetime view
    });
});

function setupFilters() {
    const typeSelect = document.getElementById('filter-type');
    const yearSelect = document.getElementById('select-year');
    const monthSelect = document.getElementById('select-month');
    const daySelect = document.getElementById('select-day');

    // 1. Extract existing chronological limits from user data
    const activeDates = Object.keys(activityData).sort();
    let years = new Set();
    let months = new Set(); // Format: "MM"
    
    // Default fallback to current time if database is completely empty
    if (activeDates.length === 0) {
        const d = new Date();
        years.add(d.getFullYear().toString());
    } else {
        activeDates.forEach(dStr => {
            const parts = dStr.split('-');
            years.add(parts[0]);
        });
    }

    // Populate Year Dropdown
    yearSelect.innerHTML = '';
    Array.from(years).sort().reverse().forEach(y => {
        yearSelect.innerHTML += `<option value="${y}">${y}</option>`;
    });

    // Populate Month Dropdown helper
    function updateMonthDropdown(targetYear) {
        monthSelect.innerHTML = '';
        // Find months active in that specific year
        let activeMonths = new Set();
        Object.keys(activityData).forEach(dStr => {
            if (dStr.startsWith(targetYear)) {
                activeMonths.add(dStr.split('-')[1]);
            }
        });
        // If empty, default fill all months
        if (activeMonths.size === 0) {
            for(let m=1; m<=12; m++) activeMonths.add(m.toString().padStart(2, '0'));
        }
        Array.from(activeMonths).sort().forEach(m => {
            monthSelect.innerHTML += `<option value="${m}">${monthNames[parseInt(m)-1]}</option>`;
        });
    }

    // Populate Day Dropdown helper
    function updateDayDropdown(targetYear, targetMonth) {
        daySelect.innerHTML = '';
        let activeDays = [];
        Object.keys(activityData).forEach(dStr => {
            if (dStr.startsWith(`${targetYear}-${targetMonth}`)) {
                activeDays.push(dStr.split('-')[2]);
            }
        });
        
        if (activeDays.length === 0) {
            const daysInMonth = new Date(targetYear, parseInt(targetMonth), 0).getDate();
            for(let d=1; d<=daysInMonth; d++) activeDays.push(d.toString().padStart(2, '0'));
        }
        
        activeDays.sort().forEach(d => {
            daySelect.innerHTML += `<option value="${d}">Day ${parseInt(d)}</option>`;
        });
    }

    // Initialize secondary select contents
    updateMonthDropdown(yearSelect.value);
    updateDayDropdown(yearSelect.value, monthSelect.value);

    // 2. Control input visibility maps based on selected mode
    typeSelect.addEventListener('change', () => {
        const mode = typeSelect.value;
        yearSelect.style.display = (mode !== 'lifetime') ? 'inline-block' : 'none';
        monthSelect.style.display = (mode === 'month-wise' || mode === 'day-wise') ? 'inline-block' : 'none';
        daySelect.style.display = (mode === 'day-wise') ? 'inline-block' : 'none';
        renderHeatmap();
    });

    yearSelect.addEventListener('change', () => {
        updateMonthDropdown(yearSelect.value);
        updateDayDropdown(yearSelect.value, monthSelect.value);
        renderHeatmap();
    });

    monthSelect.addEventListener('change', () => {
        updateDayDropdown(yearSelect.value, monthSelect.value);
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

    // --- VIEW SCHEDULING LOGIC ---
    if (mode === 'lifetime') {
        const today = new Date();
        const activeDates = Object.keys(activityData).sort();
        
        if (activeDates.length > 0) {
            const parts = activeDates[0].split('-');
            const oldestDate = new Date(parts[0], parts[1] - 1, parts[2]);
            oldestDate.setDate(oldestDate.getDate() - oldestDate.getDay()); // Align to Sunday
            
            const diffTime = today.getTime() - oldestDate.getTime();
            totalDays = Math.max(364, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1); 
            startDate = oldestDate;
        } else {
            totalDays = 364; // 52 complete weeks
            startDate = new Date(today);
            startDate.setDate(today.getDate() - totalDays + 1);
        }
        summaryText.innerText = "Showing: Full Academic History";
    } 
    else if (mode === 'year-wise') {
        // Show all 365 days of the selected calendar year
        startDate = new Date(chosenYear, 0, 1);
        startDate.setDate(startDate.getDate() - startDate.getDay()); // Sunday wrap alignment
        
        const endOfYear = new Date(chosenYear, 11, 31);
        const diffTime = endOfYear.getTime() - startDate.getTime();
        totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        summaryText.innerText = `Showing: Full Year ${chosenYear}`;
    } 
    else if (mode === 'month-wise') {
        // Show just the weeks belonging to that specific month
        startDate = new Date(chosenYear, parseInt(chosenMonth) - 1, 1);
        startDate.setDate(startDate.getDate() - startDate.getDay()); // Align grid block to Sunday
        
        const lastDayOfMonth = new Date(chosenYear, parseInt(chosenMonth), 0);
        const diffTime = lastDayOfMonth.getTime() - startDate.getTime();
        totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
        summaryText.innerText = `Showing: ${monthNames[parseInt(chosenMonth)-1]} ${chosenYear}`;
    } 
    else if (mode === 'day-wise') {
        // Isolate single box view
        startDate = new Date(chosenYear, parseInt(chosenMonth) - 1, parseInt(chosenDay));
        startDate.setDate(startDate.getDate() - startDate.getDay()); // Wrap in a single week block
        totalDays = 7; 
        summaryText.innerText = `Target: ${monthNames[parseInt(chosenMonth)-1]} ${parseInt(chosenDay)}, ${chosenYear}`;
    }

    // --- DOM CELL GENERATION LOOP ---
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
        cell.title = `${count} reviews on ${displayDate}`;

        // Gray out days that leak outside the filtered focus boundaries
        let isOutsideFilterRange = false;
        if (mode === 'year-wise' && currentYearString !== chosenYear) isOutsideFilterRange = true;
        if (mode === 'month-wise' && (currentYearString !== chosenYear || currentMonthString !== chosenMonth)) isOutsideFilterRange = true;
        if (mode === 'day-wise' && (currentYearString !== chosenYear || currentMonthString !== chosenMonth || currentDayString !== chosenDay)) isOutsideFilterRange = true;

        if (isOutsideFilterRange) {
            cell.style.opacity = "0.08"; // Dim days belonging to neighboring weeks
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

    // Append cumulative calculation stats next to titles
    if(totalReviewsCalculated > 0) {
        summaryText.innerText += ` (${totalReviewsCalculated} Total Reviews)`;
    }

    // Snap view focus to final element column on load
    setTimeout(() => {
        const wrapper = document.querySelector('.heatmap-wrapper');
        if (wrapper && mode === 'lifetime') wrapper.scrollLeft = wrapper.scrollWidth;
    }, 50);
}