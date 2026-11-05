# End-to-End Data Pipelines

This document details the end-to-end data processing pipelines in **AlgoRecall**, tracing how data flows between Chrome Storage, Content Scripts, the FSRS Scheduler, the WASM Optimization Engine, and UI components.

---

## 🔄 Card Review & Spaced Repetition Data Flow

When a user reviews a problem on a whitelisted coding platform (e.g. LeetCode or AlgoMonster), the rating choice (`Again`, `Hard`, `Good`, `Easy`) is processed through `FsrsScheduler` and saved to local storage.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Tracker as Tracker UI (tracker.ts)
    participant Sched as FsrsScheduler (fsrsScheduler.ts)
    participant FSRS as ts-fsrs Engine
    participant ST as chrome.storage.local
    participant CS as AlgoRecallOrchestrator

    User->>Tracker: Click Rating Button (e.g. Good)
    activate Tracker
    Tracker->>Sched: reviewCard(card, Rating.Good, customWeights, now, timeTaken)
    activate Sched
    Sched->>Sched: Check Algorithmic Debounce (<1 min window)
    alt Debounced / Rapid Re-review
        Sched-->>Tracker: Return debounced / corrected card state
    else Valid New Review
        Sched->>Sched: Append ReviewLog entry with preState snapshot
        Sched->>FSRS: scheduler.next(tsCard, now, rating)
        FSRS-->>Sched: Calculated next due, stability, difficulty, reps, lapses
        Sched-->>Tracker: Updated Card Object
    end
    deactivate Sched
    Tracker->>ST: chrome.storage.local.set({ fsrsCards, fsrsActivity })
    ST-->>CS: chrome.storage.onChanged event fired
    CS->>Tracker: refreshWidgetState()
    Tracker-->>User: UI updates due date badge & rating success notification
    deactivate Tracker
```

---

## 🧠 WASM Parameter Optimization Data Flow

When the user triggers parameter optimization, the system executes WASM-compiled Rust code (`@open-spaced-repetition/binding`) to compute personalized FSRS weights from review history.

```mermaid
flowchart TD
    A[User Triggers Optimization] --> B[FsrsOptimizer.computeEligibility]
    B --> C{Review Count >= 10?}
    C -- No --> D[Display Ineligibility Warning]
    C -- Yes --> E[Transform Card historyLog into FSRSBindingItem array]
    E --> F[Filter valid deltaT > 0 reviews]
    F --> G[Cap training set to max 1000 cards]
    G --> H[Invoke WASM computeParameters in WASI Worker]
    H -- Success --> I[Return 17-array optimized FSRS weights]
    H -- Exception / WASM OOM --> J[Fallback to FsrsOptimizerFast]
    J --> K[Heuristic Stochastic Gradient Descent]
    K --> I
    I --> L[Save to fsrsGlobalParams in chrome.storage.local]
    L --> M[Update active FsrsScheduler instance]
```

---

## 💾 Backup & Restore Data Flow

The `BackupManager` provides streaming export and import pipelines using Gzip compression and JSON Lines (JSONL).

### Export Pipeline
```mermaid
flowchart LR
    A[chrome.storage.local] --> B[URL Deduplication & Page Mapping]
    B --> C[JSONL Generator: Header, Pages, Cards, Marks, Settings]
    C --> D[FNV-1a Hash Stream Engine]
    D --> E[CompressionStream 'gzip']
    E --> F[Blob Creation & chrome.downloads]
```

### Import Pipeline
```mermaid
flowchart LR
    A[File Upload] --> B{Magic Bytes Check}
    B -- Gzip 0x1f 0x8b --> C[DecompressionStream 'gzip']
    B -- Legacy JSON --> D[BackupManager.importLegacy]
    C --> E[Pre-pass Line Streaming & FNV-1a Checksum Validation]
    E -- Pass --> F[Hydrate Cards, Marks, Bookmarks & Reconstruct URLs]
    F --> G[Atomic Storage Write: chrome.storage.local.set]
```

---

## 🔗 Related Documentation
* 📘 [Architecture Overview](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/overview.md)
* 📦 [State Management](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/state-management.md)
* 🧮 [FSRS Algorithm Theory](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/fsrs-algorithm.md)
* ⚡ [WASM Optimizer Runtime](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/optimizer-wasm.md)
* 🛠️ [Backup Manager Details](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/common.md)
