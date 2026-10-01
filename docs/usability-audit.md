# Browser Extension Usability Audit — AlgoRecall

> **Scope**: Usability, UI/UX, visual design, accessibility, and browser-integration audit.
> **Method**: File-level static inspection of all UI surfaces, manifests, stylesheets, TypeScript logic, and content scripts.
> **Browsers evaluated**: Chrome, Firefox, Safari.
> **Date**: 2026-10-01

---

## Executive Summary

AlgoRecall is a feature-rich, privacy-first spaced repetition extension with a well-structured Material Design 3-inspired visual system, scoped CSS isolation for injected UI, and meaningful browser-specific capability guards. It offers substantial value for coding interview preparation with an impressively broad feature set for a browser extension.

### Major usability strengths
- Scoped CSS variables per injected widget — excellent isolation from host-page styles.
- Consistent dual-theme (dark/light) system with flash-of-unstyled-content mitigation.
- Keyboard shortcuts for rating actions (1–4) and show-answer during review sessions.
- Graceful Safari degradation with build-time flags instead of runtime branching.
- Reduced-motion media query present in all three stylesheets.
- `role="alert"` and `aria-live="assertive"` on in-page review notifications.
- Comprehensive help documentation with tabbed navigation and search.

### Major usability risks
1. **Missing `lang` attribute on 11 of 14 HTML files** — affects all screen reader users.
2. **`role="switch"` misapplied to `<label>` elements** (not `<input>`) across the popup — incorrect ARIA semantics.
3. **Only one toolbar icon size (128px PNG)** — downscaled to 16px appears blurry; no active/inactive icon state.
4. **No keyboard shortcut to open the extension** — discoverability gap for power users.
5. **Interactive `stat-box` divs lack `role="button"` and `tabindex`** — keyboard users cannot activate them.
6. **Development-only "1 min (Dev)" interval option visible to all users** — erodes trust and causes confusion.
7. **Duplicate store review CTAs** — marketing over user experience.
8. **`innerHTML` injection in `notifications.ts`** with unsanitized parameters — latent XSS risk.
9. **No loading/empty state differentiation** — dash placeholders shown on initial load are indistinguishable from "zero data" states.
10. **`#algo-fsrs-container` lacks `aria-modal="true"`** — screen readers may not properly trap focus inside the widget dialog.

---

## Extension Overview

**Name**: AlgoRecall: Coding Interview Spaced Repetition  
**Purpose**: Free, local-first spaced repetition (FSRS-4.5 algorithm) extension for tracking coding problem reviews and highlighting key text on LeetCode, AlgoMonster, Codeforces, and other platforms.

### Primary workflow
1. User visits a supported coding platform.
2. Extension injects a floating brain-icon FAB (`#algo-fsrs-launcher`) in the bottom-right corner.
3. User clicks the FAB to open the tracker widget.
4. User types approach notes, adds tags, rates recall difficulty (Again / Hard / Good / Easy).
5. The FSRS algorithm calculates the next review date.
6. OS or in-page notifications alert the user when cards are due again.

### Browser targets
- Chrome (MV3, service worker, chrome.notifications, chrome.alarms, chrome.downloads)
- Firefox (MV3, background scripts, same API surface as Chrome)
- Safari macOS/iOS (MV3, service worker, no notifications or downloads)

---

## UI Surface Inventory

| Surface | Chrome | Firefox | Safari | Status |
|---|---|---|---|---|
| Popup dashboard | ✓ | ✓ | ✓ (no notifs) | Analyzed |
| Injected tracker widget | ✓ | ✓ | ✓ | Analyzed |
| Highlighter tooltip | ✓ | ✓ | ✓ | Analyzed |
| Full-screen editor | ✓ | ✓ | ✓ | Analyzed |
| Highlighter options | ✓ | ✓ | ✓ | Analyzed |
| Welcome/onboarding | ✓ | ✓ | ✓ | Analyzed |
| Help center | ✓ | ✓ | ✓ | Analyzed |
| In-page notifications | ✓ | ✓ | ✗ | Analyzed |
| Toolbar icon | ✓ | ✓ | ✓ | Analyzed |
| Background service worker | ✓ | ✓ | ✓ (limited) | Analyzed |
| Manifests | ✓ | ✓ | ✓ | Analyzed |

