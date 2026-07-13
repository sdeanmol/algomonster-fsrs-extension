// content.js - Inject UI and handle interactions
const fsrs = new FSRS();
let cards = [];
let lastCheckedUrl = window.location.href;
let topicWeights = {};
let currentTheme = 'dark';

// --- Highlighter State ---
let marks = [];
let bookmarks = [];
let pagecontents = [];
let chromeSettings = {
    defaultHighlightColor: '#f1c40f',
    recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'],
    showMarkerPopup: true,
    activePaletteIndex: 0,
    palettes: [
        { name: 'Default', colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] },
        { name: 'Warm Pastels', colors: ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff'] },
        { name: 'Ocean Breeze', colors: ['#a8dadc', '#457b9d', '#1d3557', '#e63946', '#f1faee'] },
        { name: 'Forest Moss', colors: ['#2d6a4f', '#40916c', '#52b788', '#74c69d', '#95d5b2'] },
        { name: 'Sunset Glow', colors: ['#f72585', '#7209b7', '#3f0712', '#f77f00', '#fcbf49'] }
    ]
};
let activeHighlightStyles = new Set();
let highlightDebounceTimer = null;

// Active ranges map for Hover tracking
let activeMarkRanges = [];
let hoveredMarkId = null;
let hideTooltipTimer = null;

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

    // 1. NEW: Hyper-Responsive Click Listener
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
        if (changes.fsrsGamification) {
            updateCompanionInWidget();
        }
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

// 3. Listen for SPA URL changes directly from Chrome Background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "spa_url_changed") {
        setTimeout(triggerAggressiveUIUpdate, 50);
    }
    if (request.action === "show_custom_notification") {
        showInPageNotification(request.title, request.message, request.type, request.count);
        if (sendResponse) sendResponse({ success: true });
    }
});

// NEW: Centralized function to instantly refresh the widget content without destroying it
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

let isHighlighterListenersBound = false;

function createHighlighterUI() {
    if (!document.getElementById('algo-highlight-tooltip')) {
        const tooltip = document.createElement('div');
        tooltip.id = 'algo-highlight-tooltip';
        document.body.appendChild(tooltip);
    }

    if (isHighlighterListenersBound) {
        applyThemeClass();
        return;
    }

    // 1. Text Selection Logic (For NEW highlights) - Use Capturing Phase and pointerup to bypass LeetCode event cancellation
    document.addEventListener('pointerup', (e) => {
        if (!chromeSettings.showMarkerPopup) return;
        if (e.target.closest('#algo-highlight-tooltip') || e.target.closest('#algo-fsrs-container')) return;

        const selection = window.getSelection();
        const tooltip = document.getElementById('algo-highlight-tooltip');
        if (!tooltip) return;

        if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
            if (hoveredMarkId === null) tooltip.style.display = 'none';
            return;
        }

        hoveredMarkId = null;
        clearTimeout(hideTooltipTimer);
        hideTooltipTimer = null;

        const range = selection.getRangeAt(0);

        // --- NEW POSITIONING: Get the exact last line of the multi-line selection ---
        const rects = range.getClientRects();
        let lastRect = rects.length > 0 ? rects[rects.length - 1] : null;

        if (!lastRect) {
            const bounding = range.getBoundingClientRect();
            if (bounding && (bounding.width > 0 || bounding.height > 0)) {
                lastRect = bounding;
            }
        }

        if (!lastRect) return;

        renderTooltipColors(null, null);
        tooltip.style.display = 'flex';

        // Anchor to the bottom-right corner where the highlight ends
        tooltip.style.left = `${lastRect.right + window.scrollX}px`;
        tooltip.style.top = `${lastRect.bottom + window.scrollY}px`;
    }, true);

    // 2. Hover Detection Logic (For EXISTING highlights)
    document.addEventListener('mousemove', (e) => {
        if (!chromeSettings.showMarkerPopup) return;

        if (e.target.closest('#algo-highlight-tooltip') || e.target.closest('#algo-fsrs-container')) {
            clearTimeout(hideTooltipTimer);
            hideTooltipTimer = null;
            return;
        }

        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.toString().trim() !== '') return;

        let foundMark = null;
        for (const item of activeMarkRanges) {
            const rects = item.range.getClientRects();
            for (let i = 0; i < rects.length; i++) {
                const r = rects[i];
                if (e.clientX >= r.left - 5 && e.clientX <= r.right + 5 && e.clientY >= r.top - 5 && e.clientY <= r.bottom + 5) {
                    foundMark = item;
                    break;
                }
            }
            if (foundMark) break;
        }

        const tooltip = document.getElementById('algo-highlight-tooltip');
        if (!tooltip) return;

        if (foundMark) {
            clearTimeout(hideTooltipTimer);
            hideTooltipTimer = null;

            if (hoveredMarkId !== foundMark.markId) {
                hoveredMarkId = foundMark.markId;
                renderTooltipColors(hoveredMarkId, foundMark.color);
                tooltip.style.display = 'flex';

                // --- NEW POSITIONING: Snap just below the cursor ---
                // We add 15px to X so the little triangle pointer perfectly aligns under the cursor
                tooltip.style.left = `${e.clientX + window.scrollX + 15}px`;
                tooltip.style.top = `${e.clientY + window.scrollY}px`;
            }
        } else {
            if (hoveredMarkId !== null && !hideTooltipTimer) {
                hideTooltipTimer = setTimeout(() => {
                    hoveredMarkId = null;
                    tooltip.style.display = 'none';
                    hideTooltipTimer = null;
                }, 400);
            }
        }
    });

    isHighlighterListenersBound = true;
    applyThemeClass();
}

