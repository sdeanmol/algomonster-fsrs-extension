# Browser Extension Usability Audit — AlgoRecall

> **Product**: AlgoRecall: Coding Interview Spaced Repetition (Chrome, Firefox, Safari)  
> **Manifest Version**: Manifest V3 (MV3)  
> **Evaluation Date**: 2026-10-30  
> **Auditors**: Senior UX Researcher, Senior UI/UX Product Designer, Browser Extension Architect, Accessibility Specialist (CPACC), Quality Assurance Engineer  
> **Target Deliverable**: Comprehensive Usability, Accessibility, and Architectural Evaluation  
> **Methodology**: Static source code analysis, DOM hierarchy inspection, architectural tracing, state flow analysis, WCAG 2.2 AA standards verification, and multi-browser runtime build evaluation.

---

## 1. Executive Summary

AlgoRecall is a privacy-first, local-first spaced repetition browser extension powered by the Free Spaced Repetition Scheduler (FSRS-4.5) algorithm. It allows software engineers and computer science students to track problem-solving approaches, highlight key formulas and concepts, and schedule optimal review intervals across popular coding platforms (LeetCode, AlgoMonster, Codeforces, HackerRank, etc.).

While the core algorithmic scheduling foundation and local storage privacy model are technically sound, the overall product experience suffers from significant usability hurdles, cognitive overload, accessibility gaps, and browser extension lifecycle friction that impair user onboarding, daily workflow efficiency, and feature discoverability.

### Overall Usability Assessment
- **Core Value Proposition**: Excellent. Automating spaced repetition directly inside LeetCode and AlgoMonster solves a real problem for technical interview candidates.
- **Privacy & Security**: Exceptional. 100% client-side data persistence via `chrome.storage.local` with zero external tracking or unauthorized telemetry.
- **Interface Polish & Information Architecture**: High friction. The primary popup is vertically overloaded (~1,400px of scrollable content packed into a 350px window), forcing users through confusing multi-tiered navigation and competing visual calls to action.
- **Workflow Continuity**: Fragile. Closing the in-page tracker widget completely removes the launcher from the page with no recovery mechanism short of a page refresh. Dynamically authorized custom websites fail to load scripts due to obsolete bundled script path references.
- **Accessibility (a11y)**: Significant barriers. Key interactive controls (data import/export file inputs, Pomodoro playback buttons, palette slot deletion) lack accessible names or keyboard focus indicators. The in-page tracker dialog does not dismiss on `Escape`.

### Highest-Risk User Journeys
1. **Adding a Custom Coding Platform (Journey F & B)**: User attempts to whitelist a custom platform (e.g. GitHub, CodeSignal) in the settings. The extension requests host permissions and reports success, but dynamic script registration fails due to referencing nonexistent files (`content/fsrs.js`), leaving the extension dead on arrival on the user's platform.
2. **Closing In-Page Tracker While Studying (Journey A & B)**: User clicks the "X" button on the in-page problem tracker. Both the widget and the floating launcher icon are permanently hidden from view, leaving the user unable to record further notes without refreshing the problem tab.
3. **Deactivating Exam Mode After Reviewing (Journey D)**: A candidate activates Exam Mode to prepare for an interview, reviews 50 cards over two weeks, and deactivates Exam Mode after the test. The deactivation routine unconditionally overwrites card due dates with a stale pre-exam snapshot, erasing weeks of learning history.
4. **First-Time Extension Onboarding (Journey A)**: Upon installation, the user completes a 3-step setup wizard, only to be abruptly redirected to a dense 7-tab, 900-line documentation manual with zero guidance on pinning the extension to the Chrome toolbar.

---

## 2. Audit Scope and Methodology

### 2.1 Areas Inspected
- **Extension Manifests**: `browser/chrome/manifest.json`, `browser/firefox/manifest.json`, `browser/safari/manifest.json`.
- **Extension Pages (16 HTML surfaces)**:
  - Popup Dashboard (`features/dashboard/popup/popup.html`)
  - Analytics & Scientific Forecast (`features/dashboard/analytics/analytics.html`, `forecast.html`)
  - Heatmap Activity Map (`features/dashboard/heatmap/heatmap.html`)
  - History Log (`features/dashboard/history/history.html`)
  - Exam Mode Study Plan (`features/dashboard/studyplan/studyplan.html`)
  - Pomodoro Study Timer (`features/dashboard/pomodoro/pomodoro.html`)
  - Weekly & Monthly Digest Summary (`features/dashboard/summary/summary.html`)
  - Data Manager & Pattern Table (`features/common/data/data.html`)
  - Active Platforms Whitelist (`features/common/websites/websites.html`)
  - Help Center & Privacy Hub (`features/common/help/help.html`)
  - Onboarding Welcome Wizard (`features/common/welcome/welcome.html`)
  - Highlighter Options & Palette Manager (`features/highlighter/options/highlightOptions.html`)
  - Highlighted Snippets Manager (`features/highlighter/manager/highlights.html`)
  - Full-Screen Markdown Notes Editor (`features/tracker/editor/editor.html`)
  - FSRS Algorithm Customizer (`features/tracker/config/fsrsConfig.html`)
- **Injected Content UI**:
  - In-Page Tracker Widget (`#algo-fsrs-container`, `#algo-fsrs-launcher`)
  - Floating Text Selection Highlighter Tooltip (`#algo-highlight-tooltip`)
  - In-Page Toast Notifications (`content/notifications.ts`)
- **Background Processes**:
  - Service Worker lifecycle, alarms, storage listeners, and badge coordination (`background/background.ts`).

### 2.2 Tools & Evaluation Frameworks
- Static structural code analysis across 50+ TypeScript modules and stylesheets.
- Automated multi-browser production bundling (`webpack`, `tsc`, `check:isolation:all`).
- Automated Jest test suite evaluation (66 test suites, 936 unit tests).
- WCAG 2.2 AA accessibility principles (Perceivable, Operable, Understandable, Robust).
- Nielsen Norman Group (NN/g) 10 Usability Heuristics for User Interface Design.

### 2.3 Limitations
- Real-time hardware screen reader tests (NVDA/JAWS/VoiceOver) were evaluated via semantic DOM inspection, ARIA tree modeling, and automated Jest DOM unit tests.
- Multi-browser testing was verified via Webpack production artifact builds and Playwright harness structures.

---

## 3. Product and Feature Inventory

