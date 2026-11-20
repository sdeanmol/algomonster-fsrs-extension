# Testing Architecture & Verification Suites

## 1. Testing Pyramid Overview

AlgoRecall maintains a rigorous, multi-tiered testing suite covering unit math, integration flows, and end-to-end browser execution:

```
                  ┌──────────────────────┐
                  │    Playwright E2E    │  13 Spec Files
                  │  (Browser Loading)   │  Chrome / Firefox / Safari
                  ├──────────────────────┤
                  │  Integration Tests   │  tracker.test.js
                  │ (Full Review Cycle)  │  multiCard.test.js
                  ├──────────────────────┤
                  │   Jest Unit Tests    │  71 Test Suites
                  │  (FSRS Math & DOM)   │  1,057 Passing Tests
                  └──────────────────────┘
```

---

## 2. Unit & Integration Test Architecture

### 2.1 Framework Configuration
- **Test Runner**: Jest (`ts-jest` for TypeScript modules, `babel-jest` for ES modules).
- **DOM Environment**: `jest-environment-jsdom` simulating browser window, document, and DOM events.
- **Mock Environment**: [`tests/mocks/chromeMock.js`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/tests/mocks/chromeMock.js) provides an in-memory mock of the `chrome.*` extension API:
  - `chrome.storage.local`: Complete in-memory key-value store with `get`, `set`, `remove`, `clear`, and `onChanged` event dispatching.
  - `chrome.runtime`: Message listeners, `lastError` tracking, and `getURL()`.
  - `chrome.alarms`: Alarm registration, clearing, and triggering mocks.
  - `chrome.notifications`: Notification creation and dismissal mocks.
  - `chrome.action`: Badge text and color mocking.
  - `chrome.commands`: Keyboard shortcut event dispatching.

### 2.2 Test Suite Breakdown (1,057 Tests across 71 Suites)

| Test Module Category | Test Files | Tested Functionality |
|---|---|---|
| **Spaced Repetition & Math** | `fsrsScheduler.test.ts`, `fsrsOptimizer.test.ts`, `fsrsOptimizerFast.test.ts`, `fsrsPerformance.test.ts` | Interval calculation, 1-minute algorithmic debouncing, preState rollback, WASM worker execution, heuristic SGD convergence |
| **Analytics & Statistics** | `analytics.test.ts`, `dataUtils.test.ts`, `readiness.test.ts`, `retentionChart.test.ts`, `memoryHealth.test.ts`, etc. | True retention percentages, learning velocity trends, exam readiness forecast formulas, confidence band rendering |
| **Tracker & In-Page Widget** | `tracker.test.ts`, `editor.test.ts`, `multiCard.test.ts`, `tagInput.test.ts` | Widget DOM injection, tabstrip switching, keyboard shortcuts (1-4), markdown sanitization |
| **Highlighter Subsystem** | `highlighter.test.ts`, `highlights.test.ts`, `highlightOptions.test.ts`, `highlightsHelpers.test.ts` | Text selection detection, DOMMeta range restoration, color picker focus preservation |
| **Background & Alarms** | `backgroundServiceWorker.test.ts`, `commands.test.ts`, `manifestCommands.test.ts` | Alarm triggers, quiet hours evaluation, tag-grouped notifications, badge updates, 24 keyboard commands |
| **Data & Backup Engine** | `backupManager.test.ts`, `dataDashboard.test.ts` | Streaming NDJSON parsing, Gzip compression/decompression, 32-bit FNV-1a checksums, legacy JSON migrations |
| **Pomodoro Timer** | `pomodoro.test.ts` | Focus/break state machine, background ticker sync, badge updates, daily productivity stats |

---

## 3. Playwright End-to-End (E2E) Testing

Playwright tests in [`tests/e2e/`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/tests/e2e/) verify extension loading and UI behavior in real browser instances:
- Tests extension manifest parsing and popup mounting.
- Verifies in-page content script injection on simulated LeetCode/AlgoMonster pages.
- Tests keyboard shortcuts and notification toasts.

### Running Test Commands
```bash
# Run all 71 unit and integration test suites
npm test

# Run unit tests only
npm run test:unit

# Run integration tests only
npm run test:integration

# Run tests with coverage reporting
npm run test:coverage

# Run Playwright E2E tests against built extensions
npm run test:chrome
npm run test:firefox
npm run test:safari
```