function renderTooltipColors(existingMarkId = null, currentColor = null) {
    const tooltip = document.getElementById('algo-highlight-tooltip');
    tooltip.innerHTML = '';

    // Fetch active palette colors
    const activePalette = chromeSettings.palettes && chromeSettings.palettes[chromeSettings.activePaletteIndex]
        ? chromeSettings.palettes[chromeSettings.activePaletteIndex]
        : { colors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6'] };

    const paletteColors = activePalette.colors || [];

    // Color Swatches
    paletteColors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'algo-color-swatch';
        swatch.style.backgroundColor = color;

        // Mark as active if this swatch matches the highlight color
        if (existingMarkId && color === currentColor) {
            swatch.classList.add('active');
        }

        swatch.addEventListener('mousedown', (e) => {
            e.preventDefault();
            if (existingMarkId) updateHighlightColor(existingMarkId, color);
            else saveHighlight(color);
        });
        tooltip.appendChild(swatch);
    });

    // Custom Color Picker
    const picker = document.createElement('input');
    picker.type = 'color';
    picker.id = 'algo-color-picker';
    picker.value = currentColor || chromeSettings.defaultHighlightColor;
    picker.addEventListener('input', (e) => {
        const newColor = e.target.value;
        if (existingMarkId) updateHighlightColor(existingMarkId, newColor);
        else saveHighlight(newColor);
        updateRecentColors(newColor);
    });
    tooltip.appendChild(picker);

    // Delete Button (Only shows if hovering existing highlight)
    if (existingMarkId) {
        const divider = document.createElement('div');
        divider.className = 'algo-tooltip-divider';
        tooltip.appendChild(divider);

        const deleteBtn = document.createElement('div');
        deleteBtn.className = 'algo-delete-btn';
        deleteBtn.innerHTML = `<svg class="svg-icon" style="width:13px; height:13px;" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        deleteBtn.title = 'Remove Highlight';
        deleteBtn.addEventListener('mousedown', (e) => {
            e.preventDefault();
            deleteHighlight(existingMarkId);
        });
        tooltip.appendChild(deleteBtn);
    }
}

function updateRecentColors(newColor) {
    chromeSettings.defaultHighlightColor = newColor;
    chromeSettings.recentColors = [newColor, ...chromeSettings.recentColors.filter(c => c !== newColor)].slice(0, 4);
    chrome.storage.local.set({ chromeSettings });
}

function getDOMMeta(node, offset) {
    const parent = node.parentNode;
    let path = [];
    let current = parent;
    while (current && current !== document.body && current !== document.documentElement) {
        let index = Array.from(current.parentNode.childNodes).indexOf(current);
        path.unshift(index);
        current = current.parentNode;
    }

    return {
        parentTagName: parent.tagName.toLowerCase(),
        parentIndex: Array.from(parent.childNodes).indexOf(node),
        textOffset: offset,
        parentDomPath: path
    };
}

function saveHighlight(color) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const cleanUrl = window.location.href.split('?')[0].split('#')[0];
    const timestamp = new Date().getTime();

    const newMark = {
        id: `mark_${timestamp}_${Math.random().toString(36).substr(2, 5)}`,
        createdAt: timestamp,
        url: cleanUrl,
        text: selection.toString(),
        color: color,
        highlightSource: {
            startMeta: getDOMMeta(range.startContainer, range.startOffset),
            endMeta: getDOMMeta(range.endContainer, range.endOffset)
        }
    };

    marks.push(newMark);

    if (!bookmarks.find(b => b.url === cleanUrl)) {
        bookmarks.push({ url: cleanUrl, title: getExtractedProblemTitle(), meta: { favIconUrl: 'https://algo.monster/favicon.ico' } });
    }
    pagecontents = pagecontents.filter(p => p.url !== cleanUrl);
    pagecontents.push({ url: cleanUrl, description: document.body.innerText.substring(0, 100), length: document.body.innerText.length });

    chrome.storage.local.set({ marks, bookmarks, pagecontents });

    document.getElementById('algo-highlight-tooltip').style.display = 'none';
    selection.removeAllRanges();
    applyHighlightsForCurrentPage();
}

function updateHighlightColor(markId, newColor) {
    const markIndex = marks.findIndex(m => (m.id || m.createdAt.toString()) === markId);
    if (markIndex > -1) {
        marks[markIndex].color = newColor;
        chrome.storage.local.set({ marks });
        applyHighlightsForCurrentPage();
        renderTooltipColors(markId, newColor);
    }
}

function deleteHighlight(markId) {
    marks = marks.filter(m => (m.id || m.createdAt.toString()) !== markId);
    chrome.storage.local.set({ marks });

    document.getElementById('algo-highlight-tooltip').style.display = 'none';
    hoveredMarkId = null;
    applyHighlightsForCurrentPage();
}

function ensureHighlightStyle(color) {
    const colorName = `algo-hl-${color.replace('#', '')}`;
    if (!activeHighlightStyles.has(colorName)) {
        const style = document.createElement('style');
        style.textContent = `::highlight(${colorName}) { background-color: ${color}; color: inherit; }`;
        document.head.appendChild(style);
        activeHighlightStyles.add(colorName);
    }
    return colorName;
}

function restoreRangeFromMeta(highlightSource, markText) {
    try {
        let startNode = null;
        let endNode = null;

        if (highlightSource.startMeta.parentDomPath && highlightSource.endMeta.parentDomPath) {
            const resolvePath = (path, childIndex) => {
                let current = document.body;
                for (let i = 0; i < path.length; i++) {
                    if (!current || !current.childNodes) return null;
                    current = current.childNodes[path[i]];
                }
                return current ? current.childNodes[childIndex] : null;
            };

            startNode = resolvePath(highlightSource.startMeta.parentDomPath, highlightSource.startMeta.parentIndex);
            endNode = resolvePath(highlightSource.endMeta.parentDomPath, highlightSource.endMeta.parentIndex);
        }

        if (!startNode || !endNode) {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while ((node = walker.nextNode())) {
                const parent = node.parentNode;
                const parentTagName = parent.tagName.toLowerCase();
                const parentIndex = Array.from(parent.childNodes).indexOf(node);

                if (!startNode && parentTagName === highlightSource.startMeta.parentTagName && parentIndex === highlightSource.startMeta.parentIndex) startNode = node;
                if (startNode && parentTagName === highlightSource.endMeta.parentTagName && parentIndex === highlightSource.endMeta.parentIndex) {
                    endNode = node;
                    break;
                }
            }
        }

        if (startNode && endNode) {
            const range = document.createRange();
            const startOffset = Math.min(highlightSource.startMeta.textOffset, startNode.length || 0);
            const endOffset = Math.min(highlightSource.endMeta.textOffset, endNode.length || 0);

            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);

            if (markText) {
                const rangeTextClean = range.toString().replace(/\s+/g, '');
                const markTextClean = markText.replace(/\s+/g, '');

                if (rangeTextClean !== markTextClean) {
                    if (!markTextClean.includes(rangeTextClean) && !rangeTextClean.includes(markTextClean)) return null;
                    if (rangeTextClean.length < (markTextClean.length * 0.5)) return null;
                }
            }
            return range;
        }
    } catch (e) { }
    return null;
}

function applyHighlightsForCurrentPage() {
    if (!('highlights' in CSS)) return;

    const cleanUrl = window.location.href.split('?')[0].split('#')[0];
    const pageMarks = marks.filter(m => m.url === cleanUrl);

    CSS.highlights.clear();
    const highlightsByColor = {};
    activeMarkRanges = [];

    pageMarks.forEach(mark => {
        const range = restoreRangeFromMeta(mark.highlightSource, mark.text);
        if (range) {
            const targetId = mark.id || mark.createdAt.toString();
            activeMarkRanges.push({ markId: targetId, range: range, color: mark.color });

            const colorName = ensureHighlightStyle(mark.color);
            if (!highlightsByColor[colorName]) highlightsByColor[colorName] = [];
            highlightsByColor[colorName].push(range);
        }
    });

    for (const [colorName, ranges] of Object.entries(highlightsByColor)) {
        CSS.highlights.set(colorName, new Highlight(...ranges));
    }
}

function saveCards() {
    chrome.storage.local.set({ fsrsCards: cards });
}

function logReviewActivity() {
    chrome.storage.local.get(['fsrsActivity'], (result) => {
        const activity = result.fsrsActivity || {};
        const today = new Date();
        const dateString = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        activity[dateString] = (activity[dateString] || 0) + 1;
        chrome.storage.local.set({ fsrsActivity: activity });
    });
}

function getAutoTags() {
    try {
        const path = window.location.pathname;
        const segments = path.split('/').filter(p => p.length > 0);
        if (segments.length > 0) {
            const rawTopic = segments[segments.length - 1];
            return [rawTopic.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')];
        }
    } catch (e) { }
    return ["AlgoRecall"];
}

function refreshWidgetState() {
    const container = document.getElementById('algo-fsrs-container');
    if (!container) return;

    // FIX 1: Aggressively reset to default view on SPA navigation
    const reviewUi = document.getElementById('fsrs-review-ui');
    if (reviewUi) {
        reviewUi.style.display = 'none';
        reviewUi.innerHTML = ''; // Clear review session completely
    }
    document.getElementById('fsrs-body').style.display = 'block';

    const cleanUrl = window.location.href.split('?')[0].split('#')[0];
    const existingCard = cards.find(c => c.problemUrl.split('?')[0].split('#')[0] === cleanUrl);
    
    const approachArea = document.getElementById('fsrs-approach');
    const tagsInput = document.getElementById('fsrs-tags-input');
    const actionLabel = document.getElementById('fsrs-action-label');
    const ratingBtns = document.getElementById('fsrs-save-ratings').querySelectorAll('button');
    const updateTextBtn = document.getElementById('fsrs-update-text-btn');
    const deleteCardBtn = document.getElementById('fsrs-delete-card-btn');
    const saveRatingsContainer = document.getElementById('fsrs-save-ratings');

    if (existingCard) {
        // Card exists: Load data
        if (document.activeElement !== approachArea) {
            approachArea.value = existingCard.approach || "";
        }
        if (tagsInput && document.activeElement !== tagsInput) {
            tagsInput.value = (existingCard.tags || []).join(', ');
        }
        actionLabel.innerText = "Card Exists. Review Early or Update Notes:";
        updateTextBtn.style.display = "block";
        if (deleteCardBtn) deleteCardBtn.style.display = "block";
        saveRatingsContainer.setAttribute('data-existing-id', existingCard.id);
        
        // Highlight the previous rating
        ratingBtns.forEach(btn => {
            const btnRating = parseInt(btn.getAttribute('data-rating'));
            if (existingCard.lastRating === btnRating) {
                btn.style.opacity = "1";
                btn.style.boxShadow = "0 0 0 2px #fff inset"; // Inner white border for emphasis
            } else {
                btn.style.opacity = "0.4";
                btn.style.boxShadow = "none";
            }
        });
    } else {
        // New Card: Reset UI (check draft in storage)
        chrome.storage.local.get(['approachDrafts'], (res) => {
            const drafts = res.approachDrafts || {};
            const draft = drafts[cleanUrl];
            
            if (document.activeElement !== approachArea) {
                if (typeof draft === 'object' && draft !== null) {
                    approachArea.value = draft.approach || "";
                } else {
                    approachArea.value = draft || "";
                }
            }
            if (tagsInput && document.activeElement !== tagsInput) {
                if (typeof draft === 'object' && draft !== null && draft.tags !== undefined) {
                    tagsInput.value = draft.tags;
                } else {
                    tagsInput.value = getAutoTags().join(', ');
                }
            }
        });
        actionLabel.innerText = "Save & Rate Initial Difficulty:";
        updateTextBtn.style.display = "none";
        if (deleteCardBtn) deleteCardBtn.style.display = "none";
        saveRatingsContainer.removeAttribute('data-existing-id');
        
        ratingBtns.forEach(btn => {
            btn.style.opacity = "1";
            btn.style.boxShadow = "none";
        });
    }
    updateCompanionInWidget();
}

function createUI() {
    if (document.getElementById('algo-fsrs-container')) return;

    // 1. CREATE LAUNCHER
    const launcher = document.createElement('div');
    launcher.id = 'algo-fsrs-launcher';
    launcher.innerHTML = `<svg class="launcher-svg" viewBox="0 0 24 24" style="width: 26px; height: 26px; stroke: currentColor; fill: none; stroke-width: 2;"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z"></path><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z"></path><path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2"></path></svg>`; 
    launcher.title = "FSRS Tracker (Drag to move, Right-click to reset position)";
    document.body.appendChild(launcher);

    // 2. CREATE WIDGET CONTAINER
    const container = document.createElement('div');
    container.id = 'algo-fsrs-container';
    container.style.display = 'none';

    container.innerHTML = `
        <div id="fsrs-header">
            <div class="fsrs-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                <span>FSRS Tracker</span>
            </div>
            <div class="fsrs-controls">
                <button id="fsrs-min-btn" class="fsrs-icon-btn" title="Minimize">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                </button>
                <button id="fsrs-close-btn" class="fsrs-icon-btn" title="Close">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        </div>
        
        <div id="fsrs-body">
            <div class="fsrs-tags-container">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                <input type="text" id="fsrs-tags-input" class="fsrs-tags-input" placeholder="Add tags (comma separated)..." value="${getAutoTags().join(', ')}">
            </div>
            
            <div class="fsrs-approach-header">
                <label>Your Approach:</label>
                <div class="fsrs-header-buttons" style="display: flex; gap: 6px;">
                    <button id="fsrs-fullscreen-btn" class="fsrs-secondary-btn" title="Open in fullscreen new tab">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:11px; height:11px; display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                        Fullscreen
                    </button>
                    <button id="fsrs-delete-card-btn" class="fsrs-danger-btn" style="display:none;" title="Remove this card from future reviews">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:11px; height:11px; display:inline-block; vertical-align:middle; margin-right:3px; stroke:currentColor;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        Remove
                    </button>
                    <button id="fsrs-update-text-btn" class="fsrs-secondary-btn" style="display:none;" title="Save edits without reviewing">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:11px; height:11px; display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                        Save Edit
                    </button>
                </div>
            </div>
            <textarea id="fsrs-approach" class="fsrs-textarea" placeholder="How did you solve this pattern? Jot down your key insights..."></textarea>
            
            <div class="fsrs-rating-section" style="position: relative;">
                <div id="fsrs-companion-widget-container" style="display:none; align-items:center; gap:8px; margin-bottom:8px; padding:6px 10px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:10px;">
                    <span id="fsrs-companion-icon" style="font-size:16px;"></span>
                    <div style="display:flex; flex-direction:column; gap:2px; text-align:left;">
                        <span id="fsrs-companion-name" style="font-size:11px; font-weight:700; color:#fff;"></span>
                        <span id="fsrs-companion-level" style="font-size:9px; color:#888;"></span>
                    </div>
                </div>
                <p id="fsrs-action-label" class="fsrs-rating-label">Save & Rate Initial Difficulty:</p>
                <div class="fsrs-rating-buttons" id="fsrs-save-ratings">
                    <button data-rating="1" class="fsrs-btn-again" title="Hard to remember (Shortcut: 1)">Again</button>
                    <button data-rating="2" class="fsrs-btn-hard" title="Remembered with effort (Shortcut: 2)">Hard</button>
                    <button data-rating="3" class="fsrs-btn-good" title="Remembered easily (Shortcut: 3)">Good</button>
                    <button data-rating="4" class="fsrs-btn-easy" title="Too easy (Shortcut: 4)">Easy</button>
                </div>
            </div>
        </div>
        <div id="fsrs-review-ui" style="display:none;"></div>
    `;

    document.body.appendChild(container);

    // 3. WIDGET TOGGLE CONTROLS
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    let initialPos = { x: 0, y: 0 };

    function onMouseMove(e) {
        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;
        
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
            isDragging = true;
        }
        
        if (isDragging) {
            launcher.style.left = `${initialPos.x + dx}px`;
            launcher.style.top = `${initialPos.y + dy}px`;
            launcher.style.right = 'auto';
            launcher.style.bottom = 'auto';
            launcher.style.cursor = 'grabbing';
        }
    }

    function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        setTimeout(() => {
            launcher.style.cursor = 'pointer';
        }, 50);
    }

    launcher.addEventListener('mousedown', (e) => {
        isDragging = false;
        dragStart.x = e.clientX;
        dragStart.y = e.clientY;
        
        const rect = launcher.getBoundingClientRect();
        initialPos.x = rect.left;
        initialPos.y = rect.top;
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    launcher.addEventListener('click', (e) => {
        if (isDragging) {
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        launcher.style.display = 'none';
        container.style.display = 'block';
        refreshWidgetState();
    });

    launcher.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        launcher.style.left = '';
        launcher.style.top = '';
        launcher.style.right = '';
        launcher.style.bottom = '';
    });

    document.getElementById('fsrs-min-btn').addEventListener('click', () => {
        container.style.display = 'none';
        launcher.style.display = 'flex';
    });

    document.getElementById('fsrs-close-btn').addEventListener('click', () => {
        container.style.display = 'none';
        launcher.style.display = 'none';
    });

    // 4. FSRS APP LOGIC LISTENERS
    function saveDraft() {
        const cleanUrl = window.location.href.split('?')[0].split('#')[0];
        const existingCard = cards.find(c => c.problemUrl.split('?')[0].split('#')[0] === cleanUrl);
        
        const text = document.getElementById('fsrs-approach').value;
        const tagsText = document.getElementById('fsrs-tags-input').value;

        if (existingCard) {
            existingCard.approach = text;
            existingCard.tags = tagsText.split(',').map(t => t.trim()).filter(t => t.length > 0);
            saveCards();
        } else {
            chrome.storage.local.get(['approachDrafts'], (res) => {
                const drafts = res.approachDrafts || {};
                drafts[cleanUrl] = { approach: text, tags: tagsText };
                chrome.storage.local.set({ approachDrafts: drafts });
            });
        }
    }

    document.getElementById('fsrs-fullscreen-btn').addEventListener('click', () => {
        const cleanUrl = window.location.href.split('?')[0].split('#')[0];
        const currentText = document.getElementById('fsrs-approach').value;
        const currentTagsText = document.getElementById('fsrs-tags-input').value;
        const existingCard = cards.find(c => c.problemUrl.split('?')[0].split('#')[0] === cleanUrl);

        if (existingCard) {
            existingCard.approach = currentText;
            existingCard.tags = currentTagsText.split(',').map(t => t.trim()).filter(t => t.length > 0);
            saveCards();
        } else {
            chrome.storage.local.get(['approachDrafts'], (res) => {
                const drafts = res.approachDrafts || {};
                drafts[cleanUrl] = { approach: currentText, tags: currentTagsText };
                chrome.storage.local.set({ approachDrafts: drafts }, () => {
                    chrome.runtime.sendMessage({
                        action: "open_fullscreen_editor",
                        url: cleanUrl
                    });
                });
            });
            return;
        }

        chrome.runtime.sendMessage({
            action: "open_fullscreen_editor",
            url: cleanUrl
        });
    });

    document.getElementById('fsrs-approach').addEventListener('input', saveDraft);
    document.getElementById('fsrs-tags-input').addEventListener('input', saveDraft);

    document.getElementById('fsrs-delete-card-btn').addEventListener('click', () => {
        const cleanUrl = window.location.href.split('?')[0].split('#')[0];
        const existingCard = cards.find(c => c.problemUrl.split('?')[0].split('#')[0] === cleanUrl);
        if (existingCard) {
            if (confirm("Remove this card from future reviews? This will delete the card and its repetition history.")) {
                cards = cards.filter(c => c.id !== existingCard.id);
                saveCards();
                refreshWidgetState();
            }
        }
    });

    document.getElementById('fsrs-update-text-btn').addEventListener('click', (e) => {
        const existingId = document.getElementById('fsrs-save-ratings').getAttribute('data-existing-id');
        if (existingId) {
            const index = cards.findIndex(c => c.id === existingId);
            if (index > -1) {
                cards[index].approach = document.getElementById('fsrs-approach').value;
                const tagsVal = document.getElementById('fsrs-tags-input').value;
                cards[index].tags = tagsVal.split(',').map(t => t.trim()).filter(t => t.length > 0);
                saveCards();

                const originalText = e.target.innerText;
                e.target.innerText = "Saved ✓";
                e.target.style.background = "#2ecc71";
                setTimeout(() => {
                    e.target.innerText = originalText;
                    e.target.style.background = "#555";
                }, 1500);
            }
        }
    });

    document.getElementById('fsrs-save-ratings').querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const approach = document.getElementById('fsrs-approach').value;
            if (!approach) return alert("Please enter your approach.");

            const tagsVal = document.getElementById('fsrs-tags-input').value;
            const parsedTags = tagsVal.split(',').map(t => t.trim()).filter(t => t.length > 0);

            const rating = parseInt(e.target.getAttribute('data-rating'));
            const existingId = document.getElementById('fsrs-save-ratings').getAttribute('data-existing-id');
            const cleanUrl = window.location.href.split('?')[0].split('#')[0];
            const problemTitle = getExtractedProblemTitle();

            // Dynamic Topic Weights mapping
            let customWeights = null;
            if (topicWeights && parsedTags && parsedTags.length > 0) {
                for (const tag of parsedTags) {
                    if (topicWeights[tag]) {
                        customWeights = topicWeights[tag];
                        break;
                    }
                }
            }

            if (existingId) {
                const index = cards.findIndex(c => c.id === existingId);
                if (index > -1) {
                    cards[index].approach = approach;
                    cards[index].tags = parsedTags;
                    cards[index] = fsrs.reviewCard(cards[index], rating, customWeights);
                    cards[index].lastRating = rating; 
                }
            } else {
                let newCard = fsrs.createCard(problemTitle, cleanUrl, "", approach, parsedTags);
                newCard = fsrs.reviewCard(newCard, rating, customWeights);
                newCard.lastRating = rating; 
                cards.push(newCard);
            }

            saveCards();
            applyGamificationEarnings(rating);

            // Clear draft if it exists
            chrome.storage.local.get(['approachDrafts'], (res) => {
                const drafts = res.approachDrafts || {};
                if (drafts[cleanUrl]) {
                    delete drafts[cleanUrl];
                    chrome.storage.local.set({ approachDrafts: drafts });
                }
            });

            logReviewActivity();
            refreshWidgetState();

            const originalText = e.target.innerText;
            e.target.innerText = "Saved ✓";
            setTimeout(() => e.target.innerText = originalText, 1500);
        });
    });
    applyThemeClass();
}

