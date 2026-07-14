/**
 * @file features/dashboard/popup/popup.js
 * @description Central coordinator for the AlgoRecall popup options dashboard page.
 * Manages configuration updates (theme, highlighting visibility), page data backup (import/export),
 * Anki deck exchange utilities, and in-popup quick search pattern filters.
 * Upstream dependencies: features/dashboard/popup/stats.js (invokes loadStats), features/dashboard/popup/heatmap.js (invokes loadHeatmap), features/dashboard/popup/notifications.js (invokes initNotificationSettings, checkNotificationPermissions).
 * Downstream dependencies: chrome.storage, chrome.downloads (sends download jobs).
 */

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
    initQuickSearch();

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

    const chartsToggle = document.getElementById('toggle-show-charts');
    if (chartsToggle) {
        chrome.storage.local.get(['chromeSettings'], (result) => {
            const showCharts = result.chromeSettings && result.chromeSettings.showCharts !== undefined
                ? result.chromeSettings.showCharts
                : true;
            chartsToggle.checked = showCharts;
        });
        chartsToggle.addEventListener('change', (e) => {
            chrome.storage.local.get(['chromeSettings'], (result) => {
                let settings = result.chromeSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                settings.showCharts = e.target.checked;
                chrome.storage.local.set({ chromeSettings: settings }, () => {
                    showStatus(`Visual charts ${e.target.checked ? 'enabled' : 'disabled'}!`);
                });
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
    document.getElementById('forecast-btn')?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/forecast/forecast.html') }));

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
                    const chartsToggle = document.getElementById('toggle-show-charts');
                    if (storageUpdate.chromeSettings && storageUpdate.chromeSettings.showCharts !== undefined && chartsToggle) {
                        chartsToggle.checked = storageUpdate.chromeSettings.showCharts;
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

    // R9.1: Anki Export
    document.getElementById('anki-export-btn')?.addEventListener('click', () => {
        chrome.storage.local.get(['fsrsCards'], (result) => {
            const cards = result.fsrsCards || [];
            if (cards.length === 0) {
                showStatus('No cards to export.', true);
                return;
            }
            const ankiText = exportToAnkiText(cards);
            const blob = new Blob([ankiText], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            chrome.downloads.download({
                url: url,
                filename: `algorecall_anki_${new Date().toISOString().split('T')[0]}.txt`,
                saveAs: true
            });
            showStatus(`Exported ${cards.length} cards for Anki!`);
        });
    });

    // R9.1: Anki Import
    document.getElementById('anki-import-file')?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const text = event.target.result;
                const newCards = importFromAnkiText(text);

                if (newCards.length === 0) {
                    showStatus('No valid cards found in file.', true);
                    return;
                }

                chrome.storage.local.get(['fsrsCards'], (result) => {
                    const existing = result.fsrsCards || [];
                    const existingTitles = new Set(existing.map(c => c.problemTitle?.toLowerCase()));

                    // Skip duplicates by title
                    const unique = newCards.filter(c => !existingTitles.has(c.problemTitle?.toLowerCase()));
                    const merged = [...existing, ...unique];

                    chrome.storage.local.set({ fsrsCards: merged }, () => {
                        showStatus(`Imported ${unique.length} cards from Anki! (${newCards.length - unique.length} duplicates skipped)`);
                        loadStats();
                    });
                });
            } catch (err) {
                showStatus('Error reading Anki file.', true);
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset file input
    });

    initRatingPrompt();
});

/**
 * Triggers a status message toast at the top of the popup dashboard.
 * @param {string} msg - Descriptive message string.
 * @param {boolean} [isError=false] - Signals if the status indicates an error.
 */
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

// ========== R2.6: Quick Search & Filter ==========
let _quickSearchCards = [];
let _quickSearchDebounce = null;

/**
 * Initializes quick search input and tag selectors from the dashboard.
 */
function initQuickSearch() {
    const searchInput = document.getElementById('popup-search-input');
    const tagFilter = document.getElementById('popup-tag-filter');
    const resultsContainer = document.getElementById('popup-search-results');

    if (!searchInput || !tagFilter || !resultsContainer) return;

    // Load cards and populate tag filter
    chrome.storage.local.get(['fsrsCards'], (result) => {
        _quickSearchCards = result.fsrsCards || [];

        // Populate tag dropdown
        const tagsSet = new Set();
        _quickSearchCards.forEach(card => {
            if (card.tags && Array.isArray(card.tags)) {
                card.tags.forEach(t => tagsSet.add(t));
            }
        });
        [...tagsSet].sort().forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagFilter.appendChild(option);
        });
    });

    // Search on input
    searchInput.addEventListener('input', () => {
        clearTimeout(_quickSearchDebounce);
        _quickSearchDebounce = setTimeout(() => renderQuickSearch(), 150);
    });

    // Filter on tag change
    tagFilter.addEventListener('change', () => renderQuickSearch());
}

/**
 * Renders filtered card quick search items matching text query and topic tag fields.
 */
function renderQuickSearch() {
    const searchInput = document.getElementById('popup-search-input');
    const tagFilter = document.getElementById('popup-tag-filter');
    const resultsContainer = document.getElementById('popup-search-results');

    if (!searchInput || !resultsContainer) return;

    const query = searchInput.value.trim().toLowerCase();
    const selectedTag = tagFilter ? tagFilter.value : 'all';

    // Hide results if no query and no tag filter
    if (!query && selectedTag === 'all') {
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        return;
    }

    const now = Date.now();
    let filtered = _quickSearchCards.filter(card => {
        // Tag filter
        if (selectedTag !== 'all' && !(card.tags && card.tags.includes(selectedTag))) return false;

        // Search query
        if (query) {
            const titleMatch = card.problemTitle && card.problemTitle.toLowerCase().includes(query);
            const urlMatch = card.problemUrl && card.problemUrl.toLowerCase().includes(query);
            const tagMatch = card.tags && card.tags.some(t => t.toLowerCase().includes(query));
            if (!titleMatch && !urlMatch && !tagMatch) return false;
        }

        return true;
    });

    const totalMatches = filtered.length;
    const maxDisplay = 5;
    const displayCards = filtered.slice(0, maxDisplay);

    if (displayCards.length === 0) {
        resultsContainer.style.display = 'block';
        resultsContainer.innerHTML = `<div class="popup-search-empty">No matching patterns found.</div>`;
        return;
    }

    let html = displayCards.map(card => {
        const isDue = card.due <= now;
        const statusBadge = isDue
            ? '<span class="popup-badge popup-badge-due">Due</span>'
            : '<span class="popup-badge popup-badge-safe">Safe</span>';
        const tagsHtml = (card.tags || []).slice(0, 3).map(t => `<span class="popup-tag">${t}</span>`).join('');
        const title = card.problemTitle || 'Untitled';

        return `<a href="${card.problemUrl}" target="_blank" class="popup-search-item" title="${title}">
            <div class="popup-search-item-top">
                <span class="popup-search-title">${title}</span>
                ${statusBadge}
            </div>
            <div class="popup-search-item-tags">${tagsHtml}</div>
        </a>`;
    }).join('');

    if (totalMatches > maxDisplay) {
        const dataUrl = chrome.runtime.getURL(`features/common/data/data.html?view=total`);
        html += `<a href="${dataUrl}" target="_blank" class="popup-search-view-all">View all ${totalMatches} results →</a>`;
    }

    resultsContainer.style.display = 'block';
    resultsContainer.innerHTML = html;
}

// ========== R9.1: Anki Export/Import Utilities ==========

/**
 * Export FSRS cards to Anki-compatible tab-separated text.
 * Format: Front<TAB>Back<TAB>Tags
 * Includes Anki header directives for auto-configuration on import.
 * @param {Object[]} cards - Array of FSRS cards.
 * @returns {string} Anki-compatible text data.
 */
function exportToAnkiText(cards) {
    const lines = [];
    
    // Anki header directives
    lines.push('#separator:tab');
    lines.push('#html:false');
    lines.push('#tags column:3');
    lines.push('#deck:AlgoRecall');
    lines.push('#notetype:Basic');
    lines.push('');

    cards.forEach(card => {
        const front = (card.problemTitle || 'Untitled').replace(/\t/g, ' ').replace(/\n/g, ' ');
        const back = (card.approach || '').replace(/\t/g, '    '); // Keep newlines for Anki markdown
        const tags = (card.tags || []).map(t => `algorecall::${t.replace(/\s+/g, '_')}`).join(' ');
        
        // Add URL as part of front if available
        const frontWithUrl = card.problemUrl 
            ? `${front}\n[URL: ${card.problemUrl}]`
            : front;

        lines.push(`${frontWithUrl}\t${back}\t${tags}`);
    });

    return lines.join('\n');
}

/**
 * Import Anki tab-separated text into FSRS card objects.
 * Expects: Front<TAB>Back<TAB>Tags (optional)
 * @param {string} text - The raw Anki-formatted text content.
 * @returns {Object[]} Created stub FSRS card objects.
 */
function importFromAnkiText(text) {
    const lines = text.split('\n');
    const cards = [];
    const now = Date.now();

    for (const line of lines) {
        // Skip Anki header directives and empty lines
        if (!line.trim() || line.startsWith('#')) continue;

        const parts = line.split('\t');
        if (parts.length < 2) continue;

        let front = parts[0].trim();
        const back = parts[1].trim();
        const tagsStr = parts[2] ? parts[2].trim() : '';

        if (!front) continue;

        // Extract URL from front if present (format: [URL: ...])
        let problemUrl = '';
        const urlMatch = front.match(/\[URL:\s*(.*?)\]/);
        if (urlMatch) {
            problemUrl = urlMatch[1].trim();
            front = front.replace(/\n?\[URL:.*?\]/, '').trim();
        }

        // Parse tags: remove algorecall:: prefix, convert underscores back to spaces
        const tags = tagsStr
            ? tagsStr.split(/\s+/)
                .map(t => t.replace(/^algorecall::/, '').replace(/_/g, ' '))
                .filter(t => t)
            : [];

        // Create stub FSRS card
        const card = {
            id: `imported_${now}_${Math.random().toString(36).substr(2, 8)}`,
            problemTitle: front,
            problemUrl: problemUrl || `#imported-${encodeURIComponent(front.substring(0, 50))}`,
            approach: back,
            tags: tags,
            due: now, // Due immediately for first review
            stability: 0,
            difficulty: 0,
            elapsedDays: 0,
            scheduledDays: 0,
            reps: 0,
            lapses: 0,
            state: 0, // New
            lastReview: null,
            lastRating: null,
            historyLog: [],
            previousDue: null
        };

        cards.push(card);
    }

    return cards;
}