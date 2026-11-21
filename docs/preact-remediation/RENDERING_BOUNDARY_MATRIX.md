# RENDERING BOUNDARY MATRIX — Architecture & Enforcement Guide

## Executive Summary

This document establishes the official architectural boundaries between **Declarative Preact Rendering** and **Host DOM / Browser APIs** for the AlgoRecall browser extension. It provides the authoritative reference for eliminating imperative DOM manipulation across extension-owned interfaces while delineating the exact boundaries where imperative DOM operations remain technically justified.

Adherence to this matrix is required by **AGENTS.md Rule 3** (*Preact Component Standards*) and **Requirement R2** of the remediation plan.

---

## The Three Architectural Boundaries

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ BOUNDARY 1: EXTENSION-OWNED UI (Virtual DOM Realm)                                          │
│ Scope: All standalone tabs, popups, and dialogs (Popup, Settings, Data, Analytics, etc.)    │
│ Rule: 100% Declarative Preact. Mount once into #root. ZERO imperative DOM manipulation.     │
└─────────────────────────────────────────────────────────▲───────────────────────────────────┘
                                                          │ Controlled props / Custom Events
┌─────────────────────────────────────────────────────────▼───────────────────────────────────┐
│ BOUNDARY 2: HOST WEB PAGE INJECTION (Content Script Boundary)                               │
│ Scope: Problem tracker widget, text highlighter tooltip, in-page notification toast         │
│ Rule: Imperative container creation in host DOM; Preact root mounted into container.        │
│ Read-only host DOM inspection (problem title, tags, text selection ranges) is permitted.   │
└─────────────────────────────────────────────────────────▲───────────────────────────────────┘
                                                          │ Encapsulated Browser APIs
┌─────────────────────────────────────────────────────────▼───────────────────────────────────┐
│ BOUNDARY 3: SHARED INFRASTRUCTURE & BROWSER UTILITIES                                       │
│ Scope: Download fallback anchor (backupManager), Pre-mount FOUC theme sync (theme-sync.ts)  │
│ Rule: Encapsulated non-rendering utilities; isolated behind feature flags / head scripts.   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
\`\`\`

### Boundary 1: Extension-Owned UI (Virtual DOM Realm)
- **Environments**: Extension Action Popup (`popup.html`), Full-tab Dashboard & Management Pages (`data.html`, `settings.html`, `analytics.html`, `history.html`, `pomodoro.html`, `heatmap.html`, `forecast.html`, `studyplan.html`, `summary.html`, `help.html`, `welcome.html`, `websites.html`, `fsrsConfig.html`, `editor.html`, `highlights.html`, `highlightOptions.html`).
- **Permissibility**: **STRICTLY PROHIBITED** from using imperative DOM manipulation.
- **Rules**:
  1. HTML entry files contain only `<div id="root"></div>`.
  2. Preact mounts exactly once: `render(<AppRoot />, root)`.
  3. No `document.getElementById`, `querySelector`, `querySelectorAll`, `createElement`, `appendChild`, `removeChild`, `innerHTML`, `textContent`, `innerText`, `element.style.*`, or `element.classList.*`.
  4. No manual element caches (`PopupDOM`, `this.dom`).
  5. All UI state is held in Preact hooks (`useState`, `useReducer`, `useContext`, `useStorage`).
  6. All user interactions are bound via JSX event props (`onClick`, `onInput`, `onChange`, `onSubmit`).
  7. Element references via `useRef<HTMLElement>()` are restricted to measuring bounding boxes, canvas drawing contexts, or triggering programmatic focus.

### Boundary 2: Host Web Page Injection (Content Script Boundary)
- **Environments**: Isolated World Content Scripts running on whitelisted coding platforms (LeetCode, AlgoMonster).
- **Files**: `content/content.ts`, `content/notifications.ts`, `content/utils.ts`, `features/tracker/tracker.tsx`, `features/highlighter/highlighter.tsx`.
- **Permissibility**: **TECHNICALLY JUSTIFIED** at the host DOM boundary; **STRICTLY PROHIBITED** within injected widget bodies.
- **Rules**:
  1. **Container Injection**: Creating root container elements (`document.createElement('div')`) for `#algo-fsrs-launcher`, `#algo-fsrs-container`, `#algo-highlight-tooltip`, and `#algo-custom-notification-el`, and appending them to `document.body` is technically justified.
  2. **Internal Rendering**: The internal DOM of these containers MUST NOT be constructed via `innerHTML` strings or manual `appendChild`. Instead, mount a Preact tree into the container: `render(<TrackerWidget ... />, container)`.
  3. **Host DOM Inspection**: Read-only DOM querying of third-party page content (`document.querySelector` to find problem title elements, problem tags, or site favicons; `window.getSelection()` to extract text ranges) is technically justified and cannot be replaced with Preact.
  4. **CSS Highlight API**: Registering `CSS.highlights.set(...)` and injecting the associated CSS `::highlight` stylesheet into `document.head` is technically justified for native browser text highlighting.

