# Browser Extension Architecture (Manifest V3)

## 1. Manifest V3 Implementation

AlgoRecall strictly adheres to the **Chrome Extension Manifest V3 (MV3)** specification. This architecture introduces specific platform requirements, performance boundaries, and security rules that govern how the extension executes.

### 1.1 Manifest Specifications Comparison

The codebase maintains three dedicated manifest files in `browser/`:
- [`browser/chrome/manifest.json`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/browser/chrome/manifest.json) — Production Chrome Web Store manifest.
- [`browser/firefox/manifest.json`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/browser/firefox/manifest.json) — Firefox Add-ons (AMO) manifest.
- [`browser/safari/manifest.json`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/browser/safari/manifest.json) — Apple Safari Web Extension manifest.

| Dimension | Google Chrome (MV3) | Mozilla Firefox (MV3) | Apple Safari (MV3) |
|---|---|---|---|
| **Background Target** | `service_worker`: `"background/background.js"` (`type: "module"`) | `scripts`: `["background/background.js"]` (`type: "module"`) | `service_worker`: `"background/background.js"` (`type: "module"`) |
| **Alarms Support** | Supported (`chrome.alarms`) | Supported (`chrome.alarms`) | Supported (`chrome.alarms`) |
| **Notifications Support** | Supported (`chrome.notifications`) | Supported (`chrome.notifications`) | **Not supported** (omitted from permissions) |
| **Downloads Support** | Supported (`chrome.downloads`) | Supported (`chrome.downloads`) | **Not supported** (omitted from permissions) |
| **Browser Settings** | Standard MV3 | `browser_specific_settings.gecko.id: "algorecall@algomonster.com"` | Standard MV3 |
| **COOP / COEP** | `require-corp` / `same-origin` | Omitted | Omitted |
| **Extension Pages CSP** | `script-src 'self' 'wasm-unsafe-eval'; object-src 'self';` | `script-src 'self' 'wasm-unsafe-eval'; object-src 'self';` | `script-src 'self' 'wasm-unsafe-eval'; object-src 'self';` |

---

## 2. Service Worker Lifecycle & Ephemerality

In Manifest V3, background execution relies on an **ephemeral Service Worker** (`background/background.ts`). The service worker does not remain active indefinitely; the browser terminates it after 30 seconds of inactivity.

```
       Browser Event / Alarm / Command
                      │
                      ▼
        ┌───────────────────────────┐
        │  Service Worker Wakes Up  │
        └─────────────┬─────────────┘
                      │
                      ▼
        ┌───────────────────────────┐
        │  Instantiate Background   │
        │  (AlgoRecallBackground)   │
        └─────────────┬─────────────┘
                      │
                      ▼
        ┌───────────────────────────┐
        │  Restore In-Flight State  │
        │  - Check Pomodoro target  │
        │  - Rebind Chrome Listeners│
        └─────────────┬─────────────┘
                      │
                      ▼
        ┌───────────────────────────┐
        │  Process Request / Action │
        └─────────────┬─────────────┘
                      │
                      ▼
        ┌───────────────────────────┐
        │  Update Badge & Storage   │
        └─────────────┬─────────────┘
                      │
                      ▼
        ┌───────────────────────────┐
        │  Idle (Terminated after   │
        │  ~30s of inactivity)      │
        └───────────────────────────┘
```

### Critical Architectural Mitigations for Ephemerality

1. **No In-Memory Persistent State**: In-memory variables are discarded when the service worker is terminated. All persistent state (active Pomodoro `targetEndTime`, `lastNotificationTime`, `fsrsCards`) is read from and written to `chrome.storage.local`.
2. **Pomodoro Timer Resumption**: When a Pomodoro timer is running, the background worker maintains a `setInterval` ticker while awake. When the service worker sleeps, it relies on a backup alarm:
   ```typescript
   // background/background.ts L1183-1185
   const delayInMinutes = Math.max(0.1, (state.targetEndTime - Date.now()) / 60000);
   chrome.alarms.create('pomodoroEnd', { delayInMinutes });
   ```
   Upon wake-up in `resumePomodoroBackground()`, if `targetEndTime <= Date.now()`, it immediately executes `handlePomodoroEnd()`.
3. **Re-entrancy Guards**: Because wake-ups can trigger concurrent alarm callbacks, methods like `checkDueCards()` implement explicit re-entrancy locks (`this.isCheckingDueCards`).

---

## 3. Permissions & Host Permissions Matrix

### Manifest Permissions (`permissions`)
* `storage`: Persist problem cards, settings, and review logs locally.
* `activeTab` & `tabs`: Query active browser tabs to detect problem pages and route in-page notifications.
* `webNavigation`: Listen to `onHistoryStateUpdated` to detect client-side SPA navigations on coding platforms without page reloads.
* `scripting`: Programmatic injection fallback.
* `alarms`: Periodic background tasks (review check, weekly digest, Pomodoro completion).
* `notifications`: Native desktop notifications for due reviews.
* `downloads`: File download generation for JSON backups and Anki TSV decks.

### Host Permissions (`host_permissions`)
Explicitly scoped to supported coding interview and competitive programming platforms:
```json
[
  "*://*.algo.monster/*",
  "*://*.systemdesignschool.io/*",
  "*://*.codeforces.com/*",
  "*://*.leetcode.com/*",
  "*://*.codechef.com/*",
  "*://*.atcoder.jp/*",
  "*://*.hackerrank.com/*",
  "*://*.hackerearth.com/*",
  "*://*.codewars.com/*",
  "*://*.codingame.com/*"
]
```

### Optional Host Permissions (`optional_host_permissions`)
Allows users to whitelist custom arbitrary coding platforms in `features/common/websites/websites.html` via `chrome.permissions.request({ origins: [...] })`.

---

## 4. Content Script Injection Model

The content script bundle consists of:
1. `features/common/marked.min.js`: Bundled Markdown parser.
2. `dist/fsrsScheduler.bundle.js`: Pre-bundled FSRS mathematical scheduler.
3. `content/content.js`: Main orchestrator script.
4. `features/highlighter/style.css`: Highlighter overlay styling.

### Isolated World Execution
Content scripts run in an **isolated world**—they have full access to the host page DOM, but do not share JavaScript variables, global scopes, or prototype modifications with host scripts.

### SPA Navigation Interception
Coding platforms (like LeetCode and AlgoMonster) are Single Page Applications that navigate client-side without standard HTTP page loads. AlgoRecall uses a dual-hook strategy:
1. **Background webNavigation Listener**:
   ```typescript
   chrome.webNavigation.onHistoryStateUpdated.addListener(this.handleHistoryStateUpdated.bind(this));
   ```
   When the URL changes, background sends `{ action: "spa_url_changed", url: details.url }` to the active tab.
2. **In-Page DOM MutationObserver**:
   `AlgoRecallOrchestrator` watches the DOM tree for problem title rendering and resets widget state when navigation occurs.