| Surface / Area | Entry Point | Primary User Functionality | Implementation Status |
|---|---|---|---|
| **Extension Toolbar Icon** | Browser Toolbar | Displays extension icon, active due card badge counter (`setBadgeText`), and global shortcut `Ctrl+Shift+A` (`Command+Shift+A`). | Production Ready |
| **Popup Dashboard** | Click Toolbar Icon | Stats summary, quick search, heatmap preview, quick chips, highlighter controls, notification settings, data backup/restore, dev actions. | Production (High Clutter) |
| **Injected Tracker Widget** | Floating Brain FAB | Problem approach notes, tag input, rating buttons (Again, Hard, Good, Easy), full-screen editor launcher. | Production (Severe Close Flaw) |
| **Highlighter Tooltip** | Text Selection | Floating palette swatch picker, underline/highlight toggle, mark deletion, custom palette selector. | Production Ready |
| **Full-Screen Editor** | Tracker / Popup | Rich Markdown note editor, time/space complexity inputs, live preview toggle, auto-save status. | Production (Tab Close Flaw) |
| **Data Manager** | Popup Stats Click | Filterable table of all cards, bulk selection, bulk delete, bulk retag, inline approach editing. | Production (Empty State Flaw) |
| **Analytics Dashboard** | Popup / Header Icon | 7-tab scientific analytics: learning velocity, memory health, future simulation, tag coverage, review times. | Production Ready |
| **Exam Countdown Mode** | Popup Study Tools | Redistributes cards evenly across target exam date deadline, countdown timer ring. | Production (Data Integrity Flaw) |
| **Pomodoro Timer** | Popup Study Tools | 25/5/15 focus/break timer, progress ring, session counter, background alarm synchronization. | Production (Accessibility Flaw) |
| **Highlighter Options** | Popup / Tooltip | Custom palette creator (1–5 slots), color picker, hex inputs, reset to defaults. | Production Ready |
| **Highlighter Manager** | Popup / Context | Searchable list of all highlighted snippets across pages, markdown export, clipboard copy. | Production Ready |
| **Active Platforms** | Popup Details | Whitelist manager for supported websites, dynamic host permission requests and script registration. | Production (Broken Script Path) |
| **FSRS Customizer** | Popup Details | Target retention slider, decay constants, 17 raw FSRS weights, auto-training with WebAssembly optimizer. | Production (Extreme Jargon) |
| **Help & Privacy Hub** | Popup Header / Footer | 7-tab documentation center with search, study strategy guides, permissions breakdown, privacy guarantees. | Production Ready |
| **Onboarding Wizard** | First Install (`onInstalled`) | 3-step welcome guide: theme selection, how-to-highlight tutorial, notification permissions. | Production (No Pin Guidance) |
| **Side Panel** | None | Not implemented (`manifest.json` does not declare `side_panel`). | Missing |

---

## 4. Overall UX Assessment

| Usability Heuristic | Rating | Observations |
|---|---|---|
| **1. Visibility of System Status** | ⚠️ Moderate | Due card badges on the toolbar icon and dynamic toast notifications provide good feedback. However, several settings toggles (e.g. "Show Analytics & Charts") produce zero visible change in the popup. |
| **2. Match Between System & Real World** | ❌ Poor | The interface exposes raw algorithmic terms ("FSRS Weights", "Decay Constant: -0.5", "Factor Constant: 0.234567") and shifts terminology arbitrarily between "Patterns", "Cards", and "Problems". |
| **3. User Control & Freedom** | ⚠️ Moderate | The in-page widget close button permanently destroys the launcher without recovery. Exam mode deactivation wipes review progress made during exam preparation. |
| **4. Consistency & Standards** | ❌ Poor | Multiple standalone pages invoke raw `window.close()` which fails silently in standard browser tabs, while other pages properly use `chrome.tabs.remove()`. Primary and secondary button hierarchies vary across pages. |
| **5. Error Prevention** | ⚠️ Moderate | Destructive "Reset to Defaults" actions include confirmation alerts, but card deletions in the data table lack temporary undo snackbars. Input fields lack strict constraint validation. |
| **6. Recognition Rather Than Recall** | ⚠️ Moderate | Searching patterns requires manual keyword typing; tag inputs lack auto-completion against existing tags, leading to fractured categories ("array" vs "Array"). |
| **7. Flexibility & Efficiency of Use** | 🟢 Good | Power users benefit from keyboard shortcuts (1–4 for ratings, `Ctrl+Shift+A` for popup), draggable widgets, and fast bulk table operations. |
| **8. Aesthetic & Minimalist Design** | ❌ Poor | The popup is an overwhelming monolith packed with 25+ controls, 10 cards, and 1,400px of scrolling. Secondary study tools crowd the primary spaced-repetition workflow. |
| **9. Help Users Recognize & Recover** | ⚠️ Moderate | Whitelisting a custom website fails silently when internal script paths are broken, leaving the user with no error explanation. |
| **10. Help & Documentation** | 🟢 Good | The Help Center is comprehensive, well-structured, searchable, and includes a dedicated privacy policy. However, dumping users into it immediately after onboarding causes cognitive overload. |

---

## 5. Critical User Journeys

### Journey A: The First-Time Candidate (Onboarding & Activation)
- **Goal**: Install the extension, understand what it does, and record the first LeetCode problem review.
- **Observed Flow**:
  1. User installs extension from Web Store.
  2. Browser automatically opens `welcome.html`.
  3. Step 1 prompts for theme selection (Dark / Light). User picks Dark.
  4. Step 2 shows a 3-step text guide on highlighting text and clicking the brain icon.
  5. Step 3 prompts for notification permissions.
  6. User clicks "Explore Guide" and is redirected to `features/common/help/help.html` (a 927-line technical guide with 7 tabs).
  7. User closes the help tab. In Chrome, the extension icon is hidden inside the puzzle piece menu. User does not know it needs to be pinned.
  8. User visits `leetcode.com/problems/two-sum`. A floating brain icon appears at `bottom: 150px`.
  9. User clicks brain icon; tracker widget opens. User writes approach notes and clicks "Good". Card is saved!
- **Obstacles**:
  - No prompt or visual visual aid to pin the extension icon in the browser toolbar.
  - Abrupt redirect from onboarding into heavy technical documentation instead of celebrating completion and offering a "Start Solving on LeetCode" CTA.
  - Floating brain icon overlaps bottom console drawers on LeetCode until manually dragged.

### Journey B: The Daily Review Habit (Regular User)
- **Goal**: Review cards that are due today within 15 minutes.
- **Observed Flow**:
  1. User sees badge count "4" on the toolbar extension icon.
  2. User clicks icon or presses `Ctrl+Shift+A`. Popup opens.
  3. User is greeted by level badge, XP bar, 3 stat boxes, search bar, tag dropdown, gamification progress ring, 12-month contribution heatmap, 4 chip buttons, 2 study tool chips, highlighter settings, notification settings, and data backup controls.
  4. User clicks "Due Today (4)" stat box.
  5. Instead of reviewing cards directly in the popup or opening a distraction-free review runner, a new browser tab opens to `data.html?view=due`.
  6. The data table shows 4 rows. User clicks problem title link, which navigates to LeetCode in yet another tab.
  7. On LeetCode, user must manually click the brain icon to rate the review.
