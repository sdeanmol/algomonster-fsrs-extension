# Architecture Decisions: Vanilla TS → Preact Parity

Last Updated: 2026-11-21  
Authoritative Reference: `main` (Commit `41fe481`)  
Implementation Target: `preact` (Commit `b00ed85` and subsequent parity updates)  
Lead Architect: `@arch-analyst`  

---

## Executive Summary & Architectural Vision

The AlgoRecall extension has transitioned from an imperative, string-concatenation-based Vanilla JavaScript/TypeScript codebase into a modern, type-safe, component-driven architecture powered by **Preact 11** and **TypeScript 5**.

The primary architectural challenges resolved during this migration include:
1. **Elimination of Fragile Imperative DOM Manipulation**: The legacy `main` branch relied heavily on manual DOM manipulation (~493 `document.getElementById` calls, ~265 `addEventListener` calls, and extensive manual HTML string concatenation). This has been completely replaced with declarative Preact functional components, explicit TypeScript prop interfaces, and hook-based lifecycle management.
2. **Strict In-Page Host Protection**: While extension-owned views run in dedicated Preact component trees, content scripts injected into third-party problem-solving domains (LeetCode, AlgoMonster, HackerRank, Codeforces, NeetCode) must remain pure, lightweight Vanilla TypeScript to avoid runtime collisions, synthetic event interference, and bundle bloat.
3. **Cross-Browser Parity & Isolation**: Full feature parity across Chrome, Firefox, and Safari (Manifest V3) using build-time constant injection (`DefinePlugin`) and capability gating (`BROWSER_CONFIG`), ensuring strict artifact isolation without runtime browser sniffing.

---

## Architectural Decision Records (ADRs)

### ADR 001: Component-Driven Architecture for Extension-Owned UIs

- **Status**: Accepted & Enforced.
- **Context**:
  The legacy UI codebase in `main` constructed views through imperative DOM manipulation (`document.createElement`, `innerHTML`, `insertAdjacentHTML`), manual event listener registration, and ad-hoc state mutations. This led to state synchronization bugs, memory leaks from unremoved event listeners, and difficult-to-maintain views across the extension's 17 distinct entry points.
- **Decision**:
  All extension-owned standalone pages and dashboards must be authored exclusively as **Preact functional components** with explicit TypeScript prop interfaces and hook-based state management (`useState`, `useEffect`, `useCallback`, `useMemo`, `useRef`).
  
  Imperative DOM manipulation is strictly prohibited in extension-owned UIs. Specifically:
  1. UI rendering must be declarative via JSX / `h()`.
  2. State must be managed via standard Preact hooks or the shared `useStorage` reactive hook.
  3. Side effects (timers, storage listeners, DOM measurements) must reside in `useEffect` hooks with explicit teardown functions returned for unmount cleanup.
  4. Each component must define an exported TypeScript interface for its props (e.g. `interface ToggleProps { ... }`).
- **Scope & Entry Points**:
  Applies to all 17 extension-owned entry points:
  - **Browser Action Popup**: `features/dashboard/popup/popup.tsx` (`<PopupApp />`)
  - **Settings Hub**: `features/common/settings/settings.tsx` (`<SettingsApp />`)
  - **Data Manager**: `features/common/data/data.tsx` (`<DataApp />`)
  - **Analytics SPA**: `features/dashboard/analytics/analytics.tsx` (`<AnalyticsApp />` with 7 sub-tabs: Overview, Readiness, Memory, Simulation, Tags, Performance, Insights)
  - **History Dashboard**: `features/dashboard/history/history.tsx` (`<HistoryApp />`)
  - **Pomodoro Timer**: `features/dashboard/pomodoro/pomodoro.tsx` (`<PomodoroApp />`)
  - **Activity Heatmap**: `features/dashboard/heatmap/heatmap.tsx` (`<HeatmapApp />`)
  - **Workload Forecast**: `features/dashboard/forecast/forecast.tsx` (`<ForecastApp />`)
  - **Exam Mode / Study Plan**: `features/dashboard/studyplan/studyplan.tsx` (`<StudyPlanApp />`)
  - **Performance & Notification Summary**: `features/dashboard/summary/summary.tsx` (`<SummaryApp />`)
  - **Onboarding / Welcome Walkthrough**: `features/common/welcome/welcome.tsx` (`<WelcomeApp />`)
  - **Help & Privacy Center**: `features/common/help/help.tsx` (`<HelpApp />`)
  - **Whitelisted Websites Manager**: `features/common/websites/websites.tsx` (`<WebsitesApp />`)
  - **Highlighter Appearance Options**: `features/highlighter/options/highlightOptions.tsx` (`<HighlightOptionsApp />`)
  - **Saved Highlights Manager**: `features/highlighter/manager/highlights.tsx` (`<HighlightsApp />`)
  - **FSRS Algorithm Configurator**: `features/tracker/config/fsrsConfig.tsx` (`<FSRSConfigApp />`)
  - **Problem Note & Markdown Editor**: `features/tracker/editor/editor.tsx` (`<EditorApp />`)
