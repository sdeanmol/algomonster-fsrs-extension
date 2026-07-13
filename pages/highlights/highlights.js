let loadedMarks = [];
let loadedBookmarks = [];

let searchQuery = '';
let activeColorFilter = null;
let activePageFilter = 'all';
let sortOption = 'newest';

document.addEventListener('DOMContentLoaded', () => {
    loadHighlights();

    // Refresh Button Handler
    document.getElementById('refresh-btn').addEventListener('click', () => {
        loadHighlights();
    });

    // Search Input Listener
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim();
        filterAndRender();
    });

    // Webpage Select Listener
    const webpageSelect = document.getElementById('webpage-select');
    webpageSelect.addEventListener('change', (e) => {
        activePageFilter = e.target.value;
        filterAndRender();
    });

    // Sort Select Listener
    const sortSelect = document.getElementById('sort-select');
    sortSelect.addEventListener('change', (e) => {
        sortOption = e.target.value;
        filterAndRender();
    });

    // Clear Filters Listener
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    clearFiltersBtn.addEventListener('click', () => {
        searchQuery = '';
        activeColorFilter = null;
        activePageFilter = 'all';
        sortOption = 'newest';

        searchInput.value = '';
        webpageSelect.value = 'all';
        sortSelect.value = 'newest';

        // Re-render color bubbles to clear active styling
        renderColorFilters();
        filterAndRender();
    });
});

function loadHighlights() {
    chrome.storage.local.get(['marks', 'bookmarks'], (result) => {
        loadedMarks = result.marks || [];
        loadedBookmarks = result.bookmarks || [];
        
        // Populate filter elements dynamically on initial load
        populateWebpageSelect();
        renderColorFilters();
        
        filterAndRender();
    });
}

function populateWebpageSelect() {
    const select = document.getElementById('webpage-select');
    if (!select) return;
    
    // Clear dynamic options
    select.innerHTML = '<option value="all">All Pages</option>';

    // Extract unique pages
    const uniquePagesMap = new Map(); // url -> title
    loadedMarks.forEach(mark => {
        const bookmark = loadedBookmarks.find(b => b.url === mark.url);
        const title = bookmark && bookmark.title ? bookmark.title : getCleanDisplayUrl(mark.url);
        uniquePagesMap.set(mark.url, title);
    });

    // Add options
    for (const [url, title] of uniquePagesMap.entries()) {
        const option = document.createElement('option');
        option.value = url;
        option.textContent = title.length > 50 ? title.substring(0, 50) + '...' : title;
        select.appendChild(option);
    }
    
    select.value = activePageFilter;
}

function renderColorFilters() {
    const container = document.getElementById('color-filters-container');
    if (!container) return;
    container.innerHTML = '';

    // Get unique colors present in loaded highlights
    const uniqueColors = [...new Set(loadedMarks.map(m => m.color).filter(Boolean))];

    if (uniqueColors.length === 0) {
        container.innerHTML = '<span style="font-size: 12px; color: #666;">No colors</span>';
        return;
    }

    uniqueColors.forEach(color => {
        const bubble = document.createElement('div');
        bubble.className = 'color-filter-bubble';
        bubble.style.backgroundColor = color;
        
        if (activeColorFilter === color) {
            bubble.classList.add('active');
        }

        bubble.addEventListener('click', () => {
            if (activeColorFilter === color) {
                activeColorFilter = null; // Toggle off
            } else {
                activeColorFilter = color; // Toggle on
            }
            renderColorFilters();
            filterAndRender();
        });

        container.appendChild(bubble);
    });
}

