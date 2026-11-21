# Preact Remediation & Declarative Architecture Guide

## Executive Summary

This documentation suite governs the architectural remediation of the **AlgoRecall** browser extension on the `preact` branch. 

During an earlier migration from Vanilla TypeScript to Preact 11, the extension adopted `<div id="root"></div>` mount points in its 17 HTML entry files, but preserved underlying Vanilla JS controller classes and procedural DOM manipulation patterns. This resulted in the **"Hybrid Controller Trap"** (or **"Facade Migration"**), where Preact components render initial JSX shells while companion controller classes (`AlgoRecallDashboard`, `SettingsController`, `FSRSConfigManager`, `FSRSDataDashboard`, `PomodoroTimer`, etc.) continue to imperatively query, mutate, and cache DOM elements via `document.getElementById`, `innerHTML`, `classList`, `element.style`, and manual `addEventListener` calls.

The mission of this remediation project is to completely eliminate imperative DOM manipulation across all extension-owned interfaces, establishing a pure declarative Preact 11 architecture that adheres strictly to **AGENTS.md Rule 3** and **Requirement R2** of the project specification, while preserving 100% functional, visual, and behavioral parity with `main` (commit SHA: `41fe481935c854548e3411a591b71df6371d6088`).

---

## Master Documentation Index

The `docs/preact-remediation/` folder contains seven comprehensive, interconnected engineering documents:

| Document | Primary Audience | Description |
| :--- | :--- | :--- |
| [**`README.md`**](./README.md) | All Engineers & Agents | Master index, architectural standards, Preact component conventions, shared hooks/components catalog, and quality gate guidelines. |
| [**`PREACT_ARCHITECTURE_AUDIT.md`**](./PREACT_ARCHITECTURE_AUDIT.md) | Architects & Implementers | In-depth technical autopsy of the hybrid controller trap, state bifurcation, event leakage, component blueprints, and unit test migration strategies. |
| [**`DOM_API_INVENTORY.md`**](./DOM_API_INVENTORY.md) | Implementers & QA | Compiler-grade AST audit itemizing all 1,495 imperative DOM occurrences across 51 source files, with exact line numbers, code snippets, classifications, and refactoring targets. |
| [**`RENDERING_BOUNDARY_MATRIX.md`**](./RENDERING_BOUNDARY_MATRIX.md) | Architects & Reviewers | The authoritative demarcation matrix defining Boundary 1 (Extension-Owned UI), Boundary 2 (Host DOM Content Script Injections), and Boundary 3 (Encapsulated Browser Infrastructure Utilities). |
| [**`REFACTOR_PLAN.md`**](./REFACTOR_PLAN.md) | Orchestrators & Implementers | Four-batch phased roadmap (Batch A: Common/Settings, Batch B: Tracker/Config, Batch C: Dashboard/Analytics, Batch D: Overlays) detailing execution steps, test migration, and rollback safeguards. |
| [**`MIGRATION_BOARD.md`**](./MIGRATION_BOARD.md) | Team Leads & QA | Actionable Kanban tracking board itemizing every file, component, DOM count, status, owner, and verification command. |
| [**`VALIDATION_REPORT.md`**](./VALIDATION_REPORT.md) | Forensic Auditors & QA | Baseline validation metrics (92/92 test suites passing, 1,238/1,238 tests passing, 0 TypeScript errors, 37/37 isolation checks pass) and milestone exit criteria. |

---

## Core Architectural Standards

All user interface code in the extension must conform to the following standards without exception.

### 1. Component Authoring Standards

1. **Pure Functional Components**: All UI views, dialogs, cards, widgets, and form controls must be authored as Preact functional components using `FunctionalComponent<P>` (or standard typed function declarations). Class components and class-based UI controllers are strictly prohibited.
2. **Explicit TypeScript Prop Interfaces**: Every component must declare an explicit TypeScript interface named `<ComponentName>Props`. Never use `any` props.
   ```tsx
   import { h, FunctionalComponent, ComponentChildren } from 'preact';

   export interface StatCardProps {
     title: string;
     count: number;
     status?: 'success' | 'warning' | 'danger' | 'neutral';
     tooltip?: string;
     onClick?: () => void;
     children?: ComponentChildren;
   }

   export const StatCard: FunctionalComponent<StatCardProps> = ({
     title,
     count,
     status = 'neutral',
     tooltip,
     onClick,
     children,
   }) => {
     return (
       <div
         className={`stat-card stat-card--${status}`}
         title={tooltip}
         onClick={onClick}
         role={onClick ? 'button' : undefined}
         tabIndex={onClick ? 0 : undefined}
       >
         <span className="stat-card__title">{title}</span>
         <span className="stat-card__count">{count}</span>
         {children}
       </div>
     );
   };
   ```