- **Consequences**:
  - Eliminates DOM memory leaks and stale element reference crashes.
  - Enables modular unit testing using `@testing-library/preact` and `preact/test-utils`.
  - Ensures clean separation of concerns between presentation and business services.

---

### ADR 002: Preservation of Vanilla TypeScript in Content Scripts & In-Page Overlay Boundary

- **Status**: Accepted & Enforced.
- **Context**:
  Content scripts (`content/content.ts`, `content/notifications.ts`, `content/utils.ts`, `content/state.ts`) run inside third-party web applications (LeetCode, AlgoMonster, AtCoder, etc.). These target platforms frequently employ modern web frameworks (React 18/19, Next.js, Vue, Web Components) with their own global hooks (`window.__REACT_DEVTOOLS_GLOBAL_HOOK__`), synthetic event delegation systems attached to `document` or root containers, and dynamic DOM reconciliation loops.
- **Decision**:
  Content scripts and in-page overlays injected into host pages must **NOT** import Preact runtime packages or mount React/Preact component trees into the host page's DOM. They must remain lightweight **Vanilla TypeScript**.

  **Architectural Guardrails for In-Page Injection**:
  1. **Runtime Isolation**: Content scripts must not inject virtual DOM libraries into the host window. This prevents bundle bloat (saving ~15-30KB per frame/tab) and eliminates conflicts with host React DevTools or synthetic event systems.
  2. **Scoped DOM Elements**: Injected overlays must use uniquely namespaced DOM IDs and classes (`id="algo-fsrs-launcher"`, `id="algo-fsrs-container"`, `class="algo-custom-notification"`, `id="algo-highlight-tooltip"`).
  3. **Event Containment**: User interactions with in-page widgets must invoke `event.stopPropagation()` on clicks, keydowns, and drag events to prevent host page event handlers (such as Monaco editor keybindings or LeetCode shortcuts) from reacting to extension widget events.
  4. **SPA Navigation Resilience**: The `AlgoRecallOrchestrator` uses `MutationObserver` and URL change tracking to clean up and re-anchor in-page overlays during client-side SPA navigations without leaving orphaned DOM nodes.
  5. **Companion Components for Testing**: For UI components that represent in-page widgets (e.g. `TrackerFloatingLauncher`, `TrackerRatingBar`, `HighlighterTooltip`), companion Preact functional components are provided in feature directories solely for unit testing and isolated preview rendering in test suites (`tests/unit/`). The live content script uses direct Vanilla TS DOM encapsulation.
- **Consequences**:
  - Complete immunity against host site framework conflicts and React version mismatches.
  - Instantaneous injection speed with minimal memory footprint on active problem pages.
  - High resilience during complex single-page client navigations on LeetCode/AlgoMonster.

---

### ADR 003: HTML Entry Points & Webpack Mount Pattern

- **Status**: Accepted & Enforced.
- **Context**:
  In Manifest V3 extensions, standalone pages (Popups, Options tabs, full-page dashboards) are loaded by the browser engine through static HTML entry points.
