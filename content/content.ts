import '../features/common/logger';
import '../features/common/markdown';
import '../features/tracker/scheduler/scheduler';
import './state';
import './utils';
import '../features/highlighter/highlighter';
import './notifications';
import '../features/tracker/tracker';
import { Card, StorageData, ExtensionMessage, MessageResponse, FSRSParameters } from '../types/domain';
import { AlgoRecallState } from './state';
import { Utils } from './utils';
import { Notifier } from './notifications';
import { Highlighter } from '../features/highlighter/highlighter';
import Tracker from '../features/tracker/tracker';
import { LoggerClass } from '../features/common/logger';

interface AlgoRecallGlobal {
    state?: AlgoRecallState;
    Utils?: typeof Utils;
    Notifier?: typeof Notifier;
    Highlighter?: new () => Highlighter;
    Tracker?: new () => Tracker;
    Orchestrator?: typeof AlgoRecallOrchestrator;
    orchestrator?: AlgoRecallOrchestrator;
}

function getAlgoRecallGlobal(): AlgoRecallGlobal {
    const win = window as unknown as { AlgoRecall: AlgoRecallGlobal };
    win.AlgoRecall = win.AlgoRecall || {};
    return win.AlgoRecall;
}

function getLogger(): LoggerClass | undefined {
    return (window as unknown as { Logger?: LoggerClass }).Logger;
}

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
        const logger = getLogger();
        if (logger) {
            logger.info('ContentScript', 'Orchestrator initializing...');
        }
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
        const logger = getLogger();
        if (logger) logger.time('ContentScript', 'Init Storage Load');
        chrome.storage.local.get(['fsrsCards', 'fsrsTopicWeights', 'marks', 'bookmarks', 'pagecontents', 'chromeSettings', 'theme', 'whitelistedWebsites', 'fsrsGlobalParams'], (result: StorageData & {
            marks?: unknown[];
            bookmarks?: unknown[];
            pagecontents?: unknown[];
            whitelistedWebsites?: Array<{ domain: string }>;
        }) => {
            if (logger) logger.timeEnd('ContentScript', 'Init Storage Load');
            // Verify whitelisting
            const whitelistedWebsites: Array<{ domain: string }> = result.whitelistedWebsites || [
                { domain: "algo.monster" },
                { domain: "systemdesignschool.io" },
                { domain: "codeforces.com" },
                { domain: "leetcode.com" },
                { domain: "codechef.com" },
                { domain: "atcoder.jp" },
                { domain: "hackerrank.com" },
                { domain: "hackerearth.com" },
                { domain: "codewars.com" },
                { domain: "codingame.com" }
            ];

            const currentDomain = window.location.hostname;
            const isWhitelisted = whitelistedWebsites.some(site => currentDomain.includes(site.domain));
            if (!isWhitelisted) {
                if (logger) logger.info('ContentScript', `Domain ${currentDomain} is not whitelisted. Exiting.`);
                return; // Exit early, disabled by user
            }
            if (logger) logger.debug('ContentScript', `Domain ${currentDomain} is whitelisted. Proceeding with init.`);

            if (result.fsrsGlobalParams) {
                const params = result.fsrsGlobalParams as Partial<FSRSParameters>;
                if (params.w && this.state.scheduler) (this.state.scheduler as unknown as { w: number[] }).w = params.w;
                if (params.decay !== undefined && this.state.scheduler) (this.state.scheduler as unknown as { decay: number }).decay = params.decay;
                if (params.factor !== undefined && this.state.scheduler) (this.state.scheduler as unknown as { factor: number }).factor = params.factor;
                if (params.requestRetention !== undefined && this.state.scheduler) {
                    (this.state.scheduler as unknown as { requestRetention: number }).requestRetention = params.requestRetention;
                }
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
                this.state.chromeSettings.palettes = [
                    { name: 'Default', colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] },
                    { name: 'Warm Pastels', colors: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff'] },
                    { name: 'Ocean Breeze', colors: ['#a8dadc', '#457b9d', '#1d3557', '#e63946', '#f1faee'] },
                    { name: 'Forest Moss', colors: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'] },
                    { name: 'Sunset Glow', colors: ['#f72585', '#7209b7', '#3f0712', '#f77f00', '#fcbf49'] }
                ];
                this.state.chromeSettings.activePaletteIndex = 0;
            }

            // Create Highlighter & Tracker UI elements
            this.tracker.createUI();
            this.highlighter.createHighlighterUI();
            this.highlighter.applyHighlightsForCurrentPage();

            this.bindEvents();
            this.setupMutationObserver();
        });
    }

    /**
     * Binds general orchestrator events, click/messaging/storage listeners.
     */
    bindEvents(): void {
        // 1. Hyper-Responsive Click Listener
        document.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && target.closest('a, button, [role="button"]')) {
                setTimeout(this.triggerAggressiveUIUpdate.bind(this), 50);
                setTimeout(this.triggerAggressiveUIUpdate.bind(this), 400);
            }
        });

        // 2. Storage Changed Listener
        chrome.storage.onChanged.addListener(this.handleStorageChanged.bind(this));

        // 3. Message Listener
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    }

    /**
     * Sets up the DOM observer to watch for React component re-rendering/navigations.
     */
    setupMutationObserver(): void {
        this.domObserver = new MutationObserver(() => {
            if (this.state.highlightDebounceTimer) clearTimeout(this.state.highlightDebounceTimer);
            this.state.highlightDebounceTimer = setTimeout(() => {
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
            }, 100);
        });
        if (document.body) {
            this.domObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
        }
    }

    /**
     * Handles chrome.storage.local modification updates dynamically.
     * @param {Object} changes - Object describing key storage differences.
     * @param {string} areaName - Storage classification bucket name.
     */
    handleStorageChanged(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string): void {
        const logger = getLogger();
        const changedKeys = Object.keys(changes).filter(key => key !== 'debugLogs');
        if (changedKeys.length > 0 && logger) {
            logger.debug('ContentScript', `Storage changed in ${areaName}`, changedKeys);
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
                this.state.marks = (changes.marks.newValue as unknown[]) || [];
                this.highlighter.applyHighlightsForCurrentPage();
            }
            if (changes.bookmarks) {
                this.state.bookmarks = (changes.bookmarks.newValue as unknown[]) || [];
            }
            if (changes.pagecontents) {
                this.state.pagecontents = (changes.pagecontents.newValue as unknown[]) || [];
            }
            if (changes.whitelistedWebsites) {
                const currentDomain = window.location.hostname;
                const whitelistedWebsites: Array<{ domain: string }> = (changes.whitelistedWebsites.newValue as Array<{ domain: string }>) || [
                    { domain: "algo.monster" },
                    { domain: "systemdesignschool.io" },
                    { domain: "codeforces.com" },
                    { domain: "leetcode.com" },
                    { domain: "codechef.com" },
                    { domain: "atcoder.jp" },
                    { domain: "hackerrank.com" },
                    { domain: "hackerearth.com" },
                    { domain: "codewars.com" },
                    { domain: "codingame.com" }
                ];
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
                const params = (changes.fsrsGlobalParams.newValue || {}) as Partial<FSRSParameters>;
                if (params.w && this.state.scheduler) (this.state.scheduler as unknown as { w: number[] }).w = params.w;
                if (params.decay !== undefined && this.state.scheduler) (this.state.scheduler as unknown as { decay: number }).decay = params.decay;
                if (params.factor !== undefined && this.state.scheduler) (this.state.scheduler as unknown as { factor: number }).factor = params.factor;
                if (params.requestRetention !== undefined && this.state.scheduler) (this.state.scheduler as unknown as { requestRetention: number }).requestRetention = params.requestRetention;
            }
            if (changes.approachDrafts) {
                this.tracker.refreshWidgetState();
            }
            if (changes.theme) {
                this.state.currentTheme = (changes.theme.newValue as string) || 'dark';
                this.applyThemeClass();
            }
        }
    }

    /**
     * Handles runtime messages sent from the background worker.
     * @param {ExtensionMessage} request - Messaging payload dictionary.
     * @param {chrome.runtime.MessageSender} sender - Sender source details metadata.
     * @param {Function} sendResponse - Callback function routing replies.
     */
    handleMessage(request: ExtensionMessage, sender: chrome.runtime.MessageSender, sendResponse: (response?: MessageResponse) => void): boolean | void {
        const logger = getLogger();
        if (logger) logger.debug('ContentScript', `Received message: ${request.action}`);
        if (request.action === "spa_url_changed") {
            setTimeout(this.triggerAggressiveUIUpdate.bind(this), 50);
        }
        if (request.action === "show_custom_notification") {
            try {
                this.notifier.showPageNotification((request.title as string) || '', (request.message as string) || '', (request.type as string) || '', request.count as number | undefined);
                if (sendResponse) sendResponse({ success: true });
            } catch (e) {
                const errorObj = e instanceof Error ? e : new Error(String(e));
                if (logger) logger.error('ContentScript', 'Failed to show page notification', errorObj);
                if (sendResponse) sendResponse({ success: false, error: errorObj.message });
            }
        }
    }

    /**
     * Centrally updates the floating widgets' layout values when URL adjustments or navigations occur.
     * Restores launcher buttons and re-reads tag configurations.
     */
    triggerAggressiveUIUpdate(): void {
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
    }

    /**
     * Updates visual class names (light-theme toggle) on active extension container elements
     * to match the user's color scheme settings.
     */
    applyThemeClass(): void {
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
    }
}

getAlgoRecallGlobal().Orchestrator = AlgoRecallOrchestrator;

// Auto-run coordinates bootstrapping inside content scope
document.addEventListener('DOMContentLoaded', () => {
    const algoGlobal = getAlgoRecallGlobal();
    algoGlobal.orchestrator = new AlgoRecallOrchestrator();
    algoGlobal.orchestrator.init();
});

// Fallback if DOMContentLoaded fired early
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    const algoGlobal = getAlgoRecallGlobal();
    if (!algoGlobal.orchestrator) {
        algoGlobal.orchestrator = new AlgoRecallOrchestrator();
        algoGlobal.orchestrator.init();
    }
}

// Global Error Handlers for Content Script Isolation
window.addEventListener('error', function(event: ErrorEvent) {
    const logger = getLogger();
    if (logger && event.filename && event.filename.includes(chrome.runtime.id)) {
        logger.error('ContentScript', 'Unhandled runtime error', { message: event.message, filename: event.filename, lineno: event.lineno, colno: event.colno, error: event.error });
    }
});

window.addEventListener('unhandledrejection', function(event: PromiseRejectionEvent) {
    const logger = getLogger();
    if (logger) {
        logger.error('ContentScript', 'Unhandled promise rejection', event.reason);
    }
});
