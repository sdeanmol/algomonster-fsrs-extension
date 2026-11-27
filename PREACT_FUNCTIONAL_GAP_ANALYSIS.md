# Preact Migration Functional Gap Analysis

## 1. Executive Summary

- **Purpose**: Compare the `preact` branch (working tree) against the `main` branch (source of truth) across all extension modules, entry points, background scripts, content scripts, shared UI, dashboard pages, tracker, and highlighter features to identify every functional regression, missing feature, behavior mismatch, and configuration difference.
- **Branches Compared**:
  - **Source of Truth**: `main` (Vanilla TypeScript DOM manipulation)
  - **Target**: `preact` (Preact 11 + hooks + TypeScript 5)
- **Total Confirmed Gaps**: **33**
  - **P0 (Critical / Blocker)**: **0**
  - **P1 (High Priority)**: **8** (`GAP-001` – `GAP-008`)
  - **P2 (Medium Priority)**: **18** (`GAP-009` – `GAP-026`)
  - **P3 (Low Priority / Polish)**: **7** (`GAP-027` – `GAP-033`)
- **Overall Parity Assessment**: The Preact 11 migration achieves **high overall functional parity** with `main`. Core FSRS scheduling, WASM/JS parameter optimization, cross-browser manifests/isolation (`check:isolation` 37/37 passing), content script lifecycle, Markdown editor, Highlighter CSS Custom Highlights, Analytics (all 7 tabs), Summary, Tag Manager, Websites Manager, and Onboarding Welcome are largely intact. The remaining gaps are concentrated in specific state-wiring, persistence, filter-cascading, and UI-behavior regressions (notably manual due-review throttling, Help Center search filtering, Data Manager undo/status toasts, Popup tag hydration & achievement persistence, Heatmap filter resets, Forecast peak day calculation, and Pomodoro title/start state).

---

## 2. Architecture Overview

| Dimension | `main` (Source of Truth) | `preact` (Current Working Tree) |
|---|---|---|
| **UI Paradigm** | Imperative Vanilla TypeScript (`document.createElement`, `innerHTML`, manual DOM event listeners) | Declarative Preact 11 functional components (`h()` / JSX, `useState`, `useEffect`, `useCallback`, `useRef`) |
| **Entry Points** | `.ts` entry points in `webpack.config.js` | `.tsx` entry points in `webpack.config.js` mounting Preact root apps into `.html` containers |
| **Popup Bundling** | Modular classes (`StatsComponent`, `QuickSearchComponent`, `NotificationsComponent`, `RatingComponent`, `HeatmapComponent`) orchestrated by `popup.ts` | `webpack.config.js` bundles only `popup.tsx` (`PopupApp`); `stats.tsx`, `search.tsx`, `notifications.tsx`, `rating.tsx`, `heatmap.tsx`, `DashboardComponent.tsx` are retained for unit tests (only `calculateStreaks`/`triggerConfetti` from `stats.tsx` are imported) |
| **Content Notifications** | Imperative DOM toast creation in `content/notifications.ts` | Preact `NotificationToast` component rendered via `render()` with `render(null, ...)` cleanup in `content/notifications.ts` |
| **Error Handling** | `@CatchAndLog` / `@CatchAndReturn` / `withErrorHandling` decorators across `background/`, `content/`, `theme-sync.ts`, `actionService.ts` | Inline `try/catch` in `background/`, `content/`, `theme-sync.ts`, `actionService.ts` (`decorators/` still imported in `popup.tsx` and `settings.tsx`) |
| **Shared UI & Hooks** | `MultiSelectControl`, `TagInputControl`, `UIUtils` | Added `features/common/ui/components/` (`Toggle.tsx`, `Toast.tsx`, `MultiSelect.tsx`), `features/common/ui/hooks/` (`useStorage.ts`), `tagInput.tsx` + `tagInputAdapter.ts`, and `analytics/utils/resolveContainer.ts` |
| **Build & Assets** | Webpack 5 (`ts-loader`), `CopyPlugin`, `DefinePlugin` | Same toolchain; `CopyPlugin` `ignorePatterns` updated; `icons/launcher.svg` & `icons/logo.svg` added (`v2-logo-*.svg` removed); `audit:dom` & `visual-comparison-audit.js` scripts added |

---

## 3. Feature Inventory

### 3.1 Core Infrastructure & Background
- **Manifests & Cross-Browser Config**: `browser/{chrome,firefox,safari}/manifest.json`, `features/common/browserConfig.ts`, `features/common/constants.ts` (MV3 permissions, host permissions, 19 commands, content scripts, CSP/COEP/COOP, `BROWSER_CONFIG` feature flags).
- **Background Service Worker**: `background/background.ts` (`AlgoRecallBackground` — alarms `checkFsrsReviews`, `snoozeFsrsReviews`, `smartReviewSchedule`, `weeklySummary`, `dailyNudge`, `pomodoroEnd`; `chrome.commands`; `webNavigation.onHistoryStateUpdated`; `chrome.notifications`; `chrome.action` badge & Pomodoro ticker; runtime messaging `check_due_cards_now`, `test_notification`, `open_fullscreen_editor`, `snooze_notification`, `toggle_weekly_summary`, `test_summary_notification`, `pomodoro_action`).
- **Content Script & Notifications**: `content/content.ts` (`AlgoRecallOrchestrator`, `isIgnoredMutationNode`, SPA click/`popstate`/`MutationObserver` lifecycle), `content/notifications.ts` (`Notifier` + Preact `NotificationToast`), `content/state.ts` (`getAlgoRecallGlobal`), `content/utils.ts` (`Utils` + tracker/highlighter host helpers).
- **Common Core & Services**: `features/common/services/actionService.ts` (`ActionService`), `features/common/theme-sync.ts` (`ThemeSync`), `features/common/logger.ts`, `features/common/markdown.ts`, `decorators/` (`errorDecorators.ts`, `index.ts`), `types/` (`domain.ts`, `backup.ts`, `chrome.d.ts`, `fsrs.d.ts`, `wasm-runtime.d.ts`).
- **Build, Scripts & Assets**: `webpack.config.js`, `tsconfig.json`, `package.json`, `scripts/`, `icons/`.

### 3.2 Common UI & Utilities
- **Data Manager** (`features/common/data/`): `backupManager.ts` (GZIP/JSON backup export/restore with FNV-1a checksum), `data.tsx` (`DataApp`, `FSRSDataDashboard`, `CardsTable`, `CardsTableRow`, `CardsTableEmptyState`, `BulkActionsBar`, `DataAnalyticsPanel`, inline edit modal, multi-factor filtering, sorting, bulk actions, undo/status toasts).
- **Settings Hub** (`features/common/settings/`): `settings.tsx` (`SettingsApp`, `SettingsHeader`, `SettingsNav`, `NotificationsPanel`, `HighlighterPanel`, `DataPanel`, `IntegrationsPanel`, `DeveloperPanel`, `AboutPanel`).
- **Help Center** (`features/common/help/`): `help.tsx` (`HelpApp`, `HelpTabBar`, `HelpCenterSPA`), `helpContent.tsx` (7 documentation tab panes with browser-specific store policy & data certification).
- **Onboarding Welcome** (`features/common/welcome/`): `welcome.tsx` (`WelcomeApp`, `OnboardingWelcome`, `StepIndicators`, 4-step wizard, theme picker, notification toggle/OS permission, browser-specific pin guide).
- **Whitelisted Websites** (`features/common/websites/`): `websites.tsx` (`WebsitesApp`, `WhitelistedWebsitesManager`, `WhitelistedSitesList`, dynamic `chrome.permissions.request`/`remove` + `chrome.scripting.registerContentScripts`/`unregisterContentScripts`, restore defaults).
- **Tag Manager** (`features/common/tags/`): `tags.tsx` (`TagManagerApp`, `TagRow`), `tagRegistry.ts` (`TagRegistry` CRUD, hydrate, merge, delete).
- **Shared Utils & UI** (`features/common/utils/`, `features/common/ui/`, `features/common/base.css`): `cardUtils.ts`, `uiUtils.ts`, `tagInput.tsx` + `tagInputAdapter.ts`, `multiSelect.ts`, `MultiSelect.tsx`, `Toast.tsx`, `Toggle.tsx`, `useStorage.ts`.

### 3.3 Dashboard (Popup, Analytics & Sub-Pages)
- **Popup** (`features/dashboard/popup/popup.tsx`, `achievements.ts`, `popup.css`): Header & XP/Level badge + Achievements modal, Notification permission banner, engagement-gated Rating prompt & Static Review banner, Hero Stats (Total/Due/Retention) & Quick Search + tag filter, Daily Focus & Momentum (goal ring, inline editor, streaks, exam countdown, 7-day momentum, Milestones & Records modal), Bento Command Center, Mini Activity Heatmap (12w/Lifetime), Advanced Options Drawer & Dev Tools.
- **Analytics** (`features/dashboard/analytics/`): 7-tab SPA (`analytics.tsx`, `utils/dataUtils.ts`, `utils/resolveContainer.ts`) with global KPI pills, URL `?tab=` sync, `fsrsGlobalParams` loading:
  - `overview/`: Next-action banner, `MemoryHealth` radial ring, `LearningVelocity` sparklines, `MiniForecast` 7-day tiles.
  - `readiness/`: Exam days input/presets, target date, per-tag projected recall, `studyplan.html` CTA.
  - `memory/` & `simulation`: `PersonalMemoryModelBanner`, `RetentionChart` (multi-line SVG + `confidenceBand.tsx`), `PredictionComparison`, `FutureMemorySimulation` (0–180d slider + decay SVG).
  - `tags/`: `CoverageTable` (clickable tag badges -> `data.html`), `RetentionBarChart` (top 10 sortable).
  - `performance/`: `ReviewStats` (daily/weekly/monthly bars), `RecoveryTracking` (`MultiSelect` tag filter + recovered vs struggling).
  - `insights/`: `ReviewTimeAnalytics` (best-bucket highlight + 4-bucket SVG line chart).
