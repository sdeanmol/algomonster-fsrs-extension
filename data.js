document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') || 'total';
    const targetDate = urlParams.get('date'); // Used for history views

    chrome.storage.local.get(['fsrsCards'], (result) => {
        const cards = result.fsrsCards || [];
        renderView(view, cards, targetDate);
    });
});

function renderView(view, cards, targetDate) {
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    const contentEl = document.getElementById('data-content');
    const now = new Date().getTime();

    if (view === 'total') {
        titleEl.innerText = 'Total Saved Patterns';
        subtitleEl.innerText = `You have saved ${cards.length} algorithmic patterns.`;
        contentEl.innerHTML = generateCardsTable(cards);
    } 
    else if (view === 'due') {
        const dueCards = cards.filter(c => c.due <= now).sort((a, b) => a.due - b.due);
        titleEl.innerText = 'Patterns Due Today';
        subtitleEl.innerText = `You have ${dueCards.length} pattern(s) awaiting your review.`;
        contentEl.innerHTML = dueCards.length > 0 ? generateCardsTable(dueCards) : '<p>All caught up! Great job.</p>';
    } 
    else if (view === 'retention') {
        let totalReps = 0; let totalLapses = 0;
        cards.forEach(c => { totalReps += c.reps || 0; totalLapses += c.lapses || 0; });
        const retentionRate = totalReps > 0 ? Math.round(((totalReps - totalLapses) / totalReps) * 100) : 0;
        const hardestCards = [...cards].sort((a, b) => (b.lapses || 0) - (a.lapses || 0)).filter(c => c.lapses > 0);

        titleEl.innerText = 'Retention & Analytics';
        subtitleEl.innerText = `Overall Memory Retention: ${retentionRate}% (${totalReps} total reviews, ${totalLapses} forgotten patterns).`;
        contentEl.innerHTML = hardestCards.length > 0 ? `<h3>Most Forgotten Patterns</h3>` + generateCardsTable(hardestCards, true) : `<p>You haven't lapsed on any cards yet. Keep reviewing!</p>`;
    }
    // NEW: Handle History Deep Links
    else if (view === 'history' && targetDate) {
        // Filter cards that have a history log timestamp starting with the target date (e.g. "2026-06")
        const filteredCards = cards.filter(c => {
            if (!c.historyLog) return false;
            return c.historyLog.some(timestamp => {
                const dateObj = new Date(timestamp);
                const localDateStr = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                return localDateStr.startsWith(targetDate);
            });
        });

        // Deduplicate in case a user reviewed the same card twice in the target period
        const uniqueCards = [...new Set(filteredCards)];

        // Format the Header nicely based on granularity
        let dateDisplay = targetDate;
        if (targetDate.length === 7) {
            const [y, m] = targetDate.split('-');
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            dateDisplay = `${monthNames[parseInt(m)-1]} ${y}`;
        } else if (targetDate.length === 10) {
            dateDisplay = new Date(targetDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }

        titleEl.innerText = `Activity for ${dateDisplay}`;
        subtitleEl.innerText = `You reviewed ${uniqueCards.length} unique pattern(s) during this period.`;
        
        if (uniqueCards.length > 0) {
            contentEl.innerHTML = generateCardsTable(uniqueCards);
        } else {
            // Friendly fallback message for reviews logged before this feature was added
            contentEl.innerHTML = `
                <div style="background: #2d2d2d; padding: 25px; border-radius: 8px; text-align: center; border: 1px solid #444; margin-top: 20px;">
                    <h3 style="color: #fff; margin-top: 0;">No Card Data Found</h3>
                    <p style="color: #bbb; line-height: 1.5;">We know you reviewed cards during this period, but their exact names cannot be retrieved.</p>
                    <p style="font-size: 12px; color: #888; margin-top: 15px; padding-top: 15px; border-top: 1px solid #444;">
                        <em>Why? Exact card history tracking was just added in v2.1. Older reviews will show in the activity numbers, but individual card records are only tracked moving forward.</em>
                    </p>
                </div>
            `;
        }
    }
}

function generateCardsTable(cardsArray, showLapses = false) {
    let table = `<table><thead><tr>
        <th>Problem Title</th><th>Tags</th><th>Next Due</th><th>Total Reviews</th>
        ${showLapses ? '<th>Times Forgotten</th>' : ''}
    </tr></thead><tbody>`;

    cardsArray.forEach(card => {
        const isPastDue = card.due <= new Date().getTime() ? '<span class="warning">Due Now</span>' : new Date(card.due).toLocaleDateString();
        const tagsHtml = (card.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
        table += `<tr>
            <td><a href="${card.problemUrl}" target="_blank">${card.problemTitle}</a></td>
            <td>${tagsHtml}</td><td>${isPastDue}</td><td>${card.reps || 0}</td>
            ${showLapses ? `<td class="warning">${card.lapses || 0}</td>` : ''}
        </tr>`;
    });
    return table + `</tbody></table>`;
}