declare global {
    interface Window {
        AlgoRecall: any;
        copyToClipboard: (text: string) => Promise<void>;
        escapeHtml: (text: string) => string;
        highlightSearchMatch: (text: string, query: string) => string;
        getCleanDisplayUrl: (url: string) => string;
        showToast: (message: string) => void;
    }
}

window.AlgoRecall = window.AlgoRecall || {};

/**
 * @class HighlightsHelpers
 * @description Helper utility functions for the highlights manager dashboard UI.
 * Provides clipboard replication, string sanitizer escapers, and search match mark wrapper overlays.
 */
export class HighlightsHelpers {
    /**
     * Copies a string directly into user's OS clipboard buffer and triggers toast confirmation feedback.
     */
    static async copyToClipboard(text: string): Promise<void> {
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
     */
    static escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Wraps occurrences of the query pattern in the highlight text with HTML mark tags.
     */
    static highlightSearchMatch(text: string, query: string): string {
        const escapedText = this.escapeHtml(text);
        if (!query) return escapedText;
        
        const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return escapedText.replace(regex, '<mark>$1</mark>');
    }

    /**
     * Truncates raw URLs to hostname and path segments for display.
     */
    static getCleanDisplayUrl(url: string): string {
        try {
            const u = new URL(url);
            return u.hostname + u.pathname;
        } catch (e) {
            return url;
        }
    }

    /**
     * Renders temporary status feedback messages on manager layout panels.
     */
    static showToast(message: string): void {
        const toast = document.getElementById('status-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
        }, 2000);
    }
}

window.AlgoRecall.HighlightsHelpers = HighlightsHelpers;

window.copyToClipboard = (text: string) => HighlightsHelpers.copyToClipboard(text);
window.escapeHtml = (text: string) => HighlightsHelpers.escapeHtml(text);
window.highlightSearchMatch = (text: string, query: string) => HighlightsHelpers.highlightSearchMatch(text, query);
window.getCleanDisplayUrl = (url: string) => HighlightsHelpers.getCleanDisplayUrl(url);
window.showToast = (message: string) => HighlightsHelpers.showToast(message);