### Boundary 3: Shared Infrastructure & Browser Utilities
- **Environments**: Background scripts, headless utilities, synchronous head scripts.
- **Files**: `features/common/data/backupManager.ts`, `features/common/services/actionService.ts`, `features/common/theme-sync.ts`.
- **Permissibility**: **ENCAPSULATED UTILITY**.
- **Rules**:
  1. **Download Anchor**: Creating a temporary hidden `<a>` element (`document.createElement('a')`, `document.body.appendChild(a)`, `a.click()`, `document.body.removeChild(a)`) is technically justified solely as a cross-browser fallback when `chrome.downloads.download` is unavailable (specifically Safari MV3 where the `downloads` permission is unsupported). Must remain strictly encapsulated inside `backupManager.ts` and `actionService.ts`.
  2. **Theme Initialization**: Synchronously inspecting storage and toggling `document.documentElement.classList.add('light-theme')` in `theme-sync.ts` is technically justified to prevent a Flash of Unstyled Content (FOUC) before Webpack bundles and Preact mount.

---

## Comprehensive Rendering Boundary Matrix

| Subsystem / Component | Current File(s) | Execution Context | Imperative DOM APIs Currently Used | Permissibility Status | Justification / Architectural Rationale | Target Declarative Architecture |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| **Popup Dashboard** | `features/dashboard/popup/popup.tsx`, `stats.tsx`, `notifications.tsx`, `rating.tsx`, `search.tsx`, `heatmap.tsx` | Browser Action Popup (`popup.html`) | `getElementById` (172), `addEventListener` (64), `style` (25), `classList` (17), `innerHTML` (5), `PopupDOM` cache | ❌ Strictly Prohibited | Extension-owned UI. Preact must own full rendering and state lifecycle. | Mount `<PopupApp />` into `#root`. Eliminate `PopupDashboard` class and `PopupDOM`. Manage toggles and navigation via `useStorage` and JSX props. |
| **Data Manager** | `features/common/data/data.tsx` | Standalone Tab (`data.html`) | `getElementById` (57), `addEventListener` (26), `innerHTML` (12), `createElement` (6), `classList` (7), `style` (5) | ❌ Strictly Prohibited | Extension-owned page. Legacy `FSRSDataDashboard` methods duplicate `DataApp`. | Eliminate `FSRSDataDashboard` imperative methods. Make `DataApp` the sole state holder using `useState` for filters, sorting, and pagination. |
| **Settings Hub** | `features/common/settings/settings.tsx` | Standalone Tab (`settings.html`) | `getElementById` (32), `querySelectorAll` (2), `this.dom` (32 fields), `classList` (13), `addEventListener` (21) | ❌ Strictly Prohibited | Extension-owned page. `SettingsController` imperatively manages tabs and inputs. | Eliminate `SettingsController` and `this.dom`. Use `useSettings()` hook; render panels conditionally: `{activeTab === 'notifications' && <NotificationsPanel />}`. |
| **FSRS Config** | `features/tracker/config/fsrsConfig.tsx` | Standalone Tab (`fsrsConfig.html`) | `getElementById` (49), `addEventListener` (15), `textContent` (14), `style` (8), `classList` (6) | ❌ Strictly Prohibited | Extension-owned page. Class-based controller modifies active mode and weights imperatively. | Refactor to `<FSRSConfigApp />` with `useReducer` for FSRS parameter states and optimization status. |
| **Card Editor** | `features/tracker/editor/editor.tsx` | Standalone Tab (`editor.html`) | `getElementById` (26), `textContent` (12), `addEventListener` (11), `style` (4), `innerHTML` (2) | ❌ Strictly Prohibited | Extension-owned page. Imperative autosave indicators and complexity input queries. | Refactor to `<EditorApp />` with controlled textarea/inputs and declarative `<EditorToast />`. |
| **Pomodoro Timer** | `features/dashboard/pomodoro/pomodoro.tsx` | Standalone Tab (`pomodoro.html`) | `getElementById` (38), `style` (6), `classList` (8), `addEventListener` (6), `textContent` (6) | ❌ Strictly Prohibited | Extension-owned page. Imperative countdown updates and input queries. | Refactor to `<PomodoroApp />` with custom `usePomodoroTimer()` hook managing timer intervals and state. |
| **Study Plan** | `features/dashboard/studyplan/studyplan.tsx` | Standalone Tab (`studyplan.html`) | `getElementById` (32), `textContent` (9), `style` (6), `addEventListener` (6), `classList` (2) | ❌ Strictly Prohibited | Extension-owned page. Imperative setup preview calculations and table generation. | Refactor to `<StudyPlanApp />` with declarative schedule table and SVG countdown ring. |
| **Summary Dashboard** | `features/dashboard/summary/summary.tsx` | Standalone Tab (`summary.html`) | `getElementById` (23), `innerText` (13), `addEventListener` (3), `classList` (2) | ❌ Strictly Prohibited | Extension-owned page. Tab switching and KPI population handled imperatively. | Refactor to `<SummaryApp />` using declarative `activePeriod` state and KPI components. |
| **History Dashboard** | `features/dashboard/history/history.tsx` | Standalone Tab (`history.html`) | `getElementById` (19), `addEventListener` (5), `classList` (4), `style` (4), `innerHTML` (3) | ❌ Strictly Prohibited | Extension-owned page. Imperative calendar day selection and log list rendering. | Refactor to `<HistoryApp />` with declarative calendar grid and review log list. |
| **Heatmap Dashboard** | `features/dashboard/heatmap/heatmap.tsx`, `heatmap-stats.tsx` | Standalone Tab (`heatmap.html`) | `getElementById` (14), `addEventListener` (7), `innerHTML` (3), `classList` (3), `createElement` (1) | ❌ Strictly Prohibited | Extension-owned page. SVG tooltip creation and cell click listeners handled imperatively. | Refactor to `<HeatmapApp />` with JSX SVG cells and declarative hover tooltip state. |
| **Forecast Simulator** | `features/dashboard/forecast/forecast.tsx` | Standalone Tab (`forecast.html`) | `getElementById` (10), `addEventListener` (3), `innerHTML` (3), `textContent` (2), `style` (2) | ❌ Strictly Prohibited | Extension-owned page. Forecast bars and metrics rendered imperatively. | Refactor to `<ForecastApp />` with declarative forecast simulation chart components. |
| **Analytics Dashboard** | `features/dashboard/analytics/analytics.tsx` + 17 sub-tab modules | Standalone Tab (`analytics.html`) | `getElementById` (82), `innerHTML` (25), `querySelector` (8), `addEventListener` (5), `style` (5) | ❌ Strictly Prohibited | Extension-owned page. Tab rendering delegated to imperative class instances (`tabId.render()`). | Replace `tabId.render('container')` with declarative tab routing: `{activeTab === 'memory' && <MemoryTab />}`. |
| **Highlight Options** | `features/highlighter/options/highlightOptions.tsx` | Standalone Tab (`highlightOptions.html`) | `getElementById` (25), `addEventListener` (9), `textContent` (6), `classList` (4), `style` (1) | ❌ Strictly Prohibited | Extension-owned page. Toast messages and palette slot clicks handled imperatively. | Refactor to `<HighlightOptionsApp />` with stateful palette list and toast banner. |
| **Highlights Manager** | `features/highlighter/manager/highlights.tsx`, `highlights-helpers.ts` | Standalone Tab (`highlights.html`) | `getElementById` (17), `innerHTML` (6), `addEventListener` (3), `createElement` (3), `style` (3) | ❌ Strictly Prohibited | Extension-owned page. Highlight search and table cards rendered imperatively. | Refactor to `<HighlightsApp />` with declarative search filter and card grid. |
| **Welcome Wizard** | `features/common/welcome/welcome.tsx` | Standalone Tab (`welcome.html`) | `getElementById` (25), `classList` (8), `addEventListener` (7), `style` (4), `textContent` (3) | ❌ Strictly Prohibited | Extension-owned page. Multi-step onboarding carousel stepped imperatively. | Refactor to `<WelcomeApp />` with `currentStep` state hook and JSX step panels. |
| **Help Center** | `features/common/help/help.tsx` | Standalone Tab (`help.html`) | `getElementById` (18), `classList` (7), `addEventListener` (8), `style` (3), `textContent` (2) | ❌ Strictly Prohibited | Extension-owned page. Search filter and tab panels manipulated imperatively. | Refactor to `<HelpApp />` with controlled search query state and declarative tabs. |
| **Websites Manager** | `features/common/websites/websites.tsx` | Standalone Tab (`websites.html`) | `getElementById` (12), `addEventListener` (6) | ❌ Strictly Prohibited | Extension-owned page. Whitelisted domain add/remove handled imperatively. | Refactor to `<WebsitesApp />` with declarative domain list and input form. |
| **Tag Input Control** | `features/common/utils/tagInput.tsx` | Shared Form Widget | `createElement` (4), `appendChild` (4), `addEventListener` (5), `querySelector` (2), `style` (2) | ❌ Strictly Prohibited | Form widget. Intercepts hidden input values and builds DOM imperatively. | Replace `TagInputControl` class with declarative `<TagInput tags={tags} onChange={setTags} />`. |
| **UI Utils Banner** | `features/common/utils/uiUtils.ts` | Shared Utility | `getElementById` (1), `textContent` (1) | ❌ Strictly Prohibited | Imperative error banner querying DOM. | Replace with Preact Error Boundary or shared Toast context hook. |
| **In-Page Tracker Overlay** | `features/tracker/tracker.tsx` | Content Script Injection (Host DOM) | Host root injection (`createElement`, `body.appendChild`), Host shortcuts (`keydown`), Internal UI (`innerHTML`, `getElementById`, `addEventListener`) | ⚠️ Partial (Boundary 2) | Container injection is technically justified. Internal widget body must be Preact. | Create container `#algo-fsrs-container` imperatively. Mount `<TrackerModal />` into container via Preact `render()`. |
| **In-Page Highlighter Tooltip** | `features/highlighter/highlighter.tsx` | Content Script Injection (Host DOM) | Tooltip root injection (`createElement`, `body.appendChild`), Text range extraction (`window.getSelection`), Tooltip UI (`querySelectorAll`, `style`) | ⚠️ Partial (Boundary 2) | Tooltip container injection and range selection are justified. Tooltip UI must be Preact. | Create container `#algo-highlight-tooltip` imperatively. Mount `<HighlighterTooltipView />` into container via Preact `render()`. |
| **In-Page Notification Toast** | `content/notifications.ts` | Content Script Injection (Host DOM) | Toast root injection (`createElement`, `body.appendChild`), Button clicks (`addEventListener`), HTML markup (`innerHTML`) | ⚠️ Partial (Boundary 2) | Toast container injection is justified. Toast card markup must be Preact. | Inject mount container once; render `<NotificationToast />` declaratively with timer dismiss. |
| **Content Orchestrator** | `content/content.ts` | Content Script Orchestrator | Container presence checks (`getElementById`), Host page click/mutation monitoring (`addEventListener`, `MutationObserver`) | ⚠️ Technically Justified (Boundary 2) | Orchestrator boots features on host pages and listens to SPA navigations. | Retain container presence checks and MutationObserver; remove direct widget styling from orchestrator. |
| **Host DOM Inspection** | `content/utils.ts` | Content Script Utilities | Problem title scraping (`querySelector`), Favicon link scraping (`querySelector`), Highlight CSS injection (`head.appendChild`) | ✅ Technically Justified (Boundary 2) | Third-party website DOM inspection (LeetCode, AlgoMonster). | Retain read-only scraping functions (`getExtractedProblemTitle`, `getFaviconUrl`, `ensureHighlightStyle`). |
| **Download Anchor Fallback** | `features/common/data/backupManager.ts`, `features/common/services/actionService.ts` | Headless Data Utility | `createElement('a')`, `body.appendChild(a)`, `a.click()`, `body.removeChild(a)` | ✅ Technically Justified (Boundary 3) | Programmatic file download trigger when `chrome.downloads` is unsupported (Safari MV3). | Retain strictly encapsulated behind `BROWSER_CONFIG.supportsDownloads === false` fallback check. |
| **Theme Pre-Mount Sync** | `features/common/theme-sync.ts` | Synchronous Head Script | `documentElement.classList.add('light-theme')`, `classList.remove('light-theme')` | ✅ Technically Justified (Boundary 3) | Runs synchronously in `<head>` before stylesheets/bundles load to prevent FOUC. | Retain minimal synchronous classList mutation on `documentElement`. |

