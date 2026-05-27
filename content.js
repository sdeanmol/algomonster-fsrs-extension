const fsrs = new FSRS();
let cards = [];

chrome.storage.local.get(['fsrsCards'], (result) => {
    if (result.fsrsCards) cards = result.fsrsCards;
    createUI();
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
    } catch (e) { }
    return ["AlgoMonster"];
}

function createUI() {
    const launcher = document.createElement('div');
    launcher.id = 'algo-fsrs-launcher';
    launcher.innerText = '🧠';
    document.body.appendChild(launcher);

    const container = document.createElement('div');
    container.id = 'algo-fsrs-container';
    container.style.display = 'none';
    const currentTags = getAutoTags().join(', ');

    container.innerHTML = `
        <div id="fsrs-header">
            <span>FSRS Tracker</span>
            <div class="fsrs-controls">
                <button id="fsrs-min-btn" title="Minimize">_</button>
                <button id="fsrs-close-btn" title="Close">X</button>
            </div>
        </div>
        <div id="fsrs-body">
            <div style="font-size: 11px; color: #888; margin-bottom: 8px;">🏷️ ${currentTags}</div>
            <label>Your Approach:</label>
            <textarea id="fsrs-approach" placeholder="How did you solve this?" style="height: 80px;"></textarea>
            
            <p style="margin: 10px 0 5px 0; font-size: 12px; font-weight: bold; text-align: center;">Save & Rate Initial Difficulty:</p>
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

    launcher.addEventListener('click', () => { launcher.style.display = 'none'; container.style.display = 'flex'; });
    document.getElementById('fsrs-min-btn').addEventListener('click', () => { container.style.display = 'none'; launcher.style.display = 'flex'; });
    document.getElementById('fsrs-close-btn').addEventListener('click', () => { container.style.display = 'none'; launcher.style.display = 'none'; });

    document.getElementById('fsrs-save-ratings').querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const approach = document.getElementById('fsrs-approach').value;
            if (!approach) return alert("Please enter your approach.");

            let newCard = fsrs.createCard(document.title.replace(' - AlgoMonster', '').trim(), window.location.href, "", approach, getAutoTags());
            newCard = fsrs.reviewCard(newCard, parseInt(e.target.getAttribute('data-rating')));

            cards.push(newCard);
            saveCards();
            logReviewActivity();

            document.getElementById('fsrs-approach').value = '';
            updateReviewCount();

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
            cards[index] = fsrs.reviewCard(currentCard, parseInt(e.target.getAttribute('data-rating')));
            saveCards();
            logReviewActivity();

            reviewUi.style.display = 'none';
            document.getElementById('fsrs-body').style.display = 'block';
            updateReviewCount();
            if (getDueCards().length > 0) startReview();
        });
    });
}