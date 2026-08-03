# Content Scripts & DOM Orchestration

This document details the content script architecture (`content/content.ts`), `AlgoRecallOrchestrator`, DOM MutationObserver debouncing, SPA history navigation handling, and in-page notification rendering.

---

## 🖥️ Module Architecture

The content script pipeline comprises:
* **`content.ts`**: Entry point bootstrapping `AlgoRecallOrchestrator`.
* **`state.ts`**: Shared content scope state object (`AlgoRecallState`).
* **`utils.ts`**: Content utilities (DOM selectors for problem titles, tag auto-detection).
* **`notifications.ts`**: `Notifier` class rendering custom toast notifications inside the host webpage.

```mermaid
graph TD
    subgraph Browser Context
        DOMContentLoaded Event --> Boot[Instantiate AlgoRecallOrchestrator]
        Boot --> Init[Orchestrator.init]
    end

    subgraph Initialization Steps
        Init --> CheckDomain{Check Whitelisted Domain}
        CheckDomain -- Not Whitelisted --> Exit[Exit Early]
        CheckDomain -- Whitelisted --> LoadStorage[Read chrome.storage.local]
        LoadStorage --> CreateUI[Inject Tracker & Highlighter UI]
        CreateUI --> BindEvents[Bind Click, Storage & Message Listeners]
        BindEvents --> SetupMO[Attach DOM MutationObserver]
    end
```

---

## 🔄 MutationObserver & SPA Navigation Debouncing

Coding platforms (e.g. LeetCode, Codeforces) use Single Page Application (SPA) client-side routing. Content elements may re-render without a full page reload.

### MutationObserver Strategy
* Observes `document.body` for `childList`, `subtree`, and `characterData` mutations.
* Debounces highlight re-applications by 100 ms (`highlightDebounceTimer`).
* Re-injects launcher buttons if React/Vue hydration wipes them out.
* Monitors `window.location.href` to trigger aggressive UI updates when URLs change.

```typescript
this.domObserver = new MutationObserver(() => {
    if (this.state.highlightDebounceTimer) clearTimeout(this.state.highlightDebounceTimer);
    this.state.highlightDebounceTimer = setTimeout(() => {
        this.highlighter.applyHighlightsForCurrentPage();
        if (document.body && !document.getElementById('algo-fsrs-launcher')) {
            this.tracker.createUI();
        }
    }, 100);
});
```

---

## 🔔 In-Page Toast Notifications (`Notifier`)

When reviews are due or test notifications are sent, `Notifier.showPageNotification()` injects a styled toast notification directly into the active host webpage DOM (`algo-custom-notification`).

---

## 🔗 Related Documentation
* 📘 [Architecture Overview](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/architecture/overview.md)
* 🎯 [Tracker Feature](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/tracker.md)
* 🖍️ [Highlighter Feature](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/features/highlighter.md)
* 🛠️ [Customization Guide](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/CUSTOMIZATION.md)