---

## Findings

### CRITICAL

---

#### [Critical] Missing `lang` attribute on 11 of 14 HTML pages

**Location**: `popup.html`, `editor.html`, `highlightOptions.html`, `help.html`, `heatmap.html`, `forecast.html`, `analytics.html`, `summary.html`, `pomodoro.html`, `history.html`, `studyplan.html`  
**Browsers**: All  
**Category**: Accessibility

Only `welcome.html`, `websites.html`, and `fsrsConfig.html` include `lang="en"`. All other extension pages are missing the attribute.

**User impact**: Screen readers cannot determine the document language, affecting correct pronunciation, automatic language switching, and braille rendering for all extension pages. WCAG 2.1 SC 3.1.1 (Language of Page) is Level A.

**Recommendation**: Add `lang="en"` to the `<html>` element on all 11 affected HTML files. This is a one-line fix per file.

---

#### [Critical] `role="switch"` applied to `<label>` wrapper instead of `<input>`

**Location**: `popup.html` lines 234, 294, 320, 327, 342, 393, 401  
**Browsers**: All  
**Category**: Accessibility

```html
<label class="switch" role="switch" tabindex="0">
    <input type="checkbox" id="toggle-marker-popup" checked>
    <span class="slider"></span>
</label>
```

`role="switch"` and `tabindex="0"` are placed on the `<label>` wrapper. No `aria-checked` is set. Screen readers announce the label as a switch but cannot reliably track its checked state or keyboard activation because the native `<input>` handles state.

**User impact**: Screen reader users receive incorrect semantic information about all popup toggle controls — the most-used control type in settings. WCAG 2.1 SC 4.1.2 (Name, Role, Value) is Level A.

**Recommendation**: Remove `role="switch"` and `tabindex="0"` from `<label>`. Add `role="switch"` and `aria-checked` (kept in sync via JS on change events) directly to the `<input type="checkbox">` element, or manage `aria-checked` on the label and implement keyboard event delegation.

---

#### [Critical] Interactive `stat-box` elements are not keyboard accessible

**Location**: `popup.html` lines 121–133; click handlers in `popup.ts`  
**Browsers**: All  
**Category**: Accessibility, Keyboard

```html
<div class="stat-box" id="box-total" title="View all saved patterns">
    <span class="stat-value" id="total-cards">-</span>
    <span class="stat-label">Patterns</span>
</div>
```

Styled with `cursor: pointer`; click handlers attached in `popup.ts`. No `role="button"`, no `tabindex`, no keyboard event handler.

**User impact**: Keyboard-only users cannot discover or activate the three most-prominent interactive elements in the popup (Patterns, Due Today, Retention). These navigate to filtered views.

**Recommendation**: Convert each `stat-box` to a `<button>` element, or add `role="button"`, `tabindex="0"`, and `keydown` (Enter/Space) handlers.

---

### HIGH

---

#### [High] `#algo-fsrs-container` dialog is missing `aria-modal="true"`

**Location**: `tracker.ts` lines 411–412  
**Browsers**: All  
**Category**: Accessibility

The widget container has `role="dialog"` and `aria-label` but no `aria-modal="true"`. Screen readers in virtual browse mode may traverse DOM content outside the open widget, breaking the expected dialog focus containment for NVDA, JAWS, and VoiceOver users.

**Recommendation**: Add `container.setAttribute('aria-modal', 'true')` when the container is shown, and implement JavaScript focus trapping when the dialog opens.

---