function getDueCards() {
    const now = new Date().getTime();
    return cards.filter(c => c.due <= now).sort((a, b) => a.due - b.due);
}

function startReview() {
    const dueCards = getDueCards();
    if (dueCards.length === 0) {
        alert("No cards due right now!");
        return;
    }

    let currentCard = dueCards[0];
    const reviewUi = document.getElementById('fsrs-review-ui');
    document.getElementById('fsrs-body').style.display = 'none';
    reviewUi.style.display = 'block';

    const tagsHtml = currentCard.tags?.length ? `<div style="font-size: 11px; color: #888; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
        <svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #888; width: 13px; height: 13px;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
        <span>${currentCard.tags.join(', ')}</span>
    </div>` : '';

    // FIX 2: Added Back Button inside the Review UI Header
    reviewUi.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 5px;">
            <h4 style="margin:0;">${currentCard.problemTitle}</h4>
            <button id="fsrs-back-btn" title="Go Back" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                <svg class="svg-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                Back
            </button>
        </div>
        ${tagsHtml}
        <p style="margin-bottom: 15px;">
            <a href="${currentCard.problemUrl}" target="_blank" style="color: #4CAF50; text-decoration: none; font-weight: bold; border-bottom: 1px solid #4CAF50; display: inline-flex; align-items: center; gap: 4px;">
                <svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #4CAF50; width: 13px; height: 13px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                Open Problem Page
            </a>
        </p>
        <div id="fsrs-approach-answer" style="display:none;">
            <p><strong>Your Approach:</strong><br>${currentCard.approach}</p>
            <div class="fsrs-rating-buttons">
                <button data-rating="1" style="background:#e74c3c;">Again</button>
                <button data-rating="2" style="background:#e67e22;">Hard</button>
                <button data-rating="3" style="background:#2ecc71;">Good</button>
                <button data-rating="4" style="background:#3498db;">Easy</button>
            </div>
        </div>
        <button id="fsrs-show-answer-btn" class="fsrs-primary-btn">Show Approach</button>
    `;

    // Handle Back Button Click
    document.getElementById('fsrs-back-btn').addEventListener('click', () => {
        reviewUi.style.display = 'none';
        reviewUi.innerHTML = '';
        document.getElementById('fsrs-body').style.display = 'block';
        refreshWidgetState();
    });

    document.getElementById('fsrs-show-answer-btn').addEventListener('click', (e) => {
        e.target.style.display = 'none';
        document.getElementById('fsrs-approach-answer').style.display = 'block';
    });

    reviewUi.querySelectorAll('.fsrs-rating-buttons button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = cards.findIndex(c => c.id === currentCard.id);
            const rating = parseInt(e.target.getAttribute('data-rating'));

            // Determine if this card has a tag that matches a custom weight profile
            let customWeightsToApply = null;
            if (currentCard.tags && currentCard.tags.length > 0) {
                for (const tag of currentCard.tags) {
                    if (topicWeights[tag]) {
                        customWeightsToApply = topicWeights[tag];
                        break; // Use the first matching profile
                    }
                }
            }

            // Pass the custom weights into the engine
            cards[index] = fsrs.reviewCard(currentCard, rating, customWeightsToApply);
            cards[index].lastRating = rating; // NEW: Save last rating here as well

            saveCards();
            logReviewActivity();

            reviewUi.style.display = 'none';
            document.getElementById('fsrs-body').style.display = 'block';
            if (getDueCards().length > 0) startReview();
            else refreshWidgetState(); // Reset UI cleanly when deck is finished
        });
    });
}

function showInPageNotification(title, message, type, count) {
    // Prevent double notifications by removing the old one first
    const existing = document.getElementById('algo-custom-notification-el');
    if (existing) {
        existing.remove();
    }

    const notification = document.createElement('div');
    notification.id = 'algo-custom-notification-el';
    notification.className = 'algo-custom-notification';
    if (currentTheme === 'light') {
        notification.classList.add('light-theme');
    }
    
    const iconSymbol = type === 'review' 
        ? `<svg class="svg-icon" viewBox="0 0 24 24" style="stroke: var(--md-primary); width:18px; height:18px;"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5C6 22 4 19.5 4 17c0-1.5 1-2.5 1-3.5 0-1-1-2-1-3.5 0-2.5 2-5 5.5-6z"></path><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5C18 22 20 19.5 20 17c0-1.5-1-2.5-1-3.5 0-1 1-2 1-3.5 0-2.5-2-5-5.5-6z"></path><path d="M12 8h2M12 12h3M12 16h2M10 8h2M9 12h3M10 16h2"></path></svg>`
        : `<svg class="svg-icon" viewBox="0 0 24 24" style="stroke: var(--md-primary); width:18px; height:18px;"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
    const iconClass = type === 'review' ? 'algo-notif-icon review' : 'algo-notif-icon';
    
    let buttonsHtml = '';
    if (type === 'review') {
        buttonsHtml = `
            <div class="algo-notif-buttons">
                <button id="algo-notif-btn-review" class="algo-notif-btn algo-notif-btn-primary">Review Now</button>
                <button id="algo-notif-btn-snooze" class="algo-notif-btn algo-notif-btn-secondary">Snooze (15m)</button>
            </div>
        `;
    } else {
        buttonsHtml = `
            <div class="algo-notif-buttons">
                <button id="algo-notif-btn-dismiss" class="algo-notif-btn algo-notif-btn-secondary" style="width: 100%;">Dismiss</button>
            </div>
        `;
    }

    notification.innerHTML = `
        <div class="algo-notif-header">
            <div class="algo-notif-header-left">
                <span class="${iconClass}">${iconSymbol}</span>
                <span class="algo-notif-title">${title}</span>
            </div>
            <button id="algo-notif-btn-close" class="algo-notif-close" title="Close">&times;</button>
        </div>
        <p class="algo-notif-message">${message}</p>
        ${buttonsHtml}
    `;

    document.body.appendChild(notification);

    // Force style recalculation for smooth transition
    requestAnimationFrame(() => {
        notification.classList.add('show');
    });

    // Helper to dismiss
    function dismissNotification() {
        notification.classList.remove('show');
        notification.addEventListener('transitionend', () => {
            notification.remove();
        }, { once: true });
    }

    // Auto-dismiss after 6 seconds for test notifications, or keep review sticky if required
    let autoDismissTimer = null;
    if (type !== 'review') {
        autoDismissTimer = setTimeout(dismissNotification, 6000);
    }

    // Event Listeners
    const closeBtn = notification.querySelector('#algo-notif-btn-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            if (autoDismissTimer) clearTimeout(autoDismissTimer);
            dismissNotification();
        });
    }

    const dismissBtn = notification.querySelector('#algo-notif-btn-dismiss');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
            if (autoDismissTimer) clearTimeout(autoDismissTimer);
            dismissNotification();
        });
    }

    const snoozeBtn = notification.querySelector('#algo-notif-btn-snooze');
    if (snoozeBtn) {
        snoozeBtn.addEventListener('click', () => {
            if (autoDismissTimer) clearTimeout(autoDismissTimer);
            dismissNotification();
            chrome.runtime.sendMessage({ action: 'snooze_notification', minutes: 15 }, (response) => {
                // Background handles scheduling snoozeFsrsReviews
            });
        });
    }

    const reviewBtn = notification.querySelector('#algo-notif-btn-review');
    if (reviewBtn) {
        reviewBtn.addEventListener('click', () => {
            if (autoDismissTimer) clearTimeout(autoDismissTimer);
            dismissNotification();
            
            // Open/Show the FSRS container and start the review flow!
            const launcher = document.getElementById('algo-fsrs-launcher');
            const container = document.getElementById('algo-fsrs-container');
            
            if (launcher) launcher.style.display = 'none';
            if (container) {
                container.style.display = 'block';
                refreshWidgetState();
                startReview();
            }
        });
    }
}

