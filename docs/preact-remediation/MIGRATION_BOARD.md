# MIGRATION BOARD — Preact Remediation Kanban & Item Tracking

## Executive Summary

This Kanban board tracks the end-to-end migration of all **51 source files** containing imperative DOM operations across the AlgoRecall browser extension on the `preact` branch. It provides a real-time status tracker for eliminating **1,426 imperative DOM operations** across extension-owned interfaces, establishing pure declarative Preact functional components, preserving **62 technically justified host boundary operations** and **7 technically justified infrastructure utilities**, and validating all quality gates.

---

## High-Level Progress Dashboard

| Metric | Target Value | Current Baseline | Status |
| :--- | :---: | :---: | :---: |
| **Total Source Files Audited** | 73 | 73 | ✅ Audited |
| **Files Requiring Preact Remediation** | 45 | 45 | 📋 Backlog Assigned |
| **Files with Justified Host/Utility DOM** | 8 | 8 | 🛡️ Boundary Verified |
| **Total Files Containing DOM Operations** | 51 | 51 | 📋 Itemized (100%) |
| **Imperative DOM Operations in Extension-Owned UI** | **0** | **1,426** | ⏳ Remediation Pending |
| **Technically Justified Host Boundary Operations** | ≤ 62 | 62 | ⚠️ Boundary 2 Retained |
| **Technically Justified Infrastructure Utilities** | ≤ 7 | 7 | ✅ Boundary 3 Retained |
| **Total DOM Operations Across All Categories** | **≤ 69** | **1,495** | 📋 100% Reconciled |
| **Manually Maintained DOM Element Caches** | **0** | **6 (65 fields)** | ⏳ Elimination Pending |
| **TypeScript Type Checking Errors** | **0** | **0** | ✅ Clean (Pass) |
| **Unit & Integration Test Suites Passing** | **92 / 92** | **92 / 92 (1,238 tests)** | ✅ Clean (Pass) |
| **Multi-Browser Webpack Builds** | **3 / 3** | **3 / 3 (Chrome, FF, Safari)** | ✅ Clean (Pass) |
| **Browser Target Artifact Isolation** | **37 / 37** | **37 / 37** | ✅ Clean (Pass) |

---

## Kanban Board Overview

```
┌──────────────────────┬──────────────────────┬──────────────────────┬──────────────────────┐
│  BATCH A: COMMON &   │  BATCH B: TRACKER &  │ BATCH C: DASHBOARD & │  BATCH D: OVERLAYS & │
│  PRODUCTIVITY (14)   │      CONFIG (2)      │    ANALYTICS (24)    │    HIGHLIGHTER (7)   │
├──────────────────────┼──────────────────────┼──────────────────────┼──────────────────────┤
│ • settings.tsx (85)  │ • fsrsConfig.tsx(104)│ • popup.tsx (96)     │ • tracker.tsx (152)  │
│ • data.tsx (118)     │ • editor.tsx (57)    │ • stats.tsx (60)     │ • highlighter (42)   │
│ • tagInput.tsx (20)  │                      │ • notif.tsx (62)     │ • highlightOptions(45│
│ • uiUtils.ts (2)     │                      │ • rating.tsx (35)    │ • highlights.tsx (29)│
│ • help.tsx (39)      │                      │ • search.tsx (19)    │ • helpers.ts (6)     │
│ • welcome.tsx (48)   │                      │ • heatmap.tsx (12)   │ • content/notif. (22)│
│ • websites.tsx (14)  │                      │ • analytics.tsx (39) │ • content/content(32)│
│ • pomodoro.tsx (68)  │                      │ • 17 analytics tabs  │                      │
│ • studyplan.tsx (55) │                      │   (86 sub-tab ops)   │ ════════════════════ │
│ • history.tsx (36)   │                      │                      │   UTILITIES (4)      │
│ • forecast.tsx (21)  │                      │                      │ • backupManager (9)  │
│ • summary.tsx (41)   │                      │                      │ • actionService (3)  │
│ • heatmap.tsx (29)   │                      │                      │ • theme-sync.ts (3)  │
│ • heatmap-stats (1)  │                      │                      │ • content/utils.ts(5)│
└──────────────────────┴──────────────────────┴──────────────────────┴──────────────────────┘
```

