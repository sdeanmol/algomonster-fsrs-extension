import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { StatsComponent } from './stats';
import { HeatmapComponent } from './heatmap';
import { NotificationsComponent } from './notifications';
import { RatingComponent } from './rating';
import { QuickSearchComponent } from './search';
import { BackupManager } from '../../common/data/backupManager';
import { Card, StorageData, ChromeSettings } from '../../../types/domain';

export interface PopupDOM {
    themeToggleBtn: HTMLElement | null;
    markerToggle: HTMLInputElement | null;
    chartsToggle: HTMLInputElement | null;
    devModeToggle: HTMLInputElement | null;
    managePlatformsBtn: HTMLElement | null;
    configureFsrsBtn: HTMLElement | null;
    helpBtn: HTMLElement | null;
    historyBtn: HTMLElement | null;
    openHeatmapTabBtn: HTMLElement | null;
    boxTotal: HTMLElement | null;
    boxDue: HTMLElement | null;
    boxRetention: HTMLElement | null;
    manageHighlightsBtn: HTMLElement | null;
    openOptionsBtn: HTMLElement | null;
    analyticsBtn: HTMLElement | null;
    headerAnalyticsBtn: HTMLElement | null;
    forecastBtn: HTMLElement | null;
    exportBtn: HTMLElement | null;
    importFile: HTMLInputElement | null;
    ankiExportBtn: HTMLElement | null;
    ankiImportFile: HTMLInputElement | null;
    studyplanBtn: HTMLElement | null;
    pomodoroBtn: HTMLElement | null;
    openSummaryPageBtn: HTMLElement | null;
    weeklyDigestToggle: HTMLInputElement | null;
    statusMsg: HTMLElement | null;
    devModeActions: HTMLElement | null;
    exportDebugLogsBtn: HTMLElement | null;
    testNotificationsContainer: HTMLElement | null;
}

/**
 * @class AlgoRecallDashboard
 * @description Central coordinator for the AlgoRecall popup options dashboard page.
 * Manages configuration updates (theme, highlighting visibility), page data backup (import/export),
 * Anki deck exchange utilities, and instantiates visual dashboard components.
 */
export class AlgoRecallDashboard {
    statusTimeout: ReturnType<typeof setTimeout> | null = null;
    dom: PopupDOM;
    stats: StatsComponent;
    heatmap: HeatmapComponent;
    notifications: NotificationsComponent;
    rating: RatingComponent;
    search: QuickSearchComponent;

    constructor() {
        try {
            // Cache global/page-level elements
            this.dom = {
                themeToggleBtn: document.getElementById('theme-toggle-btn'),
                markerToggle: document.getElementById('toggle-marker-popup') as HTMLInputElement | null,
                chartsToggle: document.getElementById('toggle-show-charts') as HTMLInputElement | null,
                devModeToggle: document.getElementById('toggle-dev-mode') as HTMLInputElement | null,
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
                analyticsBtn: document.getElementById('analytics-btn'),
                headerAnalyticsBtn: document.getElementById('header-analytics-btn'),
                forecastBtn: document.getElementById('forecast-btn'),
                exportBtn: document.getElementById('export-btn'),
                importFile: document.getElementById('import-file') as HTMLInputElement | null,
                ankiExportBtn: document.getElementById('anki-export-btn'),
                ankiImportFile: document.getElementById('anki-import-file') as HTMLInputElement | null,
                studyplanBtn: document.getElementById('studyplan-btn'),
                pomodoroBtn: document.getElementById('pomodoro-btn'),
                openSummaryPageBtn: document.getElementById('open-summary-page-btn'),
                weeklyDigestToggle: document.getElementById('toggle-weekly-digest') as HTMLInputElement | null,
                statusMsg: document.getElementById('status-msg'),
                devModeActions: document.getElementById('dev-mode-actions'),
                exportDebugLogsBtn: document.getElementById('export-debug-logs-btn'),
                testNotificationsContainer: document.getElementById('test-notifications-container'),
            };

            // Subclass Components instantiation
            this.stats = new StatsComponent(this);
            this.heatmap = new HeatmapComponent(this);
            this.notifications = new NotificationsComponent(this);
            this.rating = new RatingComponent(this);
            this.search = new QuickSearchComponent(this);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Popup', `Error in AlgoRecallDashboard constructor: ${errorMessage}`, { err });
            // Comment: Non-fatal constructor DOM caching error
            this.dom = {} as PopupDOM;
            this.stats = new StatsComponent(this);
            this.heatmap = new HeatmapComponent(this);
            this.notifications = new NotificationsComponent(this);
            this.rating = new RatingComponent(this);
            this.search = new QuickSearchComponent(this);
        }
    }

