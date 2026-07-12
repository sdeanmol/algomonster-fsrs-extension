// content.js - Inject UI and handle interactions
const fsrs = new FSRS();
let cards = [];
let lastCheckedUrl = window.location.href;
let topicWeights = {};

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

chrome.storage.local.get(['fsrsCards', 'fsrsTopicWeights', 'marks', 'bookmarks', 'pagecontents', 'chromeSettings'], (result) => {
    if (result.fsrsCards) cards = result.fsrsCards;
    if (result.fsrsTopicWeights) topicWeights = result.fsrsTopicWeights;
    
    if (result.marks) marks = result.marks;
    if (result.bookmarks) bookmarks = result.bookmarks;
    if (result.pagecontents) pagecontents = result.pagecontents;
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

    // 2. Hydration Observer (Updates FSRS UI if the URL secretly changed via scroll)
    const domObserver = new MutationObserver(() => {
        clearTimeout(highlightDebounceTimer);
        highlightDebounceTimer = setTimeout(() => {
            applyHighlightsForCurrentPage();
            // If the URL changed without a click, force an update
            if (window.location.href !== lastCheckedUrl) {
                triggerAggressiveUIUpdate();
            }
        }, 100);
    });
    domObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
});

// 3. Listen for SPA URL changes directly from Chrome Background script
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "spa_url_changed") {
        setTimeout(triggerAggressiveUIUpdate, 50);
    }
});

// NEW: Centralized function to instantly refresh the widget content without destroying it
function triggerAggressiveUIUpdate() {
    lastCheckedUrl = window.location.href;
    
    if (!document.getElementById('algo-fsrs-container') && document.body) {
        createUI(); // Inject if the SPA accidentally destroyed it
    } else {
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

// --- HIGHLIGHTER CORE LOGIC ---

function createHighlighterUI() {
    if (document.getElementById('algo-highlight-tooltip')) return;

    const tooltip = document.createElement('div');
    tooltip.id = 'algo-highlight-tooltip';
    document.body.appendChild(tooltip);

    // 1. Text Selection Logic (For NEW highlights)
    document.addEventListener('mouseup', (e) => {
        if (!chromeSettings.showMarkerPopup) return;
        if (e.target.closest('#algo-highlight-tooltip') || e.target.closest('#algo-fsrs-container')) return;

        const selection = window.getSelection();
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
        const lastRect = rects[rects.length - 1];

        renderTooltipColors(null, null); 
        tooltip.style.display = 'flex';
        
        // Anchor to the bottom-right corner where the highlight ends
        tooltip.style.left = `${lastRect.right + window.scrollX}px`;
        tooltip.style.top = `${lastRect.bottom + window.scrollY}px`;
    });

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
        deleteBtn.innerHTML = '🗑️';
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
    const cleanUrl = window.location.href.split('#')[0]; 
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
        bookmarks.push({ url: cleanUrl, title: document.title, meta: { favIconUrl: 'https://algo.monster/favicon.ico' } });
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
    } catch (e) {}
    return null;
}

function applyHighlightsForCurrentPage() {
    if (!('highlights' in CSS)) return; 
    
    const cleanUrl = window.location.href.split('#')[0];
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

    // 1. CREATE LAUNCHER
    const launcher = document.createElement('div');
    launcher.id = 'algo-fsrs-launcher';
    launcher.innerText = '🧠'; 
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
                <span id="fsrs-current-tags">${getAutoTags().join(', ')}</span>
            </div>
            
            <div class="fsrs-approach-header">
                <label>Your Approach:</label>
                <button id="fsrs-update-text-btn" class="fsrs-secondary-btn" style="display:none;" title="Save edits without reviewing">💾 Save Edit</button>
            </div>
            <textarea id="fsrs-approach" class="fsrs-textarea" placeholder="How did you solve this pattern? Jot down your key insights..."></textarea>
            
            <div class="fsrs-rating-section">
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
    launcher.addEventListener('click', () => {
        launcher.style.display = 'none';
        container.style.display = 'block';
        refreshWidgetState();
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

    document.getElementById('fsrs-save-ratings').querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const approach = document.getElementById('fsrs-approach').value;
            if (!approach) return alert("Please enter your approach.");
            
            const rating = parseInt(e.target.getAttribute('data-rating'));
            const existingId = document.getElementById('fsrs-save-ratings').getAttribute('data-existing-id');
            const cleanUrl = window.location.href.split('?')[0].split('#')[0];
            const problemTitle = document.title.replace(' - AlgoMonster', '').trim();

            if (existingId) {
                const index = cards.findIndex(c => c.id === existingId);
                if (index > -1) {
                    cards[index].approach = approach;
                    cards[index] = fsrs.reviewCard(cards[index], rating);
                    cards[index].lastRating = rating; 
                }
            } else {
                let newCard = fsrs.createCard(problemTitle, cleanUrl, "", approach, getAutoTags());
                newCard = fsrs.reviewCard(newCard, rating);
                newCard.lastRating = rating; 
                cards.push(newCard);
            }

            saveCards();
            logReviewActivity(); 
            refreshWidgetState(); 
            
            const originalText = e.target.innerText;
            e.target.innerText = "Saved ✓";
            setTimeout(() => e.target.innerText = originalText, 1500);
        });
    });
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
            if (getDueCards().length > 0) startReview();
            else refreshWidgetState(); // Reset UI cleanly when deck is finished
        });
    });
}