window.AlgoRecall = window.AlgoRecall || {};

/**
 * @class HeatmapDashboard
 * @description Main controller for the dedicated full-screen contribution heatmap page.
 * Manages calendar date cascades, filters (lifetime, yearly, monthly, weekly), SVG cell grids,
 * and handles click events to query historical reviews details for specific days.
 */
window.AlgoRecall.HeatmapDashboard = class HeatmapDashboard {
    constructor() {
        this.activityData = {};
        this.monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    }

    /**
     * Initializes activity settings from storage and binds cascaded filter listeners.
     */
    init() {
        chrome.storage.local.get(['fsrsActivity'], (result) => {
            this.activityData = result.fsrsActivity || {};
            
            // Populate backup compatibility state
            window.AlgoRecall.state = window.AlgoRecall.state || {};
            window.AlgoRecall.state.activityData = this.activityData;
            
            this.setupFilters();
            this.renderHeatmap();
        });
    }

    /**
     * Initializes and wires select dropdown filter nodes (year, month, day selectors)
     * dynamically based on years populated in activity data history.
     */
    setupFilters() {
        const typeSelect = document.getElementById('filter-type');
        const yearSelect = document.getElementById('select-year');
        const monthSelect = document.getElementById('select-month');
        const daySelect = document.getElementById('select-day');

        const today = new Date();
        const currentYear = today.getFullYear().toString();
        const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
        const currentDay = today.getDate().toString().padStart(2, '0');

        // Ensure current year is always available and selected by default
        let years = new Set([currentYear]); 
        Object.keys(this.activityData).forEach(d => years.add(d.split('-')[0]));
        
        yearSelect.innerHTML = Array.from(years).sort().reverse().map(y => `<option value="${y}">${y}</option>`).join('');
        yearSelect.value = currentYear;

        // Safely cascade Month updates
        const updateMonthDropdown = () => {
            const targetYear = yearSelect.value;
            let activeMonths = new Set();
            
            Object.keys(this.activityData).filter(d => d.startsWith(targetYear)).forEach(d => activeMonths.add(d.split('-')[1]));
            
            if (activeMonths.size === 0) {
                for(let i=1; i<=12; i++) activeMonths.add(i.toString().padStart(2, '0'));
            }
            
            monthSelect.innerHTML = Array.from(activeMonths).sort().map(m => `<option value="${m}">${this.monthNames[parseInt(m)-1]}</option>`).join('');
            
            if (targetYear === currentYear && activeMonths.has(currentMonth)) {
                monthSelect.value = currentMonth;
            } else {
                monthSelect.value = monthSelect.options[0].value;
            }
        };

        // Safely cascade Day updates
        const updateDayDropdown = () => {
            const targetYear = yearSelect.value;
            const targetMonth = monthSelect.value;
            let activeDays = new Set();
            
            Object.keys(this.activityData).filter(d => d.startsWith(`${targetYear}-${targetMonth}`)).forEach(d => activeDays.add(d.split('-')[2]));
            
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
        };

        updateMonthDropdown();
        updateDayDropdown();

        // Attach Event Listeners
        typeSelect.addEventListener('change', () => {
            const mode = typeSelect.value;
            yearSelect.classList.toggle('hide-select', mode === 'lifetime');
            monthSelect.classList.toggle('hide-select', mode !== 'month-wise' && mode !== 'day-wise');
            daySelect.classList.toggle('hide-select', mode !== 'day-wise');
            this.renderHeatmap();
        });

        yearSelect.addEventListener('change', () => {
            updateMonthDropdown();
            updateDayDropdown();
            this.renderHeatmap();
        });

        monthSelect.addEventListener('change', () => {
            updateDayDropdown();
            this.renderHeatmap();
        });

        daySelect.addEventListener('change', () => this.renderHeatmap());
    }

    /**
     * Computes grid sizing bounds based on selected filters, resets grid contents,
     * and appends interactive cells with visual colors matching review activity levels.
     */
    renderHeatmap() {
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
            const activeDates = Object.keys(this.activityData).sort();
            
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
            if (summaryText) summaryText.innerText = "Showing: Full Academic History";
        } 
        else if (mode === 'year-wise') {
            startDate = new Date(y, 0, 1);
            startDate.setDate(startDate.getDate() - startDate.getDay()); 
            
            const endOfYear = new Date(y, 11, 31);
            const diffTime = endOfYear.getTime() - startDate.getTime();
            totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            if (summaryText) summaryText.innerText = `Showing: Full Year ${y}`;
        } 
        else if (mode === 'month-wise') {
            startDate = new Date(y, m, 1);
            startDate.setDate(startDate.getDate() - startDate.getDay()); 
            
            const lastDayOfMonth = new Date(y, m + 1, 0);
            const diffTime = lastDayOfMonth.getTime() - startDate.getTime();
            totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
            if (summaryText) summaryText.innerText = `Showing: ${this.monthNames[m]} ${y}`;
        } 
        else if (mode === 'day-wise') {
            startDate = new Date(y, m, d);
            startDate.setDate(startDate.getDate() - startDate.getDay()); 
            totalDays = 7; 
            if (summaryText) summaryText.innerText = `Target: ${this.monthNames[m]} ${d}, ${y}`;
        }

        // Render loop
        for (let i = 0; i < totalDays; i++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + i);
            
            const dateString = new Date(cellDate.getTime() - (cellDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const currentYearString = cellDate.getFullYear().toString();
            const currentMonthString = (cellDate.getMonth() + 1).toString().padStart(2, '0');
            const currentDayString = cellDate.getDate().toString().padStart(2, '0');

            let count = this.activityData[dateString] || 0;
            
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
                    chrome.tabs.create({ url: `features/common/data/data.html?view=history&date=${dateString}` });
                });
            }

            grid.appendChild(cell);
        }

        if (summaryText && totalReviewsCalculated > 0) {
            summaryText.innerText += ` (${totalReviewsCalculated} Total Reviews)`;
        }

        // Render Stats Dashboard
        if (window.AlgoRecall.HeatmapStats) {
            window.AlgoRecall.HeatmapStats.renderStatsDashboard(this.activityData);
        }

        // Scroll Grid
        setTimeout(() => {
            const wrapper = document.querySelector('.heatmap-wrapper');
            if (wrapper && mode === 'lifetime') wrapper.scrollLeft = wrapper.scrollWidth;
        }, 50);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new window.AlgoRecall.HeatmapDashboard();
    dashboard.init();
});