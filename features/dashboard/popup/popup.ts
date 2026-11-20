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
                        const newTheme = await ActionService.toggleTheme();
                        this.showStatus(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} Mode!`);
                    } catch (error) {
                        UIUtils.catchError('Popup', 'Error toggling theme settings', error);
                    }
                });
            }

            // Floating Highlighter switch setup
            if (this.dom.markerToggle) {
                chrome.storage.local.get(['extensionSettings'], (result: StorageData) => {
                    try {
                        const lastError = typeof chrome !== 'undefined' ? chrome.runtime?.lastError : undefined;
                        if (lastError) {
                            const errorMessage = lastError.message || String(lastError);
                            Logger.error('Popup', `Storage error fetching marker toggle settings: ${errorMessage}`, { error: lastError });
                            return;
                        }
                        if (result.extensionSettings && result.extensionSettings.showMarkerPopup !== undefined && this.dom.markerToggle) {
                            this.dom.markerToggle.checked = result.extensionSettings.showMarkerPopup;
                        }
                    } catch (err) {
                        UIUtils.catchError('Popup', 'Error rendering marker toggle setting', err);
                    }
                });
                this.dom.markerToggle.addEventListener('change', async (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                        const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                        settings.showMarkerPopup = target.checked;
                        await chrome.storage.local.set({ extensionSettings: settings });
                    } catch (error) {
                        UIUtils.catchError('Popup', 'Error setting showMarkerPopup config', error);
                    }
                });
            }

            // Visual charts display switch setup
            if (this.dom.chartsToggle) {
                chrome.storage.local.get(['extensionSettings'], (result: StorageData) => {
                    try {
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
                    } catch (err) {
                        UIUtils.catchError('Popup', 'Error rendering charts toggle setting', err);
                    }
                });
                this.dom.chartsToggle.addEventListener('change', async (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        target.setAttribute('aria-checked', target.checked.toString());
                        this.updateChartsVisibility(target.checked);
                        const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                        const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                        settings.showCharts = target.checked;
                        await chrome.storage.local.set({ extensionSettings: settings });
                        this.showStatus(`Visual charts ${target.checked ? 'enabled' : 'disabled'}!`);
                    } catch (error) {
                        UIUtils.catchError('Popup', 'Error setting showCharts config', error);
                    }
                });
            }

            // Daily Focus & Momentum display switch setup
            if (this.dom.dailyFocusToggle) {
                chrome.storage.local.get(['extensionSettings'], (result: StorageData) => {
                    try {
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
                    } catch (err) {
                        UIUtils.catchError('Popup', 'Error rendering daily focus toggle setting', err);
                    }
                });
                this.dom.dailyFocusToggle.addEventListener('change', async (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        target.setAttribute('aria-checked', target.checked.toString());
                        this.updateDailyFocusVisibility(target.checked);
                        const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                        const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                        settings.showDailyFocus = target.checked;
                        await chrome.storage.local.set({ extensionSettings: settings });
                        this.showStatus(`Daily Focus & Momentum ${target.checked ? 'enabled' : 'hidden'}!`);
                    } catch (error) {
                        UIUtils.catchError('Popup', 'Error setting showDailyFocus config', error);
                    }
                });
            }

            // Problem tracker launcher toggle setup
            if (this.dom.launcherToggle) {
                chrome.storage.local.get(['extensionSettings'], (result: StorageData) => {
                    try {
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
                    } catch (err) {
                        UIUtils.catchError('Popup', 'Error rendering launcher toggle setting', err);
                    }
                });
                this.dom.launcherToggle.addEventListener('change', async (e: Event) => {
                    try {
                        const target = e.target as HTMLInputElement;
                        target.setAttribute('aria-checked', target.checked.toString());
                        const result = (await chrome.storage.local.get(['extensionSettings'])) as StorageData;
                        const settings: ExtensionSettings = result.extensionSettings || { defaultHighlightColor: '#f1c40f', recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'] };
                        settings.showLauncher = target.checked;
                        await chrome.storage.local.set({ extensionSettings: settings });
                        this.showStatus(`Problem tracker launcher ${target.checked ? 'enabled' : 'disabled'}!`);
                    } catch (error) {
                        UIUtils.catchError('Popup', 'Error setting showLauncher config', error);
                    }
                });
            }

            // Developer mode display switch setup
            if (this.dom.devModeToggle) {
                chrome.storage.local.get(['extensionSettings'], (result: StorageData) => {
                    try {
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
                    } catch (err) {
                        UIUtils.catchError('Popup', 'Error rendering dev mode toggle setting', err);
                    }
                });
                this.dom.devModeToggle.addEventListener('change', async (e: Event) => {
                    try {
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

            // Navigation and Tool Actions
            this.dom.helpBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-help');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to help.html', err);
                }
            });

            this.dom.historyBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-history');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to history.html', err);
                }
            });

            this.dom.openHeatmapTabBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-heatmap');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to heatmap.html', err);
                }
            });

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

            addAccessibleClick(this.dom.boxTotal, () => {
                try {
                    ActionService.executeAction('view-all-cards');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to total data view', err);
                }
            });

            addAccessibleClick(this.dom.boxDue, () => {
                try {
                    ActionService.executeAction('view-due-cards');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to due data view', err);
                }
            });

            addAccessibleClick(this.dom.boxRetention, () => {
                try {
                    ActionService.executeAction('view-retention-cards');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to retention data view', err);
                }
            });

            this.dom.manageHighlightsBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-highlights-manager');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to highlights.html', err);
                }
            });

            this.dom.openOptionsBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-highlights-options');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to highlightOptions.html', err);
                }
            });

            const openAnalyticsTab = () => {
                try {
                    ActionService.executeAction('open-analytics');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to analytics.html', err);
                }
            };
            this.dom.analyticsBtn?.addEventListener('click', openAnalyticsTab);
            this.dom.headerAnalyticsBtn?.addEventListener('click', openAnalyticsTab);

            this.dom.settingsHubBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-settings');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to settings.html', err);
                }
            });

            this.dom.forecastBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-forecast');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to forecast.html', err);
                }
            });

            this.dom.achievementsBtn?.addEventListener('click', () => {
                try {
                    this.stats.bindAchievementsModal();
                    const openBtn = document.getElementById('achievements-open-btn');
                    if (openBtn) {
                        openBtn.click();
                    } else {
                        const modal = document.getElementById('achievements-modal');
                        modal?.classList.remove('hide-panel');
                    }
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error opening achievements dialog', err);
                }
            });

            this.dom.studyplanBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-study-plan');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to studyplan.html', err);
                }
            });

            this.dom.pomodoroBtn?.addEventListener('click', () => {
                try {
                    ActionService.executeAction('open-pomodoro');
                } catch (err) {
                    UIUtils.catchError('Popup', 'Error navigating to pomodoro.html', err);
                }
            });

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
                checkNowBtn.addEventListener('click', async () => {
                    try {
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
                    } catch (err) {
                        checkNowBtn.removeAttribute('disabled');
                        UIUtils.catchError('Popup', 'Error checking due cards manually', err);
                    }
                });
            }

            // UA-010: Safari notification capability guard
            if (!BROWSER_CONFIG.supportsNotifications) {
                const notifCard = document.getElementById('notification-settings-card');
                if (notifCard) {
                    notifCard.style.display = 'none';
                }
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
            el.className = 'toast show ' + (isError ? 'error' : 'success');

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
