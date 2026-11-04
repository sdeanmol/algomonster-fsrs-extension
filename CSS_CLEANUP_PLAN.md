# CSS Cleanup & Documentation Plan

## 1. Overview & Scope
- **Date Started:** 2026-11-04
- **Date Completed:** 2026-11-04
- **Target Directories:**
  - `features/common/` (`base.css`, `data/data.css`, `help/help.css`, `websites/websites.css`, `welcome/welcome.css`)
  - `features/dashboard/` (`analytics/analytics.css`, `forecast/forecast.css`, `heatmap/heatmap.css`, `history/history.css`, `pomodoro/pomodoro.css`, `popup/popup.css`, `studyplan/studyplan.css`, `summary/summary.css`)
  - `features/highlighter/` (`manager/highlights.css`, `options/highlightOptions.css`, `style.css`)
  - `features/tracker/` (`config/fsrsConfig.css`, `editor/editor.css`)
- **Status:** Completed
- **Safety Directives Verified:**
  - Zero Visual Regressions: Protected all dynamically generated classes (e.g. `grid-${currentView}s`, `state-${state}`, `badge-${status}`, `tag-color-${id}`).
  - Strict Verification Gate: `npm run build`, `npm test` (90 suites / 1,169 tests), and `npm run check:isolation:all` (37 / 37 assertions) fully passed.
  - Comprehensive TSDoc / CSSDoc style headers (`@file`, `@context`, `@description`, `@associated-components`, `@custom-properties`) and rule annotations applied across all 18 stylesheets.

---

## 2. File Index & Usage Mapping

| CSS File | Associated TSX/HTML Files | Total Classes | Unused Cleaned | Current Unused | Status |
|---|---|---:|---:|---:|:---:|
| `features/common/base.css` | Global baseline design system loaded by all 16 HTML entry points | 26 | 7 | 0 | Clean |
| `features/common/data/data.css` | `features/common/data/data.tsx`, `data.html` | 71 | 21 | 0 | Clean |
| `features/common/help/help.css` | `features/common/help/help.tsx`, `helpContent.tsx`, `help.html` | 47 | 4 | 0 | Clean |
| `features/common/websites/websites.css` | `features/common/websites/websites.tsx`, `websites.html` | 14 | 0 | 0 | Clean |
| `features/common/welcome/welcome.css` | `features/common/welcome/welcome.tsx`, `welcome.html` | 28 | 0 | 0 | Clean |
| `features/dashboard/analytics/analytics.css` | `features/dashboard/analytics/analytics.tsx` + 7 sub-tabs, `analytics.html` | 209 | 7 | 0 | Clean |
| `features/dashboard/forecast/forecast.css` | `features/dashboard/forecast/forecast.tsx`, `forecast.html` | 42 | 0 | 0 | Clean |
| `features/dashboard/heatmap/heatmap.css` | `features/dashboard/heatmap/heatmap.tsx`, `heatmap-stats.tsx`, `heatmap.html` | 32 | 0 | 0 | Clean |
| `features/dashboard/history/history.css` | `features/dashboard/history/history.tsx`, `history.html` | 31 | 1 | 0 | Clean |
| `features/dashboard/pomodoro/pomodoro.css` | `features/dashboard/pomodoro/pomodoro.tsx`, `pomodoro.html` | 40 | 0 | 0 | Clean |
| `features/dashboard/popup/popup.css` | `features/dashboard/popup/popup.tsx` + sub-components, `popup.html` | 135 | 4 | 0 | Clean |
| `features/dashboard/studyplan/studyplan.css` | `features/dashboard/studyplan/studyplan.tsx`, `studyplan.html` | 44 | 0 | 0 | Clean |
| `features/dashboard/summary/summary.css` | `features/dashboard/summary/summary.tsx`, `summaryGenerator.ts`, `summary.html` | 63 | 0 | 0 | Clean |
| `features/highlighter/manager/highlights.css` | `features/highlighter/manager/highlights.tsx`, `highlights.html` | 30 | 0 | 0 | Clean |
| `features/highlighter/options/highlightOptions.css` | `features/highlighter/options/highlightOptions.tsx`, `highlightOptions.html` | 35 | 0 | 0 | Clean |
| `features/highlighter/style.css` | `features/highlighter/highlighter.tsx` (In-page text selection & floating tooltip) | 66 | 2 | 0 | Clean |
| `features/tracker/config/fsrsConfig.css` | `features/tracker/config/fsrsConfig.tsx`, `fsrsConfig.html` | 52 | 2 | 0 | Clean |
| `features/tracker/editor/editor.css` | `features/tracker/editor/editor.tsx`, `editor.html` | 18 | 0 | 0 | Clean |
| **Total** | **All 18 Extension Stylesheets** | **983** | **48** | **0** | **✅ 100% Clean** |

