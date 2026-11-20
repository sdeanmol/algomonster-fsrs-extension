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
import { CatchAndLog, CatchAndReturn, withErrorHandling } from '../../../decorators';

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

withErrorHandling(() => {
    window.AlgoRecall = window.AlgoRecall || {};
}, 'HighlightsHelpers', 'Error initializing window.AlgoRecall global object')();

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
    @CatchAndLog('HighlightsHelpers', {
        contextMessage: 'Clipboard Copy Error',
        fallback: () => { HighlightsHelpers.showToast("Failed to copy text."); }
    })
    static async copyToClipboard(text: string): Promise<void> {
        await navigator.clipboard.writeText(text);
        this.showToast("Snippet copied to clipboard!");
    }

    /**
     * Escapes special HTML tag symbols from strings to mitigate XSS vulnerabilities.
     * 
     * @param {string} text - Raw string to escape.
     * @returns {string} Sanitized HTML string.
     */
    @CatchAndReturn(
        (err: unknown, text: string) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        'HighlightsHelpers',
        'Error escaping HTML'
    )
    static escapeHtml(text: string): string {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Wraps occurrences of the query pattern in the highlight text with `<mark>` tags for visual search feedback.
     * 
     * @param {string} text - Full text string to search within.
     * @param {string} query - Substring term to highlight.
     * @returns {string} HTML string containing mark-wrapped search matches.
     */
    @CatchAndReturn(
        (err: unknown, text: string) => HighlightsHelpers.escapeHtml(text),
        'HighlightsHelpers',
        'Error highlighting search match'
    )
    static highlightSearchMatch(text: string, query: string): string {
        const escapedText = this.escapeHtml(text);
        if (!query) return escapedText;
        
        const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        return escapedText.replace(regex, '<mark>$1</mark>');
    }

    /**
     * Truncates raw URLs to clean hostname and path segments for card label display.
     * 
     * @param {string} url - Raw URL string.
     * @returns {string} Cleaned hostname + path string.
     */
    @CatchAndReturn(
        (err: unknown, url: string) => url,
        'HighlightsHelpers',
        'Invalid URL for getCleanDisplayUrl'
    )
    static getCleanDisplayUrl(url: string): string {
        const u = new URL(url);
        return u.hostname + u.pathname;
    }

    /**
     * Renders temporary status feedback messages on manager layout panels.
     * 
     * @param {string} message - Feedback message string.
     * @returns {void}
     */
    @CatchAndLog('HighlightsHelpers', 'Error showing toast message')
    static showToast(message: string): void {
        const toast = document.getElementById('status-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(withErrorHandling(() => {
            toast.classList.remove('show');
        }, 'HighlightsHelpers', 'Error removing toast show class'), 2000);
    }
}

withErrorHandling(() => {
    if (typeof window !== 'undefined' && window.AlgoRecall) {
        window.AlgoRecall.HighlightsHelpers = HighlightsHelpers;
        window.copyToClipboard = (text: string) => HighlightsHelpers.copyToClipboard(text);
        window.escapeHtml = (text: string) => HighlightsHelpers.escapeHtml(text);
        window.highlightSearchMatch = (text: string, query: string) => HighlightsHelpers.highlightSearchMatch(text, query);
        window.getCleanDisplayUrl = (url: string) => HighlightsHelpers.getCleanDisplayUrl(url);
        window.showToast = (message: string) => HighlightsHelpers.showToast(message);
    }
}, 'HighlightsHelpers', 'Error attaching global window helper functions')();
