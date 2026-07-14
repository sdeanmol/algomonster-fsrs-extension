let allCards = [];
let currentView = 'total';
let targetDate = null;

let searchQuery = '';
let selectedTag = 'all';
let selectedStatus = 'all';

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentView = urlParams.get('view') || 'total';
    targetDate = urlParams.get('date');

    chrome.storage.local.get(['fsrsCards'], (result) => {
        allCards = result.fsrsCards || [];
        
        // Dynamic Filter Populators
        populateTagsFilter();
        
        // Listeners
        const searchInput = document.getElementById('search-input');
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            filterAndRender();
        });

        const tagSelect = document.getElementById('tag-select');
        tagSelect.addEventListener('change', (e) => {
            selectedTag = e.target.value;
            filterAndRender();
        });

        const statusSelect = document.getElementById('status-select');
        statusSelect.addEventListener('change', (e) => {
            selectedStatus = e.target.value;
            filterAndRender();
        });

        const clearBtn = document.getElementById('clear-filters-btn');
        clearBtn.addEventListener('click', () => {
            searchQuery = '';
            selectedTag = 'all';
            selectedStatus = 'all';

            searchInput.value = '';
            tagSelect.value = 'all';
            statusSelect.value = 'all';

            filterAndRender();
        });

        filterAndRender();
    });
});

function populateTagsFilter() {
    const tagSelect = document.getElementById('tag-select');
    if (!tagSelect) return;

    // Collect all unique tags
    const tagsSet = new Set();
    allCards.forEach(card => {
        if (card.tags && Array.isArray(card.tags)) {
            card.tags.forEach(t => tagsSet.add(t));
        }
    });

    // Populate select
    tagsSet.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagSelect.appendChild(option);
    });
}