3. **Immutable, Read-Only Props**: Props are read-only inputs representing the current state passed from parent components or hooks. Components must never mutate their incoming props.
4. **No Controller References in Props**: Components must NOT accept `manager={this}`, `controller={this}`, or `dashboard={this}`. Pass granular primitive data and strongly typed callback functions (e.g., `onSave={(card) => handleSave(card)}`, `onDelete={(id) => handleDelete(id)}`).
5. **No DOM Querying Inside Components**: Never call `document.getElementById()`, `document.querySelector()`, `document.querySelectorAll()`, or `target.closest()` inside a Preact component. Virtual DOM diffing renders direct DOM queries fragile and redundant.

---

### 2. Event Handling Architecture

1. **Declarative JSX Event Attributes**: All user interactions must be wired declaratively in JSX:
   - Click events: `onClick={(e) => handleClick(e)}` (replaces `btn.addEventListener('click', ...)`).
   - Form inputs: `onInput={(e) => setText((e.target as HTMLInputElement).value)}` for instant reactivity.
   - Form changes: `onChange={(e) => setChecked((e.target as HTMLInputElement).checked)}` for toggles and dropdowns.
   - Form submissions: `onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}`.
2. **Global Event Listeners**: Window- or document-level listeners (such as keyboard rating shortcuts `1`, `2`, `3`, `4`, or escape key handlers) must be bound inside a `useEffect` hook and **must** return a teardown function:
   ```tsx
   useEffect(() => {
     const handleKeyDown = (event: KeyboardEvent) => {
       if (['1', '2', '3', '4'].includes(event.key)) {
         handleRating(Number(event.key));
       }
     };

     window.addEventListener('keydown', handleKeyDown);
     return () => {
       window.removeEventListener('keydown', handleKeyDown);
     };
   }, [handleRating]);
   ```
3. **No Inline Anonymous Re-Bindings in Heavy Loops**: Pass stable callback references created via `useCallback` when rendering large lists of items (such as the data dashboard cards table or analytics pattern lists).

---

### 3. State & Reactivity Architecture

1. **Local State (`useState` / `useReducer`)**:
   - Use `useState` for simple local state (e.g., active tab ID, search input text, dropdown toggle, modal open/close status).
   - Use `useReducer` for complex state machines (e.g., card revision flow, FSRS parameter tuning wizard, Pomodoro timer phases).
2. **Persistent Extension Storage (`useStorage<T>`)**:
   - The primary data backbone of the extension is `chrome.storage.local`.
   - All components requiring persistent state must utilize the shared custom hook `@common/ui/hooks/useStorage.ts`:
     ```tsx
     const [settings, setSettings, loading] = useStorage<ExtensionSettings>(
       'extensionSettings',
       DEFAULT_SETTINGS
     );
     ```
   - `useStorage` automatically fetches data on mount, listens to `chrome.storage.onChanged` for cross-context updates (synchronizing popups, tabs, and background workers in real time), and removes its storage listener upon component unmounting.
3. **Persistent References (`useRef`)**:
   - Use `useRef` exclusively for:
     - Programmatic input focus: `inputRef.current?.focus()`.
     - Direct canvas drawing contexts (e.g., Sparkline charts, Canvas-based heatmaps).
     - Persisting non-rendering mutable identifiers (e.g., `timeoutId`, `animationFrameId`, `isMounted` flags).
   - **Never** use `useRef` to bypass Virtual DOM rendering or mutate element styles/classes imperatively.
4. **Memoized Computations (`useMemo`)**:
   - Memoize CPU-intensive calculations (such as FSRS retention forecasts, review log aggregations, and calendar date filtering) with `useMemo`.

---

### 4. Rendering Boundaries & Content Script Isolation

