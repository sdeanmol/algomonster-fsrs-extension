# AlgoRecall – Decorator Migration Plan & Traceability Matrix

**Date**: 2026-11-20  
**Repository**: `algomonster-fsrs-extension` (`main`)

## 1. Migration Phasing Strategy

```
Phase 1: Leaf Utilities & Core Decorator Module
  ├── Create decorators/errorDecorators.ts
  ├── Create decorators/index.ts
  └── Create comprehensive unit test suite in tests/unit/decorators/

Phase 2: High-Duplication Class Methods (Completed)
  ├── PomodoroTimer (features/dashboard/pomodoro/pomodoro.ts) -> 11 methods migrated
  ├── FSRSDataDashboard (features/common/data/data.ts) -> 4 methods migrated
  └── StatsComponent (features/dashboard/popup/stats.ts) -> 5 methods migrated

Phase 3: Additional Dashboard Subsystems (Identified Candidates)
  ├── FSRSHistoryDashboard (features/dashboard/history/history.ts)
  ├── WelcomeController (features/common/welcome/welcome.ts)
  └── HelpController (features/common/help/help.ts)

Phase 4: Functional Callbacks via Companion Utilities
  ├── Content script DOM event handlers -> withErrorHandling()
  └── Storage callbacks -> withFallback()
```

---

## 2. Master Migration Traceability Matrix

| Function ID | File | Function / Method | Baseline Pattern | Target Abstraction | Rationale | Risk Level | Migration Status |
|---|---|---|---|---|---|---|---|
| `TSF-0563` | `features/dashboard/pomodoro/pomodoro.ts` | `start` | Pattern C (Log & Swallow) | `@CatchAndLog` | Entire method wrapped in UIUtils.catchError | Low | **Migrated** |
| `TSF-0564` | `features/dashboard/pomodoro/pomodoro.ts` | `pause` | Pattern C (Log & Swallow) | `@CatchAndLog` | Boilerplate UI error logging | Low | **Migrated** |
| `TSF-0565` | `features/dashboard/pomodoro/pomodoro.ts` | `reset` | Pattern C (Log & Swallow) | `@CatchAndLog` | Boilerplate UI error logging | Low | **Migrated** |
| `TSF-0566` | `features/dashboard/pomodoro/pomodoro.ts` | `skip` | Pattern C (Log & Swallow) | `@CatchAndLog` | Boilerplate UI error logging | Low | **Migrated** |
| `TSF-0570` | `features/dashboard/pomodoro/pomodoro.ts` | `startVisualInterval` | Pattern C (Log & Swallow) | `@CatchAndLog` | Timer visual interval setup | Low | **Migrated** |
| `TSF-0571` | `features/dashboard/pomodoro/pomodoro.ts` | `stopVisualInterval` | Pattern C (Log & Swallow) | `@CatchAndLog` | Timer visual interval teardown | Low | **Migrated** |
| `TSF-0572` | `features/dashboard/pomodoro/pomodoro.ts` | `updateDisplay` | Pattern C (Log & Swallow) | `@CatchAndLog` | DOM visual update | Low | **Migrated** |
| `TSF-0573` | `features/dashboard/pomodoro/pomodoro.ts` | `updateRing` | Pattern C (Log & Swallow) | `@CatchAndLog` | SVG circular progress ring render | Low | **Migrated** |
| `TSF-0574` | `features/dashboard/pomodoro/pomodoro.ts` | `updatePhaseIndicator` | Pattern C (Log & Swallow) | `@CatchAndLog` | Header pill style update | Low | **Migrated** |
| `TSF-0575` | `features/dashboard/pomodoro/pomodoro.ts` | `updateSessionDots` | Pattern C (Log & Swallow) | `@CatchAndLog` | Session dot container render | Low | **Migrated** |
| `TSF-0576` | `features/dashboard/pomodoro/pomodoro.ts` | `updateTodayStats` | Pattern C (Log & Swallow) | `@CatchAndLog` | Total focus time tally | Low | **Migrated** |
| `TSF-0153` | `features/common/data/data.ts` | `populateTagsFilter` | Pattern C (Log & Swallow) | `@CatchAndLog` | Dropdown tag injection | Low | **Migrated** |
| `TSF-0154` | `features/common/data/data.ts` | `populatePlatformFilter` | Pattern C (Log & Swallow) | `@CatchAndLog` | Dropdown platform injection | Low | **Migrated** |
| `TSF-0164` | `features/common/data/data.ts` | `closeEditModal` | Pattern C (Log & Swallow) | `@CatchAndLog` | Modal hide & form reset | Low | **Migrated** |
| `TSF-0168` | `features/common/data/data.ts` | `getStateLabel` | Pattern B (Log & Return) | `@CatchAndReturn('Unknown')` | Deterministic status string fallback | Low | **Migrated** |
| `TSF-0648` | `features/dashboard/popup/stats.ts` | `calculateStreaks` | Pattern B (Log & Return) | `@CatchAndReturn({ current: 0, longest: 0 })` | Streak tally fallback | Low | **Migrated** |
| `TSF-0649` | `features/dashboard/popup/stats.ts` | `formatDateKey` | Pattern B (Log & Return) | `@CatchAndReturn(fallback)` | Date formatter fallback | Low | **Migrated** |
| `TSF-0645` | `features/dashboard/popup/stats.ts` | `bindEvents` | Pattern C (Log & Swallow) | `@CatchAndLog` | DOM event binding | Low | **Migrated** |
| `TSF-0651` | `features/dashboard/popup/stats.ts` | `showMilestoneToast` | Pattern C (Log & Swallow) | `@CatchAndLog` | Toast banner display | Low | **Migrated** |
| `TSF-0652` | `features/dashboard/popup/stats.ts` | `showConfetti` | Pattern C (Log & Swallow) | `@CatchAndLog` | Canvas confetti animation | Low | **Migrated** |
| `TSF-0010` | `background/background.ts` | `handleMessage` | Pattern C (Async Dispatch) | **Keep Explicit** | Port closure protocol (`return true`) | High | **Retained** |
| `TSF-0012` | `background/background.ts` | `notifyDueCards` | Pattern E (Multi-step Fallback) | **Keep Explicit** | Quiet hours & OS fallback | High | **Retained** |
| `TSF-0158` | `features/common/data/data.ts` | `bulkDelete` | Pattern E (Database Transaction) | **Keep Explicit** | Rollback snapshot & undo timer | High | **Retained** |
| `TSF-0518` | `features/dashboard/history/history.ts` | `aggregateByYear` | Pattern B (Log & Return) | `@CatchAndReturn({})` | Candidate for Phase 3 rollout | Low | **Deferred** |
| `TSF-0519` | `features/dashboard/history/history.ts` | `aggregateByMonth` | Pattern B (Log & Return) | `@CatchAndReturn({})` | Candidate for Phase 3 rollout | Low | **Deferred** |
