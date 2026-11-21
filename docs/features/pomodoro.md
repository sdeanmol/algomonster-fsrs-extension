# Pomodoro Study Timer & State Synchronization

## 1. Overview & Architectural Role

AlgoRecall includes a dedicated **Pomodoro Study Timer** (`features/dashboard/pomodoro/pomodoro.ts`) built directly into the extension. It integrates spaced repetition reviews with timeboxed study intervals:
- Standard 4-session focus cycle (25 min Focus, 5 min Short Break, 15 min Long Break).
- Real-time toolbar icon badge ticking (`25m`, `4m`, `45s`).
- Dual-layer service worker synchronization ensuring the timer never loses state or misses alarms if the browser sleeps.

---

## 2. Timer State Machine

The timer transitions through the following states and phases:

```
                  ┌─────────┐
       ┌─────────►│  IDLE   │◄────────┐
       │          └────┬────┘         │
       │ Reset         │ Start        │ Skip
       │               ▼              │
       │          ┌─────────┐         │
       └──────────┤ RUNNING ├─────────┘
                  └────┬────┘
                  Pause│ ▲ Resume
                       ▼ │
                  ┌─────────┐
                  │ PAUSED  │
                  └─────────┘
```

### Phase Transition Cycle
1. **Focus Session 1** (25 min) $\to$ **Short Break 1** (5 min)
2. **Focus Session 2** (25 min) $\to$ **Short Break 2** (5 min)
3. **Focus Session 3** (25 min) $\to$ **Short Break 3** (5 min)
4. **Focus Session 4** (25 min) $\to$ **Long Break** (15 min)
5. Cycle restarts at Focus Session 1.

---

## 3. Background Synchronization & Ephemerality Resilience

Because Chrome extension service workers terminate after ~30 seconds of inactivity, a simple `setInterval` in the background worker would freeze when idle. AlgoRecall solves this with a **dual-mechanism approach**:

```
                       User Clicks "Start" in Pomodoro Tab
                                        │
                                        ▼
                  Sends Message: { action: "pomodoro_action", ... }
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
     Mechanism 1: Real-Time Ticker          Mechanism 2: Backup Wake-Up Alarm
    (background/background.ts L1220)        (background/background.ts L1183)
    - Starts setInterval(tick, 1000)        - Creates chrome.alarms:
    - Calculates timeRemaining from           name: 'pomodoroEnd'
      targetEndTime                           delayInMinutes: (target - now)
    - Updates chrome.action badge:          - Guaranteed to wake service worker
      badgeText: "24m", "15s"                 even if setInterval terminates
      badgeColor: #e74c3c (Focus)             during deep background sleep
      badgeColor: #2ecc71 (Break)
                    │                                       │
                    └───────────────────┬───────────────────┘
                                        │
                                        ▼
                           When Timer Reaches Zero
                                        │
                        handlePomodoroEnd() Executes:
                        1. Clears interval & alarms
                        2. Increments pomodoroStats (sessionsToday, focusMinutesToday)
                        3. Advances phase (Focus -> Break)
                        4. Dispatches desktop notification:
                           "⏱️ Pomodoro Complete! Ready for a Break?"
                        5. Updates chrome.storage.local
```

### Cross-Tab Reactivity
When `handlePomodoroEnd()` or user controls update `pomodoroState` in storage, all open Pomodoro tabs receive `chrome.storage.onChanged` and instantly update their animated SVG progress rings, phase badges, and sound notifications without polling.
