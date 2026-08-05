# Unit Test Breakdown & Coverage Analysis

This document details the individual unit test suites under `tests/unit/`, mapping each test file to its target source module, key test cases, and assertion logic. It also outlines the conventions for writing robust Jest tests within the extension environment.

---

## 🔬 Unit Test Mapping

| Test Suite File | Target Source Module | Key Coverage Areas |
| :--- | :--- | :--- |
| **`fsrsScheduler.test.js`** | `FsrsScheduler` | Card creation, rating transitions, algorithmic debouncing, preState snapshots |
| **`fsrsOptimizer.test.js`** | `FsrsOptimizer` | WASM computeEligibility, training set conversion, card caps |
| **`fsrsOptimizerFast.test.js`** | `FsrsOptimizerFast` | Fallback SGD training, empirical retention calculations, progress callbacks |
| **`dataUtils.test.js`** | `DataUtils` | Summary stats, streak calculations, retention, tag stats, review time insights |
| **`backupManager.test.js`** | `BackupManager` | Gzip JSONL export stream, FNV-1a checksum, V2 import validation, legacy import |
| **`summaryGenerator.test.js`** | `summaryGenerator.ts` | Weekly summary text generation, trend calculation, upcoming card projections |
| **`readiness.test.js`** | `readiness.ts` | Exam readiness predictions, risk classifications (Ready, Moderate, At Risk) |
| **`futureMemorySimulation.test.js`** | `futureMemorySimulation.ts` | Memory decay curve calculations across 0–180 days |
| **`overview.test.js`** | `overview.ts` | Learning velocity sparklines, 7-day vs 14-day trend comparisons |
| **`tags.test.js`** | `tags.ts` | Tag retention bar chart aggregations and coverage tables |
| **`tagInput.test.js`** | `tagInput.ts` | Tag input parsing, comma splitting, duplicate tag removal |
| **`highlighter.test.js`** | `Highlighter` | Highlight mark creation, tooltip positioning, note/category saving |
| **`websites.test.js`** | `websites.ts` | Domain whitelisting validation, default domain additions, removal |
| **`logger.test.js`** | `Logger` | Console logging stubs, timing logs (`Logger.time`), exception suppression |

---

## 🧮 Critical Assertion Highlights

### 1. Algorithmic Debouncing (`fsrsScheduler.test.js`)
* Verifies that submitting duplicate ratings within 60 seconds suppresses FSRS calculation.
* Asserts that changing a rating within 60 seconds successfully reverts card metrics to `preState` and recalculates from base state.

### 2. Checksum Validation (`backupManager.test.js`)
* Asserts that modifying a single byte in a JSONL backup stream triggers `Integrity check failed: Checksum mismatch`.
* Verifies that `isValidBackupRecord` rejects unknown line record types.

---

## ✍️ Authoring Guide: Mocking Chrome APIs

When writing new Jest tests, keep in mind that the environment is Node.js (via `jsdom`), not a real browser. AlgoRecall relies on a global mock provided by `tests/mocks/chromeMock.js`.

### Using the `global.mockStorage`
The `chrome.storage.local` API is stubbed to read/write from a simple Javascript dictionary named `global.mockStorage`.

* **Before Each Test**: It is recommended to clear the storage state to prevent test leakage:
  ```javascript
  beforeEach(() => {
    global.mockStorage = {};
    jest.clearAllMocks();
  });
  ```
* **Injecting State**: You can pre-populate storage for a test directly:
  ```javascript
  global.mockStorage['fsrsCards'] = mockCardFixture;
  ```
* **Verifying Calls**: The `chrome.*` methods are Jest spy functions, allowing you to assert calls:
  ```javascript
  expect(chrome.storage.local.set).toHaveBeenCalled();
  expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'UPDATE_BADGE' });
  ```

---

## 🔗 Related Documentation
* 🧪 [Test Suite Overview](./test-suite-overview.md)
* 🎭 [E2E & Integration Specs](./e2e-integration.md)
* 🧮 [FSRS Algorithm Theory](../scheduler-wasm/fsrs-algorithm.md)
