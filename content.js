// content.js - Inject UI and handle interactions
const fsrs = new FSRS();
let cards = [];
let lastCheckedUrl = window.location.href;

chrome.storage.local.get(['fsrsCards'], (result) => {
    if (result.fsrsCards) cards = result.fsrsCards;
    createUI();
    
    // Listen for Single Page App (SPA) URL changes
    setInterval(() => {
        if (window.location.href !== lastCheckedUrl) {
            lastCheckedUrl = window.location.href;
            if (document.getElementById('algo-fsrs-container').style.display !== 'none') {
                refreshWidgetState();
            }
        }
    }, 500);
});

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

// NEW: Updates the UI based on whether the current page is already saved
function refreshWidgetState() {
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
            <div style="font-size: 11px; color: #888; margin-bottom: 8px;">🏷️ <span id="fsrs-current-tags"></span></div>
            
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
    if (dueCards.length === 0) return alert("No cards due right now!");

    let currentCard = dueCards[0];
    const reviewUi = document.getElementById('fsrs-review-ui');
    document.getElementById('fsrs-body').style.display = 'none';
    reviewUi.style.display = 'block';

    const tagsHtml = currentCard.tags?.length ? `<div style="font-size: 11px; color: #888; margin-bottom: 8px;">🏷️ ${currentCard.tags.join(', ')}</div>` : '';

    reviewUi.innerHTML = `
        <h4 style="margin-top:0; margin-bottom: 5px;">${currentCard.problemTitle}</h4>
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

    document.getElementById('fsrs-show-answer-btn').addEventListener('click', (e) => {
        e.target.style.display = 'none';
        document.getElementById('fsrs-approach-answer').style.display = 'block';
    });

    reviewUi.querySelectorAll('.fsrs-rating-buttons button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = cards.findIndex(c => c.id === currentCard.id);
            const rating = parseInt(e.target.getAttribute('data-rating'));
            
            cards[index] = fsrs.reviewCard(currentCard, rating);
            cards[index].lastRating = rating; // NEW: Save last rating here as well
            
            saveCards();
            logReviewActivity();

            reviewUi.style.display = 'none';
            document.getElementById('fsrs-body').style.display = 'block';
            updateReviewCount();
            if (getDueCards().length > 0) startReview();
        });
    });
}