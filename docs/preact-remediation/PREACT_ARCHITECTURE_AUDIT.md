# PREACT ARCHITECTURE AUDIT — The Hybrid Controller Trap & Remediation Blueprints

## Executive Summary

This architecture audit provides an exhaustive technical analysis of the Preact implementation across the AlgoRecall browser extension on the `preact` branch. It synthesizes findings from compiler-level AST audits, baseline branch surveys, and Preact 11 framework research.

The audit identifies a severe structural defect termed the **"Hybrid Controller Trap"** (or **"Facade Migration"**). While all 17 extension HTML entry points were updated to mount into `<div id="root"></div>`, the underlying TypeScript logic was not properly migrated to declarative Preact. Instead, legacy Vanilla JS controller classes and procedural DOM operations were preserved underneath superficial Preact JSX shells. 

Across 73 audited source files:
- **51 files** (69.8% of the codebase) execute **1,495 imperative DOM operations**.
- **1,426 operations** represent strict violations of **AGENTS.md Rule 3** and **Requirement R2**.
- **6 manually maintained DOM element cache structures** retain 65 mutable element pointers.
- Multiple modules suffer from **Split-Brain State**, where component state and class controller state diverge, causing race conditions and DOM desynchronization.

This document exposes the technical failure mechanisms of this architecture and delivers concrete component blueprints, state designs, and test migration strategies to achieve genuine declarative Preact 11 compliance.

---

## Part 1: Anatomy of the "Hybrid Controller Trap"

### 1.1 The Facade Migration Pattern

In an idiomatic Preact application, the Virtual DOM represents the complete, authoritative description of the user interface:

$$\text{UI} = f(\text{State})$$

When state changes, Preact calculates the minimal diff against the real DOM and applies targeted mutations.

In the current codebase, however, an anti-pattern was implemented where Preact is treated as an initial HTML template engine, after which a legacy class controller takes over and imperatively mutates the DOM nodes:

```
[HTML Entry Point]
       │
       ▼
[Preact mounts JSX Shell once into #root]
       │
       ▼
[Legacy Class Controller Instantiated: new Controller()]
       │
       ├─► 1. Caches DOM nodes: this.dom = { btn: document.getElementById('btn'), ... }
       ├─► 2. Attaches manual listeners: this.dom.btn.addEventListener('click', ...)
       ├─► 3. Stores UI state in class fields: this.currentTab = 'readiness'
       ├─► 4. Mutates DOM directly: el.innerHTML = '...', el.classList.add('active')
       └─► 5. Bypasses Virtual DOM diffing completely!
```

### 1.2 The Six Technical Failure Modes

#### Failure Mode 1: Virtual DOM Reconciliation Overwrite
When a Preact component re-renders (triggered by a hook or prop update), Preact's diffing algorithm compares its new VNode tree against the existing DOM. Any imperative changes applied directly to the DOM by class controllers—such as `element.style.display = 'none'`, `element.classList.add('active')`, or `element.innerText = 'Updated'`—are wiped out if they are not represented in the VNode props. Conversely, if a class controller mutates a node while Preact is mid-diff, elements can be orphaned or state corruptions occur.

#### Failure Mode 2: Split-Brain State & Mutation Race Conditions
UI state is duplicated between class instance variables and component state:
- Example from `features/dashboard/popup/popup.tsx`: `this.activeTab` on `AlgoRecallDashboard` versus state in sub-components.
- Example from `features/tracker/config/fsrsConfig.tsx`: `FSRSConfigManager.currentMode` ('simple' vs 'advanced') is stored on the class, while mode switching modifies classes imperatively:
  ```ts
  simpleBtn?.classList.add('active');
  document.querySelectorAll<HTMLElement>('.advanced-config-only').forEach(el => {
    el.style.display = 'none';
  });
  ```
Because Preact has no awareness of these class property mutations, neither component re-renders nor unidirectional data flows take place.

#### Failure Mode 3: Memory Leaks from Stale Event Listeners
Class controllers bind event listeners via `addEventListener` during initialization:
```ts
this.dom.exportBtn?.addEventListener('click', () => this.handleExport());
```
If Preact conditionally unmounts or re-renders the parent container, the element may be removed from the DOM, but the closure in the controller remains in memory. If re-rendered, new listeners are bound without tearing down previous ones, leading to duplicate event dispatches and memory leaks.