- **Obstacles**:
  - Extreme cognitive clutter in popup before reaching due cards.
  - Disjointed review loop: popup -> data table tab -> problem tab -> floating widget. There is no inline "Flashcard Review Session" flow.

### Journey C: Custom Whitelist Expansion (Encountering Problems)
- **Goal**: Enable the tracker and highlighter on a personal blog or company coding portal (`mycompany.internal/code`).
- **Observed Flow**:
  1. User opens popup -> expands "Data & Options" -> clicks "Manage Active Websites".
  2. New tab opens `websites.html`.
  3. User enters `mycompany.internal` in the input field and clicks "Authorize & Add".
  4. Chrome displays host permission prompt. User approves.
  5. Success toast appears: `Authorized & Whitelisted: mycompany.internal`.
  6. User visits `mycompany.internal/code/problem-1`.
  7. **Nothing happens**. No brain icon, no highlighter tooltip.
- **Root Cause & Obstacle**:
  - The script registration API call in `websites.ts` hardcodes `js: ["content/fsrs.js", "content/content.js"]` and `css: ["content/style.css"]`. These files do not exist in the build output. Registration fails silently.

### Journey D: The Exam Crammer (Power User)
- **Goal**: Set a deadline for an upcoming Meta interview in 14 days and redistribute all cards evenly.
- **Observed Flow**:
  1. User opens popup -> Study Tools -> clicks "Exam Mode".
  2. New tab opens `studyplan.html`. User picks a date 14 days away and clicks "Activate Exam Mode".
  3. All 140 cards are rescheduled (10 cards/day).
  4. Over the next 10 days, user completes 100 reviews on LeetCode. FSRS computes updated stabilities and difficulties.
  5. Interview is completed. User returns to Exam Mode and clicks "Deactivate Exam Mode".
  6. Deactivation routine replaces card `due` dates with `originalDue` snapshot from 2 weeks ago.
- **Obstacle & Data Loss**:
  - Newly earned review data is overwritten with stale dates, breaking spaced repetition integrity.

### Persona E: Accessibility-Focused User (Keyboard & Screen Reader)
- **Goal**: Navigate the popup and study tools exclusively via keyboard and screen reader.
- **Obstacles**:
  - In `popup.html`, `<label id="import-btn-label">` and `<label class="data-btn purple">` for file upload cannot be focused via `Tab`.
  - In `pomodoro.html`, the primary `#start-btn` and `#pause-btn` have no text or `aria-label`.
  - In `tracker.ts`, the in-page widget cannot be closed using the standard `Escape` key.
  - In `highlightOptions.ts`, color slot deletion buttons lack accessible labels.

---

## 6. Detailed Usability Findings

---

### UX-001: Dynamic Custom Website Whitelisting Script Registration References Nonexistent Files
**Severity:** Critical  
**User impact:** Very High  
**Frequency:** Very Frequent (100% of custom website additions)  
**Implementation effort:** Small  
**Confidence:** High (Directly verified in source code and build output)  
**Affected area:** Active Platforms Manager (`features/common/websites/websites.ts`)  
**Evidence status:** Source-code and build verified  

**Description:**  
When a user authorizes a new custom platform in `websites.html`, the extension requests host permissions and registers dynamic content scripts using `chrome.scripting.registerContentScripts()`. However, the registered file paths are legacy files that no longer exist in the compiled bundle (`content/fsrs.js` and `content/style.css`).

**Current behavior:**  
The registration executes:
```ts
chrome.scripting.registerContentScripts([
    {
        id: `site-${hostname.replace(/[^a-z0-9]/g, '-')}`,
        matches: [originPattern],
        js: ["content/fsrs.js", "content/content.js"],
        css: ["content/style.css"],
        runAt: "document_idle",
        allFrames: true
    }
]);
```
In the extension build output directory (`dist/chrome/`), `content/fsrs.js` does not exist (the bundle is `dist/fsrsScheduler.bundle.js` and `features/common/marked.min.js`), and `content/style.css` does not exist (the stylesheet is `features/highlighter/style.css`). The script injection fails or throws runtime exceptions, preventing the tracker or highlighter from ever appearing on custom authorized sites.

**Expected behavior:**  
Dynamically registered content scripts must reference the identical compiled bundles specified in `manifest.json`:
- JS: `["features/common/marked.min.js", "dist/fsrsScheduler.bundle.js", "content/content.js"]`
- CSS: `["features/highlighter/style.css"]`

**Steps to reproduce:**  
1. Open popup -> expand "Data & Options" -> click "Manage Active Websites".
2. Type `github.com` into the input field and click "Authorize & Add".
3. Accept the browser permission prompt.
4. Navigate to any `github.com` repository or markdown page.
5. Notice that the floating brain icon and text highlighter never appear.

**Root cause:**  
During the TypeScript modularization and Webpack refactoring, output paths were moved to `features/` and `dist/`, but `websites.ts` (lines 206–215) retained outdated raw file paths.

**User impact:**  
Users attempting to track problems on unlisted platforms (CodeChef, HackerEarth, GitHub, company wikis) find the extension completely non-functional, destroying trust.

**Recommendation:**  
Update `features/common/websites/websites.ts` lines 206–215 to match manifest content script assets:
```ts
chrome.scripting.registerContentScripts([
    {
        id: `site-${hostname.replace(/[^a-z0-9]/g, '-')}`,
        matches: [originPattern],
        js: [
            "features/common/marked.min.js",
            "dist/fsrsScheduler.bundle.js",
            "content/content.js"
        ],
        css: ["features/highlighter/style.css"],
        runAt: "document_idle",
        allFrames: true
    }
]);
```

**Potential affected files/components:**  
- `features/common/websites/websites.ts`
- `tests/unit/features/common/websites/websites.test.ts`

**Suggested test coverage:**  
Integration test verifying that the arguments passed to `chrome.scripting.registerContentScripts` match the files emitted by Webpack in `dist/`.

**Verification criteria:**  
Adding a domain dynamically on a test tab successfully injects the FAB and highlighter tooltip without console file-not-found errors.

---

### UX-002: In-Page Tracker "Close" Button Destroys Floating Launcher Without Reopening Capability
**Severity:** Critical  
**User impact:** Very High  
**Frequency:** Very Frequent  
**Implementation effort:** Small  
**Confidence:** High  
**Affected area:** In-Page Tracker (`features/tracker/tracker.ts`)  
**Evidence status:** Source-code verified  

