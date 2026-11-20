/**
 * @file features/dashboard/popup/popup.ts
 * @description Central coordinator for the AlgoRecall popup dashboard window.
 * Manages configuration updates (theme, in-page toggles), launchpad navigation,
 * and instantiates visual dashboard components (stats, heatmap, notifications,
 * ratings, and quick search).
 *
 * Architecture Role: Popup Master Controller and View Coordinator.
 * Context: Extension Action Popup (`features/dashboard/popup/popup.html`).
 * Key Exports:
 * - {@link PopupDOM}: Interface mapping cached DOM element references for the popup.
 * - {@link AlgoRecallDashboard}: Main coordinator class managing popup lifecycle, settings, and tabs.
 */

import { Logger } from '@common/logger';
import { UIUtils } from '../../common/utils/uiUtils';
import { CatchAndLog, MeasureTime, withErrorHandling } from '../../../decorators';
import { StatsComponent } from './stats';
import { HeatmapComponent } from './heatmap';
import { NotificationsComponent } from './notifications';
import { RatingComponent } from './rating';
import { QuickSearchComponent } from './search';
import { StorageData, ExtensionSettings } from '../../../types/domain';
import { BROWSER_CONFIG } from '../../common/browserConfig';
import { ActionService } from '../../common/services/actionService';

/**
 * Cached DOM elements for the primary popup dashboard window.
 */
export interface PopupDOM {
    /** Button toggling light/dark theme. */
    themeToggleBtn: HTMLElement | null;
    /** Toggle switch enabling/disabling floating text highlighter popup. */
    markerToggle: HTMLInputElement | null;
    /** Toggle switch enabling/disabling visual SVG activity charts. */
    chartsToggle: HTMLInputElement | null;
    /** Toggle switch enabling/disabling daily goal focus and streak momentum. */
    dailyFocusToggle: HTMLInputElement | null;
    /** Toggle switch enabling/disabling problem tracker launcher button on content pages. */
    launcherToggle: HTMLInputElement | null;
    /** Toggle switch enabling developer debug tools. */
    devModeToggle: HTMLInputElement | null;
    /** Button navigating to user documentation and help page. */
    helpBtn: HTMLElement | null;
    /** Button navigating to historical review logs page. */
    historyBtn: HTMLElement | null;
    /** Button opening dedicated full-tab heatmap page. */
    openHeatmapTabBtn: HTMLElement | null;
    /** Stat box displaying total cards tracked. */
    boxTotal: HTMLElement | null;
    /** Stat box displaying cards currently due for review. */
    boxDue: HTMLElement | null;
    /** Stat box displaying overall retention percentage. */
    boxRetention: HTMLElement | null;
    /** Button opening highlights manager page. */
    manageHighlightsBtn: HTMLElement | null;
    /** Button opening highlighter palette options page. */
    openOptionsBtn: HTMLElement | null;
    /** Launchpad button opening full analytics dashboard. */
    analyticsBtn: HTMLElement | null;
    /** Header button opening full analytics dashboard. */
    headerAnalyticsBtn: HTMLElement | null;
    /** Button opening future workload forecast page. */
    forecastBtn: HTMLElement | null;
    /** Button opening achievements and records dialog. */
    achievementsBtn: HTMLElement | null;
    /** Button opening exam countdown study plan page. */
    studyplanBtn: HTMLElement | null;
    /** Button opening Pomodoro timer page. */
    pomodoroBtn: HTMLElement | null;
    /** Button opening review session summary page. */
    openSummaryPageBtn: HTMLElement | null;
    /** Button in launchpad opening dedicated settings hub. */
    settingsHubBtn: HTMLElement | null;
    /** Status toast banner container for temporary user notifications. */
    statusMsg: HTMLElement | null;
    /** Container element holding developer-only action buttons. */
    devModeActions: HTMLElement | null;
    /** Button exporting internal debug log history as JSON. */
    exportDebugLogsBtn: HTMLElement | null;
    /** Container element holding test notification triggers in developer mode. */
    testNotificationsContainer: HTMLElement | null;
}

/**
 * Central coordinator for the AlgoRecall popup options dashboard page.
 * Manages configuration updates (theme, in-page toggles), launchpad navigation,
 * and instantiates visual dashboard components.
 */
