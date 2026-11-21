# REFACTOR PLAN — Phased Preact Remediation Roadmap

## Executive Summary

This document establishes the official execution plan for remediating the Preact implementation across the AlgoRecall browser extension on the `preact` branch.

The remediation eliminates **1,426 imperative DOM operations** across **51 files**, destroys **6 manual DOM element caches**, removes legacy Vanilla JS controller classes, and establishes declarative Preact 11 functional components and hooks across all extension-owned interfaces.

To manage risk, prevent regressions, and guarantee that the test suite, TypeScript compiler, Webpack builds, and artifact isolation checks remain passing at every checkpoint, the refactoring is structured into **four sequential, dependency-ordered batches**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PHASED REFACTORING ROADMAP                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ BATCH A: Common Infrastructure & Standalone Productivity Pages │   │
│   │ Scope: Settings Hub, Data Manager, TagInput, UIUtils, Help,    │   │
│   │        Welcome, Websites, Pomodoro, StudyPlan, History,        │   │
│   │        Forecast, Summary, Heatmap                              │   │
│   │ Metric: ~525 DOM operations eliminated across 13 files         │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ Shared components & hooks stabilized
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ BATCH B: Tracker Engine & FSRS Configuration                   │   │
│   │ Scope: FSRS Parameter Config, Card Editor Modal, Scheduler UI  │   │
│   │ Metric: ~161 DOM operations eliminated across 2 files          │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ Card models & state patterns verified
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ BATCH C: Core Dashboard & Analytics Suite                      │   │
│   │ Scope: Popup Dashboard (popup, stats, notifications, rating),  │   │
│   │        Analytics SPA & 17 Sub-Tab Modules                      │   │
│   │ Metric: ~450 DOM operations eliminated across 23 files         │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ Extension-owned pages 100% declarative
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ BATCH D: Content Script Overlays & Text Highlighter            │   │
│   │ Scope: In-Page Tracker Widget, Highlighter Palette Tooltip,    │   │
│   │        Highlight Options, Highlights Manager, Notifications   │   │
│   │ Metric: ~290 DOM operations eliminated across 6 files          │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Batch Architecture & Migration Sequence

### Batch A: Common Infrastructure & Standalone Productivity Pages

- **Target Files (13 files)**:
  1. `features/common/settings/settings.tsx` (85 DOM ops)
  2. `features/common/data/data.tsx` (118 DOM ops)
  3. `features/common/utils/tagInput.tsx` (20 DOM ops)
  4. `features/common/utils/uiUtils.ts` (2 DOM ops)
  5. `features/common/help/help.tsx` (18 DOM ops)
  6. `features/common/welcome/welcome.tsx` (25 DOM ops)
  7. `features/common/websites/websites.tsx` (12 DOM ops)
  8. `features/dashboard/pomodoro/pomodoro.tsx` (68 DOM ops)
  9. `features/dashboard/studyplan/studyplan.tsx` (55 DOM ops)
  10. `features/dashboard/history/history.tsx` (19 DOM ops)
  11. `features/dashboard/forecast/forecast.tsx` (10 DOM ops)
  12. `features/dashboard/summary/summary.tsx` (23 DOM ops)
  13. `features/dashboard/heatmap/heatmap.tsx` & `heatmap-stats.tsx` (14 DOM ops)
- **Total Operations to Eliminate**: ~525 DOM operations.
- **Architectural Deliverables**:
  - Delete `SettingsController` and `this.dom` (32 cached element fields).
  - Implement pure Preact `<SettingsApp />` with `useSettings()` hook.
  - Eliminate imperative `FSRSDataDashboard` methods; convert `<DataApp />` to handle sorting, filtering, and pagination in Preact state.
  - Replace `TagInputControl` class with declarative `<TagInput tags={tags} onChange={setTags} />` component.
  - Refactor standalone productivity views (Pomodoro timer, Study plan, History log, Forecast simulator, Weekly summary, Activity heatmap) into pure functional components driven by hooks.
- **Rationale**: Standalone pages have clear, isolated scopes with no inter-page dependencies. Migrating them first stabilizes the shared component library (`Toggle`, `Modal`, `Toast`, `Tabs`, `TagInput`) and common hooks (`useStorage`, `useTheme`).

---

