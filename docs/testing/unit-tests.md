# Unit & Component Test Suite Breakdown

This document details the test suites under `tests/unit/`, mapping test modules to their target source files, key coverage scenarios, and assertions across both TypeScript service modules and **Preact component suites** (`.test.tsx`).

---

## 🔬 Unit & Component Test Suite Mapping (89 Suites)

### 1. Preact Component Suites (`.test.tsx`)

| Test Suite File | Target Preact Component(s) | Key Coverage Scenarios |
| :--- | :--- | :--- |
| `Toggle.test.tsx` | `<Toggle />` | Label rendering, change event invocation, disabled accessibility attributes |
| `useStorage.test.ts` | `useStorage<T>` | Initial storage read, optimistic local update, cross-tab sync via `storage.onChanged` |
| `TagChip.test.tsx` | `<TagChip />` | Chip text rendering, remove button click delegation, stopPropagation |
| `WhitelistedSitesList.test.tsx` | `<WhitelistedSitesList />` | Domain list mapping, default badge protection, delete button delegation |
| `StepIndicators.test.tsx` | `<StepIndicators />` | Wizard dot step indicators, active aria attributes, click step selection |
| `HelpTabBar.test.tsx` | `<HelpTabBar />` | Accessible role="tablist", active tab styling, tab selection callback |
| `DataComponents.test.tsx` | `<CardsTable />`, `<BulkActionsBar />`, `<CardsTableRow />` | Table rendering, select-all toggling, bulk delete/retag/reschedule bar |
| `PopupComponents.test.tsx` | `<PopupHeader />`, `<PopupStatsOverview />`, `<PopupDailyGoalRing />` | Header brand, 3-stat KPI summary, SVG daily review goal progress ring |
| `ForecastComponents.test.tsx` | `<ForecastMetricsHeader />`, `<ForecastCalendar />`, `<ForecastChart />` | 30-day forecast tiles, calendar grid day cells, SVG workload bars |
| `HeatmapComponents.test.tsx` | `<HeatmapFilterBar />`, `<HeatmapGrid />`, `<StreakStatCard />` | 365-day matrix cells, intensity thresholds (0–4), streak stat cards |
| `HistoryComponents.test.tsx` | `<HistoryViewToggle />`, `<HistoryBreadcrumb />`, `<HistoryBarChart />` | Year/month/day view hierarchy toggles, timeline drill-downs |
| `PomodoroComponents.test.tsx` | `<PomodoroTimerRing />`, `<PomodoroPhaseTabs />`, `<PomodoroControls />` | SVG timer circle circumference, phase switching (Focus/Break), start/reset |
| `StudyPlanComponents.test.tsx`| `<StudyPlanCountdownRing />`, `<StudyPlanSetupPanel />` | Circular deadline dial, quota redistribution preview table |
| `SummaryComponents.test.tsx` | `<SummaryPeriodTabs />`, `<SummaryKpiGrid />`, `<SummaryInsightsList />` | Weekly vs monthly tabs, retention KPI cards, smart recommendation pills |
| `HighlighterTooltip.test.tsx` | `<HighlighterTooltipView />`, `<HighlighterSwatches />` | Anchored tooltip positioning, palette swatches, custom color picker |
| `HighlightsComponents.test.tsx`| `<ColorFilterBubbles />`, `<HighlightCardView />`, `<HighlightsListView />` | Color bubble toggles, highlight card details, clipboard copy button |
| `PaletteComponents.test.tsx` | `<PaletteEditorSlots />`, `<PalettesList />` | Dynamic color slot additions/deletions, active palette card selection |
| `TrackerComponents.test.tsx` | `<TrackerRatingBar />`, `<TrackerFloatingLauncher />` | Rating buttons (`Again`, `Hard`, `Good`, `Easy`), due badge text |
| `EditorComponents.test.tsx` | `<EditorHeader />`, `<ComplexityInputs />`, `<MarkdownPreview />` | Big-O time/space complexity inputs, sanitized markdown preview |
| `FSRSConfigComponents.test.tsx`| `<WeightInputCard />`, `<WeightsInputsGrid />`, `<PresetChips />` | 17-parameter weights inputs, retention sliders, preset chips |

---

