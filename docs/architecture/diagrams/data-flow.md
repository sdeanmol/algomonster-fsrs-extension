# Data Architecture & State Management Diagrams

This document contains formal Mermaid diagrams illustrating the storage schema, entity relationships, and distributed reactive state management across extension contexts.

---

## 1. Data Architecture & Entity Relationships (Diagram 4)

This diagram details the core data entities stored in `chrome.storage.local`, their structural fields, data types, and relationships.

```mermaid
erDiagram
    STORAGE_LOCAL ||--o{ CARD : contains
    STORAGE_LOCAL ||--o{ HIGHLIGHT_MARK : contains
    STORAGE_LOCAL ||--o{ BOOKMARK : contains
    STORAGE_LOCAL ||--|| USER_SETTINGS : persists
    STORAGE_LOCAL ||--|| POMODORO_STATE : persists
    STORAGE_LOCAL ||--o{ ACTIVITY_RECORD : logs

    CARD ||--|{ REVIEW_LOG : has
    REVIEW_LOG ||--o| PRE_STATE_SNAPSHOT : embeds

    CARD {
        string id PK "Unique Problem ID"
        string problemTitle "Human-Readable Problem Title"
        string problemUrl "Canonical Problem URL"
        string approach "User Solution Notes"
        string timeComplexity "Big-O Time Complexity"
        string spaceComplexity "Big-O Space Complexity"
        string tags "Topic Classification Tags"
        int due "Next Review Epoch Timestamp"
        float stability "FSRS Memory Stability in Days"
        float difficulty "FSRS Difficulty Rating"
        int elapsed_days "Days Since Previous Review"
        int scheduled_days "Days Scheduled for Current Interval"
        int reps "Total Repetitions Completed"
        int lapses "Total Recall Failures"
        int state "FSRS Memory State"
        int last_review "Epoch Timestamp of Last Study"
        int previousDue "Backup of Pre-Exam Due Date"
    }

    REVIEW_LOG {
        int rating "Recall Rating"
        int date "Review Epoch Timestamp"
        int duration "Elapsed Active Solving Time"
        int state "FSRS State at Review"
    }

    PRE_STATE_SNAPSHOT {
        float stability "Prior Stability Snapshot"
        float difficulty "Prior Difficulty Snapshot"
        int reps "Prior Repetitions Count"
        int lapses "Prior Lapses Count"
        int state "Prior FSRS State"
        int due "Prior Due Timestamp"
    }

    HIGHLIGHT_MARK {
        string id PK "Highlight UUID"
        string url "Target Page URL"
        string text "Extracted Text Content"
        string color "Hex Background Color Code"
        int createdAt "Creation Epoch Timestamp"
        string note "Attached User Annotation Note"
        string category "Classification Tag"
        json highlightSource "DOM Meta Coordinates for Restoration"
    }

    POMODORO_STATE {
        string state "Running Status"
        string phase "Current Phase"
        int currentSession "Session Index in Cycle"
        int timeRemaining "Seconds Remaining in Active Phase"
        int totalTime "Total Seconds in Active Phase"
        int targetEndTime "Target Epoch Timestamp"
    }

    USER_SETTINGS {
        string theme "Active Theme"
        json notificationSettings "Desktop Alerts and Quiet Hours"
        json extensionSettings "Highlighter Palettes and Toggles"
        json fsrsGlobalParams "Custom FSRS Weights"
        json whitelistedWebsites "Array of Domain Patterns"
        int dailyGoalTarget "Daily Review Goal Target Count"
        int longestStreak "All-Time Best Study Streak"
    }

    ACTIVITY_RECORD {
        string dateKey PK "ISO Date String"
        int reviewCount "Number of Reviews Completed on Date"
    }
```

---

## 2. State Management & Reactivity Architecture (Diagram 5)

This diagram visualizes state ownership, propagation mechanisms, and how distributed extension contexts stay synchronized without polling.

```mermaid
flowchart TB
    subgraph PersistentStore["Central State Store (chrome.storage.local)"]
        FSRS_CARDS["fsrsCards (Card Array)"]
        FSRS_ACT["fsrsActivity (Date Map)"]
        SETTINGS["userSettings and notificationSettings"]
        POMO_ST["pomodoroState (Timer State)"]
        MARKS_ST["marks (Highlight Marks)"]
    end

    subgraph ContentScriptState["Content Script Isolated World (content.ts)"]
        CS_LOCAL_STATE["AlgoRecallState (In-Memory Global)"]
        TRACKER_UI_STATE["Active Tab Selection and Debounce Flag"]
        HL_ACTIVE_RANGES["activeMarkRanges (Live DOM Ranges)"]
    end

    subgraph BackgroundState["Background Service Worker (background.ts)"]
        SW_GUARD["isCheckingDueCards (Re-entrancy Lock)"]
        POMO_TICKER["pomodoroIntervalId (Active Interval)"]
        CACHE_BADGE["Cached Badge and Title State"]
    end

    subgraph UIState["Extension View Tabs (Popup, Analytics, Data, StudyPlan)"]
        POP_DOM_CACHE["PopupDOM Cache Object"]
        DATA_FILTERS["searchQuery, selectedTag, sortBy"]
        ANA_CACHE["DataUtils In-Memory Aggregations"]
        EXAM_PREVIEW["StudyPlan Projected Workload Array"]
        POMO_CTRL_ACT["Pomodoro UI Controls"]
    end

    %% State Modification Flows (Writers)
    TRACKER_UI_STATE -->|reviewCard to storage.set| FSRS_CARDS
    TRACKER_UI_STATE -->|increment daily count| FSRS_ACT
    HL_ACTIVE_RANGES -->|saveHighlight to set| MARKS_ST
    POMO_CTRL_ACT -->|handlePomodoroAction to set| POMO_ST
    POP_DOM_CACHE -->|toggleTheme to set| SETTINGS

    %% Storage Reactivity (Readers / Observers)
    FSRS_CARDS -.->|chrome.storage.onChanged| CS_LOCAL_STATE
    SETTINGS -.->|chrome.storage.onChanged| SW_GUARD
    POMO_ST -.->|chrome.storage.onChanged| POP_DOM_CACHE
    FSRS_CARDS -.->|chrome.storage.onChanged| ANA_CACHE

    %% Reactive Actions
    SW_GUARD -->|recalculate badge| CHROME_ACTION["chrome.action.setBadgeText()"]
    SW_GUARD -->|reschedule alarms| ALARMS["chrome.alarms.create('checkFsrsReviews')"]
    CS_LOCAL_STATE -->|reapply CSS highlights| DOM_MUT["Apply Highlights to DOM"]
```
