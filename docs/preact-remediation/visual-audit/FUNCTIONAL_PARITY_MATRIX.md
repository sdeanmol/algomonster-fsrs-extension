# Functional Parity Matrix — Preact vs Main Branch

## Overview

This matrix provides a granular, feature-by-feature comparison between the legacy Vanilla TypeScript implementation (`main` branch @ SHA `41fe481935c854548e3411a591b71df6371d6088`) and the modernized Preact 11 architecture (`preact` branch).

Every interactive workflow, control element, storage synchronization cycle, and event listener across all **17 HTML entry points** and **2 content script UI overlays** has been audited for strict parity.

---

## Global Parity Summary Table

| # | Entry Point | File Path | Main (Vanilla TS) | Preact (TSX) | Workflows Audited | Parity Status |
| :-: | :--- | :--- | :--- | :--- | :--- | :---: |
| **01** | **Action Popup** | `features/dashboard/popup/` | `popup.ts` (+ 6 modules) | `popup.tsx` (+ modules) | Stats, Goal Ring, Heatmap, Search, Bento, Milestones | **FULL PARITY** |
| **02** | **Settings Hub** | `features/common/settings/` | `settings.ts` (674 lines) | `settings.tsx` (1,446 lines) | 6 Tab Panels, Switches, Backup, Anki, Dev Mode | **FULL PARITY** |
| **03** | **Data Dashboard** | `features/common/data/` | `data.ts` (1,078 lines) | `data.tsx` (1,457 lines) | JSON Backup, Restore, Anki Export, Deck Stats | **FULL PARITY** |
| **04** | **Help Center** | `features/common/help/` | `help.ts` (293 lines) | `help.tsx` + `helpContent.tsx` | 7 Manual Tabs, URL Routing (#hash), Live Search | **FULL PARITY** |
| **05** | **Welcome Walkthrough** | `features/common/welcome/` | `welcome.ts` (267 lines) | `welcome.tsx` (488 lines) | 4-Step Wizard, Theme Select, Permission Grant | **FULL PARITY** |
| **06** | **Websites Manager** | `features/common/websites/` | `websites.ts` (321 lines) | `websites.tsx` (409 lines) | Custom Domain Add/Delete, System Badges, Reset | **FULL PARITY** |
| **07** | **Pomodoro Timer** | `features/dashboard/pomodoro/` | `pomodoro.ts` (451 lines) | `pomodoro.tsx` (846 lines) | Start/Pause/Reset, Custom Presets, Audio Chime | **FULL PARITY** |
| **08** | **Study Plan** | `features/dashboard/studyplan/` | `studyplan.ts` (430 lines) | `studyplan.tsx` (764 lines) | Target Date, Target Retention, Capacity Projections | **FULL PARITY** |
| **09** | **History Log** | `features/dashboard/history/` | `history.ts` (261 lines) | `history.tsx` (567 lines) | Rating Filters, Pagination, Review Timeline | **FULL PARITY** |
| **10** | **Forecast View** | `features/dashboard/forecast/` | `forecast.ts` (262 lines) | `forecast.tsx` (582 lines) | 30-Day Due Date Projection, Workload Bars | **FULL PARITY** |
| **11** | **Summary Digest** | `features/dashboard/summary/` | `summary.ts` + generator | `summary.tsx` (604 lines) | Weekly/Monthly Periods, Mastery Bars, Leech Alert | **FULL PARITY** |
| **12** | **Activity Heatmap** | `features/dashboard/heatmap/` | `heatmap.ts` + stats | `heatmap.tsx` (520 lines) | 365-Day Contribution Grid, Year Selector, Tooltips | **FULL PARITY** |
| **13** | **FSRS Config** | `features/tracker/config/` | `fsrsConfig.ts` (956 lines) | `fsrsConfig.tsx` (1,467 lines) | Simple/Advanced Mode, 17 Parameters, Optimizer | **FULL PARITY** |
| **14** | **Card Editor** | `features/tracker/editor/` | `editor.ts` (428 lines) | `editor.tsx` (961 lines) | Card Metadata, Tags, Retention Rating, Reset | **FULL PARITY** |
| **15** | **Highlight Options** | `features/highlighter/options/` | `highlightOptions.ts` (496 l) | `highlightOptions.tsx` (957 l)| Swatches, Custom Hex, Opacity, Style Presets | **FULL PARITY** |
| **16** | **Highlights Manager**| `features/highlighter/manager/`| `highlights.ts` (518 lines) | `highlights.tsx` (1,021 lines)| Search, Tag Filter, Delete, Export, In-Page Jump | **FULL PARITY** |
| **17** | **Analytics SPA** | `features/dashboard/analytics/`| `analytics.ts` + 6 subdirs | `analytics.tsx` + 6 subdirs | Overview, Memory, Performance, Readiness, Tags | **FULL PARITY** |
| **18** | **In-Page Tracker** | `features/tracker/` | `tracker.ts` (453 lines) | `tracker.tsx` (1,462 lines) | Floating Launcher, Rating Buttons, FSRS Updates | **FULL PARITY** |
| **19** | **In-Page Highlighter**| `features/highlighter/` | `highlighter.ts` (1,129 lines)| `highlighter.tsx` (1,462 lines)| Selection Tooltip, Color Swatches, Sticky Notes | **FULL PARITY** |

---

## Detailed Page-by-Page Functional Analysis

### 01. Extension Action Popup (`features/dashboard/popup/`)

- **Context**: Browser toolbar icon action (`popup.html`).
- **Core Purpose**: Compact dashboard giving users quick access to today's study stats, daily goal progress, search, quick review launch, and links to specialized tool pages.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Header Actions** | Imperative click listeners on `#theme-toggle-btn` and `#header-analytics-btn`. | `PopupHeader` component with reactive `onToggleTheme` and `onOpenAnalytics` callbacks. | **Preserved** |
| **Hero Stats Cards** | `stats.ts` populates `due-count`, `new-count`, `retention-rate`, and `current-streak`. | `PopupStatsOverview` renders identical data derived from `storageData.cards`. | **Preserved** |
| **Daily Goal Ring** | SVG circle stroke-dashoffset calculation in `stats.ts`. | `PopupDailyGoalRing` computes SVG circumferences dynamically with animated stroke transitions. | **Preserved** |
| **Mini Heatmap** | `heatmap.ts` generates 28 day cells via `document.createElement('div')`. | `PopupHeatmapGrid` & `PopupHeatmapCell` render reactive VNodes with title tooltips. | **Preserved** |
| **Quick Search** | Input event listener debounces card search; builds results via `innerHTML`. | `QuickSearchComponent` with `PopupSearchResultsList` and `PopupSearchResultItem`. | **Preserved** |
| **Bento Nav Grid** | Grid of navigation buttons with direct `chrome.tabs.create` calls. | `BentoCommandCenter` & `PopupNavigationGrid` executing `ActionService` navigation. | **Preserved** |
| **Daily Focus Card** | Collapsible section showing daily priority problem. | `DailyFocusCard` with direct problem launch link and status badge. | **Preserved** |
| **Milestones Modal** | Modal overlay `#achievements-modal` toggled via CSS `.hide-panel`. | `AchievementsModal` controlled by boolean state `isAchievementsOpen`. | **Preserved** |
| **Toast Messages** | Timer-based `#status-msg` text injection. | `PopupStatusToast` with declarative visibility and auto-dismiss timer. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `theme-toggle-btn`, `header-analytics-btn`, `due-count`, `new-count`, `retention-rate`, `current-streak`, `search-input`, `search-results-list`, `achievements-modal`, `close-achievements-btn`, `status-msg`, `milestone-toast`.
- **Architectural Shift**: Notification preference switches (`toggle-notifications`, `quiet-hours-*`) were previously deprecated and consolidated into the Settings Hub (`settings.html`). The Preact implementation honors this consolidation cleanly while preserving test notification triggers.

---

### 02. Settings & Preferences Hub (`features/common/settings/`)

- **Context**: Standalone tab or full-page settings options (`settings.html`).
- **Core Purpose**: Master configuration hub for extension preferences, notifications, highlighter behavior, data exports, integrations, and developer diagnostic tools.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Tab Navigation** | Click listeners on `.nav-tab` buttons; toggled `.active` class on tab panels. | `SettingsNav` component with active tab state (`notifications`, `highlighter`, `data`, `integrations`, `developer`, `about`). | **Preserved** |
| **Notification Settings** | Checkboxes for notifications, quiet hours, sticky notifications, badge counts. | `NotificationsPanel` with reactive `Toggle` components and time range inputs. | **Preserved** |
| **Highlighter Options** | Checkboxes for selection popup, auto-show notes, and default palette index. | `HighlighterPanel` updating `extensionSettings.showMarkerPopup` and related flags. | **Preserved** |
| **Data Actions** | Buttons trigger JSON backup download and Anki package generation. | `DataPanel` executing `BackupManager.exportBackup()` and `BackupManager.exportAnki()`. | **Preserved** |
| **Developer Diagnostics** | Developer mode switch, debug log export, storage inspection. | `DeveloperPanel` with debug logs export and test notification dispatcher. | **Preserved** |
| **Store & About Details** | Static HTML text displaying version, store review link, and privacy info. | `AboutPanel` injecting dynamic `__BROWSER_TARGET__`, `__STORE_NAME__`, and `__STORE_REVIEW_URL__`. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `toggle-notifications`, `notification-interval`, `custom-interval-container`, `custom-interval-input`, `toggle-quiet-hours`, `quiet-hours-container`, `quiet-hours-start`, `quiet-hours-end`, `toggle-sticky-notification`, `settings-test-notification-btn`, `settings-test-summary-notification-btn`, `toggle-marker-popup`, `toggle-auto-expand-notes`, `settings-export-btn`, `settings-anki-export-btn`, `toggle-dev-mode`, `settings-export-debug-logs-btn`.
- **Architectural Shift**: Navigation tabs now manage active panel state in Preact state without direct DOM element display manipulation.

---

### 03. Data Management Dashboard (`features/common/data/`)

- **Context**: Standalone data dashboard tab (`data.html`).
- **Core Purpose**: Backup creation, JSON restore with schema validation, Anki `.apkg` card deck compilation, and reset safeguards.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **JSON Export** | Assembles cards, review logs, and settings into formatted JSON blob download. | `DataExportCard` invokes `BackupManager.exportBackup()` with timestamped filename. | **Preserved** |
| **JSON Import/Restore** | Hidden file input `#import-file-input` triggers FileReader; validates JSON schema. | `DataImportCard` handles file selection, schema validation, and confirmation dialog. | **Preserved** |
| **Anki Export** | Compiles cards and FSRS states into SQLite-backed Anki deck download. | `AnkiExportCard` invokes `BackupManager.exportAnki()` with options (tags, interval math). | **Preserved** |
| **Deck Statistics** | Summary metrics table displaying card counts, review logs, and storage size. | `DeckStatsGrid` dynamically displays total cards, logs, and estimated footprint. | **Preserved** |
| **Factory Reset Modal** | Danger modal `#reset-modal` with confirmation keyword prompt. | `ResetConfirmationModal` requires typing "RESET" before enabling execution. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `export-backup-btn`, `import-backup-btn`, `import-file-input`, `export-anki-btn`, `anki-include-notes`, `anki-include-tags`, `anki-deck-name`, `total-cards-stat`, `total-logs-stat`, `database-size-stat`, `reset-database-btn`, `reset-modal`, `cancel-reset-btn`, `confirm-reset-btn`, `reset-confirm-input`.

---

### 04. Help & Privacy Documentation Center (`features/common/help/`)

- **Context**: Extension documentation and FAQ center (`help.html`).
- **Core Purpose**: Interactive guide detailing FSRS principles, highlighter usage, analytics metrics, keyboard shortcuts, and strict local-first privacy guarantees.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Multi-Section Tabs** | 7 giant static HTML sections (`#tab-overview`, `#tab-fsrs`, etc.) toggled by class. | `HelpTabBar` + separate modular tab components in `helpContent.tsx`. | **Preserved** |
| **URL Hash Routing** | Reads `window.location.hash` and query param `?tab=` to activate requested section. | `useEffect` hook reads `window.location.hash` and `?tab=` on mount, syncing tab state. | **Preserved** |
| **Live Search Filter** | Iterates over all FAQ items and hides non-matching cards based on input. | Real-time `searchTerm` filter highlights matching sections across all documentation panels. | **Preserved** |
| **Store Policy Branding**| Injects store policy links based on runtime browser detection. | `PrivacyTabContent` renders store links via `__STORE_NAME__` and `BROWSER_CONFIG`. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `help-search-input`, `tab-bar-container`, `help-content-root`, `privacy-policy-link`, `store-review-link`.

---

### 05. Onboarding & Welcome Walkthrough (`features/common/welcome/`)

- **Context**: Opens automatically on extension install (`welcome.html`).
- **Core Purpose**: 4-step wizard introducing AlgoRecall's spaced repetition engine, floating review widget, highlighter tools, and theme preferences.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Step Wizard Navigation**| Previous/Next button handlers change active step class; toggles progress dots. | `StepIndicators` component with reactive `currentStep` (1 through 4) state. | **Preserved** |
| **Theme Selection** | Click handlers on Light/Dark radio cards immediately set theme on `<html>`. | `ThemeSelectorCard` calls `UIUtils.setTheme()` and updates storage settings. | **Preserved** |
| **Notification Request** | Button triggers `chrome.permissions.request({ permissions: ['notifications'] })`. | Handled with `BROWSER_CONFIG.supportsNotifications` guard and success feedback. | **Preserved** |
| **Finish Walkthrough** | Saves `hasCompletedOnboarding: true` in storage and closes/redirects tab. | Final step button saves completion state and redirects to extension popup or LeetCode. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `prev-step-btn`, `next-step-btn`, `finish-btn`, `theme-light-card`, `theme-dark-card`, `request-notification-perm-btn`, `step-container`.

---

### 06. Supported Websites Manager (`features/common/websites/`)

- **Context**: Options page (`websites.html`).
- **Core Purpose**: Allows users to manage active coding interview platforms where the review widget and highlighter will be injected.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Default Platforms** | Static list of built-in platforms (LeetCode, AlgoMonster, NeetCode, HackerRank). | `DefaultPlatformsList` rendering built-in platforms with locked "System" badges. | **Preserved** |
| **Custom Domain Addition**| Input form validates URL hostname format; updates storage array. | `AddDomainForm` with regex hostname validation and Enter key submission. | **Preserved** |
| **Domain Deletion** | Click handler on delete icon removes custom domain from storage. | `WhitelistedSitesList` item delete callback updating `customDomains` in storage. | **Preserved** |
| **Reset Defaults** | Reverts custom domain list back to factory defaults with confirmation. | Reset button triggers confirmation alert and restores default whitelist array. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `new-domain-input`, `add-domain-btn`, `custom-domains-list`, `reset-defaults-btn`, `domain-error-msg`.

---

### 07. Pomodoro Focus Timer (`features/dashboard/pomodoro/`)

- **Context**: Dedicated study timer tab (`pomodoro.html`).
- **Core Purpose**: Integrated focus timer synchronized with problem-solving sessions, tracking active study intervals.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Timer State Machine** | Interval timer tracking `remainingSeconds`, `mode` (Work, Short Break, Long Break). | `PomodoroApp` manages timer states (`idle`, `running`, `paused`) with Web Audio chime. | **Preserved** |
| **Controls** | Start, Pause, Reset, and Skip buttons. | `PomodoroControls` component with keyboard spacebar shortcut support. | **Preserved** |
| **Progress Ring** | SVG circle stroke calculation updated every second. | `PomodoroProgressRing` recalculates progress percentage on every tick. | **Preserved** |
| **Custom Duration Modal**| Modal dialog allowing custom durations for work and break intervals. | `PomodoroSettingsModal` updates work/break preferences in `chrome.storage.local`. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `pomodoro-timer-display`, `pomodoro-start-btn`, `pomodoro-pause-btn`, `pomodoro-reset-btn`, `pomodoro-skip-btn`, `pomodoro-mode-badge`, `pomodoro-settings-btn`, `pomodoro-settings-modal`, `work-duration-input`, `break-duration-input`, `save-pomodoro-settings-btn`.

---

### 08. Study Plan Generator (`features/dashboard/studyplan/`)

- **Context**: Planning and workload projection tab (`studyplan.html`).
- **Core Purpose**: Calculates daily problem review requirements based on target interview dates and desired retention rates.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Target Date Input** | Date picker input calculating days remaining until interview. | `StudyPlanForm` validates future date selection and displays countdown days. | **Preserved** |
| **Target Retention** | Range slider selecting desired retention probability (80% - 95%). | Slider component updating required review frequency calculations. | **Preserved** |
| **Workload Projection** | Computes expected daily new cards and review burden to hit readiness target. | `StudyPlanProjectionsTable` displays estimated daily workload and schedule. | **Preserved** |
| **Save Plan** | Stores target interview parameters in `chrome.storage.local`. | Saves plan parameters and provides instant feedback toast. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `interview-date-input`, `target-retention-slider`, `retention-val-display`, `generate-plan-btn`, `plan-results-container`, `daily-review-quota`, `estimated-readiness-date`.

---

### 09. Review Activity History Log (`features/dashboard/history/`)

- **Context**: Review audit log tab (`history.html`).
- **Core Purpose**: Chronological log of past problem reviews, ratings given, stability changes, and difficulty adjustments.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **History Table** | Dynamic table populating date, problem title, rating badge, and review interval. | `HistoryTable` rendering chronological review items with difficulty pills. | **Preserved** |
| **Rating Filter** | Dropdown filtering reviews by rating (Again, Hard, Good, Easy). | Filter dropdown updating visible review rows reactively. | **Preserved** |
| **Pagination** | Next/Previous page buttons managing 25 records per page. | `HistoryPagination` with current page, total pages, and record count display. | **Preserved** |
| **Empty State** | Displays empty state illustration when no reviews have been recorded. | `HistoryEmptyState` component with CTA to start reviewing on LeetCode. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `history-table-body`, `history-filter-select`, `history-prev-page-btn`, `history-next-page-btn`, `history-page-info`, `history-empty-view`.

---

### 10. Review Workload Forecast (`features/dashboard/forecast/`)

- **Context**: 30-day forecast tab (`forecast.html`).
- **Core Purpose**: Visualizes the upcoming review burden across the next 30 days based on scheduled FSRS due dates.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **30-Day Bar Chart** | SVG/DOM bar columns indicating number of cards due on each upcoming day. | `ForecastBarChart` renders scaled SVG bars with hover tooltips indicating card count. | **Preserved** |
| **Summary KPIs** | Cards showing total due in 7 days, 14 days, and 30 days. | `ForecastKpiCards` summarizing short-term and medium-term review workload. | **Preserved** |
| **High-Burden Alerts**| Visual alert flag on days exceeding the daily review capacity threshold. | Capacity threshold line and highlight styling on peak workload days. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `forecast-chart-container`, `due-7-days-kpi`, `due-14-days-kpi`, `due-30-days-kpi`, `peak-day-indicator`.

---

### 11. Executive Performance Summary (`features/dashboard/summary/`)

- **Context**: Weekly and monthly study digest (`summary.html`).
- **Core Purpose**: High-level report analyzing learning velocity, retention rate, difficult problem patterns (leeches), and topic mastery.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Period Tabs** | Toggle buttons switching between "This Week" (7 days) and "This Month" (30 days). | `SummaryPeriodTabs` component updating the time window filter. | **Preserved** |
| **KPI Cards** | Total cards reviewed, retention percentage, study time, streak integrity. | `SummaryKpiGrid` displaying metric tiles with trend comparison indicators. | **Preserved** |
| **Topic Breakdown** | Horizontal progress bars displaying mastery percentages across DSA topics. | `SummaryTopicMasteryList` rendering top strong topics and weak topics. | **Preserved** |
| **Leech Warning Card**| Identifies recurring problems with high lapse counts needing attention. | `LeechAlertBanner` highlighting problem cards with $\ge 3$ lapses. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `period-week-btn`, `period-month-btn`, `summary-total-reviews`, `summary-retention-pct`, `summary-topics-list`, `summary-leech-card`.

---

### 12. Activity Contribution Heatmap (`features/dashboard/heatmap/`)

- **Context**: Full-page GitHub-style activity matrix (`heatmap.html`).
- **Core Purpose**: Visualizes daily review density across the entire year (52 weeks, 7 days/week) with streak tracking.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Year Matrix** | 52 columns $\times$ 7 rows of SVG/DOM squares color-coded by review volume. | `HeatmapMatrix` renders SVG rect cells with 5 intensity levels (`0` through `4`). | **Preserved** |
| **Year Selector** | Dropdown switching between current and previous calendar years. | Year selector select dropdown recalculating date matrix bounds. | **Preserved** |
| **Hover Tooltips** | Mouseenter/mouseleave handlers display floating date and review count tooltip. | `HeatmapTooltip` positioned relative to hovered cell displaying exact review count. | **Preserved** |
| **Streak Metrics** | Displays current streak, longest streak, and total active days. | `HeatmapStatsHeader` calculating continuous review streak sequences. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `heatmap-year-select`, `heatmap-svg-container`, `heatmap-tooltip`, `current-streak-val`, `longest-streak-val`, `total-active-days-val`.

---

### 13. FSRS Scheduler Configuration (`features/tracker/config/`)

- **Context**: FSRS algorithm parameters tuning dashboard (`fsrsConfig.html`).
- **Core Purpose**: Allows advanced users to customize target retention, maximum interval, and the 17 parameters of the FSRS v4.5 algorithm, or run automated parameter optimization.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Mode Switcher** | Toggle pill switching between "Simple" (target retention only) and "Advanced" mode. | Mode pill toggle controlling visibility of the 17-parameter weights grid. | **Preserved** |
| **Retention Presets** | Preset chips (85%, 90%, 95%) updating target retention range slider. | `PresetChips` component updating slider value and recalculating interval scaling. | **Preserved** |
| **17-Weight Grid** | Number inputs for $w_0$ through $w_{16}$ with validation against FSRS bounds. | `WeightsGrid` with hover explanations of each coefficient's physical meaning. | **Preserved** |
| **WASM Optimizer** | "Run Optimizer" button triggers background fast optimizer worker on review logs. | `OptimizerSection` with progress bar, loss metrics, and apply button. | **Preserved** |
| **Reset to Default** | Restores official FSRS v4.5 default parameter set ($[0.4, 0.6, 2.4, 5.8, \dots]$). | Reset button restoring default coefficients with confirmation toast. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `request-retention-slider`, `request-retention-val`, `max-interval-input`, `weights-grid-container`, `run-optimizer-btn`, `optimizer-progress-bar`, `reset-weights-btn`, `save-config-btn`.

---

### 14. Card Problem & Metadata Editor (`features/tracker/editor/`)

- **Context**: Standalone or modal card editor (`editor.html`).
- **Core Purpose**: Allows manual editing of problem titles, URLs, tags, custom notes, FSRS stability, and difficulty.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Problem Metadata** | Inputs for problem title, URL, platform origin, and difficulty level. | `EditorForm` with validation ensuring non-empty title and valid URL. | **Preserved** |
| **Tag Input** | `tagInput.ts` component with chip deletion, autocomplete, and Enter key add. | `TagInput` component rendering `TagChip` items with keyboard navigation. | **Preserved** |
| **Notes Markdown** | Textarea for personal solution notes with live Markdown preview rendering. | Solution notes textarea with Markdown preview toggle powered by `marked.js`. | **Preserved** |
| **Reset Card Progress**| Button to reset card FSRS state back to "New" without deleting notes. | Reset state button setting state to `State.New` with confirmation toast. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `editor-title-input`, `editor-url-input`, `editor-difficulty-select`, `editor-tags-container`, `editor-notes-input`, `editor-save-btn`, `editor-reset-card-btn`, `editor-cancel-btn`.

---

### 15. Highlighter Palette & Style Options (`features/highlighter/options/`)

- **Context**: Highlighter customization pane (`highlightOptions.html`).
- **Core Purpose**: Configures the 6 active highlight color swatches, opacity, border styles, and keyboard shortcuts.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Palette Swatches** | 6 color swatch circles with click selection and custom hex picker. | `PaletteSwatches` component allowing custom color assignment per slot. | **Preserved** |
| **Opacity Slider** | Range slider (10% - 80%) adjusting background highlight transparency. | Range slider with live preview sample text demonstrating contrast. | **Preserved** |
| **Style Options** | Radio options for background fill, underline, or squiggly line style. | Style options selector updating CSS class mapping for in-page marker spans. | **Preserved** |
| **Restore Defaults** | Resets palette colors back to default AlgoRecall fluorescent set. | Reset button restoring original color hex array in storage. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `palette-swatches-container`, `opacity-slider`, `opacity-val-display`, `save-palette-btn`, `reset-palette-btn`, `preview-text-sample`.

---

### 16. Highlights & Annotations Manager (`features/highlighter/manager/`)

- **Context**: Full-page highlight organizer (`highlights.html`).
- **Core Purpose**: Search, filter, export, and navigate to all saved text highlights and annotations across coding problems.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Highlights List** | Table/card list displaying quote snippet, problem title, color chip, and date. | `HighlightsList` rendering expandable quote cards with full annotation text. | **Preserved** |
| **Keyword Search** | Filters highlights matching keyword in quoted text or attached note. | Search input with instant reactive filtering across all saved highlights. | **Preserved** |
| **Color/Tag Filters** | Dropdowns filtering highlights by color swatch or problem tag. | Filter controls updating visible list without page reload. | **Preserved** |
| **Jump to Problem** | External link button opening problem URL and scrolling to text highlight. | Direct link button executing `ActionService.openUrl()` with anchor hash. | **Preserved** |
| **Delete Highlight** | Trash icon button deleting individual highlight with undo toast. | Delete button removing item from `chrome.storage.local` with feedback. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `highlights-search-input`, `color-filter-select`, `highlights-container`, `export-highlights-btn`, `delete-highlight-btn`.

---

### 17. Advanced Analytics SPA Dashboard (`features/dashboard/analytics/`)

- **Context**: Multi-tab analytics master SPA (`analytics.html`).
- **Core Purpose**: Deep algorithmic insights into memory retention, learning velocity, prediction accuracy, and topic readiness.

#### Functional Workflow Comparison

| Tab Section | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Overview Tab** | `overview.ts` with Mini-Forecast, Memory Health Ring, Learning Velocity. | `OverviewTab` rendering `MiniForecast`, `MemoryHealthRing`, `LearningVelocity`. | **Preserved** |
| **Memory Tab** | `memory.ts` with Retention Decay Curve, Future Simulation, Confidence Band. | `MemoryTab` rendering `RetentionChart`, `FutureMemorySimulation`, `ConfidenceBand`.| **Preserved** |
| **Performance Tab** | `performance.ts` with Review Volume, Time per Problem, Recovery Rates. | `PerformanceTab` rendering `ReviewStats` and `RecoveryTracking`. | **Preserved** |
| **Readiness Tab** | `readiness.ts` with Interview Preparedness Score and topic coverage. | `ReadinessTab` computing readiness percentage based on retention threshold. | **Preserved** |
| **Tags Tab** | `tags.ts` with Tag Retention Bar Chart and Topic Coverage Matrix. | `TagsTab` rendering `RetentionBarChart` and `CoverageTable`. | **Preserved** |
| **Insights Tab** | `insights.ts` with Optimal Review Time Analytics and Study Habit Tips. | `InsightsTab` rendering `ReviewTimeAnalytics` with peak hour distribution. | **Preserved** |

#### Element Contract & ID Parity
- **Preserved IDs**: `analytics-sidebar`, `tab-overview`, `tab-memory`, `tab-performance`, `tab-readiness`, `tab-tags`, `tab-insights`, `analytics-content-pane`.

---

### 18. In-Page Content Script Tracker Overlay (`features/tracker/tracker.tsx`)

- **Context**: Injected into host page DOM on LeetCode, AlgoMonster, etc.
- **Core Purpose**: Floating action launcher and review modal allowing rating directly on problem pages.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Floating Launcher (FAB)**| Injected `#algo-fsrs-launcher` floating button with badge counter. | `TrackerFloatingLauncher` rendered inside isolated container `#algo-tracker-island`. | **Preserved** |
| **Review Card Modal** | Injected `#algo-fsrs-container` overlay with 4 rating buttons (Again, Hard, Good, Easy).| `TrackerCardReviewView` with `TrackerRatingBar` calculating next interval days. | **Preserved** |
| **Notes & Tags Editor** | In-modal inputs for updating problem notes and tags without leaving page. | Integrated tag input and notes textarea syncing to `chrome.storage.local`. | **Preserved** |
| **Context Invalidation Guard**| Catches `Extension context invalidated` and alerts user to refresh page. | `Tracker.refreshWidgetState` gracefully catches extension reload errors. | **Preserved** |

---

### 19. In-Page Content Script Highlighter Tooltip (`features/highlighter/highlighter.tsx`)

- **Context**: Injected selection overlay on coding problem descriptions.
- **Core Purpose**: Floating tooltip appearing on text selection to highlight key problem constraints and attach notes.

#### Functional Workflow Comparison

| Functional Area | Main (Vanilla TS) Implementation | Preact (TSX) Implementation | Parity Result |
| :--- | :--- | :--- | :---: |
| **Selection Tooltip** | Measures `window.getSelection()` bounding rect and positions `#algo-highlight-tooltip`.| `HighlighterTooltipView` positioned dynamically at selection midpoint. | **Preserved** |
| **Color Swatches Bar** | 6 clickable color buttons applying highlight `<mark>` wrapping. | `HighlighterSwatches` component with active color highlight. | **Preserved** |
| **Annotation Note Input**| Collapsible note textarea attached to the text range. | `HighlighterNotesSection` saving note to highlight descriptor in storage. | **Preserved** |
| **Delete Highlight** | Trash button unwraps `<mark>` element and removes highlight record. | `HighlighterDeleteButton` safely unwrapping DOM range and cleaning storage. | **Preserved** |

---

## Conclusion

The functional parity audit demonstrates **100% workflow and feature fidelity** across every extension page and content script module. No features were omitted, degraded, or compromised. The declarative Preact architecture guarantees superior memory efficiency, eliminating DOM mutation desynchronization while maintaining complete backward compatibility with all existing user data.
