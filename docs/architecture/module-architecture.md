# Module Architecture & Dependency Analysis

## 1. High-Level Module Decomposition

AlgoRecall is divided into five core functional module clusters:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MODULE ARCHITECTURE                             │
│                                                                        │
│   ┌─────────────────────┐               ┌────────────────────────┐     │
│   │   background/       │               │        content/        │     │
│   │   Service Worker    │               │  Injected Orchestrator │     │
│   └──────────┬──────────┘               └───────────┬────────────┘     │
│              │                                      │                  │
│              ├───────────────────┐                  │                  │
│              ▼                   ▼                  ▼                  │
│   ┌─────────────────────┐    ┌───────────────────────────────────┐     │
│   │  features/common/   │◄───┤        features/tracker/          │     │
│   │  Services & Utils   │    │  In-Page Tracker & FSRS Scheduler │     │
│   └──────────▲──────────┘    └──────────────────┬────────────────┘     │
│              │                                  │                      │
│              │               ┌──────────────────┘                      │
│              ▼               ▼                                         │
│   ┌───────────────────────────────────┐   ┌──────────────────────────┐ │
│   │       features/dashboard/         │   │  features/highlighter/   │ │
│   │  Popup, Analytics, Heatmap, Pom.  │   │  CSS Custom Highlights   │ │
│   └───────────────────────────────────┘   └──────────────────────────┘ │
└────────────────────────────────────────────────────────────────────────┘
```

1. **`background/`**: The Manifest V3 Background Service Worker orchestrator ([`background/background.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts)).
2. **`content/`**: In-page orchestrator, state wrapper, DOM utilities, and in-page alert banner ([`content/content.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/content.ts), [`content/state.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/state.ts), [`content/utils.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/utils.ts), [`content/notifications.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/content/notifications.ts)).
3. **`features/tracker/`**: Core Spaced Repetition engine and in-page UI:
   - `tracker.ts`: Floating in-page problem tracker widget.
   - `scheduler/fsrsScheduler.ts`: Concrete FSRS v4.5 scheduling engine.
   - `scheduler/fsrsOptimizer.ts`: WebAssembly WASI weight optimizer.
   - `scheduler/fsrsOptimizerFast.ts`: Pure JS SGD fallback optimizer.
   - `editor/editor.ts`: Fullscreen markdown problem card editor.
   - `config/fsrsConfig.ts`: FSRS 17-weight configuration manager.
4. **`features/dashboard/`**: Extension views:
   - `popup/popup.ts`: Main extension popup window.
   - `analytics/analytics.ts`: 7-tab statistical SPA dashboard.
   - `studyplan/studyplan.ts`: Exam Countdown Mode controller.
   - `pomodoro/pomodoro.ts`: Pomodoro timer UI controller.
   - `heatmap/heatmap.ts`: Full-page contribution heatmap.
   - `forecast/forecast.ts`: 30-day review workload forecast.
   - `history/history.ts`: Historical review logs viewer.
   - `summary/summary.ts`: Weekly/monthly digest summary.
5. **`features/highlighter/`**:
   - `highlighter.ts`: In-page text selection and CSS Custom Highlights manager.
   - `manager/highlights.ts`: Highlights management dashboard.
   - `options/highlightOptions.ts`: Color palette and symbol configuration.
6. **`features/common/`**:
   - `constants.ts`: Domain defaults and time constants.
   - `browserConfig.ts`: Compile-time browser feature flag injector.
   - `services/actionService.ts`: Universal command dispatcher.
   - `data/backupManager.ts`: Streaming Gzip NDJSON backup engine.
   - `utils/cardUtils.ts`: Pure helper functions for card IDs and URL normalization.
   - `utils/uiUtils.ts`: DOM helper routines and error handlers.
   - `markdown.ts`: DOMPurify markdown parser.

---

## 2. Module Coupling & Dependency Matrix

| Module | Depends On | Depended Upon By | Responsibility | Coupling Assessment |
|---|---|---|---|---|
| **`types/domain`** | `ts-fsrs` | All modules | Core entity interfaces & schemas | Loose (Type definitions only) |
| **`features/common/constants`** | `types/domain` | All modules | Numerical constants, defaults, routes | Loose (Immutable constants) |
| **`features/common/logger`** | None | All modules | Diagnostic logging and perf timing | Loose (Pure utility) |
| **`features/tracker/scheduler`** | `ts-fsrs`, `types/domain`, `constants`, `logger` | `tracker`, `dataUtils`, `fsrsConfig`, `background` | Mathematical calculation of intervals & retention | Healthy (Encapsulated engine) |
| **`features/common/services/actionService`** | `types/domain`, `browserConfig`, `constants`, `backupManager` | `background`, `popup`, `settings` | Command execution & routing | Moderate (Central coordinator) |
| **`features/common/data/backupManager`** | `types/backup`, `types/domain`, `constants`, `cardUtils` | `actionService`, `dataDashboard`, `settings` | Streaming NDJSON compression & parsing | Moderate (Self-contained) |
| **`features/tracker/tracker`** | `cardUtils`, `tagInput`, `fsrsScheduler`, `markdown`, `logger` | `content` | In-page DOM widget & hotkey handler | High (DOM-coupled) |
| **`features/dashboard/popup`** | `actionService`, `browserConfig`, `logger`, `uiUtils`, 5 sub-components | Chrome Extension Action | Popup UI coordinator | High (DOM-heavy orchestrator) |
| **`features/dashboard/analytics`** | `dataUtils`, 7 sub-tabs, `AbstractScheduler` | Standalone tab | Full-tab analytics router | Moderate (Clean sub-tab contract) |

---

## 3. Circular Dependencies & Boundary Analysis

### Verification of Circular Dependencies
A static analysis of import graphs confirms **no runtime circular dependencies** exist between major modules:
- Leaf modules (`types/`, `common/constants`, `common/logger`, `common/utils/cardUtils`) have zero inward domain dependencies.
- `features/common/services/actionService.ts` coordinates high-level actions without being imported by lower-level engines (`fsrsScheduler.ts` has no dependency on `ActionService`).
- Content script sub-components (`Tracker`, `Highlighter`) communicate via `content/state.ts` and `window.AlgoRecall` global interfaces to prevent direct circular references between the tracker and highlighter.

### Code Sharing Across Bundles
Because AlgoRecall compiles 21 separate Webpack entry points, shared modules (`cardUtils.ts`, `logger.ts`, `constants.ts`) are statically linked into each entry point's emitted bundle. This ensures complete script isolation across tabs without runtime dynamic chunk-loading errors in content script sandboxes.
