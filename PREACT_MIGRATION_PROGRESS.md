# Preact Migration Progress Dashboard

> **Project:** AlgoRecall FSRS Chrome Extension  
> **Target Framework:** Preact (TypeScript)  
> **Last Updated:** 2026-11-03  

---

## 1. Migration Metrics Dashboard

| Metric | Count | Status / Notes |
|:---|---:|:---|
| **Total Files Audited** | **68** | All TypeScript source files accounted for in inventory |
| **Files Requiring Preact Conversion** | **46** | UI views, components, and controllers (Categories A & B) |
| **Framework-Independent Files (Kept as TS)** | **22** | Domain logic, schedulers, service worker, content hooks (Categories C & D) |
| **Files Converted to Preact** | **17** | Batches 1, 2, 3, & 4 complete (`websites`, `help`, `welcome`, `tagInput`, `highlightOptions`, `highlights`, `highlighter`, `editor`, `fsrsConfig`, `data`, `pomodoro`, `heatmap`, `heatmap-stats`, `history`, `forecast`, `studyplan`, `summary`) |
| **Files Verified** | **39** | 22 framework-independent + 17 converted Preact modules |
| **Files Pending** | **29** | Batches 5 to 7 |
| **Files Blocked** | **0** | No active blockers |
| **Features Verified** | **4 / 16** | Leaf Management Views, Full Highlighter Suite, Card Management/Editor Views, & Productivity Dashboard Views |
| **Tests Passing** | **1,114** | 87 test suites all green |
| **Tests Failing** | **0** | Zero failures |

---

## 2. Current Phase & Active Batch

- **Current Phase:** Phase 4 — Incremental UI File-by-File Migration
- **Current Batch:** Batch 5 — Main Popup UI & Sub-Components
- **Next Targets:**
  1. `features/dashboard/popup/popup.ts` -> `popup.tsx` (Main popup controller and orchestration)
  2. `features/dashboard/popup/stats.ts` -> `stats.tsx` (Popup review stats and badge summaries)
  3. `features/dashboard/popup/heatmap.ts` -> `heatmap.tsx` (Popup mini contribution heatmap grid)
  4. `features/dashboard/popup/search.ts` -> `search.tsx` (Popup card quick search and filtering)
  5. `features/dashboard/popup/rating.ts` -> `rating.tsx` (Popup rating actions and ease dials)
  6. `features/dashboard/popup/notifications.ts` -> `notifications.tsx` (Popup system notifications)

---

## 3. Phase Status Overview

| Phase | Description | Status | Evidence / Notes |
|:---|:---|:---:|:---|
| **Phase 0** | Repository Discovery and Baseline Audit | ✅ Completed | 68 files cataloged; 1,031 baseline tests passing; build gate verified |
| **Phase 1** | Target Architecture & Migration Design | ✅ Completed | Architecture blueprint, component hierarchy, & plan committed |
| **Phase 2** | Testing Infrastructure & Preact Setup | ✅ Completed | Tooling configuration, `tsconfig.json`, `webpack.config.js`, `jest.config.js` |
| **Phase 3** | Shared UI Primitives & Hooks | ✅ Completed | Reusable `Toggle`, `useStorage`, component and hook test suites |
| **Phase 4** | Incremental File-by-File Migration | 🟡 In Progress | Batches 1, 2, & 3 complete (10/46 UI files converted); Batch 4 starting |
| **Phase 5** | Feature Integration & Regression Verification | ⏳ Planned | End-to-end integration and cross-browser checks |
| **Phase 6** | Obsolete Vanilla Cleanup | ⏳ Planned | Clean obsolete DOM helpers |
| **Phase 7** | Comprehensive Final Verification | ⏳ Planned | Full audit, packaging, and sign-off report |

---

## 4. Batch Execution Schedule & Status

| Batch | Scope | Status | Details / Evidence |
|:---|:---|:---:|:---|
| **Batch 1** | Leaf Management Views | ✅ Verified | `websites.tsx`, `help.tsx`, `welcome.tsx`, `tagInput.tsx` converted & verified; sub-component test suites added. |
| **Batch 2** | Highlighter Feature Views | ✅ Verified | `highlightOptions.tsx`, `highlights.tsx`, `highlighter.tsx` converted & verified; palette editor, highlights list, tooltip components tested. |
| **Batch 3** | Card Management & Editor Views | ✅ Verified | `editor.tsx`, `fsrsConfig.tsx`, `data.tsx` converted & verified; Markdown live preview, FSRS parameter sliders, cards table components tested. |
| **Batch 4** | Focused Productivity Dashboard Views | ✅ Verified | `pomodoro.tsx`, `heatmap.tsx`, `heatmap-stats.tsx`, `history.tsx`, `forecast.tsx`, `studyplan.tsx`, `summary.tsx` converted & verified; `summaryGenerator.ts` retained as framework-independent; 6 Preact component test suites added (38 new component tests). |
| **Batch 5** | Main Popup UI & Sub-Components | ⏳ Planned | `popup.ts` + 5 sub-components |
| **Batch 6** | Analytics Dashboard & Sub-Modules | ⏳ Planned | `analytics.ts` + 17 sub-modules |
| **Batch 7** | In-Page Floating Tracker Widget | ⏳ Planned | `tracker.ts` |

---

## 5. Risk & Blocker Register

- **No active blockers.**
- **Known Risk:** Preserving backwards compatibility with existing unit test DOM fixtures during component migration. Successfully addressed across Batches 1, 2, and 3 by mounting Preact sub-components into DOM containers and ensuring identical IDs, attributes, classes, and controller methods.
