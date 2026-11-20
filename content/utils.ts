/**
 * @file content/utils.ts
 * @description General helper utilities for in-page content scripts.
 * Contains DOM serialization routines for highlights persistence across tab reloads,
 * dynamic theme styling injections (CSS Custom Highlights API), and heuristic parsing
 * of problem tags and titles across coding environments (LeetCode, AlgoMonster, AtCoder).
 * 
 * Context: Content script isolation layer (runs inside target web pages within the extension context).
 * 
 * Key Exports:
 * - `DOMMeta`: Interface describing serialized DOM text node path coordinates.
 * - `HighlightMetaSource`: Interface pairing start and end coordinates for text range reconstruction.
 * - `Utils`: Utility class providing static DOM pathing, styling, tag inference, and title extraction helpers.
 */

import { Logger } from '@common/logger';
import { AlgoRecallState, getAlgoRecallGlobal } from './state';
import { CatchAndReturn, withErrorHandling } from '../decorators';

/**
 * Serialized DOM coordinates representing the location of a text boundary point in the DOM tree.
 */
export interface DOMMeta {
    /** Lowercase tag name of the parent element (e.g., 'p', 'div', 'span'). */
    parentTagName: string;
    /** Zero-based index of the target node among its parent's child nodes. */
    parentIndex: number;
    /** Character offset within the text node. */
    textOffset: number;
    /** Array of child indices from the document root down to the parent element. */
    parentDomPath: number[];
}

/**
 * Coordinates pairing the start and end boundary points required to rebuild a DOM `Range`.
 */
export interface HighlightMetaSource {
    /** Boundary coordinates for the start of the highlighted text range. */
    startMeta: DOMMeta;
    /** Boundary coordinates for the end of the highlighted text range. */
    endMeta: DOMMeta;
}

/**
 * @class ContentUtils
 * @description General helper utilities for in-page content scripts.
 * Contains DOM serialization routines for highlights persistence across tab reloads,
 * dynamic theme styling injections (CSS Custom Highlights API), and heuristic parsing
 * of problem tags and titles across coding environments (LeetCode, AlgoMonster, AtCoder).
 */
export class Utils {
    /**
     * Serializes the DOM path coordinates of a given text node.
     * Loops parent elements up to the body/document root to produce a unique node path index list,
     * allowing highlight selections to survive page reloads and edits on dynamic web content.
     * 
     * @param {Node} node - The targeted DOM text node.
     * @param {number} offset - The cursor text range index offset within the text node.
     * @returns {DOMMeta} JSON meta coordinates schema.
     */
    @CatchAndReturn((_err: unknown, _node: Node, offset: number) => ({
        parentTagName: '',
        parentIndex: -1,
        textOffset: offset,
        parentDomPath: []
    }), 'ContentUtils', 'Error in getDOMMeta')
    static getDOMMeta(node: Node, offset: number): DOMMeta {
        const parent = node.parentNode as HTMLElement;
        const path: number[] = [];
        let current: Node | null = parent;
        while (current && current !== document.body && current !== document.documentElement) {
            if (current.parentNode) {
                const index = Array.from(current.parentNode.childNodes).indexOf(current as ChildNode);
                path.unshift(index);
            }
            current = current.parentNode;
        }

        return {
            parentTagName: parent ? parent.tagName.toLowerCase() : '',
            parentIndex: parent ? Array.from(parent.childNodes).indexOf(node as ChildNode) : -1,
            textOffset: offset,
            parentDomPath: path
        };
    }