---

## The Six Anti-Patterns & Prescriptive Solutions

### Anti-Pattern 1: The "Facade Component"
- **Manifestation**: A Preact component (e.g., `<DataApp dashboard={this} />`) renders a JSX shell, but delegates all actions to a companion class instance (`dashboard.filterAndRender()`), which immediately executes `document.getElementById` and `querySelector` to read and write DOM state.
- **Root Cause**: Incomplete migration where Preact was placed on top of legacy code without replacing the class logic.
- **Solution**: Delete the companion class. Move all data fetching, filtering, and sorting into Preact hooks (`useStorage`, `useState`, `useMemo`, `useCallback`).

### Anti-Pattern 2: Split-Brain State
- **Manifestation**: UI state (such as active tab, selected filter, or modal open status) is stored on a class property (e.g., `this.currentView = 'due'`), while the Preact component also maintains a state variable (`const [view, setView] = useState('due')`). The two states must be manually kept in sync, leading to desynchronization and race conditions.
- **Solution**: Establish a single source of truth within the Preact component tree using standard hooks (`useState` or `useReducer`).

### Anti-Pattern 3: Element Caches (`this.dom`, `interface PopupDOM`)
- **Manifestation**: A controller queries and stores references to dozens of DOM elements at boot time (`this.dom = { btn: document.getElementById('btn'), ... }`). If Preact re-renders or conditionally unmounts those elements, the cached references become stale or point to detached DOM nodes.
- **Solution**: Completely remove element caches. Components reference state and invoke callbacks passed via props.

