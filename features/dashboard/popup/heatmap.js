// features/dashboard/popup/heatmap.js - Contribution activity heatmap grid rendering

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