**Description:**  
The in-page tracker widget has two header control buttons: "Minimize" (`#fsrs-min-btn`) and "Close" (`#fsrs-close-btn`). When users click "Close", the code hides both the dialog container AND the floating launcher FAB. There is no keyboard shortcut, context menu command, or popup action that can restore the floating launcher on that tab.

**Current behavior:**  
In `features/tracker/tracker.ts` lines 646–651:
```ts
document.getElementById('fsrs-close-btn')?.addEventListener('click', () => {
    try {
        container.style.display = 'none';
        launcher.style.display = 'none';
        launcher.setAttribute('aria-expanded', 'false');
    } catch (err) { ... }
});
```
The launcher is permanently hidden (`display: none`).

**Expected behavior:**  
Clicking "Close" should either:
1. Act identically to "Minimize" (dismiss the modal container and leave the floating brain FAB visible for future access).
2. Or, if "Close" is intended to clear screen real estate, provide an explicit toast ("AlgoRecall closed. Reopen anytime from the extension popup or press Alt+A") with an option to reopen.

**Steps to reproduce:**  
1. Navigate to `leetcode.com/problems/two-sum`.
2. Click the floating brain icon in the bottom-right corner. The tracker dialog opens.
3. Click the "X" (Close) button in the top-right corner of the dialog.
4. Observe that both the dialog and the brain icon vanish.
5. Attempt to record another note without refreshing the entire webpage. It is impossible.

**Root cause:**  
Overly aggressive dismissal logic in the click event listener that unmounts/hides the launcher element without providing a recovery trigger.

**User impact:**  
Users instinctively click "X" to dismiss dialogs. In doing so, they inadvertently kill the extension for that session, forcing page reloads that discard unsubmitted code or test runs.

**Recommendation:**  
Change `#fsrs-close-btn` behavior to minimize the dialog back to the floating brain icon, or toggle between minimized and launcher states:
```ts
document.getElementById('fsrs-close-btn')?.addEventListener('click', () => {
    container.style.display = 'none';
    launcher.style.display = 'flex';
    launcher.setAttribute('aria-expanded', 'false');
});
```

**Potential affected files/components:**  
- `features/tracker/tracker.ts`
- `tests/unit/features/tracker/tracker.test.ts`

**Suggested test coverage:**  
Unit test verifying that clicking `#fsrs-close-btn` leaves `#algo-fsrs-launcher` with `display: flex`.

---

### UX-003: Data Backup Restore & Anki Import File Labels in Popup Lack Keyboard Focusability
**Severity:** High  
**User impact:** High  
**Frequency:** Frequent for keyboard users  
**Implementation effort:** Small  
**Confidence:** High  
**Affected area:** Popup Dashboard (`features/dashboard/popup/popup.html`, `popup.css`)  
**Evidence status:** Source-code verified  

**Description:**  
In the popup's collapsible "Data & Options" section, file-based import actions ("Restore Backup" and "From Anki") are implemented as `<label class="data-btn">` wrappers around visually hidden `<input type="file" style="display:none;">` elements. Because `<label>` elements are not natively focusable and have no `tabindex="0"`, keyboard-only users navigating via `Tab` cannot reach or activate these controls.

**Current behavior:**  
```html
<label id="import-btn-label" class="data-btn danger">
    <svg ...></svg>
    Restore
    <input type="file" id="import-file" accept=".json,.gz,.json.gz" style="display:none;">
</label>
```
Pressing `Tab` jumps directly over "Restore" and "From Anki", landing on subsequent buttons.

**Expected behavior:**  
Every actionable control must be keyboard reachable with a visible focus ring conforming to WCAG 2.2 SC 2.1.1 (Keyboard) and SC 2.4.7 (Focus Visible).

**Steps to reproduce:**  
1. Open the popup dashboard.
2. Press `Tab` repeatedly to navigate into the "Data & Options" section.
3. Observe focus landing on "Backup" button, then jumping directly to "To Anki" button, skipping "Restore" entirely.

**Root cause:**  
Using hidden file inputs inside non-focusable `<label>` tags without `tabindex="0"`, `role="button"`, or `:focus-visible` CSS rules on `.data-btn`.

**User impact:**  
Motor-impaired and keyboard-reliant users cannot import backups or Anki flashcards through the popup interface.

**Recommendation:**  
Add `tabindex="0"`, `role="button"`, and Enter/Space event handlers to file input labels, and add focus styles in `popup.css`:
```css
.data-btn:focus-visible {
    outline: 2px solid var(--md-primary);
    outline-offset: 2px;
}
```

**Potential affected files/components:**  
- `features/dashboard/popup/popup.html`
- `features/dashboard/popup/popup.css`
- `features/dashboard/popup/popup.ts`

**Suggested test coverage:**  
Automated test verifying that `document.getElementById('import-btn-label')` has `tabindex="0"` and dispatches click on Enter keydown.

---

### UX-004: Massive 1,400px+ Vertical Scroll Depth in 350px Popup Interface
**Severity:** High  
**User impact:** High  
**Frequency:** Very Frequent  
**Implementation effort:** Medium  
**Confidence:** High  
**Affected area:** Popup Information Architecture (`features/dashboard/popup/popup.html`)  
**Evidence status:** Layout analysis verified  

**Description:**  
The popup dashboard has a fixed width of 350px, but aggregates almost every feature the extension offers into a single linear scrolling pane: Level progress bar, XP bar, 3 stat boxes, search input, tag select, search results, gamification ring, streak text, 12-month contribution heatmap, full-screen heatmap CTA, 4 action chips (Lifetime, Analytics, Forecast, History), 2 study chips (Exam Mode, Pomodoro), Highlighter settings (toggle, 2 action buttons), Notification settings (toggle, interval select, custom input, sticky toggle, quiet hours toggle, time pickers, weekly digest toggle, manual check button), collapsible Data & Options (show charts toggle, dev toggle, export logs, 2 nav buttons, 4 import/export buttons), static rating banner, and footer.

**Current behavior:**  
The total rendered height exceeds 1,400px. In browser popup viewports (typically capped at 600px by Chrome and Firefox), the user must scroll through 2.5 full viewports of disparate controls. The primary call to action for spaced repetition—clearing due reviews—is pushed below the fold.

**Expected behavior:**  
A clean, focused popup dashboard that emphasizes immediate actionable information:
1. Due review status and direct review launcher CTA.
2. Compact search & quick stats.
3. Tabbed or segmented view separating "Daily Reviews & Activity" from "Study Tools" and "Settings / Data Management".

**Root cause:**  
Feature bloat without a tiered information architecture or dedicated options/settings surface.