- **Sub-Pages**:
  - `heatmap/` (`heatmap.tsx`, `heatmap-stats.tsx`): 4-mode date filter (`lifetime`/`year-wise`/`month-wise`/`day-wise`), 5-level intensity grid, `data.html` drill-down, 4 streak KPI cards.
  - `history/` (`history.tsx`): `fsrsActivity` sync from `fsrsCards.historyLog`, Year/Month/Day drill-down cards & CSS bar chart, `showCharts` toggle, `data.html` drill-down.
  - `forecast/` (`forecast.tsx`): 30-day due projection, 4 summary cards, CSS bar chart, 30-day calendar grid with `data.html` drill-down.
  - `pomodoro/` (`pomodoro.tsx`): Focus/Short/Long Break countdown, SVG ring, session dots, today's stats, settings persistence, `chrome.storage.onChanged` & `pomodoro_action` background sync.
  - `studyplan/` (`studyplan.tsx`): Exam date & daily limit preview, priority-sorted card redistribution with `originalDue` backup/restore, countdown ring, 30-day schedule table.
  - `summary/` (`summary.tsx`, `summaryGenerator.ts`): `?period=monthly` param, Weekly/Monthly KPIs & trends, insights, daily bar chart, FSRS health, topic mastery bars.

### 3.4 Tracker & Highlighter
- **Tracker** (`features/tracker/tracker.tsx`, `scheduler/fsrsScheduler.ts`, `scheduler/scheduler.ts`): Floating launcher FAB (drag, right-click reset, keyboard Enter/Space, `showLauncher` setting), dialog container (Escape close, minimize), multi-card URL tabs (`+ Add Card`), tag input with `TagInputControl` autocomplete, approach textarea & draft auto-save (`approachDrafts`), fullscreen editor handoff, FSRS rating bar (Again/Hard/Good/Easy), topic tag picker, card review view (Markdown approach, Show Approach, `Space`/`Enter` + `1`–`4` hotkeys, debounce, activity logging).
- **Markdown Editor** (`features/tracker/editor/editor.tsx`): URL/`cardId` query param loading, card vs `approachDrafts` persistence, Time/Space complexity inputs, 300ms debounced auto-save, Preview/Edit Markdown toggle (`Markdown.render`), Save Progress toast, Save & Close, `pagehide`/`beforeunload` save.
- **FSRS Config** (`features/tracker/config/fsrsConfig.tsx`): Simple/Advanced mode toggle, retention slider & preset chips (80/85/90/95%), Decay/Factor constants, 17-weight grid (`w0`–`w16`) with tooltips, tag-specific weight profiles CRUD, eligibility progress & threshold warning, WASM (`fsrsOptimizer.ts`) + JS fallback (`fsrsOptimizerFast.ts`) auto-training, JSON weight export, reset controls.
- **Highlighter** (`features/highlighter/highlighter.tsx`): Text selection tooltip (`pointerup`/`keyup`), hover tooltip on existing marks (`mousemove`), type selector (`highlight`/`underline`), palette & default color swatches, native color picker with range caching, mark deletion, category & note editing, link-to-card/draft, CSS Custom Highlights API restoration.
- **Highlights Manager** (`features/highlighter/manager/highlights.tsx`, `highlights-helpers.ts`): Search, `MultiSelect` source page filter, sort (newest/oldest/longest/shortest/title), color bubble filters, copy/delete card actions, Markdown export (`chrome.downloads` / `ActionService.triggerDomDownload`).
- **Highlighter Options** (`features/highlighter/options/highlightOptions.tsx`): Default highlight color picker/hex, 1–5 slot palette creator/editor (max 50 palettes), activate/edit/delete palette cards, reset to defaults.

---

## 4. Detailed Functional Gap Analysis

### P1 (High Priority)

#### GAP-001: Manual due-review check throttled by interval
- **Priority**: P1
- **Category**: Behavior Mismatch / Background & Notifications
- **Feature**: Manual due-review check (`check-due-reviews` command / `check_due_cards_now` message)
- **Main implementation**: `background/background.ts` (`executeDueCardsCheck` / `checkDueCards`)
- **Relevant symbols**: `AlgoRecallBackground`, `checkDueCards`, `executeDueCardsCheck`, `lastNotificationTime`
- **Preact implementation**: `background/background.ts` (`checkDueCards`)
- **Expected behavior**: When `source === 'manual'` (triggered via `Alt+Shift+R` or `check_due_cards_now`), the `lastNotificationTime` interval throttle is bypassed (`source !== 'snoozeFsrsReviews' && source !== 'test' && source !== 'manual'`) so the review notification dispatches immediately.
- **Current Preact behavior**: `checkDueCards` checks `if (source !== 'snoozeFsrsReviews' && source !== 'test')`, omitting `&& source !== 'manual'`.
- **Identified gap**: Manual review checks are subject to the `frequency` interval throttle (default 60 minutes) and silently skip dispatching notifications if a prior notification was sent recently.
- **Impact**: User-triggered immediate review checks (`Alt+Shift+R` or Popup "Check Now" if routed through `manual`) fail silently within the throttle window.
- **Recommended implementation**: Restore `&& source !== 'manual'` to the throttle condition in `background/background.ts:746`.
- **Dependencies**: None.
- **Evidence**: `main:background/background.ts:683` vs `preact:background/background.ts:746`.

---

#### GAP-002: Help Center live search does not filter cards or highlight matching tabs
- **Priority**: P1
- **Category**: Behavior Mismatch / Missing Feature
- **Feature**: Help Center live search (`#help-search-input`)
- **Main implementation**: `features/common/help/help.ts` (`HelpCenterSPA.filterContent`)
- **Relevant symbols**: `HelpCenterSPA`, `HelpApp`, `HelpTabBar`, `filterContent`, `searchQuery`
- **Preact implementation**: `features/common/help/help.tsx` (`HelpCenterSPA.filterContent`, `HelpApp`)
- **Expected behavior**: Typing in `#help-search-input` hides non-matching `.card, .gamify-card, .strategy-card` elements, activates only `.tab-pane` containers that have matching cards, and highlights matching `.tab-btn` elements.
- **Current Preact behavior**: `HelpApp` injects inline CSS `.tab-pane { display: block !important; }` whenever `searchQuery` is truthy, dumping all 7 tabs' cards unfiltered and never updating `.tab-btn` highlights.
- **Identified gap**: Live search filtering and tab-highlight logic were replaced with an unconditional CSS override that shows all panes without filtering cards.
- **Impact**: Help Center search is non-functional; users cannot narrow down documentation cards.
- **Recommended implementation**: Filter cards/panes declaratively in `HelpApp` / `helpContent.tsx` via text matching against `searchQuery`, render only matching cards/panes, and pass matching tab state to `HelpTabBar` for button highlighting.
- **Dependencies**: None.
- **Evidence**: `main:features/common/help/help.ts:199-239` vs `preact:features/common/help/help.tsx:189-194, 281-287`.

---

#### GAP-003: Data Manager undo toast & status toast never render
- **Priority**: P1
- **Category**: Missing Wiring / Broken Feature
- **Feature**: Data Manager card deletion Undo toast (`#undo-toast`) and status toast (`#status-toast`)
- **Main implementation**: `features/common/data/data.ts` (`showUndoToast`, `bindDeleteButtons`, `UIUtils.showToast`)
- **Relevant symbols**: `DataApp`, `FSRSDataDashboard.showUndoToast`, `Toast`, `#undo-toast`, `#undo-action-btn`, `#status-toast`
- **Preact implementation**: `features/common/data/data.tsx` (`DataApp`, `FSRSDataDashboard.showUndoToast`)
- **Expected behavior**: Deleting a single card or bulk-deleting shows `#undo-toast` for 5 seconds with a working `#undo-action-btn` to restore deleted cards, and `UIUtils.showToast` displays `#status-toast`.
- **Current Preact behavior**: `showUndoToast` dispatches a `'algorecall-undo-toast'` window event, but `DataApp` renders a static `<div id="status-toast" />` and `<div id="undo-toast" style={{ display: 'none' }}>` with no event listeners, no `<Toast />` component, no 5-second auto-hide timer, and no `#undo-action-btn` click handler.
- **Identified gap**: Event listeners, `<Toast />` wiring, timer state, and undo restoration handler were never connected in `DataApp`.
- **Impact**: Card deletion Undo is completely broken, and status/error toasts never appear on `data.html`.
- **Recommended implementation**: Replace `<div id="status-toast" />` with `<Toast id="status-toast" />` and add state, `window.addEventListener('algorecall-undo-toast', ...)`, a 5-second auto-hide timer, and an `#undo-action-btn` click handler in `DataApp`.
- **Dependencies**: `features/common/ui/components/Toast.tsx`.
- **Evidence**: `main:features/common/data/data.ts:729-767, 797-805` vs `preact:features/common/data/data.tsx:1120-1125, 1627-1629`.

---

#### GAP-004: Popup Quick Search lacks `tagRegistry` hydration & `MultiSelectControl`
- **Priority**: P1
- **Category**: Behavior Mismatch / Missing Feature
- **Feature**: Popup Quick Search & Tag Filter (`#popup-tag-filter`, `.popup-tag`)
- **Main implementation**: `features/dashboard/popup/search.ts` (`QuickSearchComponent.load`, `renderQuickSearch`)
- **Relevant symbols**: `PopupApp`, `QuickSearchComponent`, `TagRegistry.hydrate`, `MultiSelectControl`, `allTags`, `filteredCards`
- **Preact implementation**: `features/dashboard/popup/popup.tsx` (`PopupApp`)
- **Expected behavior**: Loads `tagRegistry` from `chrome.storage.local`, populates `#popup-tag-filter` with `{id, name}` entries from `tagRegistry`, enhances the filter with `MultiSelectControl` for multi-tag selection, hydrates `card.tags` via `TagRegistry.hydrate()` for search matching and `.popup-tag` badge rendering, and passes comma-separated tags to `data.html`.
- **Current Preact behavior**: `PopupApp` never loads `tagRegistry`; renders raw `card.tags` (UUIDs when tag registry is active) in the dropdown, tag pills, and search matching; supports only single-select `<select>`.
- **Identified gap**: Missing `tagRegistry` storage read, `TagRegistry.hydrate()` integration, and multi-tag selection UI.
- **Impact**: Users see raw tag UUIDs in the popup dropdown and search results, cannot search by tag name, and cannot filter by multiple tags.
- **Recommended implementation**: Load `tagRegistry` in `loadInitialData()`, hydrate `card.tags` with `TagRegistry.hydrate()`, populate options from `tagRegistry`, and integrate `MultiSelect` / `MultiSelectControl` for multi-tag filtering.
- **Dependencies**: `features/common/tags/tagRegistry.ts`, `features/common/ui/components/MultiSelect.tsx`.
- **Evidence**: `main:features/dashboard/popup/search.ts:62-97, 138-166, 185-205` vs `preact:features/dashboard/popup/popup.tsx:929-940, 1114-1142, 1686-1730`.