#### [High] Editor back button is a `<span>` — not keyboard accessible

**Location**: `editor.html` lines 23–30  
**Browsers**: All  
**Category**: Accessibility, Keyboard

```html
<span class="back-arrow" id="header-back-btn" title="Close and return">
    <svg ...></svg> Close
</span>
```

The primary close/discard control for the full-screen editor is a `<span>` with no `role`, `tabindex`, or keyboard event handler.

**Recommendation**: Replace with `<button class="back-arrow" id="header-back-btn">` or add `role="button"` and `tabindex="0"` with a `keydown` handler.

---

#### [High] Single toolbar icon size (128px PNG only)

**Location**: `icons/icon.png`; all three manifests  
**Browsers**: All  
**Category**: Browser Integration, Visual Design

Only a 128px PNG exists. Browsers downscale to 16px and 32px for the toolbar. No `action.default_icon` provides purpose-sized variants. No badge showing due card count.

**Recommendation**:
1. Create 16×16, 32×32, 48×48, and 128×128 PNG icon variants.
2. Add `action.default_icon` to all manifests with multi-size keys.
3. Use `chrome.action.setBadgeText()` to show a due card count badge.

---

#### [High] No keyboard shortcut to open the extension

**Location**: All three manifests  
**Browsers**: All  
**Category**: Keyboard, Discoverability

No `commands` key exists in any manifest. Keyboard shortcuts for ratings (1–4) exist within the tracker, but no shortcut opens it — the two halves of the keyboard workflow are inconsistent.

**Recommendation**: Add a `commands` entry:
```json
"commands": {
  "_execute_action": {
    "suggested_key": { "default": "Ctrl+Shift+A", "mac": "Command+Shift+A" },
    "description": "Open AlgoRecall Dashboard"
  }
}
```

---

#### [High] Development-only "1 min (Dev)" interval option visible to end users

**Location**: `popup.html` line 302  
**Browsers**: All  
**Category**: Cognitive Load, Copy

```html
<option value="1">1 min (Dev)</option>
```

Appears in the Check Interval dropdown in production builds. Users who select it receive notifications every minute; the label is unexplained jargon.

**Recommendation**: Conditionally inject this `<option>` only when the Developer Mode toggle is active. Remove it from the default DOM.

---

#### [High] Notification Settings card shown to Safari users who cannot use notifications

**Location**: `popup.html` lines 265–369  
**Browsers**: Safari only  
**Category**: Context Awareness, Cross-Browser

`BROWSER_CONFIG.supportsNotifications` is `false` for Safari. The Notification Settings card renders in the popup HTML and may be visible before JS hides it. Even if hidden, it creates an incorrect first impression.

**Recommendation**: Move notification-related DOM into a JS-generated fragment conditioned on `BROWSER_CONFIG.supportsNotifications`. Alternatively, render the card with a visible "Notifications are not available on Safari" explanation rather than hiding it silently.

---

### MEDIUM

---

#### [Medium] Duplicate store review CTAs in the popup

**Location**: `popup.html` lines 88–116 (`#rating-prompt-card`) and lines 492–503 (`.static-review-banner`)  
**Browsers**: All  
**Category**: Cognitive Load, Layout

Two simultaneous store-review prompts can appear: the conditional dismissable card and the always-visible footer banner. Browser popups have 350px width; promotional content competes with functional UI.

**Recommendation**: Show only one review prompt at a time. When `#rating-prompt-card` is visible, hide `.static-review-banner`.

---

#### [Medium] `.stat-label` text at 10px — below readable minimum

**Location**: `popup.css`  
**Browsers**: All  
**Category**: Typography, Accessibility

```css
.stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; }
```

10px uppercase text with wide letter-spacing is difficult to read for users with mild visual impairments.

**Recommendation**: Increase to at least 11px; reduce letter-spacing to 0.5px.

---

#### [Medium] Heatmap level colors are hardcoded hex — not theme-aware