**User impact:**  
High cognitive load, visual fatigue, and difficulty locating essential controls. Users open the popup to review problems but are confronted with configuration toggles and raw parameters.

**Recommendation:**  
1. Introduce a bottom navigation bar or tabbed view in the popup: `[Home / Reviews]` | `[Study Tools]` | `[Settings]`.
2. Move complex notification parameters, custom check intervals, and Anki import/export options into the dedicated options page (`features/highlighter/options/highlightOptions.html` or a unified `options.html`).

---

### UX-005: In-Page Tracker Dialog Missing `Escape` Key Dismissal Handler
**Severity:** High  
**User impact:** Medium  
**Frequency:** Frequent  
**Implementation effort:** Small  
**Confidence:** High  
**Affected area:** In-Page Tracker (`features/tracker/tracker.ts`)  
**Evidence status:** Source-code verified  

**Description:**  
The in-page tracker widget dialog (`#algo-fsrs-container`) has `role="dialog"` and `aria-modal="true"`. It traps `Tab` focus, but fails to listen for the standard `Escape` key to minimize or close the dialog.

**Current behavior:**  
Pressing `Escape` while focused inside the tracker notes textarea or rating buttons does nothing. The user must manually find and click the minimize or close icon.

**Expected behavior:**  
Pressing `Escape` should minimize the dialog, restore the floating brain launcher, and return focus to the launcher, conforming to WAI-ARIA Dialog (Modal) design patterns and WCAG 2.2 SC 2.1.2.

**Root cause:**  
In `features/tracker/tracker.ts` lines 616–631, the `keydown` listener strictly inspects `if (e.key !== 'Tab') return;` and ignores `e.key === 'Escape'`.

**Recommendation:**  
Add an `Escape` key listener on the container:
```ts
if (e.key === 'Escape') {
    e.preventDefault();
    container.style.display = 'none';
    launcher.style.display = 'flex';
    launcher.setAttribute('aria-expanded', 'false');
    launcher.focus();
}
```

---

### UX-006: Exam Mode Deactivation Reverts Reviewed Cards to Stale Due Dates
**Severity:** High  
**User impact:** High  
**Frequency:** Occasional (every Exam Mode cycle)  
**Implementation effort:** Medium  
**Confidence:** High  
**Affected area:** Exam Countdown Study Plan (`features/dashboard/studyplan/studyplan.ts`)  
**Evidence status:** Source-code verified  

**Description:**  
When Exam Mode is activated, it snapshots the current `due` timestamp of every card into `card.originalDue` and redistributes due dates evenly up to the exam date. While in Exam Mode, the user performs reviews on LeetCode; each review advances the card's interval and recalculates stability and difficulty. However, when the user deactivates Exam Mode, lines 268–275 unconditionally revert `card.due = card.originalDue`.

**Current behavior:**  
```ts
this.allCards.forEach((card: Card & { originalDue?: number }) => {
    if (card.originalDue) {
        card.due = card.originalDue;
        delete card.originalDue;
    }
});
```
Any cards reviewed and updated during the exam study period have their newly computed review dates wiped out and replaced with the pre-exam date from weeks earlier.

**Expected behavior:**  
Deactivating Exam Mode should preserve reviews completed during the exam period:
- If a card was reviewed while Exam Mode was active (e.g. `card.lastReview > card.activatedAt`), its newly computed FSRS interval must be retained.
- Only cards that were *never reviewed* during the exam countdown should have their original due dates restored.

**Root cause:**  
Naive array iteration during deactivation that restores `originalDue` without inspecting whether the card was actively reviewed during the study plan window.

**User impact:**  
Users lose legitimate spaced repetition learning data; cards they recently mastered immediately pop back up as overdue.

**Recommendation:**  
Add an activation timestamp check:
```ts
const activatedAt = this.settings?.activatedAt || 0;
this.allCards.forEach((card: Card & { originalDue?: number }) => {
    const wasReviewedDuringExam = card.lastReview && card.lastReview >= activatedAt;
    if (card.originalDue && !wasReviewedDuringExam) {
        card.due = card.originalDue;
    }
    delete card.originalDue;
});
```

---

### UX-007: Onboarding Wizard Abruptly Redirects to Heavy Documentation Without Pinning Guidance
**Severity:** High  
**User impact:** High  
**Frequency:** Very Frequent (all first-time installs)  
**Implementation effort:** Small  
**Confidence:** High  
**Affected area:** Welcome Experience (`features/common/welcome/welcome.ts`, `welcome.html`)  
**Evidence status:** Source-code verified  

**Description:**  
Upon finishing Step 3 of onboarding, clicking "Explore Guide" executes `window.location.href = '../help/help.html'`, abruptly dropping a brand-new user into a dense 927-line technical manual with 7 tabs. There is no congratulatory "You're All Set!" completion screen, no CTA to start practicing on LeetCode, and no guidance on pinning the extension icon in Chrome's extension menu.

**Current behavior:**  
New users are dumped into technical documentation and left unaware that their extension toolbar icon is hidden by default in Chrome MV3.

**Expected behavior:**  
Step 3 should lead to a clear Completion state:
1. "🎉 You're ready to master coding patterns!"
2. Visual illustration showing how to click Chrome's puzzle piece icon and pin AlgoRecall to the toolbar.
3. Direct action button: "Go to LeetCode" (`https://leetcode.com/problemset/all/`).

**Root cause:**  
Navigation handler in `welcome.ts` line 56 hardcoded to redirect to `help.html`.

**User impact:**  
Poor user activation. Users cannot find the extension in their toolbar and feel overwhelmed by extensive manual documentation immediately after installing.

---

### UX-008: Standalone Pages Use Raw `window.close()` Failing in Modern Browser Tabs
**Severity:** Medium  
**User impact:** Medium  
**Frequency:** Frequent  
**Implementation effort:** Small  
**Confidence:** High  
**Affected area:** Editor, Websites Manager, FSRS Config (`editor.ts`, `websites.ts`, `fsrsConfig.ts`)  
**Evidence status:** Source-code verified  

**Description:**  
Several extension pages opened in full browser tabs have "Close" buttons that invoke raw JavaScript `window.close()`. In Chromium and WebKit browsers, `window.close()` is ignored by the browser security sandbox if the tab was navigated to, refreshed, or opened without explicit script window references (`Scripts may close only the windows that were opened by them`).

**Current behavior:**  
Clicking "Close and return" in `editor.html`, "Close Manager" in `websites.html`, or "Close Config" in `fsrsConfig.html` fails silently if the user refreshed the tab. The button appears broken.