function filterAndRender() {
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    const contentEl = document.getElementById('data-content');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const now = new Date().getTime();

    // 1. Build Base Dataset according to view
    let baseCards = [];
    let isRetention = false;

    if (currentView === 'total') {
        titleEl.innerText = 'Total Saved Patterns';
        baseCards = [...allCards];
    } 
    else if (currentView === 'due') {
        baseCards = allCards.filter(c => c.due <= now).sort((a, b) => a.due - b.due);
        titleEl.innerText = 'Patterns Due Today';
    } 
    else if (currentView === 'retention') {
        isRetention = true;
        baseCards = allCards.filter(c => c.lapses > 0).sort((a, b) => b.lapses - a.lapses);
        titleEl.innerText = 'Retention & Analytics';
    }
    else if (currentView === 'history' && targetDate) {
        const filteredCards = allCards.filter(c => {
            if (!c.historyLog) return false;
            return c.historyLog.some(timestamp => {
                const dateObj = new Date(timestamp);
                const localDateStr = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
                return localDateStr.startsWith(targetDate);
            });
        });
        baseCards = [...new Set(filteredCards)]; // Deduplicate
        
        let dateDisplay = targetDate;
        if (targetDate.length === 7) {
            const [y, m] = targetDate.split('-');
            const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
            dateDisplay = `${monthNames[parseInt(m)-1]} ${y}`;
        } else if (targetDate.length === 10) {
            dateDisplay = new Date(targetDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        }
        titleEl.innerText = `Activity for ${dateDisplay}`;
    }
    // R2.2: Forecast view — cards due on a specific future date
    else if (currentView === 'forecast' && targetDate) {
        const urlParams = new URLSearchParams(window.location.search);
        const dayOffset = parseInt(urlParams.get('offset') || '0');

        // Build day boundaries for the target date
        const targetParts = targetDate.split('-');
        const targetDayStart = new Date(parseInt(targetParts[0]), parseInt(targetParts[1]) - 1, parseInt(targetParts[2]));
        const targetDayEnd = new Date(targetDayStart);
        targetDayEnd.setDate(targetDayEnd.getDate() + 1);

        const targetStartTime = targetDayStart.getTime();
        const targetEndTime = targetDayEnd.getTime();

        if (dayOffset === 0) {
            // Today: cards due now (due <= end of today) — includes past-due
            baseCards = allCards.filter(c => c.due < targetEndTime);
        } else {
            // Future day: cards due within [dayStart, dayEnd)
            baseCards = allCards.filter(c => c.due >= targetStartTime && c.due < targetEndTime);
        }

        baseCards.sort((a, b) => a.due - b.due);

        const dateDisplay = new Date(targetDate + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        titleEl.innerText = `Cards Due — ${dateDisplay}`;
    }

    // 2. Filter base dataset
    let filtered = baseCards.filter(card => {
        // A. Search query check
        const titleMatch = card.problemTitle && card.problemTitle.toLowerCase().includes(searchQuery.toLowerCase());
        const urlMatch = card.problemUrl && card.problemUrl.toLowerCase().includes(searchQuery.toLowerCase());
        const tagMatch = card.tags && card.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
        
        const matchesSearch = !searchQuery || titleMatch || urlMatch || tagMatch;

        // B. Tag check
        const matchesTag = selectedTag === 'all' || (card.tags && card.tags.includes(selectedTag));

        // C. Status check
        const isCardDue = card.due <= now;
        const matchesStatus = selectedStatus === 'all' || 
                              (selectedStatus === 'due' && isCardDue) || 
                              (selectedStatus === 'safe' && !isCardDue);

        return matchesSearch && matchesTag && matchesStatus;
    });

    // 3. Toggle reset button
    const isFilterActive = searchQuery !== '' || selectedTag !== 'all' || selectedStatus !== 'all';
    if (clearFiltersBtn) {
        clearFiltersBtn.style.display = isFilterActive ? 'inline-block' : 'none';
    }

    // 4. Subtitle Stats
    if (currentView === 'total') {
        subtitleEl.innerText = isFilterActive 
            ? `Showing ${filtered.length} matching pattern(s) out of ${allCards.length} total.`
            : `You have saved ${allCards.length} algorithmic patterns.`;
    } else if (currentView === 'due') {
        subtitleEl.innerText = isFilterActive
            ? `Showing ${filtered.length} matching due pattern(s) out of ${baseCards.length} due today.`
            : `You have ${baseCards.length} pattern(s) awaiting review.`;
    } else if (currentView === 'retention') {
        let totalReps = 0; let totalLapses = 0;
        allCards.forEach(c => { totalReps += c.reps || 0; totalLapses += c.lapses || 0; });
        const retentionRate = totalReps > 0 ? Math.round(((totalReps - totalLapses) / totalReps) * 100) : 0;
        subtitleEl.innerText = `Overall Memory Retention: ${retentionRate}% (${totalReps} total reviews, ${totalLapses} forgotten patterns).`;
    } else if (currentView === 'history') {
        subtitleEl.innerText = `You reviewed ${filtered.length} unique pattern(s) during this period.`;
    } else if (currentView === 'forecast') {
        subtitleEl.innerText = isFilterActive
            ? `Showing ${filtered.length} matching pattern(s) out of ${baseCards.length} due on this date.`
            : `${baseCards.length} pattern(s) scheduled for review on this date.`;
    }

    // 5. Render
    contentEl.innerHTML = '';
    
    // Retention Specific title insertion
    if (currentView === 'retention' && baseCards.length > 0) {
        const titleHeader = document.createElement('h3');
        titleHeader.textContent = "Most Forgotten Patterns";
        contentEl.appendChild(titleHeader);
    }

    if (filtered.length === 0) {
        contentEl.innerHTML += `<div class="empty-state">No matching patterns found. Try adjusting your filters.</div>`;
        return;
    }

    contentEl.innerHTML += generateCardsTable(filtered, isRetention);
    bindDeleteButtons();
}

function generateCardsTable(cardsArray, showLapses = false) {
    const now = new Date().getTime();
    let table = `<table><thead><tr>
        <th>Problem Title</th>
        <th>Tags</th>
        <th>Next Due</th>
        <th>Reviews</th>
        <th>Stability</th>
        <th>Difficulty</th>
        ${showLapses ? '<th>Lapses</th>' : ''}
        <th>Actions</th>
    </tr></thead><tbody>`;

    cardsArray.forEach(card => {
        const isPastDue = card.due <= now;
        const statusBadge = isPastDue 
            ? '<span class="badge badge-due">Due Now</span>' 
            : `<span class="badge badge-safe">${new Date(card.due).toLocaleDateString()}</span>`;
            
        const tagsHtml = (card.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
        const reps = card.reps || 0;
        const lapses = card.lapses || 0;
        
        // Format FSRS stats beautifully
        const stabilityFormatted = card.stability > 0 ? `${card.stability.toFixed(1)}d` : 'New';
        const difficultyFormatted = card.difficulty > 0 ? `${card.difficulty.toFixed(1)}/10` : 'N/A';

        table += `<tr>
            <td><a href="${card.problemUrl}" target="_blank">${card.problemTitle}</a></td>
            <td>${tagsHtml}</td>
            <td>${statusBadge}</td>
            <td>${reps}</td>
            <td>${stabilityFormatted}</td>
            <td>${difficultyFormatted}</td>
            ${showLapses ? `<td class="warning">${lapses}</td>` : ''}
            <td>
                <button class="delete-card-btn" data-id="${card.id}" title="Remove Card from Reviews">
                    <svg class="svg-icon" viewBox="0 0 24 24" style="width:14px; height:14px; stroke:currentColor;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </td>
        </tr>`;
    });
    
    return table + `</tbody></table>`;
}

function bindDeleteButtons() {
    document.querySelectorAll('.delete-card-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const cardId = e.currentTarget.getAttribute('data-id');
            if (confirm("Are you sure you want to remove this card from future FSRS reviews? This will delete the repetition history for this pattern.")) {
                allCards = allCards.filter(c => c.id !== cardId);
                chrome.storage.local.set({ fsrsCards: allCards }, () => {
                    populateTagsFilter();
                    filterAndRender();
                });
            }
        });
    });
}