---

#### GAP-005: Popup achievement unlocks, `longestStreak`, and milestones never persisted or celebrated
- **Priority**: P1
- **Category**: Missing Feature / Persistence
- **Feature**: Popup gamification persistence (`longestStreak`, `unlockedAchievements`, `lastCelebratedMilestone`) and celebration toast + confetti
- **Main implementation**: `features/dashboard/popup/stats.ts` (`StatsComponent.load`)
- **Relevant symbols**: `PopupApp`, `StatsComponent`, `triggerConfetti`, `STREAK_MILESTONES`, `REVIEW_MILESTONES`, `milestoneToast`, `evalResult.newUnlocks`
- **Preact implementation**: `features/dashboard/popup/popup.tsx` (`PopupApp`)
- **Expected behavior**: (a) Persist `longestStreak` to storage when `effectiveLongestStreak > storedLongestStreak`; (b) Persist `unlockedAchievements` when `evalResult.newUnlocks.length > 0` and trigger milestone toast + confetti; (c) Check `STREAK_MILESTONES` / `REVIEW_MILESTONES` against `lastCelebratedMilestone`, persist `lastCelebratedMilestone`, and trigger milestone toast + confetti.
- **Current Preact behavior**: `popup.tsx` imports `triggerConfetti`, `STREAK_MILESTONES`, `REVIEW_MILESTONES` and declares `milestoneToast` state, but never invokes or updates them; `evalResult.newUnlocks` and `lastCelebratedMilestone` are ignored; `longestStreak` is never written back to storage.
- **Identified gap**: Gamification persistence and celebration side effects were omitted during the `PopupApp` rewrite.
- **Impact**: New achievement unlocks are never saved, `longestStreak` can be lost if activity history ages out, and milestone/achievement toast + confetti celebrations never fire.
- **Recommended implementation**: Add a `useEffect` in `PopupApp` (guarded by initial load completion) to persist `longestStreak`, `unlockedAchievements`, and `lastCelebratedMilestone` to `chrome.storage.local`, and trigger `setMilestoneToast` + `triggerConfetti()`.
- **Dependencies**: `features/dashboard/popup/achievements.ts`, `features/dashboard/popup/stats.tsx` (`triggerConfetti`, milestone constants).
- **Evidence**: `main:features/dashboard/popup/stats.ts:239-243, 276-283, 320-350` vs `preact:features/dashboard/popup/popup.tsx:910, 916, 935-936, 1042, 1090-1104, 2034-2036`.

---

