import { StatsComponent } from './stats.js';
import { HeatmapComponent } from './heatmap.js';
import { NotificationsComponent } from './notifications.js';
import { RatingComponent } from './rating.js';
import { QuickSearchComponent } from './search.js';
import { BackupManager } from '../../common/data/backupManager.js';

/**
 * @class AlgoRecallDashboard
 * @description Central coordinator for the AlgoRecall popup options dashboard page.
 * Manages configuration updates (theme, highlighting visibility), page data backup (import/export),
 * Anki deck exchange utilities, and instantiates visual dashboard components.
 */
export class AlgoRecallDashboard {
    constructor() {
        this.statusTimeout = null;

        // Cache global/page-level elements
        this.dom = {
            themeToggleBtn: document.getElementById('theme-toggle-btn'),
            markerToggle: document.getElementById('toggle-marker-popup'),
            chartsToggle: document.getElementById('toggle-show-charts'),
            managePlatformsBtn: document.getElementById('manage-platforms-btn'),
            configureFsrsBtn: document.getElementById('configure-fsrs-btn'),
            helpBtn: document.getElementById('help-btn'),
            historyBtn: document.getElementById('history-btn'),
            openHeatmapTabBtn: document.getElementById('open-heatmap-tab-btn'),
            boxTotal: document.getElementById('box-total'),
            boxDue: document.getElementById('box-due'),
            boxRetention: document.getElementById('box-retention'),
            manageHighlightsBtn: document.getElementById('manage-highlights-btn'),
            openOptionsBtn: document.getElementById('open-options-btn'),
            forecastBtn: document.getElementById('forecast-btn'),
            exportBtn: document.getElementById('export-btn'),
            importFile: document.getElementById('import-file'),
            ankiExportBtn: document.getElementById('anki-export-btn'),
            ankiImportFile: document.getElementById('anki-import-file'),
            statusMsg: document.getElementById('status-msg'),
        };

        // Subclass Components instantiation
        this.stats = new StatsComponent(this);
        this.heatmap = new HeatmapComponent(this);
        this.notifications = new NotificationsComponent(this);
        this.rating = new RatingComponent(this);
        this.search = new QuickSearchComponent(this);
    }

    /**
     * Initializes the dashboard, binds page event listeners, and boots sub-components.
     */
    async init() {
        this.bindEvents();

        // Boot component lifecycle steps
        this.stats.init();
        this.heatmap.init();
        this.notifications.init();
        this.rating.init();
        this.search.init();

        // Perform initial loading from storage databases
        await this.loadAll();
    }

    /**
     * Triggers asynchronous state loads across all child panel classes.
     */
    async loadAll() {
        await Promise.all([
            this.stats.load(),
            this.heatmap.load(),
            this.notifications.checkPermissions(),
            this.notifications.loadSettings(),
            this.rating.load(),
            this.search.load()
        ]);
    }