---

## Master File Migration Inventory & Status Matrix

### Batch A: Common Infrastructure & Standalone Productivity Pages (14 Files, 577 DOM Operations)

| File Path | Subsystem | DOM Ops | Caches | Boundary Classification | Target Declarative Component | Test File | Status |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `features/common/settings/settings.tsx` | Settings Hub | 85 | `this.dom` (32) | Boundary 1 (Extension UI) | `<SettingsApp />` with `useSettings()` hook | `tests/unit/features/common/settings/settings.test.ts` | 📋 Ready |
| `features/common/data/data.tsx` | Data Dashboard | 118 | — | Boundary 1 (Extension UI) | `<DataApp />` with `useStorage` | `tests/unit/features/common/data/dataDashboard.test.ts` | 📋 Ready |
| `features/common/utils/tagInput.tsx` | Tag Form Widget | 20 | `TagInputControl` (5) | Boundary 1 (Extension UI) | `<TagInput tags={tags} onChange={setTags} />` | `tests/unit/features/common/utils/tagInput.test.ts` | 📋 Ready |
| `features/common/utils/uiUtils.ts` | UI Helpers | 2 | — | Boundary 1 (Extension UI) | Shared Toast Context / Error Boundary | `tests/unit/features/common/utils/uiUtils.test.ts` | 📋 Ready |
| `features/common/help/help.tsx` | Help Center | 39 | — | Boundary 1 (Extension UI) | `<HelpApp />` with controlled search | `tests/unit/features/common/help/help.test.ts` | 📋 Ready |
| `features/common/welcome/welcome.tsx` | Onboarding Wizard | 48 | — | Boundary 1 (Extension UI) | `<WelcomeApp />` with `currentStep` hook | `tests/unit/features/common/welcome/welcome.test.ts` | 📋 Ready |
| `features/common/websites/websites.tsx` | Domain Manager | 14 | — | Boundary 1 (Extension UI) | `<WebsitesApp />` with declarative list | `tests/unit/features/common/websites/websites.test.ts` | 📋 Ready |
| `features/dashboard/pomodoro/pomodoro.tsx` | Pomodoro Timer | 68 | — | Boundary 1 (Extension UI) | `<PomodoroApp />` with `usePomodoroTimer()` | `tests/unit/features/dashboard/pomodoro/pomodoro.test.ts` | 📋 Ready |
| `features/dashboard/studyplan/studyplan.tsx` | Study Organizer | 55 | — | Boundary 1 (Extension UI) | `<StudyPlanApp />` with schedule table | `tests/unit/features/dashboard/studyplan/studyplan.test.ts` | 📋 Ready |
| `features/dashboard/history/history.tsx` | History Log | 36 | — | Boundary 1 (Extension UI) | `<HistoryApp />` with calendar grid | `tests/unit/features/dashboard/history/history.test.ts` | 📋 Ready |
| `features/dashboard/forecast/forecast.tsx` | Forecast Sim | 21 | — | Boundary 1 (Extension UI) | `<ForecastApp />` with simulation bars | `tests/unit/features/dashboard/forecast/forecast.test.ts` | 📋 Ready |
| `features/dashboard/summary/summary.tsx` | Weekly Report | 41 | — | Boundary 1 (Extension UI) | `<SummaryApp />` with declarative KPIs | `tests/unit/features/dashboard/summary/summary.test.ts` | 📋 Ready |
| `features/dashboard/heatmap/heatmap.tsx` | Heatmap Activity | 29 | — | Boundary 1 (Extension UI) | `<HeatmapApp />` with SVG cells | `tests/unit/features/dashboard/heatmap/heatmap.test.ts` | 📋 Ready |
| `features/dashboard/heatmap/heatmap-stats.tsx` | Heatmap Summary Stats | 1 | — | Boundary 1 (Extension UI) | `<HeatmapStatsView />` | `tests/unit/features/dashboard/heatmap/heatmap-stats.test.ts` | 📋 Ready |

---

