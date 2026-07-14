// features/common/markdown.js - Lightweight Markdown rendering wrapper using marked.js
// Provides renderMarkdown(text) for safe HTML output from Markdown source.

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
     * @param {string} text - Raw Markdown text
     * @returns {string} Rendered HTML string
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
            
            // Basic sanitization: strip dangerous tags (script, iframe, object, embed, form)
            html = html.replace(/<(script|iframe|object|embed|form|style|link|meta)[\s\S]*?(?:<\/\1>|\/>)/gi, '');
            html = html.replace(/on\w+\s*=\s*"[^"]*"/gi, '');
            html = html.replace(/on\w+\s*=\s*'[^']*'/gi, '');
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