    /**
     * Binds click and state change event listeners for settings panels, exports, and page routers.
     */
    bindEvents() {
        // Theme Switcher Initialization
        if (this.dom.themeToggleBtn) {
            this.dom.themeToggleBtn.addEventListener('click', async () => {
                try {
                    const result = await chrome.storage.local.get(['theme']);
                    const currentTheme = result.theme || 'dark';
                    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                    await chrome.storage.local.set({ theme: newTheme });
                    this.showStatus(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode!`);
                } catch (error) {
                    console.error("Error toggling theme settings:", error);
                }
            });
        }

        // Floating Highlighter switch setup
        if (this.dom.markerToggle) {
            chrome.storage.local.get(['chromeSettings'], (result) => {
                if (result.chromeSettings && result.chromeSettings.showMarkerPopup !== undefined) {
                    this.dom.markerToggle.checked = result.chromeSettings.showMarkerPopup;
                }
            });
            this.dom.markerToggle.addEventListener('change', async (e) => {
                try {
                    const result = await chrome.storage.local.get(['chromeSettings']);
                    let settings = result.chromeSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                    settings.showMarkerPopup = e.target.checked;
                    await chrome.storage.local.set({ chromeSettings: settings });
                } catch (error) {
                    console.error("Error setting showMarkerPopup config:", error);
                }
            });
        }

        // Visual charts display switch setup
        if (this.dom.chartsToggle) {
            chrome.storage.local.get(['chromeSettings'], (result) => {
                const showCharts = result.chromeSettings && result.chromeSettings.showCharts !== undefined
                    ? result.chromeSettings.showCharts
                    : true;
                this.dom.chartsToggle.checked = showCharts;
            });
            this.dom.chartsToggle.addEventListener('change', async (e) => {
                try {
                    const result = await chrome.storage.local.get(['chromeSettings']);
                    let settings = result.chromeSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                    settings.showCharts = e.target.checked;
                    await chrome.storage.local.set({ chromeSettings: settings });
                    this.showStatus(`Visual charts ${e.target.checked ? 'enabled' : 'disabled'}!`);
                } catch (error) {
                    console.error("Error setting showCharts config:", error);
                }
            });
        }

        // Webpage page redirection setups
        if (this.dom.managePlatformsBtn) {
            this.dom.managePlatformsBtn.addEventListener('click', () => {
                chrome.tabs.create({ url: chrome.runtime.getURL('features/common/websites/websites.html') });
            });
        }

        if (this.dom.configureFsrsBtn) {
            this.dom.configureFsrsBtn.addEventListener('click', () => {
                chrome.tabs.create({ url: chrome.runtime.getURL('features/tracker/config/fsrsConfig.html') });
            });
        }

        this.dom.helpBtn?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/common/help/help.html') }));
        this.dom.historyBtn?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/history/history.html') }));
        this.dom.openHeatmapTabBtn?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/heatmap/heatmap.html') }));
        this.dom.boxTotal?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/common/data/data.html?view=total') }));
        this.dom.boxDue?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/common/data/data.html?view=due') }));
        this.dom.boxRetention?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/common/data/data.html?view=retention') }));
        this.dom.manageHighlightsBtn?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/highlighter/manager/highlights.html') }));
        this.dom.openOptionsBtn?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/highlighter/options/highlightOptions.html') }));
        this.dom.forecastBtn?.addEventListener('click', () => chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/forecast/forecast.html') }));

        // Standard JSON database backup export logic
        if (this.dom.exportBtn) {
            this.dom.exportBtn.addEventListener('click', async () => {
                this.showStatus("Exporting backup...");
                try {
                    await BackupManager.exportBackup();
                    this.showStatus("Backup exported successfully!");
                } catch (err) {
                    console.error("Backup export failed:", err);
                    this.showStatus("Export failed: " + err.message, true);
                }
            });
        }

        // Standard JSON backup import setup
        if (this.dom.importFile) {
            this.dom.importFile.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;

                this.showStatus("Restoring backup...");
                await BackupManager.importBackup(file, async (msg, isError) => {
                    this.showStatus(msg, isError);
                    if (!isError && msg.includes("successfully")) {
                        await this.loadAll();
                        // Update UI settings toggles in case they changed
                        chrome.storage.local.get(['chromeSettings'], (result) => {
                            if (result.chromeSettings) {
                                if (result.chromeSettings.showMarkerPopup !== undefined && this.dom.markerToggle) {
                                    this.dom.markerToggle.checked = result.chromeSettings.showMarkerPopup;
                                }
                                if (result.chromeSettings.showCharts !== undefined && this.dom.chartsToggle) {
                                    this.dom.chartsToggle.checked = result.chromeSettings.showCharts;
                                }
                            }
                        });
                    }
                });
                e.target.value = ''; // Reset file input
            });
        }

        // R9.1: Anki backup export setup
        if (this.dom.ankiExportBtn) {
            this.dom.ankiExportBtn.addEventListener('click', () => {
                chrome.storage.local.get(['fsrsCards'], (result) => {
                    const cards = result.fsrsCards || [];
                    if (cards.length === 0) {
                        this.showStatus('No cards to export.', true);
                        return;
                    }
                    const ankiText = this.exportToAnkiText(cards);
                    const blob = new Blob([ankiText], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    chrome.downloads.download({
                        url: url,
                        filename: `algorecall_anki_${new Date().toISOString().split('T')[0]}.txt`,
                        saveAs: true
                    });
                    this.showStatus(`Exported ${cards.length} cards for Anki!`);
                });
            });
        }

        // R9.1: Anki deck import setup
        if (this.dom.ankiImportFile) {
            this.dom.ankiImportFile.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        const text = event.target.result;
                        const newCards = this.importFromAnkiText(text);

                        if (newCards.length === 0) {
                            this.showStatus('No valid cards found in file.', true);
                            return;
                        }

                        chrome.storage.local.get(['fsrsCards'], (result) => {
                            const existing = result.fsrsCards || [];
                            const existingTitles = new Set(existing.map(c => c.problemTitle?.toLowerCase()));

                            // Skip duplicates by title
                            const unique = newCards.filter(c => !existingTitles.has(c.problemTitle?.toLowerCase()));
                            const merged = [...existing, ...unique];

                            chrome.storage.local.set({ fsrsCards: merged }, () => {
                                this.showStatus(`Imported ${unique.length} cards from Anki! (${newCards.length - unique.length} duplicates skipped)`);
                                this.stats.load();
                            });
                        });
                    } catch (err) {
                        this.showStatus('Error reading Anki file.', true);
                    }
                }.bind(this);
                reader.readAsText(file);
                e.target.value = ''; // Reset file input
            });
        }
    }

    /**
     * Triggers a status message toast at the top of the popup dashboard.
     * @param {string} msg - Descriptive message string.
     * @param {boolean} [isError=false] - Signals if the status indicates an error.
     */
    showStatus(msg, isError = false) {
        const el = this.dom.statusMsg;
        if (!el) return;
        
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }
        
        const iconHtml = isError
            ? `<svg class="svg-icon" style="stroke: var(--md-danger); width: 14px; height: 14px;" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
            : `<svg class="svg-icon" style="stroke: var(--md-success); width: 14px; height: 14px;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
        
        el.innerHTML = iconHtml + `<span>${msg}</span>`;
        el.className = 'toast show ' + (isError ? 'error' : 'success'); // styled to match base toast
        
        this.statusTimeout = setTimeout(() => {
            el.classList.remove('show');
        }, 2500);
    }

    /**
     * Export FSRS cards to Anki-compatible tab-separated text.
     * Format: Front<TAB>Back<TAB>Tags
     * Includes Anki header directives for auto-configuration on import.
     * @param {Object[]} cards - Array of FSRS cards.
     * @returns {string} Anki-compatible text data.
     */
    exportToAnkiText(cards) {
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
    importFromAnkiText(text) {
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
}

// Instantiate and initialize coordinator on DOM load
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new AlgoRecallDashboard();
    dashboard.init();
});