// --- Dynamic Theme Support ---
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

function getExtractedProblemTitle() {
    const url = window.location.href;
    
    // LeetCode Explore Cards
    if (url.includes('leetcode.com/explore/')) {
        const selectors = [
            'h1', 'h2', 'h3',
            '[class*="card-title"]',
            '[class*="course-title"]',
            '[class*="title-wrapper"]',
            '.card-info-title',
            '.title__3y75'
        ];
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el && el.innerText && el.innerText.trim().length > 0 && el.innerText.trim().length < 100) {
                const text = el.innerText.trim();
                if (!text.toLowerCase().includes('leetcode') || text.toLowerCase().includes('course') || text.toLowerCase().includes('crash')) {
                    return text;
                }
            }
        }
        
        // Fallback: parse URL
        try {
            const path = window.location.pathname;
            const segments = path.split('/').filter(p => p.length > 0);
            if (segments.length > 0) {
                let index = segments.length - 1;
                while (index >= 0 && (/^\d+$/.test(segments[index]) || segments[index] === 'card' || segments[index] === 'featured')) {
                    index--;
                }
                if (index >= 0) {
                    return segments[index]
                        .split('-')
                        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(' ');
                }
            }
        } catch (e) {}
    }
    
    // General title fallback
    let title = document.title;
    title = title.replace(' - AlgoMonster', '');
    title = title.replace(' - LeetCode', '');
    title = title.replace(' - Codeforces', '');
    title = title.replace(' - CodeChef', '');
    title = title.replace(' - AtCoder', '');
    return title.trim();
}

