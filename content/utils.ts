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
    static getDOMMeta(node: Node, offset: number): DOMMeta {
        try {
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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ContentUtils', `Error in getDOMMeta: ${errorMessage}`, { offset, err });
            // Comment: Fallback default DOMMeta coordinates on node traversal error
            return {
                parentTagName: '',
                parentIndex: -1,
                textOffset: offset,
                parentDomPath: []
            };
        }
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
    static restoreRangeFromMeta(highlightSource: HighlightMetaSource, markText?: string): Range | null {
        try {
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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ContentUtils', `Failed to restore range from meta: ${errorMessage}`, { highlightSource, err });
            // Comment: Return null so caller can drop invalid/outdated DOM mark gracefully
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

        try {
            if (state && !state.activeHighlightStyles.has(colorName)) {
                const style = document.createElement('style');
                style.textContent = `::highlight(${colorName}) { ${cssRule} }`;
                if (document.head) {
                    document.head.appendChild(style);
                }
                state.activeHighlightStyles.add(colorName);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.error('ContentUtils', `Failed ensuring highlight style '${colorName}': ${errorMessage}`, { color, type, err });
            // Comment: Catch style element injection failure gracefully
        }
        return colorName;
    }

    /**
     * Extracts default tags from the current window path segment.
     * If the path ends in a structured topic (e.g. dynamic_programming),
     * returns it formatted as title case words ("Dynamic Programming").
     * @returns {string[]} Array of extracted topic tags.
     */
    static getAutoTags(): string[] {
        try {
            const path = window.location.pathname;
            const segments = path.split('/').filter(p => p.length > 0);
            if (segments.length > 0) {
                const rawTopic = segments[segments.length - 1];
                return [rawTopic.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')];
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.warn('ContentUtils', `Error parsing auto tags from URL: ${errorMessage}`, { err });
            // Comment: Return default tag fallback on URL parsing error
        }
        return ["AlgoRecall"];
    }

    /**
     * Heuristically parses the DOM structure or document title to extract
     * the active coding problem title, stripping known branding strings.
     * Supports specialized selector matching for LeetCode Explore card layouts.
     * @returns {string} Cleansed coding problem title.
     */
    static getExtractedProblemTitle(): string {
        try {
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
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.warn('ContentUtils', `Error extracting problem title: ${errorMessage}`, { err });
            // Comment: Return safe fallback title on parsing error
            return document.title ? document.title.trim() : 'Untitled Problem';
        }
    }

    /**
     * Resolves the favicon URL for the active page.
     * Searches for link[rel~="icon"] in the DOM and falls back to window.location.origin/favicon.ico.
     * @returns {string} Absolute URL to the page favicon or empty string if origin is unavailable.
     */
    static getFaviconUrl(): string {
        try {
            const iconLink = document.querySelector('link[rel~="icon"], link[rel="shortcut icon"]') as HTMLLinkElement | null;
            if (iconLink && iconLink.href) {
                return iconLink.href;
            }
            return window.location.origin ? `${window.location.origin}/favicon.ico` : '';
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            Logger.debug('ContentUtils', `Error detecting page favicon: ${errorMessage}`, { err });
            return window.location.origin ? `${window.location.origin}/favicon.ico` : '';
        }
    }

    /**
     * Extracts text metadata from the document body for page indexation.
     * Boundary 2: Content script third-party DOM inspection.
     * @returns {Object} Extracted innerText, length, and description snippet.
     */
    static getPageTextMetadata(): { innerText: string; length: number; description: string } {
        try {
            const text = (typeof document !== 'undefined' && document.body && document.body.innerText) ? document.body.innerText : '';
            return {
                innerText: text,
                length: text.length,
                description: text.substring(0, 100)
            };
        } catch (err) {
            return { innerText: '', length: 0, description: '' };
        }
    }

    /**
     * Removes all floating symbol DOM nodes injected into the host page.
     * Boundary 2: Content script third-party DOM mutation.
     */
    static cleanFloatingSymbols(): void {
        try {
            if (typeof document === 'undefined') return;
            const symbols = document.querySelectorAll('.algo-floating-symbol');
            symbols.forEach(el => el.remove());
        } catch (err) {
            // ignore
        }
    }

    /**
     * Reads active card ID from host page rating widget DOM if present.
     * Boundary 2: Cross-widget DOM query fallback in content script layer.
     * @returns {string | null} Active card ID or null if not found.
     */
    static getActiveCardIdFromDOM(): string | null {
        try {
            if (typeof document === 'undefined') return null;
            return document.getElementById('fsrs-save-ratings')?.getAttribute('data-existing-id') || null;
        } catch (err) {
            return null;
        }
    }

    /**
     * Updates the approach textarea in the tracker overlay widget if active.
     * Boundary 2: Cross-widget DOM update fallback in content script layer.
     * @param {string | null} cardId - Target card identifier.
     * @param {string} value - Text content to set in approach textarea.
     */
    static updateApproachAreaValue(cardId: string | null, value: string): void {
        try {
            if (typeof document === 'undefined') return;
            const approachArea = document.getElementById('fsrs-approach') as HTMLTextAreaElement | null;
            if (!approachArea) return;
            const currentCardIdInUi = document.getElementById('fsrs-save-ratings')?.getAttribute('data-existing-id');
            if (!currentCardIdInUi || currentCardIdInUi === cardId || (cardId === null && currentCardIdInUi === '__new__')) {
                approachArea.value = value;
                try {
                    approachArea.dispatchEvent(new Event('input', { bubbles: true }));
                } catch (_) {
                    // Ignore event dispatch failure in non-standard environments
                }
            }
        } catch (err) {
            // ignore
        }
    }

    /**
     * Retrieves or creates the host mounting container for the floating highlighter tooltip.
     * Boundary 2: Host container injection in content script layer.
     * @returns {HTMLElement | null} Host container element.
     */
    static getOrCreateHighlighterHost(): HTMLElement | null {
        try {
            if (typeof document === 'undefined') return null;
            let host = document.getElementById('algo-highlighter-host');
            if (!host) {
                host = document.createElement('div');
                host.id = 'algo-highlighter-host';
                document.body.appendChild(host);
            }
            return host;
        } catch (err) {
            return null;
        }
    }

    /**
     * Removes the host mounting container for the floating highlighter tooltip.
     * Boundary 2: Host container removal in content script layer.
     */
    static removeHighlighterHost(): void {
        try {
            if (typeof document === 'undefined') return;
            const host = document.getElementById('algo-highlighter-host');
            if (host) {
                host.remove();
            }
        } catch (err) {
            // ignore
        }
    }

    /**
     * Retrieves or creates the dedicated host mounting container for the Tracker widget.
     * Boundary 2: Host container injection in content script layer.
     * @returns {HTMLElement | null} Host container element.
     */
    static getOrCreateTrackerHost(): HTMLElement | null {
        try {
            if (typeof document === 'undefined') return null;
            let host = document.getElementById('algo-tracker-host');
            if (!host) {
                host = document.createElement('div');
                host.id = 'algo-tracker-host';
                if (document.body) {
                    document.body.appendChild(host);
                }
            } else if (document.body && !document.body.contains(host)) {
                document.body.appendChild(host);
            }
            return host;
        } catch {
            return null;
        }
    }

    /**
     * Removes the host mounting container for the Tracker widget.
     * Boundary 2: Host container removal in content script layer.
     */
    static removeTrackerHost(): void {
        try {
            if (typeof document === 'undefined') return;
            const host = document.getElementById('algo-tracker-host');
            if (host) {
                host.remove();
            }
        } catch {
            // ignore
        }
    }

    /**
     * Queries the tracker host mounting container without creating it.
     * Boundary 2: Host container query in content script layer.
     * @returns {HTMLElement | null}
     */
    static getTrackerHost(): HTMLElement | null {
        try {
            if (typeof document === 'undefined') return null;
            return document.getElementById('algo-tracker-host');
        } catch {
            return null;
        }
    }

    /**
     * Checks if the floating launcher button is present in the DOM.
     * Boundary 2: Host container query in content script layer.
     * @returns {boolean}
     */
    static hasTrackerLauncher(): boolean {
        try {
            if (typeof document === 'undefined') return false;
            return !!document.getElementById('algo-fsrs-launcher');
        } catch {
            return false;
        }
    }
}

/**
 * Retrieves or creates the dedicated host mounting container for the Tracker widget.
 * Boundary 2: Host container injection in content script layer.
 */
export function getOrCreateTrackerHost(): HTMLElement | null {
    return Utils.getOrCreateTrackerHost();
}

/**
 * Removes the dedicated host mounting container for the Tracker widget.
 * Boundary 2: Host container removal in content script layer.
 */
export function removeTrackerHost(): void {
    Utils.removeTrackerHost();
}

/**
 * Queries the host mounting container without creating it.
 */
export function getTrackerHost(): HTMLElement | null {
    return Utils.getTrackerHost();
}

/**
 * Checks if the tracker launcher button is currently present in the DOM.
 */
export function isTrackerLauncherPresent(host?: HTMLElement | null): boolean {
    return Utils.hasTrackerLauncher();
}

try {
    getAlgoRecallGlobal().Utils = Utils;
} catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    Logger.error('ContentUtils', `Failed to assign Utils on window global scope: ${errorMessage}`, { err });
    // Comment: Non-fatal global scope registration error
}
