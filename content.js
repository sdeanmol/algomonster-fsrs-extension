// content.js - Inject UI and handle interactions
const fsrs = new FSRS();
let cards = [];
let lastCheckedUrl = window.location.href;
let topicWeights = {};

// --- NEW: Highlighter State ---
let marks = [];
let bookmarks = [];
let pagecontents = [];
let chromeSettings = {
    defaultHighlightColor: '#f1c40f',
    recentColors: ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'],
    showMarkerPopup: true
};
let activeHighlightStyles = new Set();
let highlightDebounceTimer = null;

chrome.storage.local.get(['fsrsCards', 'fsrsTopicWeights', 'marks', 'bookmarks', 'pagecontents', 'chromeSettings'], (result) => {
    if (result.fsrsCards) cards = result.fsrsCards;
    if (result.fsrsTopicWeights) topicWeights = result.fsrsTopicWeights;
    
    // Load Highlighter Data
    if (result.marks) marks = result.marks;
    if (result.bookmarks) bookmarks = result.bookmarks;
    if (result.pagecontents) pagecontents = result.pagecontents;
    if (result.chromeSettings) chromeSettings = { ...chromeSettings, ...result.chromeSettings };

    createUI();
    createHighlighterUI();
    applyHighlightsForCurrentPage();
    
    // SPA Observer for FSRS Widget
    setInterval(() => {
        if (!document.getElementById('algo-fsrs-container') && document.body) createUI();
        if (window.location.href !== lastCheckedUrl) {
            lastCheckedUrl = window.location.href;
            setTimeout(() => {
                const tagsEl = document.getElementById('fsrs-current-tags');
                if (tagsEl) tagsEl.innerText = getAutoTags().join(', ');
                refreshWidgetState();
            }, 800); 
        }
    }, 500);

    // SPA Observer for Highlighter (DOM Hydration safe)
    const domObserver = new MutationObserver(() => {
        clearTimeout(highlightDebounceTimer);
        highlightDebounceTimer = setTimeout(applyHighlightsForCurrentPage, 300);
    });
    domObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
});

// NEW: Listen for SPA URL changes directly from Background script
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "spa_url_changed") {
        setTimeout(applyHighlightsForCurrentPage, 500);
    }
});

// --- HIGHLIGHTER CORE LOGIC ---

function createHighlighterUI() {
    if (document.getElementById('algo-highlight-tooltip')) return;

    const tooltip = document.createElement('div');
    tooltip.id = 'algo-highlight-tooltip';
    document.body.appendChild(tooltip);

    // Handle Text Selection
    document.addEventListener('mouseup', (e) => {
        if (!chromeSettings.showMarkerPopup) return;
        if (e.target.closest('#algo-highlight-tooltip') || e.target.closest('#algo-fsrs-container')) return;

        const selection = window.getSelection();
        if (!selection || selection.isCollapsed || selection.toString().trim() === '') {
            tooltip.style.display = 'none';
            return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        renderTooltipColors();
        tooltip.style.display = 'flex';
        tooltip.style.left = `${rect.left + (rect.width / 2) + window.scrollX}px`;
        tooltip.style.top = `${rect.top + window.scrollY - 5}px`;
    });
}

function renderTooltipColors() {
    const tooltip = document.getElementById('algo-highlight-tooltip');
    tooltip.innerHTML = '';

    chromeSettings.recentColors.forEach(color => {
        const swatch = document.createElement('div');
        swatch.className = 'algo-color-swatch';
        swatch.style.backgroundColor = color;
        swatch.addEventListener('mousedown', (e) => {
            e.preventDefault(); // Keep selection
            saveHighlight(color);
        });
        tooltip.appendChild(swatch);
    });

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.id = 'algo-color-picker';
    picker.value = chromeSettings.defaultHighlightColor;
    picker.addEventListener('input', (e) => {
        const newColor = e.target.value;
        saveHighlight(newColor);
        updateRecentColors(newColor);
    });
    tooltip.appendChild(picker);
}

function updateRecentColors(newColor) {
    chromeSettings.defaultHighlightColor = newColor;
    chromeSettings.recentColors = [newColor, ...chromeSettings.recentColors.filter(c => c !== newColor)].slice(0, 4);
    chrome.storage.local.set({ chromeSettings });
}

// Generates the strict Schema metadata requested
function getDOMMeta(node, offset) {
    const parent = node.parentNode;
    return {
        parentTagName: parent.tagName.toLowerCase(),
        parentIndex: Array.from(parent.childNodes).indexOf(node),
        textOffset: offset
    };
}

function saveHighlight(color) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const range = selection.getRangeAt(0);
    const cleanUrl = window.location.href.split('#')[0]; // Ignore anchor links

    const highlightSource = {
        startMeta: getDOMMeta(range.startContainer, range.startOffset),
        endMeta: getDOMMeta(range.endContainer, range.endOffset)
    };

    const newMark = {
        createdAt: new Date().getTime(),
        url: cleanUrl,
        text: selection.toString(),
        color: color,
        highlightSource: highlightSource
    };

    marks.push(newMark);
    
    // Save Contextual Metadata
    if (!bookmarks.find(b => b.url === cleanUrl)) {
        bookmarks.push({ url: cleanUrl, title: document.title, meta: { favIconUrl: 'https://algo.monster/favicon.ico' } });
    }
    pagecontents = pagecontents.filter(p => p.url !== cleanUrl); // Update latest size
    pagecontents.push({ url: cleanUrl, description: document.body.innerText.substring(0, 100), length: document.body.innerText.length });

    chrome.storage.local.set({ marks, bookmarks, pagecontents });
    
    document.getElementById('algo-highlight-tooltip').style.display = 'none';
    selection.removeAllRanges();
    applyHighlightsForCurrentPage();
}