The extension operates across three distinct rendering boundaries established in `RENDERING_BOUNDARY_MATRIX.md`:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   EXTENSION ARCHITECTURE BOUNDARIES                    │
├──────────────────────────┬───────────────────────┬─────────────────────┤
│ BOUNDARY 1:              │ BOUNDARY 2:           │ BOUNDARY 3:         │
│ EXTENSION-OWNED UI       │ CONTENT SCRIPT HOST   │ SHARED UTILITIES &  │
│ (Virtual DOM Realm)      │ INJECTIONS            │ BROWSER POLYFILLS   │
├──────────────────────────┼───────────────────────┼─────────────────────┤
│ Scope:                   │ Scope:                │ Scope:              │
│ Popup, Analytics, Data,  │ LeetCode & AlgoMonster│ Download fallback & │
│ Settings, History, etc.  │ page overlays         │ pre-mount theme sync│
├──────────────────────────┼───────────────────────┼─────────────────────┤
│ Rules:                   │ Rules:                │ Rules:              │
│ • Mounts once at #root   │ • Host container div  │ • Encapsulated in   │
│ • 100% Preact owned      │   injected imperatively│  backupManager &    │
│ • ZERO imperative DOM    │ • Preact tree mounted │  theme-sync.ts      │
│ • ZERO innerHTML/styles  │   inside host container│ • BROWSER_CONFIG    │
│ • Single source of truth │ • render(null, host)  │   guards for Safari │
│   in Preact state        │   on teardown         │ • No direct feature │
│                          │ • Host DOM read-only  │   UI rendering      │
└──────────────────────────┴───────────────────────┴─────────────────────┘
```

1. **Extension-Owned UI (Boundary 1)**:
   - For all 17 standalone HTML pages (`popup.html`, `settings.html`, `data.html`, `analytics.html`, etc.), the extension has full control of the DOM environment.
   - The HTML page contains only `<head>` metadata, stylesheets, and `<div id="root"></div>`.
   - The TypeScript entry mounts once: `render(<App />, document.getElementById('root')!)`.
   - **Imperative DOM calls (`document.getElementById`, `querySelector`, `innerHTML`, `classList`, `element.style`) are strictly prohibited.**
2. **Content Script Host Injections (Boundary 2)**:
   - For in-page widgets (`features/tracker/tracker.tsx`, `features/highlighter/highlighter.tsx`, `content/notifications.ts`), the host page DOM is owned by LeetCode or AlgoMonster.
   - Creating a root container (`document.createElement('div')`), setting its ID (e.g., `#algo-fsrs-root`), and appending it to `document.body` is technically justified.
   - **Prohibition**: The interior of the widget MUST NOT be created using `container.innerHTML = '<div>...</div>'`. Instead, mount a Preact component: `render(<TrackerModal ... />, container)`.
   - **Teardown**: When closing or unmounting the widget, call `render(null, container)` to invoke all Preact `useEffect` cleanup routines before removing the container via `container.remove()`.
   - **Host DOM Inspection**: Read-only DOM scraping (extracting problem titles, tags, or text selection ranges) is technically justified.
3. **Shared Infrastructure & Browser Utilities (Boundary 3)**:
   - Creating a temporary hidden `<a>` element for file downloads is strictly encapsulated in `backupManager.ts` and `actionService.ts` as a fallback for Safari MV3 (which lacks `chrome.downloads`).
   - Synchronous `classList.add('light-theme')` on `document.documentElement` in `theme-sync.ts` runs in `<head>` before stylesheets load to prevent Flash of Unstyled Content (FOUC).

---

### 5. Lifecycle & Unmounting Standards

1. **Guaranteed Teardown**: Every timer (`setTimeout`, `setInterval`), request animation frame, or custom event listener created in a component must have an explicit cancellation in the `useEffect` cleanup return:
   ```tsx
   useEffect(() => {
     const timer = setInterval(() => {
       setSeconds((s) => s + 1);
     }, 1000);

     return () => clearInterval(timer);
   }, []);
   ```
2. **No Memory Leaks on Unmount**: When asynchronous tasks (such as storage fetches or background runtime messages) complete, verify the component is still mounted before invoking state setters:
   ```tsx
   useEffect(() => {
     let isMounted = true;
     chrome.storage.local.get(['fsrsCards'], (result) => {
       if (isMounted) {
         setCards(result.fsrsCards || []);
         setLoading(false);
       }
     });

     return () => {
       isMounted = false;
     };
   }, []);
   ```
3. **Content Script Widget Teardown**: Always call `render(null, hostElement)` prior to `hostElement.remove()`.

---

## Shared Library & Component Catalog

Before building UI elements, inspect and reuse existing components in `@common/ui/components/` and hooks in `@common/ui/hooks/`:

### 1. Components (`features/common/ui/components/`)

- **`Toggle` (`Toggle.tsx`)**: Accessible switch component with label, description, checked state, and `onChange` callback.
- **`Modal` (`Modal.tsx`)**: Accessible dialog overlay with backdrop, escape key listener, focus trap, title header, body, and action footer.
- **`Toast` (`Toast.tsx`)**: Floating notification banner supporting `success`, `error`, `warning`, and `info` variants with auto-dismiss timers.
- **`StatCard` (`StatCard.tsx`)**: Standardized KPI metric display card supporting labels, values, trend indicators, and click callbacks.
- **`Tabs` (`Tabs.tsx`)**: Reusable tab bar supporting ARIA tablist patterns, active tab indicator, and keyboard navigation.
- **`TagInput` (`TagInput.tsx`)**: Pure Preact chip-based tag editor with autocomplete dropdown and keyboard navigation (replaces `TagInputControl`).