**Location**: `popup.css` lines 841–855  
**Browsers**: All  
**Category**: Dark Mode, Visual Design

`.level-1` through `.level-3` use hardcoded dark greens that render poorly on the light theme.

**Recommendation**: Replace with CSS variables defined in both `:root` (dark) and `:root.light-theme`:
```css
:root { --heatmap-level-1: #0c3321; --heatmap-level-2: #0e5630; --heatmap-level-3: #178347; }
:root.light-theme { --heatmap-level-1: #b7e4c7; --heatmap-level-2: #74c69d; --heatmap-level-3: #2d6a4f; }
```

---

#### [Medium] Native time picker appearance broken in light theme

**Location**: `popup.css` line 1056  
**Browsers**: All  
**Category**: Dark Mode, Visual Design

```css
.time-input { color-scheme: dark; }
```

Forces dark native time picker UI regardless of the active extension theme.

**Recommendation**: Add `:root.light-theme .time-input { color-scheme: light; }`.

---

#### [Medium] Widget title "FSRS Tracker" exposes internal algorithm name

**Location**: `tracker.ts` line 421  
**Browsers**: All  
**Category**: Copy, Cognitive Load

"FSRS" is an internal algorithm name. The extension's public-facing brand is "AlgoRecall". This creates a disconnect in the primary interactive surface.

**Recommendation**: Rename to "AlgoRecall Tracker" or "Study Tracker".

---

#### [Medium] Tag input in tracker widget has no accessible label

**Location**: `tracker.ts` lines 435–438  
**Browsers**: All  
**Category**: Accessibility

The tags input uses only a placeholder and an SVG icon for context. No `<label>`, `aria-label`, or `aria-labelledby`.

**Recommendation**: Add `aria-label="Add tags"` to `#fsrs-tags-input`.

---

#### [Medium] "Privacy Policy" link navigates to Help page — misleading label

**Location**: `popup.html` line 507  
**Browsers**: All  
**Category**: Copy, Navigation

```html
<a href="../../common/help/help.html?tab=advanced">Privacy Policy</a>
```

Users expect a standalone legal document; they reach a general help page.

**Recommendation**: Rename to "Help & Privacy" or create a dedicated privacy policy document.

---

#### [Medium] Welcome Step 2 references fixed widget position that user can change

**Location**: `welcome.html` lines 62–65  
**Browsers**: All  
**Category**: Copy, Context Awareness

"Click the brain icon in the bottom-right corner" — the widget is draggable and can be moved anywhere.

**Recommendation**: Update copy to "Click the brain icon on the page to open the rating slider. (You can drag it anywhere.)".

---

#### [Medium] "Reset to Defaults" in highlighter options has no confirmation

**Location**: `highlightOptions.html` line 81–84  
**Browsers**: All  
**Category**: Error Recovery, Interaction

Permanently deletes all custom palette configurations with no confirmation or undo.

**Recommendation**: Add a confirmation dialog or a 5-second undo toast.

---

#### [Medium] No loading/empty state differentiation in popup stats

**Location**: `popup.ts`, `stats.ts`, `popup.html` lines 122–132  
**Browsers**: All  
**Category**: State/Feedback

`-` and `-%` placeholder values are identical for loading, empty, and error states.

**Recommendation**: Show a brief shimmer/skeleton during load; display `0` when data loads with no cards; display an error indicator if storage read fails.

---

### LOW

---

#### [Low] `btn-primary` appearance inconsistent across pages

**Location**: `base.css` vs `popup.css`  
**Category**: Visual Design, Consistency

`base.css` defines a muted container color; `popup.css` overrides with a vivid gradient. Pages using only `base.css` have subdued primary buttons.

**Recommendation**: Unify `btn-primary` by defining the vivid gradient in `base.css`.

---

#### [Low] Toast in `highlightOptions.html` contains hardcoded success text on page load