    /**
     * Initializes the dashboard, binds page event listeners, and boots sub-components.
     */
    async init(): Promise<void> {
        Logger.info('Popup', 'Popup initialized.');
        Logger.time('Popup', 'init');
        try {
            this.bindEvents();

            // Boot component lifecycle steps
            this.stats.bindEvents();
            this.heatmap.bindEvents();
            this.notifications.bindEvents();
            this.rating.bindEvents();
            this.search.bindEvents();

            // Perform initial loading from storage databases
            await this.loadAll();
        } catch (err) {
            UIUtils.catchError('Popup', 'Failed popup initialization', err);
        } finally {
            Logger.timeEnd('Popup', 'init');
        }
    }

    /**
     * Triggers asynchronous state loads across all child panel classes.
     */
    async loadAll(): Promise<void> {
        try {
            await Promise.all([
                this.stats.load(),
                this.heatmap.load(),
                this.notifications.checkPermissions(),
                this.notifications.loadSettings(),
                this.rating.load(),
                this.search.load()
            ]);
        } catch (err) {
            UIUtils.catchError('Popup', 'Error loading child components in loadAll', err);
        }
    }

    /**
     * Binds click and state change event listeners for settings panels, exports, and page routers.
     */
    bindEvents(): void {
        try {
            // Theme Switcher Initialization
            if (this.dom.themeToggleBtn) {
                this.dom.themeToggleBtn.addEventListener('click', async () => {
                    try {
                        const result = (await chrome.storage.local.get(['theme'])) as StorageData;
                        const currentTheme = result.theme || 'dark';
                        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
                        await chrome.storage.local.set({ theme: newTheme });
                        this.showStatus(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode!`);
                    } catch (error) {
            UIUtils.catchError('Popup', 'Error toggling theme settings', error);
        }
                });
            }

            // Floating Highlighter switch setup
            if (this.dom.markerToggle) {
                chrome.storage.local.get(['chromeSettings'], (result: StorageData) => {
                    try {
                        const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                        if (lastError) {
                            const errorMessage = lastError.message || String(lastError);
                            Logger.error('Popup', `Storage error fetching marker toggle settings: ${errorMessage}`, { error: lastError });
                            return;
                        }
                        if (result.chromeSettings && result.chromeSettings.showMarkerPopup !== undefined && this.dom.markerToggle) {
                            this.dom.markerToggle.checked = result.chromeSettings.showMarkerPopup;
                        }
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error rendering marker toggle setting', err);
        }
                });
                this.dom.markerToggle.addEventListener('change', async (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const result = (await chrome.storage.local.get(['chromeSettings'])) as StorageData;
                        const settings: ChromeSettings = result.chromeSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                        settings.showMarkerPopup = target.checked;
                        await chrome.storage.local.set({ chromeSettings: settings });
                    } catch (error) {
            UIUtils.catchError('Popup', 'Error setting showMarkerPopup config', error);
        }
                });
            }

            // Visual charts display switch setup
            if (this.dom.chartsToggle) {
                chrome.storage.local.get(['chromeSettings'], (result: StorageData) => {
                    try {
                        const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                        if (lastError) {
                            const errorMessage = lastError.message || String(lastError);
                            Logger.error('Popup', `Storage error fetching charts toggle settings: ${errorMessage}`, { error: lastError });
                            return;
                        }
                        const showCharts = result.chromeSettings && result.chromeSettings.showCharts !== undefined
                            ? result.chromeSettings.showCharts
                            : true;
                        if (this.dom.chartsToggle) {
                            this.dom.chartsToggle.checked = showCharts;
                        }
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error rendering charts toggle setting', err);
        }
                });
                this.dom.chartsToggle.addEventListener('change', async (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const result = (await chrome.storage.local.get(['chromeSettings'])) as StorageData;
                        const settings: ChromeSettings = result.chromeSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                        settings.showCharts = target.checked;
                        await chrome.storage.local.set({ chromeSettings: settings });
                        this.showStatus(`Visual charts ${target.checked ? 'enabled' : 'disabled'}!`);
                    } catch (error) {
            UIUtils.catchError('Popup', 'Error setting showCharts config', error);
        }
                });
            }

            // Developer mode display switch setup
            if (this.dom.devModeToggle) {
                chrome.storage.local.get(['chromeSettings'], (result: StorageData) => {
                    try {
                        const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                        if (lastError) {
                            const errorMessage = lastError.message || String(lastError);
                            Logger.error('Popup', `Storage error fetching dev mode toggle settings: ${errorMessage}`, { error: lastError });
                            return;
                        }
                        const devMode = result.chromeSettings && result.chromeSettings.developerMode !== undefined
                            ? result.chromeSettings.developerMode
                            : false;
                        if (this.dom.devModeToggle) {
                            this.dom.devModeToggle.checked = devMode;
                        }
                        if (this.dom.devModeActions) {
                            this.dom.devModeActions.style.display = devMode ? 'block' : 'none';
                        }
                        if (this.dom.testNotificationsContainer) {
                            this.dom.testNotificationsContainer.style.display = devMode ? 'flex' : 'none';
                        }
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error rendering dev mode toggle setting', err);
        }
                });
                this.dom.devModeToggle.addEventListener('change', async (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const result = (await chrome.storage.local.get(['chromeSettings'])) as StorageData;
                        const settings: ChromeSettings = result.chromeSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                        settings.developerMode = target.checked;
                        await chrome.storage.local.set({ chromeSettings: settings });
                        if (this.dom.devModeActions) {
                            this.dom.devModeActions.style.display = target.checked ? 'block' : 'none';
                        }
                        if (this.dom.testNotificationsContainer) {
                            this.dom.testNotificationsContainer.style.display = target.checked ? 'flex' : 'none';
                        }
                        this.showStatus(`Developer mode ${target.checked ? 'enabled' : 'disabled'}!`);
                    } catch (error) {
            UIUtils.catchError('Popup', 'Error setting developerMode config', error);
        }
                });

                if (this.dom.exportDebugLogsBtn) {
                    this.dom.exportDebugLogsBtn.addEventListener('click', () => {
                        try {
                            chrome.storage.local.get(['debugLogs'], (result: { debugLogs?: unknown[] }) => {
                                try {
                                    const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                    if (lastError) {
                                        const errorMessage = lastError.message || String(lastError);
                                        Logger.error('Popup', `Storage error fetching debug logs: ${errorMessage}`, { error: lastError });
                                        return;
                                    }
                                    const logs = result.debugLogs || [];
                                    if (logs.length === 0) {
                                        this.showStatus('No debug logs found.', true);
                                        return;
                                    }

                                    const logLines = logs.map((l: unknown) => JSON.stringify(l)).join('\n');
                                    const blob = new Blob([logLines], { type: 'application/json' });
                                    const url = URL.createObjectURL(blob);

                                    chrome.downloads.download({
                                        url: url,
                                        filename: `algorecall_debug_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
                                        saveAs: true
                                    }, () => {
                                        try {
                                            URL.revokeObjectURL(url);
                                        } catch (revokeErr) {
                                            const errorMessage = revokeErr instanceof Error ? revokeErr.message : String(revokeErr);
                                            Logger.debug('Popup', `Ignore revokeObjectURL error: ${errorMessage}`, { revokeErr });
                                        }
                                    });
                                    this.showStatus(`Exported ${logs.length} debug logs!`);
                                } catch (innerErr) {
            UIUtils.catchError('Popup', 'Error exporting debug logs from callback', innerErr);
        }
                            });
                        } catch (err) {
            UIUtils.catchError('Popup', 'Error handling export debug logs click', err);
        }
                    });
                }
            }

            // Webpage page redirection setups
            if (this.dom.managePlatformsBtn) {
                this.dom.managePlatformsBtn.addEventListener('click', () => {
                    try {
                        chrome.tabs.create({ url: chrome.runtime.getURL('features/common/websites/websites.html') });
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to websites.html', err);
        }
                });
            }

            if (this.dom.configureFsrsBtn) {
                this.dom.configureFsrsBtn.addEventListener('click', () => {
                    try {
                        chrome.tabs.create({ url: chrome.runtime.getURL('features/tracker/config/fsrsConfig.html') });
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to fsrsConfig.html', err);
        }
                });
            }

            this.dom.helpBtn?.addEventListener('click', () => {
                try {
                    chrome.tabs.create({ url: chrome.runtime.getURL('features/common/help/help.html') });
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to help.html', err);
        }
            });
            this.dom.historyBtn?.addEventListener('click', () => {
                try {
                    chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/history/history.html') });
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to history.html', err);
        }
            });
            this.dom.openHeatmapTabBtn?.addEventListener('click', () => {
                try {
                    chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/heatmap/heatmap.html') });
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to heatmap.html', err);
        }
            });
            this.dom.boxTotal?.addEventListener('click', () => {
                try {
                    chrome.tabs.create({ url: chrome.runtime.getURL('features/common/data/data.html?view=total') });
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to total data view', err);
        }
            });
            this.dom.boxDue?.addEventListener('click', () => {
                try {
                    chrome.tabs.create({ url: chrome.runtime.getURL('features/common/data/data.html?view=due') });
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to due data view', err);
        }
            });
            this.dom.boxRetention?.addEventListener('click', () => {
                try {
                    chrome.tabs.create({ url: chrome.runtime.getURL('features/common/data/data.html?view=retention') });
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to retention data view', err);
        }
            });
            this.dom.manageHighlightsBtn?.addEventListener('click', () => {
                try {
                    chrome.tabs.create({ url: chrome.runtime.getURL('features/highlighter/manager/highlights.html') });
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to highlights.html', err);
        }
            });
            this.dom.openOptionsBtn?.addEventListener('click', () => {
                try {
                    chrome.tabs.create({ url: chrome.runtime.getURL('features/highlighter/options/highlightOptions.html') });
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to highlightOptions.html', err);
        }
            });

            const openAnalyticsTab = () => {
                try {
                    chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/analytics/analytics.html') });
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to analytics.html', err);
        }
            };
            this.dom.analyticsBtn?.addEventListener('click', openAnalyticsTab);
            this.dom.headerAnalyticsBtn?.addEventListener('click', openAnalyticsTab);

            this.dom.forecastBtn?.addEventListener('click', () => {
                try {
                    chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/forecast/forecast.html') });
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to forecast.html', err);
        }
            });
            this.dom.studyplanBtn?.addEventListener('click', () => {
                try {
                    chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/studyplan/studyplan.html') });
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to studyplan.html', err);
        }
            });
            this.dom.pomodoroBtn?.addEventListener('click', () => {
                try {
                    chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/pomodoro/pomodoro.html') });
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to pomodoro.html', err);
        }
            });
            this.dom.openSummaryPageBtn?.addEventListener('click', () => {
                try {
                    chrome.tabs.create({ url: chrome.runtime.getURL('features/dashboard/summary/summary.html') });
                } catch (err) {
            UIUtils.catchError('Popup', 'Error navigating to summary.html', err);
        }
            });

            // Standard JSON database backup export logic
            if (this.dom.exportBtn) {
                this.dom.exportBtn.addEventListener('click', async () => {
                    this.showStatus("Exporting backup...");
                    try {
                        await BackupManager.exportBackup();
                        this.showStatus("Backup exported successfully!");
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('Popup', `Backup export failed: ${errorMessage}`, { err });
                        this.showStatus("Export failed: " + errorMessage, true);
                    }
                });
            }

            // Standard JSON backup import setup
            if (this.dom.importFile) {
                this.dom.importFile.addEventListener('change', async (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const file = target.files?.[0];
                        if (!file) return;

                        this.showStatus("Restoring backup...");
                        await BackupManager.importBackup(file, async (msg: string, isError?: boolean) => {
                            try {
                                this.showStatus(msg, isError);
                                if (!isError && msg.includes("successfully")) {
                                    await this.loadAll();
                                    // Update UI settings toggles in case they changed
                                    chrome.storage.local.get(['chromeSettings'], (result: StorageData) => {
                                        try {
                                            const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                            if (lastError) {
                                                const errorMessage = lastError.message || String(lastError);
                                                Logger.error('Popup', `Storage error fetching chromeSettings after import: ${errorMessage}`, { error: lastError });
                                                return;
                                            }
                                            if (result.chromeSettings) {
                                                if (result.chromeSettings.showMarkerPopup !== undefined && this.dom.markerToggle) {
                                                    this.dom.markerToggle.checked = result.chromeSettings.showMarkerPopup;
                                                }
                                                if (result.chromeSettings.showCharts !== undefined && this.dom.chartsToggle) {
                                                    this.dom.chartsToggle.checked = result.chromeSettings.showCharts;
                                                }
                                                if (result.chromeSettings.developerMode !== undefined && this.dom.devModeToggle) {
                                                    this.dom.devModeToggle.checked = result.chromeSettings.developerMode;
                                                }
                                            }
                                        } catch (cbErr) {
            UIUtils.catchError('Popup', 'Error updating UI toggles post-import', cbErr);
        }
                                    });
                                }
                            } catch (importCbErr) {
            UIUtils.catchError('Popup', 'Error in import backup callback', importCbErr);
        }
                        });
                        target.value = ''; // Reset file input
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error in importFile change listener', err);
        }
                });
            }

            // R9.1: Anki backup export setup
            if (this.dom.ankiExportBtn) {
                this.dom.ankiExportBtn.addEventListener('click', () => {
                    try {
                        chrome.storage.local.get(['fsrsCards'], (result: StorageData) => {
                            try {
                                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                if (lastError) {
                                    const errorMessage = lastError.message || String(lastError);
                                    Logger.error('Popup', `Storage error fetching cards for Anki export: ${errorMessage}`, { error: lastError });
                                    this.showStatus('Error reading cards.', true);
                                    return;
                                }
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
                                }, () => {
                                    try {
                                        URL.revokeObjectURL(url);
                                    } catch (revokeErr) {
                                        const errorMessage = revokeErr instanceof Error ? revokeErr.message : String(revokeErr);
                                        Logger.debug('Popup', `Ignore revokeObjectURL error: ${errorMessage}`, { revokeErr });
                                    }
                                });
                                this.showStatus(`Exported ${cards.length} cards for Anki!`);
                            } catch (innerErr) {
                                const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                                Logger.error('Popup', `Error processing Anki export: ${errorMessage}`, { innerErr });
                                this.showStatus('Error processing Anki export.', true);
                            }
                        });
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error in ankiExportBtn click listener', err);
        }
                });
            }

            // R9.1: Anki deck import setup
            if (this.dom.ankiImportFile) {
                this.dom.ankiImportFile.addEventListener('change', (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const file = target.files?.[0];
                        if (!file) return;

                        const reader = new FileReader();
                        reader.onload = (event: ProgressEvent<FileReader>) => {
                            try {
                                const text = event.target?.result as string;
                                const newCards = this.importFromAnkiText(text);

                                if (newCards.length === 0) {
                                    this.showStatus('No valid cards found in file.', true);
                                    return;
                                }

                                chrome.storage.local.get(['fsrsCards'], (result: StorageData) => {
                                    try {
                                        const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                        if (lastError) {
                                            const errorMessage = lastError.message || String(lastError);
                                            Logger.error('Popup', `Storage error reading existing cards for Anki import: ${errorMessage}`, { error: lastError });
                                            this.showStatus('Error accessing card storage.', true);
                                            return;
                                        }
                                        const existing = result.fsrsCards || [];
                                        const existingTitles = new Set(existing.map((c: Card) => c.problemTitle?.toLowerCase()));

                                        // Skip duplicates by title
                                        const unique = newCards.filter(c => !existingTitles.has(c.problemTitle?.toLowerCase()));
                                        const merged = [...existing, ...unique];

                                        chrome.storage.local.set({ fsrsCards: merged }, () => {
                                            try {
                                                const setLastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                                                if (setLastError) {
                                                    const errorMessage = setLastError.message || String(setLastError);
                                                    Logger.error('Popup', `Storage error saving imported Anki cards: ${errorMessage}`, { error: setLastError });
                                                    this.showStatus('Error saving imported cards.', true);
                                                    return;
                                                }
                                                this.showStatus(`Imported ${unique.length} cards from Anki! (${newCards.length - unique.length} duplicates skipped)`);
                                                this.stats.load();
                                            } catch (setCbErr) {
            UIUtils.catchError('Popup', 'Error in storage set callback for Anki import', setCbErr);
        }
                                        });
                                    } catch (readCbErr) {
            UIUtils.catchError('Popup', 'Error in storage get callback for Anki import', readCbErr);
        }
                                });
                            } catch (readerErr) {
                                const errorMessage = readerErr instanceof Error ? readerErr.message : String(readerErr);
                                Logger.error('Popup', `Error parsing Anki text file: ${errorMessage}`, { readerErr });
                                this.showStatus('Error reading Anki file.', true);
                            }
                        };
                        reader.readAsText(file);
                        target.value = ''; // Reset file input
                    } catch (err) {
            UIUtils.catchError('Popup', 'Error in ankiImportFile change listener', err);
        }
                });
            }
        } catch (err) {
            UIUtils.catchError('Popup', 'Error binding popup dashboard events', err);
        }
    }

    /**
     * Triggers a status message toast at the top of the popup dashboard.
     * @param {string} msg - Descriptive message string.
     * @param {boolean} [isError=false] - Signals if the status indicates an error.
     */
    showStatus(msg: string, isError: boolean = false): void {
        try {
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
                try {
                    el.classList.remove('show');
                } catch (timerErr) {
            UIUtils.catchError('Popup', 'Error hiding status toast', timerErr);
        }
            }, 2500);
        } catch (err) {
            UIUtils.catchError('Popup', 'Error rendering status toast', err, { msg, isError });
        }
    }

    /**
     * Export FSRS cards to Anki-compatible tab-separated text.
     * Format: Front<TAB>Back<TAB>Tags
     * Includes Anki header directives for auto-configuration on import.
     * @param {Card[]} cards - Array of FSRS cards.
     * @returns {string} Anki-compatible text data.
     */
    exportToAnkiText(cards: Card[]): string {
        try {
            const lines: string[] = [];

            // Anki header directives
            lines.push('#separator:tab');
            lines.push('#html:false');
            lines.push('#tags column:3');
            lines.push('#deck:AlgoRecall');
            lines.push('#notetype:Basic');
            lines.push('');

            cards.forEach((card: Card) => {
                const front = (card.problemTitle || 'Untitled').replace(/\t/g, ' ').replace(/\n/g, ' ');
                const back = (card.approach || '').replace(/\t/g, '    '); // Keep newlines for Anki markdown
                const tags = (card.tags || []).map((t: string) => `algorecall::${t.replace(/\s+/g, '_')}`).join(' ');

                // Add URL as part of front if available
                const frontWithUrl = card.problemUrl
                    ? `${front}\n[URL: ${card.problemUrl}]`
                    : front;

                lines.push(`${frontWithUrl}\t${back}\t${tags}`);
            });

            return lines.join('\n');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Popup', `Error formatting cards for Anki export: ${errorMessage}`, { err });
            return '';
        }
    }

    /**
     * Import Anki tab-separated text into FSRS card objects.
     * Expects: Front<TAB>Back<TAB>Tags (optional)
     * @param {string} text - The raw Anki-formatted text content.
     * @returns {Card[]} Created stub FSRS card objects.
     */
    importFromAnkiText(text: string): Card[] {
        try {
            const lines = text.split('\n');
            const cards: Card[] = [];
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
                const card: Card = {
                    id: `imported_${now}_${Math.random().toString(36).substr(2, 8)}`,
                    problemTitle: front,
                    problemUrl: problemUrl || `#imported-${encodeURIComponent(front.substring(0, 50))}`,
                    approach: back,
                    tags: tags,
                    due: now, // Due immediately for first review
                    stability: 0,
                    difficulty: 0,
                    elapsed_days: 0,
                    scheduled_days: 0,
                    learning_steps: 0,
                    reps: 0,
                    lapses: 0,
                    state: 0, // New
                    last_review: null,
                    lastRating: undefined,
                    historyLog: [],
                    previousDue: undefined
                };

                cards.push(card);
            }

            return cards;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Popup', `Error parsing Anki cards from text: ${errorMessage}`, { err });
            return [];
        }
    }
}

// Instantiate and initialize coordinator on DOM load
function initPopupDashboard(): void {
    try {
        const dashboard = new AlgoRecallDashboard();
        dashboard.init();
    } catch (err) {
            UIUtils.catchError('Popup', 'Initialization failed', err);
        }
}

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPopupDashboard);
    } else {
        initPopupDashboard();
    }
}