### Batch B: Tracker Engine & FSRS Configuration (2 Files, 161 DOM Operations)

| File Path | Subsystem | DOM Ops | Caches | Boundary Classification | Target Declarative Component | Test File | Status |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `features/tracker/config/fsrsConfig.tsx` | FSRS Parameter Config | 104 | — | Boundary 1 (Extension UI) | `<FSRSConfigApp />` with `useReducer` | `tests/unit/features/tracker/config/fsrsConfig.test.ts` | 📋 Ready |
| `features/tracker/editor/editor.tsx` | Card Details Editor | 57 | — | Boundary 1 (Extension UI) | `<EditorApp />` with controlled inputs | `tests/unit/features/tracker/editor/editor.test.ts` | 📋 Ready |

---

### Batch C: Core Dashboard & Analytics Suite (24 Files, 409 DOM Operations)

| File Path | Subsystem | DOM Ops | Caches | Boundary Classification | Target Declarative Component | Test File | Status |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `features/dashboard/popup/popup.tsx` | Popup Main Shell | 96 | `PopupDOM` (28) | Boundary 1 (Extension UI) | `<PopupApp />` mounting at `#root` | `tests/unit/features/dashboard/popup/popup.test.ts` | 📋 Ready |
| `features/dashboard/popup/stats.tsx` | Popup KPI Stats | 60 | — | Boundary 1 (Extension UI) | `<PopupStatsOverview />` | `tests/unit/features/dashboard/popup/stats.test.ts` | 📋 Ready |
| `features/dashboard/popup/notifications.tsx` | Popup Alerts | 62 | — | Boundary 1 (Extension UI) | `<PopupNotificationsCard />` | `tests/unit/features/dashboard/popup/notifications.test.ts` | 📋 Ready |
| `features/dashboard/popup/rating.tsx` | Quick Rating Bar | 35 | — | Boundary 1 (Extension UI) | `<QuickRatingSection />` | `tests/unit/features/dashboard/popup/rating.test.ts` | 📋 Ready |
| `features/dashboard/popup/search.tsx` | Pattern Search | 19 | — | Boundary 1 (Extension UI) | `<PopupSearchBar />` | `tests/unit/features/dashboard/popup/search.test.ts` | 📋 Ready |
| `features/dashboard/popup/heatmap.tsx` | Popup Activity Heatmap | 12 | — | Boundary 1 (Extension UI) | `<PopupHeatmapSection />` | `tests/unit/features/dashboard/popup/heatmap.test.ts` | 📋 Ready |
| `features/dashboard/analytics/analytics.tsx` | Analytics Main SPA Shell | 39 | — | Boundary 1 (Extension UI) | `<AnalyticsApp />` single mount | `tests/unit/features/dashboard/analytics/analytics.test.ts` | 📋 Ready |
| `features/dashboard/analytics/overview/overview.tsx` | Overview Tab | 6 | — | Boundary 1 (Extension UI) | `<OverviewTab />` | `tests/unit/features/dashboard/analytics/overview/overview.test.ts` | 📋 Ready |
| `features/dashboard/analytics/overview/miniForecast.tsx` | Overview Mini-Forecast | 6 | — | Boundary 1 (Extension UI) | `<MiniForecast />` | `tests/unit/features/dashboard/analytics/overview/miniForecast.test.ts` | 📋 Ready |
| `features/dashboard/analytics/overview/learningVelocity.tsx` | Overview Learning Velocity | 2 | — | Boundary 1 (Extension UI) | `<LearningVelocity />` | `tests/unit/features/dashboard/analytics/overview/learningVelocity.test.ts` | 📋 Ready |
| `features/dashboard/analytics/overview/memoryHealth.tsx` | Overview Memory Health | 2 | — | Boundary 1 (Extension UI) | `<MemoryHealth />` | `tests/unit/features/dashboard/analytics/overview/memoryHealth.test.ts` | 📋 Ready |
| `features/dashboard/analytics/readiness/readiness.tsx` | Readiness Tab | 6 | — | Boundary 1 (Extension UI) | `<ReadinessTab />` | `tests/unit/features/dashboard/analytics/readiness/readiness.test.ts` | 📋 Ready |
| `features/dashboard/analytics/memory/memory.tsx` | Memory Retention Tab | 16 | — | Boundary 1 (Extension UI) | `<MemoryTab />` | `tests/unit/features/dashboard/analytics/memory/memoryTab.test.ts` | 📋 Ready |
| `features/dashboard/analytics/memory/futureMemorySimulation.tsx` | Memory Simulation | 4 | — | Boundary 1 (Extension UI) | `<FutureMemorySimulation />` | `tests/unit/features/dashboard/analytics/memory/futureMemorySimulation.test.ts` | 📋 Ready |
| `features/dashboard/analytics/memory/retentionChart.tsx` | Memory Retention Chart | 3 | — | Boundary 1 (Extension UI) | `<RetentionChart />` | `tests/unit/features/dashboard/analytics/memory/retentionChart.test.ts` | 📋 Ready |
| `features/dashboard/analytics/memory/predictionComparison.tsx` | Memory Prediction Comparison | 2 | — | Boundary 1 (Extension UI) | `<PredictionComparison />` | `tests/unit/features/dashboard/analytics/memory/memoryTab.test.ts` | 📋 Ready |
| `features/dashboard/analytics/performance/performance.tsx` | Performance Tab | 9 | — | Boundary 1 (Extension UI) | `<PerformanceTab />` | `tests/unit/features/dashboard/analytics/performance/performance.test.ts` | 📋 Ready |
| `features/dashboard/analytics/performance/recoveryTracking.tsx` | Performance Recovery Tracking | 2 | — | Boundary 1 (Extension UI) | `<RecoveryTracking />` | `tests/unit/features/dashboard/analytics/performance/recoveryTracking.test.ts` | 📋 Ready |
| `features/dashboard/analytics/performance/reviewStats.tsx` | Performance Review Stats | 3 | — | Boundary 1 (Extension UI) | `<ReviewStats />` | `tests/unit/features/dashboard/analytics/performance/reviewStats.test.ts` | 📋 Ready |
| `features/dashboard/analytics/tags/tags.tsx` | Tags Tab | 7 | — | Boundary 1 (Extension UI) | `<TagsTab />` | `tests/unit/features/dashboard/analytics/tags/tags.test.ts` | 📋 Ready |
| `features/dashboard/analytics/tags/coverageTable.tsx` | Tags Coverage Table | 5 | — | Boundary 1 (Extension UI) | `<CoverageTable />` | `tests/unit/features/dashboard/analytics/tags/coverageTable.test.ts` | 📋 Ready |
| `features/dashboard/analytics/tags/retentionBarChart.tsx` | Tags Retention Bar Chart | 4 | — | Boundary 1 (Extension UI) | `<RetentionBarChart />` | `tests/unit/features/dashboard/analytics/tags/retentionBarChart.test.ts` | 📋 Ready |
| `features/dashboard/analytics/insights/insights.tsx` | Insights Tab | 6 | — | Boundary 1 (Extension UI) | `<InsightsTab />` | `tests/unit/features/dashboard/analytics/insights/insights.test.ts` | 📋 Ready |
| `features/dashboard/analytics/insights/reviewTimeAnalytics.tsx` | Insights Review Time | 3 | — | Boundary 1 (Extension UI) | `<ReviewTimeAnalytics />` | `tests/unit/features/dashboard/analytics/insights/reviewTimeAnalytics.test.ts` | 📋 Ready |

