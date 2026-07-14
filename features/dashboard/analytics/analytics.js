/**
 * @file features/dashboard/analytics/analytics.js
 * @description Main controller for the full-tab analytics dashboard.
 * Implements R2.1 (Retention Curve), R2.2 (Mini Forecast), R2.3 (Tag Donut),
 * R2.4 (Lapse Leaderboard), and R2.5 (Review Stats).
 */
class AnalyticsDashboard {
    constructor() {
        this.cards = [];
        this.activity = {};
        this.currentStatsPeriod = 'daily';

        // Curated color palette for chart segments
        this.chartColors = [
            '#a8c7fa', '#81c995', '#fde293', '#f28b82',
            '#c4a8fa', '#8ecae6', '#f4a261', '#e76f51',
            '#90be6d', '#f9c74f', '#43aa8b', '#577590'
        ];
    }

    /**
     * Bootstraps analytics by loading card and activity data from storage.
     */
    init() {
        chrome.storage.local.get(['fsrsCards', 'fsrsActivity'], (result) => {
            this.cards = result.fsrsCards || [];
            this.activity = result.fsrsActivity || {};

            this.renderSummaryStats();
            this.renderRetentionCurve();
            this.renderTagDonut();
            this.renderLapseLeaderboard();
            this.renderReviewStats(this.currentStatsPeriod);
            this.renderMiniForecast();

            this.bindEvents();
        });
    }