**Location**: `highlightOptions.html` line 89  
**Category**: Accessibility

```html
<div id="status-toast" class="toast">Settings saved successfully!</div>
```

Screen readers may announce this text on page open.

**Recommendation**: Initialize all toast elements as empty; set text content only when triggered.

---

#### [Low] Back buttons in widget use hardcoded `color: #aaa` inline style

**Location**: `tracker.ts` lines 957, 1108  
**Category**: Dark Mode, Visual Design

Inline `color: #aaa` overrides theme CSS variables and does not adapt to light theme.

**Recommendation**: Replace inline color with CSS class using `var(--w-text-low)`.

---

#### [Low] Tooltip caret always positioned at `left: 20px`

**Location**: `style.css` lines 577–588  
**Category**: Layout, Visual Design

The highlight tooltip caret (::after) is hardcoded at `left: 20px` regardless of tooltip position, making it misalign when the tooltip is near the right viewport edge.

**Recommendation**: Compute and set caret position dynamically in JavaScript.

---

#### [Low] Step indicator dots on welcome page have no ARIA step announcement

**Location**: `welcome.html` lines 26–30  
**Category**: Accessibility, Onboarding

```html
<span class="step active" id="dot-1"></span>
```

No `role`, `aria-label`, or `aria-current`. Screen readers cannot announce current step.

**Recommendation**: Add `aria-label="Step 1 of 3"` and `aria-current="step"` to the active dot.

---

#### [Low] Emoji in Help Center tab labels may be read aloud

**Location**: `help.html` lines 55–130  
**Category**: Accessibility

```html
<button role="tab">🚀 Getting Started & Strategy</button>
```

Some screen readers announce emoji descriptions aloud.

**Recommendation**: Wrap emoji in `<span aria-hidden="true">`.

---

#### [Low] Initial notification badge in Welcome Step 3 uses `error` CSS class for neutral state

**Location**: `welcome.html` line 83  
**Category**: Copy, Visual Design

```html
<span id="welcome-notif-status" class="status-badge error">Disabled</span>
```

"Disabled" is the expected initial state, not an error.

**Recommendation**: Use a neutral CSS class (e.g., `status-badge pending`) for the initial state.

---

### OBSERVATIONS

---

#### [Observation] No `prefers-color-scheme` integration

**Location**: `theme-sync.ts`

Extension defaults to dark mode regardless of OS preference. Users must manually switch.

**Consideration**: Read `prefers-color-scheme` on first install to set the default automatically.

---

#### [Observation] `innerHTML` injection in `notifications.ts` — latent XSS risk

**Location**: `content/notifications.ts` lines 61–71

`title` and `message` parameters injected via template literals into `innerHTML`. Currently safe because data originates from the background service worker, but the pattern is worth noting for future maintenance.

**Consideration**: Use `textContent` for title/message or sanitize inputs before injection.

---

#### [Observation] Widget FAB position may overlap LeetCode's sticky bottom toolbar

**Location**: `style.css` lines 52–53

Launcher is fixed at `bottom: 150px`. LeetCode's expanded bottom console panel may partially obscure the FAB.

**Consideration**: Test and adjust the default `bottom` offset against LeetCode's expanded bottom panel state.

---

#### [Observation] Pomodoro timer state may not survive service worker restart

**Location**: `background.ts`

MV3 service workers can be terminated by the browser. `setInterval`-based Pomodoro timer resets silently on restart.

**Consideration**: Verify Pomodoro state is persisted to `chrome.storage.local` on each tick and recovered on service worker restart. Surface a resume indicator in the Pomodoro page.

---

## Cross-Browser Audit

