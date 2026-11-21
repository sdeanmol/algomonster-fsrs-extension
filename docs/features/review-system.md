# In-Page Review System & Fullscreen Card Editor

## 1. Overview

The Review System is the primary in-page user interface of AlgoRecall. It enables learners to solve problems on coding platforms (LeetCode, AlgoMonster, Codeforces) while recording approaches, notes, complexities, and rating their recall using spaced repetition without ever leaving the page.

---

## 2. In-Page Problem Tracker Widget (`features/tracker/tracker.ts`)

### 2.1 DOM Injection & Floating Widget Layout

When the content script detects a whitelisted coding platform, `AlgoRecallOrchestrator` calls `Tracker.createUI()`. This injects two persistent elements into `document.body`:
1. **`#algo-fsrs-launcher`**: A compact floating action button that opens or collapses the review tracker overlay.
2. **`#algo-fsrs-tracker`**: The floating review widget container.

```
┌────────────────────────────────────────────────────────────────────────┐
│  #algo-fsrs-tracker (Draggable & Collapsible Container)               │
├────────────────────────────────────────────────────────────────────────┤
│  Header: [Drag Handle] "AlgoRecall: Two Sum"      [Minimize] [Close]   │
├────────────────────────────────────────────────────────────────────────┤
│  Multi-Card Tabstrip: [Card 1: Hash Map] [Card 2: Two Pointers] [+]   │
├────────────────────────────────────────────────────────────────────────┤
│  Approach Notes (Markdown Supported):                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Use a hash table to store complements.                           │  │
│  │ Time: O(n), Space: O(n).                                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────────────┤
│  Tag Editor: [Array] [Hash Table] [+ Add Tag]                         │
├────────────────────────────────────────────────────────────────────────┤
│  Spaced Repetition Rating Controls (Keyboard Hotkeys: 1-4):           │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│  │ 1: Again     │ │ 2: Hard      │ │ 3: Good      │ │ 4: Easy      │   │
│  │ (< 1 day)    │ │ (3 days)     │ │ (8 days)     │ │ (18 days)    │   │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
├────────────────────────────────────────────────────────────────────────┤
│  Footer Actions: [Save Problem] [Open Fullscreen Editor ↗]             │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Multi-Card Navigation for Problem Variations
A single problem URL may have multiple distinct algorithmic solutions (e.g. "Two Sum" can be solved via Brute Force, Hash Map, or Two Pointers on a sorted array). The Tracker widget supports **Multi-Card Navigation**:
- Resolves all cards matching the canonical URL via `getCardsForUrl(url, cards)`.
- Renders an interactive tabstrip allowing the user to switch between problem variations.
- Clicking `+` creates a new card instance for an alternative solution approach.

### 2.3 Keyboard Shortcut Binding
During an active review session, `Tracker` attaches document keydown listeners (`_reviewKeyHandler`):
- `1`: Rate **Again** (recall failure / lapse).
- `2`: Rate **Hard** (recalled with significant effort).
- `3`: Rate **Good** (correct recall with standard hesitation).
- `4`: Rate **Easy** (immediate, flawless recall).
- `Space`: Reveal solution approach / flip card.
- `Enter`: Advance to next due card.

Keyboard triggers are automatically suppressed when focus is inside text inputs, textareas, or `contenteditable` elements to avoid interfering with code writing.

---

## 3. Fullscreen Card Editor (`features/tracker/editor/editor.ts`)

For extensive problem solution write-ups, code snippet formatting, and diagramming, users can open the **Fullscreen Editor** (`editor.html`):

```
┌────────────────────────────────────────────────────────────────────────┐
│  AlgoRecall Fullscreen Card Editor                                     │
├───────────────────────────────────┬────────────────────────────────────┤
│  Markdown Editor (Left Pane)      │  Live Rendered Preview (Right Pane)│
│                                   │                                    │
│  # Two Sum Approach               │  Two Sum Approach                  │
│                                   │                                    │
│  ```python                        │  def twoSum(nums, target):         │
│  def twoSum(nums, target):        │      seen = {}                     │
│      seen = {}                    │      for i, num in enumerate(nums):│
│      ...                          │          ...                       │
│  ```                              │                                    │
├───────────────────────────────────┴────────────────────────────────────┤
│  Metadata Controls:                                                    │
│  - Time Complexity: [ O(n) ]      - Space Complexity: [ O(n) ]         │
│  - Tags: [Array, Hash Table]      - Initial Difficulty: [Medium (5.0)] │
├────────────────────────────────────────────────────────────────────────┤
│  Actions: [Cancel] [Delete Card] [Save Changes]                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Security & Sanitization
All markdown rendering in the Fullscreen Editor passes through [`features/common/markdown.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/markdown.ts), which wraps `marked.js` with **DOMPurify**:
```typescript
import DOMPurify from 'dompurify';

export function renderMarkdown(content: string): string {
    const rawHtml = marked.parse(content || '');
    return DOMPurify.sanitize(rawHtml, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'h1', 'h2', 'h3', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote', 'table', 'tr', 'td', 'th'],
        ALLOWED_ATTR: ['href', 'target', 'class']
    });
}
```
This guarantees that malicious code or payloads in problem notes cannot execute scripts inside extension pages.