#### Failure Mode 4: Stale DOM Element Caches
In `features/dashboard/popup/popup.tsx` (interface `PopupDOM`) and `features/common/settings/settings.tsx` (`this.dom = { ... }`), controllers query dozens of elements on startup. If any dynamic feature conditionally removes a subtree (e.g. `{showCharts && <ActivityCharts />}`), the cached element pointers point to detached DOM nodes. Calling methods on detached nodes succeeds silently without updating what the user sees on screen.

#### Failure Mode 5: Multi-Mount Sub-Tree Injections
In `features/dashboard/analytics/analytics.tsx` lines 577–580:
```ts
this.tabs[tabId]!.render('tab-' + tabId);
```
Rather than managing tab routing declaratively, the controller mounts isolated Preact sub-trees into dynamically queried DOM container IDs. These disconnected sub-trees cannot share context providers, do not participate in a unified lifecycle, and require manual teardown logic.

#### Failure Mode 6: Raw HTML String Injections & XSS Hazards
Across 24 files, `innerHTML` is used 80 times to render cards, tables, and notifications:
- `features/dashboard/popup/popup.tsx:1341`: Toast notification generated via `el.innerHTML = iconHtml + \`<span>\${msg}</span>\``.
- `features/tracker/tracker.tsx:743-799`: In-page floating widget interior generated via a 70-line string template assigned to `container.innerHTML`.
This bypasses Virtual DOM diffing, breaks typed prop guarantees, and creates potential XSS vulnerabilities if user-supplied strings are interpolated.

---

## Part 2: Idiomatic Preact 11 Architectural Blueprint

To remediate these defects, all extension interfaces must adhere to the following architecture.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   PURE DECLARATIVE PREACT ARCHITECTURE                 │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                     Top-Level Application                      │   │
│   │       (e.g., <PopupApp />, <SettingsApp />, <AnalyticsApp />)  │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ State & Callbacks                  │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                      Preact Custom Hooks                       │   │
│   │    • useStorage<T>(key, default) ──► chrome.storage.local      │   │
│   │    • useReducer(reducer, initial)  • useTheme()                │   │
│   │    • useState()                    • useKeyboardShortcut()     │   │
│   └───────────────────────────────┬────────────────────────────────┘   │
│                                   │ Unidirectional Data Flow           │
│                                   ▼                                    │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │                  Pure Functional Components                    │   │
│   │   • Explicit <ComponentName>Props interfaces                   │   │
│   │   • Declarative JSX event handlers: onClick, onInput, onChange │   │
│   │   • Conditional rendering: {isOpen && <Modal />}               │   │
│   │   • Dynamic styling: className={`tab ${isActive ? 'act' : ''}`}│   │
│   │   • Strict effect cleanup: return () => window.removeListener  │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Pure Functional Components with Explicit Interfaces

Every component is a typed function accepting read-only props:

```tsx
import { h, FunctionalComponent, ComponentChildren } from 'preact';

export interface TabButtonProps {
  id: string;
  label: string;
  icon?: string;
  isActive: boolean;
  badgeCount?: number;
  onSelect: (id: string) => void;
  children?: ComponentChildren;
}

export const TabButton: FunctionalComponent<TabButtonProps> = ({
  id,
  label,
  icon,
  isActive,
  badgeCount,
  onSelect,
  children
}) => {
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={isActive}
      aria-controls={`panel-${id}`}
      className={`tab-btn ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(id)}
    >
      {icon && <span className={`tab-icon ${icon}`} aria-hidden="true" />}
      <span className="tab-label">{label}</span>
      {typeof badgeCount === 'number' && badgeCount > 0 && (
        <span className="tab-badge">{badgeCount}</span>
      )}
      {children}
    </button>
  );
};
```

### 2.2 Storage Reactivity with `useStorage<T>`

Because browser extension pages (popup, settings, background worker, content scripts) run in decoupled threads, `chrome.storage.local` is the single source of truth. The `useStorage` hook bridges Preact state and extension storage:

```tsx
import { useState, useEffect, useCallback } from 'preact/hooks';

