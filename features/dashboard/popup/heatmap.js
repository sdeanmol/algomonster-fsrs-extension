/**
 * @file features/dashboard/popup/heatmap.js
 * @description Renders a contribution activity heatmap grid inside the dashboard popup.
 * Calculates review volume metrics grouped by calendar date string in user's timezone.
 * Upstream dependencies: None.
 * Downstream dependencies: features/dashboard/popup/popup.js (invokes loadHeatmap).
 */

/**
 * Loads FSRS review activity counts from storage and renders heat cells inside grid containers.
 * Supports showing lifetime counts or constraints to the last 12 weeks.
 * @param {boolean} [lifetime=false] - If true, scales from the oldest recorded review date; otherwise, shows last 12 weeks.
 */
function loadHeatmap(lifetime = false) {
    chrome.storage.local.get(['fsrsActivity'], (result) => {
        const activity = result.fsrsActivity || {};
        const grid = document.getElementById('heatmap-grid');
        if (!grid) return;
        
        grid.innerHTML = ''; 

        const today = new Date();
        const dayOfWeek = today.getDay(); 
        
        let totalDays = 0;
        let startDate = new Date(today);

        if (lifetime && Object.keys(activity).length > 0) {
            const dateKeys = Object.keys(activity).sort();
            const oldestDateParts = dateKeys[0].split('-'); 
            const oldestDate = new Date(oldestDateParts[0], oldestDateParts[1] - 1, oldestDateParts[2]);
            oldestDate.setDate(oldestDate.getDate() - oldestDate.getDay());
            
            const diffTime = today.getTime() - oldestDate.getTime();
            totalDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1; 
            startDate = oldestDate;
        } else {
            totalDays = (11 * 7) + (dayOfWeek + 1); 
            startDate.setDate(today.getDate() - totalDays + 1);
        }

        for (let i = 0; i < totalDays; i++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + i);
            
            const dateString = new Date(cellDate.getTime() - (cellDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const count = activity[dateString] || 0;

            const cell = document.createElement('div');
            cell.className = 'heatmap-cell';
            cell.title = count === 1 ? `1 review on ${dateString}` : `${count} reviews on ${dateString}`;

            if (count === 0) cell.classList.add('level-0');
            else if (count <= 2) cell.classList.add('level-1');
            else if (count <= 5) cell.classList.add('level-2');
            else if (count <= 8) cell.classList.add('level-3');
            else cell.classList.add('level-4');

            grid.appendChild(cell);
        }

        setTimeout(() => {
            grid.scrollLeft = grid.scrollWidth;
        }, 10);
    });
}

