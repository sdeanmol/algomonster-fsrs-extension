export class MiniForecast {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Count due cards per day for next 7 days
        const dueCounts = {};
        let pastDueCount = 0;

        this.dataUtils.cards.forEach(card => {
            const dueDate = new Date(card.due);
            const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            const diffDays = Math.floor((dueDay - todayStart) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) pastDueCount++;
            else if (diffDays < 7) dueCounts[diffDays] = (dueCounts[diffDays] || 0) + 1;
        });
        dueCounts[0] = (dueCounts[0] || 0) + pastDueCount;

        let forecastStrip = '';
        for (let i = 0; i < 7; i++) {
            const date = new Date(todayStart);
            date.setDate(date.getDate() + i);
            const count = dueCounts[i] || 0;
            const isToday = i === 0;

            let countClass = 'count-zero';
            if (count > 0 && count <= 3) countClass = 'count-low';
            else if (count > 3 && count <= 8) countClass = 'count-med';
            else if (count > 8) countClass = 'count-high';

            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

            forecastStrip += `
                <div class="forecast-day-card ${isToday ? 'today' : ''}" title="${count} card${count !== 1 ? 's' : ''} due" data-date="${dateStr}" data-offset="${i}" style="cursor: pointer;">
                    <div class="forecast-day-name">${isToday ? 'Today' : dayNames[date.getDay()]}</div>
                    <div class="forecast-day-date">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                    <div class="forecast-day-count ${countClass}">${count}</div>
                    <div class="forecast-day-label">${count === 1 ? 'card' : 'cards'}</div>
                </div>`;
        }

        container.innerHTML = `
            <div class="ana-panel-wide" style="margin-top: 24px;">
                <div class="ana-panel-header">
                    <span class="ana-panel-title">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:16px;height:16px;margin-right:6px;stroke:currentColor;fill:none;vertical-align:middle;stroke-width:2;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        Upcoming Reviews — Next 7 Days
                    </span>
                    <a id="full-forecast-link" href="#" class="ana-panel-link" style="color:var(--md-primary);text-decoration:none;font-size:0.9rem;display:flex;align-items:center;gap:4px;">
                        Full 30-Day Forecast
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:12px;height:12px;stroke:currentColor;fill:none;stroke-width:2;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                    </a>
                </div>
                <div class="ana-forecast-strip" style="display:flex;gap:12px;overflow-x:auto;padding:8px 0;">
                    ${forecastStrip}
                </div>
            </div>
        `;
        
        // Add event listener for the link after rendering
        const fullForecastLink = container.querySelector('#full-forecast-link');
        if (fullForecastLink) {
            fullForecastLink.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/forecast/forecast.html') });
            });
        }

        // Add event listeners for day cards
        const dayCards = container.querySelectorAll('.forecast-day-card');
        dayCards.forEach(card => {
            card.addEventListener('click', () => {
                const dateStr = card.getAttribute('data-date');
                const offset = card.getAttribute('data-offset');
                const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=forecast&date=${dateStr}&offset=${offset}`);
                chrome.tabs.create({ url: dataUrl });
            });
        });
    }
}
