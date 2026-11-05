# Tracker & Editor Feature Module

This document provides a detailed breakdown of the **Tracker** overlay UI, full-screen **Editor**, rating interaction mechanics, preState snapshots, and algorithmic debouncing logic.

---

## 🧩 Module Overview

The Tracker module consists of:
* **Floating Tracker Launcher & Overlay (`features/tracker/tracker.ts`)**: Injected into whitelisted coding problem pages to present due status, tags, and rating buttons (`Again`, `Hard`, `Good`, `Easy`).
* **Full-Screen Editor (`features/tracker/editor/editor.ts`)**: Standalone page (`editor.html`) allowing rich editing of card fields (problem title, URL, tags, approach markdown, complexity).
* **FSRS Configuration Modal (`features/tracker/config/fsrsConfig.ts`)**: Parameter tuning modal (`fsrsConfig.html`) for editing global $w$ weights, target retention, and triggering optimization.
* **Abstract Scheduler Base (`features/tracker/scheduler/scheduler.ts`)**: Base interface extended by `FsrsScheduler`.

```mermaid
graph TD
    subgraph Whitelisted Webpage
        L[Launcher Button: algo-fsrs-launcher]
        O[Overlay Card Widget: algo-fsrs-container]
    end

    subgraph Overlay UI Controls
        RB[Rating Buttons: Again / Hard / Good / Easy]
        TAG[Tag Input Field]
        APP[Approach Markdown Area]
        FSE[Open Fullscreen Editor Button]
    end

    subgraph Core Scheduler
        FS[FsrsScheduler]
        DEB[Algorithmic Debounce Check]
        SNAP[preState Snapshot Logger]
    end

    L -->|Click| O
    O --> RB
    O --> TAG
    O --> APP
    O --> FSE
    RB -->|Submit Rating| FS
    FS --> DEB
    DEB --> SNAP
    FSE -->|chrome.runtime.sendMessage| BGSW[Open editor.html]
```

---

## ⚡ Algorithmic Debouncing & Rating Corrections

To prevent accidental double-clicks or key mashing from corrupting FSRS stability metrics, `FsrsScheduler` implements rapid re-review debouncing (< 1 minute window).

### Scenario 1: Duplicate Rating Submission (< 1 minute)
If a user clicks the same rating button twice in under 1 minute:
* FSRS calculation is **suppressed**.
* Additional review duration is added to the existing log entry.
* The review count and history log length remain unchanged.

### Scenario 2: Rating Correction (< 1 minute)
If a user mis-clicks `Good` and immediately changes their selection to `Again`:
1. The last review log entry is popped from `historyLog`.
2. Card fields (`stability`, `difficulty`, `reps`, `lapses`, `due`, `state`) are restored from the `preState` snapshot.
3. `reviewCard()` is re-executed from the restored base state using the new rating.

```typescript
// preState snapshot structure stored in ReviewLog
export interface ReviewLog {
    rating: Rating | number;
    date: number;
    duration?: number;
    preState?: {
        stability: number;
        difficulty: number;
        reps: number;
        lapses: number;
        state: State;
        due: number;
        last_review?: number | null;
        elapsed_days?: number;
        scheduled_days?: number;
        learning_steps?: number;
    };
}
```

```mermaid
flowchart TD
    A["User submits rating (Again / Hard / Good / Easy)"] --> B{"Is card reviewed < 60s ago?"}
    
    B -- "No: Standard Review" --> C["Capture preState snapshot of card"]
    C --> D["Execute FSRS calculateNextState()"]
    D --> E["Append ReviewLog entry with preState"]
    E --> F["Save updated card to chrome.storage.local"]
    F --> G["Display 5s Undo Toast on page"]
    
    B -- "Yes: Rapid Re-Review" --> H{"Is new rating == previous rating?"}
    H -- "Yes: Duplicate Submission" --> I["Suppress FSRS recalculation"]
    I --> J["Add elapsed duration to current ReviewLog"]
    J --> F
    
    H -- "No: Immediate Correction" --> K["Pop previous ReviewLog from history"]
    K --> L["Restore card stability, difficulty & reps from preState"]
    L --> D
    
    G --> M{"User clicks Undo button?"}
    M -- "Yes" --> N["Restore card state from preState"]
    N --> O["Remove last ReviewLog & clear toast"]
    O --> F
    M -- "No (5s timeout)" --> P["Dismiss toast & finalize review"]
```

---

## 🚀 Problem Tracker Launcher Button & Visibility Control

The in-page quick launcher button (`algo-fsrs-launcher`) floats along the edge of whitelisted problem pages, providing immediate single-click access to the review panel and card editor.

* **User Configurable Toggle (`showLauncher`)**: Users can disable the floating launcher button from the extension popup options.
* **Storage Synchronization**: Listens for changes to `extensionSettings.showLauncher`. When toggled to `false`, the button is smoothly hidden (`display: none`) and click listeners are suspended.
* **Non-Visual Access**: When the visual launcher is hidden, cards and review panels can still be accessed seamlessly through browser keyboard shortcuts or the extension popup.

```mermaid
flowchart LR
    A["Page Navigation / MutationObserver"] --> B{"Is domain whitelisted?"}
    B -- "No" --> C["Exit / Do not mount UI"]
    B -- "Yes" --> D["Read extensionSettings.showLauncher"]
    D --> E{"showLauncher == true?"}
    E -- "Yes" --> F["Mount #algo-fsrs-launcher on DOM edge"]
    F --> G["Listen for user click"]
    G --> H["Toggle #algo-fsrs-container overlay"]
    E -- "No" --> I["Set launcher display: none"]
    I --> J["Await keyboard shortcut or popup command"]
    
    K["User toggles showLauncher in Popup"] --> L["chrome.storage.onChanged event"]
    L --> D
```

---

## 📝 Full-Screen Editor (`editor.ts`)

The Editor UI handles standalone card creation and modification. Key features include:
* Auto-populating problem title and URL from active tab parameters.
* **Real-time Sanitized Markdown Preview**: Renders problem approach notes and complexity breakdowns using modern Marked.js parser coupled with DOMPurify sanitization ([`features/common/markdown.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/markdown.ts)) to eliminate script, form, or iframe injections.
* Time and space complexity fields ($O(N)$, $O(1)$).
* Interactive tag management with auto-suggestions.
* **AlgoRecall Brand Identity**: Integrated header pill with official branding and version badge.

```mermaid
flowchart LR
    A["User types in Approach textarea"] --> B["Debounced input event (150ms)"]
    B --> C["Pass raw string to renderMarkdown()"]
    C --> D["Marked.js parses GitHub-flavored markdown"]
    D --> E["Raw HTML generated"]
    E --> F["DOMPurify sanitization (FORBID_TAGS: script, iframe, form...)"]
    F --> G{"DOMPurify available?"}
    G -- "Yes" --> H["Sanitized safe HTML string"]
    G -- "No (fallback)" --> I["Strict Regex element stripping"]
    I --> H
    H --> J["Inject into #approach-preview container"]
```

---

## 🔗 Related Documentation
* 🧮 [FSRS Algorithm Theory](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/fsrs-algorithm.md)
* 📖 [FSRS Rating Selection Guide](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/rating-guide.md)
* ⚙️ [Developer & Customization Guide](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/customization.md)
* 📋 [Feature Enhancements Requirements](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/requirements.md)
* 🖥️ [Content Scripts Core](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/runtime-core/content-scripts.md)
