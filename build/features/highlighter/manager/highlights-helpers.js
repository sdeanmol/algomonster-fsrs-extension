window.AlgoRecall = window.AlgoRecall || {};

/**
 * @class HighlightsHelpers
 * @description Helper utility functions for the highlights manager dashboard UI.
 * Provides clipboard replication, string sanitizer escapers, and search match mark wrapper overlays.
 */
window.AlgoRecall.HighlightsHelpers = class HighlightsHelpers {
    /**
     * Copies a string directly into user's OS clipboard buffer and triggers toast confirmation feedback.
     * @param {string} text - The raw snippet text to copy.
     */
    static async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast("Snippet copied to clipboard!");
        } catch (err) {
            this.showToast("Failed to copy text.");
            console.error("Clipboard Copy Error: ", err);
        }
    }

    /**
     * Escapes special HTML tag symbols from strings to mitigate injections.
     * @param {string} text - Raw content text.
     * @returns {string} Safe HTML string.
     */
    static escapeHtml(text) {
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
    static highlightSearchMatch(text, query) {
        const escapedText = this.escapeHtml(text);
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
    static getCleanDisplayUrl(url) {
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
    static showToast(message) {
        const toast = document.getElementById('status-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }
};

// Bind legacy bindings for safety/backwards compatibility
window.copyToClipboard = (text) => window.AlgoRecall.HighlightsHelpers.copyToClipboard(text);
window.escapeHtml = (text) => window.AlgoRecall.HighlightsHelpers.escapeHtml(text);
window.highlightSearchMatch = (text, query) => window.AlgoRecall.HighlightsHelpers.highlightSearchMatch(text, query);
window.getCleanDisplayUrl = (url) => window.AlgoRecall.HighlightsHelpers.getCleanDisplayUrl(url);
window.showToast = (message) => window.AlgoRecall.HighlightsHelpers.showToast(message);
