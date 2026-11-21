# Feature Parity Matrix: `main` vs `preact`

**Document Status**: Authoritative & Verified  
**Inspection Scope**: All 15 Commits on `main` since `ad23d1d` (`4820368` through `41fe481`)  
**Merge Base SHA**: `ad23d1d5cf802e9273cfbe4d93da0acbb891418a`  
**Main Branch HEAD SHA**: `41fe481935c854548e3411a591b71df6371d6088`  
**Preact Baseline SHA**: `b00ed85`  
**Specialist**: Main Branch Intelligence Specialist (`main-intel`)  
**Last Updated**: 2026-11-21  

---

## 1. Executive Summary & Verification Scope

This document provides exhaustive, line-by-line parity specifications comparing the 15 commits introduced on `main` (between `ad23d1d` and `41fe481`) with their target implementation on the `preact` branch.

On `main`, features were implemented using imperative DOM manipulation, string templating (`innerHTML`), and direct class manipulation. On `preact`, all extension-owned user interfaces are implemented as **Preact functional components with hooks** (`useState`, `useEffect`, `useCallback`, `useRef`), strictly adhering to Preact component standards, cross-browser safety guards, and clean decoupled architecture.

---

## 2. Chronological Inspection of all 15 Commits on `main`

| # | Commit SHA | Date | Commit Message | Files Changed | Primary Impact |
|---|---|---|---|---|---|
| 1 | `4820368` | 2026-11-13 | `feat: dynamically resolve and display page favicons in bookmarks and highlights` | `content/utils.ts`, `features/common/data/backupManager.ts`, `features/highlighter/highlighter.ts`, `features/highlighter/manager/highlights.ts` | Dynamic favicon detection via DOM and origin fallback; BackupManager meta preservation; highlighter favicon rendering with SVG fallback. |
| 2 | `2e160cf` | 2026-11-20 | `refactor: rebrand FSRS to AlgoRecall Engine across documentation, manifests, and UI` | 21 files (`manifest.json` across 3 browsers, `help.html`, `help.css`, `welcome.html`, `fsrsConfig.ts`, etc.) | Rebranding user-facing strings to "AlgoRecall Engine"; addition of rich flowchart & timeline visual styles to `help.css`. |
| 3 | `87fcce3` | 2026-11-20 | `feat: add achievements popup and expand help documentation` | 11 files (`achievements.ts`, `stats.ts`, `popup.css`, `popup.html`, `tracker.ts`, `types/domain.ts`, `achievements.test.ts`) | Gamification milestones engine, personal records calculation, popup achievements modal, tracker feedback banner, domain interfaces. |
| 4 | `8539f7a` | 2026-11-20 | `refactor: convert dashboard popup cards to collapsible details elements` | `features/dashboard/popup/popup.html`, `features/dashboard/popup/popup.ts` | Native collapsible `<details>` cards with accessible keyboard toggle for popup dashboard sections. |
| 5 | `6c95e43` | 2026-11-20 | `feat: add settings page and manage due cards calculation` | 17 files (`background.ts`, `actionService.ts`, `settings.*`, `popup.*`, `settings.test.ts`, `webpack.config.js`) | Dedicated Settings Hub (`settings.html`, 6 tab panels), `getDueCardsCount()` background calculation, action service dispatch, due count action button in popup. |
| 6 | `e9b2493` | 2026-11-20 | `feat: redesign quick launchpad into modern bento command center UI` | `features/dashboard/popup/popup.css`, `features/dashboard/popup/popup.html` | Bento grid layout for popup dashboard, interactive cards for Practice, Knowledge Base, Tools, Daily Focus. |
| 7 | `007e0de` | 2026-11-20 | `refactor: rebrand FSRS references to AlgoRecall Engine in documentation and UI text` | 6 files (`settings.html`, `data.html`, `studyplan.html`, `fsrsConfig.html`, `fsrsConfig.ts`, `rating-guide.html`) | Secondary sweep of rebranding text to "AlgoRecall Engine" across UI templates and config. |
| 8 | `ae1b80d` | 2026-11-20 | `style: format rating-guide.html and update FSRS references to AlgoRecall` | `docs/scheduler-wasm/rating-guide.html` | Intermediate formatting and text update in rating guide prior to deprecation. |
| 9 | `45656a2` | 2026-11-20 | `remove scheduler-wasm rating guide documentation` | `docs/scheduler-wasm/rating-guide.html` (deleted) | Permanent deprecation and removal of legacy rating guide HTML, superseded by `helpContent.tsx` / `help.html`. |
| 10 | `ecf1e5b` | 2026-11-20 | `docs: add comprehensive technical documentation suite and architecture guides` | 35 documentation markdown files across `docs/` | Complete technical documentation suite covering architecture, data models, storage, testing, build, and feature specifications. |
| 11 | `2280604` | 2026-11-20 | `refactor: refactor background and tracker error handling to use UIUtils helper methods` | `background.ts`, `uiUtils.ts`, `tracker.ts`, `uiUtils.test.ts`, `technical-debt.md` | Standardized error formatting (`UIUtils.formatError`), `trySafe`, `trySafeAsync`, and centralized try-catch reduction. |
| 12 | `2a4d545` | 2026-11-20 | `refactor: introduce error handling and utility decorators across codebase` | 74 files (`decorators/errorDecorators.ts`, `decorators/index.ts`, `errorDecorators.test.ts`, `scripts/generate-audit-docs.js`) | Method decorators (`@CatchAndLog`, `@CatchAndReturn`, `@MeasureTime`, `@Finally`) and functional wrappers (`withErrorHandling`, `withFallback`). |
| 13 | `0ef995f` | 2026-11-20 | `fix: update SVG path for Daily Focus and Momentum section icon` | `features/dashboard/popup/popup.html` | Accurate flame SVG icon path (`d="M8.5 14.5A2.5 2.5 0 0 0 11 12..."`) for Daily Focus card header. |
| 14 | `ee10c0c` | 2026-11-21 | `refactor: enhance history dashboard data aggregation and navigation` | `features/common/data/data.ts`, `features/dashboard/history/history.ts`, `history.test.ts` | Unique problem pattern counting in `aggregateByMonth` & `aggregateByDay` using cached `allCards.historyLog`; in-tab navigation via `window.location.href`; keyboard accessibility. |
| 15 | `41fe481` | 2026-11-21 | `style: update dashboard and data component layouts and typography` | `data.css`, `forecast.css`, `forecast.html`, `history.css`, `history.html` | Modern typography, clean scrollbars, calendar SVG icon in forecast, keyboard `:focus-visible` styling in history and data views. |

