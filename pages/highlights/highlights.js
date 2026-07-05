document.addEventListener('DOMContentLoaded', () => {
    loadHighlights();

    document.getElementById('refresh-btn').addEventListener('click', () => {
        loadHighlights();
    });
});

function loadHighlights() {
    chrome.storage.local.get(['marks', 'bookmarks'], (result) => {
        const marks = result.marks || [];
        const bookmarks = result.bookmarks || [];
        
        const subtitle = document.getElementById('highlight-subtitle');
        subtitle.innerText = `You have ${marks.length} saved highlight(s).`;
        
        renderHighlights(marks, bookmarks);
    });
}

function renderHighlights(marks, bookmarks) {
    const container = document.getElementById('highlights-container');
    container.innerHTML = '';

    if (marks.length === 0) {
        container.innerHTML = `<div class="empty-state">You haven't highlighted any text yet.</div>`;
        return;
    }

    // Sort newest highlights to the top
    marks.sort((a, b) => b.createdAt - a.createdAt);

    marks.forEach(mark => {
        // Fallback to createdAt for older schema items that lack a unique 'id'
        const markId = mark.id || mark.createdAt.toString(); 
        
        // Find page title from bookmarks, fallback to URL if not found
        const bookmark = bookmarks.find(b => b.url === mark.url);
        const pageTitle = bookmark && bookmark.title ? bookmark.title : mark.url;

        const card = document.createElement('div');
        card.className = 'highlight-card';
        card.style.borderLeftColor = mark.color;

        const dateString = new Date(mark.createdAt).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        card.innerHTML = `
            <div class="highlight-content">
                <div class="highlight-text">"${mark.text}"</div>
                <div class="highlight-meta">
                    <a href="${mark.url}" target="_blank" class="highlight-url">🔗 ${pageTitle}</a>
                    <span class="highlight-date">🗓️ ${dateString}</span>
                </div>
            </div>
            <button class="delete-btn" data-id="${markId}" title="Delete Highlight">🗑️</button>
        `;

        container.appendChild(card);
    });

    // Attach listeners to all delete buttons
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-id');
            deleteHighlight(targetId);
        });
    });
}

function deleteHighlight(markId) {
    if (confirm("Are you sure you want to delete this highlight?")) {
        chrome.storage.local.get(['marks'], (result) => {
            let marks = result.marks || [];
            
            // Filter out the deleted highlight
            marks = marks.filter(m => (m.id || m.createdAt.toString()) !== markId);
            
            chrome.storage.local.set({ marks }, () => {
                loadHighlights(); // Re-render the list immediately
            });
        });
    }
}