| UX Area | Chrome | Firefox | Safari | Finding |
|---|---|---|---|---|
| Popup | Identical | Identical | Identical (minus notifs) | Safari notification card is a gap |
| Onboarding | Identical | Identical | Identical | OK |
| Injected UI | Identical | Identical | Identical | OK |
| Keyboard shortcuts | None | None | None | Missing across all |
| OS notifications | ✓ | ✓ | ✗ | Correctly absent; popup card not Safari-aware |
| Backup/Downloads | ✓ | ✓ | ✗ | Correctly absent |
| Dark mode | Identical | Identical | Identical | OK |

### Intentional differences (justified)
- Safari: No OS notifications, no `chrome.downloads` — correctly guarded via `BROWSER_CONFIG`.
- Firefox: `optional_permissions` vs `optional_host_permissions` — correct MV3 difference.
- Chrome: `cross_origin_embedder_policy` / `cross_origin_opener_policy` — Chrome-specific keys.
- Store review copy: Browser-appropriate branding via `BROWSER_CONFIG`.

---

## Accessibility Audit Summary

| Control | Keyboard | Screen Reader | Notes |
|---|---|---|---|
| Popup toggles | Partial | Incorrect | role=switch on label, not input |
| Stat boxes | No | No | No role=button or tabindex |
| Chip buttons | Yes | Yes | Native button |
| Tracker launcher | Yes | Partial | Div role=button; no aria-expanded |
| Tracker widget | Partial | Partial | No aria-modal, no focus trap |
| Rating buttons | Yes | Yes | aria-label and keyboard shortcuts |
| Editor back button | No | No | Span element |
| Color swatches | No | No | No tabindex, no aria-label |
| Help tabs | Yes | Yes | role=tab with aria-selected |
| In-page notifications | Yes | Yes | role=alert, aria-live=assertive |

---

## Dark Mode / Theme Audit

| Area | Dark Mode | Light Mode | Notes |
|---|---|---|---|
| Popup body | ✓ | ✓ | CSS variable system |
| Heatmap levels 1–3 | ✓ | ✗ | Hardcoded dark greens |
| Time picker | ✓ | ✗ | Hardcoded color-scheme: dark |
| Widget tracker | ✓ | ✓ | Scoped CSS vars with light-theme class |
| In-page notifications | ✓ | ✓ | light-theme class applied dynamically |
| Highlight tooltip | ✓ | ✓ | light-theme class applied dynamically |
| Editor, Options, Welcome, Help | ✓ | ✓ | ThemeSync applied |
| Back buttons (inline style) | ✓ | ✗ | Hardcoded #aaa overrides theme |

---

## Visual Design Audit

**Typography strengths**: Consistent system font stack; correct use of weight/size hierarchy for headings and body text.

**Typography issues**:
- `.stat-label` at 10px uppercase — below minimum readable size.
- `.goal-ring-label` at 9px — below minimum recommended text size.

**Color system**: Material Design 3-inspired palette is well-executed. Semantic success/warning/danger colors are consistently applied.

**Color issues**:
- Heatmap levels 1–3: hardcoded dark greens do not adapt to light theme.
- Time picker: forced dark color-scheme in light mode.
- Button hover states: hardcoded hex in `base.css` (`#2c2e37`) not theme-aware.

**Button inconsistency**: `btn-primary` has different appearance on popup vs. all other extension pages (vivid gradient vs. muted container color).

---

## Permission & Trust Audit

| Permission | Risk | User Explanation |
|---|---|---|
| `storage` | Low | Implicit |
| `activeTab` | Low | Implicit |
| `tabs` | Medium | None |
| `notifications` | Low | Welcome Step 3 |
| `alarms` | Low | Implicit |
| `downloads` | Medium | None |
| `webNavigation` | Medium | None |
| `optional_host_permissions` (http/https) | High | None at point of use |

**Finding**: The `optional_host_permissions` for `http://*/*` and `https://*/*` (used for user-configured custom whitelisted sites) are never explained to users before the browser permission prompt appears. The browser prompt ("read and change all data on websites you visit") can alarm users without context.

