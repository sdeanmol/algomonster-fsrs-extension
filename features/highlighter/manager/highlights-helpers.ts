/**
 * @file features/highlighter/manager/highlights-helpers.ts
 * @description Helper utility functions for the highlights manager dashboard UI.
 * Provides clipboard replication, string sanitizer escapers, search match mark wrapper overlays,
 * and URL display formatters.
 * 
 * Context: Highlights dashboard page (`highlights.html`) within the Chrome extension.
 * 
 * Key Exports:
 * - `AlgoRecallGlobal`: Extension window namespace interface.
 * - `HighlightsHelpers`: Static helper utility class exposing formatting, sanitization, and UI feedback routines.
 */

import { Logger } from '@common/logger';

/**
 * Window namespace declarations for highlights management.
 */
export interface AlgoRecallGlobal {
    Highlighter?: unknown;
    HighlightsHelpers?: typeof HighlightsHelpers;
    state?: Record<string, unknown>;
    Utils?: Record<string, unknown>;
    [key: string]: unknown;
}

declare global {
    interface Window {
        AlgoRecall: AlgoRecallGlobal;
        copyToClipboard: (text: string) => Promise<void>;
        escapeHtml: (text: string) => string;
        highlightSearchMatch: (text: string, query: string) => string;
        getCleanDisplayUrl: (url: string) => string;
        showToast: (message: string) => void;
    }
}

try {
    window.AlgoRecall = window.AlgoRecall || {};
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('HighlightsHelpers', `Error initializing window.AlgoRecall global object: ${errorMessage}`, { err });
}

/**
 * @class HighlightsHelpers
 * @description Helper utility functions for the highlights manager dashboard UI.
 * Provides clipboard replication, string sanitizer escapers, and search match mark wrapper overlays.
 */
export class HighlightsHelpers {
    /**
     * Copies a string directly into user's OS clipboard buffer and triggers toast confirmation feedback.
     * 
     * @async
     * @param {string} text - Text snippet to copy.
     * @returns {Promise<void>}
     */
    static async copyToClipboard(text: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(text);
            this.showToast("Snippet copied to clipboard!");
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightsHelpers', `Clipboard Copy Error: ${errorMessage}`, { text, err });
            // Comment: Non-fatal clipboard copy failure toast feedback
            this.showToast("Failed to copy text.");
        }
    }

    /**
     * Escapes special HTML tag symbols from strings to mitigate XSS vulnerabilities.
     * 
     * @param {string} text - Raw string to escape.
     * @returns {string} Sanitized HTML string.
     */
    static escapeHtml(text: string): string {
        try {
            if (!text) return '';
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightsHelpers', `Error escaping HTML: ${errorMessage}`, { text, err });
            // Comment: Basic string replacement fallback on DOM element creation failure
            return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
    }

    /**
     * Wraps occurrences of the query pattern in the highlight text with `<mark>` tags for visual search feedback.
     * 
     * @param {string} text - Full text string to search within.
     * @param {string} query - Substring term to highlight.
     * @returns {string} HTML string containing mark-wrapped search matches.
     */
    static highlightSearchMatch(text: string, query: string): string {
        try {
            const escapedText = this.escapeHtml(text);
            if (!query) return escapedText;
            
            const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            const regex = new RegExp(`(${escapedQuery})`, 'gi');
            return escapedText.replace(regex, '<mark>$1</mark>');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightsHelpers', `Error highlighting search match: ${errorMessage}`, { query, err });
            // Comment: Safe fallback returning escaped text on regex match error
            return this.escapeHtml(text);
        }
    }

    /**
     * Truncates raw URLs to clean hostname and path segments for card label display.
     * 
     * @param {string} url - Raw URL string.
     * @returns {string} Cleaned hostname + path string.
     */
    static getCleanDisplayUrl(url: string): string {
        try {
            const u = new URL(url);
            return u.hostname + u.pathname;
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightsHelpers', `Invalid URL for getCleanDisplayUrl '${url}': ${errorMessage}`, { url, err });
            // Comment: Return raw URL string fallback when URL parsing fails
            return url;
        }
    }

    /**
     * Renders temporary status feedback messages on manager layout panels.
     * 
     * @param {string} message - Feedback message string.
     * @returns {void}
     */
    static showToast(message: string): void {
        try {
            const toast = document.getElementById('status-toast');
            if (!toast) return;
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => {
                try {
                    toast.classList.remove('show');
                } catch (animErr) {
                    const errorMessage = animErr instanceof Error ? animErr.message : String(animErr);
                    Logger.error('HighlightsHelpers', `Error removing toast show class: ${errorMessage}`, { animErr });
                }
            }, 2000);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('HighlightsHelpers', `Error showing toast message '${message}': ${errorMessage}`, { message, err });
        }
    }
}

try {
    if (typeof window !== 'undefined' && window.AlgoRecall) {
        window.AlgoRecall.HighlightsHelpers = HighlightsHelpers;
        window.copyToClipboard = (text: string) => HighlightsHelpers.copyToClipboard(text);
        window.escapeHtml = (text: string) => HighlightsHelpers.escapeHtml(text);
        window.highlightSearchMatch = (text: string, query: string) => HighlightsHelpers.highlightSearchMatch(text, query);
        window.getCleanDisplayUrl = (url: string) => HighlightsHelpers.getCleanDisplayUrl(url);
        window.showToast = (message: string) => HighlightsHelpers.showToast(message);
    }
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('HighlightsHelpers', `Error attaching global window helper functions: ${errorMessage}`, { err });
}
