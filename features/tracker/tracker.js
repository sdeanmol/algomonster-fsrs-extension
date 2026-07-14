window.AlgoRecall = window.AlgoRecall || {};

/**
 * @class FSRSTracker
 * @description Main Spaced Repetition floating widget interface injected inside target domains.
 * Provides controls for recording approaches, entering study card notes, assigning initial difficulty,
 * tagging, drag positioning toggles, and executing interactive revision card sessions with hotkeys.
 */
window.AlgoRecall.Tracker = class Tracker {
    constructor() {
        this.activeReviewFilter = null;
        this.reviewIndex = 0;
        this.totalToReview = 0;
        this._reviewKeyHandler = null;
        this.isListenersBound = false;
        
        // Bind functions to avoid lexical context issues
        this.saveDraft = this.saveDraft.bind(this);
    }

    /**
     * Helper to retrieve state.
     */
    get state() {
        return window.AlgoRecall.state;
    }

    /**
     * Helper to retrieve utils.
     */
    get utils() {
        return window.AlgoRecall.Utils;
    }

    /**
     * Helper to retrieve notifier.
     */
    get notifier() {
        return window.AlgoRecall.Notifier;
    }

    /**
     * Commits the current cards array to Chrome local storage sync.
     */
    saveCards() {
        chrome.storage.local.set({ fsrsCards: this.state.cards });
    }

    /**
     * Registers a revision event in review activity logs in storage.
     * Records counts grouped by calendar date string in user's timezone.
     */
    logReviewActivity() {
        chrome.storage.local.get(['fsrsActivity'], (result) => {
            const activity = result.fsrsActivity || {};
            const today = new Date();
            const dateString = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            activity[dateString] = (activity[dateString] || 0) + 1;
            chrome.storage.local.set({ fsrsActivity: activity });
        });
    }

    /**
     * Synchronizes the floating widget UI status to align with page states.
     * Re-reads active problem card status to toggle note-saving button modes or display rating metrics.
     */
    refreshWidgetState() {
        const container = document.getElementById('algo-fsrs-container');
        if (!container) return;

        // Reset to default view on SPA navigation
        const reviewUi = document.getElementById('fsrs-review-ui');
        if (reviewUi) {
            reviewUi.style.display = 'none';
            reviewUi.innerHTML = ''; // Clear review session completely
        }
        document.getElementById('fsrs-body').style.display = 'block';

        const cleanUrl = window.location.href.split('?')[0].split('#')[0];
        const existingCard = this.state.cards.find(c => c.problemUrl.split('?')[0].split('#')[0] === cleanUrl);
        
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
                        tagsInput.value = this.utils.getAutoTags().join(', ');
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

    /**
     * Creates and injects the floating launcher icon and FSRS details container widget
     * inside the document body. Binds drag handlers, action events, and navigation click list hooks.
     */
    createUI() {
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
                    <input type="text" id="fsrs-tags-input" class="fsrs-tags-input" placeholder="Add tags (comma separated)..." value="${this.utils.getAutoTags().join(', ')}">
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

        const onMouseMove = (e) => {
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
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            setTimeout(() => {
                launcher.style.cursor = 'pointer';
            }, 50);
        };

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
            this.refreshWidgetState();
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
            const existingCard = this.state.cards.find(c => c.problemUrl.split('?')[0].split('#')[0] === cleanUrl);

            if (existingCard) {
                existingCard.approach = currentText;
                existingCard.tags = currentTagsText.split(',').map(t => t.trim()).filter(t => t.length > 0);
                this.saveCards();
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

        document.getElementById('fsrs-approach').addEventListener('input', this.saveDraft);
        document.getElementById('fsrs-tags-input').addEventListener('input', this.saveDraft);

        document.getElementById('fsrs-delete-card-btn').addEventListener('click', () => {
            const cleanUrl = window.location.href.split('?')[0].split('#')[0];
            const existingCard = this.state.cards.find(c => c.problemUrl.split('?')[0].split('#')[0] === cleanUrl);
            if (existingCard) {
                if (confirm("Remove this card from future reviews? This will delete the card and its repetition history.")) {
                    this.state.cards = this.state.cards.filter(c => c.id !== existingCard.id);
                    this.saveCards();
                    this.refreshWidgetState();
                }
            }
        });

        document.getElementById('fsrs-update-text-btn').addEventListener('click', (e) => {
            const existingId = document.getElementById('fsrs-save-ratings').getAttribute('data-existing-id');
            if (existingId) {
                const index = this.state.cards.findIndex(c => c.id === existingId);
                if (index > -1) {
                    this.state.cards[index].approach = document.getElementById('fsrs-approach').value;
                    const tagsVal = document.getElementById('fsrs-tags-input').value;
                    this.state.cards[index].tags = tagsVal.split(',').map(t => t.trim()).filter(t => t.length > 0);
                    this.saveCards();

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
                const problemTitle = this.utils.getExtractedProblemTitle();

                // Dynamic Topic Weights mapping
                let customWeights = null;
                if (this.state.topicWeights && parsedTags && parsedTags.length > 0) {
                    for (const tag of parsedTags) {
                        if (this.state.topicWeights[tag]) {
                            customWeights = this.state.topicWeights[tag];
                            break;
                        }
                    }
                }

                if (existingId) {
                    const index = this.state.cards.findIndex(c => c.id === existingId);
                    if (index > -1) {
                        this.state.cards[index].approach = approach;
                        this.state.cards[index].tags = parsedTags;
                        this.state.cards[index] = this.state.fsrs.reviewCard(this.state.cards[index], rating, customWeights);
                        this.state.cards[index].lastRating = rating; 
                    }
                } else {
                    let newCard = this.state.fsrs.createCard(problemTitle, cleanUrl, "", approach, parsedTags);
                    newCard = this.state.fsrs.reviewCard(newCard, rating, customWeights);
                    newCard.lastRating = rating; 
                    this.state.cards.push(newCard);
                }

                this.saveCards();

                // Clear draft if it exists
                chrome.storage.local.get(['approachDrafts'], (res) => {
                    const drafts = res.approachDrafts || {};
                    if (drafts[cleanUrl]) {
                        delete drafts[cleanUrl];
                        chrome.storage.local.set({ approachDrafts: drafts });
                    }
                });

                this.logReviewActivity();
                this.refreshWidgetState();

                const originalText = e.target.innerText;
                e.target.innerText = "Saved ✓";
                setTimeout(() => e.target.innerText = originalText, 1500);
            });
        });

        if (window.AlgoRecall.orchestrator) {
            window.AlgoRecall.orchestrator.applyThemeClass();
        }
    }

    /**
     * Saves a draft copy of the active editor contents (approach notes + tags)
     * to local storage, ensuring content is retained during inadvertent navigation.
     */
    saveDraft() {
        const cleanUrl = window.location.href.split('?')[0].split('#')[0];
        const existingCard = this.state.cards.find(c => c.problemUrl.split('?')[0].split('#')[0] === cleanUrl);
        
        const approachTextEl = document.getElementById('fsrs-approach');
        const tagsInputEl = document.getElementById('fsrs-tags-input');
        if (!approachTextEl || !tagsInputEl) return;

        const text = approachTextEl.value;
        const tagsText = tagsInputEl.value;

        if (existingCard) {
            existingCard.approach = text;
            existingCard.tags = tagsText.split(',').map(t => t.trim()).filter(t => t.length > 0);
            this.saveCards();
        } else {
            chrome.storage.local.get(['approachDrafts'], (res) => {
                const drafts = res.approachDrafts || {};
                drafts[cleanUrl] = { approach: text, tags: tagsText };
                chrome.storage.local.set({ approachDrafts: drafts });
            });
        }
    }

    /**
     * Returns a sorted list of due study cards based on the scheduled FSRS timestamp.
     * Optionally filters cards matching a target tag chip selection.
     * @param {string} [filterTag] - Optional tag name identifier. Use '__all__' to bypass filter.
     * @returns {Object[]} Sorted list of due card schemas.
     */
    getDueCards(filterTag) {
        const now = new Date().getTime();
        let due = this.state.cards.filter(c => c.due <= now);
        if (filterTag && filterTag !== '__all__') {
            due = due.filter(c => c.tags && c.tags.includes(filterTag));
        }
        return due.sort((a, b) => a.due - b.due);
    }

    /**
     * Initiates the revision session sequence. Collects unique tags from due cards
     * and prompts users with a tag-based topics picker menu if multiple topics are due.
     */
    startReview() {
        const allDue = this.getDueCards();
        if (allDue.length === 0) {
            alert("No cards due right now!");
            return;
        }

        // Collect unique tags from due cards
        const tagSet = new Set();
        allDue.forEach(c => { if (c.tags) c.tags.forEach(t => tagSet.add(t)); });
        const uniqueTags = [...tagSet].sort();

        // If only one tag (or none), skip picker and go straight to review
        if (uniqueTags.length <= 1) {
            this.activeReviewFilter = null;
            this._startReviewSession();
            return;
        }

        // Show tag picker UI
        const reviewUi = document.getElementById('fsrs-review-ui');
        document.getElementById('fsrs-body').style.display = 'none';
        reviewUi.style.display = 'block';

        const tagChipsHtml = uniqueTags.map(tag => {
            const count = allDue.filter(c => c.tags && c.tags.includes(tag)).length;
            return `<button class="fsrs-tag-chip" data-tag="${tag}">${tag} <span class="fsrs-tag-count">${count}</span></button>`;
        }).join('');

        reviewUi.innerHTML = `
            <div class="fsrs-tag-picker">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <h4 style="margin:0; font-size: 13px;">Select Topics to Review</h4>
                    <button id="fsrs-picker-back-btn" title="Go Back" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                        Back
                    </button>
                </div>
                <div class="fsrs-tag-chips-container">
                    <button class="fsrs-tag-chip fsrs-tag-chip-active" data-tag="__all__">All Topics <span class="fsrs-tag-count">${allDue.length}</span></button>
                    ${tagChipsHtml}
                </div>
                <button id="fsrs-start-filtered-btn" class="fsrs-primary-btn" style="margin-top: 14px;">
                    <svg class="svg-icon" viewBox="0 0 24 24" style="width: 14px; height: 14px; stroke: currentColor;"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    Start Review
                </button>
            </div>
        `;

        // Tag chip selection logic
        const chips = reviewUi.querySelectorAll('.fsrs-tag-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('fsrs-tag-chip-active'));
                chip.classList.add('fsrs-tag-chip-active');
            });
        });

        // Back button
        document.getElementById('fsrs-picker-back-btn').addEventListener('click', () => {
            reviewUi.style.display = 'none';
            reviewUi.innerHTML = '';
            document.getElementById('fsrs-body').style.display = 'block';
            this.refreshWidgetState();
        });

        // Start button
        document.getElementById('fsrs-start-filtered-btn').addEventListener('click', () => {
            const activeChip = reviewUi.querySelector('.fsrs-tag-chip-active');
            this.activeReviewFilter = activeChip ? activeChip.getAttribute('data-tag') : null;
            if (this.activeReviewFilter === '__all__') this.activeReviewFilter = null;
            this._startReviewSession();
        });
    }

    /**
     * Launches the review queue display sequence, looping cards in the due stack.
     * Manages card detail rendering, answer displays, and keypress event hooks.
     * @private
     */
    _startReviewSession() {
        const dueCards = this.getDueCards(this.activeReviewFilter);
        if (dueCards.length === 0) {
            alert("No cards due for this filter!");
            this.activeReviewFilter = null;
            return;
        }

        this.totalToReview = dueCards.length;
        this.reviewIndex = 0;

        this.showCard();
    }

    /**
     * Renders the next due card details, binding ratings listeners and key navigation hooks.
     */
    showCard() {
        const remaining = this.getDueCards(this.activeReviewFilter);
        if (remaining.length === 0) {
            this._cleanupReviewKeyboard();
            const reviewUi = document.getElementById('fsrs-review-ui');
            reviewUi.style.display = 'none';
            reviewUi.innerHTML = '';
            document.getElementById('fsrs-body').style.display = 'block';
            this.activeReviewFilter = null;
            this.refreshWidgetState();
            return;
        }

        this.reviewIndex++;
        const currentCard = remaining[0];
        const reviewUi = document.getElementById('fsrs-review-ui');
        document.getElementById('fsrs-body').style.display = 'none';
        reviewUi.style.display = 'block';

        const tagsHtml = currentCard.tags?.length ? `<div style="font-size: 11px; color: #888; margin-bottom: 8px; display: flex; align-items: center; gap: 4px;">
            <svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #888; width: 13px; height: 13px;"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
            <span>${currentCard.tags.join(', ')}</span>
        </div>` : '';

        const filterBadge = this.activeReviewFilter 
            ? `<div class="fsrs-filter-badge">
                <svg class="svg-icon" viewBox="0 0 24 24" style="width: 11px; height: 11px;"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                ${this.activeReviewFilter}
               </div>` 
            : '';

        const progressPct = Math.round((this.reviewIndex / this.totalToReview) * 100);

        // Render approach with Markdown
        const approachHtml = typeof renderMarkdown === 'function' 
            ? renderMarkdown(currentCard.approach) 
            : currentCard.approach.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

        reviewUi.innerHTML = `
            <div class="fsrs-review-header">
                <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
                    <h4 style="margin:0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${currentCard.problemTitle}</h4>
                    ${filterBadge}
                </div>
                <button id="fsrs-back-btn" title="Go Back" style="background: none; border: none; color: #aaa; cursor: pointer; font-size: 12px; font-weight: bold; display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                    <svg class="svg-icon" viewBox="0 0 24 24" style="width: 12px; height: 12px;"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Back
                </button>
            </div>
            <div class="fsrs-progress-bar">
                <div class="fsrs-progress-fill" style="width: ${progressPct}%;"></div>
            </div>
            <div class="fsrs-review-meta">
                <span class="fsrs-progress-text">${this.reviewIndex} of ${this.totalToReview}</span>
            </div>
            ${tagsHtml}
            <p style="margin-bottom: 15px;">
                <a href="${currentCard.problemUrl}" target="_blank" style="color: #4CAF50; text-decoration: none; font-weight: bold; border-bottom: 1px solid #4CAF50; display: inline-flex; align-items: center; gap: 4px;">
                    <svg class="svg-icon" viewBox="0 0 24 24" style="stroke: #4CAF50; width: 13px; height: 13px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                    Open Problem Page
                </a>
            </p>
            <div id="fsrs-approach-answer" style="display:none;">
                <div class="fsrs-markdown"><strong>Your Approach:</strong>${approachHtml}</div>
                <div class="fsrs-rating-buttons">
                    <div class="fsrs-rating-btn-wrapper">
                        <button data-rating="1" style="background:#e74c3c;">Again</button>
                        <kbd class="fsrs-kbd-hint">1</kbd>
                    </div>
                    <div class="fsrs-rating-btn-wrapper">
                        <button data-rating="2" style="background:#e67e22;">Hard</button>
                        <kbd class="fsrs-kbd-hint">2</kbd>
                    </div>
                    <div class="fsrs-rating-btn-wrapper">
                        <button data-rating="3" style="background:#2ecc71;">Good</button>
                        <kbd class="fsrs-kbd-hint">3</kbd>
                    </div>
                    <div class="fsrs-rating-btn-wrapper">
                        <button data-rating="4" style="background:#3498db;">Easy</button>
                        <kbd class="fsrs-kbd-hint">4</kbd>
                    </div>
                </div>
            </div>
            <button id="fsrs-show-answer-btn" class="fsrs-primary-btn">
                <span>Show Approach</span>
                <kbd class="fsrs-kbd-hint" style="margin-left: 8px;">Space</kbd>
            </button>
        `;

        // Handle Back Button Click
        document.getElementById('fsrs-back-btn').addEventListener('click', () => {
            this._cleanupReviewKeyboard();
            reviewUi.style.display = 'none';
            reviewUi.innerHTML = '';
            document.getElementById('fsrs-body').style.display = 'block';
            this.activeReviewFilter = null;
            this.refreshWidgetState();
        });

        document.getElementById('fsrs-show-answer-btn').addEventListener('click', (e) => {
            e.currentTarget.style.display = 'none';
            document.getElementById('fsrs-approach-answer').style.display = 'block';
        });

        // Rating button click handlers
        reviewUi.querySelectorAll('.fsrs-rating-buttons button[data-rating]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleRating(currentCard, parseInt(e.currentTarget.getAttribute('data-rating')));
                this.showCard();
            });
        });

        // Keyboard shortcuts
        this._cleanupReviewKeyboard();
        this._reviewKeyHandler = (e) => {
            // Don't intercept if user is typing in an input/textarea
            const active = document.activeElement;
            if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) return;

            const showBtn = document.getElementById('fsrs-show-answer-btn');
            const answerDiv = document.getElementById('fsrs-approach-answer');

            // Space or Enter to show answer
            if ((e.code === 'Space' || e.code === 'Enter') && showBtn && showBtn.style.display !== 'none') {
                e.preventDefault();
                showBtn.style.display = 'none';
                if (answerDiv) answerDiv.style.display = 'block';
                return;
            }

            // 1-4 for ratings (only when answer is visible)
            if (answerDiv && answerDiv.style.display !== 'none') {
                const ratingMap = { 'Digit1': 1, 'Digit2': 2, 'Digit3': 3, 'Digit4': 4, 'Numpad1': 1, 'Numpad2': 2, 'Numpad3': 3, 'Numpad4': 4 };
                const rating = ratingMap[e.code];
                if (rating) {
                    e.preventDefault();
                    this.handleRating(currentCard, rating);
                    this.showCard();
                }
            }
        };
        document.addEventListener('keydown', this._reviewKeyHandler);
    }

    /**
     * Applies the review rating to a target card, calculates new FSRS scheduler values,
     * updates storage databases, and logs activity increments.
     * @param {Object} card - The card structure being rated.
     * @param {number} rating - The target study quality rating (1-4).
     */
    handleRating(card, rating) {
        const index = this.state.cards.findIndex(c => c.id === card.id);
        if (index === -1) return;

        // Determine if this card has a tag that matches a custom weight profile
        let customWeightsToApply = null;
        if (card.tags && card.tags.length > 0) {
            for (const tag of card.tags) {
                if (this.state.topicWeights[tag]) {
                    customWeightsToApply = this.state.topicWeights[tag];
                    break;
                }
            }
        }

        this.state.cards[index] = this.state.fsrs.reviewCard(card, rating, customWeightsToApply);
        this.state.cards[index].lastRating = rating;
        this.saveCards();
        this.logReviewActivity();
    }

    /**
     * Removes global document event listeners for hotkeys bound during card reviews.
     * @private
     */
    _cleanupReviewKeyboard() {
        if (this._reviewKeyHandler) {
            document.removeEventListener('keydown', this._reviewKeyHandler);
            this._reviewKeyHandler = null;
        }
    }
};