**Expected behavior:**  
The button should detect the tab environment and use the Chrome Extension Tabs API (`chrome.tabs.getCurrent` and `chrome.tabs.remove`), falling back to `window.close()`, exactly as implemented in `features/common/help/help.ts`:
```ts
if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.getCurrent) {
    chrome.tabs.getCurrent((tab) => {
        if (tab && tab.id) {
            chrome.tabs.remove(tab.id);
        } else {
            window.close();
        }
    });
} else {
    window.close();
}
```

---

### UX-009: "Show Analytics & Charts" Popup Setting Produces Zero Visible Effect in Popup
**Severity:** Medium  
**User impact:** Medium  
**Frequency:** Frequent  
**Implementation effort:** Small  
**Confidence:** High  
**Affected area:** Popup Settings (`features/dashboard/popup/popup.ts`, `popup.html`)  
**Evidence status:** Source-code verified  

**Description:**  
In the popup's "Data & Options" section, there is a toggle labeled "Show Analytics & Charts" (`#toggle-show-charts`). Toggling this setting on or off has absolutely zero visual effect on the popup interface—the heatmap, streak ring, and analytics chips remain visible.

**Current behavior:**  
The toggle saves `extensionSettings.showCharts = target.checked`. The only place this setting is consumed is in `features/common/data/data.ts` line 954 to toggle an analytics preview row inside `data.html`. In the popup where the toggle lives, nothing changes.

**Expected behavior:**  
Settings toggles must produce immediate, understandable feedback in the context where they are manipulated. If "Show Analytics & Charts" is toggled off in the popup, it should collapse the popup's heatmap and gamification cards to reduce scroll height. Alternatively, the toggle should be renamed or moved to `data.html`.

---

### UX-010: Data Dashboard Displays Raw Empty Table Headers Without Empty-State Guidance
**Severity:** Medium  
**User impact:** Medium  
**Frequency:** Frequent on new installs  
**Implementation effort:** Small  
**Confidence:** High  
**Affected area:** Data Dashboard (`features/common/data/data.ts`)  
**Evidence status:** Source-code verified  

**Description:**  
When a user opens the Data Dashboard (`data.html`) on a fresh install (0 cards saved) or enters a search query with 0 matching results, `generateCardsTable()` renders a raw table header (`<thead>`) followed by an empty `<tbody></tbody>`.

**Current behavior:**  
The user sees column headers ("Problem Title", "Tags", "Next Due", "State", etc.) floating over a blank grey void. There is no friendly empty-state illustration, no explanatory message, and no actionable link.

**Expected behavior:**  
Display a semantic empty-state card:
- If 0 total cards: "No problem patterns tracked yet! Visit LeetCode or AlgoMonster and click the brain icon to save your first pattern."
- If 0 filter matches: "No patterns match your search criteria." with a "Clear All Filters" button.

---

### UX-011: Pomodoro Controls and Palette Slot Deletion Buttons Lack Accessible Names
**Severity:** Medium  
**User impact:** High for screen reader users  
**Frequency:** Very Frequent  
**Implementation effort:** Small  
**Confidence:** High  
**Affected area:** Pomodoro Timer & Highlighter Options (`pomodoro.html`, `highlightOptions.ts`)  
**Evidence status:** Source-code verified  

**Description:**  
- In `features/dashboard/pomodoro/pomodoro.html` lines 41–46, `#start-btn` and `#pause-btn` contain only raw SVG elements with `aria-hidden="true"`, with no `aria-label`, `title`, or inner text. Screen readers announce them simply as "button".
- In `features/highlighter/options/highlightOptions.ts` lines 332–336, palette slot removal buttons are dynamically created with `delBtn.title = 'Remove color'` but omit `aria-label="Remove color slot ${idx + 1}"`.

**Expected behavior:**  
All interactive icon-only buttons must provide explicit accessible names via `aria-label` satisfying WCAG 2.2 SC 4.1.2 (Name, Role, Value).

---

### UX-012: Full-Tab Analytics Dashboard "Dashboard" Footer Link Navigates Tab to Popup UI
**Severity:** Medium  
**User impact:** Medium  
**Frequency:** Frequent  
**Implementation effort:** Small  
**Confidence:** High  
**Affected area:** Analytics Dashboard (`features/dashboard/analytics/analytics.html`)  
**Evidence status:** Source-code verified  

**Description:**  
In the standalone full-tab Analytics page (`analytics.html`), the sidebar footer contains an anchor `<a href="../popup/popup.html">Dashboard</a>`. Clicking this button navigates the full-sized browser tab to `popup.html`.

**Current behavior:**  
`popup.html` was designed as a 350px extension popup. When loaded into a 1920×1080 browser tab, it renders constrained inside an 850px container with visible borders, stranding the user in a strange layout where popup interactions (like `window.close()`) fail.

**Expected behavior:**  
Full-tab pages should not navigate back into the popup. The sidebar button should either link to the Data Manager (`data.html`) or close the current tab to return focus to the user's coding tab.

---

### UX-013: FSRS Customizer Exposes Raw Mathematical Formulas and 17 Weight Inputs
**Severity:** Medium  
**User impact:** High (Cognitive Load & Confusion)  
**Frequency:** Occasional  
**Implementation effort:** Medium  
**Confidence:** High  
**Affected area:** FSRS Config Page (`features/tracker/config/fsrsConfig.html`)  
**Evidence status:** Source-code verified  

**Description:**  
When clicking "Configure FSRS Algorithm" from the popup, users are directed to a page displaying "Decay Constant: -0.5", "Factor Constant: 0.234567", and seventeen individual floating-point inputs (`w0` through `w16`). There are no tooltips, no plain-language explanations of how each weight influences memory stability, and no preset profiles.

**Current behavior:**  
Interview candidates looking to tune their review frequency are faced with overwhelming mathematical jargon. Entering invalid values can corrupt the scheduling engine.

**Expected behavior:**  
Provide a simple/advanced mode toggle:
- **Simple Mode**: Slider for Target Retention (80%–95%) with plain-language explanations ("Conservative - More reviews", "Optimal - Recommended", "Aggressive - Fewer reviews").
- **Advanced Mode**: Collapsible accordion containing raw weights and the personal auto-train optimization button.

---

### UX-014: Static "Text copied to clipboard!" Toast Pre-Populated in DOM on Page Load
**Severity:** Low  
**User impact:** Low  
**Frequency:** Rare  
**Implementation effort:** Small  
**Confidence:** High  
**Affected area:** Highlighted Snippets Manager (`features/highlighter/manager/highlights.html`)  
**Evidence status:** Source-code verified  

**Description:**  
In `highlights.html` line 87, `#status-toast` is defined with hardcoded static text: `<div id="status-toast" class="toast">Text copied to clipboard!</div>`.

**Current behavior:**  
Screen readers indexing the page DOM can announce "Text copied to clipboard!" when the user first opens the page, before any copy action has taken place.

