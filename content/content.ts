import { Logger } from '@common/logger';
import '../features/common/markdown';
import '../features/tracker/scheduler/scheduler';
import './state';
import './utils';
import '../features/highlighter/highlighter';
import './notifications';
import '../features/tracker/tracker';
import { Card, StorageData, ExtensionMessage, MessageResponse, FSRSParameters, HighlightMark, BookmarkItem } from '../types/domain';
import { AlgoRecallState, getAlgoRecallGlobal, DEFAULT_PALETTES } from './state';
import { Utils } from './utils';
import { Notifier } from './notifications';
import { Highlighter } from '../features/highlighter/highlighter';
import Tracker from '../features/tracker/tracker';
import { DEFAULT_WHITELISTED_WEBSITES } from '../features/common/constants';

/**
 * @class AlgoRecallOrchestrator
 * @description Main content script orchestrator injected into whitelisted coding domains.
 * Initializes settings, cards, and styling configurations from storage, boots the highlighter and tracker UI overlays,
 * registers click triggers for SPA client-side navigations, and monitors DOM updates via MutationObserver.
 */
export class AlgoRecallOrchestrator {
    state: AlgoRecallState;
    utils: typeof Utils;
    notifier: typeof Notifier;
    highlighter: Highlighter;
    tracker: Tracker;
    domObserver: MutationObserver | null;

    constructor() {
        Logger.info('ContentScript', 'Orchestrator initializing...');
        const algoGlobal = getAlgoRecallGlobal();
        this.state = algoGlobal.state as AlgoRecallState;
        this.utils = algoGlobal.Utils || Utils;
        this.notifier = algoGlobal.Notifier || Notifier;

        // Instantiate component controllers
        const HighlighterClass = algoGlobal.Highlighter || Highlighter;
        const TrackerClass = algoGlobal.Tracker || Tracker;
        this.highlighter = new HighlighterClass();
        this.tracker = new TrackerClass();

        this.domObserver = null;
    }