#### GAP-006: Heatmap cascading year/month filter change does not reset `selectedMonth`/`selectedDay`
- **Priority**: P1
- **Category**: Behavior Mismatch / Filter State
- **Feature**: Heatmap date filter cascade (`lifetime`, `year-wise`, `month-wise`, `day-wise`)
- **Main implementation**: `features/dashboard/heatmap/heatmap.ts` (`HeatmapDashboard.setupFilters`, `updateMonthDropdown`, `updateDayDropdown`)
- **Relevant symbols**: `HeatmapApp`, `HeatmapFilterBar`, `selectedYear`, `selectedMonth`, `selectedDay`, `onYearChange`, `onMonthChange`
- **Preact implementation**: `features/dashboard/heatmap/heatmap.tsx` (`HeatmapApp`)
- **Expected behavior**: Changing year resets `monthSelect.value` to `currentMonth` (if valid in the new year's options) or `options[0].value`, and cascades to `daySelect` similarly.
- **Current Preact behavior**: `onYearChange` only calls `setSelectedYear`; `selectedMonth` and `selectedDay` can retain stale values not present in the newly computed `months`/`days` options, causing a mismatch between the `<select>` UI and the rendered grid.
- **Identified gap**: Missing cascading state clamp/reset when parent filter (`selectedYear` or `selectedMonth`) changes.
- **Impact**: Selecting an older year/month in `month-wise` or `day-wise` mode can render the wrong month/day grid.
- **Recommended implementation**: Add a `useEffect` (or update inside `onYearChange`/`onMonthChange`) to clamp `selectedMonth` into valid `months` and `selectedDay` into valid `days` using `main`'s fallback rule.
- **Dependencies**: None.
- **Evidence**: `main:features/dashboard/heatmap/heatmap.ts:83-143` vs `preact:features/dashboard/heatmap/heatmap.tsx:252-275, 416-418`.

---

#### GAP-007: Forecast "Peak Day" summary card includes Today/overdue cards
- **Priority**: P1
- **Category**: Behavior Mismatch / Calculation
- **Feature**: Forecast "Peak Day" summary KPI card
- **Main implementation**: `features/dashboard/forecast/forecast.ts` (`ForecastDashboard.renderForecast`)
- **Relevant symbols**: `ForecastApp`, `ForecastSummaryCards`, `renderForecast`, `peakCount`
- **Preact implementation**: `features/dashboard/forecast/forecast.tsx` (`ForecastApp`)
- **Expected behavior**: `peakCount` for the summary card is computed with `if (i > 0 && count > peakCount)` (excluding Today + past-due backlog), while `maxVal` for the chart scaling includes `i === 0`.
- **Current Preact behavior**: `ForecastApp` uses `if (count > peak) peak = count` across all indices `i >= 0` for both chart scaling and the summary card.
- **Identified gap**: Summary Peak Day calculation does not exclude `i === 0` (Today/overdue).
- **Impact**: Overdue backlog inflates the "Peak Day" summary card instead of showing the busiest upcoming future day.
- **Recommended implementation**: Track `summaryPeak` (`i > 0`) separately from `chartMaxVal` (`i >= 0`) in `ForecastApp`.
- **Dependencies**: None.
- **Evidence**: `main:features/dashboard/forecast/forecast.ts:93-95` vs `preact:features/dashboard/forecast/forecast.tsx:321`.

---

#### GAP-008: Pomodoro missing `document.title` countdown, and `start()` misses `timeRemaining === 0` reset & `startVisualInterval()`
- **Priority**: P1
- **Category**: Missing Feature / Behavior Mismatch
- **Feature**: Pomodoro browser tab title countdown and `PomodoroTimer.start()` lifecycle
- **Main implementation**: `features/dashboard/pomodoro/pomodoro.ts` (`PomodoroTimer.start`, `updateDisplay`)
- **Relevant symbols**: `PomodoroApp`, `PomodoroTimer.start`, `updateDisplay`, `startVisualInterval`, `timeRemaining`
- **Preact implementation**: `features/dashboard/pomodoro/pomodoro.tsx` (`PomodoroApp`, `PomodoroTimer.start`, `updateDisplay`)
- **Expected behavior**: (a) `updateDisplay` sets `document.title = \`${timeStr} — AlgoRecall Pomodoro\``; (b) `start()` resets `timeRemaining = getPhaseDuration() * 60` when `timeRemaining === 0` and explicitly calls `this.startVisualInterval()`.
- **Current Preact behavior**: (a) `document.title` remains static; (b) `PomodoroTimer.start()` omits both the `timeRemaining === 0` guard and `this.startVisualInterval()`, relying solely on `chrome.storage.onChanged` -> `syncState()` to start the visual interval.
- **Identified gap**: Missing `document.title` effect and missing direct interval/reset guards in `start()`.
- **Impact**: Users cannot see the live countdown in the browser tab title; if `timeRemaining === 0` or `storage.onChanged` is delayed/mocked, `start()` will not tick.
- **Recommended implementation**: Update `document.title` in `PomodoroApp` via `useEffect`, and restore the `timeRemaining === 0` reset + `this.startVisualInterval()` call in `PomodoroTimer.start()`.
- **Dependencies**: None.
- **Evidence**: `main:features/dashboard/pomodoro/pomodoro.ts:366-378, 583` vs `preact:features/dashboard/pomodoro/pomodoro.tsx:400-444, 954-972, 1115`.

---

### P2 (Medium Priority)

#### GAP-009: `ActionService.checkDueReviews` drops `getDueCardsCount`
- **Priority**: P2
- **Category**: Behavior Mismatch / Common Services
- **Feature**: `ActionService.checkDueReviews` due card count reporting
- **Main implementation**: `features/common/services/actionService.ts` (`ActionExecutionOptions`, `checkDueReviews`), `background/background.ts` (`handleCommand`)
- **Relevant symbols**: `ActionService`, `ActionExecutionOptions`, `checkDueReviews`, `getDueCardsCount`, `updateDueCardsBadge`
- **Preact implementation**: `features/common/services/actionService.ts`, `background/background.ts` (`handleCommand`)
- **Expected behavior**: `ActionExecutionOptions.background` accepts `getDueCardsCount?: () => Promise<number>` (with storage fallback) so `checkDueReviews` returns the actual due card count even when `updateDueCardsBadge()` returns `0` (e.g., Pomodoro active or `badgeEnabled`/`showDueBadge` is false).
- **Current Preact behavior**: `getDueCardsCount` was removed from `ActionExecutionOptions.background` and `handleCommand`; `checkDueReviews` requires `updateDueCardsBadge` and returns its result directly (`return await options.background.updateDueCardsBadge()`). (Note: `handleMessage` `check_due_cards_now` at `background.ts:448-450` still falls back to `getDueCardsCount()`.)
- **Identified gap**: Removal of `getDueCardsCount` option and fallback in `ActionService.checkDueReviews`.
- **Impact**: Any caller of `ActionService.executeAction('check-due-reviews', { background })` receives `dueCount: 0` during Pomodoro sessions or when the toolbar badge is disabled.
- **Recommended implementation**: Restore `getDueCardsCount?: () => Promise<number>` on `ActionExecutionOptions.background` and in `checkDueReviews`, and pass `getDueCardsCount: this.getDueCardsCount.bind(this)` in `background/background.ts:157-162`.
- **Dependencies**: None.
- **Evidence**: `main:features/common/services/actionService.ts:56-65, 275-294` vs `preact:features/common/services/actionService.ts:55-62, 274-278` and `preact:background/background.ts:157-162`.

---

#### GAP-010: Data Manager `bulkReschedule` missing `confirm()` prompt
- **Priority**: P2
- **Category**: Behavior Mismatch / Data Safety
- **Feature**: Data Manager bulk reschedule action
- **Main implementation**: `features/common/data/data.ts` (`bulkReschedule`)
- **Relevant symbols**: `FSRSDataDashboard.bulkReschedule`
- **Preact implementation**: `features/common/data/data.tsx` (`FSRSDataDashboard.bulkReschedule`)
- **Expected behavior**: Prompts `confirm("Reschedule N selected card(s) to be due now?...")` before mutating `card.due = now`.
- **Current Preact behavior**: Immediately mutates `card.due = now` and writes to storage with no confirmation dialog.
- **Identified gap**: Missing `confirm()` guard before destructive/bulk schedule mutation.
- **Impact**: An accidental single click immediately resets due dates for all selected cards.
- **Recommended implementation**: Restore the `if (!confirm(...)) return;` guard in `FSRSDataDashboard.bulkReschedule`.
- **Dependencies**: None.
- **Evidence**: `main:features/common/data/data.ts:860-874` vs `preact:features/common/data/data.tsx:1722-1742`.

---

#### GAP-011: Data Manager `created-asc` sort option unimplemented in `sortCards`
- **Priority**: P2
- **Category**: Missing Feature
- **Feature**: Data Manager "Created (Oldest)" sort option
- **Main implementation**: `features/common/data/data.ts` (`sortCards`)
- **Relevant symbols**: `DataApp`, `FSRSDataDashboard.sortCards`, `created-asc`
- **Preact implementation**: `features/common/data/data.tsx` (`DataApp`, `FSRSDataDashboard.sortCards`)
- **Expected behavior**: Selecting `<option value="created-asc">` ("Created (Oldest)") sorts cards ascending by creation timestamp.
- **Current Preact behavior**: `<option value="created-asc">` is rendered in `DataApp`, but `sortCards` only handles `created-desc` and falls through to `default: return sorted`.
- **Identified gap**: Missing `case 'created-asc':` branch in `sortCards`.
- **Impact**: Selecting "Created (Oldest)" has no effect on card order.
- **Recommended implementation**: Add `case 'created-asc':` to `FSRSDataDashboard.sortCards`.
- **Dependencies**: None.
- **Evidence**: `main:features/common/data/data.ts:713-723` vs `preact:features/common/data/data.tsx:957, 1607-1615`.

---

#### GAP-012: Data Manager `history` view title & `forecast` date formatting missing
- **Priority**: P2
- **Category**: Behavior Mismatch / UI
- **Feature**: Data Manager URL drill-down view titles (`?view=history&date=...`, `?view=forecast&date=...`)
- **Main implementation**: `features/common/data/data.ts`
- **Relevant symbols**: `DataApp`, `dashboard.targetDate`, `view`
- **Preact implementation**: `features/common/data/data.tsx` (`DataApp`)
- **Expected behavior**: `view=history&date=...` sets the page title to `"Activity for <Month Year / Full Date>"`, and `view=forecast&date=...` formats the date using `toLocaleDateString(...)`.
- **Current Preact behavior**: `DataApp` has no `view === 'history'` branch (falls back to `"Total Saved Patterns"`) and renders raw `dashboard.targetDate` for `forecast`.
- **Identified gap**: Missing `history` title branch and `forecast` date localization in `DataApp`.
- **Impact**: Incorrect or unformatted page titles when drilling down from History or Forecast pages.
- **Recommended implementation**: Port `main`'s `history` and `forecast` title/subtitle formatting logic into `DataApp`.
- **Dependencies**: None.
- **Evidence**: `main:features/common/data/data.ts:536-578` vs `preact:features/common/data/data.tsx:710-724`.

---

#### GAP-013: Settings custom interval `onInput` snaps empty input back to `60` (and default fallback `'45'`)
- **Priority**: P2
- **Category**: Behavior Mismatch / Input UX
- **Feature**: Settings Notification custom interval input (`#custom-interval-input`)
- **Main implementation**: `features/common/settings/settings.ts`
- **Relevant symbols**: `NotificationsPanel`, `handleCustomIntervalChange`, `customInterval`
- **Preact implementation**: `features/common/settings/settings.tsx` (`NotificationsPanel`)
- **Expected behavior**: Users can clear and type a custom minute interval smoothly; empty/invalid input falls back to `'60'` on save without fighting typing.
- **Current Preact behavior**: `customValue` is controlled by `settings.customInterval`, and `onInput={handleCustomIntervalChange}` immediately coerces `NaN`/empty to `60`, overwriting the input while typing. Additionally, default fallback changed from `'60'` to `'45'`.
- **Identified gap**: Controlled `onInput` coercion interrupts typing and default fallback value changed.
- **Impact**: Difficult to clear and type multi-digit custom intervals.
- **Recommended implementation**: Maintain local draft string state for `#custom-interval-input`, commit the parsed value on `onBlur` / valid `onChange`, and restore `'60'` as the default fallback.
- **Dependencies**: None.
- **Evidence**: `main:features/common/settings/settings.ts:399-407` vs `preact:features/common/settings/settings.tsx:253, 274-279, 369-372`.

---

#### GAP-014: Tracker missing post-review feedback banner (`showReviewFeedback` / `#fsrs-feedback-banner`)
- **Priority**: P2
- **Category**: Missing Feature (UI/UX)
- **Feature**: Tracker post-review daily goal / review-saved feedback banner
- **Main implementation**: `features/tracker/tracker.ts` (`showReviewFeedback`), `features/highlighter/style.css` (`.fsrs-feedback-banner`)
- **Relevant symbols**: `TrackerApp`, `Tracker.handleRating`, `showReviewFeedback`, `#fsrs-feedback-banner`
- **Preact implementation**: `features/tracker/tracker.tsx` (`TrackerApp`, `handleRating`), `features/highlighter/style.css`
- **Expected behavior**: Displays `#fsrs-feedback-banner` with daily review count / goal progress for 2.5 seconds after rating a card.
- **Current Preact behavior**: `TrackerApp`, `handleRating`, and `style.css` omit `#fsrs-feedback-banner`, `showReviewFeedback()`, and `.fsrs-feedback-banner` CSS rules.
- **Identified gap**: Post-review feedback banner and its styles were dropped.
- **Impact**: Users receive no daily goal or review-saved feedback banner after rating a card in review mode.
- **Recommended implementation**: Restore `#fsrs-feedback-banner` in `TrackerApp`, implement `showReviewFeedback()` in `Tracker` (called from `handleRating`), and restore `.fsrs-feedback-banner` CSS in `features/highlighter/style.css`.
- **Dependencies**: None.
- **Evidence**: `main:features/tracker/tracker.ts:255-304, 545, 1487` and `main:features/highlighter/style.css:1109-1124` vs `preact:features/tracker/tracker.tsx:1115-1285, 1970-1995`.

---

#### GAP-015: Tracker missing `Tab`/`Shift+Tab` focus trap in modal dialog
- **Priority**: P2
- **Category**: Missing Feature (Accessibility)
- **Feature**: Tracker modal dialog (`#algo-fsrs-container`) keyboard focus trap
- **Main implementation**: `features/tracker/tracker.ts`
- **Relevant symbols**: `handleContainerKeyDown`, `#algo-fsrs-container`
- **Preact implementation**: `features/tracker/tracker.tsx` (`handleContainerKeyDown`)
- **Expected behavior**: `Tab` and `Shift+Tab` cycle focus within `#algo-fsrs-container` while the modal is open.
- **Current Preact behavior**: `handleContainerKeyDown` only handles `Escape` to close the modal.
- **Identified gap**: Missing `Tab`/`Shift+Tab` focus cycling logic.
- **Impact**: Keyboard users can tab out of the `aria-modal="true"` dialog onto the underlying host page.
- **Recommended implementation**: Restore `Tab`/`Shift+Tab` focusable-element cycling inside `handleContainerKeyDown`.
- **Dependencies**: None.
- **Evidence**: `main:features/tracker/tracker.ts:718-744` vs `preact:features/tracker/tracker.tsx:1044-1049`.

---

#### GAP-016: FSRS Config tag profile keys lowercased on save, breaking case-sensitive lookup in Tracker
- **Priority**: P2
- **Category**: Behavior Mismatch
- **Feature**: Tag-specific FSRS weight profiles (`fsrsTopicWeights`)
- **Main implementation**: `features/tracker/config/fsrsConfig.ts`
- **Relevant symbols**: `fsrsTopicWeights`, `topicWeights`, `Tracker`
- **Preact implementation**: `features/tracker/config/fsrsConfig.tsx`, `features/tracker/tracker.tsx`
- **Expected behavior**: `fsrsConfig` preserves tag casing (`tagInput.value.trim()`) when saving `fsrsTopicWeights` so `Tracker` (`this.state.topicWeights[tag]`) matches mixed-case tags.
- **Current Preact behavior**: `fsrsConfig.tsx` saves keys with `tag.trim().toLowerCase()`, while `Tracker` performs case-sensitive lookup (`this.state.topicWeights[tag]`).
- **Identified gap**: Key casing mismatch between writer (`fsrsConfig.tsx`) and reader (`tracker.tsx`).
- **Impact**: Custom FSRS weight profiles for mixed-case tags (e.g., `Dynamic Programming`) never match during review/rating.
- **Recommended implementation**: Preserve tag casing in `fsrsConfig.tsx` (`tag.trim()`) and/or normalize lookup case-insensitively in `Tracker`.
- **Dependencies**: None.
- **Evidence**: `main:features/tracker/config/fsrsConfig.ts:857` vs `preact:features/tracker/config/fsrsConfig.tsx:620, 1343` and `preact:features/tracker/tracker.tsx:1979, 2159`.

---

#### GAP-017: Highlighter deleting a highlight re-opens creation tooltip
- **Priority**: P2
- **Category**: Behavior Mismatch / Bug
- **Feature**: Highlighter mark deletion (`handleDelete` / `deleteHighlight`)
- **Main implementation**: `features/highlighter/highlighter.ts`
- **Relevant symbols**: `handleDelete`, `deleteHighlight`, `renderTooltipColors`, `hideTooltip`
- **Preact implementation**: `features/highlighter/highlighter.tsx` (`renderTooltipColors`, `handleDelete`, `deleteHighlight`)
- **Expected behavior**: Deleting an existing highlight hides the tooltip (`visible: false`) and keeps it closed.
- **Current Preact behavior**: `handleDelete` calls `deleteHighlight()` (which calls `hideTooltip()` -> `visible: false`), then immediately calls `this.renderTooltipColors()`, which unconditionally sets `visible: true`.
- **Identified gap**: `renderTooltipColors()` forces `visible: true` after `deleteHighlight()` hides the tooltip.
- **Impact**: Deleting an existing highlight immediately pops open an empty creation tooltip at the old coordinates.
- **Recommended implementation**: Remove the trailing `this.renderTooltipColors()` call in `handleDelete`, or pass `visible: false` / reset `existingMarkId: null` without showing the tooltip.
- **Dependencies**: None.
- **Evidence**: `main:features/highlighter/highlighter.ts:683-686, 1043-1046` vs `preact:features/highlighter/highlighter.tsx:940-950, 1063-1068, 1437`.

---

#### GAP-018: Highlighter `positionTooltip` uses hardcoded `200x40` dimensions when passed numeric coords
- **Priority**: P2
- **Category**: Behavior Mismatch / Positioning
- **Feature**: Highlighter tooltip viewport clamping and flipping (`positionTooltip`)
- **Main implementation**: `features/highlighter/highlighter.ts`
- **Relevant symbols**: `positionTooltip`, `HighlighterTooltipView`, `#algo-highlight-tooltip`
- **Preact implementation**: `features/highlighter/highlighter.tsx` (`positionTooltip`)
- **Expected behavior**: Measures actual `tooltip.getBoundingClientRect()` after rendering to clamp horizontally and flip above/below viewport edges accurately.
- **Current Preact behavior**: Receives numeric `(x, y, fallbackTop)` and uses hardcoded `width = 200, height = 40`.
- **Identified gap**: Hardcoded tooltip dimensions instead of measuring the rendered `#algo-highlight-tooltip` bounding box.
- **Impact**: Larger tooltips (especially existing-mark edit tooltips with notes/category/actions) can clip past right or bottom viewport edges.
- **Recommended implementation**: Measure `#algo-highlight-tooltip` via `getBoundingClientRect()` after render (or in `useLayoutEffect` inside `HighlighterTooltipView`) and clamp/flip accordingly.
- **Dependencies**: None.
- **Evidence**: `main:features/highlighter/highlighter.ts:356-374` vs `preact:features/highlighter/highlighter.tsx:713, 773, 843, 861-915`.

---

#### GAP-019: Popup "Goal Complete!" & "Inbox Zero" ignores `dueToday === 0` check
- **Priority**: P2
- **Category**: Behavior Mismatch / Logic
- **Feature**: Popup Daily Focus goal completion & Inbox Zero state
- **Main implementation**: `features/dashboard/popup/stats.ts` (`StatsComponent.load`, `renderGoalProgress`)
- **Relevant symbols**: `DailyFocusCard`, `isGoalMet`, `dueToday`, `completedToday`, `dailyGoalTarget`
- **Preact implementation**: `features/dashboard/popup/popup.tsx` (`DailyFocusCard`)
- **Expected behavior**: "Goal Complete!" / "Inbox Zero achieved!" only triggers when `dueToday === 0 && completedToday >= dailyGoalTarget`. When `completedToday > 0` and `dueToday > 0`, it displays `Keep going! ${dueToday} due remaining`.
- **Current Preact behavior**: `isGoalMet = dailyGoalTarget > 0 && completedToday >= dailyGoalTarget` ignores `dueToday`, showing `"Goal Complete!"` and `"All X reviews done! Inbox Zero achieved!"` even when due cards remain.
- **Identified gap**: Missing `dueCount === 0` condition in `isGoalMet`.
- **Impact**: Misleading "Inbox Zero" banner displayed while cards are still due.
- **Recommended implementation**: Pass `dueCount` into `DailyFocusCard` and gate Goal Complete / Inbox Zero on `dueCount === 0 && completedToday >= dailyGoalTarget`.
- **Dependencies**: None.
- **Evidence**: `main:features/dashboard/popup/stats.ts:297-301, 614-620` vs `preact:features/dashboard/popup/popup.tsx:261, 338-365, 434-458`.

---

#### GAP-020: Popup denied notification permission state not handled in warning banner
- **Priority**: P2
- **Category**: UI/UX Gap / Permissions
- **Feature**: Popup notification permission warning banner (`#enable-notifications-btn`)
- **Main implementation**: `features/dashboard/popup/notifications.ts` (`checkPermissions`)
- **Relevant symbols**: `PopupApp`, `notificationPermission`, `#enable-notifications-btn`
- **Preact implementation**: `features/dashboard/popup/popup.tsx` (`PopupApp`)
- **Expected behavior**: When `Notification.permission === 'denied'`, hides `#enable-notifications-btn` (`display: none`) and updates banner text to `"⚠️ Notifications blocked. Enable them in settings for reminders."`.
- **Current Preact behavior**: `#enable-notifications-btn` remains visible and text remains `"Reminders work best with notifications enabled."` when permission is `'denied'`.
- **Identified gap**: Missing `'denied'` permission branch in banner rendering.
- **Impact**: Clicking "Enable" does nothing in browsers once notification permission has been denied.
- **Recommended implementation**: Conditionally render the blocked message and hide `#enable-notifications-btn` when `notificationPermission === 'denied'`.
- **Dependencies**: None.
- **Evidence**: `main:features/dashboard/popup/notifications.ts:56-66` vs `preact:features/dashboard/popup/popup.tsx:1560-1579`.

---

#### GAP-021: Popup rating prompt text & button label bypass `BROWSER_CONFIG` strings
- **Priority**: P2
- **Category**: Behavior Mismatch / Cross-Browser
- **Feature**: Popup Rating Prompt banner (`#rating-prompt-text`, `#rate-store-label`)
- **Main implementation**: `features/dashboard/popup/rating.ts` (`RatingComponent.load`)
- **Relevant symbols**: `PopupApp`, `BROWSER_CONFIG.ratingPromptText`, `BROWSER_CONFIG.ratingButtonLabel`
- **Preact implementation**: `features/dashboard/popup/popup.tsx` (`PopupApp`)
- **Expected behavior**: `#rating-prompt-text` uses `BROWSER_CONFIG.ratingPromptText` and `#rate-store-label` uses `BROWSER_CONFIG.ratingButtonLabel`.
- **Current Preact behavior**: Hardcodes `"Rate us 5 stars to help us grow!"` and `"Rate on {BROWSER_CONFIG.storeName}"` (e.g., `"Rate on App Store"` instead of `"Rate on the App Store"`).
- **Identified gap**: Hardcoded strings instead of `BROWSER_CONFIG` metadata.
- **Impact**: Minor copy inconsistency across Chrome, Firefox, and Safari store prompts.
- **Recommended implementation**: Use `{BROWSER_CONFIG.ratingPromptText}` and `{BROWSER_CONFIG.ratingButtonLabel}` in `popup.tsx:1592, 1606`.
- **Dependencies**: `features/common/browserConfig.ts`.
- **Evidence**: `main:features/dashboard/popup/rating.ts:70-76` vs `preact:features/dashboard/popup/popup.tsx:1592, 1606`.

---

#### GAP-022: Heatmap missing auto-scroll to right in `lifetime` mode
- **Priority**: P2
- **Category**: UI/UX Gap
- **Feature**: Heatmap `lifetime` horizontal scroll position
- **Main implementation**: `features/dashboard/heatmap/heatmap.ts` (`renderHeatmap`)
- **Relevant symbols**: `HeatmapApp`, `.heatmap-wrapper`, `filterType`
- **Preact implementation**: `features/dashboard/heatmap/heatmap.tsx` (`HeatmapApp`)
- **Expected behavior**: Scrolls `.heatmap-wrapper` to `scrollLeft = scrollWidth` after rendering in `lifetime` mode so the most recent dates are visible.
- **Current Preact behavior**: Omits the scroll-to-right effect.
- **Identified gap**: Missing `useRef` + `useEffect` scroll adjustment on `lifetime` render.
- **Impact**: Lifetime heatmap opens scrolled to the oldest dates on the far left.
- **Recommended implementation**: Add a `useRef` on `.heatmap-wrapper` and a `useEffect` setting `scrollLeft = scrollWidth` when `filterType === 'lifetime'` and `cells` update.
- **Dependencies**: None.
- **Evidence**: `main:features/dashboard/heatmap/heatmap.ts:293-296` vs `preact:features/dashboard/heatmap/heatmap.tsx:422`.

---

#### GAP-023: Heatmap nested `.stats-grid` breaks 4-column KPI layout
- **Priority**: P2
- **Category**: UI/UX Gap / Layout Regression
- **Feature**: Heatmap streak & activity KPI cards grid
- **Main implementation**: `features/dashboard/heatmap/heatmap.html`, `features/dashboard/heatmap/heatmap-stats.ts`
- **Relevant symbols**: `HeatmapApp`, `HeatmapStatsDashboard`, `#heatmap-stats-container`, `.stats-grid`
- **Preact implementation**: `features/dashboard/heatmap/heatmap.tsx`, `features/dashboard/heatmap/heatmap-stats.tsx`
- **Expected behavior**: `#heatmap-stats-container.stats-grid` contains 4 `.stats-card` children directly.
- **Current Preact behavior**: `HeatmapApp` renders `<div id="heatmap-stats-container" className="stats-grid">` containing `<HeatmapStatsDashboard>`, which renders a second `<div className="stats-grid">`.
- **Identified gap**: Nested `.stats-grid` wrapper.
- **Impact**: The inner `.stats-grid` becomes a single grid item in column 1 of the outer `.stats-grid`, potentially collapsing the 4 KPI cards.
- **Recommended implementation**: Remove `className="stats-grid"` from `#heatmap-stats-container` in `heatmap.tsx:437` (or return a Fragment in `HeatmapStatsDashboard`).
- **Dependencies**: None.
- **Evidence**: `main:features/dashboard/heatmap/heatmap.html:88` and `main:features/dashboard/heatmap/heatmap-stats.ts:47-88` vs `preact:features/dashboard/heatmap/heatmap.tsx:437-439` and `preact:features/dashboard/heatmap/heatmap-stats.tsx:74`.

---

#### GAP-024: Forecast day-offset uses `Math.floor(diffMs / 86400000)` instead of local-midnight normalization (`Math.round`)
- **Priority**: P2
- **Category**: Behavior Mismatch / Calculation
- **Feature**: Forecast 30-day due date bucketing
- **Main implementation**: `features/dashboard/forecast/forecast.ts`
- **Relevant symbols**: `ForecastApp`, `ForecastDashboard`, `dueDay`, `todayStart`
- **Preact implementation**: `features/dashboard/forecast/forecast.tsx` (`ForecastApp`)
- **Expected behavior**: Normalizes `card.due` to local midnight (`dueDay`) and computes `Math.round((dueDay - todayStart) / 86400000)`.
- **Current Preact behavior**: Computes `Math.floor((card.due - todayStartTime) / 86400000)`.
- **Identified gap**: Missing local-midnight normalization and `Math.round`.
- **Impact**: Off-by-one day bucket errors during Daylight Saving Time (DST) transitions.
- **Recommended implementation**: Port `main`'s `dueDay` local-midnight normalization and `Math.round` into `ForecastApp`.
- **Dependencies**: None.
- **Evidence**: `main:features/dashboard/forecast/forecast.ts:71-74` vs `preact:features/dashboard/forecast/forecast.tsx:305-307`.

---

#### GAP-025: StudyPlan preview "Total Patterns" ignores `dailyLimit` cap, and `examDate` persists across deactivate/reactivate
- **Priority**: P2
- **Category**: Behavior Mismatch / Calculation & Stale UI State
- **Feature**: Study Plan setup preview and deactivation reset
- **Main implementation**: `features/dashboard/studyplan/studyplan.ts` (`updatePreview`)
- **Relevant symbols**: `StudyPlanApp`, `StudyPlanSetupPanel`, `handleDeactivate`, `examDate`, `dailyLimit`, `preview`
- **Preact implementation**: `features/dashboard/studyplan/studyplan.tsx` (`StudyPlanApp`)
- **Expected behavior**: (a) When `dailyLimit < Math.ceil(total / days)`, `#preview-total` displays `dailyTarget * daysLeft`; (b) Deactivating resets `examDate` and `dailyLimit` state so the remounted `StudyPlanSetupPanel` starts clean.
- **Current Preact behavior**: (a) `preview.total` always displays `allCards.length`; (b) `examDate` state is never cleared in `handleDeactivate`, while `StudyPlanSetupPanel` remounts with an empty `<input type="date">`, leaving `#activate-btn` enabled for the stale date.
- **Identified gap**: Capped preview total calculation omitted and state not reset on deactivation.
- **Impact**: Misleading preview total when daily limit caps completion; accidental reactivation with an old exam date.
- **Recommended implementation**: Return `willFinish ? total : target * days` in `preview.total`, and reset `examDate`/`dailyLimit` state inside `handleDeactivate`.
- **Dependencies**: None.
- **Evidence**: `main:features/dashboard/studyplan/studyplan.ts:158-172` vs `preact:features/dashboard/studyplan/studyplan.tsx:334, 357-368, 384-386, 445`.

---

#### GAP-026: History `aggregateByYear`/`Month`/`Day` fall back to `activityData` when `allCards` has 0 matching logs for period
- **Priority**: P2
- **Category**: Behavior Mismatch
- **Feature**: History period aggregation (`aggregateByYear`, `aggregateByMonth`, `aggregateByDay`)
- **Main implementation**: `features/dashboard/history/history.ts`
- **Relevant symbols**: `FSRSHistoryDashboard`, `aggregateByYear`, `aggregateByMonth`, `aggregateByDay`, `allCards`, `activityData`
- **Preact implementation**: `features/dashboard/history/history.tsx` (`FSRSHistoryDashboard`)
- **Expected behavior**: Returns `months`/`days` directly when `this.allCards.length > 0`, even if the derived map is `{}`.
- **Current Preact behavior**: Checks `if (Object.keys(...).length > 0) return ...;` and otherwise falls through to `this.activityData`.
- **Identified gap**: Conditional fallback to `activityData` when `allCards` is non-empty but has 0 logs for the selected period.
- **Impact**: If `activityData` contains stale keys not present in `allCards`, empty periods can display stale counts.
- **Recommended implementation**: Return the `allCards`-derived map unconditionally whenever `this.allCards.length > 0`, matching `main`.
- **Dependencies**: None.
- **Evidence**: `main:features/dashboard/history/history.ts:578-583, 624-629` vs `preact:features/dashboard/history/history.tsx:841-843, 894-896, 947-949`.

---

### P3 (Low Priority / Polish)

#### GAP-027: Settings, Welcome, Websites, and Data Manager minor UI/error-handling/copy gaps
- **Priority**: P3
- **Category**: UI Polish / Copy / Error Handling
- **Feature**: Minor parity items across Common UI pages
- **Main implementation**: `features/common/settings/settings.ts`, `features/common/welcome/welcome.ts`, `features/common/welcome/welcome.html`, `features/common/websites/websites.ts`, `features/common/data/data.ts`
- **Relevant symbols**: `AboutPanel`, `OnboardingWelcome`, `StepIndicators`, `WhitelistedWebsitesManager`, `FSRSDataDashboard.bulkRetag`
- **Preact implementation**: `features/common/settings/settings.tsx`, `features/common/welcome/welcome.tsx`, `features/common/websites/websites.tsx`, `features/common/data/data.tsx`
- **Expected behavior**: (a) Settings AboutPanel uses `Rate on ${BROWSER_CONFIG.storeName}`; (b) Welcome `.notif-status-row` uses `alignItems: 'center'`, `StepIndicators` handles `Enter`/`Space` `onKeyDown`, `#start-practicing-btn` remains commented out as in `main`; (c) Welcome & Websites call `UIUtils.checkStorageError` in storage/permission/scripting callbacks; (d) `bulkRetag` prompt includes `"for N selected card(s) (comma-separated). This will REPLACE existing tags:"`.
- **Current Preact behavior**: (a) `settings.tsx:1057` hardcodes `"Rate on Web Store"`; (b) `welcome.tsx:364` uses `alignSelf: 'center'`, `welcome.tsx:48-50` lacks `onKeyDown`, `welcome.tsx:418-427` uncomments `#start-practicing-btn`; (c) `welcome.tsx:225-238` and `websites.tsx:157-260` omit `checkStorageError`; (d) `data.tsx:1702` shortens `bulkRetag` prompt to `"Enter new tags:"`.
- **Identified gap**: Minor copy, CSS property, keyboard a11y, and storage error-check omissions.
- **Impact**: Low (cosmetic and edge-case error reporting).
- **Recommended implementation**: Align each item with `main` (`BROWSER_CONFIG.storeName`, `alignItems: 'center'`, `onKeyDown`, `checkStorageError`, full `bulkRetag` prompt).
- **Dependencies**: None.
- **Evidence**: `preact:features/common/settings/settings.tsx:1057`, `welcome.tsx:48-50, 225-238, 364, 418-427`, `websites.tsx:157-260`, `data.tsx:1702`.

---

#### GAP-028: FSRS Config `saveParamsToStorage` overwrites `fsrsGlobalParams` metadata
- **Priority**: P3
- **Category**: Behavior Mismatch / Storage Metadata
- **Feature**: FSRS Config parameter persistence (`fsrsGlobalParams`)
- **Main implementation**: `features/tracker/config/fsrsConfig.ts`
- **Relevant symbols**: `saveParamsToStorage`, `fsrsGlobalParams`
- **Preact implementation**: `features/tracker/config/fsrsConfig.tsx` (`saveParamsToStorage`)
- **Expected behavior**: Merges `...existing` when saving `fsrsGlobalParams`, preserving `version: 'personalized'` and `timestamp`.
- **Current Preact behavior**: Overwrites `fsrsGlobalParams` directly, dropping `version` and `timestamp`.
- **Identified gap**: Missing spread of existing `fsrsGlobalParams` metadata.
- **Impact**: Low (metadata fields lost on subsequent saves).
- **Recommended implementation**: Read and spread existing `fsrsGlobalParams` before calling `chrome.storage.local.set`.
- **Dependencies**: None.
- **Evidence**: `main:features/tracker/config/fsrsConfig.ts:695-707` vs `preact:features/tracker/config/fsrsConfig.tsx:514-528, 539-544`.

---

#### GAP-029: Editor `handleTogglePreview` omits textarea focus on Preview->Edit
- **Priority**: P3
- **Category**: Behavior Mismatch (Minor UX)
- **Feature**: Markdown Editor Preview/Edit toggle
- **Main implementation**: `features/tracker/editor/editor.ts`
- **Relevant symbols**: `handleTogglePreview`, `textareaRef`
- **Preact implementation**: `features/tracker/editor/editor.tsx` (`handleTogglePreview`)
- **Expected behavior**: Focuses the editor textarea when switching from Preview mode back to Edit mode.
- **Current Preact behavior**: Toggles `isPreviewMode` to `false` without focusing `textareaRef.current`.
- **Identified gap**: Missing `textareaRef.current?.focus()` call.
- **Impact**: Low (requires an extra click to start typing after previewing).
- **Recommended implementation**: Focus `textareaRef.current` after switching `isPreviewMode` to `false`.
- **Dependencies**: None.
- **Evidence**: `main:features/tracker/editor/editor.ts:276` vs `preact:features/tracker/editor/editor.tsx:697-709`.

---

#### GAP-030: Highlights Manager search query not trimmed
- **Priority**: P3
- **Category**: Behavior Mismatch (Minor UX)
- **Feature**: Highlights Manager search input
- **Main implementation**: `features/highlighter/manager/highlights.ts`
- **Relevant symbols**: `searchQuery`
- **Preact implementation**: `features/highlighter/manager/highlights.tsx`
- **Expected behavior**: Trims leading/trailing whitespace from the search query (`val.trim()`).
- **Current Preact behavior**: Updates `searchQuery` with raw untrimmed input.
- **Identified gap**: Missing `.trim()` on search input update.
- **Impact**: Low (leading/trailing spaces can cause unexpected empty search results).
- **Recommended implementation**: Use `val.trim()` when updating `searchQuery` in `highlights.tsx:509-510`.
- **Dependencies**: None.
- **Evidence**: `main:features/highlighter/manager/highlights.ts:100` vs `preact:features/highlighter/manager/highlights.tsx:509-510`.

---

#### GAP-031: Popup debug log export, Check Now button disable, modal/goal autofocus & `aria-hidden`, test-only `heatmap.tsx` auto-scroll
- **Priority**: P3
- **Category**: UX / Accessibility / Downloads
- **Feature**: Popup debug log export, Check Now button state, modal/goal focus & ARIA, test-only heatmap
- **Main implementation**: `features/dashboard/popup/popup.ts`, `features/dashboard/popup/stats.ts`, `features/dashboard/popup/heatmap.ts`
- **Relevant symbols**: `handleExportLogs`, `#check-now-btn`, `#goal-input`, `#achievements-modal`, `#close-achievements-btn`
- **Preact implementation**: `features/dashboard/popup/popup.tsx`, `features/dashboard/popup/heatmap.tsx` (test-only)
- **Expected behavior**: (a) Empty logs show error toast (`isError=true`), export uses NDJSON with `saveAs: true` and `URL.revokeObjectURL(url)`; (b) `#check-now-btn` is disabled while `check_due_cards_now` is in flight; (c) `#goal-input` autofocuses on open, `#achievements-modal` sets `aria-hidden` and focuses `#close-achievements-btn`; (d) `heatmap.tsx` auto-scrolls right.
- **Current Preact behavior**: (a) Empty logs show `isError=false`, exports pretty JSON, omits `saveAs: true` and `URL.revokeObjectURL`; (b) `#check-now-btn` stays enabled in-flight; (c) `#goal-input` and `#close-achievements-btn` lack autofocus, `#achievements-modal` lacks `aria-hidden`; (d) test-only `heatmap.tsx` lacks `scrollLeft = scrollWidth` (note: `popup.tsx:1195-1199` *does* have it).
- **Identified gap**: Minor UX, memory-cleanup, and accessibility differences.
- **Impact**: Low.
- **Recommended implementation**: Match `main`'s `isError=true`, NDJSON/`saveAs`/`revokeObjectURL`, in-flight button disable, and focus/`aria-hidden` handling.
- **Dependencies**: None.
- **Evidence**: `main:features/dashboard/popup/popup.ts:371-404, 500-502` and `stats.ts:366, 419-421, 429` vs `preact:features/dashboard/popup/popup.tsx:385-396, 755-766, 1410-1436, 1474-1480` and `preact:features/dashboard/popup/heatmap.tsx:125, 190`.

---

#### GAP-032: Analytics missing tab `ErrorBoundary`, duplicate `#tab-*` DOM IDs, minor tooltip copy drift
- **Priority**: P3
- **Category**: Error Handling / DOM Hygiene / Copy
- **Feature**: Analytics SPA tab container resilience and markup parity
- **Main implementation**: `features/dashboard/analytics/analytics.ts`, `analytics.html`, `readiness.ts`, `memoryHealth.ts`
- **Relevant symbols**: `AnalyticsApp`, `ErrorBoundary`, `#tab-overview`, `#tab-readiness`, `#tab-memory`, `#tab-simulation`
- **Preact implementation**: `features/dashboard/analytics/analytics.tsx`, `overview.tsx`, `readiness.tsx`, `memory.tsx`, `futureMemorySimulation.tsx`, `memoryHealth.tsx`
- **Expected behavior**: (a) Tab rendering is wrapped in an error boundary rendering `.error-card` with Reload button on failure; (b) `#tab-*` IDs appear only once in the DOM; (c) Tooltips reference `"AlgoRecall Engine"`.
- **Current Preact behavior**: (a) No `ErrorBoundary` around tab components; (b) `analytics.tsx` and 4 child tab components both render `<div id="tab-*" className="tab-pane active">`; (c) `readiness.tsx:178` says `ts-fsrs` and `memoryHealth.tsx:61` says `FSRS Retrievability`.
- **Identified gap**: Missing `ErrorBoundary`, duplicate `#tab-*` IDs, and minor copy drift.
- **Impact**: Low (only affects runtime render crashes, DOM ID uniqueness, and tooltip wording).
- **Recommended implementation**: Wrap tab children in a Preact `ErrorBoundary`, remove duplicate outer `#tab-*` wrappers from the 4 child tab components, and align tooltip copy if desired.
- **Dependencies**: None.
- **Evidence**: `main:features/dashboard/analytics/analytics.ts:268-285` vs `preact:features/dashboard/analytics/analytics.tsx:377-399`, `overview.tsx:120`, `readiness.tsx:122, 178`, `memory.tsx:215`, `futureMemorySimulation.tsx:136`, `memoryHealth.tsx:61`.

---

#### GAP-033: Sub-pages minor a11y, `lastError` checks, Pomodoro formatting/input UX, unused `forecast.html` script
- **Priority**: P3
- **Category**: Accessibility / Error Handling / UX / Cleanup
- **Feature**: Minor parity details in History, Heatmap, Forecast, and Pomodoro sub-pages
- **Main implementation**: `features/dashboard/history/history.ts`, `heatmap/heatmap.ts`, `forecast/forecast.ts`, `forecast/forecast.html`, `pomodoro/pomodoro.ts`
- **Relevant symbols**: `HistoryBreadcrumb`, `HeatmapApp`, `ForecastApp`, `PomodoroApp`
- **Preact implementation**: `features/dashboard/history/history.tsx`, `heatmap/heatmap.tsx`, `forecast/forecast.tsx`, `forecast/forecast.html`, `pomodoro/pomodoro.tsx`
- **Expected behavior**: (a) `HistoryBreadcrumb` `.bc-year` / `.bc-month` handle `Enter`/`Space` `onKeyDown`; (b) `HeatmapApp` and `ForecastApp` check `chrome.runtime?.lastError` in `chrome.storage.local.get` callbacks; (c) `PomodoroApp` formats `60m` as `1h` (not `1h 0m`) and allows clearing number inputs without `|| 1` snapping on `onInput`; (d) `forecast.html` does not load unused `fsrsScheduler.bundle.js`.
- **Current Preact behavior**: (a) `onKeyDown` missing on breadcrumb items; (b) `lastError` checks omitted; (c) displays `1h 0m` and snaps empty number inputs to `1` via `|| 1`; (d) `forecast.html:15` loads unused `fsrsScheduler.bundle.js`.
- **Identified gap**: Minor a11y, error-checking, formatting, and script-tag cleanup gaps.
- **Impact**: Low.
- **Recommended implementation**: Add `onKeyDown` to `HistoryBreadcrumb`, restore `lastError` guards in `HeatmapApp`/`ForecastApp`, fix `todayFocusMinutes` formatting and draft number inputs in `PomodoroApp`, and remove the unused `<script>` tag from `forecast.html`.
- **Dependencies**: None.
- **Evidence**: `preact:features/dashboard/history/history.tsx:109, 121, 124`, `heatmap/heatmap.tsx:238-242`, `forecast/forecast.tsx:277-280`, `forecast/forecast.html:15`, `pomodoro/pomodoro.tsx:586-588, 613, 625, 637, 649`.

---

## 5. Feature Parity Matrix

| Feature / Module | Status | Notes |
|---|---|---|
| Manifests (`browser/{chrome,firefox,safari}/manifest.json`) | **Complete** | 0 diff vs `main`; `npm run check:isolation` 37/37 passed |
| Cross-Browser Config, Constants, Logger, Markdown, Types | **Complete** | 0 diff vs `main` |
| Theme Sync (`features/common/theme-sync.ts`) | **Complete** | Decorators replaced with inline `try/catch`; equivalent behavior |
| Build & Scripts (`webpack.config.js`, `tsconfig.json`, `package.json`, `scripts/`) | **Complete** | Preact 11 + TSX entries; `marked.min.js` still copied |
| Content Script Lifecycle & State (`content.ts`, `state.ts`, `utils.ts`) | **Complete** | Adds `isIgnoredMutationNode`, `popstate` listener, host container helpers |
| Content Notifications (`content/notifications.ts`) | **Complete** | Preact `NotificationToast` + `render(null, ...)` cleanup |
| Background Service Worker (`background/background.ts`) | **Behavior Mismatch** | `GAP-001` (P1): `source !== 'manual'` omitted from throttle check |
| Action Service (`features/common/services/actionService.ts`) | **Behavior Mismatch** | `GAP-009` (P2): `getDueCardsCount` removed from `checkDueReviews` |
| Backup Manager (`features/common/data/backupManager.ts`) | **Complete** | Decorators replaced with `try/catch`; identical logic |
| Data Manager (`features/common/data/data.tsx`) | **Partial** | `GAP-003` (P1), `GAP-010`/`011`/`012` (P2), `GAP-027` (P3) |
| Settings Hub (`features/common/settings/settings.tsx`) | **Partial** | `GAP-013` (P2), `GAP-027` (P3) |
| Help Center (`features/common/help/help.tsx`, `helpContent.tsx`) | **Partial** | `GAP-002` (P1): live search does not filter cards or highlight tabs |
| Onboarding Welcome (`features/common/welcome/welcome.tsx`) | **Complete** | Minor `GAP-027` (P3) polish items |
| Whitelisted Websites (`features/common/websites/websites.tsx`) | **Complete** | Minor `GAP-027` (P3) `checkStorageError` omission |
| Tag Manager (`features/common/tags/tags.tsx`, `tagRegistry.ts`) | **Complete** | Full parity + clickable card count links & loading/error states |
| Shared Utils & UI (`utils/`, `ui/`, `base.css`) | **Complete** | `Toggle`, `Toast`, `MultiSelect`, `useStorage`, `tagInput` |
| Popup — Header, Stats, Momentum, Mini Heatmap, Bento | **Complete** | Calculations, SVG rings, 12w/Lifetime heatmap, `fsrsGlobalParams` |
| Popup — Search, Gamification, Banners, Export | **Partial** | `GAP-004`/`005` (P1), `GAP-019`/`020`/`021` (P2), `GAP-031` (P3) |
| Analytics (`features/dashboard/analytics/*`) | **Complete** | Full calculation & SVG parity; `GAP-032` (P3) polish only |
| Heatmap Sub-Page (`features/dashboard/heatmap/*`) | **Partial** | `GAP-006` (P1), `GAP-022`/`023` (P2), `GAP-033` (P3) |
| History Sub-Page (`features/dashboard/history/*`) | **Partial** | `GAP-026` (P2), `GAP-033` (P3) |
| Forecast Sub-Page (`features/dashboard/forecast/*`) | **Partial** | `GAP-007` (P1), `GAP-024` (P2), `GAP-033` (P3) |
| Pomodoro Sub-Page (`features/dashboard/pomodoro/*`) | **Partial** | `GAP-008` (P1), `GAP-033` (P3) |
| Study Plan Sub-Page (`features/dashboard/studyplan/*`) | **Partial** | `GAP-025` (P2) |
| Summary Sub-Page (`features/dashboard/summary/*`) | **Complete** | `summaryGenerator.ts` unchanged; `SummaryApp` matches `main` |
| Tracker — Launcher, Multi-Card Tabs, Drafts | **Complete** | `tracker.tsx` matches `main` |
| Tracker — Tag Input & Autocomplete (`fsrs-tags-input`) | **Needs Verification** | `TagInputControl.attach` + controlled `value={tagsText}` interaction |
| Tracker — Review Mode, Hotkeys, Modal A11y | **Partial** | `GAP-014`/`015` (P2) |
| FSRS Scheduler & Optimizers (`scheduler/*`) | **Complete** | `scheduler.ts`, `fsrsOptimizer*.ts` unchanged; `hasCustomWeights` added |
| FSRS Config (`features/tracker/config/fsrsConfig.tsx`) | **Behavior Mismatch** | `GAP-016` (P2), `GAP-028` (P3) |
| Markdown Editor (`features/tracker/editor/editor.tsx`) | **Partial** | `GAP-029` (P3) |
| Highlighter — Tooltip & Color Picker (`highlighter.tsx`) | **Behavior Mismatch** | `GAP-017`/`018` (P2) |
| Highlighter — CSS Custom Highlights & Linking | **Complete** | `applyHighlightsForCurrentPage`, `linkHighlightToCard` intact |
| Highlights Manager (`highlights.tsx`) | **Partial** | `GAP-030` (P3); pre-existing sort bug at `highlights.tsx:408` (`b.url === b.url`) |
| Highlighter Options (`highlightOptions.tsx`) | **Complete** | Full parity |

---

## 6. Configuration and Dependency Gaps

- **Manifests (`browser/{chrome,firefox,safari}/manifest.json`)**: **Full parity** (0 diff vs `main`; `npm run check:isolation` passes 37/37 checks).
- **Browser APIs & Permissions**: All `chrome.notifications` and `chrome.downloads` calls remain properly gated behind `BROWSER_CONFIG` feature flags (`supportsNotifications`, `supportsDownloads`).
- **Webpack & Build (`webpack.config.js`, `tsconfig.json`, `package.json`)**:
  - All entry points updated to `.tsx`; `Preact 11` dependencies added.
  - `webpack.config.js:5` removed `'**/*.js'` from `CopyPlugin` `ignorePatterns` (only `features/common/marked.min.js` currently matches `.js` under `background/`, `content/`, `features/`, so no unintended `.js` files leak today, though future `.js` files in those directories would be copied raw).
  - `forecast.html:15` loads an unused `<script src="../../../dist/fsrsScheduler.bundle.js"></script>` (`GAP-033`).
- **Decorators Cleanup**: `decorators/` is unchanged, and `background/`, `content/`, `theme-sync.ts`, and `actionService.ts` migrated to inline `try/catch` (while `popup.tsx` and `settings.tsx` still import `decorators/`). `tsconfig.json` has no `experimentalDecorators` flag, consistent with `main`.
- **Assets & Scripts**: `icons/launcher.svg` and `icons/logo.svg` added (`v2-logo-*.svg` removed); `audit:dom` and `visual-comparison-audit.js` scripts added.
- **Test-Only Popup Modules**: `features/dashboard/popup/{stats,search,notifications,rating,heatmap}.tsx` and `DashboardComponent.tsx` are not bundled by `webpack.config.js` (only `popup.tsx` is bundled) and are retained for unit tests.

---

## 7. Recommended Implementation Order

### Phase 1 — P0 (Critical Blockers)
- *None* (0 P0 gaps identified).

### Phase 2 — P1 (High Priority Core & User-Facing Regressions)
1. **GAP-001** (`background/background.ts:746`): Restore `&& source !== 'manual'` so manual due-review checks work immediately.
2. **GAP-003** (`features/common/data/data.tsx`): Wire `<Toast id="status-toast" />` and `'algorecall-undo-toast'` listener/timer/undo handler in `DataApp`.
3. **GAP-002** (`features/common/help/help.tsx`): Implement card-level filtering and `.tab-btn` highlighting for `#help-search-input`.
4. **GAP-004** (`features/dashboard/popup/popup.tsx`): Load `tagRegistry`, hydrate `card.tags` via `TagRegistry.hydrate()`, and add multi-tag selection.
5. **GAP-005** (`features/dashboard/popup/popup.tsx`): Persist `longestStreak`, `unlockedAchievements`, and `lastCelebratedMilestone` in a post-load `useEffect` and trigger toast + `triggerConfetti()`.
6. **GAP-006** (`features/dashboard/heatmap/heatmap.tsx`): Cascade-reset `selectedMonth`/`selectedDay` when year/month changes.
7. **GAP-007** (`features/dashboard/forecast/forecast.tsx`): Exclude `i === 0` (Today/overdue) from the Peak Day summary card calculation.
8. **GAP-008** (`features/dashboard/pomodoro/pomodoro.tsx`): Restore `document.title` countdown `useEffect`, plus `timeRemaining === 0` reset and `this.startVisualInterval()` in `PomodoroTimer.start()`.

### Phase 3 — P2 (Medium Priority Behavior, Safety & Layout Fixes)
1. **GAP-009** (`actionService.ts` + `background.ts`): Restore `getDueCardsCount` on `ActionExecutionOptions.background` and `checkDueReviews`.
2. **GAP-010, GAP-011, GAP-012** (`data.tsx`): Restore `bulkReschedule` `confirm()` prompt, `created-asc` sort branch, and `history`/`forecast` view title formatting.
3. **GAP-013** (`settings.tsx`): Use local draft string state for `#custom-interval-input` and restore `'60'` default fallback.
4. **GAP-014, GAP-015** (`tracker.tsx` + `style.css`): Restore `#fsrs-feedback-banner` / `showReviewFeedback()` and `Tab`/`Shift+Tab` modal focus trap.
5. **GAP-016** (`fsrsConfig.tsx` / `tracker.tsx`): Align `fsrsTopicWeights` tag key casing between `fsrsConfig.tsx` and `Tracker`.
6. **GAP-017, GAP-018** (`highlighter.tsx`): Remove trailing `renderTooltipColors()` in `handleDelete`, and measure `#algo-highlight-tooltip` `getBoundingClientRect()` in `positionTooltip`.
7. **GAP-019, GAP-020, GAP-021** (`popup.tsx`): Gate Inbox Zero on `dueCount === 0`, handle `'denied'` notification permission banner state, and use `BROWSER_CONFIG.ratingPromptText` / `ratingButtonLabel`.
8. **GAP-022, GAP-023** (`heatmap.tsx` / `heatmap-stats.tsx`): Add `lifetime` auto-scroll-to-right `useEffect` and remove duplicate `.stats-grid` wrapper.
9. **GAP-024** (`forecast.tsx`): Port local-midnight normalization + `Math.round` for DST-safe day offsets.
10. **GAP-025** (`studyplan.tsx`): Apply `dailyLimit` cap to `preview.total` and clear `examDate`/`dailyLimit` in `handleDeactivate`.
11. **GAP-026** (`history.tsx`): Return `allCards`-derived aggregation unconditionally when `this.allCards.length > 0`.

### Phase 4 — P3 (Low Priority Polish, A11y & Cleanup)
- Address **GAP-027** through **GAP-033** across Settings, Welcome, Websites, Data Manager, FSRS Config, Editor, Highlights Manager, Popup, Analytics (`ErrorBoundary`, duplicate `#tab-*` IDs), and Sub-pages (`HistoryBreadcrumb` `onKeyDown`, `lastError` checks, Pomodoro formatting/inputs, unused `forecast.html` script).

---

## 8. Potential Issues Requiring Manual Verification

1. **`fsrs-tags-input` Controlled Value vs `TagInputControl.attach`** (`features/tracker/tracker.tsx:818, 1156-1168`, `features/common/utils/tagInputAdapter.ts:55-66, 104-110`): Code inspection confirms `TagInputControl` intercepts `value` get/set and dispatches `input`/`change` events so `onInput` updates `tagsText` and calls `saveDraft()`, though `destroy()` is not called on unmount and controlled `value={tagsText}` interacts with the descriptor. Verify autocomplete selection and draft persistence in browser.
2. **Popup `handleSettingChange` Stale Closure** (`features/dashboard/popup/popup.tsx:1242-1265`): Spreads React `settings` state instead of reading fresh `extensionSettings` from `chrome.storage.local` before writing, which could overwrite concurrent changes made in `settings.html`.
3. **Highlighter `HighlighterTypeSelector` State Reset** (`features/highlighter/highlighter.tsx:123`): `activeType` is not reset to `'highlight'` when the tooltip hides without creating a mark, and local `useState` is not synced to prop; verify expected UX across consecutive selections.
4. **FSRS Config Simple Mode Auto-Save** (`features/tracker/config/fsrsConfig.tsx:865`): Retention slider `onChange` and `PresetChips` auto-save immediately in Preact (on `main`, saving required clicking Save in Advanced mode); confirm intended UX.
5. **Pomodoro Timer Ring & Background Sync**: Verify `PomodoroApp` countdown, SVG ring transition, and `pomodoro_action` alarm completion end-to-end across Chrome, Firefox, and Safari.
6. **StudyPlan `daily-limit-input` UX**: Confirm whether removing `main`'s default `value="30"` (`studyplan.html:49`) in favor of `placeholder="Auto-calculated"` (`studyplan.tsx:95`) is intentional.
7. **Layout & Visual Checks**:
   - Heatmap `.stats-grid` CSS rendering (`heatmap.tsx:437`) before/after fixing `GAP-023`.
   - Analytics nested `.tab-pane.active` padding/scroll behavior (`analytics.tsx` + child tabs).
   - Data Manager `#undo-toast` & `#status-toast` positioning once `GAP-003` is wired.
   - Popup confetti canvas (`confetti-canvas`) and milestone toast z-index/animation once `GAP-005` is wired.
   - In-page `NotificationToast` light-theme/button rendering and `Alt+Shift+R` (`check-due-reviews`) toast within 60m after fixing `GAP-001`.

---

## 9. Final Assessment

- **Total Feature Areas Analyzed**: **35** (across Core Infrastructure, Common UI, Dashboard/Popup/Analytics/Sub-pages, Tracker, and Highlighter)
- **Counts by Status**:
  - **Complete**: **17**
  - **Partial**: **13**
  - **Behavior Mismatch**: **4**
  - **Needs Verification**: **1**
  - **Missing**: **0** (all missing sub-features exist as partial modules and are tracked within the 33 gaps)
- **Conclusion**: The `preact` migration is structurally sound, passes cross-browser isolation checks, and preserves core FSRS scheduling, analytics, and extension infrastructure. Resolving the **8 P1** and **18 P2** gaps (followed by the **7 P3** polish items and manual browser verification checklist) will bring the `preact` branch to full functional parity with `main`.