**Expected behavior:**  
Initialize the toast container as empty: `<div id="status-toast" class="toast" aria-live="polite"></div>`. Set text content dynamically only when a snippet is copied.

---

### UX-015: Inconsistent Terminology Across Extension Surfaces ("Patterns" vs "Cards" vs "Problems")
**Severity:** Low  
**User impact:** Low  
**Frequency:** Very Frequent  
**Implementation effort:** Small  
**Confidence:** High  
**Affected area:** Global Microcopy (`popup.html`, `data.html`, `tracker.ts`)  
**Evidence status:** Content analysis verified  

**Description:**  
The extension refers to tracked items inconsistently:
- Popup Hero: "Patterns" (`box-total`)
- Popup Search: "Search patterns..."
- In-Page Tracker: "AlgoRecall Tracker" and "Save & Rate Initial Difficulty"
- Data Dashboard: "Total Saved Patterns", "All Cards", "Delete Card", "Edit Card"
- Exam Mode: "Total Cards", "Cards/Day"
- Analytics: "Cards", "Problems"

**Expected behavior:**  
Standardize on consistent domain terminology:
- Primary noun: **Patterns** (matches interview learning philosophy).
- Storage/card noun: **Cards** (or consistently "Pattern Cards").

---

### UX-016: Card Deletion in Data Table Relies on Generic `window.confirm` Without Undo
**Severity:** Low  
**User impact:** Medium  
**Frequency:** Occasional  
**Implementation effort:** Small  
**Confidence:** High  
**Affected area:** Data Dashboard (`features/common/data/data.ts`)  
**Evidence status:** Source-code verified  

**Description:**  
Deleting a card in `data.html` uses synchronous native browser `confirm('Are you sure you want to delete this card?')`. It is permanent and irreversible. If dismissed accidentally or clicked rapidly during bulk operations, review history is unrecoverable without restoring a prior JSON backup.

**Expected behavior:**  
Provide an in-app non-modal confirmation dialog or a 5-second "Card deleted. [Undo]" toast notification.

---

### UX-017: Focus Ring Contrast on Header Buttons in Light Theme Below 3:1
**Severity:** Low  
**User impact:** Medium for keyboard users  
**Frequency:** Frequent  
**Implementation effort:** Small  
**Confidence:** High  
**Affected area:** Popup Header (`features/dashboard/popup/popup.css`)  
**Evidence status:** Visual inspection verified  

**Description:**  
In light theme, header buttons (`#theme-toggle-btn`, `#header-analytics-btn`, `#help-btn`) have subtle focus indicators that blend with `--md-surface`, failing WCAG 2.2 SC 2.4.11 (Focus Appearance).

**Expected behavior:**  
Ensure a 2px solid focus ring with a minimum 3:1 contrast ratio against the header background:
```css
:root.light-theme .icon-btn:focus-visible {
    outline: 2px solid var(--md-primary);
    outline-offset: 2px;
}
```

---

## 7. Cross-Cutting UX Problems

### 7.1 "Close Window" Antipattern
Multiple extension pages (`editor.ts`, `websites.ts`, `fsrsConfig.ts`) rely on raw `window.close()`. Modern browsers block script closure of tabs that were not directly opened via `window.open()`. When users refresh a tab or open it via URL, clicking "Close" fails silently with no user feedback.

### 7.2 Terminology Fragmentation
Terminology shifts across screens between "Patterns", "Cards", and "Problems". This dilutes the extension's core branding message of "Pattern-Based Spaced Repetition".

