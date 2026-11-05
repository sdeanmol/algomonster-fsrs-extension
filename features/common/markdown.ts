/**
 * @file Secure Markdown Rendering and HTML Sanitization Engine
 * @module features/common/markdown
 * @context Shared across Content Scripts (Problem Tracker, Notes) and Dashboard Pages (Editor, Summary)
 * @description Provides Markdown-to-HTML rendering using marked.js with GFM and line breaks,
 * combined with DOMPurify sanitization to neutralize cross-site scripting (XSS) vectors.
 */

import DOMPurify from 'dompurify';
import { Logger } from '@common/logger';
import { MARKDOWN_PURIFY_OPTIONS } from './constants';

/**
 * Options accepted by the marked.js parser library.
 */
interface MarkedOptions {
    /** If true, add <br> on a single line break */
    breaks?: boolean;
    /** If true, use approved GitHub Flavored Markdown (GFM) specification */
    gfm?: boolean;
    /** If true, include an id attribute when emitting headings */
    headerIds?: boolean;
    /** If true, autolink or mangle email addresses */
    mangle?: boolean;
}

/**
 * Interface representing external marked.js parser library instances.
 */
interface MarkedLibrary {
    /** Sets default parser options (marked v4 legacy API) */
    setOptions?(options: MarkedOptions): void;
    /** Registers extensions and options (marked v5+ API) */
    use?(options: MarkedOptions): void;
    /** Synchronously or asynchronously parses Markdown source string to HTML */
    parse(src: string): string | Promise<string>;
}

declare const marked: MarkedLibrary | undefined;

/**
 * Global extension namespace anchor for window.AlgoRecall.
 */
interface AlgoRecallMarkdownGlobal {
    Markdown?: typeof Markdown;
}

/**
 * Resolves or initializes the global `AlgoRecall` namespace object.
 * @returns The AlgoRecall global namespace container.
 */
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

/**
 * Detects and retrieves an available instance of `marked` across global scopes.
 * @returns The resolved MarkedLibrary instance or undefined if unavailable.
 */
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

const PURIFY_OPTIONS = MARKDOWN_PURIFY_OPTIONS;

/**
 * Sanitizes an HTML string using DOMPurify or regex fallback heuristics.
 * Strips script tags, form inputs, inline event handlers, and javascript: URLs.
 * @param html - Raw HTML generated from Markdown parsing.
 * @returns XSS-sanitized HTML string safe for innerHTML injection.
 */
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
 * Robust Markdown rendering service utilizing marked.js and DOMPurify.
 * Implements fallback plain-text escaping when marked is unavailable.
 * Implements fallback rendering when marked is unavailable and performs DOMPurify sanitization
 * against all XSS vectors (unsafe tags, inline event attributes, javascript: URIs).
*/
export class Markdown {
    /**
     * Configures the marked options (breaks, gfm, headerIds, mangle) on the active parser instance.
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
        }
    }

    /**
     * Renders Markdown text to sanitized, safe HTML.
     * Falls back to HTML entity escaping if the marked parser is unavailable or throws.
     * @param text - Raw Markdown or plain text string.
     * @returns Rendered and sanitized HTML string safe for DOM insertion.
     * @example
     * ```ts
     * const html = Markdown.render('### Two Sum\n- Use a **hash map**');
     * container.innerHTML = html;
     * ```
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
            // Return safe escaped plain text HTML fallback when marked.js parsing fails
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