**Recommendation**: When users add a custom site to the whitelist, display a pre-permission explanation: "AlgoRecall needs permission to access [site] to track your review sessions there. You'll see a permission prompt from your browser."

---

## State & Feedback Audit

| Component | Loading | Empty | Error | Success |
|---|---|---|---|---|
| Popup stat boxes | Dash (-) | Dash (-) | Dash (-) | Number |
| Tracker (new card) | Immediate | Rating prompt label | No explicit error | Toast |
| Editor | "Loading..." in h2 | "Loading..." in h2 | No explicit error | Auto-save status |
| Notification settings | Inline | N/A | No explicit error | Toast |
| Highlighter options | No indicator | Empty list | Toast | Toast |
| Welcome Step 3 | Badge changes | N/A | Badge (error class) | Badge (success) |

**Primary gap**: Loading, empty, and error states use the same dash placeholders in the popup — indistinguishable to users.

---

## Onboarding Audit

**Strengths**: Theme selection (Step 1) is well-designed. Step 2 numbered guide is clear. Step 3 notification permission flow is functional.

**Gaps**:
- No skip mechanism.
- Step dot indicators have no ARIA semantics.
- Back button on step 1 is hidden but still focusable.
- Notification status badge uses `error` CSS class for neutral "disabled" state.
- No reachability indicator if the welcome page is closed early.
- Step 2 references fixed widget position ("bottom-right corner").

---

## Cognitive Load Audit

The popup presents ~20+ interactive elements before the fold at typical popup height (~500px). Content categories crammed above the fold:
- App title + level badge + 3 header buttons + XP bar
- 3 stat boxes + search bar + tag filter
- Gamification ring + streak + heatmap + 4 chip buttons
- 2 study tool chips + 1 highlighter toggle + 2 highlighter buttons
- Partial notification settings

There is no single most-prominent primary action. A new user has no clear visual cue about where to start.

**Recommendation for consideration**: Evaluate separating Settings (notifications, highlighter) and Data (backup) into a dedicated options page, keeping the popup focused on stats, search, and review navigation.

---

## Copy & Content Audit

| String | Location | Issue | Recommendation |
|---|---|---|---|
| "FSRS Tracker" | Widget header | Internal algorithm name in user UI | "AlgoRecall Tracker" |
| "1 min (Dev)" | Popup interval select | Debug option in production | Gate behind dev mode |
| "Privacy Policy" | Popup footer | Links to Help, not a policy document | "Help & Privacy" |
| "Disabled" (error class) | Welcome Step 3 badge | Error class on neutral state | Use neutral CSS class |
| "Loading problem details..." | Editor h2 | Not differentiated from empty state | Add explicit loading indicator |
| "Loading URL..." | Editor URL span | Same | Same |
| "Loading FSRS data..." | Editor status | No aria-live | Add aria-live="polite" |
| "brain icon in the bottom-right corner" | Welcome Step 2 | Widget position is user-movable | "brain icon on the page" |

---

## Strengths

- **CSS isolation**: Scoped CSS variables per widget ID prevent host-page style bleed.
- **Dual theme system**: Well-executed Material Design 3-inspired tokens.
- **FOUC prevention**: Theme applied synchronously before render.
- **Reduced motion**: `prefers-reduced-motion` in all three stylesheets.
- **In-page notification accessibility**: `role="alert"` and `aria-live="assertive"` correctly implemented.
- **Keyboard shortcuts in review mode**: 1–4 keys and Space/Enter documented and functional.
- **Safari capability guards**: Build-time flags eliminate dead code and prevent runtime failures.
- **Rating button ARIA**: Meaningful `aria-label` and `title` attributes on all four rating buttons.
- **Help center**: Comprehensive, tabbed help with search — rare for a browser extension.
- **Collapsible advanced settings**: "Data & Options" reduces visual noise.
- **Draggable widget**: Good power-user feature with right-click-to-reset.

---

## Recommendations

### Immediate (High-impact, low effort)