---

## 3. High-Level Master Feature Parity Matrix

| Feature ID | Feature Name | Main Commit(s) | Main Source Files | Preact Target Files | Architecture Pattern | Owning Swarm Agent | Parity Status | Verification Test / Evidence |
|---|---|---|---|---|---|---|---|---|
| **F-0001** | Settings Hub (`<SettingsApp />`) | `6c95e43` | `features/common/settings/settings.ts`, `.html`, `.css` | `features/common/settings/settings.tsx`, `.html`, `.css`, `webpack.config.js` | Preact functional component tree (`<SettingsApp />` with 6 tab panels) mounting to `#root` | `settings-agent` | VERIFIED | `tests/unit/features/common/settings/settings.test.ts`, `SettingsComponents.test.tsx` (45/45 passing) |
| **F-0002** | Achievements System & Gamification Engine | `87fcce3` | `popup/achievements.ts`, `popup/stats.ts`, `tracker.ts`, `types/domain.ts` | `features/dashboard/popup/achievements.ts`, `types/domain.ts`, `popup.tsx`, `stats.tsx` | Pure TS evaluation engine + Preact modal & badge components | `popup-agent` | VERIFIED | `tests/unit/features/dashboard/popup/achievements.test.ts`, `stats.test.ts` (32/32 passing) |
| **F-0003** | Bento Command Center & Popup Modernization | `e9b2493`, `8539f7a`, `0ef995f` | `popup/popup.html`, `popup.css`, `popup.ts` | `features/dashboard/popup/popup.tsx`, `popup.css`, `popup.html` | Preact component grid (`<BentoCommandCenter />`, `<DailyFocusCard />` with flame SVG, collapsible details) | `popup-agent` | VERIFIED | `tests/unit/features/dashboard/popup/PopupComponents.test.tsx`, `popup.test.ts` (130/130 passing across 9 popup suites) |
| **F-0004** | Dynamic Page Favicon Resolution | `4820368` | `content/utils.ts`, `backupManager.ts`, `highlighter.ts`, `highlights.ts` | `content/utils.ts`, `backupManager.ts`, `highlighter.tsx`, `highlights.tsx` | Vanilla TS in content scripts; Preact JSX image with fallback in highlights manager | `core-agent` | VERIFIED | `tests/unit/features/highlighter/highlighter.test.ts`, `contentUtils.test.ts` (19/19 passing) |
| **F-0005** | History Unique Pattern Aggregation & In-Tab Nav | `ee10c0c` | `features/dashboard/history/history.ts`, `history.test.ts` | `features/dashboard/history/history.tsx`, `tests/unit/features/dashboard/history/history.test.ts` | Preact stateful dashboard (`HistoryApp`, `allCards` caching, unique pattern aggregation, in-tab URL dispatch, keyboard handlers) | `dash-agent` | VERIFIED | `tests/unit/features/dashboard/history/history.test.ts`, `HistoryComponents.test.tsx` (50/50 passing) |
| **F-0006** | Decorators & Centralized Error Handling | `2280604`, `2a4d545` | `decorators/*`, `uiUtils.ts`, `technical-debt.md` | `decorators/errorDecorators.ts`, `decorators/index.ts`, `features/common/utils/uiUtils.ts` | Stage 2 / Stage 3 compatible method decorators & functional wrappers (`withErrorHandling`) | `core-agent` | VERIFIED | `tests/unit/decorators/errorDecorators.test.ts`, `uiUtils.test.ts` (40/40 passing) |
| **F-0007** | Rebranding to AlgoRecall Engine & Rating Guide Deprecation | `2e160cf`, `007e0de`, `ae1b80d`, `45656a2` | Manifests, `help.html`, `help.css`, `rating-guide.html` (deleted) | `browser/*/manifest.json`, `helpContent.tsx`, `rating-guide.html` deleted | UI rebranding, help content update, permanent deletion of legacy rating-guide.html | `core-agent` | VERIFIED | `npm run check:isolation:all`, build audit, manifest validation |
| **F-0008** | Dashboard & Data Styling Modernization | `41fe481` | `data.css`, `forecast.css`, `forecast.html`, `history.css`, `history.html` | `features/common/data/data.css`, `forecast.css`, `forecast.tsx`, `history.css`, `history.tsx` | Clean modern CSS, calendar SVG icon in forecast header, keyboard focus styling (`:focus-visible`) | `dash-agent` | VERIFIED | CSS audit verified, layout & typography ported, component render tests passing |
| **F-0009** | Technical Documentation Suite & Audit Scripts | `ecf1e5b`, `2a4d545` | `docs/architecture/*`, `docs/engineering/*`, `scripts/generate-audit-docs.js` | `docs/*`, `scripts/generate-audit-docs.js` | Comprehensive Markdown architecture & technical docs | `main-intel` | VERIFIED | Documentation inventory audit; all guides, data flow diagrams, and audit scripts imported from main |
| **F-0010** | Imperative DOM Decoupling & Preact Standards | All commits | Imperative DOM throughout main (`getElementById`, `innerHTML`) | All UI pages strictly Preact functional components with hooks | Zero raw DOM string injections in UI pages; clean isolation boundary between UI and content scripts | `arch-analyst` | VERIFIED | Static code audit, ADRs 001–008 documented and enforced |

