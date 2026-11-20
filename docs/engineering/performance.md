# Performance Profile & Memory Footprint Analysis

## 1. Performance Profile Overview

As an extension that injects code into high-traffic developer coding platforms (LeetCode, AlgoMonster, Codeforces), AlgoRecall must maintain **zero detectable main-thread lag**, minimal memory overhead, and instantaneous UI response times.

---

## 2. Bundle Size & Distribution Breakdown

### 2.1 Unpacked & Packaged Sizes (`dist/chrome/`)
- **Unpacked Folder Size**: ~9.0 MB.
- **Packaged Release ZIP**: ~2.4 MB (`release/chrome/extension-chrome.zip`).

### 2.2 Entry Point Bundle Distribution
- **Injected Content Script (`content.js` + `fsrsScheduler.bundle.js` + `marked.min.js`)**: ~180 KB combined.
  - Keeps content script footprint lightweight to ensure zero page-load latency on host coding sites.
- **Background Service Worker (`background.js`)**: ~95 KB.
- **WebAssembly Optimizer Binary (`fsrs-binding.wasm32-wasi.wasm`)**: ~1.4 MB.
  - Only fetched when the user explicitly triggers weight optimization in `fsrsConfig.html`.
- **Standalone UI Pages (Analytics, Data Dashboard, Pomodoro)**: ~80 KB to ~220 KB each.

---

## 3. Runtime Heuristics & Debouncing Mechanisms

### 3.1 UI Rating Debounce (`RATING_UI_DEBOUNCE_MS`)
- **Threshold**: 400 milliseconds.
- **Implementation**: In [`features/tracker/tracker.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/tracker.ts), button clicks set `isRatingDebounced = true` for 400ms, preventing duplicate event dispatches from accidental double-clicks.

### 3.2 Algorithmic Debounce Window (`ALGORITHMIC_DEBOUNCE_WINDOW_MS`)
- **Threshold**: 60,000 milliseconds (1 minute).
- **Implementation**: In [`features/tracker/scheduler/fsrsScheduler.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/tracker/scheduler/fsrsScheduler.ts), any repeat review of the same card within 60 seconds is intercepted:
  - If rating is identical $\to$ Calculation suppressed, duration accumulated.
  - If rating is changed $\to$ Reverts to `preState` snapshot, cleanly recalculating next due date without corrupting stability.

### 3.3 Background Alarm Frequency Throttling
- **Threshold**: Configurable (default 60 minutes).
- **Implementation**: `background.ts` stores `lastNotificationTime`. When `checkDueCards()` runs, it verifies that at least `(interval - 1)` minutes have elapsed, eliminating duplicate notifications caused by service worker wake-up timing jitter.

### 3.4 Live Search Debounce (`SEARCH_DEBOUNCE_MS`)
- **Threshold**: 150 milliseconds.
- **Implementation**: Quick search input in `features/dashboard/popup/search.ts` debounces keystrokes to ensure smooth 60fps typing without DOM stutter.

---

## 4. WebAssembly Execution Benchmarks

The `@open-spaced-repetition/binding` WebAssembly optimizer was evaluated against the pure JavaScript SGD fallback:

| Engine | Training Dataset Size | Execution Context | Training Epochs | Execution Duration | Memory Peak |
|---|---|---|---|---|---|
| **WASM / WASI Worker** (`fsrsOptimizer.ts`) | 1,000 reviews | Web Worker | 50 epochs | ~320 ms | ~18 MB |
| **WASM / WASI Worker** (`fsrsOptimizer.ts`) | 2,500 reviews (capped) | Web Worker | 50 epochs | ~780 ms | ~24 MB |
| **Pure JS Fast SGD** (`fsrsOptimizerFast.ts`) | 1,000 reviews | Main Thread | 50 epochs | ~45 ms | ~4 MB |

### Main Thread Yielding
Because `FsrsOptimizer` executes inside a dedicated Web Worker (`wasi-worker-browser.mjs`), the browser extension UI thread remains completely unblocked, allowing smooth progress bar updates and modal interactivity.