export class AlgoRecallDashboard {
    /** Active timeout handle for auto-dismissing toast notifications. */
    statusTimeout: ReturnType<typeof setTimeout> | null = null;
    /** Cached DOM elements for the dashboard window. */
    dom: PopupDOM;
    /** Sub-component rendering summary counters and retention metrics. */
    stats: StatsComponent;
    /** Sub-component rendering mini activity heatmap grid. */
    heatmap: HeatmapComponent;
    /** Sub-component managing background reminder schedules and permissions. */
    notifications: NotificationsComponent;
    /** Sub-component providing inline card rating interface. */
    rating: RatingComponent;
    /** Sub-component providing search bar for quick problem lookup. */
    search: QuickSearchComponent;

    /**
     * Initializes the popup dashboard, caching element references and instantiating sub-components.
     */
    constructor() {
        try {
            // Cache global/page-level elements
            this.dom = {
                themeToggleBtn: document.getElementById('theme-toggle-btn'),
                markerToggle: document.getElementById('toggle-marker-popup') as HTMLInputElement | null,
                chartsToggle: document.getElementById('toggle-show-charts') as HTMLInputElement | null,
                dailyFocusToggle: document.getElementById('toggle-daily-focus') as HTMLInputElement | null,
                launcherToggle: document.getElementById('toggle-algo-launcher') as HTMLInputElement | null,
                devModeToggle: document.getElementById('toggle-dev-mode') as HTMLInputElement | null,
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
                achievementsBtn: document.getElementById('achievements-btn'),
                studyplanBtn: document.getElementById('studyplan-btn'),
                pomodoroBtn: document.getElementById('pomodoro-btn'),
                openSummaryPageBtn: document.getElementById('open-summary-page-btn'),
                settingsHubBtn: document.getElementById('settings-hub-btn'),
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
    @MeasureTime('Popup', 'init')
    @CatchAndLog('Popup', 'Failed popup initialization')
    async init(): Promise<void> {
        Logger.info('Popup', 'Popup initialized.');
        this.bindEvents();

        // Boot component lifecycle steps
        this.stats.bindEvents();
        this.heatmap.bindEvents();
        this.notifications.bindEvents();
        this.rating.bindEvents();
        this.search.bindEvents();

        // Perform initial loading from storage databases
        await this.loadAll();
    }

    /**
     * Triggers asynchronous state loads across all child panel classes.
     */
    @CatchAndLog('Popup', 'Error loading child components in loadAll')
    async loadAll(): Promise<void> {
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
    @CatchAndLog('Popup', 'Error binding popup dashboard events')
    bindEvents(): void {
        // Theme Switcher Initialization
        if (this.dom.themeToggleBtn) {
            this.dom.themeToggleBtn.addEventListener('click', withErrorHandling(async () => {
                const newTheme = await ActionService.toggleTheme();
                this.showStatus(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode!`);
            }, { context: 'Popup', message: 'Error toggling theme settings' }));
        }

        // Floating Highlighter switch setup
        if (this.dom.markerToggle) {
            chrome.storage.local.get(['extensionSettings'], withErrorHandling((result: StorageData) => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('Popup', `Storage error fetching marker toggle settings: ${errorMessage}`, { error: lastError });
                    return;
                }
                if (result.extensionSettings && result.extensionSettings.showMarkerPopup !== undefined && this.dom.markerToggle) {
                    this.dom.markerToggle.checked = result.extensionSettings.showMarkerPopup;
                }
            }, { context: 'Popup', message: 'Error rendering marker toggle setting' }));

            this.dom.markerToggle.addEventListener('change', withErrorHandling(async (e: Event) => {
                const target = e.target as HTMLInputElement;
                const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                settings.showMarkerPopup = target.checked;
                await chrome.storage.local.set({ extensionSettings: settings });
            }, { context: 'Popup', message: 'Error setting showMarkerPopup config' }));
        }

        // Visual charts display switch setup
        if (this.dom.chartsToggle) {
            chrome.storage.local.get(['extensionSettings'], withErrorHandling((result: StorageData) => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('Popup', `Storage error fetching charts toggle settings: ${errorMessage}`, { error: lastError });
                    return;
                }
                const showCharts = result.extensionSettings && result.extensionSettings.showCharts !== undefined
                    ? result.extensionSettings.showCharts
                    : true;
                if (this.dom.chartsToggle) {
                    this.dom.chartsToggle.checked = showCharts;
                    this.dom.chartsToggle.setAttribute('aria-checked', showCharts.toString());
                }
                this.updateChartsVisibility(showCharts);
            }, { context: 'Popup', message: 'Error rendering charts toggle setting' }));

            this.dom.chartsToggle.addEventListener('change', withErrorHandling(async (e: Event) => {
                const target = e.target as HTMLInputElement;
                target.setAttribute('aria-checked', target.checked.toString());
                this.updateChartsVisibility(target.checked);
                const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                settings.showCharts = target.checked;
                await chrome.storage.local.set({ extensionSettings: settings });
                this.showStatus(`Visual charts ${target.checked ? 'enabled' : 'disabled'}!`);
            }, { context: 'Popup', message: 'Error setting showCharts config' }));
        }

        // Daily Focus & Momentum display switch setup
        if (this.dom.dailyFocusToggle) {
            chrome.storage.local.get(['extensionSettings'], withErrorHandling((result: StorageData) => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('Popup', `Storage error fetching daily focus toggle settings: ${errorMessage}`, { error: lastError });
                    return;
                }
                const showDailyFocus = result.extensionSettings && result.extensionSettings.showDailyFocus !== undefined
                    ? result.extensionSettings.showDailyFocus
                    : true;
                if (this.dom.dailyFocusToggle) {
                    this.dom.dailyFocusToggle.checked = showDailyFocus;
                    this.dom.dailyFocusToggle.setAttribute('aria-checked', showDailyFocus.toString());
                }
                this.updateDailyFocusVisibility(showDailyFocus);
            }, { context: 'Popup', message: 'Error rendering daily focus toggle setting' }));

            this.dom.dailyFocusToggle.addEventListener('change', withErrorHandling(async (e: Event) => {
                const target = e.target as HTMLInputElement;
                target.setAttribute('aria-checked', target.checked.toString());
                this.updateDailyFocusVisibility(target.checked);
                const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                settings.showDailyFocus = target.checked;
                await chrome.storage.local.set({ extensionSettings: settings });
                this.showStatus(`Daily Focus & Momentum ${target.checked ? 'enabled' : 'hidden'}!`);
            }, { context: 'Popup', message: 'Error setting showDailyFocus config' }));
        }

        // Problem tracker launcher toggle setup
        if (this.dom.launcherToggle) {
            chrome.storage.local.get(['extensionSettings'], withErrorHandling((result: StorageData) => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('Popup', `Storage error fetching launcher toggle settings: ${errorMessage}`, { error: lastError });
                    return;
                }
                const showLauncher = result.extensionSettings && result.extensionSettings.showLauncher !== undefined
                    ? result.extensionSettings.showLauncher
                    : true;
                if (this.dom.launcherToggle) {
                    this.dom.launcherToggle.checked = showLauncher;
                    this.dom.launcherToggle.setAttribute('aria-checked', showLauncher.toString());
                }
            }, { context: 'Popup', message: 'Error rendering launcher toggle setting' }));

            this.dom.launcherToggle.addEventListener('change', withErrorHandling(async (e: Event) => {
                const target = e.target as HTMLInputElement;
                target.setAttribute('aria-checked', target.checked.toString());
                const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                settings.showLauncher = target.checked;
                await chrome.storage.local.set({ extensionSettings: settings });
                this.showStatus(`Problem tracker launcher ${target.checked ? 'enabled' : 'disabled'}!`);
            }, { context: 'Popup', message: 'Error setting showLauncher config' }));
        }

        // Developer mode display switch setup
        if (this.dom.devModeToggle) {
            chrome.storage.local.get(['extensionSettings'], withErrorHandling((result: StorageData) => {
                const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                if (lastError) {
                    const errorMessage = lastError.message || String(lastError);
                    Logger.error('Popup', `Storage error fetching dev mode toggle settings: ${errorMessage}`, { error: lastError });
                    return;
                }
                const devMode = result.extensionSettings && result.extensionSettings.developerMode !== undefined
                    ? result.extensionSettings.developerMode
                    : false;
                if (this.dom.devModeToggle) {
                    this.dom.devModeToggle.checked = devMode;
                    this.dom.devModeToggle.setAttribute('aria-checked', devMode.toString());
                }
                if (this.dom.devModeActions) {
                    this.dom.devModeActions.style.display = devMode ? 'block' : 'none';
                }
                if (this.dom.testNotificationsContainer) {
                    this.dom.testNotificationsContainer.style.display = devMode ? 'flex' : 'none';
                }
            }, { context: 'Popup', message: 'Error rendering dev mode toggle setting' }));

            this.dom.devModeToggle.addEventListener('change', withErrorHandling(async (e: Event) => {
                const target = e.target as HTMLInputElement;
                target.setAttribute('aria-checked', target.checked.toString());
                const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                settings.developerMode = target.checked;
                await chrome.storage.local.set({ extensionSettings: settings });
                if (this.dom.devModeActions) {
                    this.dom.devModeActions.style.display = target.checked ? 'block' : 'none';
                }
                if (this.dom.testNotificationsContainer) {
                    this.dom.testNotificationsContainer.style.display = target.checked ? 'flex' : 'none';
                }
                this.showStatus(`Developer mode ${target.checked ? 'enabled' : 'disabled'}!`);
            }, { context: 'Popup', message: 'Error setting developerMode config' }));

            if (this.dom.exportDebugLogsBtn) {
                this.dom.exportDebugLogsBtn.addEventListener('click', withErrorHandling(() => {
                    chrome.storage.local.get(['debugLogs'], withErrorHandling((result: { debugLogs?: unknown[] }) => {
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
                        const filename = `algorecall_debug_logs_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

                        // Safari does not support chrome.downloads — use anchor-click fallback.
                        if (BROWSER_CONFIG.supportsDownloads) {
                            chrome.downloads.download({
                                url: url,
                                filename,
                                saveAs: true
                            }, () => {
                                try {
                                    URL.revokeObjectURL(url);
                                } catch (revokeErr) {
                                    const errorMessage = revokeErr instanceof Error ? revokeErr.message : String(revokeErr);
                                    Logger.debug('Popup', `Ignore revokeObjectURL error: ${errorMessage}`, { revokeErr });
                                }
                            });
                        } else {
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }
                        this.showStatus(`Exported ${logs.length} debug logs!`);
                    }, { context: 'Popup', message: 'Error exporting debug logs from callback' }));
                }, { context: 'Popup', message: 'Error handling export debug logs click' }));
            }
        }

        // Navigation and Tool Actions
        this.dom.helpBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-help');
        }, { context: 'Popup', message: 'Error navigating to help.html' }));

        this.dom.historyBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-history');
        }, { context: 'Popup', message: 'Error navigating to history.html' }));

        this.dom.openHeatmapTabBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-heatmap');
        }, { context: 'Popup', message: 'Error navigating to heatmap.html' }));

        const addAccessibleClick = (el: HTMLElement | null, handler: () => void) => {
            if (!el) return;
            el.addEventListener('click', handler);
            el.addEventListener('keydown', (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handler();
                }
            });
        };

        addAccessibleClick(this.dom.boxTotal, withErrorHandling(() => {
            ActionService.executeAction('view-all-cards');
        }, { context: 'Popup', message: 'Error navigating to total data view' }));

        addAccessibleClick(this.dom.boxDue, withErrorHandling(() => {
            ActionService.executeAction('view-due-cards');
        }, { context: 'Popup', message: 'Error navigating to due data view' }));

        addAccessibleClick(this.dom.boxRetention, withErrorHandling(() => {
            ActionService.executeAction('view-retention-cards');
        }, { context: 'Popup', message: 'Error navigating to retention data view' }));

        this.dom.manageHighlightsBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-highlights-manager');
        }, { context: 'Popup', message: 'Error navigating to highlights.html' }));

        this.dom.openOptionsBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-highlights-options');
        }, { context: 'Popup', message: 'Error navigating to highlightOptions.html' }));

        const openAnalyticsTab = withErrorHandling(() => {
            ActionService.executeAction('open-analytics');
        }, { context: 'Popup', message: 'Error navigating to analytics.html' });
        this.dom.analyticsBtn?.addEventListener('click', openAnalyticsTab);
        this.dom.headerAnalyticsBtn?.addEventListener('click', openAnalyticsTab);

        this.dom.settingsHubBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-settings');
        }, { context: 'Popup', message: 'Error navigating to settings.html' }));

        this.dom.forecastBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-forecast');
        }, { context: 'Popup', message: 'Error navigating to forecast.html' }));

        this.dom.achievementsBtn?.addEventListener('click', withErrorHandling(() => {
            this.stats.bindAchievementsModal();
            const openBtn = document.getElementById('achievements-open-btn');
            if (openBtn) {
                openBtn.click();
            } else {
                const modal = document.getElementById('achievements-modal');
                modal?.classList.remove('hide-panel');
            }
        }, { context: 'Popup', message: 'Error opening achievements dialog' }));

        this.dom.studyplanBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-study-plan');
        }, { context: 'Popup', message: 'Error navigating to studyplan.html' }));

        this.dom.pomodoroBtn?.addEventListener('click', withErrorHandling(() => {
            ActionService.executeAction('open-pomodoro');
        }, { context: 'Popup', message: 'Error navigating to pomodoro.html' }));

        this.dom.openSummaryPageBtn?.addEventListener('click', (e: MouseEvent) => {
            e.stopPropagation();
            try {
                ActionService.executeAction('open-summary');
            } catch (err) {
                UIUtils.catchError('Popup', 'Error navigating to summary.html', err);
            }
        });

        // UA-029: Manual Check Reviews Now trigger
        const checkNowBtn = document.getElementById('check-now-btn');
        if (checkNowBtn) {
            checkNowBtn.addEventListener('click', withErrorHandling(async () => {
                checkNowBtn.setAttribute('disabled', 'true');
                chrome.runtime.sendMessage({ action: 'check_due_cards_now' }, (response) => {
                    checkNowBtn.removeAttribute('disabled');
                    if (response && response.success) {
                        const count = typeof response.dueCount === 'number' ? response.dueCount : 0;
                        this.showStatus(`Checked! ${count} review${count === 1 ? '' : 's'} due.`);
                    } else {
                        this.showStatus('Checked for due reviews.');
                    }
                    this.loadAll();
                });
            }, { context: 'Popup', message: 'Error checking due cards manually' }));
        }

        // UA-010: Safari notification capability guard
        if (!BROWSER_CONFIG.supportsNotifications) {
            const notifCard = document.getElementById('notification-settings-card');
            if (notifCard) {
                notifCard.style.display = 'none';
            }
        }
    }

    /**
     * Triggers a status message toast at the top of the popup dashboard.
     * @param {string} msg - Descriptive message string.
     * @param {boolean} [isError=false] - Signals if the status indicates an error.
     */
    @CatchAndLog('Popup', 'Error rendering status toast')
    showStatus(msg: string, isError: boolean = false): void {
        const el = this.dom.statusMsg;
        if (!el) return;

        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }

        const iconHtml = isError
            ? `<svg class="svg-icon" style="stroke: var(--md-danger); width: 14px; height: 14px;" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
            : `<svg class="svg-icon" style="stroke: var(--md-success); width: 14px; height: 14px;" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

        el.innerHTML = iconHtml + `<span>${msg}</span>`;
        el.className = 'toast show ' + (isError ? 'error' : 'success');

        this.statusTimeout = setTimeout(withErrorHandling(() => {
            el.classList.remove('show');
        }, { context: 'Popup', message: 'Error hiding status toast' }), 2500);
    }

    /**
     * Updates visibility of the charts and activity panel in popup.
     */
    updateChartsVisibility(showCharts: boolean): void {
        const card = document.getElementById('activity-charts-card');
        if (card) {
            card.style.display = showCharts ? '' : 'none';
        }
    }

    /**
     * Updates visibility of the Daily Focus & Momentum card in popup.
     */
    updateDailyFocusVisibility(showDailyFocus: boolean): void {
        const card = document.getElementById('daily-focus-card');
        if (card) {
            card.style.display = showDailyFocus ? '' : 'none';
        }
    }
}

/**
 * Initializes the popup dashboard controller when the DOM is ready.
 */
const initPopupDashboard = withErrorHandling((): void => {
    const dashboard = new AlgoRecallDashboard();
    dashboard.init();
}, { context: 'Popup', message: 'Initialization failed' });

if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPopupDashboard);
    } else {
        initPopupDashboard();
    }
}