### Batch B: Tracker Engine & FSRS Configuration

- **Target Files (2 files)**:
  1. `features/tracker/config/fsrsConfig.tsx` (104 DOM ops)
  2. `features/tracker/editor/editor.tsx` (57 DOM ops)
- **Total Operations to Eliminate**: ~161 DOM operations.
- **Architectural Deliverables**:
  - Delete `FSRSConfigManager` class; replace with `<FSRSConfigApp />`.
  - Replace imperative mode switching (`.advanced-config-only` display toggling) with declarative state: `{mode === 'advanced' && <AdvancedParametersSection />}`.
  - Wire weight sliders and retention inputs directly to Preact state handlers (`onInput`, `onChange`).
  - Delete `EditorManager` class; replace with `<EditorApp />` utilizing controlled form inputs and a declarative `<MarkdownViewer />`.
- **Rationale**: The FSRS configuration and card editing systems establish the data structures for card difficulty, stability, and review intervals. Stabilizing these ensures robust data flows when the main dashboard and popup are refactored in Batch C.

---

### Batch C: Core Dashboard & Analytics Suite

- **Target Files (23 files)**:
  1. `features/dashboard/popup/popup.tsx` (96 DOM ops)
  2. `features/dashboard/popup/stats.tsx` (60 DOM ops)
  3. `features/dashboard/popup/notifications.tsx` (62 DOM ops)
  4. `features/dashboard/popup/rating.tsx` (17 DOM ops)
  5. `features/dashboard/popup/search.tsx` (28 DOM ops)
  6. `features/dashboard/analytics/analytics.tsx` (82 DOM ops)
  7. 17 Sub-Tab modules in `features/dashboard/analytics/` (~105 DOM ops across sub-tabs)
- **Total Operations to Eliminate**: ~450 DOM operations.
- **Architectural Deliverables**:
  - Delete `AlgoRecallDashboard` class and `PopupDOM` interface (28 cached element fields).
  - Refactor `popup.tsx` into pure declarative `<PopupApp />` mounting once at `<div id="root"></div>`.
  - Refactor `stats.tsx`, `notifications.tsx`, `rating.tsx`, and `search.tsx` into pure child functional components (`PopupStatsOverview`, `QuickRatingSection`, `SearchFilterBar`).
  - Eliminate `AnalyticsDashboardSPA` class and multi-mount imperative tab sub-trees (`tabId.render('tab-' + tabId)`).
  - Implement single-mount `<AnalyticsApp />` with declarative tab routing:
    ```tsx
    {activeTab === 'overview' && <OverviewTab cards={cards} activity={activity} />}
    {activeTab === 'readiness' && <ReadinessTab cards={cards} />}
    {activeTab === 'memory' && <MemoryTab cards={cards} />}
    {activeTab === 'simulation' && <SimulationTab cards={cards} />}
    {activeTab === 'tags' && <TagsTab cards={cards} />}
    {activeTab === 'performance' && <PerformanceTab cards={cards} />}
    {activeTab === 'insights' && <InsightsTab cards={cards} />}
    ```
- **Rationale**: The popup dashboard and analytics SPA are the highest-traffic user interfaces. With shared components, hooks, and tracker models proven in Batches A and B, refactoring these large surfaces carries minimal regression risk.

---

### Batch D: In-Page Content Script Overlays & Text Highlighter

- **Target Files (6 files)**:
  1. `features/tracker/tracker.tsx` (150 DOM ops in widget body)
  2. `features/highlighter/highlighter.tsx` (41 DOM ops in tooltip UI)
  3. `features/highlighter/options/highlightOptions.tsx` (25 DOM ops)
  4. `features/highlighter/manager/highlights.tsx` (17 DOM ops)
  5. `content/notifications.ts` (19 DOM ops)
  6. `content/content.ts` (host orchestration boundaries)