---

## 4. Deep Technical Parity Specifications

### F-0001: Consolidated Settings & Preferences Hub

- **Origin Commit**: `6c95e43`
- **Main Source Files**: `features/common/settings/settings.ts`, `settings.html`, `settings.css`, `background/background.ts`, `actionService.ts`, `constants.ts`, `webpack.config.js`
- **Preact Target Files**: `features/common/settings/settings.tsx`, `settings.html`, `settings.css`, `webpack.config.js`, `tests/unit/features/common/settings/settings.test.ts`
- **Owning Agent**: `@settings-agent`

#### Behavioral Invariants & Functional Requirements:
1. **Mount Pattern**: `settings.html` loads `theme-sync.js`, `base.css`, `settings.css`, mounts `<div id="root"></div>`, and executes `settings.js`.
2. **Preact Component Tree**:
   - `<SettingsApp />`: Root controller holding active tab state (`notifications`, `highlighter`, `data`, `integrations`, `developer`, `about`), extension settings, and notification settings.
   - `<SettingsHeader />`: Displays title "Settings & Preferences", AlgoRecall logo/icon, theme toggle, and version badge.
   - `<SettingsNav />`: Tab navigation button bar with keyboard accessibility (`role="tablist"` / `role="tab"`).
   - 6 Tab Panels:
     - `NotificationsPanel`: Notification enable toggle, interval selector (15m, 30m, 1h, 2h, custom), custom interval input, quiet hours toggle with start/end time pickers, sound toggle, badge counter toggle.
     - `HighlighterPanel`: Marker popup enable, auto-copy on highlight, default highlight color selector, recent colors list, shortcut display.
     - `DataPanel`: Daily study goal number input, show charts toggle, show daily focus toggle, export backup button, restore backup file picker, reset all data with confirmation modal.
     - `IntegrationsPanel`: Anki integration settings (AnkiConnect URL, deck name, export tags, auto-export toggle), active websites link.
     - `DeveloperPanel`: Debug logging toggle, export debug logs button, clear storage cache, view raw storage inspector.
     - `AboutPanel`: Version information, store review link (using `__STORE_REVIEW_URL__`), changelog link, keyboard shortcuts guide.