- **Decision**:
  Every extension-owned page must follow the standardized minimal HTML shell pattern:
  ```html
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta charset="UTF-8">
      <title>[Page Title] — AlgoRecall</title>
      <script src="[relative]/theme-sync.js"></script>
      <link rel="stylesheet" href="[relative]/base.css">
      <link rel="stylesheet" href="[page].css">
  </head>
  <body>
      <div id="root"></div>
      <script type="module" src="[page].js"></script>
  </body>
  </html>
  ```
  **Webpack Integration & Asset Pipeline**:
  1. Webpack compiles each `.tsx` entry point into a corresponding `.js` bundle placed in the target directory (e.g. `features/dashboard/popup/popup.tsx` -> `features/dashboard/popup/popup.js`).
  2. `CopyPlugin` copies static HTML and CSS files directly to `dist/<target>/`.
  3. **Strict Ignore Filter**: `CopyPlugin` patterns MUST enforce `ignorePatterns: ['**/*.test.js', '**/__tests__/**', '**/*.md', '**/*.ts', '**/*.tsx']` to guarantee that raw TypeScript or TSX source files are never leaked into extension release distributions.
  4. Preact mounting occurs once the DOM is ready:
     ```typescript
     document.addEventListener('DOMContentLoaded', () => {
         const root = document.getElementById('root');
         if (root) {
             render(<App />, root);
         }
     });
     ```
- **Consequences**:
  - Consistent layout and theme initialization across all 17 pages.
  - Eliminates FOUC (Flash of Unstyled Content) by executing `theme-sync.js` synchronously in `<head>` before rendering.
  - Clean build output verified by automated isolation and packaging audits.

---

### ADR 004: Universal Method Decorators Compatibility (Stage 2 & Stage 3)

- **Status**: Accepted & Enforced.
- **Context**:
  Commit `2a4d545` on `main` introduced method decorators (`@CatchAndLog`, `@CatchAndReturn`, `@MeasureTime`) for robust error containment and performance tracking. However, TypeScript and Babel support both legacy (Stage 2) and ECMAScript standard (Stage 3) decorator signatures, which have different parameter layouts.
- **Decision**:
  Implement dual-compatibility decorator factories in `decorators/errorDecorators.ts` that automatically detect whether the decorator is invoked under Stage 2 (`(target, propertyKey, descriptor)`) or Stage 3 (`(value, context)`).
  
  Additionally, provide functional wrapper utilities (`trySafe`, `trySafeAsync`, `withErrorHandling`, `UIUtils.formatError`) for functional components and standalone helper functions where class decorators cannot be applied.
- **Key Decorator Capabilities**:
  - `@CatchAndLog(contextName, level, fallbackValue)`: Catches unexpected exceptions, logs structured diagnostics via `Logger`, and returns a safe fallback without crashing callers.
  - `@CatchAndReturn(fallbackValue)`: Silently absorbs non-critical errors and returns a default value.
  - `@MeasureTime(operationName, thresholdMs)`: Traces method execution duration and emits warnings when execution exceeds performance budgets.
- **Consequences**:
  - Unifies error logging across background service workers, scheduler routines, and UI services.
  - Ensures seamless compatibility regardless of TypeScript compiler flag configurations.

---

### ADR 005: Cross-Browser Abstraction Layer & Target Isolation

- **Status**: Accepted & Enforced.
- **Context**:
  AlgoRecall is distributed across three browser ecosystems: **Google Chrome** (Chrome Web Store), **Mozilla Firefox** (Firefox Add-ons / AMO), and **Apple Safari** (Mac App Store). Each platform presents specific API restrictions under Manifest V3:
  - Safari does not support `chrome.notifications` or `chrome.downloads`.
  - Firefox requires `browser_specific_settings.gecko` and uses background scripts (`background.scripts`) rather than service workers.
  - Chrome enforces strict `service_worker` execution with isolated origin storage rules.
