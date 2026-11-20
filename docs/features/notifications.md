# Desktop Notifications, Quiet Hours & Automated Digests

## 1. Overview of the Notification Subsystem

The notification subsystem in [`background/background.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts) provides spaced repetition review reminders, daily streak maintenance alerts, and weekly progress digests.

---

## 2. Notification Types & Triggers

### 2.1 Review Due Reminder
- **Trigger**: Fired by `checkFsrsReviews` background alarm (configurable frequency, default: 60 minutes) or `smartReviewSchedule` alarm (daily at 17:00).
- **Tag-Based Grouping**:
  Instead of displaying generic messages, AlgoRecall analyzes due cards and aggregates them by their top 3 topic tags:
  ```
  "You have 4 Dynamic Programming, 2 Graph, 1 Tree patterns ready for review."
  ```
- **In-Page vs System Tray Delivery**:
  - If the user is actively working on a whitelisted coding platform tab (LeetCode, AlgoMonster), the service worker delivers an **in-page DOM toast notification** via `chrome.tabs.sendMessage('show_custom_notification')` to avoid interrupting their coding session.
  - If the active tab is not a whitelisted site or if the message fails, it falls back to a **native system desktop notification** via `chrome.notifications.create()`.

### 2.2 Quiet Hours Suppression
Users can configure a quiet hours window (e.g. `23:00` to `07:00`). Before dispatching any notification, `checkDueCards()` evaluates:
```typescript
const [startH, startM] = startStr.split(':').map(Number);
const [endH, endM] = endStr.split(':').map(Number);
// Accurately evaluates time ranges spanning midnight (23:00 -> 07:00)
if (startTotal <= endTotal) {
    if (currentTotal >= startTotal && currentTotal < endTotal) return;
} else {
    if (currentTotal >= startTotal || currentTotal < endTotal) return;
}
```
If quiet hours are active, review notifications are silently suppressed while toolbar badges remain updated.

### 2.3 Daily Streak Nudge
- **Trigger**: `dailyNudge` alarm (fires daily at 20:00).
- **Behavior**: Inspects `fsrsActivity[today]`. If no reviews have been completed, it evaluates whether the user has an active streak (`fsrsActivity[yesterday] > 0`):
  - **Streak at Risk**: `"🔥 Keep Your Streak Alive! You haven't reviewed any patterns today."`
  - **New Streak**: `"🚀 Start a New Streak Today! Start fresh with just 5 minutes of review!"`

### 2.4 Weekly Study Digest
- **Trigger**: `weeklySummary` alarm (fires every Monday at 9:00 AM local time).
- **Behavior**: Aggregates the last 7 calendar days of review activity, compares week-over-week trends, and projects the upcoming 7-day review backlog.
- **Click Routing**: Clicking the notification banner opens the dedicated [`summary.html`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/summary/summary.html) page.
