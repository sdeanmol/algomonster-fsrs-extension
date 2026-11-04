# End-to-End Data Pipelines

This document details the complete data processing pipelines in **AlgoRecall**, tracing how information flows between the Preact UI components, Chrome Storage, Content Scripts, the FSRS Scheduler, the WASM Optimization Engine, and the Background Service Worker.

---

## 🔄 Card Review & Spaced Repetition Data Pipeline

When a user reviews a problem on a whitelisted coding platform (e.g., LeetCode, AlgoMonster, Codeforces), the rating input (`Again`, `Hard`, `Good`, `Easy`) is processed through `FsrsScheduler` and persisted to storage.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant TrackerUI as Preact Tracker Overlay (tracker.tsx)
    participant Sched as FsrsScheduler (fsrsScheduler.ts)
    participant Engine as ts-fsrs Mathematical Model
    participant Storage as chrome.storage.local
    participant Content as AlgoRecallOrchestrator (content.ts)
    participant BG as AlgoRecallBackground (background.ts)

    User->>TrackerUI: Click Rating Button (e.g. Good = Rating.Good)
    activate TrackerUI
    TrackerUI->>Sched: reviewCard(card, Rating.Good, customWeights, now, timeTaken)
    activate Sched
    Sched->>Sched: Check Algorithmic Debounce (<1 min window)
    alt Rapid Re-Review (<1 min)
        Sched-->>TrackerUI: Return debounced / corrected card state
    else Valid New Review
        Sched->>Sched: Append ReviewLog entry with preState snapshot
        Sched->>Engine: scheduler.next(tsCard, now, rating)
        Engine-->>Sched: Next due, stability, difficulty, reps, lapses
        Sched-->>TrackerUI: Return updated Card entity
    end
    deactivate Sched

    TrackerUI->>Storage: chrome.storage.local.set({ fsrsCards, fsrsActivity })
    Storage-->>Content: chrome.storage.onChanged event fired
    Content->>TrackerUI: Refresh widget due badge & disable rating buttons
    Storage-->>BG: chrome.storage.onChanged event fired
    BG->>BG: Recalculate toolbar badge count & reschedule alarm
    TrackerUI-->>User: Visual success feedback & updated interval badge
    deactivate TrackerUI
```

---

## 🖥️ Preact Component Data Hydration & Render Pipeline

All 16 extension pages follow a structured hydration and rendering pipeline managed by Preact functional components and custom hooks:

```mermaid
flowchart TD
    A[User Opens Extension Page / Popup] --> B[HTML Shell Loads theme-sync.js & base.css]
    B --> C[Webpack Bundle Boots / Mounts Preact Root Component into #root]
    C --> D[useStorage Hook Initializes with Default State]
    D --> E[chrome.storage.local.get Fetches Initial Data Asynchronously]
    E --> F[Preact State Hydrated: UI Re-renders with Live Data]
    F --> G{User Interacts with Component UI}
    G -- Mutation / Input --> H[Component Calls State Setter / updateValue]
    H --> I[Optimistic UI State Update]
    I --> J[Asynchronous Write to chrome.storage.local]
    J --> K[Storage Event Broadcasts to Other Tabs / Background]
```

---

## 🧠 WASM & Fallback Parameter Optimization Pipeline

When the user triggers parameter training in `FSRSConfigApp` (`fsrsConfig.tsx`), the extension trains personalized weights using review histories:

```mermaid
flowchart TD
    A[User Triggers Optimization in FSRSConfigApp] --> B[FsrsOptimizer.computeEligibility]
    B --> C{Eligible Reviews >= 10?}
    C -- "No (< 10 Reviews)" --> D[Display Ineligible Warning Banner]
    C -- "Yes (>= 10 Reviews)" --> E[Convert Card historyLog into FSRSBindingItem Array]
    E --> F[Filter Valid Transitions with deltaT > 0]
    G[Cap Training Dataset to 1,000 Cards] <-- F
    G --> H{WebAssembly WASI Worker Available?}
    H -- "Yes (Chrome / Firefox)" --> I[Execute WASM computeParameters in Background Worker]
    H -- "No / Exception (Safari or OOM)" --> J[Fallback: FsrsOptimizerFast Pure JS SGD]
    I --> K[17-Parameter Optimized Weight Vector w0-w16]
    J --> K
    K --> L[Persist fsrsGlobalParams to chrome.storage.local]
    L --> M[Update Active FsrsScheduler Instances Across Contexts]
```

---

## 💾 Streaming Gzip JSONL Backup & Restore Pipelines

AlgoRecall features a streaming, memory-efficient backup architecture implemented in [`features/common/data/backupManager.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/data/backupManager.ts).

### 1. Export Pipeline
```mermaid
flowchart LR
    A[chrome.storage.local] --> B[URL Deduplication & Page Mapping]
    B --> C[Streaming Line Generator: Header, Pages, Cards, Marks, Settings]
    C --> D[32-Bit FNV-1a Checksum Stream Engine]
    D --> E[CompressionStream 'gzip']
    E --> F[Blob Creation & File Download]
```

### 2. Import & Hydration Pipeline
```mermaid
flowchart LR
    A[File Uploaded by User] --> B{Magic Bytes Inspection}
    B -- "Gzip (0x1f 0x8b)" --> C[DecompressionStream 'gzip']
    B -- "Legacy JSON" --> D[BackupManager.importLegacy Parser]
    C --> E[Line-by-Line Stream Parsing & FNV-1a Checksum Validation]
    E -- "Checksum Valid" --> F[Hydrate Cards, Marks, Bookmarks & Reconstruct URLs]
    F --> G[Atomic Storage Write: chrome.storage.local.set]
```

---

## ⌨️ Command Dispatch Pipeline (`ActionService`)

Keyboard shortcut commands (`chrome.commands`) and toolbar action clicks are unified through [`features/common/services/actionService.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/services/actionService.ts):

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser as Browser Commands Engine (chrome.commands)
    participant BG as AlgoRecallBackground (background.ts)
    participant Action as ActionService (actionService.ts)
    participant Tabs as chrome.tabs API
    participant Storage as chrome.storage.local

    User->>Browser: Press Shortcut (e.g. Cmd+Shift+E)
    Browser->>BG: onCommand('open-analytics')
    activate BG
    BG->>Action: executeAction('open-analytics', context)
    activate Action
    Action->>Tabs: chrome.tabs.create({ url: 'features/dashboard/analytics/analytics.html' })
    Action-->>BG: { success: true }
    deactivate Action
    deactivate BG
```

---

## 🔗 Related Documentation
* 📘 [Architecture Overview](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/overview.md)
* 📦 [State Management Architecture](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/state-management.md)
* 🧮 [FSRS Mathematical Foundations](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/fsrs-algorithm.md)
* ⚡ [WASM Optimizer Implementation](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/scheduler-wasm/optimizer-wasm.md)