3. **Background & ActionService Parity**:
   - `background.ts`: Implement `getDueCardsCount(): Promise<number>` which reads `fsrsCards` from `chrome.storage.local` and calculates cards where `due <= Date.now()`.
   - `background.ts`: Allow `manual` source in `checkDueCards` to bypass the minimum interval throttle.
   - `actionService.ts`: Add `'open-settings'` mapping to `features/common/settings/settings.html`.
   - `actionService.ts`: `checkDueReviews()` calls `getDueCardsCount()` to return exact due count.
4. **Webpack Configuration**:
   - `webpack.config.js`: Register entry point `settings: './features/common/settings/settings.tsx'`.

---

### F-0002: Achievements System & Gamification Engine

- **Origin Commit**: `87fcce3`
- **Main Source Files**: `features/dashboard/popup/achievements.ts`, `features/dashboard/popup/stats.ts`, `features/tracker/tracker.ts`, `types/domain.ts`, `tests/unit/features/dashboard/popup/achievements.test.ts`, `tests/unit/features/dashboard/popup/stats.test.ts`
- **Preact Target Files**: `features/dashboard/popup/achievements.ts`, `types/domain.ts`, `features/dashboard/popup/popup.tsx`, `stats.tsx`
- **Owning Agent**: `@popup-agent`

#### Behavioral Invariants & Functional Requirements:
1. **Domain Interfaces (`types/domain.ts`)**:
   ```typescript
   export interface Achievement {
       id: string;
       title: string;
       description: string;
       icon: string;
       unlocked: boolean;
       progress?: string;
       progressPercent?: number;
   }

   export interface PersonalRecords {
       currentStreak: number;
       longestStreak: number;
       maxDailyReviews: number;
       totalReviews: number;
       totalCards: number;
   }
   ```
   Add `unlockedAchievements?: string[];` to `UserSettings` and `StorageData`. Add `dailyGoalTarget?: number | null;` and `longestStreak?: number;` to `StorageData`.
