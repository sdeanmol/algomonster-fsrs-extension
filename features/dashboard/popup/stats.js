// features/dashboard/popup/stats.js - Statistics, daily goals (R3.1), and streak tracking (R3.2)

function loadStats() {
    chrome.storage.local.get(['fsrsCards', 'fsrsActivity', 'dailyGoalTarget', 'longestStreak'], (result) => {
        const cards = result.fsrsCards || [];
        const activity = result.fsrsActivity || {};
        const dailyGoalTarget = result.dailyGoalTarget || 10;
        const storedLongestStreak = result.longestStreak || 0;
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
        const currentLevelProgress = (totalActivityReviews % 10) * 10;
        
        const levelBadge = document.getElementById('user-level-badge');
        const xpBarFill = document.getElementById('xp-bar-fill');
        
        if (levelBadge) {
            levelBadge.innerText = `Lv. ${level}`;
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

        // 2. R3.2 — Streak Calculation
        const streakData = calculateStreaks(activity);
        const longestStreak = Math.max(streakData.longest, storedLongestStreak);
        // Persist longest streak
        if (longestStreak > storedLongestStreak) {
            chrome.storage.local.set({ longestStreak });
        }

        // 3. R3.1 — Daily Goal Progress (with configurable target)
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
        
        // 4. Render Gamification Panel
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
            } else if (dueToday === 0 && completedToday >= dailyGoalTarget) {
                gamificationPanel.innerHTML = renderGoalComplete(completedToday, dailyGoalTarget, streakData.current, longestStreak);
            } else {
                gamificationPanel.innerHTML = renderGoalProgress(completedToday, dailyGoalTarget, dueToday, streakData.current, longestStreak);
            }

            // Wire goal editor toggle
            const goalEditBtn = gamificationPanel.querySelector('#goal-edit-btn');
            const goalEditor = gamificationPanel.querySelector('#goal-editor');
            const goalInput = gamificationPanel.querySelector('#goal-input');
            const goalSaveBtn = gamificationPanel.querySelector('#goal-save-btn');

            if (goalEditBtn && goalEditor && goalInput) {
                goalEditBtn.addEventListener('click', () => {
                    goalEditor.style.display = goalEditor.style.display === 'none' ? 'flex' : 'none';
                    if (goalEditor.style.display === 'flex') goalInput.focus();
                });

                const saveGoal = () => {
                    const val = parseInt(goalInput.value);
                    if (val && val > 0 && val <= 999) {
                        chrome.storage.local.set({ dailyGoalTarget: val }, () => {
                            goalEditor.style.display = 'none';
                            loadStats(); // Refresh
                        });
                    }
                };

                if (goalSaveBtn) goalSaveBtn.addEventListener('click', saveGoal);
                goalInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') saveGoal();
                });
            }
        }
    });
}

// R3.2: Calculate current and longest streaks from activity data
function calculateStreaks(activity) {
    const sortedDates = Object.keys(activity).filter(k => activity[k] > 0).sort();
    if (sortedDates.length === 0) return { current: 0, longest: 0 };

    // Current streak: count backwards from today
    let currentStreak = 0;
    const today = new Date();
    const checkDate = new Date(today);
    
    for (let i = 0; i < 365; i++) {
        const dateStr = formatDateKey(checkDate);
        if (activity[dateStr] && activity[dateStr] > 0) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            // If today has no activity yet, check if yesterday was active (streak continues until you miss a day)
            if (i === 0) {
                checkDate.setDate(checkDate.getDate() - 1);
                continue;
            }
            break;
        }
    }

    // Longest streak: iterate chronologically
    let longestStreak = 0;
    let tempStreak = 0;
    let prevDate = null;

    for (const dateStr of sortedDates) {
        const parts = dateStr.split('-');
        const d = new Date(parts[0], parts[1] - 1, parts[2]);

        if (prevDate) {
            const diffDays = Math.round((d - prevDate) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                tempStreak++;
            } else {
                tempStreak = 1;
            }
        } else {
            tempStreak = 1;
        }

        if (tempStreak > longestStreak) longestStreak = tempStreak;
        prevDate = d;
    }

    return { current: currentStreak, longest: longestStreak };
}

function formatDateKey(date) {
    return new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
}

