# System Architecture

## 1. Overview & Architectural Principles

**AlgoRecall** is designed as a **local-first, multi-browser spaced repetition system** built on the Chrome Extension **Manifest V3 (MV3)** platform. Its core architectural goals are:

1. **Zero-Latency Local Operation**: All user data (flashcard representations of algorithm problems, review histories, highlighters, Pomodoro states) is stored in the browser's local sandbox via `chrome.storage.local`. There is no compulsory external authentication or cloud database dependency for core features.
2. **Platform Invisibility**: When browsing target problem pages (e.g., LeetCode, AlgoMonster, Codeforces), content scripts seamlessly inject interactive widgets (floating review tracker, text selection highlighter) without breaking or modifying host page rendering or host SPA routing.
3. **Mathematical Rigor**: Review intervals, difficulty transitions, and stability calculations are driven by the Free Spaced Repetition Scheduler (FSRS v4.5) algorithm rather than heuristic legacy algorithms (like SM-2).
4. **Cross-Browser Portability**: A single shared TypeScript codebase builds simultaneously for Google Chrome (Chromium MV3), Mozilla Firefox (Gecko MV3), and Apple Safari (WebKit MV3) using build-time feature flags.

---

## 2. 3-Tier Extension Tiering

The system decomposes into three fundamental execution contexts:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        TIER 1: CONTENT LAYER                           │
│  (Host Webpage DOM: LeetCode, AlgoMonster, Codeforces, HackerRank)     │
│                                                                        │
│  ┌──────────────────────────┐         ┌─────────────────────────────┐  │
│  │ AlgoRecallOrchestrator   │         │ Highlighter (CSS Highlights)│  │
│  └────────────┬─────────────┘         └──────────────┬──────────────┘  │
│               │                                      │                 │
│               ▼                                      ▼                 │
│  ┌──────────────────────────┐         ┌─────────────────────────────┐  │
│  │ Tracker Floating Widget  │         │ In-Page DOM Notifier Alert  │  │
│  └────────────┬─────────────┘         └──────────────┬──────────────┘  │
└───────────────┼──────────────────────────────────────┼─────────────────┘
                │ chrome.runtime.sendMessage           │
                │ chrome.storage.onChanged             │
┌───────────────▼──────────────────────────────────────▼─────────────────┐
│                       TIER 2: BACKGROUND LAYER                         │
│             (Manifest V3 Service Worker: background.ts)                │
│                                                                        │
│  ┌──────────────────────────┐         ┌─────────────────────────────┐  │
│  │ Event & Message Router   │         │ Alarm Scheduler             │  │
│  └────────────┬─────────────┘         └──────────────┬──────────────┘  │
│               │                                      │                 │
│               ▼                                      ▼                 │
│  ┌──────────────────────────┐         ┌─────────────────────────────┐  │
│  │ Pomodoro Background Tick │         │ OS Desktop Notification API │  │
│  └────────────┬─────────────┘         └──────────────┬──────────────┘  │
└───────────────┼──────────────────────────────────────┼─────────────────┘
                │ Direct Read/Write                    │
                ▼                                      ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   TIER 3: PERSISTENCE & SCHEDULING                     │
│                                                                        │
│  ┌──────────────────────────┐         ┌─────────────────────────────┐  │
│  │ chrome.storage.local     │         │ FSRS Scheduler & WASM Engine│  │
│  └──────────────────────────┘         └─────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Tier 1: Injected Content Layer
* **Files**: [`content/content.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/content.ts), [`content/notifications.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/notifications.ts), [`features/tracker/tracker.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/tracker.ts), [`features/highlighter/highlighter.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/highlighter/highlighter.ts).
* **Execution Boundary**: Injected into the DOM of tabs matching whitelisted host permissions.
* **Responsibilities**:
  1. Inspect the URL and DOM to detect the active coding problem title and slug.
  2. Inject and manage the floating `#algo-fsrs-tracker` widget and launcher button.
  3. Listen to pointer and mouse selections to render text highlight swatches and persist ranges via the CSS Custom Highlights API.
  4. Intercept user keyboard shortcuts (`1-4`, `Space`, `Enter`) during active in-page review sessions.
  5. Listen to browser history changes for client-side single page app (SPA) navigations.