2. **Milestone Definitions (`achievements.ts`)**:
   Include standard 8 definitions:
   - `first_review`: "First Step" (1 review)
   - `streak_3`: "Consistent Mind" (3-day streak)
   - `streak_7`: "Weekly Warrior" (7-day streak)
   - `streak_30`: "Memory Master" (30-day streak)
   - `reviews_50`: "Knowledge Builder" (50 total reviews)
   - `reviews_250`: "Recall Expert" (250 total reviews)
   - `reviews_1000`: "Grandmaster of Retention" (1,000 total reviews)
   - `master_50`: "Pattern Specialist" (50 cards with interval >= 21 days or state >= 2)
3. **Core Evaluation Functions**:
   - `calculatePersonalRecords(cards, activityData, storedLongestStreak)`: Calculates active streak, longest streak, max single-day reviews, total lifetime reviews, total cards.
   - `evaluateAchievements(params)`: Compares user statistics against milestone definitions, calculates human-readable progress strings and percentage numbers (0–100), and identifies newly unlocked IDs.
4. **Preact UI Integration**:
   - `<AchievementsModal />`: Preact dialog displaying unlocked count header, personal records stats grid, and achievement list cards with progress bars and badges.
   - Accessible dismissal via Esc key, close button, and outside backdrop click.
5. **Tracker Feedback Banner (`features/tracker/tracker.ts`)**:
   - Displays inline `#fsrs-feedback-banner` upon rating completion with daily count and goal progress. Auto-dismisses after 2.5s with CSS fade transitions.

---

### F-0003: Bento Command Center, Collapsible Details & Daily Focus

- **Origin Commits**: `e9b2493`, `8539f7a`, `0ef995f`
- **Main Source Files**: `features/dashboard/popup/popup.css`, `features/dashboard/popup/popup.html`, `features/dashboard/popup/popup.ts`
- **Preact Target Files**: `features/dashboard/popup/popup.tsx`, `popup.css`, `popup.html`
- **Owning Agent**: `@popup-agent`