// Dynamically creates CSS rules for the Custom Highlight API
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

// Safely reconstructs a Range object from Schema metadata
function restoreRangeFromMeta(highlightSource) {
    try {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let startNode = null;
        let endNode = null;
        let node;

        while ((node = walker.nextNode())) {
            const parent = node.parentNode;
            const parentTagName = parent.tagName.toLowerCase();
            const parentIndex = Array.from(parent.childNodes).indexOf(node);

            if (!startNode && parentTagName === highlightSource.startMeta.parentTagName && parentIndex === highlightSource.startMeta.parentIndex) {
                startNode = node;
            }
            if (!endNode && parentTagName === highlightSource.endMeta.parentTagName && parentIndex === highlightSource.endMeta.parentIndex) {
                endNode = node;
            }
            if (startNode && endNode) break;
        }

        if (startNode && endNode) {
            const range = document.createRange();
            range.setStart(startNode, highlightSource.startMeta.textOffset);
            range.setEnd(endNode, highlightSource.endMeta.textOffset);
            return range;
        }
    } catch (e) {
        // Silent fail if DOM hydrated differently and nodes disappeared
    }
    return null;
}

// Uses CSS.highlights API (Zero DOM manipulation = React/Vue safe)
function applyHighlightsForCurrentPage() {
    if (!('highlights' in CSS)) return; // Fallback for unsupported browsers
    
    const cleanUrl = window.location.href.split('#')[0];
    const pageMarks = marks.filter(m => m.url === cleanUrl);
    
    CSS.highlights.clear();
    const highlightsByColor = {};

    pageMarks.forEach(mark => {
        const range = restoreRangeFromMeta(mark.highlightSource);
        if (range) {
            const colorName = ensureHighlightStyle(mark.color);
            if (!highlightsByColor[colorName]) highlightsByColor[colorName] = [];
            highlightsByColor[colorName].push(range);
        }
    });

    for (const [colorName, ranges] of Object.entries(highlightsByColor)) {
        const highlightObj = new Highlight(...ranges);
        CSS.highlights.set(colorName, highlightObj);
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
    } catch (e) {}
    return ["AlgoMonster"];
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
    const actionLabel = document.getElementById('fsrs-action-label');
    const ratingBtns = document.getElementById('fsrs-save-ratings').querySelectorAll('button');
    const updateTextBtn = document.getElementById('fsrs-update-text-btn');
    const saveRatingsContainer = document.getElementById('fsrs-save-ratings');

    if (existingCard) {
        // Card exists: Load data
        approachArea.value = existingCard.approach || "";
        actionLabel.innerText = "Card Exists. Review Early or Update Notes:";
        updateTextBtn.style.display = "block";
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
        // New Card: Reset UI
        approachArea.value = "";
        actionLabel.innerText = "Save & Rate Initial Difficulty:";
        updateTextBtn.style.display = "none";
        saveRatingsContainer.removeAttribute('data-existing-id');
        
        ratingBtns.forEach(btn => {
            btn.style.opacity = "1";
            btn.style.boxShadow = "none";
        });
    }
}