export function useStorage<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => Promise<void>, boolean] {
  const [storedValue, setStoredValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Initial Load
  useEffect(() => {
    let isMounted = true;
    chrome.storage.local.get([key], (result) => {
      if (isMounted) {
        if (result[key] !== undefined) {
          setStoredValue(result[key]);
        }
        setLoading(false);
      }
    });

    // 2. Multi-Context Reactive Listener
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[key]) {
        if (isMounted) {
          setStoredValue(changes[key].newValue ?? defaultValue);
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);

    // 3. Strict Teardown
    return () => {
      isMounted = false;
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  }, [key, defaultValue]);

  // 4. Reactive Async Setter
  const setValue = useCallback(
    async (value: T | ((prev: T) => T)) => {
      const valueToStore =
        typeof value === 'function'
          ? (value as (prev: T) => T)(storedValue)
          : value;
      setStoredValue(valueToStore);
      await chrome.storage.local.set({ [key]: valueToStore });
    },
    [key, storedValue]
  );

  return [storedValue, setValue, loading];
}
```

### 2.3 Cross-Browser API Guards (`BROWSER_CONFIG`)

In accordance with **AGENTS.md Rule 4**, all browser-specific APIs must be gated behind capability flags:

```tsx
import { BROWSER_CONFIG } from '@common/browserConfig';

export const NotificationSettingsCard: FunctionalComponent = () => {
  // Safari 15.4+ MV3 does not support chrome.notifications
  if (!BROWSER_CONFIG.supportsNotifications) {
    return (
      <div className="card card--disabled" role="note">
        <p>Notifications are not supported by this browser target.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3>Notification Preferences</h3>
      {/* Declarative controls */}
    </div>
  );
};
```

---

## Part 3: Module-by-Module Component Refactoring Blueprints

Below are the architectural specifications for the major modules to be refactored.

### Blueprint 1: Popup Dashboard (`features/dashboard/popup/`)

- **Current State**: `popup.tsx` (96 DOM ops), `stats.tsx` (60 DOM ops), `notifications.tsx` (62 DOM ops), `rating.tsx` (17 DOM ops), `search.tsx` (28 DOM ops), `heatmap.tsx` (14 DOM ops). Controller class `AlgoRecallDashboard` with `PopupDOM` element cache.
- **Target State**: Pure Preact application `<PopupApp />` mounting into `#root`.

```
<PopupApp>
  ├── <PopupHeader>
  │     ├── <LogoHeader />
  │     ├── <QuickActionNav> (Analytics, Heatmap, History, Settings buttons)
  │     └── <ThemeToggleButton />
  ├── <PopupStatsOverview> (Due Today, Total Cards, Retention Rate)
  │     ├── <StatCard title="Due Today" count={dueCount} status={urgency} />
  │     ├── <StatCard title="Total Patterns" count={totalCount} />
  │     └── <StatCard title="Retention" count={`${retention}%`} />
  ├── <QuickRatingSection> (Current problem rating buttons 1-4)
  ├── {settings.showCharts && <PopupActivityCharts activityData={activity} />}
  ├── {settings.showDailyFocus && <DailyFocusGoalCard />}
  ├── <PopupFooter>
  └── {toast && <Toast message={toast.message} status={toast.status} />}
</PopupApp>
```

- **State Model**:
  ```ts
  interface PopupState {
    cards: FSRSCard[];
    settings: ExtensionSettings;
    todayStats: StudyStats;
    currentProblem: ProblemMetadata | null;
    toast: { message: string; status: 'success' | 'error' } | null;
    activeTab: 'overview' | 'actions' | 'settings';
  }
  ```
- **Eliminations**: Delete `AlgoRecallDashboard`, `PopupDOM`, imperative `stats.tsx`, and manual DOM caches.

---

### Blueprint 2: Settings Hub (`features/common/settings/settings.tsx`)

- **Current State**: 85 DOM operations. 600-line legacy `SettingsController` class maintaining `this.dom` (32 element fields) and dual bootstrap logic.
- **Target State**: `<SettingsApp />` with `useSettings()` hook.

```
<SettingsApp>
  ├── <SettingsSidebar activeTab={activeTab} onSelectTab={setActiveTab} />
  └── <SettingsContentArea>
        {activeTab === 'general' && <GeneralSettingsPanel />}
        {activeTab === 'notifications' && <NotificationsSettingsPanel />}
        {activeTab === 'backup' && <BackupRestorePanel />}
        {activeTab === 'fsrs' && <FSRSQuickConfigPanel />}
        {activeTab === 'about' && <AboutExtensionPanel />}
      </SettingsContentArea>
</SettingsApp>
```

- **Eliminations**: Delete `SettingsController`, delete `this.dom`, remove manual `addEventListener` attachments, wire all inputs to `settings` state via `onChange`/`onInput`.

---

### Blueprint 3: Analytics Dashboard SPA (`features/dashboard/analytics/`)

- **Current State**: 82 DOM operations. `AnalyticsDashboardSPA` imperatively toggles `.tab-pane.active` and calls `tabId.render('tab-' + tabId)`.
- **Target State**: Single-mount declarative `<AnalyticsApp />`.

```
<AnalyticsApp>
  ├── <AnalyticsHeader totalCards={cards.length} retention={stats.retention} />
  ├── <AnalyticsNavigation activeTab={activeTab} onSelectTab={setActiveTab} />
  └── <main className="analytics-main">
        {activeTab === 'overview' && <OverviewTab cards={cards} activity={activity} />}
        {activeTab === 'readiness' && <ReadinessTab cards={cards} />}
        {activeTab === 'memory' && <MemoryTab cards={cards} />}
        {activeTab === 'simulation' && <SimulationTab cards={cards} />}
        {activeTab === 'tags' && <TagsTab cards={cards} />}
        {activeTab === 'performance' && <PerformanceTab cards={cards} />}
        {activeTab === 'insights' && <InsightsTab cards={cards} />}
      </main>
</AnalyticsApp>
```

- **Eliminations**: Delete `AnalyticsDashboardSPA`, remove imperative `tabId.render()` sub-mounts, replace DOM subtitle mutations with declarative props.

---

### Blueprint 4: FSRS Configuration (`features/tracker/config/fsrsConfig.tsx`)

- **Current State**: 104 DOM operations. `FSRSConfigManager` with imperative mode switching (`.advanced-config-only`), weight slider reads, and optimization status banners.
- **Target State**: `<FSRSConfigApp />` with `useReducer` managing parameters and optimization worker lifecycle.

```
<FSRSConfigApp>
  ├── <ConfigHeader mode={mode} onModeChange={setMode} />
  ├── <QuickParametersCard weights={weights} onChange={updateWeight} />
  ├── {mode === 'advanced' && (
        <AdvancedParametersSection
          weights={weights}
          requestRetention={requestRetention}
          maxInterval={maxInterval}
          onChange={updateWeight}
        />
      )}
  ├── <OptimizationControls
        isOptimizing={isOptimizing}
        onStartOptimization={handleOptimize}
        onResetDefaults={handleReset}
      />
  └── {status && <OptimizationStatusCard status={status} />}
</FSRSConfigApp>
```

- **Eliminations**: Delete `FSRSConfigManager`, eliminate `classList.add('active')` and `style.display = 'none'`, wire sliders to state.

---

### Blueprint 5: In-Page Content Script Overlays

- **Target Files**: `features/tracker/tracker.tsx` (150 DOM ops in widget body), `features/highlighter/highlighter.tsx` (41 DOM ops in tooltip), `content/notifications.ts` (19 DOM ops in toast).
- **Target Architecture**: Strict Boundary 2 isolation.

```
┌────────────────────────────────────────────────────────────────────────┐
│ HOST PAGE DOM (LeetCode / AlgoMonster)                                 │
│                                                                        │
│   ┌────────────────────────────────────────────────────────────────┐   │
│   │ <div id="algo-fsrs-root" class="algo-fsrs-host-container">     │   │
│   │                                                                │   │
│   │   Preact Tree Mounted via render(<TrackerOverlay />, host):    │   │
│   │                                                                │   │
│   │   <TrackerOverlay problem={problem} card={card}>               │   │
│   │     ├── <TrackerFloatingLauncher isExpanded={isExpanded} />    │   │
│   │     └── {isExpanded && (                                       │   │
│   │           <TrackerModal onClose={handleClose}>                 │   │
│   │             ├── <TrackerHeader problem={problem} />            │   │
│   │             ├── <TrackerNavBar activeView={view} />            │   │
│   │             ├── <TrackerCardReview card={card} />              │   │
│   │             └── <TrackerRatingBar onRate={handleRate} />       │   │
│   │           </TrackerModal>                                      │   │
│   │         )}                                                     │   │
│   │   </TrackerOverlay>                                            │   │
│   │                                                                │   │
│   └────────────────────────────────────────────────────────────────┘   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

- **Lifecycle Pattern**:
  ```ts
  // 1. Mount Boundary
  let hostEl = document.getElementById('algo-fsrs-root');
  if (!hostEl) {
    hostEl = document.createElement('div');
    hostEl.id = 'algo-fsrs-root';
    document.body.appendChild(hostEl);
  }
  render(<TrackerOverlay problem={problem} />, hostEl);

  // 2. Teardown Boundary
  export function teardownTracker() {
    const hostEl = document.getElementById('algo-fsrs-root');
    if (hostEl) {
      render(null, hostEl); // Executes all Preact useEffect cleanups
      hostEl.remove();
    }
  }
  ```

---

## Part 4: Unit Test Migration Strategy

### 4.1 The Test Coupling Problem

An inspection of `tests/unit/` reveals that several test suites test the legacy controller classes rather than Preact components:
- `tests/unit/features/common/settings/settings.test.ts`: Directly executes `new SettingsController()`, populates `document.body.innerHTML` with mock HTML, and asserts against DOM elements.
- `tests/unit/features/dashboard/popup/popup.test.ts`: Instantiates `new AlgoRecallDashboard()` against mocked HTML fixtures.
- `tests/unit/features/tracker/config/fsrsConfig.test.ts`: Instantiates `new FSRSConfigManager()`.

If these controller classes are deleted without updating the tests, `npm test` will fail.

### 4.2 Two-Phase Test Migration Protocol

To guarantee continuous test passing throughout refactoring:

#### Phase A: Adapter Facade Coexistence (Transition Phase)
During the transition of each module, create a lightweight compatibility facade or test helper that exposes the legacy class methods (e.g. `init()`, `bindEvents()`, `saveSettings()`) implemented as delegates to the underlying business logic or custom hooks.

#### Phase B: Idiomatic Component & Hook Testing (Target Phase)
Refactor unit tests to test declarative Preact components and custom hooks directly using standard testing patterns:
1. **Hook Testing**: Test `useStorage`, `usePomodoroTimer`, and `useSettings` directly by exercising their state changes and storage reactions.
2. **Component Testing**: Render components into a test container (`render(<Component ... />, container)`) and assert on output VNode structure, accessibility attributes (`aria-selected`, `role`), and event handler callbacks.
3. **Clean Teardown**: Call `render(null, container)` in `afterEach()` blocks to ensure zero test state leakage.

```ts
import { h, render } from 'preact';
import { StatCard } from '@common/ui/components/StatCard';

describe('StatCard Component', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    render(null, container);
    container.remove();
  });

  it('renders title and count correctly', () => {
    render(<StatCard title="Due Today" count={5} status="warning" />, container);
    
    expect(container.querySelector('.stat-card__title')?.textContent).toBe('Due Today');
    expect(container.querySelector('.stat-card__count')?.textContent).toBe('5');
    expect(container.querySelector('.stat-card--warning')).not.toBeNull();
  });
});
```

---

## Part 5: Verification & Architectural Conformance Checklist

Implementers and reviewers must check every refactored file against this checklist:

| Verification Checkpoint | Target Standard | Verification Method |
| :--- | :--- | :--- |
| **Component Model** | 100% Pure Functional Components with explicit `<Props>` interface | Static AST inspection (`audit-scanner.js`) |
| **Zero DOM Queries** | Zero `getElementById`, `querySelector`, or `querySelectorAll` in extension UI | `grep -n "document.getElementById" <file>` |
| **Zero Imperative Mutations** | Zero `innerHTML`, `textContent`, `classList`, `element.style` mutations | `grep -n "innerHTML" <file>` |
| **Zero Element Caches** | Zero cached DOM interfaces (`PopupDOM`, `this.dom`) | Inspection of type definitions |
| **Declarative Events** | All UI interactions wired via JSX event attributes (`onClick`, etc.) | Code review |
| **Storage Reactivity** | All extension state synchronized via `useStorage` with cleanup | Inspection of `chrome.storage.onChanged` handling |
| **Build & Type Safety** | Clean compilation across Chrome, Firefox, Safari with 0 type errors | `npx tsc --noEmit && npm run build` |
| **Test Passing** | 100% unit and integration tests passing | `npm test` |
| **Isolation Audit** | Multi-browser manifest and string isolation verified | `npm run check:isolation:all` |
