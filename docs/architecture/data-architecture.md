# Data Architecture & Storage Design

## 1. Storage Architecture Overview

AlgoRecall is designed around a **local-first storage architecture**. The primary persistence layer is [`chrome.storage.local`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/data/storage.md).

```
┌────────────────────────────────────────────────────────────────────────┐
│                      CHROME.STORAGE.LOCAL (ROOT)                       │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │ fsrsCards: Card[]     │             │ fsrsActivity: Record<string│  │
│  │ Core problem patterns │             │ Daily review counters      │  │
│  └───────────────────────┘             └────────────────────────────┘  │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │ marks: HighlightMark[]│             │ pomodoroState & Settings   │  │
│  │ DOM text annotations  │             │ Synchronized study timer   │  │
│  └───────────────────────┘             └────────────────────────────┘  │
│                                                                        │
│  ┌───────────────────────┐             ┌────────────────────────────┐  │
│  │ userSettings & Config │             │ studyPlanSettings          │  │
│  │ Whitelist, palettes   │             │ Exam countdown schedule    │  │
│  └───────────────────────┘             └────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Why `chrome.storage.local` over `chrome.storage.sync`?
1. **Payload Size Constraints**: Chrome limits `chrome.storage.sync` to **100 KB total** and **8 KB per item**. A collection of 200 coding problems with Markdown solution approaches and historical review logs easily exceeds 500 KB to 2 MB.
2. **Quota Throttling**: `chrome.storage.sync` enforces strict write quotas (120 operations per minute). High-frequency operations like highlighter text dragging or Pomodoro session updates easily trigger quota errors.
3. **Privacy by Default**: By storing data exclusively in `chrome.storage.local`, no personal problem notes or code solutions leave the user's local machine without explicit backup export.

---

## 2. Core Domain Entities

The central domain model is defined in [`types/domain.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/types/domain.ts).

### 2.1 The Problem Card Entity (`Card`)
Represents an algorithmic coding problem and its spaced repetition memory state:

```typescript
export interface Card extends FSRSCardState {
    id: string;                    // Unique identifier (URL slug or timestamp hash)
    problemTitle: string;          // Human-readable title (e.g., "LRU Cache")
    problemUrl: string;            // Canonical problem URL
    textRead?: string;             // Problem description or snippet context
    approach?: string;             // Markdown personal notes & solution approach
    timeComplexity?: string;       // Big-O Time (e.g., "O(1)")
    spaceComplexity?: string;      // Big-O Space (e.g., "O(capaciy)")
    tags?: string[];               // Categories (e.g., ["Hash Table", "Doubly-Linked List"])
    historyLog?: ReviewLog[];      // Chronological history of all review events
    previousDue?: number;          // Prior due date for Exam Mode rollbacks
    lastRating?: number;           // Most recent user rating (1-4)
}
```

### 2.2 Mathematical FSRS Memory Metrics (`FSRSCardState`)
```typescript
export interface FSRSCardState {
    due: number;                   // Epoch timestamp (ms) when card is next due
    stability: number;             // Memory stability in days (time for R to drop to 90%)
    difficulty: number;            // Intrinsic problem difficulty (1.0 easiest to 10.0 hardest)
    elapsed_days: number;          // Days elapsed since previous review
    scheduled_days: number;        // Scheduled interval between reviews
    learning_steps: number;        // Step index in short-term learning sequence
    reps: number;                  // Total successful review repetitions
    lapses: number;                // Total recall failures (rating Again=1 in Review state)
    state: State;                  // 0: New, 1: Learning, 2: Review, 3: Relearning
    last_review?: number | null;   // Epoch timestamp (ms) of most recent review
}
```

### 2.3 Review Log Entry (`ReviewLog`)
```typescript
export interface ReviewLog {
    rating: Rating | number;       // Again(1), Hard(2), Good(3), Easy(4), Manual(0)
    date: number;                  // Epoch timestamp (ms) of review event
    duration?: number;             // Time spent solving/reviewing problem (ms)
    state?: State;                 // State prior to or at time of review
    preState?: Partial<FSRSCardState>; // Snapshot of metrics prior to review (for instant rollback)
}
```

### 2.4 Highlight Mark (`HighlightMark`)
```typescript
export interface HighlightMark {
    id: string;                    // UUID or timestamp
    url: string;                   // Page URL where mark was made
    text: string;                  // Highlighted text excerpt
    color: string;                 // Hex color code (e.g., "#f1c40f")
    createdAt: number;             // Creation timestamp
    note?: string;                 // User annotation attached to highlight
    category?: string;             // Category/tag
    highlightSource?: {            // DOM anchor coordinates for range restoration
        startMeta?: DOMMeta;
        endMeta?: DOMMeta;
    };
}
```

---

## 3. Data Relationships & Schema Normalization

```
┌─────────────────────┐                 ┌───────────────────────┐
│     PAGE / URL      │ 1             * │     HighlightMark     │
│ (Canonical Webpage) ├─────────────────┤ (Text DOM Annotations)│
└──────────┬──────────┘                 └───────────────────────┘
           │
           │ 1
           │
           │ *
┌──────────▼──────────┐                 ┌───────────────────────┐
│        Card         │ 1             * │       ReviewLog       │
│  (Algorithm Card)   ├─────────────────┤ (Historical Reviews)  │
└─────────────────────┘                 └───────────┬───────────┘
                                                    │ 1
                                                    │ 1 (optional)
                                        ┌───────────▼───────────┐
                                        │       preState        │
                                        │  (Snapshot Rollback)  │
                                        └───────────────────────┘
```

- **URL-to-Card**: One webpage URL can map to multiple cards (e.g. if a problem has multiple variations), though typically 1:1. The helper `getCardsForUrl()` resolves all associated cards for an active URL.
- **Card-to-ReviewLog**: 1:N composition. Every study event appends a `ReviewLog` entry.
- **ReviewLog-to-preState**: 1:1 embedded composition. Contains the exact mathematical snapshot prior to that review event, providing zero-loss rollback if rating was mis-clicked.
- **URL-to-HighlightMark**: 1:N composition. Stored marks are keyed and filtered by canonical URL.

---

## 4. Entity Lifecycle & Persistence Workflows

### 4.1 Card Creation Workflow
1. User visits LeetCode problem (e.g. `leetcode.com/problems/two-sum/`).
2. Content script `Tracker` widget detects problem title and URL.
3. User enters notes, approaches, and clicks **Save Problem**:
   - `FsrsScheduler.createCard()` instantiates initial card with `createEmptyCard(now)`:
     - `state = State.New (0)`
     - `stability = 0`
     - `difficulty = 0`
     - `due = now`
     - Initial log: `[{ rating: Rating.Manual, date: now }]`
   - Card is committed to `fsrsCards` array in `chrome.storage.local`.
   - `chrome.storage.onChanged` fires, triggering toolbar badge recalculation.

### 4.2 Card Review Workflow
1. User reviews card in Tracker overlay or Popup rating component.
2. User selects recall rating (`Again=1`, `Hard=2`, `Good=3`, `Easy=4`).
3. `FsrsScheduler.reviewCard()` executes:
   - Evaluates rapid re-review debounce (< 1 minute).
   - Generates `preState` snapshot on the new log entry.
   - Executes `ts-fsrs.next(tsCard, new Date(now), rating)`.
   - Updates `stability`, `difficulty`, `reps`, `lapses`, and calculates new `due` timestamp.
4. Updated card commits to `chrome.storage.local`.
5. Background service worker receives storage change, updates `fsrsActivity[today]++`, and updates extension icon badge.
