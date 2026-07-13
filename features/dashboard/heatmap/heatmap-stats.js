// features/dashboard/heatmap/heatmap-stats.js - Streak and active days stats calculator

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