    /**
     * Initializes the orchestrator and components.
     */
    async init(): Promise<void> {
        Logger.time('ContentScript', 'Init Storage Load');
        try {
            if (typeof chrome === 'undefined' || !chrome.storage || !chrome.storage.local || !chrome.runtime) {
                Logger.warn('ContentScript', 'Extension context invalid or chrome APIs unavailable during init.');
                Logger.timeEnd('ContentScript', 'Init Storage Load');
                return;
            }
            chrome.storage.local.get(['fsrsCards', 'fsrsTopicWeights', 'marks', 'bookmarks', 'pagecontents', 'chromeSettings', 'theme', 'whitelistedWebsites', 'fsrsGlobalParams'], (result: StorageData & {
                marks?: HighlightMark[];
                bookmarks?: BookmarkItem[];
                pagecontents?: unknown[];
                whitelistedWebsites?: Array<{ domain: string }>;
            }) => {
                try {
                    if (chrome.runtime.lastError) {
                        const errorMessage = chrome.runtime.lastError.message || String(chrome.runtime.lastError);
                        Logger.error('ContentScript', `Chrome storage error in init: ${errorMessage}`, { error: chrome.runtime.lastError });
                        return;
                    }
                    // Verify whitelisting
                    const whitelistedWebsites: Array<{ domain: string }> = result.whitelistedWebsites || DEFAULT_WHITELISTED_WEBSITES;

                    const currentDomain = window.location.hostname;
                    const isWhitelisted = whitelistedWebsites.some(site => currentDomain.includes(site.domain));
                    if (!isWhitelisted) {
                        Logger.info('ContentScript', `Domain ${currentDomain} is not whitelisted. Exiting.`);
                        return; // Exit early, disabled by user
                    }
                    Logger.debug('ContentScript', `Domain ${currentDomain} is whitelisted. Proceeding with init.`);

                    if (result.fsrsGlobalParams) {
                        this.applyFsrsGlobalParams(result.fsrsGlobalParams as Partial<FSRSParameters>);
                    }

                    if (result.fsrsCards) this.state.cards = result.fsrsCards;
                    if (result.fsrsTopicWeights) this.state.topicWeights = result.fsrsTopicWeights;

                    if (result.marks) this.state.marks = result.marks;
                    if (result.bookmarks) this.state.bookmarks = result.bookmarks;
                    if (result.pagecontents) this.state.pagecontents = result.pagecontents;
                    if (result.theme) this.state.currentTheme = result.theme;
                    if (result.chromeSettings) {
                        this.state.chromeSettings = { ...this.state.chromeSettings, ...result.chromeSettings };
                    }
                    // Ensure palettes are initialized
                    if (!this.state.chromeSettings.palettes || this.state.chromeSettings.palettes.length === 0) {
                        this.state.chromeSettings.palettes = DEFAULT_PALETTES;
                        this.state.chromeSettings.activePaletteIndex = 0;
                    }

                    // Create Highlighter & Tracker UI elements
                    this.tracker.createUI();
                    this.highlighter.createHighlighterUI();
                    this.highlighter.applyHighlightsForCurrentPage();

                    this.bindEvents();
                    this.setupMutationObserver();
                } catch (innerErr) {
                    const errorMessage = innerErr instanceof Error ? innerErr.message : String(innerErr);
                    Logger.error('ContentScript', `Error processing storage data in init: ${errorMessage}`, { innerErr });
                    // Comment: Recover gracefully so host page is not disrupted
                } finally {
                    // Comment: Always end performance timer for storage load init regardless of inner outcome
                    Logger.timeEnd('ContentScript', 'Init Storage Load');
                }
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ContentScript', `Error in orchestrator init: ${errorMessage}`, { err });
            Logger.timeEnd('ContentScript', 'Init Storage Load');
            // Comment: Catch storage retrieval failure gracefully
        }
    }

    /**
     * Binds general orchestrator events, click/messaging/storage listeners.
     */
    bindEvents(): void {
        try {
            // 1. Hyper-Responsive Click Listener
            document.addEventListener('click', (e: MouseEvent) => {
                try {
                    const target = e.target as HTMLElement | null;
                    if (target && target.closest('a, button, [role="button"]')) {
                        setTimeout(() => {
                            try {
                                this.triggerAggressiveUIUpdate();
                            } catch (err) {
                                const errorMessage = err instanceof Error ? err.message : String(err);
                                Logger.error('ContentScript', `Error in click update timeout 50ms: ${errorMessage}`, { err });
                            }
                        }, 50);
                        setTimeout(() => {
                            try {
                                this.triggerAggressiveUIUpdate();
                            } catch (err) {
                                const errorMessage = err instanceof Error ? err.message : String(err);
                                Logger.error('ContentScript', `Error in click update timeout 400ms: ${errorMessage}`, { err });
                            }
                        }, 400);
                    }
                } catch (err) {
                    // Comment: Recover from click listener target check error to prevent breaking host page clicks
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('ContentScript', `Error in click listener: ${errorMessage}`, { err });
                }
            });

            // 2. Storage Changed Listener
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
                chrome.storage.onChanged.addListener(this.handleStorageChanged.bind(this));
            }

            // 3. Message Listener
            if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
                chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ContentScript', `Error binding orchestrator events: ${errorMessage}`, { err });
            // Comment: Catch event registration error to prevent stopping script injection
        }
    }

    /**
     * Sets up the DOM observer to watch for React component re-rendering/navigations.
     */
    setupMutationObserver(): void {
        try {
            if (this.domObserver) {
                try {
                    this.domObserver.disconnect();
                } catch (disconnectErr) {
                    const errorMessage = disconnectErr instanceof Error ? disconnectErr.message : String(disconnectErr);
                    Logger.debug('ContentScript', `Safe disconnect cleanup if observer was already stopped: ${errorMessage}`, { disconnectErr });
                }
                this.domObserver = null;
            }
            this.domObserver = new MutationObserver(() => {
                if (this.state.highlightDebounceTimer) clearTimeout(this.state.highlightDebounceTimer);
                this.state.highlightDebounceTimer = setTimeout(() => {
                    try {
                        this.highlighter.applyHighlightsForCurrentPage();

                        // If client-side routing/hydration wiped out our elements, re-inject them
                        if (document.body) {
                            if (!document.getElementById('algo-fsrs-launcher')) {
                                this.tracker.createUI();
                            }
                            if (!document.getElementById('algo-highlight-tooltip')) {
                                this.highlighter.createHighlighterUI();
                            }
                        }

                        // If the URL changed without a click, force an update
                        if (window.location.href !== this.state.lastCheckedUrl) {
                            this.triggerAggressiveUIUpdate();
                        }
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('ContentScript', `Error in mutation observer callback: ${errorMessage}`, { err });
                        // Comment: Non-fatal DOM observer error recovery
                    }
                }, 100);
            });
            if (document.body) {
                try {
                    this.domObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.error('ContentScript', `Failed to attach mutation observer: ${errorMessage}`, { err });
                    // Comment: Catch observer attachment error if document.body is invalid
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ContentScript', `Failed to set up mutation observer: ${errorMessage}`, { err });
            // Comment: Safe recovery when setting up mutation observer
        }
    }

    /**
     * Handles chrome.storage.local modification updates dynamically.
     * @param {Object} changes - Object describing key storage differences.
     * @param {string} areaName - Storage classification bucket name.
     */
    handleStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void {
        try {
            const changedKeys = Object.keys(changes).filter(key => key !== 'debugLogs');
            if (changedKeys.length > 0) {
                Logger.debug('ContentScript', `Storage changed in ${areaName}`, changedKeys);
            }
            if (areaName === 'local') {
                if (changes.chromeSettings) {
                    this.state.chromeSettings = { ...this.state.chromeSettings, ...changes.chromeSettings.newValue };
                    const tooltip = document.getElementById('algo-highlight-tooltip') as HTMLElement | null;
                    if (!this.state.chromeSettings.showMarkerPopup) {
                        if (tooltip) tooltip.style.display = 'none';
                    } else {
                        // Automatically show the tooltip if text is already selected on the page
                        const selection = window.getSelection();
                        if (selection && !selection.isCollapsed && selection.toString().trim() !== '' && tooltip && tooltip.style.display === 'none') {
                            const range = selection.getRangeAt(0);
                            const rects = range.getClientRects();
                            let lastRect = rects.length > 0 ? rects[rects.length - 1] : null;
                            if (!lastRect) {
                                const bounding = range.getBoundingClientRect();
                                if (bounding && (bounding.width > 0 || bounding.height > 0)) lastRect = bounding;
                            }
                            if (lastRect) {
                                this.highlighter.renderTooltipColors(null, null);
                                tooltip.style.display = 'flex';
                                tooltip.style.left = `${lastRect.right + window.scrollX}px`;
                                tooltip.style.top = `${lastRect.bottom + window.scrollY}px`;
                            }
                        }
                    }
                }
                if (changes.fsrsCards) {
                    this.state.cards = (changes.fsrsCards.newValue as Card[]) || [];
                    this.tracker.refreshWidgetState();
                }
                if (changes.fsrsTopicWeights) {
                    this.state.topicWeights = (changes.fsrsTopicWeights.newValue as Record<string, number[]>) || {};
                }
                if (changes.marks) {
                    this.state.marks = (changes.marks.newValue as HighlightMark[]) || [];
                    this.highlighter.applyHighlightsForCurrentPage();
                }
                if (changes.bookmarks) {
                    this.state.bookmarks = (changes.bookmarks.newValue as BookmarkItem[]) || [];
                }
                if (changes.pagecontents) {
                    this.state.pagecontents = (changes.pagecontents.newValue as unknown[]) || [];
                }
                if (changes.whitelistedWebsites) {
                    const currentDomain = window.location.hostname;
                    const whitelistedWebsites: Array<{ domain: string }> = (changes.whitelistedWebsites.newValue as Array<{ domain: string }>) || DEFAULT_WHITELISTED_WEBSITES;
                    const isWhitelisted = whitelistedWebsites.some(site => currentDomain.includes(site.domain));
                    if (!isWhitelisted) {
                        this.highlighter.removeHighlighterUI();
                        (this.tracker as unknown as { removeUI?: () => void }).removeUI?.();
                    } else {
                        if (!document.getElementById('algo-fsrs-overlay') && document.body) {
                            this.tracker.createUI();
                            this.highlighter.createHighlighterUI();
                        }
                    }
                }
                if (changes.fsrsGlobalParams) {
                    this.applyFsrsGlobalParams((changes.fsrsGlobalParams.newValue || {}) as Partial<FSRSParameters>);
                }
                if (changes.approachDrafts) {
                    this.tracker.refreshWidgetState();
                }
                if (changes.theme) {
                    this.state.currentTheme = (changes.theme.newValue as string) || 'dark';
                    this.applyThemeClass();
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ContentScript', `Error handling storage change: ${errorMessage}`, { changes, areaName, err });
            // Comment: Non-fatal storage change sync failure
        }
    }

    /**
     * Handles runtime messages sent from the background worker.
     * @param {ExtensionMessage} request - Messaging payload dictionary.
     * @param {chrome.runtime.MessageSender} sender - Sender source details metadata.
     * @param {Function} sendResponse - Callback function routing replies.
     */
    handleMessage(request: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: MessageResponse) => void): boolean | void {
        try {
            Logger.debug('ContentScript', `Received message: ${request.action}`);
            if (request.action === "spa_url_changed") {
                setTimeout(() => {
                    try {
                        this.triggerAggressiveUIUpdate();
                    } catch (err) {
                        const errorMessage = err instanceof Error ? err.message : String(err);
                        Logger.error('ContentScript', `Error in spa_url_changed update timeout: ${errorMessage}`, { err });
                    }
                }, 50);
            }
            if (request.action === "show_custom_notification") {
                try {
                    this.notifier.showPageNotification((request.title as string) || '', (request.message as string) || '', (request.type as string) || '', request.count as number | undefined);
                    if (sendResponse) sendResponse({ success: true });
                } catch (e) {
                    const errorObj = e instanceof Error ? e : new Error(String(e));
                    Logger.error('ContentScript', 'Failed to show page notification', { error: errorObj.message });
                    if (sendResponse) sendResponse({ success: false, error: errorObj.message });
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ContentScript', `Error handling content script message '${request?.action}': ${errorMessage}`, { request, err });
            if (sendResponse) sendResponse({ success: false, error: errorMessage });
        }
    }

    /**
     * Centrally updates the floating widgets' layout values when URL adjustments or navigations occur.
     * Restores launcher buttons and re-reads tag configurations.
     */
    triggerAggressiveUIUpdate(): void {
        try {
            this.state.lastCheckedUrl = window.location.href;

            if (!document.getElementById('algo-fsrs-container') && document.body) {
                this.tracker.createUI(); // Inject if the SPA accidentally destroyed it
            } else {
                // Restore launcher display on page transition so it's not permanently lost
                const launcher = document.getElementById('algo-fsrs-launcher') as HTMLElement | null;
                const container = document.getElementById('algo-fsrs-container') as HTMLElement | null;
                if (launcher && container && container.style.display !== 'block') {
                    launcher.style.display = 'flex';
                }

                // Instantly update the contents of the existing widget
                const tagsEl = document.getElementById('fsrs-current-tags') as HTMLElement | null;
                if (tagsEl) {
                    tagsEl.innerText = this.utils.getAutoTags().join(', ');
                }
                this.tracker.refreshWidgetState();
            }
            this.highlighter.applyHighlightsForCurrentPage();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ContentScript', `Error triggering UI update: ${errorMessage}`, { err });
            // Comment: Non-fatal UI refresh error on page navigation
        }
    }

    /**
     * Updates visual class names (light-theme toggle) on active extension container elements
     * to match the user's color scheme settings.
     */
    applyThemeClass(): void {
        try {
            const launcher = document.getElementById('algo-fsrs-launcher') as HTMLElement | null;
            const container = document.getElementById('algo-fsrs-container') as HTMLElement | null;
            const tooltip = document.getElementById('algo-highlight-tooltip') as HTMLElement | null;

            const isLight = this.state.currentTheme === 'light';

            if (launcher) launcher.classList.toggle('light-theme', isLight);
            if (container) container.classList.toggle('light-theme', isLight);
            if (tooltip) tooltip.classList.toggle('light-theme', isLight);

            document.querySelectorAll('.algo-custom-notification').forEach((n: Element) => {
                n.classList.toggle('light-theme', isLight);
            });
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ContentScript', `Error applying theme class: ${errorMessage}`, { err });
            // Comment: Catch theme class DOM updates error gracefully
        }
    }

    /**
     * Centralized helper to apply global FSRS scheduling parameters
     */
    private applyFsrsGlobalParams(params: Partial<FSRSParameters>): void {
        if (!params || !this.state.scheduler) return;
        const scheduler = this.state.scheduler as unknown as { w?: number[], decay?: number, factor?: number, requestRetention?: number };
        if (params.w !== undefined) scheduler.w = params.w;
        if (params.decay !== undefined) scheduler.decay = params.decay;
        if (params.factor !== undefined) scheduler.factor = params.factor;
        if (params.requestRetention !== undefined) scheduler.requestRetention = params.requestRetention;
    }
}

try {
    getAlgoRecallGlobal().Orchestrator = AlgoRecallOrchestrator;
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('ContentScript', `Failed to assign Orchestrator on window global scope: ${errorMessage}`, { err });
}

// Auto-run coordinates bootstrapping inside content scope
document.addEventListener('DOMContentLoaded', () => {
    try {
        const algoGlobal = getAlgoRecallGlobal();
        algoGlobal.orchestrator = new AlgoRecallOrchestrator();
        algoGlobal.orchestrator.init();
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('ContentScript', `Error during DOMContentLoaded orchestrator boot: ${errorMessage}`, { err });
    }
});

// Fallback if DOMContentLoaded fired early
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    try {
        const algoGlobal = getAlgoRecallGlobal();
        if (!algoGlobal.orchestrator) {
            algoGlobal.orchestrator = new AlgoRecallOrchestrator();
            algoGlobal.orchestrator.init();
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('ContentScript', `Error during readyState orchestrator fallback boot: ${errorMessage}`, { err });
    }
}

// Global Error Handlers for Content Script Isolation
window.addEventListener('error', function (event: ErrorEvent) {
    try {
        if (event.filename && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && event.filename.includes(chrome.runtime.id)) {
            Logger.error('ContentScript', 'Unhandled runtime error', { message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno, error: event.error });
        }
    } catch (err) {
        // Comment: Suppress recursive logging error during window error handler
        console.warn('[AlgoRecall] Suppressed error in window error handler:', err);
    }
});

window.addEventListener('unhandledrejection', function (event: PromiseRejectionEvent) {
    try {
        Logger.error('ContentScript', 'Unhandled promise rejection', { reason: event?.reason });
    } catch (err) {
        // Comment: Suppress recursive logging error during window unhandled rejection handler
        console.warn('[AlgoRecall] Suppressed error in window unhandledrejection handler:', err);
    }
});
