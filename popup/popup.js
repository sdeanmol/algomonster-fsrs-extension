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

    const settingsPanel = document.getElementById('settings-panel');
    const toggleSettingsBtn = document.getElementById('toggle-settings-btn');
    
    if (toggleSettingsBtn && settingsPanel) {
        toggleSettingsBtn.addEventListener('click', () => {
            const isHidden = settingsPanel.classList.toggle('hide-panel');
            if (!isHidden) loadSavedWeights();
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

    const saveWeightsBtn = document.getElementById('save-weights-btn');
    if (saveWeightsBtn) {
        saveWeightsBtn.addEventListener('click', () => {
            const tag = document.getElementById('weight-tag').value.trim();
            const valuesStr = document.getElementById('weight-values').value.trim();
            
            if (!tag || !valuesStr) return showStatus("Tag and weights are required.", true);

            const weightsArray = valuesStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
            if (weightsArray.length !== 17) return showStatus(`Invalid array: Found ${weightsArray.length} values. Expected 17.`, true);

            chrome.storage.local.get(['fsrsTopicWeights'], (result) => {
                const topicWeights = result.fsrsTopicWeights || {};
                topicWeights[tag] = weightsArray;
                chrome.storage.local.set({ fsrsTopicWeights: topicWeights }, () => {
                    showStatus(`Weights saved for tag: ${tag}`);
                    document.getElementById('weight-tag').value = '';
                    document.getElementById('weight-values').value = '';
                    loadSavedWeights();
                });
            });
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
                    if (settingsPanel && !settingsPanel.classList.contains('hide-panel')) loadSavedWeights();
                });
            } catch (err) {
                showStatus("Error reading file.", true);
            }
        };
        reader.readAsText(file);
    });
});

// --- Helper Functions ---

function loadSavedWeights() {
    chrome.storage.local.get(['fsrsTopicWeights'], (result) => {
        const topicWeights = result.fsrsTopicWeights || {};
        const listEl = document.getElementById('active-weights-list');
        if (!listEl) return;
        
        listEl.innerHTML = '';
        
        if (Object.keys(topicWeights).length === 0) {
            listEl.innerHTML = '<li>No custom profiles saved. Using standard defaults.</li>';
            return;
        }

        for (const [tag, weights] of Object.entries(topicWeights)) {
            const li = document.createElement('li');
            li.style.marginBottom = "4px";
            li.innerHTML = `<strong>${tag}</strong> <button data-tag="${tag}" class="delete-weight-btn" style="background:none; border:none; color:var(--md-danger); cursor:pointer; font-size:11px; display:inline-flex; align-items:center; margin-left:8px; padding:2px;" title="Delete Profile"><svg class="svg-icon" style="width:13px; height:13px;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></button>`;
            listEl.appendChild(li);
        }

        document.querySelectorAll('.delete-weight-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetTag = e.target.getAttribute('data-tag');
                delete topicWeights[targetTag];
                chrome.storage.local.set({ fsrsTopicWeights: topicWeights }, loadSavedWeights);
            });
        });
    });
}

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