# Data Models & TypeScript Interfaces

## 1. Overview

The data architecture of AlgoRecall is strictly typed via TypeScript definitions located in [`types/domain.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/types/domain.ts) and [`types/backup.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/types/backup.ts).

This document serves as the complete reference for all core entities, data transfer objects, enums, and configuration objects.

---

## 2. Core Entities

### 2.1 `Card`
Represents a tracked algorithmic problem flashcard stored in `chrome.storage.local`.

```typescript
export interface Card extends FSRSCardState {
    id: string;                    // Unique identifier (UUID or problem title hash)
    problemTitle: string;          // Human-readable title (e.g. "Binary Tree Maximum Path Sum")
    problemUrl: string;            // Canonical webpage URL on coding platform
    textRead?: string;             // Problem description or snippet context
    approach?: string;             // Markdown personal notes & algorithmic solution explanation
    timeComplexity?: string;       // Big-O time complexity (e.g. "O(n)")
    spaceComplexity?: string;      // Big-O space complexity (e.g. "O(h)")
    tags?: string[];               // Array of categorization tags (e.g. ["Tree", "DFS"])
    historyLog?: ReviewLog[];      // Chronological history of all review events
    previousDue?: number;          // Prior due date for Exam Mode rollbacks
    lastRating?: number;           // Most recent user recall rating (1-4)
    [key: string]: unknown;        // Extensible key-value store
}
```

### 2.2 `FSRSCardState`
Pure mathematical spaced repetition memory metrics serialized for JSON storage:

```typescript
export interface FSRSCardState {
    due: number;                   // Unix timestamp (ms) indicating when card is next due
    stability: number;             // Memory stability in days (time for R to drop to requestRetention)
    difficulty: number;            // Intrinsic problem difficulty on continuous scale (1.0 to 10.0)
    elapsed_days: number;          // Days elapsed since card's previous review
    scheduled_days: number;        // Scheduled interval days between previous review and this due date
    learning_steps: number;        // Current step index in short-term learning/relearning sequence
    reps: number;                  // Total successful review repetitions completed
    lapses: number;                // Total recall failures (rating Again in Review state)
    state: State;                  // Current memory lifecycle state: New(0), Learning(1), Review(2), Relearning(3)
    last_review?: number | null;   // Unix timestamp (ms) of most recent review, or null if unreviewed
}
```

### 2.3 `ReviewLog`
Historical study log recording an individual review occurrence:

```typescript
export interface ReviewLog {
    rating: Rating | number;       // User assessment rating (Again=1, Hard=2, Good=3, Easy=4, Manual=0)
    date: number;                  // Unix timestamp (ms) of review event
    duration?: number;             // Active review/solving time in milliseconds
    state?: State;                 // Card learning state at time of review
    preState?: Partial<FSRSCardState>; // Exact mathematical state snapshot prior to review
    [key: string]: unknown;
}
```

### 2.4 `HighlightMark`
DOM text selection highlight mark persisted across page reloads:

```typescript
export interface HighlightMark {
    id: string;                    // Unique highlight identifier (UUID or timestamp)
    url: string;                   // Target webpage URL
    text: string;                  // Extracted string of highlighted text
    color: string;                 // Hex color code (e.g. "#f1c40f")
    type?: string;                 // Semantic classification ('text', 'code', etc.)
    createdAt: number;             // Unix timestamp (ms) when highlight was created
    note?: string;                 // User annotation note attached to highlight
    category?: string;             // Category/tag
    highlightSource?: {            // DOM boundary positioning metadata
        startMeta?: DOMMeta;
        endMeta?: DOMMeta;
    };
    [key: string]: unknown;
}
```

### 2.5 `PomodoroState` & `PomodoroSettings`
Active countdown execution state and configurable thresholds:

```typescript
export interface PomodoroState {
    state: 'idle' | 'running' | 'paused';
    phase: 'focus' | 'shortBreak' | 'longBreak';
    targetEndTime: number;         // Unix timestamp (ms) when active phase completes
    currentSession: number;        // 1-based session index in current 4-phase cycle
}

export interface PomodoroSettings {
    focusDuration: number;         // Minutes (default 25)
    shortBreakDuration: number;    // Minutes (default 5)
    longBreakDuration: number;     // Minutes (default 15)
    sessionsBeforeLongBreak: number;// Count (default 4)
}

export interface PomodoroStats {
    sessionsToday: number;
    focusMinutesToday: number;
    lastDate: string;              // ISO date string ('YYYY-MM-DD')
}
```

---

## 3. Storage Data Schema (`StorageData`)

The root schema representing all top-level keys stored in `chrome.storage.local`:

```typescript
export interface StorageData {
    fsrsCards?: Card[];
    fsrsActivity?: { [date: string]: number };
    fsrsTopicWeights?: { [topic: string]: number[] };
    fsrsGlobalParams?: FSRSParameters | Partial<FSRSParameters>;
    notificationSettings?: NotificationSettings;
    whitelistedWebsites?: WhitelistedWebsite[];
    extensionSettings?: ExtensionSettings;
    theme?: string;
    marks?: HighlightMark[];
    bookmarks?: BookmarkItem[];
    pomodoroState?: PomodoroState;
    pomodoroSettings?: PomodoroSettings;
    pomodoroStats?: PomodoroStats;
    weeklySummaryEnabled?: boolean;
    dailyGoalTarget?: number | null;
    longestStreak?: number;
    unlockedAchievements?: string[];
    userSettings?: UserSettings;
    [key: string]: unknown;
}
```