### 2. Hooks (`features/common/ui/hooks/`)

- **`useStorage<T>` (`useStorage.ts`)**: Two-way reactive synchronization with `chrome.storage.local`.
- **`useTheme` (`useTheme.ts`)**: Syncs light/dark mode theme with system preferences and user settings.
- **`useDebounce<T>` (`useDebounce.ts`)**: Debounces rapidly changing values (such as search queries or filter inputs).
- **`useKeyboardShortcut` (`useKeyboardShortcut.ts`)**: Binds global hotkeys with automatic cleanup and input field guards.

---

## Directory Layout & Path Aliases

The codebase utilizes TypeScript path aliases mirrored across `tsconfig.json`, `webpack.config.js`, and `jest.config.js`:

```
@common/*    --> features/common/*
@tracker/*   --> features/tracker/*
@dashboard/* --> features/dashboard/*
```

### Directory Structure

```
algomonster-fsrs-extension/
├── background/                 # Service worker & background lifecycle
├── browser/                    # Per-browser manifest.json (chrome/, firefox/, safari/)
├── content/                    # Content script orchestration & host utilities
├── docs/
│   └── preact-remediation/     # Remediation documentation suite
│       ├── README.md
│       ├── PREACT_ARCHITECTURE_AUDIT.md
│       ├── DOM_API_INVENTORY.md
│       ├── RENDERING_BOUNDARY_MATRIX.md
│       ├── REFACTOR_PLAN.md
│       ├── MIGRATION_BOARD.md
│       ├── VALIDATION_REPORT.md
│       └── visual-audit/       # Visual parity comparison suite
├── features/
│   ├── common/                 # Shared utilities, services, components, hooks
│   │   ├── data/               # Data manager & backup utilities
│   │   ├── help/               # Help center page
│   │   ├── settings/           # Settings hub page
│   │   ├── ui/
│   │   │   ├── components/     # Shared Preact UI components
│   │   │   └── hooks/          # Shared Preact hooks
│   │   ├── websites/           # Whitelisted domains manager
│   │   └── welcome/            # First-run onboarding wizard
│   ├── dashboard/              # User dashboard & analytics views
│   │   ├── analytics/          # Multi-tab analytics SPA
│   │   ├── forecast/           # Retention forecast simulator
│   │   ├── heatmap/            # Study activity heatmap
│   │   ├── history/            # Review log calendar & history
│   │   ├── pomodoro/           # Pomodoro focus timer
│   │   ├── popup/              # Browser action popup
│   │   ├── studyplan/          # Study plan organizer
│   │   └── summary/            # Weekly/monthly summary report
│   ├── highlighter/            # In-page text highlighter & options
│   └── tracker/                # FSRS problem tracker & config
│       ├── config/             # FSRS parameter tuning interface
│       ├── editor/             # Card details modal editor
│       └── scheduler/          # FSRS scheduling algorithm engine
├── tests/
│   ├── unit/                   # Jest unit tests
│   ├── integration/            # Jest integration tests
│   └── e2e/                    # Playwright E2E & visual parity tests
└── types/                      # Ambient declarations (domain.ts, chrome.d.ts)
```

---

## Quality Gates & Verification Protocol

Every change must pass all four quality gates before completion:

```bash
# 1. Type Safety Check (Zero TypeScript errors)
npx tsc --noEmit

# 2. Automated Test Suite (All unit and integration tests pass)
npm test

# 3. Multi-Browser Webpack Compilation
npm run build

# 4. Browser Target Artifact Isolation Audit
npm run check:isolation:all
```

### Build & Package Safety Rules

1. **CopyPlugin Safety**: Webpack `CopyPlugin` must **never** copy raw `.ts` or `.tsx` files into `dist/`. All source code must be compiled by `ts-loader`.
2. **Cross-Browser Feature Detection**: Always guard browser-specific APIs behind `BROWSER_CONFIG` (e.g., `BROWSER_CONFIG.supportsNotifications`, `BROWSER_CONFIG.supportsDownloads`). Safari MV3 does not support notifications or downloads; unguarded calls cause fatal exceptions.
3. **HTML Entry Points**: HTML files in `features/` must reference compiled `.js` bundle files (e.g., `<script src="popup.js"></script>`), never `.ts` or `.tsx`.
4. **Git Branch Invariant**: The `main` branch (commit SHA `41fe481935c854548e3411a591b71df6371d6088`) is strictly read-only. All remediation work and commits reside solely on `preact`.