### Tier 2: Background Service Worker Layer
* **Files**: [`background/background.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts).
* **Execution Boundary**: Runs in an ephemeral background service worker context without DOM access.
* **Responsibilities**:
  1. Manages background alarms via `chrome.alarms` for review checks, daily streak nudges, and weekly summary digests.
  2. Dispatches system OS notifications via `chrome.notifications` (with in-page fallback when the active tab is whitelisted).
  3. Maintains the Pomodoro timer countdown loop (`setInterval` while awake, backed by a persistent `chrome.alarms` wake-up target).
  4. Dynamically updates the extension action toolbar badge (showing due card counts or remaining Pomodoro minutes).
  5. Routes incoming keyboard shortcuts (`chrome.commands`) to appropriate actions via [`ActionService`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/services/actionService.ts).

### Tier 3: Isolated Extension UI & Standalone Views
* **Files**: [`features/dashboard/popup/popup.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/popup/popup.ts), [`features/dashboard/analytics/analytics.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/analytics/analytics.ts), [`features/dashboard/studyplan/studyplan.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/studyplan/studyplan.ts), [`features/common/data/data.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/data/data.ts), etc.
* **Execution Boundary**: Dedicated browser extension tabs or popup window running under `chrome-extension://<id>/...`.
* **Responsibilities**:
  1. **Popup Window** (`popup.html`): Quick dashboard summarizing due cards, mini-heatmap, settings toggles, quick search, and quick review ratings.
  2. **Analytics Dashboard SPA** (`analytics.html`): 7-tab deep analytics application rendering SVG retention curves, learning velocity sparklines, future memory decay simulations, and exam readiness predictions.
  3. **Exam Mode** (`studyplan.html`): Redistribution controller calculating even daily review quotas leading up to an exam deadline.
  4. **Data Management** (`data.html`): Searchable, filterable table for bulk operations, inline note editing, and NDJSON/Anki data exports.

---

## 3. Core Architectural Patterns

### 3.1 Local-First Persistence Pattern
Every mutation (creating a card, submitting a review rating, saving a highlight, starting a Pomodoro session) commits directly to `chrome.storage.local`. The persistence layer emits `chrome.storage.onChanged` events, allowing any open extension views (content scripts, popup, background service worker) to reactively synchronize their local state slices without manual inter-process polling.

### 3.2 Algorithmic Debounce with Pre-State Snapshot
Spaced repetition engines are vulnerable to rapid button double-clicks or key mashing, which would otherwise corrupt card stability and inflate interval calculations. AlgoRecall implements a **dual-case algorithmic debounce window (< 1 minute)** in [`FsrsScheduler`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/scheduler/fsrsScheduler.ts):
- **Case 1 (Duplicate Rating)**: Suppresses calculation and accumulates active review duration into the existing log.
- **Case 2 (Rating Correction)**: Restores the card's exact mathematical state from a stored `preState` snapshot on the previous log entry and recalculates intervals cleanly under the new rating.

### 3.3 Non-Destructive Schedule Redistribution (Exam Mode)
Exam Countdown Mode allows students to compress review intervals to guarantee 100% coverage prior to a test date. Instead of permanently overwriting computed FSRS intervals, each card retains its original computed `due` timestamp in `previousDue` and `historyLog`, enabling full non-destructive restoration when Exam Mode is deactivated.

### 3.4 Cross-Context Command Centralization
To decouple user actions from specific UI controls, [`ActionService`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/common/services/actionService.ts) acts as a centralized command registry. Both background keyboard shortcuts (`chrome.commands`) and popup button clicks dispatch to identical action handlers (e.g. `'check-due-reviews'`, `'toggle-theme'`, `'export-anki'`).
