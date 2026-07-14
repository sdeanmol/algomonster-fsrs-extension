/**
 * @file content/content.js
 * @description Main content script orchestrator injected into whitelisted coding domains.
 * Initializes settings, cards, and styling configurations from storage, boots the highlighter and tracker UI overlays,
 * registers click triggers for SPA client-side navigations, and monitors DOM updates via MutationObserver.
 * Upstream dependencies: content/state.js, content/utils.js, features/highlighter/highlighter.js, content/notifications.js, features/tracker/tracker.js.
 * Downstream dependencies: background/background.js (via chrome.runtime messaging).
 */

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
        if (result.fsrsGlobalParams.w) fsrs.w = result.fsrsGlobalParams.w;
        if (result.fsrsGlobalParams.decay !== undefined) fsrs.decay = result.fsrsGlobalParams.decay;
        if (result.fsrsGlobalParams.factor !== undefined) fsrs.factor = result.fsrsGlobalParams.factor;
        if (result.fsrsGlobalParams.requestRetention !== undefined) {
            fsrs.requestRetention = result.fsrsGlobalParams.requestRetention;
        }
    }

    if (result.fsrsCards) cards = result.fsrsCards;
    if (result.fsrsTopicWeights) topicWeights = result.fsrsTopicWeights;

    if (result.marks) marks = result.marks;
    if (result.bookmarks) bookmarks = result.bookmarks;
    if (result.pagecontents) pagecontents = result.pagecontents;
    if (result.theme) currentTheme = result.theme;
    if (result.chromeSettings) {
        chromeSettings = { ...chromeSettings, ...result.chromeSettings };
    }
    // Ensure palettes are initialized
    if (!chromeSettings.palettes || chromeSettings.palettes.length === 0) {
        chromeSettings.palettes = [
            { name: 'Default', colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] },
            { name: 'Warm Pastels', colors: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff'] },
            { name: 'Ocean Breeze', colors: ['#a8dadc', '#457b9d', '#1d3557', '#e63946', '#f1faee'] },
            { name: 'Forest Moss', colors: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'] },
            { name: 'Sunset Glow', colors: ['#f72585', '#7209b7', '#3f0712', '#f77f00', '#fcbf49'] }
        ];
        chromeSettings.activePaletteIndex = 0;
    }

    createUI();
    createHighlighterUI();
    applyHighlightsForCurrentPage();

    // 1. Hyper-Responsive Click Listener
    // Instantly intercepts any click on a link or button to force an immediate widget refresh
    document.addEventListener('click', (e) => {
        if (e.target.closest('a, button, [role="button"]')) {
            // Fire immediately to catch fast SPA transitions
            setTimeout(triggerAggressiveUIUpdate, 50);
            // Fire again shortly after in case the SPA had to fetch data over the network
            setTimeout(triggerAggressiveUIUpdate, 400);
        }
    });

    // 2. Hydration Observer (Updates FSRS UI if the URL secretly changed via scroll or DOM wiped by React)
    const domObserver = new MutationObserver(() => {
        clearTimeout(highlightDebounceTimer);
        highlightDebounceTimer = setTimeout(() => {
            applyHighlightsForCurrentPage();
            
            // If client-side routing/hydration wiped out our elements, re-inject them
            if (document.body) {
                if (!document.getElementById('algo-fsrs-launcher')) {
                    createUI();
                }
                if (!document.getElementById('algo-highlight-tooltip')) {
                    createHighlighterUI();
                }
            }
            
            // If the URL changed without a click, force an update
            if (window.location.href !== lastCheckedUrl) {
                triggerAggressiveUIUpdate();
            }
        }, 100);
    });
    domObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        if (changes.chromeSettings) {
            chromeSettings = { ...chromeSettings, ...changes.chromeSettings.newValue };
            if (!chromeSettings.showMarkerPopup) {
                const tooltip = document.getElementById('algo-highlight-tooltip');
                if (tooltip) tooltip.style.display = 'none';
            }
        }
        if (changes.fsrsCards) {
            cards = changes.fsrsCards.newValue || [];
            refreshWidgetState();
        }
        if (changes.approachDrafts) {
            refreshWidgetState();
        }
    }
});

// Listen for SPA URL changes directly from Chrome Background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "spa_url_changed") {
        setTimeout(triggerAggressiveUIUpdate, 50);
    }
    if (request.action === "show_custom_notification") {
        showInPageNotification(request.title, request.message, request.type, request.count);
        if (sendResponse) sendResponse({ success: true });
    }
});

/**
 * Centrally updates the floating widgets' layout values when URL adjustments or navigations occur.
 * Restores launcher buttons and re-reads tag configurations.
 */
function triggerAggressiveUIUpdate() {
    lastCheckedUrl = window.location.href;

    if (!document.getElementById('algo-fsrs-container') && document.body) {
        createUI(); // Inject if the SPA accidentally destroyed it
    } else {
        // Restore launcher display on page transition so it's not permanently lost
        const launcher = document.getElementById('algo-fsrs-launcher');
        const container = document.getElementById('algo-fsrs-container');
        if (launcher && container && container.style.display !== 'block') {
            launcher.style.display = 'flex';
        }

        // Instantly update the contents of the existing widget
        const tagsEl = document.getElementById('fsrs-current-tags');
        if (tagsEl && typeof getAutoTags === 'function') {
            tagsEl.innerText = getAutoTags().join(', ');
        }
        if (typeof refreshWidgetState === 'function') {
            refreshWidgetState();
        }
    }
    applyHighlightsForCurrentPage();
}

/**
 * Updates visual class names (light-theme toggle) on active extension container elements
 * to match the user's color scheme settings.
 */
function applyThemeClass() {
    const launcher = document.getElementById('algo-fsrs-launcher');
    const container = document.getElementById('algo-fsrs-container');
    const tooltip = document.getElementById('algo-highlight-tooltip');
    
    const isLight = currentTheme === 'light';
    
    if (launcher) launcher.classList.toggle('light-theme', isLight);
    if (container) container.classList.toggle('light-theme', isLight);
    if (tooltip) tooltip.classList.toggle('light-theme', isLight);
    
    document.querySelectorAll('.algo-custom-notification').forEach(n => {
        n.classList.toggle('light-theme', isLight);
    });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.theme) {
        currentTheme = changes.theme.newValue || 'dark';
        applyThemeClass();
    }
});