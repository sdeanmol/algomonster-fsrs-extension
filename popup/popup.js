let isLifetimeView = false;

document.addEventListener('DOMContentLoaded', () => {
    // Theme Switcher Initialization
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            chrome.storage.local.get(['theme'], (result) => {
                const currentTheme = result.theme || 'dark';
                const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                chrome.storage.local.set({ theme: newTheme }, () => {
                    showStatus(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode!`);
                });
            });
        });
    }

    loadStats(); 
    loadHeatmap(isLifetimeView);
    checkNotificationPermissions();

    const enableBtn = document.getElementById('enable-notifications-btn');
    if (enableBtn) {
        enableBtn.addEventListener('click', () => {
            if (typeof Notification !== 'undefined') {
                Notification.requestPermission().then((permission) => {
                    checkNotificationPermissions();
                    if (permission === 'granted') {
                        showStatus("Notifications enabled successfully!");
                    } else {
                        showStatus("Notifications were not allowed.", true);
                    }
                });
            }
        });
    }

    const markerToggle = document.getElementById('toggle-marker-popup');
    if (markerToggle) {
        chrome.storage.local.get(['chromeSettings'], (result) => {
            if (result.chromeSettings && result.chromeSettings.showMarkerPopup !== undefined) {
                markerToggle.checked = result.chromeSettings.showMarkerPopup;
            }
        });
        markerToggle.addEventListener('change', (e) => {
            chrome.storage.local.get(['chromeSettings'], (result) => {
                let settings = result.chromeSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                settings.showMarkerPopup = e.target.checked;
                chrome.storage.local.set({ chromeSettings: settings });
            });
        });
    }

    const managePlatformsBtn = document.getElementById('manage-platforms-btn');
    if (managePlatformsBtn) {
        managePlatformsBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('pages/websites/websites.html') });
        });
    }

    const configureFsrsBtn = document.getElementById('configure-fsrs-btn');
    if (configureFsrsBtn) {
        configureFsrsBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('pages/fsrsConfig/fsrsConfig.html') });
        });
    }

    const gamifyDashboardBtn = document.getElementById('gamify-dashboard-btn');
    if (gamifyDashboardBtn) {
        gamifyDashboardBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('pages/gamify/gamify.html') });
        });
    }

    // --- ABSOLUTE PATHS FOR PAGES ---
    document.getElementById('help-btn')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('pages/help/help.html') }));
    document.getElementById('history-btn')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('pages/history/history.html') }));
    document.getElementById('open-heatmap-tab-btn')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('pages/heatmap/heatmap.html') }));
    document.getElementById('box-total')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('pages/data/data.html?view=total') }));
    document.getElementById('box-due')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('pages/data/data.html?view=due') }));
    document.getElementById('box-retention')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('pages/data/data.html?view=retention') }));
    document.getElementById('manage-highlights-btn')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('pages/highlights/highlights.html') }));
    // --- COLOR CUSTOMIZATION ---
    document.getElementById('open-options-btn')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('pages/highlightOptions/highlightOptions.html') }));
    // ---------------------------------------------

    const toggleLifetimeBtn = document.getElementById('toggle-lifetime-btn');
    if (toggleLifetimeBtn) {
        toggleLifetimeBtn.addEventListener('click', () => {
            isLifetimeView = !isLifetimeView;
            toggleLifetimeBtn.innerText = isLifetimeView ? "Show Last 12 Weeks" : "Show Lifetime";
            loadHeatmap(isLifetimeView);
        });
    }

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.onclick = () => {
            chrome.storage.local.get(null, (result) => { 
                const backupData = {
                    cards: result.fsrsCards || [],
                    activity: result.fsrsActivity || {},
                    weights: result.fsrsTopicWeights || {},
                    marks: result.marks || [],
                    bookmarks: result.bookmarks || [],
                    pagecontents: result.pagecontents || [],
                    chromeSettings: result.chromeSettings || {},
                    notificationSettings: result.notificationSettings || {}
                };
                const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                
                chrome.downloads.download({
                    url: url,
                    filename: `algo_pro_backup_${new Date().toISOString().split('T')[0]}.json`,
                    saveAs: true
                });
                showStatus("Backup exported successfully!");
            });
        };
    }

    // --- Notification Settings DOM Handling ---
    const notifToggle = document.getElementById('toggle-notifications');
    const notifInterval = document.getElementById('notification-interval');
    const customIntervalContainer = document.getElementById('custom-interval-container');
    const customIntervalInput = document.getElementById('custom-interval-input');
    const notifStickyToggle = document.getElementById('toggle-sticky-notification');
    const testNotifBtn = document.getElementById('test-notification-btn');

    function updateNotificationUI(settings) {
        if (!notifToggle) return;
        notifToggle.checked = settings.enabled !== false;
        if (notifStickyToggle) {
            notifStickyToggle.checked = settings.requireInteraction !== false;
        }

        const freqStr = settings.frequency || '60';
        const standardOptions = ['1', '15', '30', '60', '120', '360', '720', '1440'];
        if (notifInterval) {
            if (standardOptions.includes(freqStr)) {
                notifInterval.value = freqStr;
                if (customIntervalContainer) customIntervalContainer.classList.add('hide-panel');
            } else {
                notifInterval.value = 'custom';
                if (customIntervalContainer) customIntervalContainer.classList.remove('hide-panel');
                if (customIntervalInput) customIntervalInput.value = freqStr;
            }
        }
    }

    if (notifToggle && notifInterval && customIntervalContainer && customIntervalInput && notifStickyToggle && testNotifBtn) {
        chrome.storage.local.get(['notificationSettings'], (result) => {
            const settings = result.notificationSettings || {
                enabled: true,
                frequency: '60',
                priority: '2',
                requireInteraction: true
            };
            updateNotificationUI(settings);
        });

        notifInterval.addEventListener('change', () => {
            if (notifInterval.value === 'custom') {
                customIntervalContainer.classList.remove('hide-panel');
                if (!customIntervalInput.value) {
                    customIntervalInput.value = '60';
                }
            } else {
                customIntervalContainer.classList.add('hide-panel');
            }
            saveNotificationSettings();
        });

        notifToggle.addEventListener('change', saveNotificationSettings);
        notifStickyToggle.addEventListener('change', saveNotificationSettings);
        customIntervalInput.addEventListener('input', saveNotificationSettings);

        testNotifBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: 'test_notification' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error("Error sending test message:", chrome.runtime.lastError.message);
                    showStatus("Error triggering notification.", true);
                } else if (response && response.success) {
                    showStatus("Test notification sent!");
                } else {
                    showStatus("Failed to send test notification.", true);
                }
            });
        });

        function saveNotificationSettings() {
            chrome.storage.local.get(['notificationSettings'], (result) => {
                const oldSettings = result.notificationSettings || { priority: '2' };
                let frequency = notifInterval.value;
                if (frequency === 'custom') {
                    const customVal = parseInt(customIntervalInput.value, 10);
                    frequency = (!isNaN(customVal) && customVal > 0) ? String(customVal) : '60';
                }

                const updatedSettings = {
                    enabled: notifToggle.checked,
                    frequency: frequency,
                    priority: oldSettings.priority || '2',
                    requireInteraction: notifStickyToggle.checked
                };

                chrome.storage.local.set({ notificationSettings: updatedSettings });
            });
        }
    }

    document.getElementById('import-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const imported = JSON.parse(event.target.result);
                
                const storageUpdate = {
                    fsrsCards: Array.isArray(imported) ? imported : (imported.cards || []),
                    fsrsActivity: Array.isArray(imported) ? {} : (imported.activity || {}),
                    fsrsTopicWeights: Array.isArray(imported) ? {} : (imported.weights || {})
                };

                if (imported.marks) storageUpdate.marks = imported.marks;
                if (imported.bookmarks) storageUpdate.bookmarks = imported.bookmarks;
                if (imported.pagecontents) storageUpdate.pagecontents = imported.pagecontents;
                if (imported.chromeSettings) storageUpdate.chromeSettings = imported.chromeSettings;
                if (imported.notificationSettings) storageUpdate.notificationSettings = imported.notificationSettings;

                chrome.storage.local.set(storageUpdate, () => {
                    showStatus("Data imported successfully!");
                    loadStats(); 
                    loadHeatmap(isLifetimeView);
                    
                    if (storageUpdate.chromeSettings && storageUpdate.chromeSettings.showMarkerPopup !== undefined && markerToggle) {
                        markerToggle.checked = storageUpdate.chromeSettings.showMarkerPopup;
                    }
                    if (storageUpdate.notificationSettings) {
                        updateNotificationUI(storageUpdate.notificationSettings);
                    }
                });
            } catch (err) {
                showStatus("Error reading file.", true);
            }
        };
        reader.readAsText(file);
    });

    // Initialize rating prompt card
    initRatingPrompt();
});

// --- Helper Functions ---

// Removed loadSavedWeights - managed on dedicated config page

function loadRPGCharacterStats() {
    chrome.storage.local.get(['fsrsGamification'], (result) => {
        const gamify = result.fsrsGamification;
        if (!gamify || !gamify.character) return;

        const level = gamify.character.level || 1;
        const gold = gamify.character.gold || 0;
        const hp = gamify.character.hp !== undefined ? gamify.character.hp : 50;
        const maxHp = gamify.character.maxHp || 50;
        const xp = gamify.character.xp || 0;
        const maxXp = level * 100;

        const name = gamify.character.name || "Coding Hero";

        document.getElementById('rpg-player-name').textContent = name;
        document.getElementById('rpg-player-level').textContent = level;
        document.getElementById('rpg-gold-val').textContent = gold;
        document.getElementById('rpg-hp-text').textContent = `${hp} / ${maxHp}`;
        document.getElementById('rpg-hp-fill').style.width = `${(hp / maxHp) * 100}%`;
        document.getElementById('rpg-xp-text').textContent = `${xp} / ${maxXp}`;
        document.getElementById('rpg-xp-fill').style.width = `${(xp / maxXp) * 100}%`;

        const classBadge = document.getElementById('rpg-player-class');
        if (classBadge) {
            if (gamify.character.class) {
                classBadge.textContent = gamify.character.class;
                classBadge.style.display = 'inline-block';
            } else {
                classBadge.style.display = 'none';
            }
        }

        const compDisplay = document.getElementById('rpg-companion-display');
        const compIcon = document.getElementById('rpg-companion-icon-span');
        const compName = document.getElementById('rpg-companion-name-span');

        if (compDisplay && compIcon && compName) {
            if (gamify.activeCompanion) {
                const companionMap = {
                    "Linear Dragon": { icon: "🐉", name: "Linear Dragon" },
                    "Recursive Phoenix": { icon: "🐦", name: "Recursive Phoenix" },
                    "Tree Ent": { icon: "🌲", name: "Tree Ent" },
                    "Graph Griffin": { icon: "🦅", name: "Graph Griffin" }
                };
                const c = companionMap[gamify.activeCompanion];
                if (c) {
                    compIcon.textContent = c.icon;
                    compName.textContent = c.name;
                    compDisplay.style.display = 'flex';
                } else {
                    compDisplay.style.display = 'none';
                }
            } else {
                compDisplay.style.display = 'none';
            }
        }
    });
}

function loadStats() {
    loadRPGCharacterStats();
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

let statusTimeout = null;
function showStatus(msg, isError = false) {
    const el = document.getElementById('status-msg');
    if (!el) return;
    
    if (statusTimeout) {
        clearTimeout(statusTimeout);
    }
    
    const iconHtml = isError
        ? `<svg class="svg-icon" style="stroke: var(--md-danger); width: 14px; height: 14px;" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
        : `<svg class="svg-icon" style="stroke: var(--md-success); width: 14px; height: 14px;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    
    el.innerHTML = iconHtml + `<span>${msg}</span>`;
    el.className = 'toast show ' + (isError ? 'error' : 'success'); // styled to match base toast
    
    statusTimeout = setTimeout(() => {
        el.classList.remove('show');
    }, 2500);
}

function checkNotificationPermissions() {
    if (typeof Notification !== 'undefined') {
        const warningBanner = document.getElementById('permission-warning-banner');
        const enableBtn = document.getElementById('enable-notifications-btn');
        if (!warningBanner) return;

        if (Notification.permission !== 'granted') {
            warningBanner.classList.remove('hide-panel');
            if (Notification.permission === 'denied') {
                if (enableBtn) enableBtn.style.display = 'none';
                const spanEl = warningBanner.querySelector('span');
                if (spanEl) spanEl.innerText = "⚠️ Notifications blocked. Enable them in settings for reminders.";
            } else {
                if (enableBtn) enableBtn.style.display = 'inline-block';
                const spanEl = warningBanner.querySelector('span');
                if (spanEl) spanEl.innerText = "⚠️ Reminders work best with notifications enabled.";
            }
        } else {
            warningBanner.classList.add('hide-panel');
        }
    }
}

function initRatingPrompt() {
    const card = document.getElementById('rating-prompt-card');
    const promptState = document.getElementById('rating-prompt-state');
    const thanksState = document.getElementById('rating-thanks-state');
    const rateBtn = document.getElementById('rate-store-btn');
    const snoozeBtn = document.getElementById('snooze-rate-btn');
    const alreadyBtn = document.getElementById('already-rated-btn');
    const editBtn = document.getElementById('edit-rating-btn');

    if (!card) return;

    // Fetch unique extension ID to replace YOUR_EXTENSION_ID in review links
    const extId = chrome.runtime.id;
    if (extId) {
        const links = [rateBtn];
        links.forEach(link => {
            if (link && link.href) {
                link.href = link.href.replace('YOUR_EXTENSION_ID', extId);
            }
        });
    }

    chrome.storage.local.get(['ratingPromptState', 'fsrsCards'], (result) => {
        const rating = result.ratingPromptState || { status: 'unrated', snoozedUntil: 0 };
        const cardsCount = (result.fsrsCards || []).length;

        // Check snooze expiration
        const now = Date.now();
        if (rating.status === 'snoozed' && now >= rating.snoozedUntil) {
            rating.status = 'unrated';
            chrome.storage.local.set({ ratingPromptState: rating });
        }

        // Show/hide based on status and engagement (at least 1 card in system)
        if (rating.status === 'unrated') {
            if (cardsCount >= 1) {
                card.classList.remove('hide-panel');
                promptState.classList.remove('hide-panel');
                thanksState.classList.add('hide-panel');
            } else {
                card.classList.add('hide-panel');
            }
        } else if (rating.status === 'rated') {
            card.classList.remove('hide-panel');
            promptState.classList.add('hide-panel');
            thanksState.classList.remove('hide-panel');
        } else {
            card.classList.add('hide-panel');
        }
    });

    snoozeBtn.addEventListener('click', () => {
        const snoozedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000; // Snooze for 7 days
        chrome.storage.local.set({
            ratingPromptState: { status: 'snoozed', snoozedUntil }
        }, () => {
            card.classList.add('hide-panel');
            showStatus("Notification paused for 7 days!");
        });
    });

    alreadyBtn.addEventListener('click', () => {
        chrome.storage.local.set({
            ratingPromptState: { status: 'rated', snoozedUntil: 0 }
        }, () => {
            promptState.classList.add('hide-panel');
            thanksState.classList.remove('hide-panel');
            showStatus("Thank you for your rating!");
        });
    });

    editBtn.addEventListener('click', () => {
        const url = `https://chromewebstore.google.com/detail/${extId}/reviews`;
        chrome.tabs.create({ url });
        
        chrome.storage.local.set({
            ratingPromptState: { status: 'unrated', snoozedUntil: 0 }
        }, () => {
            promptState.classList.remove('hide-panel');
            thanksState.classList.add('hide-panel');
        });
    });
}