---

### Batch D: In-Page Content Script Overlays & Text Highlighter (7 Files, 328 DOM Operations)

| File Path | Subsystem | DOM Ops | Caches | Boundary Classification | Target Declarative Component | Test File | Status |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `features/tracker/tracker.tsx` | In-Page Widget Body | 150 (body) + 2 (boundary) | — | Boundary 2 (Hybrid: 150 UI / 2 Host) | Container in host DOM; interior rendered via Preact `<TrackerModal />` | `tests/unit/features/tracker/tracker.test.ts` | 📋 Ready |
| `features/highlighter/highlighter.tsx` | Highlighter Tooltip | 41 (tooltip) + 1 (boundary) | — | Boundary 2 (Hybrid: 41 UI / 1 Host) | Tooltip container in host DOM; interior rendered via Preact `<HighlighterTooltipView />` | `tests/unit/features/highlighter/highlighter.test.ts` | 📋 Ready |
| `features/highlighter/options/highlightOptions.tsx` | Highlighter Palette Options | 45 | — | Boundary 1 (Extension UI) | `<HighlightOptionsApp />` | `tests/unit/features/highlighter/options/highlightOptions.test.ts` | 📋 Ready |
| `features/highlighter/manager/highlights.tsx` | Highlights Manager | 29 | — | Boundary 1 (Extension UI) | `<HighlightsApp />` | `tests/unit/features/highlighter/manager/highlights.test.ts` | 📋 Ready |
| `features/highlighter/manager/highlights-helpers.ts` | Highlights HTML Helpers | 6 | — | Boundary 1 (Extension UI) | Pure utility functions / Preact sanitize | `tests/unit/features/highlighter/manager/highlightsHelpers.test.ts` | 📋 Ready |
| `content/notifications.ts` | Host Toast Notification | 22 | — | Boundary 2 (Host DOM Injection) | Toast container in host DOM; `<NotificationToast />` rendered via Preact | `tests/unit/content/notifications.test.ts` | 📋 Ready |
| `content/content.ts` | Content Script Bootstrap | 32 | — | Boundary 2 (Host DOM Injection) | Host container presence check & MutationObserver | `tests/unit/content/content.test.ts` | 🛡️ Verified |

