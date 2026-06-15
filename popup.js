let isLifetimeView = false;

document.addEventListener('DOMContentLoaded', () => {
    loadStats(); loadHeatmap(isLifetimeView);

    const toggleBtn = document.getElementById('toggle-lifetime-btn');
    toggleBtn.addEventListener('click', () => {
        isLifetimeView = !isLifetimeView;
        toggleBtn.innerText = isLifetimeView ? "Show Last 12 Weeks" : "Show Lifetime";
        loadHeatmap(isLifetimeView);
    });

    document.getElementById('export-btn').addEventListener('click', () => {
        chrome.storage.local.get(['fsrsCards', 'fsrsActivity'], (result) => {
            const url = URL.createObjectURL(new Blob([JSON.stringify({ cards: result.fsrsCards || [], activity: result.fsrsActivity || {} }, null, 2)], { type: 'application/json' }));
            chrome.downloads.download({ url: url, filename: `algo_fsrs_backup_${new Date().toISOString().split('T')[0]}.json`, saveAs: true });
            showStatus("Backup exported successfully!");
        });
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const imported = JSON.parse(e.target.result);
                let newCards = Array.isArray(imported) ? imported : imported.cards || [];
                let newActivity = Array.isArray(imported) ? {} : imported.activity || {};
                chrome.storage.local.set({ fsrsCards: newCards, fsrsActivity: newActivity }, () => {
                    showStatus("Data imported successfully!");
                    loadStats(); loadHeatmap(isLifetimeView);
                });
            } catch (err) { showStatus("Error reading file.", true); }
        };
        reader.readAsText(file);
    });

    // --- NEW: Clickable Stat Boxes ---
    document.getElementById('box-total').addEventListener('click', () => {
        chrome.tabs.create({ url: 'data.html?view=total' });
    });
    document.getElementById('box-due').addEventListener('click', () => {
        chrome.tabs.create({ url: 'data.html?view=due' });
    });
    document.getElementById('box-retention').addEventListener('click', () => {
        chrome.tabs.create({ url: 'data.html?view=retention' });
    });
});

function loadStats() {
    chrome.storage.local.get(['fsrsCards'], (result) => {
        const cards = result.fsrsCards || [];
        const now = new Date().getTime();
        document.getElementById('total-cards').innerText = cards.length;
        document.getElementById('due-cards').innerText = cards.filter(c => c.due <= now).length;

        let totalReps = 0, totalLapses = 0;
        cards.forEach(c => { totalReps += c.reps || 0; totalLapses += c.lapses || 0; });
        document.getElementById('retention-rate').innerText = totalReps > 0 ? Math.round(((totalReps - totalLapses) / totalReps) * 100) + "%" : "0%";
    });
}

function loadHeatmap(lifetime = false) {
    chrome.storage.local.get(['fsrsActivity'], (result) => {
        const activity = result.fsrsActivity || {};
        const grid = document.getElementById('heatmap-grid');
        grid.innerHTML = '';

        const today = new Date();
        let totalDays = 0;
        let startDate = new Date(today);

        if (lifetime && Object.keys(activity).length > 0) {
            const oldestDateParts = Object.keys(activity).sort()[0].split('-');
            const oldestDate = new Date(oldestDateParts[0], oldestDateParts[1] - 1, oldestDateParts[2]);
            oldestDate.setDate(oldestDate.getDate() - oldestDate.getDay());
            totalDays = Math.floor((today.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            startDate = oldestDate;
        } else {
            totalDays = (11 * 7) + (today.getDay() + 1);
            startDate.setDate(today.getDate() - totalDays + 1);
        }

        for (let i = 0; i < totalDays; i++) {
            const cellDate = new Date(startDate);
            cellDate.setDate(startDate.getDate() + i);
            const dateString = new Date(cellDate.getTime() - (cellDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            const count = activity[dateString] || 0;

            const cell = document.createElement('div');
            cell.className = `heatmap-cell level-${Math.min(4, count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 8 ? 3 : 4)}`;
            cell.title = `${count} reviews on ${dateString}`;
            grid.appendChild(cell);
        }
        setTimeout(() => grid.scrollLeft = grid.scrollWidth, 10);
    });
}

function showStatus(msg, isError = false) {
    const el = document.getElementById('status-msg');
    el.innerText = msg; el.style.color = isError ? "#e74c3c" : "#2ecc71";
    setTimeout(() => el.innerText = "", 3000);
}