function applyGamificationEarnings(rating) {
    chrome.storage.local.get(['fsrsGamification'], (result) => {
        let gamify = result.fsrsGamification;
        if (!gamify || !gamify.character) return;

        // 1. Calculate XP and Gold bases
        let xpGained = 0;
        let goldGained = 0;
        switch (rating) {
            case 1: // Again
                xpGained = 10;
                goldGained = 2;
                break;
            case 2: // Hard
                xpGained = 20;
                goldGained = 4;
                break;
            case 3: // Good
                xpGained = 35;
                goldGained = 8;
                break;
            case 4: // Easy
                xpGained = 50;
                goldGained = 12;
                break;
        }

        // 2. Add Strength Modifier to Gold
        const str = (gamify.character.stats && gamify.character.stats.str) || 0;
        goldGained += Math.floor(str / 2);

        // 3. Accumulate stats
        gamify.character.xp += xpGained;
        gamify.character.gold += goldGained;

        // 4. Evaluate Level Up
        const maxXp = gamify.character.level * 100;
        let levelUpOccurred = false;
        if (gamify.character.xp >= maxXp) {
            gamify.character.xp -= maxXp;
            gamify.character.level += 1;
            gamify.character.statPoints += 1;
            gamify.character.hp = gamify.character.maxHp;
            levelUpOccurred = true;
        }

        // 5. Evaluate Drops (on Good/Easy reviews)
        let dropMessage = "";
        if (rating === 3 || rating === 4) {
            const per = (gamify.character.stats && gamify.character.stats.per) || 0;
            const dropChance = 0.10 + per * 0.02; // +2% per Perception point
            if (Math.random() < dropChance) {
                const roll = Math.random();
                if (roll < 0.40) {
                    // Drop food
                    const foods = ["Binary Berry", "Greedy Grape", "Dynamic Dragonfruit", "Backtracking Blueberry"];
                    const item = foods[Math.floor(Math.random() * foods.length)];
                    gamify.inventory.food = gamify.inventory.food || [];
                    gamify.inventory.food.push(item);
                    dropMessage = `Found Food: ${item}! 🍎`;
                } else if (roll < 0.70) {
                    // Drop egg
                    const eggs = ["Linear Dragon", "Recursive Phoenix", "Tree Ent", "Graph Griffin"];
                    const item = eggs[Math.floor(Math.random() * eggs.length)];
                    gamify.inventory.eggs = gamify.inventory.eggs || [];
                    gamify.inventory.eggs.push(item);
                    dropMessage = `Found Egg: ${item}! 🥚`;
                } else {
                    // Drop potion
                    const potions = ["Dynamic Pink", "Greedy Gold", "Backtracking Black", "BFS Blue"];
                    const item = potions[Math.floor(Math.random() * potions.length)];
                    gamify.inventory.potions = gamify.inventory.potions || [];
                    gamify.inventory.potions.push(item);
                    dropMessage = `Found Potion: ${item}! 🧪`;
                }
            }
        }

        // 6. Save back to storage
        chrome.storage.local.set({ fsrsGamification: gamify }, () => {
            // Show dynamic user-facing message inside widget
            let notificationText = `+${xpGained} XP | +${goldGained} Gold`;
            if (levelUpOccurred) {
                notificationText += ` | LEVEL UP to ${gamify.character.level}! 🎉`;
            }
            if (dropMessage) {
                notificationText += ` | ${dropMessage}`;
            }
            showWidgetNotification(notificationText);
        });
    });
}

