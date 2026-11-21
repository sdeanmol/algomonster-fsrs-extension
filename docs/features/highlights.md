# In-Page Text Highlighter & Annotation Management

## 1. Overview & Modern Web Integration

AlgoRecall includes an in-page text highlighter and annotation manager implemented in [`features/highlighter/highlighter.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/highlighter.ts).

Unlike traditional highlighter extensions that wrap text in hundreds of intrusive `<span class="highlight">` elements—which breaks syntax highlighters (e.g. Monaco / CodeMirror on LeetCode), disrupts React DOM reconcilers, and invalidates DOM event listeners—AlgoRecall integrates the modern **W3C CSS Custom Highlights API** (`CSS.highlights` and `::highlight()`).

---

## 2. Technical Architecture

### 2.1 CSS Custom Highlights API vs Fallback

```
                            User Selects Text in Host Webpage
                                            │
                                            ▼
                           Highlighter.handleSelection()
                                            │
                                            ▼
                           Is CSS.highlights Supported?
                                            │
                    ┌───────────────────────┴───────────────────────┐
                    ▼                                               ▼
         Yes (Modern Chrome 105+)                       No (Legacy Fallback)
         - Creates live Range object                   - Serializes range boundaries
         - Registers Highlight object:                 - Injects non-breaking overlay
           CSS.highlights.set(id, new Highlight(range))  elements using absolute
         - Styles via pseudo-element:                    coordinates
           ::highlight(algo-mark-yellow) { ... }
         - Zero DOM tree mutation!
```

### 2.2 DOM Range Serialization & Restoration (`DOMMeta`)
Because webpages reload and text content shifts dynamically during SPA navigations, raw DOM `Range` objects cannot be directly persisted. The system serializes text ranges into boundary metadata (`DOMMeta`):

```typescript
export interface DOMMeta {
    path?: string;        // Structural hierarchy path of container node
    offset?: number;      // Character offset within container text node
    textSnippet?: string; // Prefix/suffix text snippet around selection
}
```

When a page loads or an SPA navigation occurs, `Highlighter.applyHighlightsForCurrentPage()`:
1. Queries all stored `marks` where `mark.url === window.location.href`.
2. Reconstructs DOM `Range` objects using `restoreRangeFromMeta()`.
3. Verifies that the restored range text matches `mark.text`.
4. Re-registers the ranges with `CSS.highlights`.

---

## 3. Highlighter Floating Tooltip & Card Linking

### 3.1 Floating Color Swatch Tooltip (`#algo-highlight-tooltip`)
When text is selected, `Highlighter` anchors a floating dialog above the selection:
- Displays swatches for the 5 active palette colors (`DEFAULT_PALETTES`).
- Color picker button with state preservation: if the user opens the native OS color picker dialog, `Highlighter` caches `savedRange` so the selection is not lost when the picker steals focus.
- Note input field for adding personal insights.

### 3.2 Card Approach Linking
Clicking **Add to Card Approach** on a highlight mark automatically appends the highlighted text quote into the markdown solution notes of the corresponding problem card:
```markdown
> "A hash map provides O(1) average lookup time by computing hash buckets..."
```
This connects in-page reading and algorithm documentation directly with the spaced repetition study queue.
