// features/tracker/tracker.js - Spaced repetition tracker UI widget & logic

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
            cards[index].lastRating = rating; // Save last rating

            saveCards();
            logReviewActivity();

            reviewUi.style.display = 'none';
            document.getElementById('fsrs-body').style.display = 'block';
            if (getDueCards().length > 0) startReview();
            else refreshWidgetState(); // Reset UI cleanly when deck is finished
        });
    });
}
