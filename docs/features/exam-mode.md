# Exam Countdown Mode & Workload Redistribution

## 1. Purpose & Core Philosophy

Standard spaced repetition schedules reviews across expanding intervals (weeks, months, years) to maximize long-term retention with minimal repetitions. However, candidates preparing for tech interviews or students studying for university exams face a **fixed, hard deadline** (e.g., an upcoming Meta or Google interview in 14 days).

Under standard scheduling, difficult cards might be scheduled *after* the exam date, leaving major gaps in recall readiness.

**Exam Countdown Mode** (`studyplan.ts` / `studyplan.html`) solves this by:
1. Compressing and **evenly redistributing 100% of the card inventory** across the days remaining until the target exam date.
2. Prioritizing **high-difficulty and overdue cards** to be reviewed earliest in the schedule.
3. Preserving original computed FSRS review schedules in a non-destructive manner so the regular spaced repetition cycle can be restored when Exam Mode ends.

---

## 2. Redistribution Algorithm

The redistribution logic is implemented in [`StudyPlanController.redistributeCards()`](file:///Users/anmolrastogi/Documents/GitHub/algomonster-fsrs-extension/features/dashboard/studyplan/studyplan.ts):

### Step 1: Time Horizon Calculation
$$\text{daysLeft} = \max\left(1, \left\lceil \frac{\text{examTime} - \text{now}}{86,400,000} \right\rceil\right)$$

### Step 2: Sorting by Priority
Cards are sorted to ensure the highest-risk problems are scheduled first:
1. **Overdue / Low Stability First**: Cards where $due \le now$ or with lowest stability ($S$).
2. **High Difficulty First**: Cards with $difficulty \ge 7.0$.
3. **Recently Reviewed Last**: Cards with high stability ($S > 21$) scheduled later in the window.

### Step 3: Even Daily Distribution
$$\text{dailyQuota} = \left\lceil \frac{\text{totalCards}}{\text{daysLeft}} \right\rceil$$

For each card $i$ from $0$ to $\text{totalCards} - 1$:
- Assigned Day Offset: $\text{dayOffset} = \lfloor \frac{i}{\text{dailyQuota}} \rfloor \pmod{\text{daysLeft}}$
- Scheduled Due Date: $\text{newDue} = \text{startOfToday} + (\text{dayOffset} \times 86,400,000) + \text{hourStagger}$

### Step 4: Non-Destructive Due Date Backup
Before mutating `card.due`, the controller saves the original computed due date into `card.previousDue`:
```typescript
if (!card.previousDue) {
    card.previousDue = card.due;
}
card.due = newDueTimestamp;
```

---

## 3. User Interface & State Management

### Setup Panel vs Active Exam Panel
* **Setup Panel (`#setup-panel`)**: Rendered when Exam Mode is inactive. Features an HTML date picker (`min = tomorrow`), calculated daily review preview, and the **Activate Exam Mode** trigger.
* **Active Exam Panel (`#active-panel`)**: Rendered when Exam Mode is in progress:
  - **Circular SVG Countdown Ring**: Displays days remaining with dynamic dash-offset animation.
  - **Schedule Breakdown Table**: Day-by-day table showing card titles and counts allocated for each remaining day.
  - **Deactivate Exam Mode Button**: Reverts all cards to their pre-exam schedules.

### Schedule Restoration (Deactivation)
When the user clicks **Deactivate Exam Mode**:
1. Iterates through all cards:
   ```typescript
   if (card.previousDue) {
       card.due = card.previousDue;
       delete card.previousDue;
   }
   ```
2. Sets `studyPlanSettings.isActive = false` in `chrome.storage.local`.
3. Background service worker reactively recalculates standard due badges.
