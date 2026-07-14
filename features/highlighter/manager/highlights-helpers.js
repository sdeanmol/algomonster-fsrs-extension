/**
 * @file features/highlighter/manager/highlights-helpers.js
 * @description Helper utility functions for the highlights manager dashboard UI.
 * Provides clipboard replication, string sanitizer escapers, and search match mark wrapper overlays.
 * Upstream dependencies: None.
 * Downstream dependencies: None.
 */

/**
 * Copies a string directly into user's OS clipboard buffer and triggers toast confirmation feedback.
 * @param {string} text - The raw snippet text to copy.
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast("Snippet copied to clipboard!");
    } catch (err) {
        showToast("Failed to copy text.");
        console.error("Clipboard Copy Error: ", err);
    }
}

/**
 * Escapes special HTML tag symbols from strings to mitigate injections.
 * @param {string} text - Raw content text.
 * @returns {string} Safe HTML string.
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Wraps occurrences of the query pattern in the highlight text with HTML mark tags.
 * @param {string} text - Highlight raw text.
 * @param {string} query - Keyword match pattern query.
 * @returns {string} Formatted markup string containing mark matches.
 */
function highlightSearchMatch(text, query) {
    const escapedText = escapeHtml(text);
    if (!query) return escapedText;
    
    // Escape special regex chars in query
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    return escapedText.replace(regex, '<mark>$1</mark>');
}

/**
 * Truncates raw URLs to hostname and path segments for display.
 * @param {string} url - Target URL.
 * @returns {string} Truncated string representation.
 */
function getCleanDisplayUrl(url) {
    try {
        const u = new URL(url);
        return u.hostname + u.pathname;
    } catch (e) {
        return url;
    }
}

/**
 * Renders temporary status feedback messages on manager layout panels.
 * @param {string} message - Message text.
 */
function showToast(message) {
    const toast = document.getElementById('status-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

