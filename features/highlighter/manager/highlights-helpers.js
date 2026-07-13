// features/highlighter/manager/highlights-helpers.js - Utility helpers for highlights manager page

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast("Snippet copied to clipboard!");
    } catch (err) {
        showToast("Failed to copy text.");
        console.error("Clipboard Copy Error: ", err);
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
