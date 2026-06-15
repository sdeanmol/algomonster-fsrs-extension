document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') || 'total';

    chrome.storage.local.get(['fsrsCards'], (result) => {
        const cards = result.fsrsCards || [];
        renderView(view, cards);
    });
});

function renderView(view, cards) {
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    const contentEl = document.getElementById('data-content');
    const now = new Date().getTime();

    if (view === 'total') {
        titleEl.innerText = 'Total Saved Patterns';
        subtitleEl.innerText = `You have saved ${cards.length} algorithmic patterns to your spaced repetition tracker.`;
        contentEl.innerHTML = generateCardsTable(cards);
    } 
    else if (view === 'due') {
        const dueCards = cards.filter(c => c.due <= now).sort((a, b) => a.due - b.due);
        titleEl.innerText = 'Patterns Due Today';
        subtitleEl.innerText = `You have ${dueCards.length} pattern(s) awaiting your review.`;
        contentEl.innerHTML = dueCards.length > 0 ? generateCardsTable(dueCards) : '<p>All caught up! Great job.</p>';
    } 
    else if (view === 'retention') {
        let totalReps = 0;
        let totalLapses = 0;
        cards.forEach(c => {
            totalReps += c.reps || 0;
            totalLapses += c.lapses || 0;
        });

        const retentionRate = totalReps > 0 ? Math.round(((totalReps - totalLapses) / totalReps) * 100) : 0;
        
        // Sort cards by lapses (mistakes) to find the hardest algorithms
        const hardestCards = [...cards].sort((a, b) => (b.lapses || 0) - (a.lapses || 0)).filter(c => c.lapses > 0);

        titleEl.innerText = 'Retention & Analytics';
        subtitleEl.innerText = `Overall Memory Retention: ${retentionRate}% (${totalReps} total reviews, ${totalLapses} forgotten patterns).`;
        
        let html = `<h3>Your Most Forgotten Patterns</h3>`;
        if (hardestCards.length > 0) {
            html += generateCardsTable(hardestCards, true);
        } else {
            html += `<p>You haven't lapsed on any cards yet. Keep reviewing!</p>`;
        }
        contentEl.innerHTML = html;
    }
}

function generateCardsTable(cardsArray, showLapses = false) {
    let table = `
        <table>
            <thead>
                <tr>
                    <th>Problem Title</th>
                    <th>Tags</th>
                    <th>Next Due</th>
                    <th>Reviews</th>
                    ${showLapses ? '<th>Times Forgotten</th>' : ''}
                </tr>
            </thead>
            <tbody>
    `;

    cardsArray.forEach(card => {
        const dueStr = new Date(card.due).toLocaleDateString();
        const isPastDue = card.due <= new Date().getTime() ? '<span class="warning">Due Now</span>' : dueStr;
        
        const tagsHtml = (card.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
        
        table += `
            <tr>
                <td><a href="${card.problemUrl}" target="_blank">${card.problemTitle}</a></td>
                <td>${tagsHtml}</td>
                <td>${isPastDue}</td>
                <td>${card.reps || 0}</td>
                ${showLapses ? `<td class="warning">${card.lapses || 0}</td>` : ''}
            </tr>
        `;
    });

    table += `</tbody></table>`;
    return table;
}