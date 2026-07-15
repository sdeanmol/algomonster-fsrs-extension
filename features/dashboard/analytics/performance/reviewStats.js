export class ReviewStats {
    constructor(dataUtils) {
        this.dataUtils = dataUtils;
        this.period = 'daily';
    }

    setPeriod(period) {
        this.period = period;
    }

    render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const activity = this.dataUtils.activity;
        const sortedDates = Object.keys(activity).sort();
        if (sortedDates.length === 0) {
            container.innerHTML = '<div class="retention-empty">No review activity recorded yet.</div>';
            return;
        }

        let buckets = [];
        let totalReviews = 0;
        let activePeriods = 0;

        if (this.period === 'daily') {
            // Show last 14 days
            const today = new Date();
            for (let i = 13; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const key = this.dataUtils.formatDateKey(d);
                const count = activity[key] || 0;
                totalReviews += count;
                if (count > 0) activePeriods++;
                buckets.push({
                    label: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
                    tooltip: `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${count} reviews`,
                    value: count
                });
            }
        } else if (this.period === 'weekly') {
            // Show last 12 weeks
            const today = new Date();
            for (let w = 11; w >= 0; w--) {
                let weekTotal = 0;
                const weekStart = new Date(today);
                weekStart.setDate(weekStart.getDate() - (w * 7 + 6));
                for (let d = 0; d < 7; d++) {
                    const day = new Date(weekStart);
                    day.setDate(day.getDate() + d);
                    const key = this.dataUtils.formatDateKey(day);
                    weekTotal += activity[key] || 0;
                }
                totalReviews += weekTotal;
                if (weekTotal > 0) activePeriods++;
                const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                buckets.push({
                    label: `W${12 - w}`,
                    tooltip: `Week of ${weekLabel}: ${weekTotal} reviews`,
                    value: weekTotal
                });
            }
        } else if (this.period === 'monthly') {
            // Show last 12 months
            const today = new Date();
            for (let m = 11; m >= 0; m--) {
                const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
                const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
                let monthTotal = 0;
                Object.entries(activity).forEach(([dateStr, count]) => {
                    if (dateStr.startsWith(monthKey)) monthTotal += count;
                });
                totalReviews += monthTotal;
                if (monthTotal > 0) activePeriods++;
                buckets.push({
                    label: monthDate.toLocaleDateString('en-US', { month: 'short' }),
                    tooltip: `${monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}: ${monthTotal} reviews`,
                    value: monthTotal
                });
            }
        }

        const avgPerPeriod = activePeriods > 0 ? (totalReviews / buckets.length).toFixed(1) : '0';
        const maxVal = Math.max(...buckets.map(b => b.value), 1);

        // Summary row
        const periodLabels = { daily: 'Day', weekly: 'Week', monthly: 'Month' };
        let html = `<div class="review-stats-summary">
            <div class="review-stat-mini">
                <div class="review-stat-value">${totalReviews}</div>
                <div class="review-stat-label">Total Reviews</div>
            </div>
            <div class="review-stat-mini">
                <div class="review-stat-value">${avgPerPeriod}</div>
                <div class="review-stat-label">Avg / ${periodLabels[this.period]}</div>
            </div>
            <div class="review-stat-mini">
                <div class="review-stat-value">${activePeriods}</div>
                <div class="review-stat-label">Active ${periodLabels[this.period]}s</div>
            </div>
        </div>`;

        // Bar chart
        html += '<div class="review-bars-container">';
        buckets.forEach(b => {
            const heightPct = (b.value / maxVal) * 100;
            const barClass = b.value === 0 ? 'review-bar review-bar-zero' : 'review-bar';
            html += `<div class="review-bar-col" title="${b.tooltip}">
                <div class="${barClass}" style="height:${Math.max(heightPct, 3)}%;"></div>
                <div class="review-bar-label">${b.label}</div>
            </div>`;
        });
        html += '</div>';

        container.innerHTML = html;
    }
}