### 2. Core Scheduling & Mathematical Engine Suites

| Test Suite File | Target Source Module | Key Coverage Scenarios |
| :--- | :--- | :--- |
| `fsrsScheduler.test.ts` | `FsrsScheduler` | Card creation, rating transitions, algorithmic debouncing (<1m), preState snapshots |
| `fsrsOptimizer.test.ts` | `FsrsOptimizer` | WASM computeEligibility, training set conversion, dataset caps (1000 cards) |
| `fsrsOptimizerFast.test.ts`| `FsrsOptimizerFast` | Heuristic SGD optimization fallback, gradient updates, empirical retention |
| `fsrsPerformance.test.ts` | `FsrsScheduler` | High-frequency rating benchmarks, memory leak assertions |
| `dataUtils.test.ts` | `DataUtils` | Mathematical models: summary KPIs, streak calculations, true retention, tag stats |
| `summaryGenerator.test.ts` | `summaryGenerator.ts` | Automated weekly digest text generation, trend analysis, upcoming projections |

---

### 3. Shared Utilities, Background & Content Script Suites

| Test Suite File | Target Source Module | Key Coverage Scenarios |
| :--- | :--- | :--- |
| `backupManager.test.ts` | `BackupManager` | Streaming Gzip JSONL export, 32-bit FNV-1a checksum validation, schema migration |
| `markdown.test.ts` | `Markdown` | marked.js parsing, GitHub Flavored Markdown, DOMPurify XSS script stripping |
| `logger.test.ts` | `Logger` | Level filtering, in-memory ring buffer, DevMode synchronization |
| `themeSync.test.ts` | `ThemeSync` | FOUC prevention class injection, cross-tab theme synchronization |
| `backgroundServiceWorker.test.ts`| `AlgoRecallBackground` | Alarm listeners, quiet hours logic, push notification scheduling, Pomodoro ticker |
| `commands.test.ts` | `ActionService` | Keyboard shortcut command dispatcher mapping to extension actions |
| `contentOrchestrator.test.ts` | `AlgoRecallOrchestrator` | Whitelisted domain detection, MutationObserver debouncing, SPA history updates |
| `contentUtils.test.ts` | `Utils` | Problem title extraction, tag inference, DOM XPath serialization |
| `notifications.test.ts` | `Notifier` | In-page toast injection, review snooze actions, auto-dismiss timers |
| `browserConfig.test.ts` | `BROWSER_CONFIG` | Feature flag gating (`supportsNotifications`, `supportsAlarms`, `supportsDownloads`) |

---

## 🧮 Critical Assertion Scenarios

### 1. Algorithmic Debouncing & Rating Rollbacks (`fsrsScheduler.test.ts`)
* Asserts that submitting multiple ratings within 60 seconds suppresses redundant FSRS calculations.
* Asserts that changing a rating within 60 seconds reverts parameters to `preState` and recalculates from clean baseline state.

### 2. Streaming Backup Integrity (`backupManager.test.ts`)
* Asserts that corrupting a single byte in a `.jsonl.gz` stream triggers `Integrity check failed: Checksum mismatch`.
* Verifies that `isValidBackupRecord` rejects malformed line schemas.

### 3. Store Brand Isolation (`check-artifact-isolation.js`)
* Audits production build directories to verify zero browser brand cross-contamination (Chrome Web Store, Firefox Add-ons, Apple App Store).

---

## ✍️ Authoring Guide: Mocking Chrome APIs in Jest

Preact component and service tests run in Node.js via `jsdom`. All `chrome.*` APIs are mocked through `tests/mocks/chromeMock.js`.

```typescript
// Clear mock storage before each test
beforeEach(() => {
    global.mockStorage = {};
    jest.clearAllMocks();
});

// Seed mock state
global.mockStorage['fsrsCards'] = mockCardFixture;

// Assert chrome API interaction
expect(chrome.storage.local.set).toHaveBeenCalledWith(
    expect.objectContaining({ fsrsCards: expect.any(Array) })
);
```

---

## 🔗 Related Documentation
* 🧪 [Test Suite Overview](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/testing/test-suite-overview.md)
* 🎭 [E2E & Integration Tests](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/testing/e2e-integration.md)
* 📘 [Architecture Overview](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/overview.md)