function createUI() {
    if (document.getElementById('algo-fsrs-container')) return;

    const launcher = document.createElement('div');
    launcher.id = 'algo-fsrs-launcher';
    launcher.innerText = '🧠'; 
    document.body.appendChild(launcher);

    const container = document.createElement('div');
    container.id = 'algo-fsrs-container';
    container.style.display = 'none'; 
    
    container.innerHTML = `
        <div id="fsrs-header">
            <span>FSRS Tracker</span>
            <div class="fsrs-controls">
                <button id="fsrs-min-btn" title="Minimize">_</button>
                <button id="fsrs-close-btn" title="Close">X</button>
            </div>
        </div>
        <div id="fsrs-body">
            <div style="font-size: 11px; color: #888; margin-bottom: 8px;">🏷️ <span id="fsrs-current-tags">${getAutoTags().join(', ')}</span></div>
            
            <label style="display:flex; justify-content:space-between; align-items:flex-end;">
                Your Approach:
                <button id="fsrs-update-text-btn" style="display:none; padding: 3px 8px; font-size: 10px; background: #555; color: white; border: none; border-radius: 3px; cursor: pointer;">Save Edit Only</button>
            </label>
            <textarea id="fsrs-approach" placeholder="How did you solve this?" style="height: 80px;"></textarea>
            
            <p id="fsrs-action-label" style="margin: 10px 0 5px 0; font-size: 12px; font-weight: bold; text-align: center;">Save & Rate Initial Difficulty:</p>
            <div class="fsrs-rating-buttons" id="fsrs-save-ratings">
                <button data-rating="1" style="background:#e74c3c;">Again</button>
                <button data-rating="2" style="background:#e67e22;">Hard</button>
                <button data-rating="3" style="background:#2ecc71;">Good</button>
                <button data-rating="4" style="background:#3498db;">Easy</button>
            </div>
            <hr id="fsrs-divider">
            <button id="fsrs-review-btn" class="fsrs-primary-btn">Review Due Cards (${getDueCards().length})</button>
        </div>
        <div id="fsrs-review-ui" style="display:none;"></div>
    `;
    document.body.appendChild(container);

    // Open widget and refresh state
    launcher.addEventListener('click', () => { 
        launcher.style.display = 'none'; 
        container.style.display = 'flex'; 
        document.getElementById('fsrs-current-tags').innerText = getAutoTags().join(', ');
        refreshWidgetState();
    });
    
    document.getElementById('fsrs-min-btn').addEventListener('click', () => { container.style.display = 'none'; launcher.style.display = 'flex'; });
    document.getElementById('fsrs-close-btn').addEventListener('click', () => { container.style.display = 'none'; launcher.style.display = 'none'; });

    // Handle saving an edit WITHOUT logging a review
    document.getElementById('fsrs-update-text-btn').addEventListener('click', (e) => {
        const existingId = document.getElementById('fsrs-save-ratings').getAttribute('data-existing-id');
        if (existingId) {
            const index = cards.findIndex(c => c.id === existingId);
            if (index > -1) {
                cards[index].approach = document.getElementById('fsrs-approach').value;
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

    // Handle Create OR Review Existing Page
    document.getElementById('fsrs-save-ratings').querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const approach = document.getElementById('fsrs-approach').value;
            if (!approach) return alert("Please enter your approach.");
            
            const rating = parseInt(e.target.getAttribute('data-rating'));
            const existingId = document.getElementById('fsrs-save-ratings').getAttribute('data-existing-id');
            const cleanUrl = window.location.href.split('?')[0].split('#')[0];
            const problemTitle = document.title.replace(' - AlgoMonster', '').trim();

            if (existingId) {
                // Update text and force an early review
                const index = cards.findIndex(c => c.id === existingId);
                if (index > -1) {
                    cards[index].approach = approach;
                    cards[index] = fsrs.reviewCard(cards[index], rating);
                    cards[index].lastRating = rating; // NEW: Save last rating
                }
            } else {
                // Create a completely new card
                let newCard = fsrs.createCard(problemTitle, cleanUrl, "", approach, getAutoTags());
                newCard = fsrs.reviewCard(newCard, rating);
                newCard.lastRating = rating; // NEW: Save last rating
                cards.push(newCard);
            }

            saveCards();
            logReviewActivity(); 
            updateReviewCount();
            refreshWidgetState(); // Immediately update the UI highlights
            
            const originalText = e.target.innerText;
            e.target.innerText = "Saved ✓";
            setTimeout(() => e.target.innerText = originalText, 1500);
        });
    });

    document.getElementById('fsrs-review-btn').addEventListener('click', startReview);
}

function getDueCards() {
    const now = new Date().getTime();
    return cards.filter(c => c.due <= now).sort((a, b) => a.due - b.due);
}

function updateReviewCount() {
    const btn = document.getElementById('fsrs-review-btn');
    if (btn) btn.innerText = `Review Due Cards (${getDueCards().length})`;
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

    const tagsHtml = currentCard.tags?.length ? `<div style="font-size: 11px; color: #888; margin-bottom: 8px;">🏷️ ${currentCard.tags.join(', ')}</div>` : '';

    // FIX 2: Added Back Button inside the Review UI Header
    reviewUi.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 5px;">
            <h4 style="margin:0;">${currentCard.problemTitle}</h4>
            <button id="fsrs-back-btn" title="Go Back" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 12px; font-weight: bold;">← Back</button>
        </div>
        ${tagsHtml}
        <p style="margin-bottom: 15px;">
            <a href="${currentCard.problemUrl}" target="_blank" style="color: #4CAF50; text-decoration: none; font-weight: bold; border-bottom: 1px solid #4CAF50;">🔗 Open Problem Page</a>
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
            updateReviewCount();
            if (getDueCards().length > 0) startReview();
            else refreshWidgetState(); // Reset UI cleanly when deck is finished
        });
    });
}