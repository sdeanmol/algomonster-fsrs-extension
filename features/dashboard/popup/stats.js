// features/dashboard/popup/stats.js - Statistics & gamification goals logic

function loadStats() {
    chrome.storage.local.get(['fsrsCards', 'fsrsActivity'], (result) => {
        const cards = result.fsrsCards || [];
        const activity = result.fsrsActivity || {};
        const now = new Date().getTime();
        
        const totalEl = document.getElementById('total-cards');
        const dueEl = document.getElementById('due-cards');
        const retentionEl = document.getElementById('retention-rate');

        const dueToday = cards.filter(c => c.due <= now).length;

        if (totalEl) totalEl.innerText = cards.length;
        if (dueEl) dueEl.innerText = dueToday;
        
        let totalReps = 0;
        let totalLapses = 0;
        cards.forEach(card => {
            totalReps += card.reps || 0;
            totalLapses += card.lapses || 0;
        });

        if (retentionEl) {
            let retentionStr = "0%";
            if (totalReps > 0) {
                const rate = ((totalReps - totalLapses) / totalReps) * 100;
                retentionStr = Math.round(rate) + "%";
            }
            retentionEl.innerText = retentionStr;
        }

        // --- Gamification Logic ---
        
        // 1. Calculate Levels and XP
        let totalActivityReviews = 0;
        Object.values(activity).forEach(count => {
            totalActivityReviews += count;
        });
        
        const level = Math.floor(totalActivityReviews / 10) + 1;
        const currentLevelProgress = (totalActivityReviews % 10) * 10; // e.g. 0 to 90%
        
        const levelBadge = document.getElementById('user-level-badge');
        const xpBarFill = document.getElementById('xp-bar-fill');
        
        if (levelBadge) {
            levelBadge.innerText = `Lv. ${level}`;
            // Add a title helper based on level
            let levelTitle = "Novice";
            if (level >= 10) levelTitle = "Grandmaster";
            else if (level >= 5) levelTitle = "Expert";
            else if (level >= 3) levelTitle = "Specialist";
            else if (level >= 2) levelTitle = "Apprentice";
            levelBadge.title = `${levelTitle} (${totalActivityReviews} Total Reviews)`;
        }
        if (xpBarFill) {
            xpBarFill.style.width = `${currentLevelProgress}%`;
        }

        // 2. Calculate Daily Goal Progress
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);
        const todayEndTime = todayEnd.getTime();
        
        let completedToday = 0;
        cards.forEach(card => {
            const lastReview = card.historyLog && card.historyLog.length > 0 
                ? card.historyLog[card.historyLog.length - 1] 
                : null;
            const isReviewedToday = lastReview && new Date(lastReview).toDateString() === new Date().toDateString();
            const wasDueTodayOrEarlier = !card.previousDue || card.previousDue <= todayEndTime;
            
            if (isReviewedToday && wasDueTodayOrEarlier) {
                completedToday++;
            }
        });
        
        const gamificationPanel = document.getElementById('gamification-panel');
        if (gamificationPanel) {
            if (cards.length === 0) {
                gamificationPanel.innerHTML = `
                    <div class="achievement-state">
                        <div class="achievement-title" style="color: var(--md-text-low);">
                            <svg class="svg-icon" style="stroke: var(--md-text-low); margin-right: 4px;" viewBox="0 0 24 24"><path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            Welcome to Spaced Repetitions!
                        </div>
                        <div class="achievement-subtitle">Highlight text or open FSRS widget on problems to save your first pattern.</div>
                    </div>
                `;
            } else if (dueToday === 0) {
                gamificationPanel.innerHTML = `
                    <div class="achievement-state">
                        <div class="achievement-title">
                            <svg class="svg-icon" style="stroke: var(--md-success); margin-right: 4px;" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            Inbox Zero Achieved!
                        </div>
                        <div class="achievement-subtitle">All due cards cleared for today. Great job maintaining consistency! <svg class="svg-icon" style="stroke: var(--md-warning); width: 14px; height: 14px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg></div>
                    </div>
                `;
            } else {
                const totalDailyGoal = completedToday + dueToday;
                const progressPercent = totalDailyGoal > 0 ? Math.round((completedToday / totalDailyGoal) * 100) : 100;
                
                let motivationMessage = `<svg class="svg-icon" style="stroke: var(--md-primary); margin-right: 4px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg> Start your daily streak today!`;
                if (completedToday > 0) {
                    motivationMessage = `<svg class="svg-icon" style="stroke: var(--md-success); margin-right: 4px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> Keep going! Only ${dueToday} patterns left to reach Inbox Zero!`;
                }

                gamificationPanel.innerHTML = `
                    <div class="gamification-header">
                        <span class="gamification-title">
                            <svg class="svg-icon" style="stroke: var(--md-warning); margin-right: 4px;" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
                            Daily Review Goal
                        </span>
                        <span class="gamification-progress-text">${completedToday} / ${totalDailyGoal} Reviews</span>
                    </div>
                    <div class="gamification-bar">
                        <div class="gamification-fill" style="width: ${progressPercent}%;"></div>
                    </div>
                    <div class="gamification-msg">${motivationMessage}</div>
                `;
            }
        }
    });
}
