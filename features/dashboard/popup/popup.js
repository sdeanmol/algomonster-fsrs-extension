// features/dashboard/popup/popup.js - Central options dashboard manager

let isLifetimeView = false;
let statusTimeout = null;

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
    initNotificationSettings();

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
            chrome.tabs.create({ url: chrome.runtime.getURL('features/common/websites/websites.html') });
        });
    }

    const configureFsrsBtn = document.getElementById('configure-fsrs-btn');
    if (configureFsrsBtn) {
        configureFsrsBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('features/tracker/config/fsrsConfig.html') });
        });
    }

    // --- ABSOLUTE PATHS FOR PAGES ---
    document.getElementById('help-btn')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/common/help/help.html') }));
    document.getElementById('history-btn')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/history/history.html') }));
    document.getElementById('open-heatmap-tab-btn')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/heatmap/heatmap.html') }));
    document.getElementById('box-total')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/common/data/data.html?view=total') }));
    document.getElementById('box-due')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/common/data/data.html?view=due') }));
    document.getElementById('box-retention')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/common/data/data.html?view=retention') }));
    document.getElementById('manage-highlights-btn')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/highlighter/manager/highlights.html') }));
    document.getElementById('open-options-btn')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/highlighter/options/highlightOptions.html') }));

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
                    
                    const markerToggle = document.getElementById('toggle-marker-popup');
                    if (storageUpdate.chromeSettings && storageUpdate.chromeSettings.showMarkerPopup !== undefined && markerToggle) {
                        markerToggle.checked = storageUpdate.chromeSettings.showMarkerPopup;
                    }
                    
                    // We must dynamically query notifications module update logic if present
                    if (storageUpdate.notificationSettings && typeof initNotificationSettings === 'function') {
                        initNotificationSettings();
                    }
                });
            } catch (err) {
                showStatus("Error reading file.", true);
            }
        };
        reader.readAsText(file);
    });

    initRatingPrompt();
});

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