- **Decision**:
  1. **Uniform API Namespace**: Use the `chrome.*` namespace uniformly across all targets (Firefox MV3 natively supports `chrome.*`). Do not introduce `browser.*` namespaces.
  2. **Capability Gating (`BROWSER_CONFIG`)**: All browser-specific API invocations must be gated behind feature flags in `features/common/browserConfig.ts`:
     - `BROWSER_CONFIG.supportsNotifications`: Guard for `chrome.notifications` calls; fall back to in-page toast notifications on Safari.
     - `BROWSER_CONFIG.supportsDownloads`: Guard for `chrome.downloads` calls; fall back to synthetic anchor blob downloads (`document.createElement('a')`) on Safari.
     - `BROWSER_CONFIG.supportsAlarms`: Guard for periodic background alarms.
  3. **Build-Time Constant Injection**: Store names and review URLs must never be hardcoded in application source. Webpack's `DefinePlugin` injects `__BROWSER_TARGET__`, `__STORE_NAME__`, and `__STORE_REVIEW_URL__` at compile time:
     - Chrome: Chrome Web Store review URL.
     - Firefox: Firefox Add-ons (AMO) review URL.
     - Safari: Apple Mac App Store review URL.
  4. **Automated Isolation Audit**: Continuous integration enforces `npm run check:isolation:all` (`scripts/check-artifact-isolation.js`) to guarantee that no browser distribution bundle contains foreign store identifiers or invalid manifest properties.
- **Consequences**:
  - Zero runtime browser sniffing.
  - Dead code elimination by minifiers when branching on static boolean feature flags.
  - Full compliance with Safari and Firefox review guidelines.

---

### ADR 006: State Management & Reactive Storage Hooks

- **Status**: Accepted & Enforced.
- **Context**:
  Browser extensions have decoupled execution contexts: background service workers, content script overlays, popup panels, and full-page tabs. State updates (e.g. rating a card, toggling a setting) in one context must instantly reflect across all other active views without requiring full page reloads.
- **Decision**:
  1. **Single Source of Truth**: The extension's persistent single source of truth is `chrome.storage.local`.
  2. **Reactive Preact Hook (`useStorage<T>`)**: Components bind to extension storage using the shared `useStorage(key, defaultValue)` hook located in `features/common/ui/hooks/useStorage.ts`.
     - Automatically fetches initial stored value.
     - Subscribes to `chrome.storage.onChanged` to receive updates dispatched from any extension context.
     - Automatically removes the change listener on component unmount (`useEffect` return cleanup).
     - Provides an asynchronous setter that commits updates to `chrome.storage.local`.
  3. **Immutable State Transitions**: State modifications to collection structures (e.g. `cards`, `bookmarks`, `marks`) must treat arrays and objects as immutable structures, avoiding direct mutations that bypass Preact reconciliation.
  4. **Inter-Context Messaging**: Cross-context requests (e.g., initiating backups, snoozing notifications, triggering scheduler recalculations) are dispatched through typed messages via `ActionService` and the background service worker.
- **Consequences**:
  - Instant UI reactivity across concurrently open tabs and popups.
  - Clean teardown with zero listener leaks.
  - Predictable, unidirectional data flow.

---

### ADR 007: Dual-Engine Scheduler Architecture: WASM Runtime & Fast TS Fallback

- **Status**: Accepted & Enforced.
- **Context**:
  The FSRS (Free Spaced Repetition Scheduler) algorithm requires heavy matrix and optimization calculations for parameter fitting and retention stability estimation. WebAssembly (WASM) delivers near-native performance for optimization routines, but requires browser WASI runtime shims and may fail in restricted execution environments.
- **Decision**:
  Implement a dual-engine architecture in `features/tracker/scheduler/`:
  1. **Primary WASM Engine**: The Rust FSRS core is bundled as `dist/fsrs-binding.wasm32-wasi.wasm` and loaded via `@open-spaced-repetition/binding/dynamic-wasi`.
  2. **Fast Pure-TypeScript Optimizer Fallback**: `fsrsOptimizerFast.ts` provides a high-performance, zero-dependency matrix optimization fallback in standard TypeScript.
  3. **Runtime Fallback Mechanism**: If WASM initialization fails or is disabled, the scheduler automatically degrades to the fast TypeScript optimizer, logging diagnostics without interrupting user review workflows.
  4. **Bundle Isolation**: The scheduler core is bundled into a dedicated chunk `dist/fsrsScheduler.bundle.js` and loaded dynamically or statically by pages requiring scheduling computations.