1. Add `lang="en"` to all 11 HTML files missing it.
2. Fix `role="switch"` — move to `<input>` elements or add `aria-checked` management.
3. Add `tabindex="0"` and `role="button"` (or convert to `<button>`) to all three `stat-box` divs.
4. Add `aria-modal="true"` to `#algo-fsrs-container` and implement JS focus trapping.
5. Add `keyboard_shortcuts` / `commands` to all manifests.
6. Provide 16, 32, 48px icon variants in manifests.
7. Remove or gate "1 min (Dev)" interval option behind dev mode toggle.
8. Convert editor back-arrow `<span>` to `<button>`.
9. Add `aria-label="Add tags"` to tracker tag input.
10. Hide Notification Settings card on Safari or add Safari-specific explanation text.

### Near-term (Meaningful improvements)

11. Fix heatmap level colors to use theme-aware CSS variables.
12. Add `:root.light-theme .time-input { color-scheme: light; }`.
13. Consolidate duplicate store review CTAs — show only one at a time.
14. Add loading/empty state differentiation — use `0` for zero cards; add shimmer during load.
15. Add confirmation step for "Reset to Defaults" in highlighter options.
16. Replace hardcoded `color: #aaa` inline styles in tracker back buttons.
17. Add `aria-live="polite"` to editor status indicator (`#save-status`).
18. Add `aria-controls` to Help Center tab buttons.
19. Wrap emoji in `<span aria-hidden="true">` within Help Center tab labels.
20. Add an empty state message in the tracker widget when no cards exist for the current URL.
21. Explain `optional_host_permissions` to users before the browser permission prompt.
22. Rename "Privacy Policy" footer link to "Help & Privacy".
23. Increase `.stat-label` to minimum 11px.
24. Add a badge (`chrome.action.setBadgeText`) showing due card count.

### Future (Polish and optimization)

25. Read `prefers-color-scheme` on first install to set default theme.
26. Add `aria-label` to color swatches indicating the color they represent.
27. Add keyboard navigation between color swatches in the highlight tooltip.
28. Add a "Check Now" manual trigger in notification settings.
29. Evaluate popup information architecture — separate settings from dashboard.
30. Position tooltip caret dynamically based on computed tooltip position.
31. Add step indicator ARIA markup to welcome page dots.
32. Add a skip-tour option to the welcome onboarding.
33. Test FAB position against LeetCode bottom panel expanded state.
34. Verify Pomodoro timer state persistence across service worker restarts.
35. Sanitize `title`/`message` parameters before `innerHTML` injection in `notifications.ts`.

---

## Audit Coverage

| Dimension | Items Evaluated |
|---|---|
| Files inspected | 18 (manifests ×3, HTML ×8, CSS ×4, TS ×5) |
| UI surfaces | 11 |
| Browsers | Chrome, Firefox, Safari |
| Accessibility areas | Keyboard, ARIA roles, focus management, motion, text sizing, screen reader semantics |
| User journeys | Primary review, onboarding, settings, dark/light theme, help |
| Unresolved items | 5 (require runtime testing) |

---

## Unresolved Questions (Require Runtime Testing)

1. **Contrast ratios** — formal WCAG contrast ratio testing was not performed. Automated testing with axe or Colour Contrast Analyser is recommended.
2. **Backup file error handling** — error states and recovery path for invalid backup files were not confirmed.
3. **Safari notification card JS hide timing** — it is not confirmed whether the Notification Settings card is hidden before the user sees it on Safari.
4. **Focus management on widget open/close** — runtime testing would confirm whether focus moves to the widget on FAB click and returns to the FAB on close.
5. **Heatmap rendering performance** — for users with 2+ years of daily reviews (700+ activity entries), rendering performance was not measured.

---

*This audit was performed as a static code and design inspection. Runtime browser testing was not performed. Findings represent evidence-based usability and accessibility observations from file inspection.*
