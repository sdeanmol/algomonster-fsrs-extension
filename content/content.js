window.AlgoRecall = window.AlgoRecall || {};

/**
 * @class AlgoRecallOrchestrator
 * @description Main content script orchestrator injected into whitelisted coding domains.
 * Initializes settings, cards, and styling configurations from storage, boots the highlighter and tracker UI overlays,
 * registers click triggers for SPA client-side navigations, and monitors DOM updates via MutationObserver.
 */
window.AlgoRecall.Orchestrator = class Orchestrator {
    constructor() {
        this.state = window.AlgoRecall.state;
        this.utils = window.AlgoRecall.Utils;
        this.notifier = window.AlgoRecall.Notifier;
        
        // Instantiate component controllers
        this.highlighter = new window.AlgoRecall.Highlighter();
        this.tracker = new window.AlgoRecall.Tracker();
        
        this.domObserver = null;
    }

    /**
     * Initializes the orchestrator and components.
     */
    async init() {
        chrome.storage.local.get(['fsrsCards', 'fsrsTopicWeights', 'marks', 'bookmarks', 'pagecontents', 'chromeSettings', 'theme', 'whitelistedWebsites', 'fsrsGlobalParams'], (result) => {
            // Verify whitelisting
            const whitelistedWebsites = result.whitelistedWebsites || [
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
                return; // Exit early, disabled by user
            }

            if (result.fsrsGlobalParams) {
                if (result.fsrsGlobalParams.w) this.state.fsrs.w = result.fsrsGlobalParams.w;
                if (result.fsrsGlobalParams.decay !== undefined) this.state.fsrs.decay = result.fsrsGlobalParams.decay;
                if (result.fsrsGlobalParams.factor !== undefined) this.state.fsrs.factor = result.fsrsGlobalParams.factor;
                if (result.fsrsGlobalParams.requestRetention !== undefined) {
                    this.state.fsrs.requestRetention = result.fsrsGlobalParams.requestRetention;
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
    bindEvents() {
        // 1. Hyper-Responsive Click Listener
        document.addEventListener('click', (e) => {
            if (e.target.closest('a, button, [role="button"]')) {
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
    setupMutationObserver() {
        this.domObserver = new MutationObserver(() => {
            clearTimeout(this.state.highlightDebounceTimer);
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
        this.domObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    /**
     * Handles chrome.storage.local modification updates dynamically.
     * @param {Object} changes - Object describing key storage differences.
     * @param {string} areaName - Storage classification bucket name.
     */
    handleStorageChanged(changes, areaName) {
        if (areaName === 'local') {
            if (changes.chromeSettings) {
                this.state.chromeSettings = { ...this.state.chromeSettings, ...changes.chromeSettings.newValue };
                if (!this.state.chromeSettings.showMarkerPopup) {
                    const tooltip = document.getElementById('algo-highlight-tooltip');
                    if (tooltip) tooltip.style.display = 'none';
                }
            }
            if (changes.fsrsCards) {
                this.state.cards = changes.fsrsCards.newValue || [];
                this.tracker.refreshWidgetState();
            }
            if (changes.fsrsTopicWeights) {
                this.state.topicWeights = changes.fsrsTopicWeights.newValue || {};
            }
            if (changes.marks) {
                this.state.marks = changes.marks.newValue || [];
                this.highlighter.applyHighlightsForCurrentPage();
            }
            if (changes.bookmarks) {
                this.state.bookmarks = changes.bookmarks.newValue || [];
            }
            if (changes.pagecontents) {
                this.state.pagecontents = changes.pagecontents.newValue || [];
            }
            if (changes.whitelistedWebsites) {
                const currentDomain = window.location.hostname;
                const whitelistedWebsites = changes.whitelistedWebsites.newValue || [];
                const isWhitelisted = whitelistedWebsites.some(site => currentDomain.includes(site.domain));
                if (!isWhitelisted) {
                    this.highlighter.removeHighlighterUI();
                    this.tracker.removeUI();
                } else {
                    if (!document.getElementById('algo-fsrs-overlay') && document.body) {
                        this.tracker.createUI();
                        this.highlighter.createHighlighterUI();
                    }
                }
            }
            if (changes.fsrsGlobalParams) {
                const params = changes.fsrsGlobalParams.newValue || {};
                if (params.w) this.state.fsrs.w = params.w;
                if (params.decay !== undefined) this.state.fsrs.decay = params.decay;
                if (params.factor !== undefined) this.state.fsrs.factor = params.factor;
                if (params.requestRetention !== undefined) this.state.fsrs.requestRetention = params.requestRetention;
            }
            if (changes.approachDrafts) {
                this.tracker.refreshWidgetState();
            }
            if (changes.theme) {
                this.state.currentTheme = changes.theme.newValue || 'dark';
                this.applyThemeClass();
            }
        }
    }

    /**
     * Handles runtime messages sent from the background worker.
     * @param {Object} request - Messaging payload dictionary.
     * @param {Object} sender - Sender source details metadata.
     * @param {Function} sendResponse - Callback function routing replies.
     */
    handleMessage(request, sender, sendResponse) {
        if (request.action === "spa_url_changed") {
            setTimeout(this.triggerAggressiveUIUpdate.bind(this), 50);
        }
        if (request.action === "show_custom_notification") {
            this.notifier.showPageNotification(request.title, request.message, request.type, request.count);
            if (sendResponse) sendResponse({ success: true });
        }
    }

    /**
     * Centrally updates the floating widgets' layout values when URL adjustments or navigations occur.
     * Restores launcher buttons and re-reads tag configurations.
     */
    triggerAggressiveUIUpdate() {
        this.state.lastCheckedUrl = window.location.href;

        if (!document.getElementById('algo-fsrs-container') && document.body) {
            this.tracker.createUI(); // Inject if the SPA accidentally destroyed it
        } else {
            // Restore launcher display on page transition so it's not permanently lost
            const launcher = document.getElementById('algo-fsrs-launcher');
            const container = document.getElementById('algo-fsrs-container');
            if (launcher && container && container.style.display !== 'block') {
                launcher.style.display = 'flex';
            }

            // Instantly update the contents of the existing widget
            const tagsEl = document.getElementById('fsrs-current-tags');
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
    applyThemeClass() {
        const launcher = document.getElementById('algo-fsrs-launcher');
        const container = document.getElementById('algo-fsrs-container');
        const tooltip = document.getElementById('algo-highlight-tooltip');
        
        const isLight = this.state.currentTheme === 'light';
        
        if (launcher) launcher.classList.toggle('light-theme', isLight);
        if (container) container.classList.toggle('light-theme', isLight);
        if (tooltip) tooltip.classList.toggle('light-theme', isLight);
        
        document.querySelectorAll('.algo-custom-notification').forEach(n => {
            n.classList.toggle('light-theme', isLight);
        });
    }
};

// Auto-run coordinates bootstrapping inside content scope
document.addEventListener('DOMContentLoaded', () => {
    window.AlgoRecall.orchestrator = new window.AlgoRecall.Orchestrator();
    window.AlgoRecall.orchestrator.init();
});

// Fallback if DOMContentLoaded fired early
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    if (!window.AlgoRecall.orchestrator) {
        window.AlgoRecall.orchestrator = new window.AlgoRecall.Orchestrator();
        window.AlgoRecall.orchestrator.init();
    }
}