- **Consequences**:
  - High performance calculation of memory stability and optimal review intervals.
  - Guaranteed operation even in sandboxes where WebAssembly instantiation is constrained.

---

### ADR 008: Imperative DOM Decoupling Audit & Migration Verification

- **Status**: Accepted & Enforced.
- **Context**:
  Feature F-0009 on the migration roadmap required a comprehensive audit of all views to verify that the imperative DOM manipulation patterns from the `main` branch have been completely eliminated from extension-owned UIs.
- **Audit Findings & Verification**:
  1. **Extension-Owned UIs**: All 17 extension pages now construct their UI purely via Preact functional components and declarative JSX. There is zero `document.createElement`, `innerHTML`, or manual DOM mounting inside component render loops.
  2. **Sanitized HTML Rendering**: Where rich text or markdown previews are required (`features/tracker/editor/editor.tsx` and `features/tracker/tracker.tsx`), HTML is rendered through sanitized preview components (`MarkdownPreview`) using controlled `dangerouslySetInnerHTML={{ __html: sanitizedHtml }}`.
  3. **File Export Direct Triggers**: Occurrences of `document.createElement('a')` in `backupManager.ts`, `actionService.ts`, and `fsrsConfig.tsx` are strictly confined to transient download triggers for JSON/CSV export files in environments where `chrome.downloads` is unavailable (e.g. Safari).
  4. **Lifecycle Teardowns**: All event listeners registered on `window` or `document` within Preact components (e.g., `hashchange` in `help.tsx`, keydown shortcuts in `history.tsx`) return proper cleanup callbacks inside `useEffect`.
- **Consequences**:
  - Verified 100% decoupling of extension UIs from legacy imperative DOM patterns.
  - Robust testability and predictable component lifecycles across the entire extension.

---

## Component & Entry Point Inventory Matrix

