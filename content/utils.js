/**
 * @file content/utils.js
 * @description General helper utilities for in-page content scripts.
 * Contains DOM serialization routines for highlights persistence across tab reloads,
 * dynamic theme styling injections (CSS Custom Highlights API), and heuristic parsing
 * of problem tags and titles across coding environments (LeetCode, AlgoMonster, AtCoder).
 * Upstream dependencies: content/state.js (references activeHighlightStyles).
 * Downstream dependencies: features/highlighter/highlighter.js, features/tracker/tracker.js, content/content.js.
 */

/**
 * Serializes the DOM path coordinates of a given text node.
 * Loops parent elements up to the body/document root to produce a unique node path index list,
 * allowing highlight selections to survive page reloads and edits on dynamic web content.
 * 
 * @param {Node} node - The targeted DOM text node.
 * @param {number} offset - The cursor text range index offset within the text node.
 * @returns {Object} JSON meta coordinates schema.
 */
function getDOMMeta(node, offset) {
    const parent = node.parentNode;
    let path = [];
    let current = parent;
    while (current && current !== document.body && current !== document.documentElement) {
        let index = Array.from(current.parentNode.childNodes).indexOf(current);
        path.unshift(index);
        current = current.parentNode;
    }

    return {
        parentTagName: parent.tagName.toLowerCase(),
        parentIndex: Array.from(parent.childNodes).indexOf(node),
        textOffset: offset,
        parentDomPath: path
    };
}

/**
 * Restores a DOM selection range from serialized meta coordinates.
 * Attempts precise tree path traversal first, with a fallback text tree walker
 * search based on tag names and indices if page elements changed.
 * 
 * @param {Object} highlightSource - Serialized start/end coordinates object.
 * @param {string} markText - The original highlighted text snippet to verify correctness.
 * @returns {Range|null} Restored DOM Range object, or null if restoration failed.
 */
function restoreRangeFromMeta(highlightSource, markText) {
    try {
        let startNode = null;
        let endNode = null;
 
        if (highlightSource.startMeta.parentDomPath && highlightSource.endMeta.parentDomPath) {
            const resolvePath = (path, childIndex) => {
                let current = document.body;
                for (let i = 0; i < path.length; i++) {
                    if (!current || !current.childNodes) return null;
                    current = current.childNodes[path[i]];
                }
                return current ? current.childNodes[childIndex] : null;
            };

            startNode = resolvePath(highlightSource.startMeta.parentDomPath, highlightSource.startMeta.parentIndex);
            endNode = resolvePath(highlightSource.endMeta.parentDomPath, highlightSource.endMeta.parentIndex);
        }

        if (!startNode || !endNode) {
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
            let node;
            while ((node = walker.nextNode())) {
                const parent = node.parentNode;
                const parentTagName = parent.tagName.toLowerCase();
                const parentIndex = Array.from(parent.childNodes).indexOf(node);

                if (!startNode && parentTagName === highlightSource.startMeta.parentTagName && parentIndex === highlightSource.startMeta.parentIndex) startNode = node;
                if (startNode && parentTagName === highlightSource.endMeta.parentTagName && parentIndex === highlightSource.endMeta.parentIndex) {
                    endNode = node;
                    break;
                }
            }
        }

        if (startNode && endNode) {
            const range = document.createRange();
            const startOffset = Math.min(highlightSource.startMeta.textOffset, startNode.length || 0);
            const endOffset = Math.min(highlightSource.endMeta.textOffset, endNode.length || 0);

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
    } catch (e) { }
    return null;
}

/**
 * Dynamically registers highlight style rules using CSS Custom Highlights API.
 * Ensures the document has a matching ::highlight(name) ruleset for the hex color.
 * 
 * @param {string} color - Hex color code.
 * @returns {string} The registered highlight class name.
 */
function ensureHighlightStyle(color) {
    const colorName = `algo-hl-${color.replace('#', '')}`;
    if (!activeHighlightStyles.has(colorName)) {
        const style = document.createElement('style');
        style.textContent = `::highlight(${colorName}) { background-color: ${color}; color: inherit; }`;
        document.head.appendChild(style);
        activeHighlightStyles.add(colorName);
    }
    return colorName;
}

/**
 * Extracts default tags from the current window path segment.
 * If the path ends in a structured topic (e.g. dynamic_programming),
 * returns it formatted as title case words ("Dynamic Programming").
 * @returns {string[]} Array of extracted topic tags.
 */
function getAutoTags() {
    try {
        const path = window.location.pathname;
        const segments = path.split('/').filter(p => p.length > 0);
        if (segments.length > 0) {
            const rawTopic = segments[segments.length - 1];
            return [rawTopic.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')];
        }
    } catch (e) { }
    return ["AlgoRecall"];
}

/**
 * Heuristically parses the DOM structure or document title to extract
 * the active coding problem title, stripping known branding strings.
 * Supports specialized selector matching for LeetCode Explore card layouts.
 * @returns {string} Cleansed coding problem title.
 */
function getExtractedProblemTitle() {
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
            const el = document.querySelector(selector);
            if (el && el.innerText && el.innerText.trim().length > 0 && el.innerText.trim().length < 100) {
                const text = el.innerText.trim();
                if (!text.toLowerCase().includes('leetcode') || text.toLowerCase().includes('course') || text.toLowerCase().includes('crash')) {
                    return text;
                }
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
        } catch (e) {}
    }
    
    // General title fallback
    let title = document.title;
    title = title.replace(' - AlgoMonster', '');
    title = title.replace(' - LeetCode', '');
    title = title.replace(' - Codeforces', '');
    title = title.replace(' - CodeChef', '');
    title = title.replace(' - AtCoder', '');
    return title.trim();
}

