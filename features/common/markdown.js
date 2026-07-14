/**
 * @file features/common/markdown.js
 * @description Lightweight Markdown rendering wrapper utilizing the marked.js parser library.
 * Implements fallback rendering when marked is unavailable and performs structural regex-based sanitization
 * of potential XSS vectors (unsafe tags, inline attributes, javascript: URIs).
 * Upstream dependencies: features/common/marked.min.js (vendor parser library).
 * Downstream dependencies: features/tracker/tracker.js, features/tracker/editor/editor.js, features/dashboard/popup/popup.js.
 */

(function() {
    // Configure marked for safe, minimal output
    if (typeof marked !== 'undefined') {
        marked.setOptions({
            breaks: true,       // Convert \n to <br>
            gfm: true,          // GitHub Flavored Markdown (tables, strikethrough)
            headerIds: false,   // Don't generate id attributes on headings
            mangle: false       // Don't mangle email addresses
        });
    }

    /**
     * Render Markdown text to sanitized HTML.
     * Fallbacks to plain-text escaping if the 'marked' parser library is not loaded.
     * @param {string} text - Raw Markdown text.
     * @returns {string} Rendered and sanitized HTML string.
     */
    window.renderMarkdown = function(text) {
        if (!text || typeof text !== 'string') return '';
        
        if (typeof marked === 'undefined') {
            // Fallback: escape HTML and convert newlines
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
        }

        try {
            // Parse with marked
            let html = marked.parse(text);
            
            // Sanitization: strip dangerous tags (script, iframe, object, embed, form)
            html = html.replace(/<(script|iframe|object|embed|form|style|link|meta)[\s\S]*?(?:<\/\1>|\/>)/gi, '');
            // Strip inline script handlers (e.g. onclick, onload)
            html = html.replace(/on\w+\s*=\s*"[^"]*"/gi, '');
            html = html.replace(/on\w+\s*=\s*'[^']*'/gi, '');
            // Remove javascript URI schemes
            html = html.replace(/javascript\s*:/gi, '');
            
            return html;
        } catch (e) {
            // Fallback on parse error
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
        }
    };
})();