    /**
     * Binds event listeners for interactive elements.
     */
    bindEvents() {
        // Period tab toggles for review stats
        document.querySelectorAll('.ana-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.ana-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentStatsPeriod = tab.dataset.period;
                this.renderReviewStats(this.currentStatsPeriod);
            });
        });

        // Full forecast link
        const forecastLink = document.getElementById('full-forecast-link');
        if (forecastLink) {
            forecastLink.addEventListener('click', (e) => {
                e.preventDefault();
                chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/forecast/forecast.html') });
            });
        }
    }

    // ========================================================================
    // Summary Stats
    // ========================================================================

    /**
     * Renders the top-level summary stat cards.
     */
    renderSummaryStats() {
        const now = Date.now();
        let totalReps = 0, totalLapses = 0, totalStability = 0, reviewedCards = 0;

        this.cards.forEach(card => {
            totalReps += card.reps || 0;
            totalLapses += card.lapses || 0;
            if (card.stability > 0) {
                totalStability += card.stability;
                reviewedCards++;
            }
        });

        const retention = totalReps > 0 ? Math.round(((totalReps - totalLapses) / totalReps) * 100) : 0;
        const avgStability = reviewedCards > 0 ? (totalStability / reviewedCards).toFixed(1) + 'd' : 'N/A';

        let totalActivityReviews = 0;
        Object.values(this.activity).forEach(c => totalActivityReviews += c);

        const streak = this.calculateCurrentStreak();

        document.getElementById('stat-total-cards').textContent = this.cards.length;
        document.getElementById('stat-total-reviews').textContent = totalActivityReviews;
        document.getElementById('stat-retention').textContent = retention + '%';
        document.getElementById('stat-avg-stability').textContent = avgStability;
        document.getElementById('stat-streak').textContent = streak > 0 ? streak + 'd' : '0';

        document.getElementById('analytics-subtitle').textContent =
            `${this.cards.length} patterns tracked · ${totalActivityReviews} total reviews · ${retention}% retention rate`;
    }

    /**
     * Calculates the current consecutive-day review streak.
     * @returns {number} Current streak in days.
     */
    calculateCurrentStreak() {
        let streak = 0;
        const today = new Date();
        const checkDate = new Date(today);

        for (let i = 0; i < 365; i++) {
            const dateStr = this.formatDateKey(checkDate);
            if (this.activity[dateStr] && this.activity[dateStr] > 0) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                if (i === 0) {
                    checkDate.setDate(checkDate.getDate() - 1);
                    continue;
                }
                break;
            }
        }
        return streak;
    }

    // ========================================================================
    // R2.1: Retention Curve
    // ========================================================================

    /**
     * Renders an SVG retention curve graph per tag, showing predicted memory recall
     * over time using the FSRS retrievability formula: R(t) = exp(decay × t / stability).
     */
    renderRetentionCurve() {
        const container = document.getElementById('retention-curve-container');
        if (!container) return;

        // Group cards by tag, compute average stability per tag
        const tagStabilities = {};
        this.cards.forEach(card => {
            if (card.stability > 0 && card.tags && card.tags.length > 0) {
                card.tags.forEach(tag => {
                    if (!tagStabilities[tag]) tagStabilities[tag] = [];
                    tagStabilities[tag].push(card.stability);
                });
            }
        });

        const tags = Object.keys(tagStabilities);
        if (tags.length === 0) {
            container.innerHTML = '<div class="retention-empty">No reviewed cards with tags yet. Review some cards to see retention curves.</div>';
            return;
        }

        // Compute average stability per tag, sort by stability desc, take top 6
        const tagAvgs = tags.map(tag => ({
            tag,
            avgStability: tagStabilities[tag].reduce((a, b) => a + b, 0) / tagStabilities[tag].length,
            count: tagStabilities[tag].length
        })).sort((a, b) => b.count - a.count).slice(0, 6);

        // Time points to plot (in days)
        const timePoints = [0, 1, 3, 7, 14, 21, 30];
        const decay = -0.5;

        // SVG dimensions
        const svgW = 900, svgH = 200;
        const padL = 45, padR = 20, padT = 10, padB = 30;
        const chartW = svgW - padL - padR;
        const chartH = svgH - padT - padB;

        const xScale = (t) => padL + (t / 30) * chartW;
        const yScale = (r) => padT + (1 - r) * chartH;

        let svgContent = `<svg class="retention-curve-svg" viewBox="0 0 ${svgW} ${svgH}" preserveAspectRatio="xMidYMid meet">`;

        // Grid lines (horizontal at 0%, 25%, 50%, 75%, 100%)
        [0, 0.25, 0.5, 0.75, 1.0].forEach(r => {
            const y = yScale(r);
            svgContent += `<line class="retention-grid-line" x1="${padL}" y1="${y}" x2="${svgW - padR}" y2="${y}" />`;
            svgContent += `<text class="retention-axis-label" x="${padL - 6}" y="${y + 3}" text-anchor="end">${Math.round(r * 100)}%</text>`;
        });

        // X-axis labels
        timePoints.forEach(t => {
            const x = xScale(t);
            svgContent += `<text class="retention-axis-label" x="${x}" y="${svgH - 4}" text-anchor="middle">${t === 0 ? 'Now' : t + 'd'}</text>`;
        });

        // Plot curves for each tag
        tagAvgs.forEach((tagData, idx) => {
            const color = this.chartColors[idx % this.chartColors.length];
            const points = timePoints.map(t => {
                const R = Math.exp(decay * t / tagData.avgStability);
                return { t, R, x: xScale(t), y: yScale(R) };
            });

            // Smooth line path
            const pathParts = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`));
            svgContent += `<polyline class="retention-line" points="${points.map(p => `${p.x},${p.y}`).join(' ')}" stroke="${color}" />`;

            // Dots at each data point
            points.forEach(p => {
                svgContent += `<circle class="retention-dot" cx="${p.x}" cy="${p.y}" fill="${color}"><title>${tagData.tag}: ${Math.round(p.R * 100)}% at ${p.t}d</title></circle>`;
            });
        });

        svgContent += `</svg>`;

        // Legend
        let legendHtml = '<div class="retention-legend">';
        tagAvgs.forEach((tagData, idx) => {
            const color = this.chartColors[idx % this.chartColors.length];
            legendHtml += `<div class="retention-legend-item">
                <span class="retention-legend-dot" style="background:${color};"></span>
                ${tagData.tag} <span style="color:var(--md-text-low);font-size:10px;margin-left:2px;">(S̄=${tagData.avgStability.toFixed(1)}d, n=${tagData.count})</span>
            </div>`;
        });
        legendHtml += '</div>';

        container.innerHTML = svgContent + legendHtml;
    }

    // ========================================================================
    // R2.3: Tag Donut Chart
    // ========================================================================

    /**
     * Renders an SVG donut chart showing card distribution by tag.
     */
    renderTagDonut() {
        const container = document.getElementById('tag-chart-container');
        if (!container) return;

        // Count cards per tag
        const tagCounts = {};
        this.cards.forEach(card => {
            if (card.tags && card.tags.length > 0) {
                card.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
            } else {
                tagCounts['Untagged'] = (tagCounts['Untagged'] || 0) + 1;
            }
        });

        const total = this.cards.length;
        if (total === 0) {
            container.innerHTML = '<div class="retention-empty">No cards saved yet.</div>';
            return;
        }

        // Sort by count, take top 8 + "Other"
        let sorted = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
        let displayTags = sorted.slice(0, 8);
        const otherCount = sorted.slice(8).reduce((sum, [, c]) => sum + c, 0);
        if (otherCount > 0) {
            displayTags.push(['Other', otherCount]);
        }

        // SVG donut chart using stroke-dasharray technique on a circle
        const R = 60; // radius
        const circumference = 2 * Math.PI * R;
        const cx = 80, cy = 80;
        let currentOffset = 0;

        let svgSegments = '';
        displayTags.forEach(([tag, count], idx) => {
            const pct = count / total;
            const segLen = pct * circumference;
            const color = this.chartColors[idx % this.chartColors.length];

            svgSegments += `<circle class="tag-donut-segment" 
                cx="${cx}" cy="${cy}" r="${R}"
                stroke="${color}"
                stroke-dasharray="${segLen} ${circumference - segLen}"
                stroke-dashoffset="${-currentOffset}"
                data-tag="${tag}">
                <title>${tag}: ${count} cards (${Math.round(pct * 100)}%)</title>
            </circle>`;

            currentOffset += segLen;
        });

        const donutSvg = `<svg class="tag-donut-svg" viewBox="0 0 160 160">${svgSegments}</svg>`;

        // Legend list
        let legendHtml = '<div class="tag-legend">';
        displayTags.forEach(([tag, count], idx) => {
            const color = this.chartColors[idx % this.chartColors.length];
            const pct = Math.round((count / total) * 100);
            legendHtml += `<div class="tag-legend-item" data-tag="${tag}">
                <span class="tag-legend-dot" style="background:${color};"></span>
                <span class="tag-legend-name">${tag}</span>
                <span class="tag-legend-count">${count}</span>
                <span class="tag-legend-pct">${pct}%</span>
            </div>`;
        });
        legendHtml += '</div>';

        container.innerHTML = `
            <div class="tag-donut-wrapper">
                <div style="position:relative;">
                    ${donutSvg}
                    <div class="tag-donut-center-label">
                        <div class="tag-donut-total">${total}</div>
                        <div class="tag-donut-total-label">Cards</div>
                    </div>
                </div>
                ${legendHtml}
            </div>`;

        // Click legend items to navigate to data page filtered by tag
        container.querySelectorAll('.tag-legend-item').forEach(item => {
            item.addEventListener('click', () => {
                const tag = item.dataset.tag;
                if (tag && tag !== 'Other' && tag !== 'Untagged') {
                    chrome.tabs.create({ url: chrome.runtime.getURL(`features/common/data/data.html?view=total&tag=${encodeURIComponent(tag)}`) });
                }
            });
        });
    }

    // ========================================================================
    // R2.4: Lapse Leaderboard
    // ========================================================================

    /**
     * Renders a table of cards with the highest lapse counts.
     */
    renderLapseLeaderboard() {
        const container = document.getElementById('lapse-leaderboard-container');
        if (!container) return;

        const lapsedCards = this.cards
            .filter(c => (c.lapses || 0) > 0)
            .sort((a, b) => (b.lapses || 0) - (a.lapses || 0))
            .slice(0, 10);

        if (lapsedCards.length === 0) {
            container.innerHTML = '<div class="lapse-empty">No lapsed cards yet — your memory is holding strong! 💪</div>';
            return;
        }

        const maxLapses = lapsedCards[0].lapses || 1;

        let tableHtml = `<table class="lapse-table">
            <thead><tr>
                <th style="width:40px;">#</th>
                <th>Problem</th>
                <th>Tags</th>
                <th>Lapses</th>
                <th>Visual</th>
                <th>Stability</th>
                <th>Difficulty</th>
            </tr></thead><tbody>`;

        lapsedCards.forEach((card, idx) => {
            const lapses = card.lapses || 0;
            const pct = Math.round((lapses / maxLapses) * 100);
            const tags = (card.tags || []).slice(0, 3).map(t => `<span class="lapse-tag">${t}</span>`).join('');
            const stability = card.stability > 0 ? card.stability.toFixed(1) + 'd' : 'New';
            const difficulty = card.difficulty > 0 ? card.difficulty.toFixed(1) + '/10' : 'N/A';

            tableHtml += `<tr>
                <td class="lapse-rank ${idx < 3 ? 'lapse-rank-top' : ''}">${idx + 1}</td>
                <td><a href="${card.problemUrl}" target="_blank" class="lapse-title-link">${card.problemTitle || 'Untitled'}</a></td>
                <td><div class="lapse-tags">${tags}</div></td>
                <td class="lapse-count">${lapses}</td>
                <td class="lapse-bar-cell"><div class="lapse-bar-track"><div class="lapse-bar-fill" style="width:${pct}%;"></div></div></td>
                <td>${stability}</td>
                <td>${difficulty}</td>
            </tr>`;
        });

        tableHtml += '</tbody></table>';
        container.innerHTML = tableHtml;
    }

    // ========================================================================
    // R2.5: Review Stats
    // ========================================================================

    /**
     * Renders review statistics with a mini bar chart for the selected period.
     * @param {string} period - One of 'daily', 'weekly', 'monthly'.
     */
    renderReviewStats(period) {
        const container = document.getElementById('review-stats-container');
        if (!container) return;

        const sortedDates = Object.keys(this.activity).sort();
        if (sortedDates.length === 0) {
            container.innerHTML = '<div class="retention-empty">No review activity recorded yet.</div>';
            return;
        }

        let buckets = [];
        let totalReviews = 0;
        let activePeriods = 0;

        if (period === 'daily') {
            // Show last 14 days
            const today = new Date();
            for (let i = 13; i >= 0; i--) {
                const d = new Date(today);
                d.setDate(d.getDate() - i);
                const key = this.formatDateKey(d);
                const count = this.activity[key] || 0;
                totalReviews += count;
                if (count > 0) activePeriods++;
                buckets.push({
                    label: d.toLocaleDateString('en-US', { weekday: 'narrow' }),
                    tooltip: `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${count} reviews`,
                    value: count
                });
            }
        } else if (period === 'weekly') {
            // Show last 12 weeks
            const today = new Date();
            for (let w = 11; w >= 0; w--) {
                let weekTotal = 0;
                const weekStart = new Date(today);
                weekStart.setDate(weekStart.getDate() - (w * 7 + 6));
                for (let d = 0; d < 7; d++) {
                    const day = new Date(weekStart);
                    day.setDate(day.getDate() + d);
                    const key = this.formatDateKey(day);
                    weekTotal += this.activity[key] || 0;
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
        } else if (period === 'monthly') {
            // Show last 12 months
            const today = new Date();
            for (let m = 11; m >= 0; m--) {
                const monthDate = new Date(today.getFullYear(), today.getMonth() - m, 1);
                const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
                let monthTotal = 0;
                Object.entries(this.activity).forEach(([dateStr, count]) => {
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
                <div class="review-stat-label">Avg / ${periodLabels[period]}</div>
            </div>
            <div class="review-stat-mini">
                <div class="review-stat-value">${activePeriods}</div>
                <div class="review-stat-label">Active ${periodLabels[period]}s</div>
            </div>
        </div>`;

        // Bar chart
        html += '<div class="review-bars-container">';
        buckets.forEach(b => {
            const heightPct = (b.value / maxVal) * 100;
            const barClass = b.value === 0 ? 'review-bar review-bar-zero' : 'review-bar';
            html += `<div class="review-bar-col">
                <div class="review-bar-tooltip">${b.tooltip}</div>
                <div class="${barClass}" style="height:${Math.max(heightPct, 3)}%;"></div>
                <div class="review-bar-label">${b.label}</div>
            </div>`;
        });
        html += '</div>';

        container.innerHTML = html;
    }

    // ========================================================================
    // R2.2: Mini Forecast
    // ========================================================================

    /**
     * Renders a 7-day mini forecast strip showing upcoming review counts.
     */
    renderMiniForecast() {
        const container = document.getElementById('mini-forecast-container');
        if (!container) return;

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        // Count due cards per day for next 7 days
        const dueCounts = {};
        let pastDueCount = 0;

        this.cards.forEach(card => {
            const dueDate = new Date(card.due);
            const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
            const diffDays = Math.floor((dueDay - todayStart) / (1000 * 60 * 60 * 24));

            if (diffDays < 0) pastDueCount++;
            else if (diffDays < 7) dueCounts[diffDays] = (dueCounts[diffDays] || 0) + 1;
        });
        dueCounts[0] = (dueCounts[0] || 0) + pastDueCount;

        let html = '';
        for (let i = 0; i < 7; i++) {
            const date = new Date(todayStart);
            date.setDate(date.getDate() + i);
            const count = dueCounts[i] || 0;
            const isToday = i === 0;

            let countClass = 'count-zero';
            if (count > 0 && count <= 3) countClass = 'count-low';
            else if (count > 3 && count <= 8) countClass = 'count-med';
            else if (count > 8) countClass = 'count-high';

            html += `<div class="forecast-day-card ${isToday ? 'today' : ''}" title="${count} card${count !== 1 ? 's' : ''} due">
                <div class="forecast-day-name">${isToday ? 'Today' : dayNames[date.getDay()]}</div>
                <div class="forecast-day-date">${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                <div class="forecast-day-count ${countClass}">${count}</div>
                <div class="forecast-day-label">${count === 1 ? 'card' : 'cards'}</div>
            </div>`;
        }

        container.innerHTML = html;
    }

    // ========================================================================
    // Utilities
    // ========================================================================

    /**
     * Formats a Date object to local YYYY-MM-DD key.
     * @param {Date} date - Date object.
     * @returns {string} YYYY-MM-DD formatted date string.
     */
    formatDateKey(date) {
        return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const analytics = new AnalyticsDashboard();
    analytics.init();
});