### 7.3 Disconnected Review Loop
Spaced repetition extensions thrive on quick, frictionless review loops (e.g. Anki's spacebar-to-reveal, 1–4 to rate). In AlgoRecall, reviewing due cards requires opening the popup -> clicking due cards -> opening `data.html` -> clicking a problem link -> opening LeetCode -> opening the in-page widget -> rating. There is no consolidated "Quick Review" modal inside the extension.

### 7.4 Monolithic Popup vs Options Delegation
The popup attempts to do everything: settings, analytics, gamification, data export, notifications, and study plans. Standard extension design principles (Chrome Extension Design Guide) recommend keeping popups under 400px height focused on primary daily tasks, delegating settings and configuration to `options.html`.

---

## 8. Recommended Design System Improvements

1. **Standardize Action Button Variants (`base.css`)**:
   - `btn-primary`: Brand gradient with elevation (used exclusively for primary task completion).
   - `btn-secondary`: Neutral surface with border (used for configuration and secondary actions).
   - `btn-danger`: Outlined destructive action (delete, reset).
   - `btn-ghost`: Borderless text icon buttons.
2. **Accessible Form Controls**:
   - Wrap all icon-only buttons with explicit `aria-label` attributes.
   - Ensure all custom toggle switches manage `aria-checked` and respond to `Space`.
   - Never use hidden file inputs without keyboard-accessible wrapper styling (`:focus-visible`).
3. **Empty States Standard**:
   - Standardize empty-state component: Icon + Heading + Description + Primary Action Button.
4. **Modal Window Lifecycle Helper**:
   - Create a shared utility `ExtensionNavigation.closeCurrentSurface()` that safely closes tabs via `chrome.tabs.remove()` where available, falling back to `window.close()`.

---

## 9. Recommended Improvements by Priority

### Priority 1: Critical & Immediate (Fixes Broken Core Workflows)
- **UX-001**: Correct dynamic content script file paths in `websites.ts` (`features/common/marked.min.js`, `dist/fsrsScheduler.bundle.js`, `content/content.js`, `features/highlighter/style.css`).
- **UX-002**: Fix `#fsrs-close-btn` in `tracker.ts` so it minimizes to the floating launcher rather than destroying it.
- **UX-006**: Fix Exam Mode deactivation in `studyplan.ts` so actively reviewed cards preserve their new due dates.

### Priority 2: High Priority (Accessibility & Essential Architecture)
- **UX-003**: Make backup restore and Anki import labels keyboard focusable (`tabindex="0"`, `:focus-visible`).
- **UX-004**: Streamline popup layout; organize content into clean segments (Reviews vs Settings).
- **UX-005**: Add `Escape` key dismissal to in-page tracker widget dialog.
- **UX-007**: Add toolbar icon pinning guidance and LeetCode CTA to onboarding completion.
- **UX-008**: Replace raw `window.close()` with safe `chrome.tabs.remove()` across standalone tabs.

### Priority 3: Medium Priority (Usability Polish & Clarity)
- **UX-009**: Connect "Show Analytics & Charts" toggle to popup components or move it to `data.html`.
- **UX-010**: Implement friendly empty-state illustration and clear-filter button in `data.html`.
- **UX-011**: Add `aria-label` to Pomodoro timer buttons and palette slot deletion buttons.
- **UX-012**: Fix Analytics sidebar footer link to avoid navigating full tabs into popup layout.
- **UX-013**: Simplify FSRS customizer with Simple (retention slider) and Advanced (weights) modes.

### Priority 4: Low Priority & Polish
- **UX-014**: Clear static toast text in `highlights.html` on page load.
- **UX-015**: Unify domain terminology across all pages ("Patterns").
- **UX-016**: Implement undo snackbar for card deletions in `data.html`.
- **UX-017**: Enhance focus ring contrast in light theme header buttons.

---

## 10. Test Recommendations

| Test Category | Target Finding ID | Description |
|---|---|---|
| **Integration Test** | **UX-001** | Verify `chrome.scripting.registerContentScripts` registers valid compiled file paths emitted by Webpack. |
| **Unit Test** | **UX-002** | Verify clicking `#fsrs-close-btn` sets `#algo-fsrs-launcher` to `display: flex`. |
| **Unit Test** | **UX-003** | Verify `#import-btn-label` has `tabindex="0"` and triggers click on Enter keydown. |
| **Accessibility Test** | **UX-005** | Verify `#algo-fsrs-container` listens to `Escape` key and returns focus to launcher. |
| **Algorithmic Test** | **UX-006** | Verify `deactivateExamMode()` does not overwrite cards whose `lastReview >= activatedAt`. |
| **Unit Test** | **UX-008** | Verify `ExtensionNavigation.closeTab()` calls `chrome.tabs.remove(tabId)`. |
| **DOM / Unit Test** | **UX-010** | Verify `generateCardsTable([])` renders an empty-state card instead of an empty table. |
| **Accessibility Test** | **UX-011** | Verify Pomodoro `#start-btn` and `#pause-btn` have valid non-empty `aria-label` attributes. |

---

## 11. Implementation Roadmap

```mermaid
flowchart TD
    subgraph Phase 1: Core Defect Elimination
        UX001["UX-001: Fix Script Paths in websites.ts"]
        UX002["UX-002: Fix Tracker Close Button"]
        UX006["UX-006: Fix Exam Mode Review Persistence"]
    end

    subgraph Phase 2: Accessibility & Tab Lifecycle
        UX003["UX-003: Keyboard Accessible Data Labels"]
        UX005["UX-005: Dialog Escape Key Trap"]
        UX008["UX-008: Safe Tab Closing Utility"]
        UX011["UX-011: Pomodoro & Swatch Accessible Names"]
    end

    subgraph Phase 3: Information Architecture & Onboarding
        UX004["UX-004: Popup Layout Streamlining"]
        UX007["UX-007: Pinning Guidance in Welcome"]
        UX009["UX-009: Connect Charts Toggle"]
        UX010["UX-010: Data Table Empty State"]
    end

    subgraph Phase 4: Polish & Microcopy
        UX012["UX-012: Analytics Nav Link Fix"]
        UX013["UX-013: Simple/Advanced FSRS Config"]
        UX014["UX-014: Static Toast Clearance"]
        UX015["UX-015: Terminology Standardization"]
        UX016["UX-016: Card Deletion Undo Toast"]
    end

    Phase 1 --> Phase 2
    Phase 2 --> Phase 3
    Phase 3 --> Phase 4
```

---

## 12. Limitations and Unverified Areas

1. **Host-Page CSS Collision**: While scoped CSS variables (`--algo-*`, `--md-*`) prevent style leakage, certain aggressive CSS resets on platforms (e.g. Codeforces legacy table styling) could theoretically affect injected markdown typography.
2. **Safari iOS Viewport Pinch**: Touch-drag gesture interactions on Safari iOS for the floating launcher FAB were verified via pointer event handlers, but real physical touch latency on iOS devices requires device lab validation.
3. **High Volume Storage Scaling**: Behavior when storing >5,000 cards was verified in unit tests up to storage limits, but performance on lower-end hardware during full-database export remains dependent on device memory.

---

## 13. Master Audit Checklist

| ID | Category | Severity | User Impact | Effort | Confidence | Status |
|---|---|---|---|---|---|---|
| **UX-001** | Core Workflows | Critical | Very High | Small | High | Confirmed Defect |
| **UX-002** | Core Workflows | Critical | Very High | Small | High | Confirmed Defect |
| **UX-003** | Accessibility | High | High | Small | High | Confirmed Defect |
| **UX-004** | Information Architecture | High | High | Medium | High | Confirmed Defect |
| **UX-005** | Accessibility | High | Medium | Small | High | Confirmed Defect |
| **UX-006** | Data Integrity | High | High | Medium | High | Confirmed Defect |
| **UX-007** | Onboarding | High | High | Small | High | Confirmed Defect |
| **UX-008** | Browser Integration | Medium | Medium | Small | High | Confirmed Defect |
| **UX-009** | State & Feedback | Medium | Medium | Small | High | Confirmed Defect |
| **UX-010** | Error & Empty States | Medium | Medium | Small | High | Confirmed Defect |
| **UX-011** | Accessibility | Medium | High | Small | High | Confirmed Defect |
| **UX-012** | Navigation | Medium | Medium | Small | High | Confirmed Defect |
| **UX-013** | Cognitive Load | Medium | High | Medium | High | Confirmed Defect |
| **UX-014** | Accessibility | Low | Low | Small | High | Confirmed Defect |
| **UX-015** | Microcopy | Low | Low | Small | High | Confirmed Defect |
| **UX-016** | Error Recovery | Low | Medium | Small | High | Confirmed Defect |
| **UX-017** | Visual Design | Low | Medium | Small | High | Confirmed Defect |

---

## 14. Final Assessment

AlgoRecall possesses an exceptional core: a local-first privacy model, zero cloud lock-in, state-of-the-art FSRS spaced repetition scheduling, and responsive, theme-synced styling.

However, it is currently held back by several critical friction points:
1. **Broken Whitelisting Script Paths**: Users cannot expand the extension to custom coding platforms.
2. **Fragile In-Page Tracker Lifecycle**: Closing the widget makes it vanish for the remainder of the user's coding session.
3. **Popup Cognitive Overload**: Cramming 25+ controls and 1,400px of scrolling into a 350px window dilutes the primary goal of reviewing due patterns.
4. **Key Accessibility Gaps**: Unlabelled icon buttons, non-focusable file labels, and missing `Escape` dismissal keys prevent full keyboard and screen-reader operability.

Executing the prioritized recommendations in `usability-audit.md` will transform AlgoRecall from an engineering prototype with advanced features into a polished, production-grade learning tool capable of standing alongside top-tier developer extensions on the Chrome Web Store, Firefox Add-ons, and Mac App Store.