---

## 3. Class Deletion Log

| CSS File | Deleted Class / Selector | Reason for Removal | Verified by Search | Status |
|---|---|---|---|:---:|
| `features/common/base.css` | `.responsive-grid` | Redundant layout utility with 0 usages across all TSX/HTML views. | Full workspace grep: 0 hits | Done |
| `features/common/base.css` | `.grid-auto-fit-sm` | Redundant layout utility with 0 usages across all TSX/HTML views. | Full workspace grep: 0 hits | Done |
| `features/common/base.css` | `.grid-auto-fit-md` | Redundant layout utility with 0 usages across all TSX/HTML views. | Full workspace grep: 0 hits | Done |
| `features/common/base.css` | `.fluid-h1` | Redundant fluid type utility with 0 usages in any view or component. | Full workspace grep: 0 hits | Done |
| `features/common/base.css` | `.fluid-h2` | Redundant fluid type utility with 0 usages in any view or component. | Full workspace grep: 0 hits | Done |
| `features/common/base.css` | `.modal-content` | Generic modal rule superseded by component-specific modal layouts (`.edit-modal`). | Full workspace grep: 0 hits | Done |
| `features/common/base.css` | `.dialog-content` | Generic dialog rule superseded by component-specific dialog layouts. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.stacked-bar` | Pre-Preact legacy breakdown bar layout removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.bar-segment` | Pre-Preact legacy breakdown bar layout removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.seg-new` | Pre-Preact legacy breakdown bar segment color removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.seg-learning` | Pre-Preact legacy breakdown bar segment color removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.seg-review` | Pre-Preact legacy breakdown bar segment color removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.seg-lapsed` | Pre-Preact legacy breakdown bar segment color removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.analytics-legend` | Pre-Preact legacy legend layout removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.legend-item` | Pre-Preact legacy legend item removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.legend-dot` | Pre-Preact legacy legend dot removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.dot-new` | Pre-Preact legacy legend dot color removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.dot-learning` | Pre-Preact legacy legend dot color removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.dot-review` | Pre-Preact legacy legend dot color removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.dot-lapsed` | Pre-Preact legacy legend dot color removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.legend-pct` | Pre-Preact legacy legend percentage label removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.tags-bars-container` | Pre-Preact legacy tag distribution bars layout removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.tag-bar-row` | Pre-Preact legacy tag distribution bar row removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.tag-bar-name` | Pre-Preact legacy tag distribution bar label removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.tag-bar-track` | Pre-Preact legacy tag distribution track removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.tag-bar-fill` | Pre-Preact legacy tag distribution fill removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.tag-bar-value` | Pre-Preact legacy tag distribution value removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/data/data.css` | `.empty-analytics-msg` | Pre-Preact legacy empty message removed from `data.html`/`data.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/help/help.css` | `.header-emoji` | Stale visibility override for non-existent emoji DOM node. | Full workspace grep: 0 hits | Done |
| `features/common/help/help.css` | `.main-logo-icon` | Superseded by `.algorecall-brand-badge` and `.logo-icon` in header. | Full workspace grep: 0 hits | Done |
| `features/common/help/help.css` | `.callout-box-warning` | Legacy callout variant; only `.callout-box` is rendered in `helpContent.tsx`. | Full workspace grep: 0 hits | Done |
| `features/common/help/help.css` | `.callout-box-danger` | Legacy callout variant; only `.callout-box` is rendered in `helpContent.tsx`. | Full workspace grep: 0 hits | Done |
| `features/dashboard/analytics/analytics.css` | `.review-time-chart` | Superseded by SVG chart renderer in `reviewTimeAnalytics.tsx`. | Full workspace grep: 0 hits | Done |
| `features/dashboard/analytics/analytics.css` | `.time-bucket-col` | Old DOM bar chart column; replaced by SVG line/point graph. | Full workspace grep: 0 hits | Done |
| `features/dashboard/analytics/analytics.css` | `.time-bucket-stats` | Old DOM bar chart tooltip; replaced by SVG line/point graph. | Full workspace grep: 0 hits | Done |
| `features/dashboard/analytics/analytics.css` | `.time-bar-wrapper` | Old DOM bar wrapper; replaced by SVG line/point graph. | Full workspace grep: 0 hits | Done |
| `features/dashboard/analytics/analytics.css` | `.time-bar` | Old DOM bar fill; replaced by SVG line/point graph. | Full workspace grep: 0 hits | Done |
| `features/dashboard/analytics/analytics.css` | `.time-bar-val` | Old DOM bar value label; replaced by SVG line/point graph. | Full workspace grep: 0 hits | Done |
| `features/dashboard/analytics/analytics.css` | `.time-bucket-lbl` | Old DOM bucket label; replaced by SVG line/point graph. | Full workspace grep: 0 hits | Done |
| `features/dashboard/popup/popup.css` | `.gamification-progress-text` | Superseded by circular SVG progress ring in `stats.tsx` (`.goal-ring-count`). | Full workspace grep: 0 hits | Done |
| `features/dashboard/popup/popup.css` | `.gamification-bar` | Superseded by circular SVG progress ring in `stats.tsx` (`.goal-ring-wrap`). | Full workspace grep: 0 hits | Done |
| `features/dashboard/popup/popup.css` | `.gamification-fill` | Superseded by circular SVG progress ring in `stats.tsx` (`.goal-ring-fill`). | Full workspace grep: 0 hits | Done |
| `features/dashboard/popup/popup.css` | `.sub-title` | Unused legacy section title; replaced by component-specific subheadings. | Full workspace grep: 0 hits | Done |
| `features/dashboard/history/history.css` | `.card.no-click` | Unused modifier; all history cards are interactive drill-downs. | Full workspace grep: 0 hits | Done |
| `features/highlighter/style.css` | `.algo-link-card-btn` | Superseded by `.algo-link-btn` in `highlighter.tsx`. | Full workspace grep: 0 hits | Done |
| `features/highlighter/style.css` | `#fsrs-divider` | Superseded by `.algo-tooltip-divider` in `highlighter.tsx`. | Full workspace grep: 0 hits | Done |
| `features/tracker/config/fsrsConfig.css` | `.mode-pill` | Legacy simple/advanced mode toggle; replaced by `.preset-chip`. | Full workspace grep: 0 hits | Done |
| `features/tracker/config/fsrsConfig.css` | `.mode-pill.active` | Legacy mode toggle active state; replaced by `.preset-chip.active`. | Full workspace grep: 0 hits | Done |

