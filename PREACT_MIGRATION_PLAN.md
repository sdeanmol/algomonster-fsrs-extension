# Preact Migration Architectural Plan

> **Project:** AlgoRecall FSRS Chrome Extension (Manifest V3)  
> **Role:** Principal Frontend Architect & Migration Lead  
> **Date:** November 2026  
> **Target Framework:** Preact (v10+) with TypeScript  

---

## 1. Executive Summary & Migration Objectives

The goal of this migration is to convert all vanilla TypeScript UI layers of the AlgoRecall extension to **Preact with TypeScript**, eliminating ~60% of imperative DOM manipulation boilerplate while preserving:
- 100% of existing functional behavior, keyboard shortcuts, background sync, and storage operations.
- Full compatibility with Chrome, Firefox, and Safari Manifest V3 specifications.
- Clean separation between reactive UI presentation and framework-independent business/algorithm logic.
- Complete regression coverage across all 69 test suites (1,031 unit tests).

---

## 2. Current Architecture vs. Target Architecture

```
CURRENT ARCHITECTURE (Vanilla TypeScript + Imperative DOM)
┌─────────────────────────────────────────────────────────────┐
│ HTML Entry Points (16 standalone pages)                     │
│ └── Inline HTML + <script src="*.js">                       │
│     └── TS Controllers (e.g., popup.ts, websites.ts)        │
│         ├── getElementById() caches (30-50 elements)        │
│         ├── manual addEventListener() wireups               │
│         ├── innerHTML template strings & createElement()    │
│         └── direct chrome.storage get/set mutations         │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼
TARGET ARCHITECTURE (Preact Components + Unchanged Business Core)
┌─────────────────────────────────────────────────────────────┐
│ Preact UI Layer (Components & Hooks)                        │
│ ├── Reusable Primitives (Toggle, Toast, Modal, StatCard)    │
│ ├── Feature Views (Popup, Analytics, Websites, Editor, etc.)│
│ └── Preact Hooks (useStorage, useTheme, usePomodoro)        │
├─────────────────────────────────────────────────────────────┤
│ Framework-Independent Domain & Infrastructure Layer (Pure TS)│
│ ├── FSRS Scheduler & WASM Optimizer Engine                  │
│ ├── Background Service Worker (Alarms, Commands, Badge)     │
│ ├── Content Script Orchestrator & State Tracking            │
│ ├── ActionService, BackupManager, Markdown parser           │
│ └── Chrome Storage Abstraction & Logger Ring Buffer         │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Scope & Categorization of Modules

Total Audited Files: **68 TypeScript source modules** (excluding `.d.ts`):
- **46 UI Candidates** (Categories A & B: Pages, Components, and UI Controllers) to be converted to Preact `.tsx` components or hooks.
- **22 Framework-Independent Modules** (Categories C & D: Schedulers, Background worker, Content scripts, Domain models, Utilities) preserved as pure TypeScript.

### 3.1 Framework-Independent Modules (Retained as Pure TS)
1. `background/background.ts` (Service worker: alarms, badge, commands)
2. `content/content.ts` (Content orchestrator & platform DOM observer)
3. `content/state.ts` (Content script state store)
4. `content/notifications.ts` (In-page toast manager)
5. `content/utils.ts` (Platform DOM selectors)
6. `features/tracker/scheduler/fsrsScheduler.ts` (FSRS scheduling algorithm)
7. `features/tracker/scheduler/fsrsOptimizer.ts` (WASM weight trainer)
8. `features/tracker/scheduler/fsrsOptimizerFast.ts` (Fast native optimizer)
9. `features/tracker/scheduler/scheduler.ts` (Scheduler contract)
10. `features/common/browserConfig.ts` (Browser metadata & URLs)
11. `features/common/constants.ts` (Constants, defaults, platforms)
12. `features/common/firebase.ts` (Firebase Auth/Firestore wrapper)
13. `features/common/logger.ts` (Logging ring buffer)
14. `features/common/markdown.ts` (Markdown sanitization wrapper)
15. `features/common/services/actionService.ts` (Tab & command dispatcher)
16. `features/common/theme-sync.ts` (FOUC theme bootstrapper)
17. `features/common/data/backupManager.ts` (JSON import/export service)
18. `features/common/utils/cardUtils.ts` (Card calculations & filters)
19. `features/common/utils/uiUtils.ts` (Toast/tab helpers)
20. `features/dashboard/analytics/utils/dataUtils.ts` (Analytics math engine)
21. `types/backup.ts` & `types/domain.ts` (Domain types)

---

## 4. Phase Breakdown & Dependency-Aware Migration Sequence

### Phase 0: Discovery, Baseline & Audit Reconciliation (COMPLETE)
- [x] Inspect repo structure, package configs, entry points.
- [x] Validate `docs/EXTENSION_CODEBASE_AUDIT.md` and `.agent-audit/INVENTORY.json`.
- [x] Build dependency graph of all 68 source files.
- [x] Establish test baseline (69 suites, 1,031 tests passing; `npm run build` passing).
- [x] Create root `inventory.json` with tracking schema.

### Phase 1: Target Architecture & Migration Design (COMPLETE)
- [x] Design Preact component hierarchy, mounting strategy, and hooks.
- [x] Ensure 100% test compatibility with existing Jest suites.
- [x] Formulate batch sequence based on reverse dependency count.

### Phase 2: Testing Infrastructure & Preact Setup (COMPLETE)
- [x] Configure `tsconfig.json` for JSX (`"jsx": "react-jsx"`, `"jsxImportSource": "preact"`).
- [x] Install `preact` in dependencies.
- [x] Configure Webpack with `ts-loader` for `.tsx`, extensions `['.ts', '.tsx', '.js', '.jsx']`, and update `CopyPlugin` ignore rules.
- [x] Configure Jest with `moduleFileExtensions` including `tsx` and ts-jest transform for `.tsx`.
- [x] Verify build and tests pass before touching feature code.

### Phase 3: Shared UI Primitives & Hooks (COMPLETE)
- [x] Create reusable Preact components:
  - `Toggle`: Replaces repetitive switch boilerplate (`features/common/ui/components/Toggle.tsx`).
  - `Toast` / Alert banners: Unified feedback UI across views.
  - `Modal` / `Card`: Standardized container elements.
- [x] Create reusable Preact hooks:
  - `useStorage`: Reactive binding to `chrome.storage.local` (`features/common/ui/hooks/useStorage.ts`).
  - `useTheme`: Reactive theme synchronization (`features/common/theme-sync.ts`).

### Phase 4: Incremental Feature Conversion Batches (COMPLETE)

#### Batch 1: Leaf Management Views (Low Risk, High Isolation) (COMPLETE)
- [x] `features/common/websites/websites.ts` -> Preact Component + Entry (`websites.tsx`)
- [x] `features/common/help/help.ts` -> Preact Component + Entry (`help.tsx`, `helpContent.tsx`)
- [x] `features/common/welcome/welcome.ts` -> Preact Component + Entry (`welcome.tsx`)
- [x] `features/common/utils/tagInput.ts` -> Preact TagInput Component (`tagInput.tsx`)

#### Batch 2: Highlighter Feature Views (COMPLETE)
- [x] `features/highlighter/options/highlightOptions.ts` -> Preact Component + Entry (`highlightOptions.tsx`)
- [x] `features/highlighter/manager/highlights.ts` & `highlights-helpers.ts` -> Preact Component + Entry (`highlights.tsx`)
- [x] `features/highlighter/highlighter.ts` -> Preact Tooltip (`highlighter.tsx`)

#### Batch 3: Card Management & Editor Views (COMPLETE)
- [x] `features/tracker/editor/editor.ts` -> Preact Component + Entry (`editor.tsx`)
- [x] `features/tracker/config/fsrsConfig.ts` -> Preact Component + Entry (`fsrsConfig.tsx`)
- [x] `features/common/data/data.ts` -> Preact Component + Entry (`data.tsx`)

#### Batch 4: Focused Productivity Dashboard Views (COMPLETE)
- [x] `features/dashboard/pomodoro/pomodoro.ts` -> Preact Component + Entry (`pomodoro.tsx`)
- [x] `features/dashboard/heatmap/heatmap.ts` & `heatmap-stats.ts` -> Preact Component + Entry (`heatmap.tsx`, `heatmap-stats.tsx`)
- [x] `features/dashboard/history/history.ts` -> Preact Component + Entry (`history.tsx`)
- [x] `features/dashboard/forecast/forecast.ts` -> Preact Component + Entry (`forecast.tsx`)
- [x] `features/dashboard/studyplan/studyplan.ts` -> Preact Component + Entry (`studyplan.tsx`)
- [x] `features/dashboard/summary/summary.ts` & `summaryGenerator.ts` -> Preact Component + Entry (`summary.tsx`)

#### Batch 5: Main Popup UI & Sub-Components (COMPLETE)
- [x] `features/dashboard/popup/DashboardComponent.ts` -> Preact Component (`DashboardComponent.tsx`)
- [x] `features/dashboard/popup/stats.ts` -> Preact Component (`stats.tsx`)
- [x] `features/dashboard/popup/heatmap.ts` -> Preact Component (`heatmap.tsx`)
- [x] `features/dashboard/popup/rating.ts` -> Preact Component (`rating.tsx`)
- [x] `features/dashboard/popup/search.ts` -> Preact Component (`search.tsx`)
- [x] `features/dashboard/popup/notifications.ts` -> Preact Component (`notifications.tsx`)
- [x] `features/dashboard/popup/popup.ts` (Orchestrator) -> Preact App (`popup.tsx`)

#### Batch 6: Analytics Dashboard & Sub-Modules (COMPLETE)
- [x] Overview (`overview.tsx`, `memoryHealth.tsx`, `learningVelocity.tsx`, `miniForecast.tsx`)
- [x] Memory (`memory.tsx`, `retentionChart.tsx`, `futureMemorySimulation.tsx`, `predictionComparison.tsx`, `confidenceBand.tsx`)
- [x] Performance (`performance.tsx`, `reviewStats.tsx`, `recoveryTracking.tsx`)
- [x] Readiness (`readiness.tsx`)
- [x] Tags (`tags.tsx`, `retentionBarChart.tsx`, `coverageTable.tsx`)
- [x] Insights (`insights.tsx`, `reviewTimeAnalytics.tsx`)
- [x] Analytics Main (`analytics.tsx`)

#### Batch 7: In-Page Floating Tracker Widget (COMPLETE)
- [x] `features/tracker/tracker.ts` -> Mount into Shadow DOM root for zero host-page CSS pollution (`tracker.tsx`)

### Phase 5: Feature-Level Integration & Regression Verification (COMPLETE)
- [x] Full test suite run (`npm test` and build check - 90/90 suites, 1,169 tests passing).
- [x] Verify packaging (`release/chrome/extension-chrome.zip`, Firefox, Safari).
- [x] E2E Playwright verification across browser targets.

### Phase 6: Obsolete Vanilla Cleanup (COMPLETE)
- [x] Remove legacy imperative DOM manipulation helpers.
- [x] Verify no duplicate bundle assets or leaked `.ts`/`.tsx` files in `dist/`.

### Phase 7: Final Sign-Off & Deliverables (COMPLETE)
- [x] Produce `PREACT_MIGRATION_FINAL_REPORT.md`.
- [x] Final audit checklist and architectural documentation overhaul complete.

---

## 5. Risk Assessment & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|:---|:---:|:---:|:---|
| **Jest unit test breakage** due to altered class methods | High | High | Keep controller classes or export compatible bridges that mount Preact components while exposing existing public interfaces. |
| **CopyPlugin bundling raw `.tsx` into `dist/`** | Medium | Critical | Enforce `ignorePatterns` including `**/*.tsx` and `**/*.ts` in `webpack.config.js`. |
| **Shadow DOM CSS isolation conflicts in content script** | Medium | Medium | Mount tracker and highlighter root elements inside Shadow DOM with encapsulated stylesheets. |
| **Cold start latency in popup** | Low | Low | Preact v10 core is only 4 KB gzipped and renders in < 5ms. |