| Entry Point | Webpack Chunk | HTML Shell | Root Preact Component | Key Hooks Used | Test Suite |
|---|---|---|---|---|---|
| Popup | `features/dashboard/popup/popup.js` | `popup.html` | `<PopupApp />` | `useState`, `useEffect`, `useCallback`, `useMemo` | `PopupComponents.test.tsx`, `popup.test.ts` |
| Settings Hub | `features/common/settings/settings.js` | `settings.html` | `<SettingsApp />` | `useState`, `useEffect`, `useCallback`, `useStorage` | `SettingsComponents.test.tsx`, `settings.test.ts` |
| Data Manager | `features/common/data/data.js` | `data.html` | `<DataApp />` | `useState`, `useEffect`, `useCallback`, `useMemo`, `useRef` | `DataComponents.test.tsx`, `dataDashboard.test.ts` |
| Analytics SPA | `features/dashboard/analytics/analytics.js` | `analytics.html` | `<AnalyticsApp />` | `useState`, `useEffect`, `useCallback`, `useMemo` | `AnalyticsComponents.test.tsx`, `analytics.test.ts` |
| History | `features/dashboard/history/history.js` | `history.html` | `<HistoryApp />` | `useState`, `useEffect`, `useCallback`, `useMemo` | `HistoryComponents.test.tsx`, `history.test.ts` |
| Pomodoro | `features/dashboard/pomodoro/pomodoro.js` | `pomodoro.html` | `<PomodoroApp />` | `useState`, `useEffect`, `useCallback`, `useRef` | `PomodoroComponents.test.tsx`, `pomodoro.test.ts` |
| Heatmap | `features/dashboard/heatmap/heatmap.js` | `heatmap.html` | `<HeatmapApp />` | `useState`, `useEffect`, `useCallback`, `useMemo` | `heatmap.test.ts`, `heatmap-stats.test.ts` |
| Forecast | `features/dashboard/forecast/forecast.js` | `forecast.html` | `<ForecastApp />` | `useState`, `useEffect`, `useCallback`, `useMemo` | `ForecastComponents.test.tsx`, `forecast.test.ts` |
| Study Plan | `features/dashboard/studyplan/studyplan.js` | `studyplan.html` | `<StudyPlanApp />` | `useState`, `useEffect`, `useCallback` | `StudyPlanComponents.test.tsx`, `studyplan.test.ts` |
| Summary | `features/dashboard/summary/summary.js` | `summary.html` | `<SummaryApp />` | `useState`, `useEffect`, `useCallback` | `summary.test.ts`, `summaryGenerator.test.ts` |
| Welcome | `features/common/welcome/welcome.js` | `welcome.html` | `<WelcomeApp />` | `useState`, `useEffect`, `useCallback` | `StepIndicators.test.tsx`, `welcome.test.ts` |
| Help Center | `features/common/help/help.js` | `help.html` | `<HelpApp />` | `useState`, `useEffect`, `useCallback` | `HelpTabBar.test.tsx`, `help.test.ts` |
| Websites | `features/common/websites/websites.js` | `websites.html` | `<WebsitesApp />` | `useState`, `useEffect`, `useCallback` | `WhitelistedSitesList.test.tsx`, `websites.test.ts` |
| Highlight Options | `features/highlighter/options/highlightOptions.js` | `highlightOptions.html` | `<HighlightOptionsApp />` | `useState`, `useEffect`, `useCallback` | `PaletteComponents.test.tsx`, `highlightOptions.test.ts` |
| Highlights Manager | `features/highlighter/manager/highlights.js` | `highlights.html` | `<HighlightsApp />` | `useState`, `useEffect`, `useCallback` | `HighlightsComponents.test.tsx`, `highlights.test.ts` |
| FSRS Config | `dist/config.bundle.js` | `fsrsConfig.html` | `<FSRSConfigApp />` | `useState`, `useEffect`, `useCallback`, `useRef`, `useStorage` | `fsrsConfig.test.ts` |
| Editor | `features/tracker/editor/editor.js` | `editor.html` | `<EditorApp />` | `useState`, `useEffect`, `useCallback`, `useRef` | `EditorComponents.test.tsx`, `editor.test.ts` |

---

## Content Scripts Architecture Boundary

| Module | Runtime Environment | UI Approach | Host DOM Encapsulation |
|---|---|---|---|
| `content/content.ts` | Isolated World (Vanilla TS) | Orchestration & Navigation Observers | None (lifecycle coordination only) |
| `content/utils.ts` | Isolated World (Vanilla TS) | Dynamic CSS Highlight Styles & Metadata | Dynamic `<style id="algo-highlight-styles">` |
| `content/notifications.ts` | Isolated World (Vanilla TS) | In-Page Notification Toast | Scoped element `#algo-custom-notification-el` with dismiss/snooze |
| `content/state.ts` | Isolated World (Vanilla TS) | Shared Runtime State (`window.AlgoRecall`) | None (in-memory state cache) |
| `features/tracker/tracker.tsx` | In-Page Overlay (Vanilla TS controller) | Floating Review Widget & Drag Launcher | Scoped elements `#algo-fsrs-launcher`, `#algo-fsrs-container` |
| `features/highlighter/highlighter.tsx` | In-Page Overlay (Vanilla TS controller) | Floating Tooltip & Text Selection Markers | Scoped element `#algo-highlight-tooltip` |

---

## Continuous Verification & Build Gates

All changes across the repository must satisfy the automated three-tier validation gate before landing:
1. **Unit & Integration Tests**: `npm test` (Enforces 100% test passing across 90+ test suites and strict coverage thresholds).
2. **Multi-Target Build**: `npm run build` / `npm run build:chrome && npm run build:firefox && npm run build:safari` (Validates TypeScript compilation and Webpack asset bundling for all three browsers).
3. **Artifact Isolation Audit**: `npm run check:isolation:all` (`node scripts/check-artifact-isolation.js`) (Validates complete store string and manifest isolation across Chrome, Firefox, and Safari distribution archives).