function filterAndRender() {
    const container = document.getElementById('highlights-container');
    const subtitle = document.getElementById('highlight-subtitle');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    if (!container) return;

    // 1. Filter list
    let filtered = loadedMarks.filter(mark => {
        // A. Search query check (text or title or URL)
        const bookmark = loadedBookmarks.find(b => b.url === mark.url);
        const pageTitle = bookmark && bookmark.title ? bookmark.title.toLowerCase() : '';
        const markText = mark.text.toLowerCase();
        const markUrl = mark.url.toLowerCase();
        const q = searchQuery.toLowerCase();

        const matchesQuery = !searchQuery || 
                             markText.includes(q) || 
                             pageTitle.includes(q) || 
                             markUrl.includes(q);

        // B. Color check
        const matchesColor = !activeColorFilter || mark.color === activeColorFilter;

        // C. Page check
        const matchesPage = activePageFilter === 'all' || mark.url === activePageFilter;

        return matchesQuery && matchesColor && matchesPage;
    });

    // 2. Sort list
    filtered.sort((a, b) => {
        if (sortOption === 'newest') {
            return b.createdAt - a.createdAt;
        } else if (sortOption === 'oldest') {
            return a.createdAt - b.createdAt;
        } else if (sortOption === 'longest') {
            return b.text.length - a.text.length;
        } else if (sortOption === 'shortest') {
            return a.text.length - b.text.length;
        } else if (sortOption === 'title') {
            const bookmarkA = loadedBookmarks.find(b => b.url === a.url);
            const bookmarkB = loadedBookmarks.find(b => b.url === b.url);
            const titleA = bookmarkA && bookmarkA.title ? bookmarkA.title.toLowerCase() : a.url.toLowerCase();
            const titleB = bookmarkB && bookmarkB.title ? bookmarkB.title.toLowerCase() : b.url.toLowerCase();
            return titleA.localeCompare(titleB);
        }
        return 0;
    });

    // Toggle Clear Filters Button
    const isFilteredActive = searchQuery !== '' || activeColorFilter !== null || activePageFilter !== 'all';
    if (clearFiltersBtn) {
        clearFiltersBtn.style.display = isFilteredActive ? 'inline-block' : 'none';
    }

    // Render Subtitle stats
    if (subtitle) {
        if (isFilteredActive) {
            subtitle.innerText = `Found ${filtered.length} matching highlight(s) out of ${loadedMarks.length} total.`;
        } else {
            subtitle.innerText = `You have ${loadedMarks.length} saved highlight(s).`;
        }
    }

    // Render Cards
    container.innerHTML = '';
    if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state">No matching highlights found. Try adjusting your search or filters.</div>`;
        return;
    }

    filtered.forEach(mark => {
        const markId = mark.id || mark.createdAt.toString();
        const bookmark = loadedBookmarks.find(b => b.url === mark.url);
        const pageTitle = bookmark && bookmark.title ? bookmark.title : mark.url;

        const card = document.createElement('div');
        card.className = 'highlight-card';
        card.style.borderLeftColor = mark.color;

        const dateString = new Date(mark.createdAt).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        // Safe search text highlighting
        const formattedSnippet = highlightSearchMatch(mark.text, searchQuery);

        card.innerHTML = `
            <div class="highlight-content">
                <div class="highlight-text">"${formattedSnippet}"</div>
                <div class="highlight-meta">
                    <a href="${mark.url}" target="_blank" class="highlight-url">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:13px; height:13px;"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                        <span>${pageTitle}</span>
                    </a>
                    <span class="highlight-date">
                        <svg class="svg-icon" viewBox="0 0 24 24" style="width:13px; height:13px; stroke: var(--md-text-low);"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span>${dateString}</span>
                    </span>
                </div>
            </div>
            <div class="card-actions">
                <button class="action-btn action-btn-copy" data-text="${escapeHtml(mark.text)}" title="Copy text to clipboard">
                    <svg class="svg-icon" viewBox="0 0 24 24" style="width:14px; height:14px; stroke:currentColor;"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                </button>
                <button class="action-btn action-btn-delete" data-id="${markId}" title="Delete Highlight">
                    <svg class="svg-icon" viewBox="0 0 24 24" style="width:14px; height:14px; stroke:currentColor;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;

        container.appendChild(card);
    });

    // Attach button event listeners
    container.querySelectorAll('.action-btn-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const text = e.currentTarget.getAttribute('data-text');
            copyToClipboard(text);
        });
    });

    container.querySelectorAll('.action-btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.currentTarget.getAttribute('data-id');
            deleteHighlight(targetId);
        });
    });
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast("Snippet copied to clipboard!");
    } catch (err) {
        showToast("Failed to copy text.");
        console.error("Clipboard Copy Error: ", err);
    }
}

function deleteHighlight(markId) {
    if (confirm("Are you sure you want to delete this highlight?")) {
        chrome.storage.local.get(['marks'], (result) => {
            let marks = result.marks || [];
            marks = marks.filter(m => (m.id || m.createdAt.toString()) !== markId);
            chrome.storage.local.set({ marks }, () => {
                loadHighlights();
            });
        });
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function highlightSearchMatch(text, query) {
    const escapedText = escapeHtml(text);
    if (!query) return escapedText;
    
    // Escape special regex chars in query
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return escapedText.replace(regex, '<mark>$1</mark>');
}

function getCleanDisplayUrl(url) {
    try {
        const u = new URL(url);
        return u.hostname + u.pathname;
    } catch (e) {
        return url;
    }
}

function showToast(message) {
    const toast = document.getElementById('status-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}