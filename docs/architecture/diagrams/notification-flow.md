# Notification & Background Scheduling Flow Diagram

This document contains formal Mermaid diagrams illustrating the notification scheduling, alarm triggers, quiet hours suppression, and dispatch routing implemented in [`background/background.ts`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/background/background.ts).

---

## 1. Notification Architecture & Dispatch Flow (Diagram 8)

The following diagram maps out how background alarms trigger review checks, how quiet hours and frequency throttling are evaluated, and how notifications are routed between in-page DOM toasts and OS system tray banners.

```mermaid
flowchart TD
    subgraph Triggers["Alarm & Event Triggers"]
        ALARM_POLL["Alarm: checkFsrsReviews (Every N minutes, default 60)"]
        ALARM_SMART["Alarm: smartReviewSchedule (Daily at 17:00)"]
        ALARM_NUDGE["Alarm: dailyNudge (Daily at 20:00)"]
        ALARM_WEEKLY["Alarm: weeklySummary (Mondays at 09:00)"]
        CMD_CHECK["Shortcut / Command: check-due-reviews (Alt+Shift+R)"]
        MSG_TEST["Runtime Message: test_notification"]
    end

    subgraph ServiceWorkerProcessing["Background Service Worker (background.ts)"]
        REENTRANCY{"isCheckingDueCards Already Running?"}
        THROTTLE{"Minimum Frequency Interval Elapsed? (lastNotificationTime)"}
        ENABLED{"Notifications Enabled?"}
        QUIET_HOURS{"Quiet Hours Active? (e.g. 23:00 - 07:00)"}
        DUE_FILTER{"Filter fsrsCards: card.due <= Date.now() Any Due Cards?"}
        GROUP_TAGS["Group Due Cards by Top 3 Tags (e.g. 5 DP, 3 Tree)"]
    end

    subgraph DispatchRouting["Notification Delivery Routing"]
        QUERY_TAB["chrome.tabs.query (active: true, currentWindow: true)"]
        IS_WHITELISTED{"Active Tab URL in Whitelisted Websites?"}
        IN_PAGE_ALERT["chrome.tabs.sendMessage (show_custom_notification) In-Page Toast"]
        SYSTEM_NOTIF["chrome.notifications.create (algo-review-notification) Native OS Banner"]
        BADGE_UPDATE["updateDueCardsBadge() chrome.action.setBadgeText(dueCount)"]
    end

    subgraph UserAction["User Interaction"]
        CLICK_NOTIF["User Clicks Desktop Notification"]
        OPEN_PAGE["Route to Extension Page: popup.html / summary.html / pomodoro.html"]
    end

    %% Trigger Connections
    ALARM_POLL --> REENTRANCY
    ALARM_SMART --> REENTRANCY
    CMD_CHECK --> REENTRANCY
    MSG_TEST --> REENTRANCY

    %% Reentrancy Check
    REENTRANCY -- Yes --> DROP_EVENT["Drop Concurrent Execution"]
    REENTRANCY -- No --> SET_LOCK["Set isCheckingDueCards = true"]
    SET_LOCK --> THROTTLE

    %% Throttle Check
    THROTTLE -- No --> UNLOCK["Unlock isCheckingDueCards & Update Badge"]
    THROTTLE -- Yes --> ENABLED

    %% Enabled Check
    ENABLED -- Disabled --> UNLOCK
    ENABLED -- Enabled --> QUIET_HOURS

    %% Quiet Hours Check
    QUIET_HOURS -- In Quiet Hours --> UNLOCK
    QUIET_HOURS -- Outside Quiet Hours --> DUE_FILTER

    %% Due Cards Filter
    DUE_FILTER -- None Due --> UNLOCK
    DUE_FILTER -- Cards Due > 0 --> GROUP_TAGS
    GROUP_TAGS --> QUERY_TAB

    %% Dispatch Routing
    QUERY_TAB --> IS_WHITELISTED
    IS_WHITELISTED -- Yes --> IN_PAGE_ALERT
    IN_PAGE_ALERT -- Fails --> SYSTEM_NOTIF
    IS_WHITELISTED -- No --> SYSTEM_NOTIF

    IN_PAGE_ALERT --> UNLOCK
    SYSTEM_NOTIF --> UNLOCK
    UNLOCK --> BADGE_UPDATE

    %% Click Handling
    SYSTEM_NOTIF -.-> CLICK_NOTIF
    CLICK_NOTIF --> OPEN_PAGE
```

---

## 2. Weekly Digest & Daily Streak Nudge Workflows

### 2.1 Weekly Summary Digest (Mondays 9:00 AM)
1. **Alarm Trigger**: `weeklySummary` fires every Monday at 9:00 AM local time.
2. **Aggregation**:
   - Queries `fsrsActivity` across the last 7 calendar days to compute total reviews and active study days.
   - Queries previous 7-day window to compute week-over-week trend (`📈 +15 vs last week`).
   - Scans `fsrsCards` to forecast upcoming load: cards due in the next 7 days (`due <= now + 7 days`).
3. **Notification Output**:
   Dispatches notification: `"This week: 42 reviews across 5 day(s). 📈 +12 vs last week. Upcoming: 18 cards due next week."`

### 2.2 Daily Streak Nudge (Daily at 20:00)
1. **Alarm Trigger**: `dailyNudge` fires daily at 8:00 PM local time.
2. **Streak Verification**:
   - Checks `fsrsActivity[today]`. If reviews > 0, skips notification (goal met).
   - If reviews === 0, inspects `fsrsActivity[yesterday]` to check if an active streak is at risk.
3. **Notification Content**:
   - **Active Streak at Risk**: `"🔥 Keep Your Streak Alive! You haven't reviewed any patterns today. Just 5 minutes can keep your memory sharp!"`
   - **No Active Streak**: `"🚀 Start a New Streak Today! Every expert was once a beginner. Start fresh with just 5 minutes of review!"`