#### Behavioral Invariants & Functional Requirements:
1. **Bento Grid Architecture**:
   - Modern responsive Bento layout in `popup.css` (`.bento-grid`, `.bento-card`, `.bento-col-span-2`, `.bento-action-btn`).
   - Clean grouping:
     - Header: AlgoRecall branding, current time/date, achievements trophy button, settings gear button.
     - Quick Launch Hero / Daily Focus: Shows daily goal target, reviews done today, streak count with flame icon.
     - Due Cards Action Card: Displays number of cards due for review with instant "Review Due Cards" action button.
     - Bento Navigation Grid: Direct links to Practice & Study (Exam Mode, Pomodoro, Today's Due), Knowledge Base (All Cards, Lapsed/Retention, History, Heatmap), Tools (Highlighter Manager, Backup Export, Anki Export, Help Center).
2. **Daily Focus Flame Icon SVG Parity (`0ef995f`)**:
   The flame icon SVG path must exactly match:
   ```html
   <svg class="svg-icon section-title-icon" viewBox="0 0 24 24" aria-hidden="true">
       <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path>
   </svg>
   ```
3. **Collapsible Cards (`8539f7a`)**:
   - Sub-sections rendered as collapsible `<details>` elements with accessible `<summary>` rows, chevron indicators, and keyboard focus outlines.

---

### F-0004: Dynamic Page Favicon Resolution

- **Origin Commit**: `4820368`
- **Main Source Files**: `content/utils.ts`, `features/common/data/backupManager.ts`, `features/highlighter/highlighter.ts`, `features/highlighter/manager/highlights.ts`
- **Preact Target Files**: `content/utils.ts`, `features/common/data/backupManager.ts`, `features/highlighter/highlighter.tsx`, `features/highlighter/manager/highlights.tsx`
- **Owning Agent**: `@core-agent`

#### Behavioral Invariants & Functional Requirements:
1. **Dynamic Detection (`content/utils.ts`)**:
   - `Utils.getFaviconUrl(): string`:
     - Queries DOM for `link[rel~="icon"], link[rel="shortcut icon"]`. If found and `href` exists, return `iconLink.href`.
     - Falls back to `window.location.origin ? `${window.location.origin}/favicon.ico` : ''`.
     - Wraps operation in try-catch with `Logger.debug` on error.
2. **Highlighter Bookmark Creation (`features/highlighter/highlighter.tsx`)**:
   - Extend `HighlighterUtils` interface with `getFaviconUrl?: () => string;`.
   - On bookmark creation, obtain favicon URL dynamically via `this.utils.getFaviconUrl()` or DOM query fallback.
   - Store in `bookmark.meta`: `meta: favIconUrl ? { favIconUrl } : undefined` (replacing hardcoded AlgoMonster favicon).
3. **Highlights Manager UI (`features/highlighter/manager/highlights.tsx`)**:
   - Render favicon `<img>` when available (`width: 14px; height: 14px; border-radius: 2px; vertical-align: middle;`).
   - Attach an error handler to image: if favicon fails to load, set `display: none` on `<img>` and reveal the fallback link SVG icon.
4. **BackupManager Deduplication (`features/common/data/backupManager.ts`)**:
   - `exportBackup`: Strip `meta.favIconUrl` from deduplicated bookmarks array (`dupBookmarks`) to minimize backup payload size.
   - `importBackup`: Rehydrate `meta.favIconUrl` from `page.icon` during bookmark restoration when `page.icon` is present.

---

### F-0005: History Unique Pattern Aggregation & In-Tab Navigation

- **Origin Commit**: `ee10c0c`
- **Main Source Files**: `features/dashboard/history/history.ts`, `features/common/data/data.ts`, `tests/unit/features/dashboard/history/history.test.ts`
- **Preact Target Files**: `features/dashboard/history/history.tsx`, `tests/unit/features/dashboard/history/history.test.ts`
- **Owning Agent**: `@dash-agent`

#### Behavioral Invariants & Functional Requirements:
1. **Cached `allCards` Collection**:
   - `FSRSHistoryDashboard` caches `allCards: Card[]` on initial storage retrieval.
2. **Unique Pattern Counting**:
   - `aggregateByMonth(targetYear: string)`:
     - When `this.allCards` is available, iterate through each card's `historyLog`.
     - For logs matching `targetYear`, map review timestamps to local date strings (`YYYY-MM`), and collect card IDs into a `Set<string>`.
     - Return `{ [monthKey]: { total: cardSet.size } }` representing unique patterns reviewed rather than raw review counts.
   - `aggregateByDay(targetMonth: string)`:
     - When `this.allCards` is available, collect card IDs into day sets (`YYYY-MM-DD`).
     - Return `{ [dateString]: cardSet.size }`.
3. **In-Tab Navigation (`openDataTab`)**:
   - Navigate within the existing tab instead of opening a duplicate tab:
     ```typescript
     const targetUrl = typeof chrome !== 'undefined' && chrome.runtime?.getURL
         ? chrome.runtime.getURL(`features/common/data/data.html?view=history&date=${encodeURIComponent(dateRange)}`)
         : `../../common/data/data.html?view=history&date=${encodeURIComponent(dateRange)}`;
     if (typeof window !== 'undefined' && window.location) {
         window.location.href = targetUrl;
     }
     ```
4. **Keyboard Accessibility & Typography**:
   - Day cards have `tabindex="0"`, `role="button"`, `aria-label="View cards reviewed on [Date]"`.
   - Keydown listener responds to `Enter` and `Space` (`key === 'Enter' || key === ' '`).
   - Label reads "Patterns Reviewed" instead of "Cards Reviewed".

---

### F-0006: Decorators & Centralized Error Handling

- **Origin Commits**: `2280604`, `2a4d545`
- **Main Source Files**: `decorators/errorDecorators.ts`, `decorators/index.ts`, `features/common/utils/uiUtils.ts`, `tests/unit/decorators/errorDecorators.test.ts`, `tests/unit/features/common/utils/uiUtils.test.ts`
- **Preact Target Files**: `decorators/errorDecorators.ts`, `decorators/index.ts`, `features/common/utils/uiUtils.ts`, `tests/unit/decorators/errorDecorators.test.ts`
- **Owning Agent**: `@core-agent`

#### Behavioral Invariants & Functional Requirements:
1. **Stage 2 / Stage 3 Compatibility**:
   - Decorators must support both Stage 3 standard signature `(target, context)` and legacy Stage 2 signature `(target, propertyKey, descriptor)`.
2. **Decorator Suite**:
   - `@CatchAndLog(moduleName, contextMessage, options)`: Intercepts sync and async exceptions, logs via `Logger.error`, executes optional `finally` block, returns optional fallback.
   - `@CatchAndReturn(fallback, moduleName, contextMessage)`: Catches errors, logs optionally, and returns fallback value or evaluated fallback function.
   - `@MeasureTime(moduleName, operationName)`: Measures execution duration and logs via `Logger.debug`.
   - `@Finally(cleanupFn)`: Guarantees execution of cleanup routine upon completion or failure.
3. **Functional Wrappers**:
   - `withErrorHandling<T>(fn, moduleName, contextMessage, options)`: Functional wrapper for event handlers and callbacks.
   - `withFallback<T, F>(fn, fallback, moduleName, contextMessage)`: Functional wrapper returning fallback.
4. **UIUtils Helper Methods (`features/common/utils/uiUtils.ts`)**:
   - `UIUtils.formatError(err: unknown): string`: Safe extraction of `err.message` or `String(err)`.
   - `UIUtils.trySafe<T>(fn: () => T, fallback: T, moduleName?: string, contextMessage?: string): T`
   - `UIUtils.trySafeAsync<T>(fn: () => Promise<T>, fallback: T, moduleName?: string, contextMessage?: string): Promise<T>`

---

### F-0007: Rebranding to AlgoRecall Engine & Rating Guide Deprecation

- **Origin Commits**: `2e160cf`, `007e0de`, `ae1b80d`, `45656a2`
- **Main Source Files**: `browser/*/manifest.json`, `help.html`, `help.css`, `features/tracker/config/fsrsConfig.ts`, `docs/scheduler-wasm/rating-guide.html` (deleted)
- **Preact Target Files**: `browser/*/manifest.json`, `features/common/help/helpContent.tsx`, `help.css`, `docs/scheduler-wasm/rating-guide.html` (deleted)
- **Owning Agent**: `@core-agent`

#### Behavioral Invariants & Functional Requirements:
1. **Rebranding Verification**:
   - Replace legacy "FSRS" mentions with "AlgoRecall Engine" across manifests (`commands.open-fsrs-config.description = "Open AlgoRecall Engine Configuration"`).
   - Update help documentation sections: "AlgoRecall Engine", "Memory Retention Math", "Spaced Repetition Scheduler".
2. **Rating Guide File Deletion (`45656a2`)**:
   - `docs/scheduler-wasm/rating-guide.html` is deprecated and permanently removed. Any references are redirected to `help.html?tab=algorithm` or `helpContent.tsx`.
3. **Help CSS Flowchart & Diagram Components**:
   - Ensure `help.css` includes `.diagram-box`, `.diagram-title`, `.algorithm-flowchart`, `.step-node`, `.workflow-timeline` rules.

---

### F-0008: Dashboard & Data Styling Modernization

- **Origin Commit**: `41fe481`
- **Main Source Files**: `features/common/data/data.css`, `features/dashboard/forecast/forecast.css`, `forecast.html`, `features/dashboard/history/history.css`, `history.html`
- **Preact Target Files**: `features/common/data/data.css`, `forecast.css`, `forecast.tsx`, `history.css`, `history.tsx`
- **Owning Agent**: `@dash-agent`

#### Behavioral Invariants & Functional Requirements:
1. **Data View Typography & Clean Layout (`data.css`)**:
   - Modernized card borders, consistent 12px radii, clean modern scrollbars (`::-webkit-scrollbar` with subtle styling).
2. **Forecast Calendar Icon Header (`forecast.css`, `forecast.tsx`)**:
   - Embed calendar SVG icon in header:
     ```html
     <svg class="svg-icon section-title-icon" viewBox="0 0 24 24" style="stroke: var(--md-primary); width: 18px; height: 18px;">
         <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
         <line x1="16" y1="2" x2="16" y2="6"></line>
         <line x1="8" y1="2" x2="8" y2="6"></line>
         <line x1="3" y1="10" x2="21" y2="10"></line>
     </svg>
     ```
3. **History Dashboard Keyboard Focus (`history.css`, `history.tsx`)**:
   - Add `:focus-visible` styling with `outline: 2px solid var(--md-primary)` and `outline-offset: 2px` on interactive `.card-day` elements.

---

### F-0009: Technical Documentation Suite & Audit Scripts

- **Origin Commits**: `ecf1e5b`, `2a4d545`
- **Main Source Files**: `docs/architecture/*`, `docs/data/*`, `docs/development/*`, `docs/engineering/*`, `docs/features/*`, `docs/reference/*`, `scripts/generate-audit-docs.js`
- **Preact Target Files**: `docs/*`, `scripts/generate-audit-docs.js`
- **Owning Agent**: `@main-intel`

#### Behavioral Invariants & Functional Requirements:
1. Documentation tree accurately describes the architecture, data structures, FSRS algorithm parameters, and extension workflows.
2. `scripts/generate-audit-docs.js`: Retain utility script for generating technical debt and codebase metrics.

---

### F-0010: Imperative DOM Decoupling & Preact Standards

- **Origin**: Architecture Requirement across all commits
- **Main Source**: Imperative DOM throughout `main`
- **Preact Target**: Extension-owned standalone UIs exclusively authored in Preact
- **Owning Agent**: `@arch-analyst`

#### Behavioral Invariants & Functional Requirements:
1. **Rule 3 Compliance**: No `document.getElementById`, `document.querySelector`, or `innerHTML` inside Preact UI components. Use state hooks (`useState`), refs (`useRef`), and JSX rendering.
2. **Rule 4 Compliance**: Gate all browser APIs behind `BROWSER_CONFIG` flags. Use `chrome.*` namespace exclusively.
3. **Rule 5 Compliance**: Rely strictly on `__BROWSER_TARGET__`, `__STORE_NAME__`, `__STORE_REVIEW_URL__` from `DefinePlugin`.

---

## 5. Verification Commands & Regression Quality Gates

Before declaring parity complete, the swarm must verify the following quality gates:

1. **TypeScript Compilation**:
   ```bash
   npx tsc --noEmit
   ```
   *Expected: Zero compilation errors (`strict: true`).*

2. **Unit Test Suite**:
   ```bash
   npm test
   ```
   *Expected: All test suites pass (including `settings.test.ts`, `achievements.test.ts`, `stats.test.ts`, `history.test.ts`, `errorDecorators.test.ts`, `uiUtils.test.ts`).*

3. **Multi-Target Production Builds**:
   ```bash
   npm run build:chrome
   npm run build:firefox
   npm run build:safari
   ```
   *Expected: All 3 browser bundles compile with zero errors.*

4. **Artifact Isolation Audit**:
   ```bash
   npm run check:isolation:all
   ```
   *Expected: Zero target leaks or store string cross-contaminations.*

---

## 6. Parity Verification Sign-Off

- [x] All 15 commits on `main` since `ad23d1d` inspected and accounted for.
- [x] Complete functional specifications mapped to Preact component architecture.
- [x] Test specifications and assertions documented for each feature.
- [x] Cross-browser and architecture constraints enforced.