// R3.1: SVG Progress Ring + Goal Editor
function renderGoalProgress(completed, target, dueRemaining, currentStreak, longestStreak) {
    const pct = Math.min(Math.round((completed / target) * 100), 100);
    const circumference = 2 * Math.PI * 42; // r=42
    const offset = circumference - (pct / 100) * circumference;

    const streakHtml = renderStreakBadge(currentStreak, longestStreak);

    let motivationMsg = `<svg class="svg-icon" style="stroke: var(--md-primary); margin-right: 4px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg> Start your daily streak today!`;
    if (completed > 0 && completed < target) {
        motivationMsg = `<svg class="svg-icon" style="stroke: var(--md-success); margin-right: 4px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg> Keep going! ${target - completed} more to hit your goal!`;
    } else if (completed >= target) {
        motivationMsg = `<svg class="svg-icon" style="stroke: var(--md-success); margin-right: 4px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg> Daily goal reached! ${dueRemaining > 0 ? `${dueRemaining} more patterns due.` : 'All caught up!'}`;
    }

    return `
        <div class="goal-ring-container">
            <div class="goal-ring-wrap">
                <svg class="goal-ring-svg" viewBox="0 0 100 100">
                    <circle class="goal-ring-bg" cx="50" cy="50" r="42" />
                    <circle class="goal-ring-fill" cx="50" cy="50" r="42"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="${offset}" />
                </svg>
                <div class="goal-ring-text">
                    <span class="goal-ring-count">${completed}</span>
                    <span class="goal-ring-label">of ${target}</span>
                </div>
            </div>
            <div class="goal-info">
                <div class="gamification-header">
                    <span class="gamification-title">
                        <svg class="svg-icon" style="stroke: var(--md-warning); margin-right: 3px;" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
                        Daily Goal
                    </span>
                    <button id="goal-edit-btn" class="goal-edit-btn" title="Change daily goal">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:11px; height:11px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </button>
                </div>
                <div id="goal-editor" class="goal-editor" style="display: none;">
                    <input type="number" id="goal-input" class="goal-input" value="${target}" min="1" max="999" />
                    <button id="goal-save-btn" class="goal-save-btn">Set</button>
                </div>
                ${streakHtml}
                <div class="gamification-msg">${motivationMsg}</div>
            </div>
        </div>
    `;
}

function renderGoalComplete(completed, target, currentStreak, longestStreak) {
    const circumference = 2 * Math.PI * 42;
    const streakHtml = renderStreakBadge(currentStreak, longestStreak);

    return `
        <div class="goal-ring-container">
            <div class="goal-ring-wrap goal-ring-complete">
                <svg class="goal-ring-svg" viewBox="0 0 100 100">
                    <circle class="goal-ring-bg" cx="50" cy="50" r="42" />
                    <circle class="goal-ring-fill goal-ring-fill-complete" cx="50" cy="50" r="42"
                        stroke-dasharray="${circumference}"
                        stroke-dashoffset="0" />
                </svg>
                <div class="goal-ring-text">
                    <svg class="svg-icon" viewBox="0 0 24 24" style="width: 22px; height: 22px; stroke: var(--md-success);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                </div>
            </div>
            <div class="goal-info">
                <div class="gamification-header">
                    <span class="gamification-title" style="color: var(--md-success);">
                        <svg class="svg-icon" style="stroke: var(--md-success); margin-right: 3px;" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        Goal Complete!
                    </span>
                    <button id="goal-edit-btn" class="goal-edit-btn" title="Change daily goal">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:11px; height:11px;"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                    </button>
                </div>
                <div id="goal-editor" class="goal-editor" style="display: none;">
                    <input type="number" id="goal-input" class="goal-input" value="${target}" min="1" max="999" />
                    <button id="goal-save-btn" class="goal-save-btn">Set</button>
                </div>
                ${streakHtml}
                <div class="gamification-msg">
                    <svg class="svg-icon" style="stroke: var(--md-success); margin-right: 4px; display: inline-block; vertical-align: middle;" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    All ${completed} reviews done! Inbox Zero achieved!
                </div>
            </div>
        </div>
    `;
}

// R3.2: Streak badge renderer
function renderStreakBadge(current, longest) {
    if (current === 0 && longest === 0) return '';
    
    const fireColor = current > 0 ? 'var(--md-warning)' : 'var(--md-text-low)';
    const streakText = current > 0 ? `${current}-day streak` : 'No active streak';
    const bestText = longest > 0 ? `Best: ${longest}` : '';

    return `
        <div class="streak-badge">
            <svg class="svg-icon streak-fire" style="stroke: ${fireColor}; fill: ${current > 0 ? 'rgba(249,171,0,0.2)' : 'none'};" viewBox="0 0 24 24">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
            </svg>
            <span class="streak-text">${streakText}</span>
            ${bestText ? `<span class="streak-best">${bestText}</span>` : ''}
        </div>
    `;
}
