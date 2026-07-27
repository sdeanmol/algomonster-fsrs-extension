(window as any).AlgoRecall = (window as any).AlgoRecall || {};

declare const marked: any;

/**
 * @class Markdown
 * @description Lightweight Markdown rendering wrapper utilizing the marked.js parser library.
 * Implements fallback rendering when marked is unavailable and performs structural regex-based sanitization
 * of potential XSS vectors (unsafe tags, inline attributes, javascript: URIs).
 */
(window as any).AlgoRecall.Markdown = class Markdown {
    /**
     * Configures the marked options if loaded.
     */
    static init(): void {
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                breaks: true,       // Convert \n to <br>
                gfm: true,          // GitHub Flavored Markdown (tables, strikethrough)
                headerIds: false,   // Don't generate id attributes on headings
                mangle: false       // Don't mangle email addresses
            });
        }
    }

    /**
     * Render Markdown text to sanitized HTML.
     * Fallbacks to plain-text escaping if the 'marked' parser library is not loaded.
     * @param {string} text - Raw Markdown text.
     * @returns {string} Rendered and sanitized HTML string.
     */
    static render(text: string): string {
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
            let html: string = marked.parse(text);
            
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
    }
};

// Initialize configurations
(window as any).AlgoRecall.Markdown.init();

// Maintain legacy global binding for safety/backwards compatibility
(window as any).renderMarkdown = (window as any).AlgoRecall.Markdown.render;