    /**
     * Restores a DOM selection range from serialized meta coordinates.
     * Attempts precise tree path traversal first, with a fallback text tree walker
     * search based on tag names and indices if page elements changed.
     * 
     * @param {HighlightMetaSource} highlightSource - Serialized start/end coordinates object.
     * @param {string} markText - The original highlighted text snippet to verify correctness.
     * @returns {Range|null} Restored DOM Range object, or null if restoration failed.
     */
    @CatchAndReturn(null, 'ContentUtils', 'Failed to restore range from meta')
    static restoreRangeFromMeta(highlightSource: HighlightMetaSource, markText?: string): Range | null {
        if (!highlightSource || !highlightSource.startMeta || !highlightSource.endMeta) {
            return null;
        }

        let startNode: Node | null = null;
        let endNode: Node | null = null;

        if (highlightSource.startMeta.parentDomPath && highlightSource.endMeta.parentDomPath) {
            const resolvePath = (path: number[], childIndex: number): Node | null => {
                try {
                    let current: Node | null = document.body;
                    for (let i = 0; i < path.length; i++) {
                        if (!current || !current.childNodes) return null;
                        current = current.childNodes[path[i]] || null;
                    }
                    return current ? (current.childNodes[childIndex] || null) : null;
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.debug('ContentUtils', `Return null if DOM path index resolution fails: ${errorMessage}`, { err });
                    return null;
                }
            };

            startNode = resolvePath(highlightSource.startMeta.parentDomPath, highlightSource.startMeta.parentIndex);
            endNode = resolvePath(highlightSource.endMeta.parentDomPath, highlightSource.endMeta.parentIndex);
        }

        if (!startNode || !endNode) {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
            let node: Node | null;
            while ((node = walker.nextNode())) {
                const parent = node.parentNode as HTMLElement;
                if (!parent) continue;
                const parentTagName = parent.tagName.toLowerCase();
                const parentIndex = Array.from(parent.childNodes).indexOf(node as ChildNode);

                if (!startNode && parentTagName === highlightSource.startMeta.parentTagName && parentIndex === highlightSource.startMeta.parentIndex) startNode = node;
                if (startNode && parentTagName === highlightSource.endMeta.parentTagName && parentIndex === highlightSource.endMeta.parentIndex) {
                    endNode = node;
                    break;
                }
            }
        }

        if (startNode && endNode) {
            const range = document.createRange();
            const startOffset = Math.min(highlightSource.startMeta.textOffset, startNode.textContent?.length || 0);
            const endOffset = Math.min(highlightSource.endMeta.textOffset, endNode.textContent?.length || 0);

            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);

            if (markText) {
                const rangeTextClean = range.toString().replace(/\s+/g, '');
                const markTextClean = markText.replace(/\s+/g, '');

                if (rangeTextClean !== markTextClean) {
                    if (!markTextClean.includes(rangeTextClean) && !rangeTextClean.includes(markTextClean)) return null;
                    if (rangeTextClean.length < (markTextClean.length * 0.5)) return null;
                }
            }
            return range;
        }
        return null;
    }

    /**
     * Dynamically registers highlight style rules using CSS Custom Highlights API.
     * Ensures the document has a matching ::highlight(name) ruleset for the hex color.
     * 
     * @param {string} color - Hex color code.
     * @param {string} type - Annotation type ('highlight', 'underline', 'symbol').
     * @returns {string} The registered highlight class name.
     */
    static ensureHighlightStyle(color: string, type: string = 'highlight'): string {
        const state = getAlgoRecallGlobal().state;
        const colorHash = (color || '#f1c40f').replace('#', '');
        let prefix = 'algo-hl';
        let cssRule = `background-color: ${color}; color: inherit;`;

        if (type === 'underline') {
            prefix = 'algo-ul';
            cssRule = `background-color: transparent; text-decoration: underline solid ${color} 2px; text-decoration-line: underline; text-decoration-color: ${color}; text-decoration-thickness: 2px; text-underline-offset: 2px;`;
        }

        const colorName = `${prefix}-${colorHash}`;

        withErrorHandling(() => {
            if (state && !state.activeHighlightStyles.has(colorName)) {
                const style = document.createElement('style');
                style.textContent = `::highlight(${colorName}) { ${cssRule} }`;
                if (document.head) {
                    document.head.appendChild(style);
                }
                state.activeHighlightStyles.add(colorName);
            }
        }, 'ContentUtils', { contextMessage: `Failed ensuring highlight style '${colorName}'` })();

        return colorName;
    }

    /**
     * Extracts default tags from the current window path segment.
     * If the path ends in a structured topic (e.g. dynamic_programming),
     * returns it formatted as title case words ("Dynamic Programming").
     * @returns {string[]} Array of extracted topic tags.
     */
    @CatchAndReturn(['AlgoRecall'], 'ContentUtils', 'Error parsing auto tags from URL')
    static getAutoTags(): string[] {
        const path = window.location.pathname;
        const segments = path.split('/').filter(p => p.length > 0);
        if (segments.length > 0) {
            const rawTopic = segments[segments.length - 1];
            return [rawTopic.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')];
        }
        return ["AlgoRecall"];
    }

    /**
     * Heuristically parses the DOM structure or document title to extract
     * the active coding problem title, stripping known branding strings.
     * Supports specialized selector matching for LeetCode Explore card layouts.
     * @returns {string} Cleansed coding problem title.
     */
    @CatchAndReturn(() => document.title ? document.title.trim() : 'Untitled Problem', 'ContentUtils', 'Error extracting problem title')
    static getExtractedProblemTitle(): string {
        const url = window.location.href;

        // LeetCode Explore Cards
        if (url.includes('leetcode.com/explore/')) {
            const selectors = [
                'h1', 'h2', 'h3',
                '[class*="card-title"]',
                '[class*="course-title"]',
                '[class*="title-wrapper"]',
                '.card-info-title',
                '.title__3y75'
            ];
            for (const selector of selectors) {
                try {
                    const el = document.querySelector(selector) as HTMLElement | null;
                    if (el && el.innerText && el.innerText.trim().length > 0 && el.innerText.trim().length < 100) {
                        const text = el.innerText.trim();
                        if (!text.toLowerCase().includes('leetcode') || text.toLowerCase().includes('course') || text.toLowerCase().includes('crash')) {
                            return text;
                        }
                    }
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : String(err);
                    Logger.debug('ContentUtils', `Ignore querySelector syntax errors for non-standard selectors: ${errorMessage}`, { selector, err });
                }
            }

            // Fallback: parse URL
            try {
                const path = window.location.pathname;
                const segments = path.split('/').filter(p => p.length > 0);
                if (segments.length > 0) {
                    let index = segments.length - 1;
                    while (index >= 0 && (/^\d+$/.test(segments[index]) || segments[index] === 'card' || segments[index] === 'featured')) {
                        index--;
                    }
                    if (index >= 0) {
                        return segments[index]
                            .split('-')
                            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                            .join(' ');
                    }
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : String(err);
                Logger.warn('ContentUtils', `Error parsing title from URL: ${errorMessage}`, { url, err });
                // Comment: Non-fatal URL title segment parsing error
            }
        }

        // General title fallback
        let title = document.title || 'Untitled Problem';
        title = title.replace(' - AlgoMonster', '');
        title = title.replace(' - LeetCode', '');
        title = title.replace(' - Codeforces', '');
        title = title.replace(' - CodeChef', '');
        title = title.replace(' - AtCoder', '');
        return title.trim();
    }

    /**
     * Resolves the favicon URL for the active page.
     * Searches for link[rel~="icon"] in the DOM and falls back to window.location.origin/favicon.ico.
     * @returns {string} Absolute URL to the page favicon or empty string if origin is unavailable.
     */
    @CatchAndReturn(() => window.location.origin ? `${window.location.origin}/favicon.ico` : '', 'ContentUtils', 'Error detecting page favicon')
    static getFaviconUrl(): string {
        const iconLink = document.querySelector('link[rel~="icon"], link[rel="shortcut icon"]') as HTMLLinkElement | null;
        if (iconLink && iconLink.href) {
            return iconLink.href;
        }
        return window.location.origin ? `${window.location.origin}/favicon.ico` : '';
    }
}

withErrorHandling(() => {
    getAlgoRecallGlobal().Utils = Utils;
}, 'ContentUtils', { contextMessage: 'Failed to assign Utils on window global scope' })();