- **Total Operations to Eliminate**: ~290 DOM operations.
- **Architectural Deliverables**:
  - Enforce strict Boundary 2 isolation:
    * Host container creation in host DOM (`document.createElement('div')`, `document.body.appendChild(...)`) is retained as technically justified.
    * Injected widget interior: Replace the 70-line `container.innerHTML = '...'` in `tracker.tsx` with Preact `render(<TrackerOverlay problem={problem} />, hostContainer)`.
    * Replace manual `addEventListener` bindings on `#fsrs-min-btn`, `#fsrs-close-btn` with declarative JSX props.
    * Replace tooltip DOM manipulation in `highlighter.tsx` with Preact `render(<HighlighterTooltipView ... />, tooltipContainer)`.
    * Refactor in-page toast notifications in `content/notifications.ts` to mount `<NotificationToast />` into container.
    * Guarantee clean teardown: Call `render(null, container)` before removing host elements on page navigation or close.
- **Rationale**: Content scripts interact with third-party web pages (LeetCode, AlgoMonster). Isolating this batch prevents host DOM complexities from interfering with extension-owned UI remediation.

---

## Detailed Step-by-Step Refactoring Protocol (Per File)

For each file assigned to a batch, implementers must follow this strict 6-step transformation cycle:

```
[1. Pre-Modification Inspection]
       │  • View latest source code
       │  • Confirm DOM API occurrences from DOM_API_INVENTORY.md
       │  • Check companion unit tests in tests/unit/
       ▼
[2. Interface & Prop Definition]
       │  • Declare explicit <Component>Props interfaces
       │  • Remove any class controller or manager props
       │  • Define callback prop signatures (onSave, onToggle, etc.)
       ▼
[3. Declarative Component Authoring]
       │  • Author pure functional component with JSX
       │  • Replace document.getElementById / querySelector with hooks/props
       │  • Replace innerHTML with typed VNodes
       │  • Replace addEventListener with JSX handlers (onClick, onInput)
       │  • Replace style.display / classList with conditional JSX
       ▼
[4. Controller Class Elimination]
       │  • Delete legacy class and cached DOM interfaces (PopupDOM, this.dom)
       │  • Move business logic into custom hooks or pure helper functions
       │  • Ensure single mount at root: render(<App />, root)
       ▼
[5. Unit Test Adaptation]
       │  • Update companion unit test to test Preact component/hook directly
       │  • Remove mock HTML string injections and controller instantiations
       │  • Assert on VNode rendering, accessibility attributes, and callbacks
       ▼
[6. Checkpoint Verification]
          • Run: npx tsc --noEmit (Must exit 0)
          • Run: npm test (All 92 suites must pass)
          • Run: npm run build (All browser targets must compile)
          • Run: npm run check:isolation:all (All 37 checks must pass)
```

---

## Test Migration Strategy & Coexistence

### Continuous Verification Invariant
At no point during remediation is it acceptable for `npm test` or `npx tsc --noEmit` to fail.

### Handling Test-Controller Coupling
When refactoring modules where tests instantiate legacy controller classes (e.g. `SettingsController`, `AlgoRecallDashboard`, `FSRSConfigManager`):
1. **Side-by-Side Coexistence**: In the target feature file, introduce the declarative Preact application (`<SettingsApp />`).
2. **Adapter Bridge (Temporary)**: If existing unit tests rely on controller methods, maintain a lightweight test adapter class that forwards calls to the hook or business logic functions, preventing immediate test breakage.
3. **Test Modernization**: Incrementally refactor the test file (`settings.test.ts`) to import and test the Preact component using Preact's `render()` into an isolated test DOM node and assert on rendered outputs.
4. **Final Class Removal**: Once the test suite is modernized, delete the temporary adapter class completely.

---

## Rollback & Safety Safeguards

1. **Branch Isolation**:
   - `main` branch (SHA: `41fe481935c854548e3411a591b71df6371d6088`) is strictly read-only.
   - All commits are made solely to `preact`.
2. **Micro-Commit Discipline**:
   - Commit after each logical component or batch completion with descriptive commit messages (e.g., `refactor(settings): eliminate SettingsController and adopt declarative Preact`).
   - If a failure is detected, roll back immediately to the previous clean commit.
3. **Automated Quality Gates**:
   - Every commit must satisfy:
     * `npx tsc --noEmit` (0 errors)
     * `npm test` (100% pass)
     * `npm run build` (Chrome, Firefox, Safari bundles clean)
     * `npm run check:isolation:all` (37/37 checks pass)
4. **Visual Parity Audit Harness**:
   - Utilize `tests/e2e/visual-parity-runner.js` to capture and compare screenshots against the baseline to verify zero visual regressions.