---

## 4. Execution Progress Log
- [x] Initial project scan and unused class identification across 18 stylesheets.
- [x] Cross-reference against 215 source files (`.tsx`, `.ts`, `.html`, `.js`).
- [x] Populate dependency matrix and identify dynamic classes to safeguard.
- [x] Safe removal of dead CSS rules across target stylesheets.
- [x] Documentation of remaining active CSS classes and file header annotations across all 18 files.
- [x] Build & verification check (`npm run build && npm test && npm run check:isolation:all`).
- [x] Final status update in `CSS_CLEANUP_PLAN.md`.

---

## 5. Verification Summary & Results
- **TypeScript Typecheck (`npx tsc --noEmit`)**: 0 errors.
- **Jest Unit & Component Test Suite (`npm test`)**: 90 / 90 test suites passed, 1,169 / 1,169 tests passed.
- **Multi-Browser Webpack Bundles (`npm run check:isolation:all`)**:
  - Chrome target: Compiled cleanly, 0 isolation leaks.
  - Firefox target: Compiled cleanly, 0 isolation leaks.
  - Safari target: Compiled cleanly, 0 isolation leaks.
  - Artifact Isolation Audit: 37 / 37 passed.
- **CSS Dead Code Elimination**: 48 unused classes/selectors removed; 0 unused classes remaining.
