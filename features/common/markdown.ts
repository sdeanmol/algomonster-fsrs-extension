/**
 * @file features/common/markdown.ts
 * @description Robust Markdown rendering wrapper utilizing marked.js parser library and DOMPurify sanitization.
 */

import DOMPurify from 'dompurify';
import { Logger } from '@common/logger';

interface MarkedOptions {
    breaks?: boolean;
    gfm?: boolean;
    headerIds?: boolean;
    mangle?: boolean;
}

interface MarkedLibrary {
    setOptions?(options: MarkedOptions): void;
    use?(options: MarkedOptions): void;
    parse(src: string): string | Promise<string>;
}

declare const marked: MarkedLibrary | undefined;

interface AlgoRecallMarkdownGlobal {
    Markdown?: typeof Markdown;
}

function getAlgoRecallGlobal(): AlgoRecallMarkdownGlobal {
    try {
        const win = (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : {})) as unknown as { AlgoRecall?: AlgoRecallMarkdownGlobal };
        win.AlgoRecall = win.AlgoRecall || {};
        return win.AlgoRecall;
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('Markdown', `Error accessing global AlgoRecall object: ${errorMessage}`, { err });
        return {};
    }
}

function getMarkedInstance(): MarkedLibrary | undefined {
    try {
        // 1. Check window/globalThis for marked (e.g. from marked.min.js loaded in editor.html or content script, or in tests)
        const g = (typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : undefined)) as unknown as { marked?: MarkedLibrary } | undefined;
        if (g && 'marked' in g && g.marked && typeof g.marked.parse === 'function') {
            return g.marked;
        }

        // 2. Global identifier check (for worker or alternative environments)
        if (typeof marked !== 'undefined' && marked && typeof marked.parse === 'function') {
            return marked;
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('Markdown', `Error resolving marked instance: ${errorMessage}`, { err });
    }
    return undefined;
}

const PURIFY_OPTIONS = {
    FORBID_TAGS: ['form', 'input', 'button', 'select', 'textarea', 'script', 'iframe', 'object', 'embed', 'style', 'link', 'meta'],
    FORBID_ATTR: ['style']
};

function sanitizeHtml(html: string): string {
    try {
        if (typeof DOMPurify !== 'undefined') {
            if (typeof DOMPurify.sanitize === 'function') {
                return DOMPurify.sanitize(html, PURIFY_OPTIONS);
            }
            if (typeof DOMPurify === 'function' && typeof window !== 'undefined') {
                return (DOMPurify as unknown as (win: Window) => { sanitize: (s: string, opt?: unknown) => string })(window).sanitize(html, PURIFY_OPTIONS);
            }
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        Logger.error('Markdown', `DOMPurify sanitization failed: ${errorMessage}`, { err });
    }

    // Defense-in-depth fallback sanitization if DOMPurify is unavailable
    let safe = html.replace(/<(script|iframe|object|embed|form|input|button|select|textarea|style|link|meta)[\s\S]*?(?:<\/\1>|\/>)/gi, '');
    safe = safe.replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    safe = safe.replace(/(javascript|vbscript|data):/gi, '');
    return safe;
}

/**
 * @class Markdown
 * @description Robust Markdown rendering wrapper utilizing the marked.js parser library and DOMPurify.
 * Implements fallback rendering when marked is unavailable and performs DOMPurify sanitization
 * against all XSS vectors (unsafe tags, inline event attributes, javascript: URIs).
 */
export class Markdown {
    /**
     * Configures the marked options if loaded.
     */
    static init(): void {
        try {
            const m = getMarkedInstance();
            if (m) {
                if (typeof m.use === 'function') {
                    m.use({
                        breaks: true,
                        gfm: true
                    });
                } else if (typeof m.setOptions === 'function') {
                    m.setOptions({
                        breaks: true,       // Convert \n to <br>
                        gfm: true,          // GitHub Flavored Markdown (tables, strikethrough)
                        headerIds: false,   // Don't generate id attributes on headings
                        mangle: false       // Don't mangle email addresses
                    });
                }
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Markdown', `Error initializing marked.js options: ${errorMessage}`, { err });
            // Comment: Non-fatal marked options setup catch
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
        
        const m = getMarkedInstance();
        if (!m || typeof m.parse !== 'function') {
            // Fallback: escape HTML and convert newlines
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
        }

        try {
            // Parse with marked
            const parsed = m.parse(text);
            const html: string = typeof parsed === 'string' ? parsed : String(parsed);
            
            // Sanitize with DOMPurify
            return sanitizeHtml(html);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('Markdown', `Markdown parsing failed: ${errorMessage}`, { err });
            // Comment: Return safe escaped plain text HTML fallback when marked.js parsing fails
            return text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/\n/g, '<br>');
        }
    }
}

try {
    getAlgoRecallGlobal().Markdown = Markdown;

    // Initialize configurations
    Markdown.init();

    // Maintain legacy global binding for safety/backwards compatibility
    (window as unknown as { renderMarkdown?: typeof Markdown.render }).renderMarkdown = Markdown.render;
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('Markdown', `Error initializing Markdown global bindings: ${errorMessage}`, { err });
}