function showWidgetNotification(text) {
    const existing = document.getElementById('fsrs-gamify-notification');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'fsrs-gamify-notification';
    toast.style.cssText = `
        position: absolute;
        bottom: 50px;
        left: 50%;
        transform: translateX(-50%);
        background: #1e8e3e;
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        padding: 6px 12px;
        border-radius: 20px;
        z-index: 10000;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
        white-space: nowrap;
        animation: fsrsFadeInOut 2.5s forwards;
    `;
    toast.textContent = text;
    
    // Inject animation styles if not present
    if (!document.getElementById('fsrs-gamify-animation-style')) {
        const style = document.createElement('style');
        style.id = 'fsrs-gamify-animation-style';
        style.innerHTML = `
            @keyframes fsrsFadeInOut {
                0% { opacity: 0; bottom: 40px; }
                15% { opacity: 1; bottom: 50px; }
                85% { opacity: 1; bottom: 50px; }
                100% { opacity: 0; bottom: 60px; }
            }
        `;
        document.head.appendChild(style);
    }

    const reviewSection = document.querySelector('.fsrs-rating-section');
    if (reviewSection) {
        reviewSection.appendChild(toast);
    }
}

function updateCompanionInWidget() {
    chrome.storage.local.get(['fsrsGamification'], (result) => {
        const gamify = result.fsrsGamification;
        const container = document.getElementById('fsrs-companion-widget-container');
        const iconEl = document.getElementById('fsrs-companion-icon');
        const nameEl = document.getElementById('fsrs-companion-name');
        const levelEl = document.getElementById('fsrs-companion-level');
        if (!container || !iconEl || !nameEl || !levelEl) return;

        if (gamify && gamify.activeCompanion) {
            const companionMap = {
                "Linear Dragon": { icon: "🐉", name: "Linear Dragon" },
                "Recursive Phoenix": { icon: "🐦", name: "Recursive Phoenix" },
                "Tree Ent": { icon: "🌲", name: "Tree Ent" },
                "Graph Griffin": { icon: "🦅", name: "Graph Griffin" }
            };
            const c = companionMap[gamify.activeCompanion];
            if (c) {
                iconEl.textContent = c.icon;
                nameEl.textContent = c.name;
                levelEl.textContent = `Companion Pet (Player Lvl ${gamify.character.level})`;
                container.style.display = 'flex';
                return;
            }
        }
        container.style.display = 'none';
    });
}