---

### Technically Justified Infrastructure Utilities (Retained) (4 Files, 20 DOM Operations)

| File Path | Subsystem | DOM Ops | Caches | Boundary Classification | Target Declarative Component | Test File | Status |
| :--- | :--- | :---: | :---: | :--- | :--- | :--- | :---: |
| `features/common/data/backupManager.ts` | Download Fallback | 6 (UI) + 3 (utility) | — | Boundary 3 (Utility: 6 UI / 3 Download Trick) | Encapsulated download helper behind BROWSER_CONFIG check | `tests/unit/features/common/data/backupManager.test.ts` | 🛡️ Verified |
| `features/common/services/actionService.ts` | Action Service Fallback | 2 (UI) + 1 (utility) | — | Boundary 3 (Utility: 2 UI / 1 Download Trick) | Encapsulated download helper behind BROWSER_CONFIG check | `tests/unit/background/commands.test.ts` | 🛡️ Verified |
| `features/common/theme-sync.ts` | Pre-Mount Theme Sync | 3 | — | Boundary 3 (Pre-Mount FOUC Utility) | Synchronous `documentElement.classList` in `<head>` to prevent FOUC | `tests/unit/features/common/themeSync.test.ts` | 🛡️ Verified |
| `content/utils.ts` | Host DOM Scraper | 5 | — | Boundary 2 (Host DOM Read-Only Scraper) | Read-only scraping of LeetCode/AlgoMonster problem title and favicon | `tests/unit/content/contentUtils.test.ts` | 🛡️ Verified |

---

## Batch Exit Criteria & Verification Sign-Off

Before any batch is marked **Completed (DONE)**, all of the following conditions must be satisfied:

1. **Zero Imperative DOM in Batch Scope**: Every file in the batch has 0 calls to `getElementById`, `querySelector`, `innerHTML`, `classList`, and `element.style` (excluding retained Boundary 2 host injection points and Boundary 3 utilities).
2. **Zero Element Caches**: Any cached element interfaces (`PopupDOM`, `this.dom`, `TagInputControl`) in the batch are deleted.
3. **TypeScript Type Safety**: `npx tsc --noEmit` exits with code 0.
4. **Test Suite Integrity**: `npm test` passes 100% of test suites with zero failures.
5. **Build Cleanliness**: `npm run build` compiles Chrome, Firefox, and Safari distributions cleanly.
6. **Isolation Verification**: `npm run check:isolation:all` passes 37/37 checks.
7. **Branch Invariant**: `git rev-parse main` remains `41fe481935c854548e3411a591b71df6371d6088`.