### Anti-Pattern 4: Raw HTML Strings & `innerHTML`
- **Manifestation**: Methods like `generateCardsTable()` or `notification.innerHTML = \`...\`` build large HTML strings and inject them into containers.
- **Solution**: Author all markup as typed Preact JSX components. Utilize `.map()` for lists with unique `key` props.

### Anti-Pattern 5: Manual Event Listeners on VNode Elements
- **Manifestation**: Calling `btn.addEventListener('click', handler)` inside a class method or `useEffect` after querying the element.
- **Solution**: Bind directly in JSX using event props: `<button onClick={handleClick}>`.

### Anti-Pattern 6: CSS Display & ClassList Toggling
- **Manifestation**: Manually executing `modal.style.display = 'block'` or `tab.classList.toggle('active')`.
- **Solution**: Control visibility through conditional rendering (`{isOpen && <Modal />}`) and dynamic classes (`className={\`tab \${isActive ? 'active' : ''}\`}`).

---

## Implementer Verification Checklist & Quality Gates

Before any component refactoring is marked complete, verify against these strict criteria:

- [ ] **Zero DOM Queries**: No calls to `document.getElementById`, `document.querySelector`, or `document.querySelectorAll` exist within the feature file (outside of the single `render(<App />, root)` bootstrap).
- [ ] **Zero Imperative Mutations**: No `innerHTML`, `textContent`, `innerText`, `appendChild`, `removeChild`, or `element.style.*` assignments exist.
- [ ] **Zero Manual Element Caches**: No `dom = { ... }` or interface caching DOM elements exists.
- [ ] **JSX Event Binding**: All interactive buttons, inputs, selects, and forms use JSX handlers (`onClick`, `onInput`, `onChange`, `onSubmit`).
- [ ] **Preact State Ownership**: All state is managed via `useState`, `useReducer`, `useMemo`, `useCallback`, or `useStorage`.
- [ ] **Branch Safety**: All changes reside strictly on the `preact` branch; `main` is untouched.
- [ ] **Verification Gate**: `npm test` passes 100%, `npx tsc --noEmit` exits code 0, `npm run build` succeeds for all 3 targets, and `npm run check:isolation:all` exits code 0.
