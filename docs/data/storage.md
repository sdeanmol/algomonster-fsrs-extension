# Storage Architecture & Persistence Patterns

## 1. Storage Overview

AlgoRecall relies exclusively on [`chrome.storage.local`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/docs/data/storage.md) for data persistence.

### Key Characteristics
- **Scope**: Local to the user's browser profile.
- **Quota**: Defaults to 10 MB in Chrome (can be requested up to unlimited via `"unlimitedStorage"` if required, currently unneeded as an active library with 1,000 cards occupies ~1.5 MB).
- **Asynchronous Execution**: All reads and writes are asynchronous callbacks or Promises.
- **Event-Driven Reactivity**: Emits `chrome.storage.onChanged` events across all extension contexts.

---

## 2. Key-Value Storage Schema

| Storage Key | Type | Description | Primary Readers | Primary Writers | Access Pattern |
|---|---|---|---|---|---|
| `fsrsCards` | `Card[]` | Array of all saved flashcard problems | `content.ts`, `background.ts`, `data.ts`, `analytics.ts`, `popup.ts` | `tracker.ts`, `editor.ts`, `studyplan.ts`, `data.ts` | High-frequency read, medium-frequency write |
| `fsrsActivity` | `Record<string, number>` | Daily review counter map (`"YYYY-MM-DD" -> count`) | `heatmap.ts`, `analytics.ts`, `popup.ts`, `summary.ts` | `fsrsScheduler.ts`, `tracker.ts`, `popup.ts` | Read on view load, incremented per review |
| `marks` | `HighlightMark[]` | Array of all text highlight annotations | `highlighter.ts`, `highlights.ts` | `highlighter.ts`, `highlights.ts` | Read on whitelisted page load, written on text selection |
| `notificationSettings` | `NotificationSettings` | Desktop alert toggles, frequency, quiet hours | `background.ts`, `popup.ts`, `settings.ts` | `popup.ts`, `settings.ts` | Read on SW startup and alarms; written on toggle |
| `pomodoroState` | `PomodoroState` | Live timer execution and phase countdown | `background.ts`, `pomodoro.ts` | `background.ts`, `pomodoro.ts` | Polled by background SW, updated on phase transition |
| `pomodoroSettings` | `PomodoroSettings` | Work/break duration lengths | `pomodoro.ts`, `background.ts` | `pomodoro.ts` | Read on timer start, written in pomodoro settings |
| `pomodoroStats` | `PomodoroStats` | Daily completed sessions and focus minutes | `pomodoro.ts`, `background.ts` | `background.ts` (when phase completes) | Written on pomodoro completion |
| `studyPlanSettings` | `StudyPlanSettings` | Exam Countdown target date and daily target | `studyplan.ts`, `stats.ts` | `studyplan.ts` | Read on popup render; written on exam mode toggle |
| `whitelistedWebsites` | `WhitelistedWebsite[]` | Array of authorized coding domains | `content.ts`, `websites.ts`, `background.ts` | `websites.ts` | Checked prior to content script UI injection |
| `fsrsGlobalParams` | `FSRSParameters` | Custom 17 FSRS weights and retention target | `fsrsScheduler.ts`, `fsrsConfig.ts` | `fsrsConfig.ts` (manual or WASM training) | Read when scheduler instantiates |
| `theme` | `string` | UI color theme (`'dark'`, `'light'`, `'system'`) | All extension pages and content scripts | `theme-sync.ts`, `ActionService` | Read on page mount; broadcast on toggle |

---

## 3. Storage Concurrency & Reactivity

### 3.1 Concurrency Mitigations
Because multiple tabs can be open simultaneously, concurrent writes to `fsrsCards` could cause race conditions if tabs overwrite the full array with stale reads. AlgoRecall mitigates this through:
1. **Fresh Storage Fetches**: Writers fetch the latest `fsrsCards` array immediately before modifying it:
   ```typescript
   chrome.storage.local.get(['fsrsCards'], (res) => {
       const latestCards = res.fsrsCards || [];
       const index = latestCards.findIndex(c => c.id === updatedCard.id);
       if (index >= 0) latestCards[index] = updatedCard;
       else latestCards.push(updatedCard);
       chrome.storage.local.set({ fsrsCards: latestCards });
   });
   ```
2. **Reactive `chrome.storage.onChanged` Listeners**: All active UI components listen to `chrome.storage.onChanged` and refresh their in-memory collections when external updates occur.
